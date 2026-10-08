import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import type { Movement } from "./ward-model";
type ExpectFlagsEvent = Extract<WardFlowEvent, { type: "CLEAR_EXPECT_FLAG" | "RAISE_EXPECT_FLAG" }>;
type ExpectFlagsOperations = {
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;
  findMovement: (state: WardFlowState, id: string) => Movement | undefined;
  replaceMovement: (state: WardFlowState, id: string, next: Movement) => WardFlowState;
};
/** Record and clear the existing expect flag without computing a clinical or legal deadline.
 * The facade retains permission, resource revision and audit boundaries. */
export function reduceExpectFlagsEvent(
  state: WardFlowState,
  event: ExpectFlagsEvent,
  operations: ExpectFlagsOperations,
): WardFlowState {
  switch (event.type) {
    case "CLEAR_EXPECT_FLAG":
      return clearExpectFlag(state, event, operations);
    case "RAISE_EXPECT_FLAG":
      return raiseExpectFlag(state, event, operations);
  }
}

function clearExpectFlag(
  state: WardFlowState,
  event: Extract<ExpectFlagsEvent, { type: "CLEAR_EXPECT_FLAG" }>,
  operations: ExpectFlagsOperations,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);
  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);
  if (movement.closure) return operations.reject(state, event, "This movement is closed.");
  if (!movement.expectFlag || movement.expectFlag.clearedAt !== undefined) {
    return operations.reject(state, event, `movement ${movement.id} has no open expect flag to clear`);
  }
  const updated: Movement = {
    ...movement,
    expectFlag: { ...movement.expectFlag, clearedAt: event.now, clearedBy: event.role },
  };
  return operations.replaceMovement(state, movement.id, updated);
}

function raiseExpectFlag(
  state: WardFlowState,
  event: Extract<ExpectFlagsEvent, { type: "RAISE_EXPECT_FLAG" }>,
  operations: ExpectFlagsOperations,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);
  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);
  if (movement.closure) return operations.reject(state, event, "This movement is closed.");
  if (movement.expectFlag && movement.expectFlag.clearedAt === undefined) {
    return operations.reject(state, event, `movement ${movement.id} already has an open expect flag`);
  }
  // A type-only union passes `vitest run` with no tsc, so membership is enforced at runtime too.
  if (event.kind !== "voluntary_48h" && event.kind !== "involuntary_7d") {
    return operations.reject(state, event, `RAISE_EXPECT_FLAG kind must be "voluntary_48h" or "involuntary_7d"`);
  }
  const updated: Movement = {
    ...movement,
    expectFlag: { raisedAt: event.now, kind: event.kind },
  };
  return operations.replaceMovement(state, movement.id, updated);
}
