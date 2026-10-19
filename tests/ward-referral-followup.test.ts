import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { ReferralInformationNeed } from "@/components/ward-management/referrals/referral-information-needs";
import type { Referral, ReferralAddressing } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

/** A seeded referral re-addressed to one named ward, still waiting on that ward's answer. */
function fixture() {
  const seeded = seedWardFlowState();
  const unitId = seeded.units[0]!.id;
  const base = seeded.referrals[0]!;
  const referral: Referral = {
    ...base,
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId,
          sex: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "queued",
        referredAt: NOW - 60,
      },
    ],
  };
  const state: WardFlowState = {
    ...seeded,
    referrals: seeded.referrals.map((candidate) => (candidate.id === base.id ? referral : candidate)),
  };
  return { state, referralId: base.id, unitId };
}

function copyOf(state: WardFlowState, referralId: string, unitId: string): ReferralAddressing {
  const referral = state.referrals.find((candidate) => candidate.id === referralId) as Referral;
  const copy = referral.destinations.find(
    (addressing) => addressing.destination.kind === "psychiatric_ward" && addressing.destination.unitId === unitId,
  );
  if (!copy) throw new Error("no ward copy");
  return copy;
}

describe("MARK_REFERRAL_OPENED", () => {
  it("stamps the ward's copy once, and never answers it", () => {
    const f = fixture();
    const opened = wardFlowReducer(f.state, {
      type: "MARK_REFERRAL_OPENED",
      role: "ward",
      now: NOW,
      referralId: f.referralId,
      unitId: f.unitId,
      actingUnitId: f.unitId,
    });
    expect(opened.rejections).toEqual([]);
    const copy = copyOf(opened, f.referralId, f.unitId);
    expect(copy.openedAt).toBe(NOW);
    expect(copy.state).toBe("queued");
    expect(copy.decidedAt).toBeUndefined();

    const again = wardFlowReducer(opened, {
      type: "MARK_REFERRAL_OPENED",
      role: "ward",
      now: NOW + 5,
      referralId: f.referralId,
      unitId: f.unitId,
      actingUnitId: f.unitId,
    });
    expect(again.rejections).toHaveLength(1);
    expect(copyOf(again, f.referralId, f.unitId).openedAt).toBe(NOW);
  });

  it("refuses a ward opening another ward's copy, and any other role", () => {
    const f = fixture();
    const other = wardFlowReducer(f.state, {
      type: "MARK_REFERRAL_OPENED",
      role: "ward",
      now: NOW,
      referralId: f.referralId,
      unitId: f.unitId,
      actingUnitId: "some-other-ward",
    });
    expect(other.rejections).toHaveLength(1);
    const coordinator = wardFlowReducer(f.state, {
      type: "MARK_REFERRAL_OPENED",
      role: "coordinator",
      now: NOW,
      referralId: f.referralId,
      unitId: f.unitId,
      actingUnitId: f.unitId,
    });
    expect(coordinator.rejections).toHaveLength(1);
    expect(copyOf(coordinator, f.referralId, f.unitId).openedAt).toBeUndefined();
  });
});

describe("what we still need", () => {
  const ask = (state: WardFlowState, f: ReturnType<typeof fixture>, needs: ReferralInformationNeed[], now = NOW) =>
    wardFlowReducer(state, {
      type: "REQUEST_REFERRAL_INFORMATION",
      role: "ward",
      now,
      referralId: f.referralId,
      unitId: f.unitId,
      actingUnitId: f.unitId,
      needs,
    });

  it("records the listed items without deciding, and skips one already waiting", () => {
    const f = fixture();
    const asked = ask(f.state, f, ["medical_clearance_result", "drug_screen"]);
    expect(asked.rejections).toEqual([]);
    const copy = copyOf(asked, f.referralId, f.unitId);
    expect(copy.state).toBe("queued");
    expect(copy.informationNeeds?.map((entry) => entry.need)).toEqual(["medical_clearance_result", "drug_screen"]);

    const twice = ask(asked, f, ["drug_screen", "legal_form_copy"], NOW + 1);
    expect(copyOf(twice, f.referralId, f.unitId).informationNeeds?.map((entry) => entry.need)).toEqual([
      "medical_clearance_result",
      "drug_screen",
      "legal_form_copy",
    ]);
    expect(ask(twice, f, ["drug_screen"]).rejections).toHaveLength(1);
  });

  it("refuses an item off the list, an empty ask and another ward's copy", () => {
    const f = fixture();
    expect(ask(f.state, f, ["anything typed" as ReferralInformationNeed]).rejections).toHaveLength(1);
    expect(ask(f.state, f, []).rejections).toHaveLength(1);
    const other = wardFlowReducer(f.state, {
      type: "REQUEST_REFERRAL_INFORMATION",
      role: "ward",
      now: NOW,
      referralId: f.referralId,
      unitId: f.unitId,
      actingUnitId: "some-other-ward",
      needs: ["drug_screen"],
    });
    expect(other.rejections).toHaveLength(1);
  });

  it("lets the referrer tick an item off, once, and keeps the record", () => {
    const f = fixture();
    const asked = ask(f.state, f, ["bloods_or_ecg"]);
    const met = wardFlowReducer(asked, {
      type: "MARK_REFERRAL_INFORMATION_MET",
      role: "ed",
      now: NOW + 30,
      referralId: f.referralId,
      unitId: f.unitId,
      need: "bloods_or_ecg",
    });
    expect(met.rejections).toEqual([]);
    expect(copyOf(met, f.referralId, f.unitId).informationNeeds).toEqual([
      expect.objectContaining({ need: "bloods_or_ecg", at: NOW, metAt: NOW + 30 }),
    ]);
    const again = wardFlowReducer(met, {
      type: "MARK_REFERRAL_INFORMATION_MET",
      role: "ed",
      now: NOW + 31,
      referralId: f.referralId,
      unitId: f.unitId,
      need: "bloods_or_ecg",
    });
    expect(again.rejections).toHaveLength(1);
    const byWard = wardFlowReducer(asked, {
      type: "MARK_REFERRAL_INFORMATION_MET",
      role: "ward",
      now: NOW + 30,
      referralId: f.referralId,
      unitId: f.unitId,
      need: "bloods_or_ecg",
    });
    expect(byWard.rejections).toHaveLength(1);
  });
});
