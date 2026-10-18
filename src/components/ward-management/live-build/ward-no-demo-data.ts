/**
 * Stands in for the demo data modules in a live shared build (`NEXT_PUBLIC_WARD_SHARED_ENABLED=true`).
 * There the server owns every record, so phones never download the synthetic night's movements,
 * patients, admissions and overlays (review item 3.5). `next.config.ts` swaps these modules in
 * for the five named below; demo builds, tests and the backend keep the real ones.
 *
 * - `ward-movements`, `ward-patients-seed`, `ward-admissions-seed`, `ward-rulings-demo`,
 *   `ward-demo-planned-moves`.
 *
 * The local world a live page holds before the server's board arrives is then empty, and the
 * sign-in gate hides it. `tests/ward-no-demo-data.test.ts` checks every name the app imports from
 * those modules is here, with the same types.
 */
import type { Admission, PlannedAdmission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease, LeaveBed, Movement, Referral } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";

// Typed from the record types, not the demo modules, so nothing here reads a fixture
// (`tests/ward-flow-single-source.test.ts`).
export const wardMovements: Movement[] = [];
export const generatedMovementPatients: Patient[] = [];
export const bedReleases: BedRelease[] = [];
export const leaveBeds: LeaveBed[] = [];
export const referrals: Referral[] = [];

export const WARD_ADMISSIONS_ANCHOR: Instant = 10 * 60 + 42;
export const wardAdmissions: Admission[] = [];
export const wardPlannedAdmissions: PlannedAdmission[] = [];
export const generatedOccupantPatients: Patient[] = [];

export function combineWardPatients(...generatedGroups: readonly (readonly Patient[])[]): Patient[] {
  return generatedGroups.flat();
}

export function applyRulingsDemoOverlay<
  T extends {
    movements: Movement[];
    referrals: Referral[];
    admissions: Admission[];
    patients: Patient[];
    leaveBeds: LeaveBed[];
  },
>(state: T, now: Instant): T {
  void now;
  return state;
}

export function withDemoPlannedMoveTimes(movements: readonly Movement[], anchor: Instant): Movement[] {
  void anchor;
  return [...movements];
}
