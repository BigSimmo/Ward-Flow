import type { Patient } from "./ward-patients";

/**
 * Feature item 15 (D-134, 10 Nov 2026): when the arrival checklist offers "Interpreter booked" and
 * "Aboriginal liaison offered". Each reads only what the patient record holds; nothing is guessed
 * from a name, a language or anything else. Read by the checklist and by `RECORD_ARRIVAL_CHECK`,
 * which refuses a tick for a line that does not apply.
 *
 * PROVISIONAL: the conditions and the line wording wait on the Aboriginal cultural safety review
 * (audit M122, D-123 item 6). Change them only with that review.
 */

/** The language when the record says an interpreter is required ("Italian — interpreter required"). */
export function recordedInterpreterLanguage(patient: Pick<Patient, "interpreterLanguage"> | undefined) {
  const value = patient?.interpreterLanguage?.trim();
  if (!value || /no interpreter/i.test(value) || !/interpreter required/i.test(value)) return undefined;
  return value.split(/\s+[—-]\s+/)[0]?.trim() || value;
}

/**
 * The identity as recorded when it is Aboriginal, Torres Strait Islander or both (D-123 item 2:
 * "Aboriginal", "Torres Strait Islander" or "Aboriginal and Torres Strait Islander"). Undefined for
 * "Neither", "Not stated" or no answer.
 */
export function recordedAboriginalIdentity(
  patient: Pick<Patient, "aboriginalOrTorresStraitIslanderStatus"> | undefined,
): "Aboriginal" | "Torres Strait Islander" | "Aboriginal and Torres Strait Islander" | undefined {
  const value = patient?.aboriginalOrTorresStraitIslanderStatus?.trim() ?? "";
  if (/^aboriginal and torres strait islander\b/i.test(value)) return "Aboriginal and Torres Strait Islander";
  if (/^aboriginal\b/i.test(value)) return "Aboriginal";
  if (/^torres strait islander\b/i.test(value)) return "Torres Strait Islander";
  return undefined;
}
