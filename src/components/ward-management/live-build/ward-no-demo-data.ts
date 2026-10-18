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
import type * as AdmissionsSeed from "@/components/ward-management/ward-admissions-seed";
import type * as DemoPlannedMoves from "@/components/ward-management/ward-demo-planned-moves";
import type * as Movements from "@/components/ward-management/ward-movements";
import type * as PatientsSeed from "@/components/ward-management/ward-patients-seed";
import type * as RulingsDemo from "@/components/ward-management/ward-rulings-demo";

export const wardMovements: typeof Movements.wardMovements = [];
export const generatedMovementPatients: typeof Movements.generatedMovementPatients = [];
export const bedReleases: typeof Movements.bedReleases = [];
export const leaveBeds: typeof Movements.leaveBeds = [];
export const referrals: typeof Movements.referrals = [];

export const WARD_ADMISSIONS_ANCHOR: typeof AdmissionsSeed.WARD_ADMISSIONS_ANCHOR = 10 * 60 + 42;
export const wardAdmissions: typeof AdmissionsSeed.wardAdmissions = [];
export const wardPlannedAdmissions: typeof AdmissionsSeed.wardPlannedAdmissions = [];
export const generatedOccupantPatients: typeof AdmissionsSeed.generatedOccupantPatients = [];

export const combineWardPatients: typeof PatientsSeed.combineWardPatients = (...groups) => groups.flat();

export const applyRulingsDemoOverlay: typeof RulingsDemo.applyRulingsDemoOverlay = (seed) => seed;

export const withDemoPlannedMoveTimes: typeof DemoPlannedMoves.withDemoPlannedMoveTimes = (movements) => [...movements];
