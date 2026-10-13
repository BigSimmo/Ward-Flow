import { describe, expect, it } from "vitest";

import {
  buildPatientStatus,
  type PatientStatusContext,
} from "@/components/ward-management/patients/patient-status-card";
import { acceptedWardOf, acceptedWardReferralFor } from "@/components/ward-management/referrals/accepted-ward-referral";
import type { Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * S-9 (audit 13 Oct 2026): accepting a referral into a ward left the referral with only "Open ward
 * board" and the patient record reading "Not active". Accepting pulls no bed and creates no
 * movement, so both now name the ward and the next step, holding the bed.
 */
const noop = () => {};
function ctx(extra: Partial<PatientStatusContext> = {}): PatientStatusContext {
  return {
    hasBedHold: false,
    now: NOW_ANCHOR,
    dayZero: new Date(0),
    onOpenPlacement: noop,
    onClearance: noop,
    onBookTransport: noop,
    onArrivalTime: noop,
    onRecordReturn: noop,
    onMarkAbsent: noop,
    onAbsenceStep: noop,
    onRecordCto: noop,
    onEndCto: noop,
    ...extra,
  };
}

const units = [{ id: "dab-adult", name: "Dabakarn" }];
function referral(state: "queued" | "accepted", patientId = "PT-1"): Referral {
  return {
    id: `RF-${state}`,
    patientId,
    destinations: [{ destination: { kind: "psychiatric_ward", unitId: "dab-adult" }, state }],
  } as unknown as Referral;
}

describe("an accepted ward referral", () => {
  it("names the accepting ward and its board", () => {
    expect(acceptedWardOf(referral("accepted"), units)).toEqual({ unitId: "dab-adult", unitName: "Dabakarn" });
    expect(acceptedWardOf(referral("queued"), units)).toBeUndefined();
  });

  it("is found for its own person only", () => {
    const referrals = [referral("accepted")];
    expect(acceptedWardReferralFor("PT-1", referrals, units)?.unitName).toBe("Dabakarn");
    expect(acceptedWardReferralFor("PT-2", referrals, units)).toBeUndefined();
    expect(acceptedWardReferralFor(undefined, referrals, units)).toBeUndefined();
  });

  it("is not offered once the bed is held or the placement has happened", () => {
    const held = referral("accepted");
    held.destinations[0]!.heldBedNumber = 4;
    expect(acceptedWardReferralFor("PT-1", [held], units)).toBeUndefined();
    const accepted = referral("accepted");
    expect(
      acceptedWardReferralFor("PT-1", [accepted], units, { movements: [{ referralId: accepted.id }] }),
    ).toBeUndefined();
    expect(
      acceptedWardReferralFor("PT-1", [accepted], units, { admissions: [{ referralId: accepted.id }] }),
    ).toBeUndefined();
    expect(acceptedWardReferralFor("PT-1", [accepted], units, { admissions: [{ referralId: null }] })?.unitName).toBe(
      "Dabakarn",
    );
  });

  it("turns the patient card from Not active into the next step", () => {
    const status = buildPatientStatus(
      "idle",
      ctx({ acceptedReferral: { unitName: "Dabakarn", boardHref: "/mockups/ward-flow/board/dab-adult" } }),
    );
    expect(status.verdict).toBe("Accepted, no bed held");
    expect(status.meta).toBe("Accepted at Dabakarn. Next: hold the bed");
    expect(status.cells[0]).toMatchObject({ key: "bed", href: "/mockups/ward-flow/board/dab-adult" });
    expect(buildPatientStatus("idle", ctx()).verdict).toBe("Not active");
  });
});
