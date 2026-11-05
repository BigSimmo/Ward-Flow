import type { RepatriationRecord } from "./ward-flow-reducer";
import type { Movement } from "./ward-model";

/** Latest journey opened for this recorded agreement; old closed attempts remain retained. */
export function returnAttemptMovement(
  record: RepatriationRecord | undefined,
  movements: readonly Movement[],
): Movement | undefined {
  if (!record?.receivingWardAgreed) return undefined;
  return movements.findLast(
    (movement) =>
      movement.sourceAdmissionId === record.admissionId && movement.openedAt >= (record.agreedAt ?? record.at),
  );
}

export function returnAttemptEnded(record: RepatriationRecord | undefined, movements: readonly Movement[]): boolean {
  const closure = returnAttemptMovement(record, movements)?.closure;
  return closure !== undefined && closure.outcome !== "arrived";
}
