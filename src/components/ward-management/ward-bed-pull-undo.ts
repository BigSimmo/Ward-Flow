import type { Instant } from "./ward-clock";
import type { WardFlowEvent, WardFlowRole } from "./ward-flow-events";
import type { Movement } from "./ward-model";

/**
 * A9-02 (Audit 9, Josh 13 Nov 2026): one Undo for a bed pull, whichever page pulled it (the patient
 * page, Home's Act now, the ward's bed board). Undo releases only the pull it was offered for
 * (Audit 24-7, CT-06): the engine refuses it once that pull has been released or replaced.
 */
export type BedPullUndoTarget = {
  movementId: string;
  /** The ward the bed was pulled at. */
  unitId: string;
  /** The index of the pull's own `to: "pulled"` entry in the movement's `stageChanges`. */
  stageIndex: number;
  /** A ward caller states the ward it acts as; absent for the coordinator. */
  actingUnitId?: string;
};

/** What the toast says once a bed pull's Undo is accepted. */
export const BED_PULL_UNDONE = "Bed pull undone.";

type ReleasePullEvent = Extract<WardFlowEvent, { type: "RELEASE_PULL" }>;

/**
 * What the Undo of a bed pull records besides its type, desk and time, so a screen can dispatch it
 * with a literal `type: "RELEASE_PULL"` the override-surface guard reads.
 */
export function bedPullUndoFields(target: BedPullUndoTarget): Omit<ReleasePullEvent, "type" | "role" | "now"> {
  return {
    movementId: target.movementId,
    reason: "pull_made_in_error",
    ...(target.actingUnitId === undefined ? {} : { actingUnitId: target.actingUnitId }),
    expectedPull: { unitId: target.unitId, stageIndex: target.stageIndex },
  };
}

/** The Undo of a bed pull: released as made in error, guarded to that one pull. */
export function bedPullUndoEvent(role: WardFlowRole, at: Instant, target: BedPullUndoTarget): WardFlowEvent {
  return { type: "RELEASE_PULL", role, now: at, ...bedPullUndoFields(target) };
}

/**
 * The pull a one-tap Pull the bed made (WT-08: the journey starts and its bed is pulled in one
 * event): the referral's movement that did not exist before, and its first pull. Undefined until
 * that movement is on the board.
 */
export function startedJourneyPull(
  movements: readonly Movement[],
  referralId: string,
  before: ReadonlySet<string>,
  unitId: string,
): BedPullUndoTarget | undefined {
  const journey = movements.find((movement) => movement.referralId === referralId && !before.has(movement.id));
  const stageIndex = journey?.stageChanges.findIndex((change) => change.to === "pulled") ?? -1;
  return journey && stageIndex >= 0 ? { movementId: journey.id, unitId, stageIndex } : undefined;
}

/**
 * The pull a Pull the bed on a movement already on the board will make: the movement's next stage
 * change. Undefined when the movement is not on the board.
 */
export function nextPullTarget(
  movements: readonly Movement[],
  movementId: string,
  unitId: string,
  actingUnitId?: string,
): BedPullUndoTarget | undefined {
  const movement = movements.find((candidate) => candidate.id === movementId);
  if (!movement) return undefined;
  const target = { movementId, unitId, stageIndex: movement.stageChanges.length };
  return actingUnitId === undefined ? target : { ...target, actingUnitId };
}
