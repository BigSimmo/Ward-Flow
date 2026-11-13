import { describe, expect, it } from "vitest";
import { seedWardFlowState, seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { WA_PUBLIC_HOLIDAYS } from "@/components/ward-management/wa-public-holidays";
import { cohortFitsAge } from "@/components/ward-management/ward-patients";
import { generateSeedPatient } from "@/components/ward-management/ward-patients-seed";
import { seededReferralTimelineBase } from "@/components/ward-management/ward-referral-seed-time";
import { referralState } from "@/components/ward-management/ward-referrals";
import { WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Time audit G2 to G6 (13 Nov 2026), guarded as generator rules across every scenario rather than as
 * single rows: a referral before its acceptance, a held bed pulled after the person arrived and was
 * accepted, an expected date set after arrival, open referrals' medical review targets still ahead
 * when the demo opens, and seeded people still in their age band when the board's real date moves on.
 *
 * G3 is met by the generator itself (`ward-demo-network.ts` A16-13 and `ward-seeded-pull-holds.ts`,
 * whose limit runs from the pull), not by a clamp that moves the pulled time after the seed is built.
 */
describe.each(WARD_SCENARIOS)("the %s seed keeps its times in order", (scenario) => {
  const state = seedWardFlowState(scenario);

  it("refers before it accepts (G2)", () => {
    for (const movement of state.movements) {
      if (movement.referredAt === undefined || movement.acceptedAt === undefined) continue;
      expect(movement.referredAt, movement.id).toBeLessThanOrEqual(movement.acceptedAt);
    }
  });

  it("pulls a held bed only after the movement arrived and was accepted (G3)", () => {
    for (const stay of state.admissions) {
      if (stay.state !== "pulled" || stay.pulledAt === null) continue;
      const movement = state.movements.find(
        (candidate) => candidate.id === stay.movementId || candidate.admissionId === stay.id,
      );
      if (!movement) continue;
      expect(stay.pulledAt, `${stay.id} after ${movement.id} arrived`).toBeGreaterThanOrEqual(movement.openedAt);
      if (movement.acceptedAt !== undefined)
        expect(stay.pulledAt, `${stay.id} after ${movement.id} was accepted`).toBeGreaterThanOrEqual(
          movement.acceptedAt,
        );
    }
  });

  it("sets an expected date only after the person arrived (G4)", () => {
    for (const stay of state.admissions) {
      if (stay.dischargeDateSetAt === null || stay.arrivedAt === null) continue;
      expect(stay.dischargeDateSetAt, stay.id).toBeGreaterThanOrEqual(stay.arrivedAt);
    }
  });

  it.each([0, -637, 300, 768])("keeps open referrals' medical targets ahead at offset %i (G6)", (offset) => {
    const moved = offset === 0 ? state : seedWardFlowStateAt(offset, scenario);
    const now = Date.parse(seededReferralTimelineBase()) + (NOW_ANCHOR + offset) * 60_000;
    for (const referral of moved.referrals) {
      const clearance = referral.intake?.medicalClearance;
      if (!clearance || clearance.cleared || !clearance.expectedAt || referralState(referral) !== "queued") continue;
      expect(Date.parse(clearance.expectedAt), referral.id).toBeGreaterThanOrEqual(now);
    }
  });
});

describe("seeded ages (G5)", () => {
  // The end of the last year the public holiday list covers, the furthest date the demo is kept for
  // without a dated edit (`tests/ward-public-holidays.test.ts`).
  const lastYear = Number(WA_PUBLIC_HOLIDAYS.at(-1)!.date.slice(0, 4));
  const horizon = new Date(`${lastYear}-12-31T12:00:00+08:00`);

  it("generates every cohort's people inside that cohort's band until the horizon", () => {
    for (const cohort of ["Youth", "Adult", "Older adult"] as const) {
      for (let index = 0; index < 400; index += 1) {
        const person = generateSeedPatient({ recordId: `T-${index}`, sex: "Female", cohort, index });
        expect(cohortFitsAge(cohort, person.dateOfBirth, horizon), `${cohort} ${person.dateOfBirth}`).toBe(true);
      }
    }
  });

  it.each(WARD_SCENARIOS)("keeps every %s person on a movement inside its cohort band", (scenario) => {
    const state = seedWardFlowState(scenario);
    const people = new Map(state.patients.map((patient) => [patient.id, patient]));
    for (const movement of state.movements) {
      const person = movement.patientId ? people.get(movement.patientId) : undefined;
      if (!person?.dateOfBirth || !movement.cohort) continue;
      expect(cohortFitsAge(movement.cohort, person.dateOfBirth, horizon), `${movement.id} ${person.id}`).toBe(true);
    }
  });
});
