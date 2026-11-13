// Fix round C1 (Audit 16 A16-11, root causes 2.3 and 6.2; Josh approved 13 Nov 2026). A person whose
// only open record is a referral or a booked planned admission is not "Not active", and a recorded
// day that has passed is read as passed. Synthetic data only.
import { describe, expect, it } from "vitest";

import {
  bookedPlannedAdmissionFor,
  openReferralFor,
  openReferralSentTo,
} from "@/components/ward-management/patients/patient-open-work";
import { recordedDayIso, recordedDayPassed } from "@/components/ward-management/patients/patient-date-passed";
import type { PlannedAdmission } from "@/components/ward-management/ward-admissions";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral } from "@/components/ward-management/ward-model";

const seed = seedWardFlowState();

function referralLike(overrides: Partial<Referral>): Referral {
  const base = seed.referrals.find((referral) => referral.patientId !== undefined)!;
  return { ...structuredClone(base), ...overrides };
}

describe("open work for a person (A16-11)", () => {
  it("finds the seeded referral that is the person's only open record", () => {
    // Every seeded person whose only record is a referral awaiting an answer.
    const busy = new Set<string>([
      ...seed.movements.flatMap((movement) => (movement.patientId ? [movement.patientId] : [])),
      ...seed.admissions.flatMap((admission) =>
        admission.state !== "departed" && admission.patientId ? [admission.patientId] : [],
      ),
    ]);
    const referralOnly = seed.patients.filter(
      (patient) => !busy.has(patient.id) && openReferralFor(patient.id, seed.referrals) !== undefined,
    );
    // PT-060 is the script's Act 3 older adult referral (RF-005): a referral and nothing else.
    expect(referralOnly.map((patient) => patient.id)).toContain("PT-060");
    for (const patient of referralOnly) {
      const open = openReferralFor(patient.id, seed.referrals)!;
      expect(open.places).toBeGreaterThan(0);
    }
  });

  it("counts a queued arm, and not a withdrawn, declined or accepted one", () => {
    const arm = referralLike({}).destinations[0]!;
    const queued = referralLike({
      id: "RF-C1-1",
      patientId: "PT-C1",
      raisedAt: 10,
      destinations: [
        {
          ...arm,
          state: "queued",
          withdrawnAt: undefined,
          destination: { ...arm.destination, kind: "psychiatric_ward" } as typeof arm.destination,
        },
      ],
    });
    expect(openReferralFor("PT-C1", [queued])).toMatchObject({
      referralId: "RF-C1-1",
      wards: 1,
      places: 1,
      communityOnly: false,
    });
    expect(openReferralSentTo(openReferralFor("PT-C1", [queued])!)).toBe("Sent to 1 ward");

    const withdrawn = { ...queued, destinations: [{ ...queued.destinations[0]!, withdrawnAt: 12 }] };
    expect(openReferralFor("PT-C1", [withdrawn])).toBeUndefined();
    const declined = { ...queued, destinations: [{ ...queued.destinations[0]!, state: "declined" as const }] };
    expect(openReferralFor("PT-C1", [declined])).toBeUndefined();
    expect(openReferralFor("PT-OTHER", [queued])).toBeUndefined();
    expect(openReferralFor(undefined, [queued])).toBeUndefined();
  });

  it("marks a referral that asks only a community team as community only", () => {
    const arm = referralLike({}).destinations[0]!;
    const community = referralLike({
      id: "RF-C1-2",
      patientId: "PT-C1",
      destinations: [
        {
          ...arm,
          state: "queued",
          withdrawnAt: undefined,
          destination: { kind: "community_team", teamName: "Synthetic team" } as typeof arm.destination,
        },
      ],
    });
    const open = openReferralFor("PT-C1", [community])!;
    expect(open.communityOnly).toBe(true);
    expect(openReferralSentTo(open)).toBe("Sent to 1 place");
  });

  it("reads a booked planned admission and ignores cancelled and arrived ones", () => {
    const booking = {
      id: "PA-C1",
      patientId: "PT-C1",
      state: "booked",
      cancelledAt: null,
      expectedArrivalAt: 600,
      unitId: "unit-c1",
    } as unknown as PlannedAdmission;
    expect(bookedPlannedAdmissionFor("PT-C1", [booking])?.id).toBe("PA-C1");
    expect(bookedPlannedAdmissionFor("PT-C1", [{ ...booking, state: "cancelled", cancelledAt: 5 }])).toBeUndefined();
    expect(bookedPlannedAdmissionFor("PT-C1", [{ ...booking, state: "arrived" }])).toBeUndefined();
    expect(bookedPlannedAdmissionFor("PT-C1", undefined)).toBeUndefined();
  });
});

describe("a recorded day that has passed (root cause 2.3)", () => {
  it("reads an ISO day or a written day, and nothing else", () => {
    expect(recordedDayIso("2026-11-04")).toBe("2026-11-04");
    expect(recordedDayIso("4 Nov 2026, clinic")).toBe("2026-11-04");
    expect(recordedDayIso("10 November 2026, depot clinic")).toBe("2026-11-10");
    expect(recordedDayIso("Next week")).toBeUndefined();
    expect(recordedDayIso("31 Feb 2026")).toBeUndefined();
    expect(recordedDayIso(undefined)).toBeUndefined();
  });

  it("is passed only before today, and unknown when the text holds no day", () => {
    expect(recordedDayPassed("4 Nov 2026, clinic", "2026-11-13")).toBe(true);
    expect(recordedDayPassed("13 Nov 2026", "2026-11-13")).toBe(false);
    expect(recordedDayPassed("2026-11-20", "2026-11-13")).toBe(false);
    expect(recordedDayPassed("Not booked", "2026-11-13")).toBeUndefined();
  });
});
