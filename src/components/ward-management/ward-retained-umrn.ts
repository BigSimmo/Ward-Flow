import { TYPED_TEXT_NOT_KEPT } from "./ward-flow-demo-storage-constants";
import { sameRecordNumber } from "./ward-patients";

type PatientRecordNumber = { id: string; umrn: string };

/** Device privacy placeholders and missing numbers carry no retained identity claim. */
function retainedUmrnKey(umrn: string): string | undefined {
  const key = umrn.trim().toLowerCase();
  return key === "" || key === TYPED_TEXT_NOT_KEPT.toLowerCase() || key === "umrn not recorded" ? undefined : key;
}

/** Current owners only: archived records are absent from the patient collection. */
export function hasDuplicateRetainedUmrns(patients: readonly PatientRecordNumber[]): boolean {
  const owners = new Set<string>();
  for (const patient of patients) {
    const key = retainedUmrnKey(patient.umrn);
    if (key === undefined) continue;
    if (owners.has(key)) return true;
    owners.add(key);
  }
  return false;
}

/** Recheck the complete proposed world when an inverse restores a patient's identity claim. */
export function patientHasRetainedUmrnConflict(
  patient: PatientRecordNumber,
  patients: readonly PatientRecordNumber[],
): boolean {
  return (
    retainedUmrnKey(patient.umrn) !== undefined &&
    patients.some((other) => other.id !== patient.id && sameRecordNumber(other.umrn, patient.umrn))
  );
}
