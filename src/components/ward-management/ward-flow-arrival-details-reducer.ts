import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import type { Movement, Notice } from "./ward-model";
import { ARRIVAL_LATE_AFTER_MINUTES, isArrivalLate } from "./ward-legal-clock";
type ArrivalDetailsEvent = Extract<WardFlowEvent, { type: "SET_ARRIVAL_DETAILS" | "EVALUATE_ARRIVAL_LATENESS" }>;
type ArrivalDetailsOperations = {
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;
  findMovement: (state: WardFlowState, id: string) => Movement | undefined;
  replaceMovement: (state: WardFlowState, id: string, next: Movement) => WardFlowState;
  makeNotice: (
    now: WardFlowEvent["now"],
    count: number,
    kind: Notice["kind"],
    to: Notice["to"],
    about: Notice["about"],
    sentence: string,
  ) => Notice;
  appendNotices: (state: WardFlowState, notices: readonly Notice[]) => WardFlowState;
};
/** Record arrival details and the existing one-shot lateness notices.
 * The facade retains permission, resource revision, audit and notice-admission guards. */
export function reduceArrivalDetailsEvent(
  state: WardFlowState,
  event: ArrivalDetailsEvent,
  operations: ArrivalDetailsOperations,
): WardFlowState {
  switch (event.type) {
    case "SET_ARRIVAL_DETAILS":
      return recordDetails(state, event, operations);
    case "EVALUATE_ARRIVAL_LATENESS":
      return evaluateLateness(state, event, operations);
  }
}

function recordDetails(
  state: WardFlowState,
  event: Extract<ArrivalDetailsEvent, { type: "SET_ARRIVAL_DETAILS" }>,
  operations: ArrivalDetailsOperations,
): WardFlowState {
  const movement = state.movements.find((m) => m.id === event.movementId);

  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);

  const arrivalDetails = {
    mode: event.arrivalMode,
    trackingNumber: event.trackingNumber?.trim() || undefined,
    estimatedArrivalAt: event.estimatedArrivalAt,
    recordedAt: event.now,
    recordedBy: event.role,
  };

  let updatedMovement: Movement = {
    ...movement,
    arrivalDetails,
    pullExpiresAt: undefined, // Default 4h countdown timer is removed as arrival is sorted
  };

  let next = {
    ...state,
    movements: state.movements.map((m) => (m.id === movement.id ? updatedMovement : m)),
  };

  if (
    isArrivalLate(event.estimatedArrivalAt, updatedMovement.stage, event.now) &&
    updatedMovement.arrivalLateNotifiedAt === undefined
  ) {
    updatedMovement = { ...updatedMovement, arrivalLateNotifiedAt: event.now };
    next = {
      ...next,
      movements: next.movements.map((m) => (m.id === movement.id ? updatedMovement : m)),
    };
    return operations.appendNotices(next, arrivalLateNotices(next, movement, event, operations));
  }

  return next;
}

function evaluateLateness(
  state: WardFlowState,
  event: Extract<ArrivalDetailsEvent, { type: "EVALUATE_ARRIVAL_LATENESS" }>,
  operations: ArrivalDetailsOperations,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);

  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);

  if (movement.closure) return operations.reject(state, event, "This movement is closed.");

  if (movement.arrivalLateNotifiedAt !== undefined) return state;

  if (!isArrivalLate(movement.arrivalDetails?.estimatedArrivalAt, movement.stage, event.now)) {
    return state;
  }

  const updated: Movement = { ...movement, arrivalLateNotifiedAt: event.now };

  const next = operations.replaceMovement(state, movement.id, updated);

  return operations.appendNotices(next, arrivalLateNotices(next, movement, event, operations));
}

function arrivalLateNotices(
  next: WardFlowState,
  movement: Movement,
  event: ArrivalDetailsEvent,
  operations: ArrivalDetailsOperations,
): Notice[] {
  const notices = [
    operations.makeNotice(
      event.now,
      next.notices.length,
      "arrival_late_referrer",
      { role: "ed", placeId: movement.originEdId },
      { movementId: movement.id },
      `Arrival for ${movement.id} is more than ${ARRIVAL_LATE_AFTER_MINUTES} minutes past the planned time and they have not arrived.`,
    ),
  ];

  if (movement.acceptedUnitId) {
    notices.push(
      operations.makeNotice(
        event.now,
        next.notices.length + 1,
        "arrival_late_ward",
        { role: "ward", placeId: movement.acceptedUnitId },
        { movementId: movement.id, unitId: movement.acceptedUnitId },
        `Arrival for ${movement.id} is more than ${ARRIVAL_LATE_AFTER_MINUTES} minutes past the planned time and they have not arrived.`,
      ),
    );
  }

  return notices;
}
