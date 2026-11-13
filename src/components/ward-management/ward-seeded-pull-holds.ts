import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";
import type { MovementId } from "@/components/ward-management/ward-model";

/**
 * THE SAMPLE DAY'S PULLED BEDS, EACH NAMING THE ED STAY IT IS HELD FOR (Audit 16, A16-13).
 *
 * A pulled bed is a bed given to a named person who has not arrived yet. Until 13 Nov 2026 the
 * occupant builder (`ward-admissions-seed.ts`) typed a pulled bed as a person with no stay and timed
 * the pull "5 hours ago plus 30 minutes for each place down the ward's list", so nine beds were held
 * for nobody and three were pulled before the person had reached an emergency department.
 *
 * Now a seeded pulled bed exists only because an ED stay was pulled, and both records take the pull
 * from this one row: the bed's `pulledAt` (`ward-admissions-seed.ts`) and the stay's `pullExpiresAt`
 * (`ward-movements.ts`), which is the pull plus the signed hold, exactly as `PULL_PATIENT` writes it.
 * This file is a leaf so both seeds can read it: `ward-movements.ts` imports the occupant seed, so
 * the occupant seed cannot import the movements back.
 *
 * `ward-movements.ts` checks every row when it loads: the stay exists, is at the pulled stage, names
 * this bed, and reached its emergency department before the pull. A row that breaks any of these
 * stops the seed from building rather than showing a pull nobody could have made.
 *
 * Times are synthetic, written as minutes before the sample day's anchor (10:42). The signed hold is
 * read from the default configuration the sample day starts with, never restated, and nothing here
 * changes how an expired pull shows.
 */
export type SeededPullHold = {
  /** The ED stay the bed is held for. */
  readonly movementId: MovementId;
  /** The pulled bed (`Admission.id`). */
  readonly admissionId: string;
  /** When the bed was pulled, in minutes before the anchor. */
  readonly pulledMinutesBeforeAnchor: number;
};

export const SEEDED_PULL_HOLDS: readonly SeededPullHold[] = [
  { movementId: "WF-004", admissionId: "AD-BTYS-04", pulledMinutesBeforeAnchor: 250 },
  { movementId: "WF-011", admissionId: "AD-FREO-02", pulledMinutesBeforeAnchor: 220 },
  // Reached the ED at 06:32; pulled an hour later, then extended by an hour (WF-016's own record).
  { movementId: "WF-016", admissionId: "AD-SJGA-07", pulledMinutesBeforeAnchor: 190 },
  // Reached the ED at 07:52, so the pull is after it (it was typed as 07:32 before 13 Nov 2026).
  { movementId: "WF-029", admissionId: "AD-SJSA-03", pulledMinutesBeforeAnchor: 80 },
  { movementId: "WF-304", admissionId: "AD-BTYO-01", pulledMinutesBeforeAnchor: 220 },
  { movementId: "WF-311", admissionId: "AD-SJGA-02", pulledMinutesBeforeAnchor: 213 },
  // Reached the ED at 08:36, so the pull is after it (it was 07:16 before 13 Nov 2026).
  { movementId: "WF-318", admissionId: "AD-GERA-03", pulledMinutesBeforeAnchor: 60 },
  { movementId: "WF-325", admissionId: "AD-ALBA-03", pulledMinutesBeforeAnchor: 199 },
];

/** The hold for an ED stay, or `undefined` when the sample day pulled no bed for it. */
export function seededPullHoldForMovement(movementId: string): SeededPullHold | undefined {
  return SEEDED_PULL_HOLDS.find((hold) => hold.movementId === movementId);
}

/** When the hold's bed was pulled, against the given anchor. */
export function seededPulledAt(hold: SeededPullHold, anchor: number): number {
  return anchor - hold.pulledMinutesBeforeAnchor;
}

/**
 * When the hold runs out: the pull plus the signed hold, as `PULL_PATIENT` records it, plus any
 * minutes the stay's own record says the hold was extended by (`EXTEND_PULL`).
 */
export function seededPullExpiresAt(hold: SeededPullHold, anchor: number, extendedMinutes = 0): number {
  return sampleDayPullLimit(seededPulledAt(hold, anchor), extendedMinutes);
}

/**
 * The limit on a sample pulled bed: the pull plus the signed hold the sample day starts with, as
 * `PULL_PATIENT` records it, plus any extension the record carries. Every sample builder reads this
 * one rule (A16-13), so no builder types a limit of its own.
 */
export function sampleDayPullLimit(pulledAt: number, extendedMinutes = 0): number {
  return pulledAt + sampleDayPullHoldMinutes() + extendedMinutes;
}

/** The signed pull hold the sample day starts with, read from the default configuration. */
export function sampleDayPullHoldMinutes(): number {
  return defaultWardConfiguration().pullHoldMinutes;
}
