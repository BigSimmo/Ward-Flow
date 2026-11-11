import type { Admission } from "./ward-admissions";
import type { Instant } from "./ward-clock";
import type { Unit } from "./ward-model";
import { YOUTH_AGE_BAND_UNDER_YEARS } from "./ward-operational-defaults";
import { patientAgeYears, type Patient } from "./ward-patients";

/**
 * Feature item 4 (Josh, 11 Nov 2026): the notice on the patient card when a person under 18 is on
 * an adult ward. The wording is Josh's, exactly. It quotes no section number and no time limit,
 * because neither is verified.
 *
 * It shows from the date of birth and the ward type alone. It never blocks a bed offer and never
 * pre-selects anything. Once a person types when the Chief Psychiatrist was notified, it stays
 * visible but quiet. It goes at 18, or when the stay is on a youth ward.
 */
export const UNDER_18_ADULT_WARD_NOTICE =
  "Under 18 on an adult ward. Check the Mental Health Act 2014 requirements for a child on an adult ward, including notifying the Chief Psychiatrist.";

/** The one optional typed field's label (D-93: typed, never pre-filled). */
export const CHIEF_PSYCHIATRIST_NOTIFIED_LABEL = "Chief Psychiatrist notified at";

export type Under18AdultWardNotice = {
  /** Loud until a notified time is recorded, then quiet. Never gone while it applies. */
  tone: "loud" | "quiet";
  notifiedAt?: Instant;
};

/**
 * Whether the notice applies: a usable date of birth that reads under 18 on the demo day, on a
 * unit whose cohort is not Youth. Null otherwise, including when the date of birth is missing
 * (nothing is guessed). Uses the same under 18 line as `referralAgeBand` (Youth).
 */
export function under18AdultWardNotice(
  patient: Pick<Patient, "dateOfBirth"> | undefined,
  unit: Pick<Unit, "cohort"> | undefined,
  admission: Pick<Admission, "chiefPsychiatristNotice"> | undefined,
  demoDay: Date,
): Under18AdultWardNotice | null {
  if (!patient?.dateOfBirth || !/^\d{4}-\d{2}-\d{2}/.test(patient.dateOfBirth)) return null;
  if (!unit || unit.cohort === "Youth") return null;
  const age = patientAgeYears(patient, demoDay);
  if (!Number.isFinite(age) || age < 0 || age >= YOUTH_AGE_BAND_UNDER_YEARS) return null;
  const notifiedAt = admission?.chiefPsychiatristNotice?.notifiedAt;
  return notifiedAt === undefined ? { tone: "loud" } : { tone: "quiet", notifiedAt };
}
