import type { Patient } from "@/components/ward-management/ward-patients";

/**
 * The language when the record says an interpreter is required ("Italian — interpreter required").
 * The same reading as `interpreterRequired` in `patient-flight-header.tsx`, kept in a module with no
 * styles so the ED board and a ward's bed request can show it without loading the patient page's
 * stylesheet. `tests/ward-card-safety-tags.test.ts` keeps the two readings the same.
 */
export function interpreterLanguageRequired(
  patient: Pick<Patient, "interpreterLanguage"> | undefined,
): string | undefined {
  const value = patient?.interpreterLanguage?.trim();
  if (!value || /no interpreter/i.test(value) || !/interpreter required/i.test(value)) return undefined;
  return value.split(/\s+[—-]\s+/)[0]?.trim() || undefined;
}
