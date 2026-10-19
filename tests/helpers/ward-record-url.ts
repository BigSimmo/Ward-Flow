import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";

/**
 * D-39 (15 October 2026): browser specs open a record the way a link does, by its address code,
 * never by the raw record number. One spec step still opens an old raw-id link on purpose, to prove
 * it is sent on to the coded address.
 */
export function movementPath(movementId: string): string {
  return `/ward-flow/movements/${encodeRecordAddress(movementId)}`;
}

export function personPath(patientId: string): string {
  return `/ward-flow/people/${encodeRecordAddress(patientId)}`;
}
