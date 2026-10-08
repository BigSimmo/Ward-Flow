import type { Admission } from "./ward-admissions";
import type { Movement } from "./ward-model";
import { movementPatientIdentityMatchesRecord } from "./ward-patient-resolver";

/** The same bounded join accepted by arrival and restore: authored seed admissions may lack
 * a movement backpointer; runtime AD-ARR records may not. Acceptance alone is never a hold. */
export function movementHasBedHold(movement: Movement, admissions: readonly Admission[]): boolean {
  if (movement.closure !== undefined || movement.acceptedUnitId === undefined) return false;
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
