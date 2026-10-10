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
import { UNDO_WINDOW_MINUTES } from "./ward-operational-defaults";

export { UNDO_WINDOW_MINUTES };

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

/**
 * **v10 pass 3 (Josh, 10 Oct 2026): the undoable steps.** Each undo event takes back the newest of
 * its listed actions on one subject (a movement, a referral, a stay, or the whole network for a
 * handover sign-off). The record is a generic before/after of exactly the records the step changed,
 * so the undo restores them exactly and refuses when any of them has changed since.
 */
export const UNDO_STEP_ACTIONS = {
  UNDO_REFER_TO_UNITS: ["REFER_TO_UNITS"],
  UNDO_ACCEPT_IN_PRINCIPLE: ["ACCEPT_IN_PRINCIPLE"],
  UNDO_LEGAL_FORM_RECORD: ["RECORD_LEGAL_FORM_WRITTEN", "RECORD_LEGAL_FORM_RECEIVED"],
  UNDO_SUPPORT_NOTIFICATION: ["RECORD_SUPPORT_NOTIFICATION"],
  UNDO_REPATRIATION: ["RECORD_REPATRIATION"],
  UNDO_HANDOVER_SIGN_OFF: ["RECORD_HANDOVER_SIGN_OFF"],
  UNDO_ED_STEP: [
    "RECORD_ARRIVED_IN_DEPARTMENT",
    "RECORD_EXAMINATION",
    "RECORD_MEDICAL_CLEARANCE",
    "RECORD_TRANSPORT_NEED",
    "HANDOVER_READY",
  ],
  UNDO_TRANSPORT_STEP: ["TRANSPORT_ACCEPTED", "TRANSPORT_EN_ROUTE", "PATIENT_COLLECTED", "PATIENT_ARRIVED"],
} as const;
export type UndoStepType = keyof typeof UNDO_STEP_ACTIONS;
export type UndoableStepAction = (typeof UNDO_STEP_ACTIONS)[UndoStepType][number];
export const UNDO_STEP_TYPES = Object.keys(UNDO_STEP_ACTIONS) as UndoStepType[];

/** The undo event that takes back `action`, or undefined when the action has no undo. */
export function undoStepTypeFor(action: string): UndoStepType | undefined {
  return UNDO_STEP_TYPES.find((type) => (UNDO_STEP_ACTIONS[type] as readonly string[]).includes(action));
}

/** One subject id from an event's own fields: movement, then referral, then stay; else the network. */
export function undoStepSubjectId(event: object): string {
  const fields = event as { movementId?: unknown; referralId?: unknown; admissionId?: unknown };
  for (const value of [fields.movementId, fields.referralId, fields.admissionId])
    if (typeof value === "string" && value.length > 0) return value;
  return "network";
}

/** One changed record: by id inside a list of records, rows appended to a plain list, or a whole value. */
export type StepChange =
  | { slice: string; mode: "id"; id: string; index: number; before: unknown; after: unknown }
  | { slice: string; mode: "append"; start: number; rows: unknown[] }
  | { slice: string; mode: "whole"; before: unknown; after: unknown };

export type StepUndo = {
  kind: "step";
  undoType: UndoStepType;
  action: UndoableStepAction;
  subjectId: string;
  at: Instant;
  role: WardFlowRole;
  /** The ward that acted, for a ward step that names its unit; `null` otherwise. */
  unitId: string | null;
  changes: StepChange[];
};

export type UndoRecord = ReferralDecisionUndo | BedPlacementUndo | StepUndo;

function subjectOf(record: UndoRecord): string {
  if (record.kind === "step") return `step:${record.undoType}:${record.subjectId}`;
  return record.kind === "referral-decision" ? `referral:${record.referralId}` : `admission:${record.admissionId}`;
}

export function stepUndoFor(
  records: readonly UndoRecord[] | undefined,
  undoType: UndoStepType,
  subjectId: string,
): StepUndo | undefined {
  return (records ?? []).find(
    (record): record is StepUndo =>
      record.kind === "step" && record.undoType === undoType && record.subjectId === subjectId,
  );
}

/**
 * State keys a step undo never snapshots: the audit trail, refusals, counters, the clock, the
 * configuration and the undo records themselves. Ids are never reused, so counters stay where
 * they are; `dischargeRevisions` only moves forward (a removed stay's entry is dropped on undo).
 */
const STEP_UNDO_IGNORED_KEYS: ReadonlySet<string> = new Set([
  "worldGeneration",
  "auditEvents",
  "auditReviews",
  "auditSequence",
  "auditReviewSequence",
  "auditCaptureStartedAt",
  "rejections",
  "clockOffsetMinutes",
  "scenario",
  "configuration",
  "dischargeRevisions",
  "undoRecords",
]);

const isRow = (value: unknown): value is { id: string } =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as { id?: unknown }).id === "string";

/** What `next` changed against `before`, record by record. Empty when nothing changed. */
export function diffForStepUndo(before: object, next: object): StepChange[] {
  const changes: StepChange[] = [];
  const was = before as Record<string, unknown>;
  const now = next as Record<string, unknown>;
  for (const slice of Object.keys(now)) {
    if (STEP_UNDO_IGNORED_KEYS.has(slice)) continue;
    const a = was[slice];
    const b = now[slice];
    if (a === b || typeof b === "number") continue;
    if (Array.isArray(b) && (a === undefined || Array.isArray(a))) {
      const old = (a ?? []) as unknown[];
      if ([...old, ...b].every(isRow)) {
        const oldRows = old as { id: string }[];
        const newRows = b as { id: string }[];
        const oldById = new Map(oldRows.map((row) => [row.id, row]));
        const newById = new Map(newRows.map((row) => [row.id, row]));
        oldRows.forEach((row, index) => {
          const after = newById.get(row.id);
          if (after === row || (after !== undefined && sameRecord(after, row))) return;
          changes.push({ slice, mode: "id", id: row.id, index, before: row, after: after ?? null });
        });
        newRows.forEach((row, index) => {
          if (!oldById.has(row.id)) changes.push({ slice, mode: "id", id: row.id, index, before: null, after: row });
        });
        continue;
      }
      if (old.length <= b.length && old.every((row, index) => row === b[index] || sameRecord(row, b[index]))) {
        if (b.length > old.length)
          changes.push({ slice, mode: "append", start: old.length, rows: b.slice(old.length) });
        continue;
      }
    }
    if (!sameRecord(a ?? null, b ?? null)) changes.push({ slice, mode: "whole", before: a ?? null, after: b ?? null });
  }
  return changes;
}

/** Rule 2 for a step: whether any record it changed reads differently now. */
export function stepChangedSince(state: object, record: StepUndo): boolean {
  const current = state as Record<string, unknown>;
  return record.changes.some((change) => {
    const value = current[change.slice];
    if (change.mode === "whole") return !sameRecord(value ?? null, change.after);
    const list = Array.isArray(value) ? (value as unknown[]) : [];
    if (change.mode === "append") {
      const rows = list.slice(change.start, change.start + change.rows.length);
      return rows.length !== change.rows.length || !sameRecord(rows, change.rows);
    }
    // A notice the step raised may since have been read; the undo withdraws it all the same.
    if (change.slice === "notices" && change.before === null) return false;
    const row = list.find((candidate) => isRow(candidate) && candidate.id === change.id);
    return change.after === null ? row !== undefined : row === undefined || !sameRecord(row, change.after);
  });
}

/**
 * The state with the step taken back: each changed record returned to what it was, a created one
 * removed, a removed one put back where it stood, appended rows taken off. One deliberate
 * exception to "exactly": a unit's allocatable revision moves one past the current, never back, so
 * a screen still holding the step's revision is refused rather than mistaken for current.
 */
export function applyStepUndo<S extends object>(state: S, record: StepUndo): S {
  const next = { ...(state as Record<string, unknown>) };
  for (const change of [...record.changes].reverse()) {
    const value = next[change.slice];
    if (change.mode === "whole") {
      if (change.before === null) delete next[change.slice];
      else next[change.slice] = structuredClone(change.before);
      continue;
    }
    const list = Array.isArray(value) ? [...(value as unknown[])] : [];
    if (change.mode === "append") {
      list.splice(change.start, change.rows.length);
      next[change.slice] = list;
      continue;
    }
    const at = list.findIndex((candidate) => isRow(candidate) && candidate.id === change.id);
    if (change.before === null) {
      if (at >= 0) list.splice(at, 1);
    } else {
      let restored = structuredClone(change.before) as Record<string, unknown>;
      if (change.slice === "units" && at >= 0) restored = withRevisionPast(restored, list[at]);
      if (at >= 0) list[at] = restored;
      else list.splice(Math.min(change.index, list.length), 0, restored);
    }
    next[change.slice] = list;
  }
  const revisions = next.dischargeRevisions as Record<string, number> | undefined;
  const admissions = next.admissions as { id: string }[] | undefined;
  if (revisions && admissions) {
    const live = new Set(admissions.map((admission) => admission.id));
    next.dischargeRevisions = Object.fromEntries(Object.entries(revisions).filter(([id]) => live.has(id)));
  }
  return next as S;
}

function withRevisionPast(restored: Record<string, unknown>, current: unknown): Record<string, unknown> {
  const allocatable = restored.allocatable as Record<string, unknown> | undefined;
  if (!allocatable) return restored;
  const revision = (current as { allocatable?: { revision?: number } }).allocatable?.revision ?? 0;
  return { ...restored, allocatable: { ...allocatable, revision: revision + 1 } };
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

/** JSON reads a non-finite number and an `undefined` array item as `null`. */
function jsonScalar(value: unknown): unknown {
  if (value === undefined) return null;
  return typeof value === "number" && !Number.isFinite(value) ? null : value;
}

/**
 * Rule 2: whether a record still reads exactly as the decision left it (survives a save and
 * restore). Key-order independent, with `undefined` members dropped as JSON drops them. Walks the two values directly and stops at
 * the first difference or shared reference, so diffing a step stays cheap on a full state.
 */
export function sameRecord(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => sameRecord(jsonScalar(item), jsonScalar(b[index])));
  }
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    const left = Object.entries(a as Record<string, unknown>).filter(([, item]) => item !== undefined);
    const right = b as Record<string, unknown>;
    if (left.length !== Object.values(right).filter((item) => item !== undefined).length) return false;
    return left.every(([key, item]) => Object.hasOwn(right, key) && sameRecord(item, right[key]));
  }
  const isObject = (value: unknown) => value !== null && typeof value === "object";
  if (isObject(a) || isObject(b) || a === undefined || b === undefined) return false;
  return JSON.stringify(jsonScalar(a)) === JSON.stringify(jsonScalar(b));
}
