/**
 * The three read-only report routes, written out in full. The repository's route scan reads source
 * text, so a path composed at runtime would leave a working route looking unlinked (see
 * `statistics-sections.ts`).
 */
export const PATIENT_CHRONOLOGY_HREF = "/mockups/ward-flow/reports/chronology";
export const DOWNTIME_PACK_HREF = "/mockups/ward-flow/reports/downtime";
export const WEEKLY_REPORT_HREF = "/mockups/ward-flow/statistics/weekly";

/** One person's chronology. The query carries the synthetic patient id only, never a name. */
export function patientChronologyHref(patientId: string): string {
  return `${PATIENT_CHRONOLOGY_HREF}?patient=${encodeURIComponent(patientId)}`;
}
