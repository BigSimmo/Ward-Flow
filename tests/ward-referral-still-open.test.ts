import { describe, expect, it } from "vitest";

import { referralStillOpen } from "@/components/ward-management/referrals/referral-still-open";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, Referral } from "@/components/ward-management/ward-model";

/**
 * Item 10 (10 Nov 2026): the Ready to send rail's "Still open" list is built only from records that
 * already exist, the ward's "asked for" needs and the D-110 clearance timing. Synthetic records only.
 */

const ARRIVED = 9 * 60 + 7;

function edMovement(overrides: Partial<Movement> = {}): Movement {
  const seed = seedWardFlowState().movements.find((movement) => !movement.closure && movement.originEdId);
  if (!seed) throw new Error("the seed has no open ED journey");
  const rest: Partial<Movement> = { ...seed };
  delete rest.medicalClearance;
  delete rest.referralId;
  return { ...rest, openedAt: ARRIVED, ...overrides } as Movement;
}

function wardReferral(overrides: Partial<Referral> & { needs?: { need: string; metAt?: number }[] }): Referral {
  const { needs = [], ...rest } = overrides;
  return {
    id: "RF-SYN-1",
    patientId: "PT-SYN-1",
    raisedAt: ARRIVED + 30,
    urgency: 2,
    destinations: [
      {
        destination: { kind: "psychiatric_ward", unitId: "rph-adult-secure", sex: "Female" },
        state: "queued",
        referredAt: ARRIVED + 30,
        informationNeeds: needs.map((entry, index) => ({
          need: entry.need,
          at: ARRIVED + 40 + index,
          by: "Ward nurse in charge",
          ...(entry.metAt === undefined ? {} : { metAt: entry.metAt, metBy: "Bed coordinator" }),
        })),
      },
    ],
    ...rest,
  } as unknown as Referral;
}

const base = { personId: "PT-SYN-1", formSaysDone: false, now: ARRIVED + 3 * 60 };

describe("Still open: the recorded medical clearance timing (D-110)", () => {
  it("names a clearance not recorded with the arrival time, amber only from the tracker's six hours", () => {
    const words = `Medical clearance not recorded (since ${formatInstantWithDay(ARRIVED, base.now)})`;
    expect(referralStillOpen({ ...base, referrals: [], edMovement: edMovement() })).toEqual([
      { id: "clearance", words, flagged: false },
    ]);
    expect(words).toBe("Medical clearance not recorded (since 09:07)");
    const before = referralStillOpen({ ...base, referrals: [], edMovement: edMovement(), now: ARRIVED + 6 * 60 - 1 });
    expect(before[0]?.flagged).toBe(false);
    const atSix = referralStillOpen({ ...base, referrals: [], edMovement: edMovement(), now: ARRIVED + 6 * 60 });
    expect(atSix[0]?.flagged).toBe(true);
  });

  it("names a recorded 'not yet' as to follow, and drops the line once clearance is recorded or answered", () => {
    const pending = edMovement({ medicalClearance: { cleared: false, at: ARRIVED + 50 } });
    expect(referralStillOpen({ ...base, referrals: [], edMovement: pending })[0]?.words).toBe(
      "Medical clearance to follow (recorded 09:57)",
    );
    const done = edMovement({ medicalClearance: { cleared: true, at: ARRIVED + 50 } });
    expect(referralStillOpen({ ...base, referrals: [], edMovement: done })).toEqual([]);
    expect(referralStillOpen({ ...base, referrals: [], edMovement: edMovement(), formSaysDone: true })).toEqual([]);
    expect(referralStillOpen({ ...base, referrals: [], edMovement: undefined })).toEqual([]);
  });

  it("never says a patient is cleared", () => {
    const cases = [
      edMovement(),
      edMovement({ medicalClearance: { cleared: false, at: ARRIVED + 5 } }),
      edMovement({ medicalClearance: { cleared: true, at: ARRIVED + 5 } }),
    ];
    for (const movement of cases) {
      for (const item of referralStillOpen({ ...base, referrals: [], edMovement: movement })) {
        expect(item.words).not.toMatch(/\bcleared\b/i);
      }
    }
  });
});

describe("Still open: what a ward asked for", () => {
  it("lists exactly the recorded needs still open on this person's open referral, in the order asked", () => {
    const referral = wardReferral({
      needs: [{ need: "legal_form_copy" }, { need: "drug_screen", metAt: ARRIVED + 60 }, { need: "bloods_or_ecg" }],
    });
    expect(
      referralStillOpen({ ...base, referrals: [referral], edMovement: undefined }).map((item) => item.words),
    ).toEqual(["Ward asked for: legal form copy", "Ward asked for: recent bloods or ECG"]);
  });

  it("reads only this person's latest referral: another person's, an older one and an unlinked one stay out", () => {
    const other = wardReferral({
      id: "RF-SYN-2",
      patientId: "PT-SYN-2",
      raisedAt: ARRIVED + 99,
      needs: [{ need: "collateral_history" }],
    });
    const unlinked = wardReferral({
      id: "RF-SYN-3",
      patientId: undefined,
      raisedAt: ARRIVED + 99,
      needs: [{ need: "collateral_history" }],
    });
    const older = wardReferral({ id: "RF-SYN-4", raisedAt: ARRIVED, needs: [{ need: "drug_screen" }] });
    const latest = wardReferral({ id: "RF-SYN-5", raisedAt: ARRIVED + 50, needs: [{ need: "legal_form_copy" }] });
    expect(referralStillOpen({ ...base, referrals: [other, unlinked, older, latest], edMovement: undefined })).toEqual([
      { id: "need-legal_form_copy", words: "Ward asked for: legal form copy", flagged: false },
    ]);
  });

  it("drops a ward that has answered or been withdrawn, and lists an item two wards asked for once", () => {
    const accepted = wardReferral({ needs: [{ need: "drug_screen" }] });
    accepted.destinations = accepted.destinations.map((arm) => ({ ...arm, state: "accepted" }));
    expect(referralStillOpen({ ...base, referrals: [accepted], edMovement: undefined })).toEqual([]);
    const withdrawn = wardReferral({ needs: [{ need: "bed_type_clarified" }] });
    withdrawn.destinations = withdrawn.destinations.map((arm) => ({ ...arm, withdrawnAt: ARRIVED + 90 }));
    expect(referralStillOpen({ ...base, referrals: [withdrawn], edMovement: undefined })).toEqual([]);
    const twoWards = wardReferral({ needs: [{ need: "legal_form_copy" }] });
    twoWards.destinations = [...twoWards.destinations, ...twoWards.destinations];
    expect(
      referralStillOpen({ ...base, referrals: [twoWards], edMovement: undefined }).map((item) => item.words),
    ).toEqual(["Ward asked for: legal form copy"]);
  });

  it("is empty, so the rail hides it, when nothing is open", () => {
    expect(referralStillOpen({ ...base, referrals: [wardReferral({})], edMovement: undefined })).toEqual([]);
    expect(referralStillOpen({ ...base, personId: undefined, referrals: [], edMovement: undefined })).toEqual([]);
  });
});

describe("Still open in the demo seed (D-141, Josh 11 Nov 2026)", () => {
  it("shows what the youth unit asked for on PT-079's latest referral (RF-001) without any set-up", () => {
    const seeded = seedWardFlowState();
    const words = referralStillOpen({
      personId: "PT-079",
      referrals: seeded.referrals,
      edMovement: undefined,
      formSaysDone: false,
      now: Math.max(...seeded.referrals.map((referral) => referral.raisedAt)),
    }).map((item) => item.words);
    expect(words).toEqual(["Ward asked for: collateral history"]);
  });
});
