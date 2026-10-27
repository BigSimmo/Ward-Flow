/**
 * P058: after a "changed first" refusal (HTTP 409) only the queued actions on the same record are
 * cancelled; queued actions on other records still go through. The message names the record type
 * and the desk only, never a patient identifier (Josh, Oct 27 2026).
 */
import type { WardFlowEvent } from "./ward-flow-events";

export const CONFLICT_RECORD_TYPES = ["bed", "stay", "movement", "referral", "alert", "discharge"] as const;
export type ConflictRecordType = (typeof CONFLICT_RECORD_TYPES)[number] | "record";

/** The record an action changes, most specific id first. `null` when it names none. */
const RECORD_FIELDS = [
  "movementId",
  "referralId",
  "alertId",
  "plannedAdmissionId",
  "admissionId",
  "releaseId",
  "leaveBedId",
  "patientId",
  "noticeId",
  "reviewId",
  "unitId",
] as const;

export function conflictRecordKey(event: WardFlowEvent): string | null {
  const fields = event as unknown as Record<string, unknown>;
  for (const field of RECORD_FIELDS) {
    const value = fields[field];
    if (typeof value === "string" && value) return `${field}:${value}`;
  }
  return null;
}

/** A queued action is on the conflicting record when it names the same one, or either names none. */
export function sameConflictRecord(conflicting: WardFlowEvent, queued: WardFlowEvent): boolean {
  const a = conflictRecordKey(conflicting);
  const b = conflictRecordKey(queued);
  return a === null || b === null || a === b;
}

/** The record type the server named, or "record". */
export function conflictRecordType(value: unknown): ConflictRecordType {
  const type = (value as { recordType?: unknown } | null)?.recordType;
  return (CONFLICT_RECORD_TYPES as readonly unknown[]).includes(type) ? (type as ConflictRecordType) : "record";
}

/** The other desk's role label, or "Another desk". Only a short label of words is kept. */
export function conflictDesk(value: unknown): string {
  const desk = (value as { desk?: unknown } | null)?.desk;
  return typeof desk === "string" && /^[A-Za-z][A-Za-z ]{0,39}$/u.test(desk.trim()) ? desk.trim() : "Another desk";
}

/** The server named the record type of a "changed first" refusal (P058 servers only). */
export const namedConflict = (value: unknown): boolean =>
  (value as { code?: unknown } | null)?.code === "stale" &&
  typeof (value as { recordType?: unknown } | null)?.recordType === "string";

/** The board's message for the refused action. */
export const changedFirstText = (value: unknown): string =>
  `${conflictDesk(value)} changed this ${conflictRecordType(value)} while you were looking. Your action was not applied. Check the latest details, then try again.`;

/** The settle message for queued actions on the same record that were not sent. */
export const queuedNotSentText = (count: number, value: unknown): string =>
  `${count} queued action${count === 1 ? "" : "s"} on this ${conflictRecordType(value)} ${count === 1 ? "was" : "were"} not sent. Check the board, then try again.`;
