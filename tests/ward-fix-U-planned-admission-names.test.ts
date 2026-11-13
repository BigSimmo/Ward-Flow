import { describe, expect, it } from "vitest";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardPlannedAdmissions } from "@/components/ward-management/ward-admissions-seed";

/**
 * F-148 (13 Nov 2026): a sample planned admission shows a full name beside its UMRN (D-113), never
 * "Initials RK". The cause was the seed authoring bookings by initials; every sample booking now
 * links a synthetic person on file with no live stay. Initials remain for a real booking made before
 * the person is on file, which this guard does not touch.
 */
describe("F-148: every sample planned admission names a synthetic person", () => {
  it("links each seeded booking to a person on the patient list, with no initials", () => {
    const state = seedWardFlowState();
    expect(wardPlannedAdmissions.length).toBeGreaterThan(0);
    for (const booking of state.plannedAdmissions) {
      expect(booking.initials, booking.id).toBeNull();
      const person = state.patients.find((patient) => patient.id === booking.patientId);
      expect(person, `${booking.id} names nobody on the patient list`).toBeDefined();
      expect(person!.givenName.length, booking.id).toBeGreaterThan(1);
      expect(person!.familyName.length, booking.id).toBeGreaterThan(1);
      if (booking.sex) expect(person!.sex, booking.id).toBe(booking.sex);
    }
  });

  it("books nobody who already has a live stay", () => {
    const state = seedWardFlowState();
    for (const booking of state.plannedAdmissions) {
      const live = state.admissions.filter(
        (admission) =>
          (admission as { patientId?: string | null }).patientId === booking.patientId &&
          (admission.state === "occupied" || admission.state === "pulled"),
      );
      expect(live, booking.id).toEqual([]);
    }
  });
});
