import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { isEdOriginJourney, recordedEdDeparture } from "@/components/ward-management/ward-ed-presence";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { RecordedFactEventHelpers } from "@/components/ward-management/ward-flow-record-events";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * Item 9 (police and ambulance handover times). A police or ambulance crew that brings someone to
 * an emergency department waits with them until it is released. The department types three times
 * from its paper record: crew arrived, handed over and crew released. D-93: typed times only. Nothing
 * here fills a time in, works one out from another, sets a target or counts down. A missing time
 * stays missing.
 */

/** The arrival modes a crew comes with. A self arrival, or a record with no mode, has no crew. */
export type CrewArrivalMode = "police" | "ambulance";

export function crewArrivalMode(movement: Pick<Movement, "arrivalMode">): CrewArrivalMode | undefined {
  return movement.arrivalMode === "police" || movement.arrivalMode === "ambulance" ? movement.arrivalMode : undefined;
}

/**
 * D-141: whether the record offers "Brought by: Police / Ambulance". An ED arrival that is still
 * open; a journey that started elsewhere, or a closed one, does not ask.
 */
export function canMarkBroughtBy(movement: Pick<Movement, "sourceAdmissionId" | "originEdId" | "closure">): boolean {
  return isEdOriginJourney(movement) && movement.closure === undefined;
}

/** The three typed times, in the order they happen. */
export const CREW_TIME_FIELDS = ["crewArrivedAt", "crewHandedOverAt", "crewReleasedAt"] as const;
export type CrewTimeField = (typeof CREW_TIME_FIELDS)[number];

/** `RECORD_CREW_TIMES`, declared beside its rule (ward-flow-events.ts is at its line cap). */
export type RecordCrewTimesEvent = {
  /**
   * Records one or more of a crew's typed times on an ED arrival brought by police or ambulance.
   * A time left out keeps whatever is already recorded; nothing is cleared or worked out.
   */
  type: "RECORD_CREW_TIMES";
  role: WardFlowRole;
  now: Instant;
  movementId: string;
  crewArrivedAt?: Instant;
  crewHandedOverAt?: Instant;
  crewReleasedAt?: Instant;
};

/**
 * `RECORD_ARRIVAL_MODE` (D-141, Josh 11 Nov 2026): the department marks an ED arrival "Brought by:
 * Police" or "Ambulance", so the crew times above can be typed for an arrival that was not seeded
 * with a mode. A fixed two-value choice and a movement id; no typed text. Marking it again with the
 * other mode corrects it; the crew times already typed stay as they are.
 */
export type RecordArrivalModeEvent = {
  type: "RECORD_ARRIVAL_MODE";
  role: WardFlowRole;
  now: Instant;
  movementId: string;
  arrivalMode: CrewArrivalMode;
};

/** The crew events this file declares, as one member of `WardFlowEvent`. */
export type CrewHandoverEvent = RecordCrewTimesEvent | RecordArrivalModeEvent;

/**
 * Why a set of crew times cannot be recorded, or `undefined` when it can. Times are read off a clock
 * face, so each typed one reaches back one day at most, and the three must never run backwards.
 * `typed` is what the person typed now; `recorded` is the whole set the record would then hold.
 */
export function crewTimesRefusal(
  typed: Partial<Record<CrewTimeField, Instant>>,
  recorded: Partial<Record<CrewTimeField, Instant>>,
  now: Instant,
): string | undefined {
  for (const field of CREW_TIME_FIELDS) {
    const at = typed[field];
    if (at === undefined) continue;
    if (!Number.isFinite(at)) return "A crew time could not be read";
    if (at > now) return "A crew time cannot be later than now";
    if (at < now - MINUTES_PER_DAY) return "A crew time must be within the last 24 hours";
  }
  const inOrder = CREW_TIME_FIELDS.map((field) => recorded[field]).filter((at): at is Instant => at !== undefined);
  if (inOrder.some((at, index) => index > 0 && at < (inOrder[index - 1] ?? at)))
    return "Crew times must run in order: arrived, handed over, released";
  return undefined;
}

/**
 * Whether this person's crew is still recorded as waiting: arrived is typed, released is not, and
 * the person is still in the department. A crew with no typed arrival is never counted, because
 * its wait would have to be guessed.
 */
export function crewIsWaiting(movement: Movement): boolean {
  return (
    isEdOriginJourney(movement) &&
    crewArrivalMode(movement) !== undefined &&
    movement.crewArrivedAt !== undefined &&
    movement.crewReleasedAt === undefined &&
    movement.stage !== "arrived" &&
    recordedEdDeparture(movement) === undefined &&
    (!movement.closure || movement.edOutcome !== undefined)
  );
}

/** How many crews wait and the longest wait in minutes, from typed arrival to now. */
export function crewsWaiting(
  movements: readonly Movement[],
  now: Instant,
): { count: number; longestMinutes: number } | undefined {
  const waits = movements.flatMap((movement) =>
    crewIsWaiting(movement) && movement.crewArrivedAt !== undefined ? [Math.max(now - movement.crewArrivedAt, 0)] : [],
  );
  return waits.length === 0 ? undefined : { count: waits.length, longestMinutes: Math.max(...waits) };
}

type CrewTimesHelpers = Pick<RecordedFactEventHelpers, "findMovement" | "reject" | "replaceMovement">;

/** `RECORD_CREW_TIMES`. The role check has already run in the reducer. */
export function reduceCrewTimesEvent(
  state: WardFlowState,
  event: RecordCrewTimesEvent,
  { findMovement, reject, replaceMovement }: CrewTimesHelpers,
): WardFlowState {
  const movement = findMovement(state, event.movementId);
  if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
  if (!isEdOriginJourney(movement))
    return reject(state, event, `movement ${movement.id} did not arrive at an emergency department`);
  if (crewArrivalMode(movement) === undefined)
    return reject(state, event, `movement ${movement.id} was not brought by police or ambulance`);
  if (CREW_TIME_FIELDS.every((field) => event[field] === undefined))
    return reject(state, event, "RECORD_CREW_TIMES needs at least one typed time");
  const next: Movement = { ...movement };
  for (const field of CREW_TIME_FIELDS) {
    const at = event[field];
    if (at !== undefined) next[field] = at;
  }
  const refusal = crewTimesRefusal(event, next, event.now);
  if (refusal) return reject(state, event, refusal);
  if (CREW_TIME_FIELDS.every((field) => next[field] === movement[field])) return state;
  return replaceMovement(state, movement.id, next);
}

/** `RECORD_ARRIVAL_MODE` (D-141). The role check has already run in the reducer. */
export function reduceArrivalModeEvent(
  state: WardFlowState,
  event: RecordArrivalModeEvent,
  { findMovement, reject, replaceMovement }: CrewTimesHelpers,
): WardFlowState {
  const movement = findMovement(state, event.movementId);
  if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
  if (!isEdOriginJourney(movement))
    return reject(state, event, `movement ${movement.id} did not arrive at an emergency department`);
  if (event.arrivalMode !== "police" && event.arrivalMode !== "ambulance")
    return reject(state, event, "RECORD_ARRIVAL_MODE needs Police or Ambulance");
  if (movement.arrivalMode === event.arrivalMode) return state;
  return replaceMovement(state, movement.id, { ...movement, arrivalMode: event.arrivalMode });
}
