import type { Admission } from "./ward-admissions";
import type { Movement } from "./ward-model";
import { STAGE_TRANSITION_BLOCKERS } from "./ward-flow-reducer";
import { movementPatientIdentityMatchesRecord } from "./ward-patient-resolver";

/**
 * Whether a movement holds a reserved bed by the reducer's own stage rule
 * (`movementHoldsBedByStage`, `ward-flow-reducer.ts`): a pulled, ready-to-hand-over or moving
 * stage, or a linked admission. A seeded journey authored as far as `pulled` carries no
 * `admissionId`, so the stage has to answer for it (review finding S2-1).
 */
export function movementHoldsBedByStage(movement: Movement): boolean {
  return (
    movement.stage === "pulled" ||
    movement.stage === "handover_ready" ||
    movement.stage === "moving" ||
    movement.admissionId !== undefined
  );
}

/**
 * A journey `STOP_TRANSPORT` closed while its bed stays held until `RELEASE_HELD_BED` (owner answer
 * 8, 2026-09-17). Mirrors that event's own "held bed outstanding" test, so a screen shows the held
 * bed exactly while the reducer would still accept its release (review finding A3-10).
 */
export function stoppedTransportBedOutstanding(movement: Movement): boolean {
  if (movement.transport?.stoppedAt === undefined || movement.acceptedUnitId === undefined) return false;
  return (
    movement.admissionId !== undefined ||
    (movement.blocker === STAGE_TRANSITION_BLOCKERS.transportStoppedAwaitingRelease &&
      movementHoldsBedByStage(movement))
  );
}

/** The same bounded join accepted by arrival and restore: authored seed admissions may lack
 * a movement backpointer; runtime AD-ARR records may not. Acceptance alone is never a hold.
 * A closed journey holds nothing, except one stopped in transit whose bed is still awaiting
 * release (A3-10). */
export function movementHasBedHold(movement: Movement, admissions: readonly Admission[]): boolean {
  if (movement.acceptedUnitId === undefined) return false;
  if (movement.closure !== undefined && !stoppedTransportBedOutstanding(movement)) return false;
  if (movement.admissionId !== undefined) {
    return admissions.some(
      (admission) =>
        admission.id === movement.admissionId &&
        admission.state === "pulled" &&
        admission.unitId === movement.acceptedUnitId &&
        movementPatientIdentityMatchesRecord(movement, admission) &&
        (admission.movementId === movement.id ||
          (admission.movementId === null && !admission.id.startsWith("AD-ARR-"))),
    );
  }
  // Older authored movements have explicit pulled/later stages but no linked admission id.
  // Preserve that documented seed contract rather than fabricating a new admission.
  return ["pulled", "handover_ready", "moving"].includes(movement.stage);
}
