import type { Movement } from "./ward-model";
import { sameRecord, type StepUndo } from "./ward-undo";

/**
 * Screen audit 19 Nov 2026 (item 4): an Undo toast for one step of a journey stayed on screen after
 * the journey recorded its next step, or closed. The engine then refuses that Undo (only the newest
 * step can be taken back), so the offer was already dead. This file keeps, for each waiting Undo
 * toast that names a journey, what the journey looked like straight after the toast's own step.
 * `WardUndoWorldClear` closes the toast, as its X would, once the journey reads differently.
 *
 * It only reads the record. What may be undone, and when, stays the engine's rule.
 */
type Waiting =
  | { kind: "step"; movementId: string; before: unknown; after: unknown }
  | { kind: "pull"; movementId: string; unitId: string; stageIndex: number };

const waiting = new Map<string, Waiting>();

type UndoEventFields = {
  type?: unknown;
  movementId?: unknown;
  expectedPull?: { unitId?: unknown; stageIndex?: unknown };
};

/**
 * Notes the journey a just-raised Undo toast is for. `offered` is the toast's undo event; `record`
 * is the engine's own record of the step, when the step keeps one. An Undo that names no journey,
 * or whose step left the journey's own record untouched, is not noted and stays as it was.
 */
export function noteJourneyUndoToast(toastId: string | undefined, offered: object, record?: StepUndo): void {
  if (toastId === undefined) return;
  const fields = offered as UndoEventFields;
  const movementId = fields.movementId;
  if (typeof movementId !== "string" || movementId.length === 0) return;
  const pull = fields.type === "RELEASE_PULL" ? fields.expectedPull : undefined;
  if (pull && typeof pull.unitId === "string" && typeof pull.stageIndex === "number" && pull.stageIndex >= 0) {
    waiting.set(toastId, { kind: "pull", movementId, unitId: pull.unitId, stageIndex: pull.stageIndex });
    return;
  }
  const change = record?.changes.find(
    (row) => row.slice === "movements" && row.mode === "id" && row.id === movementId && row.after !== null,
  );
  if (change && change.mode === "id")
    waiting.set(toastId, { kind: "step", movementId, before: change.before, after: change.after });
}

/** Whether the journey has moved past the step this toast would take back. */
function movedOn(entry: Waiting, movement: Movement): boolean {
  if (entry.kind === "step")
    // Still as the step left it, or the step's own save has not reached this screen yet.
    return !sameRecord(movement, entry.after) && !sameRecord(movement, entry.before);
  if (movement.closure) return true;
  // The pull's own save has not reached this screen yet.
  if (movement.stageChanges.length <= entry.stageIndex) return false;
  const stillThatPull =
    movement.stage === "pulled" &&
    movement.acceptedUnitId === entry.unitId &&
    movement.stageChanges.length === entry.stageIndex + 1;
  // Booked transport is the journey's next step: the engine asks for it to be cancelled first.
  const transportBooked = movement.transport !== undefined && movement.transport.cancelledAt === undefined;
  return !stillThatPull || transportBooked;
}

/**
 * The noted toasts whose journey has since moved on, each named once: they are forgotten here as
 * they are returned. `isShown` drops the notes of toasts that have already gone.
 */
export function journeyUndoToastsMovedOn(
  movements: readonly Movement[],
  isShown?: (toastId: string) => boolean,
): string[] {
  const stale: string[] = [];
  for (const [toastId, entry] of waiting) {
    if (isShown && !isShown(toastId)) {
      waiting.delete(toastId);
      continue;
    }
    const movement = movements.find((candidate) => candidate.id === entry.movementId);
    if (!movement || !movedOn(entry, movement)) continue;
    waiting.delete(toastId);
    stale.push(toastId);
  }
  return stale;
}

/** Forgets every noted toast (a demo reset closes them all itself; also for tests). */
export function forgetJourneyUndoToasts(): void {
  waiting.clear();
}

const ARRIVED = /closed movement \(Patient arrived\b/u;

/**
 * An Undo the engine refused, in plain words for the toast (item 4b). Only the refusals a late Undo
 * can meet are listed; any other reason returns undefined and keeps the words it had. The refusal
 * itself is the engine's and is unchanged.
 */
export function plainUndoRefusal(reason: string): string | undefined {
  if (ARRIVED.test(reason)) return "Can't undo: this person has already arrived.";
  if (/for a closed movement/u.test(reason)) return "Can't undo: this journey has already closed.";
  if (/has already been collected/u.test(reason)) return "Can't undo: this person has already been collected.";
  if (/has a transport job booked/u.test(reason)) return "Can't undo: transport is booked. Cancel the transport first.";
  if (/has since been released or replaced/u.test(reason))
    return "Can't undo: this bed pull has since been released or replaced.";
  if (/cannot release a pull at the movement's current stage/u.test(reason))
    return "Can't undo: this journey has moved on to its next step.";
  if (/^This has changed since, so it cannot be undone/u.test(reason))
    return "Can't undo: this has changed since. Check the record.";
  if (/^Undo is only possible within/u.test(reason)) return "Can't undo: the time to undo has passed.";
  return undefined;
}
