import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";

/**
 * The triage form for one person (built 7 Nov 2026). The address carries the record code, never the
 * id or a UMRN (D-39). Its own small file so the patient record and the bar link here without the form.
 */
export function triageHrefFor(patientId: string): string {
  return `/ward-flow/people/${encodeRecordAddress(patientId)}/triage`;
}
