import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { Referral } from "@/components/ward-management/ward-model";

/**
 * **UNDO — v10 pass 2 (Josh, 10 Oct 2026).** The v10 build guide offers "Toast with Undo" after a
 * referral decision, a governance review and a Bed board placement. This module holds what the
 * reducer needs to reverse the first and the last EXACTLY: a before/after snapshot of what the
 * decision changed, who made it and when. (A review needs no record: it is one appended row, and
 * its own `at` and `byRole` already say when and by whom.)
 *
 * The rules every undo shares:
 *   1. Only within `UNDO_WINDOW_MINUTES` of the decision. The toast offers a few seconds; the engine
 *      allows a little more on the demonstration clock, and never an open-ended rewrite of history.
 *   2. Only while nothing has changed the subject since (the subject still equals `after`), so an
 *      undo never overwrites a later decision by somebody else.
 *   3. By the role that made the decision (a ward by its own unit), or the coordinator for anyone.
 *      Any other caller is refused with a reason, never silently.
 */
export const UNDO_WINDOW_MINUTES = 5;

/** The most undo records kept; the oldest go first. One per subject, so this is plenty. */
export const UNDO_RECORD_LIMIT = 50;

export type ReferralDecisionUndo = {
  kind: "referral-decision";
  action: "ACCEPT_REFERRAL" | "DECLINE_REFERRAL";
  referralId: string;
  at: Instant;
  role: WardFlowRole;
  /** The ward that answered, for a ward answer; `null` for the other destination kinds. */
  unitId: string | null;
  before: Referral;
  after: Referral;
  /** The notices the decision raised, withdrawn again by the undo. */
  noticeIds: string[];
};

export type BedPlacementUndo = {
  kind: "bed-placement";
  admissionId: string;
  unitId: string;
  at: Instant;
  role: WardFlowRole;
  /** The bed number before the placement; `null` when none was recorded. */
  beforeBed: number | null;
  afterBed: number;
};

export type UndoRecord = ReferralDecisionUndo | BedPlacementUndo;

function subjectOf(record: UndoRecord): string {
  return record.kind === "referral-decision" ? `referral:${record.referralId}` : `admission:${record.admissionId}`;
}

/** Adds `record`, replacing any earlier record for the same subject: only the newest is undoable. */
export function withUndoRecord(records: readonly UndoRecord[] | undefined, record: UndoRecord): UndoRecord[] {
  const subject = subjectOf(record);
  return [...(records ?? []).filter((existing) => subjectOf(existing) !== subject), record].slice(-UNDO_RECORD_LIMIT);
}

/** `records` without `record`. */
export function withoutUndoRecord(records: readonly UndoRecord[] | undefined, record: UndoRecord): UndoRecord[] {
  return (records ?? []).filter((existing) => existing !== record);
}

export function referralDecisionUndoFor(
  records: readonly UndoRecord[] | undefined,
  referralId: string,
): ReferralDecisionUndo | undefined {
  return (records ?? []).find(
    (record): record is ReferralDecisionUndo => record.kind === "referral-decision" && record.referralId === referralId,
  );
}

export function bedPlacementUndoFor(
  records: readonly UndoRecord[] | undefined,
  admissionId: string,
): BedPlacementUndo | undefined {
  return (records ?? []).find(
    (record): record is BedPlacementUndo => record.kind === "bed-placement" && record.admissionId === admissionId,
  );
}

/** Rule 1. `now` before the decision is refused too: the clock never runs backwards. */
export function undoWindowRefusal(at: Instant, now: Instant): string | null {
  if (!Number.isFinite(now) || now < at) return "Undo is only possible after the decision it reverses";
  return now - at > UNDO_WINDOW_MINUTES
    ? `Undo is only possible within ${UNDO_WINDOW_MINUTES} minutes of the decision`
    : null;
}

/** Rule 3. The coordinator may always; otherwise the same role, and a ward only for its own unit. */
export function undoRoleRefusal(
  record: { role: WardFlowRole; unitId: string | null },
  role: WardFlowRole,
  actingUnitId: string | undefined,
): string | null {
  if (role === "coordinator") return null;
  if (role !== record.role) return "Only the role that made this decision, or the coordinator, can undo it";
  if (role === "ward" && record.unitId !== null && actingUnitId !== record.unitId)
    return "Only the ward that made this decision, or the coordinator, can undo it";
  return null;
}

/** Key-order-independent JSON, with `undefined` members dropped as JSON drops them. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item === undefined ? null : item)).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Rule 2: whether a record still reads exactly as the decision left it (survives a save and restore). */
export function sameRecord(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}
