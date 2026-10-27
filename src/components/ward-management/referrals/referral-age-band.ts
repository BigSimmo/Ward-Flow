import type { Cohort } from "../ward-model";
import { patientAgeYears } from "../ward-patients";

/** The soft note for an adult under 25. It never changes the band and never blocks. */
export const YOUTH_UP_TO_24_NOTE = "Youth service may accept up to 24";

/**
 * Finding 36 (Josh, 27 Oct 2026): the referral's age band, prefilled from the date of birth the
 * record holds, read against the demo day. Under 18 is Youth, 18 to 64 is Adult, 65 and over is
 * Older adult. From 18 to 24 the note says a youth service may still accept them. The prefill stays
 * editable and age never blocks. Null when the record holds no usable date of birth, so the band
 * then opens blank.
 *
 * Not `patientCohort` (`ward-patients.ts`), which counts under 25 as Youth for planned admissions.
 */
export function referralAgeBand(
  dateOfBirth: string | undefined,
  demoDay: Date,
): { band: Cohort; note?: typeof YOUTH_UP_TO_24_NOTE } | null {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}/.test(dateOfBirth)) return null;
  const age = patientAgeYears({ dateOfBirth }, demoDay);
  if (!Number.isFinite(age) || age < 0) return null;
  if (age < 18) return { band: "Youth" };
  if (age >= 65) return { band: "Older adult" };
  return age <= 24 ? { band: "Adult", note: YOUTH_UP_TO_24_NOTE } : { band: "Adult" };
}
