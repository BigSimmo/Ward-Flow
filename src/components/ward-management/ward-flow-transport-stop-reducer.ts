import type { WardFlowEvent } from "./ward-flow-events";
import { STAGE_TRANSITION_BLOCKERS, type WardFlowState } from "./ward-flow-reducer";
import type { Movement, Notice } from "./ward-model";
import { STOP_TRANSPORT_REASONS, TRANSPORT_WHEREABOUTS } from "./ward-change-reasons";
type TransportStopEvent = Extract<WardFlowEvent, { type: "STOP_TRANSPORT" }>;
type TransportStopOperations = {
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
/** Stop the recorded journey and notify the officer and receiving ward. The held bed is left for an explicit release. */
export function reduceTransportStopEvent(
  state: WardFlowState,
  event: TransportStopEvent,
  operations: TransportStopOperations,
): WardFlowState {
  return stopTransport(state, event, operations);
}

/**
 * THE REFERRER OR THE COORDINATOR STOPS A COLLECTED JOURNEY — WLQ-38 (owner, 2026-09-15). See
 * this event's own doc comment in `ward-flow-events.ts` for the ruling and for why `ed` is
 * permitted by role alone. `EVENT_ROLE.STOP_TRANSPORT` already restricts the caller to
 * `coordinator`/`ed` before this case runs, so — unlike `WITHDRAW_REFERRAL` above, which must
 * permit four roles pre-acceptance and narrow two of them away after — nothing here re-checks
 * `event.role`.
 */
function stopTransport(
  state: WardFlowState,
  event: Extract<TransportStopEvent, { type: "STOP_TRANSPORT" }>,
  operations: TransportStopOperations,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);
  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);
  if (movement.closure) {
    return operations.reject(state, event, `cannot stop transport for a closed movement (${movement.closure.reason})`);
  }
  if (!movement.transport) {
    return operations.reject(state, event, `movement ${movement.id} has no transport job to stop`);
  }
  const refusal = stoppableJourneyRefusal(movement.id, movement.transport) ?? stopAnswersRefusal(event);
  if (refusal !== undefined) return operations.reject(state, event, refusal);
  const stopped = recordedStop(movement, event, movement.transport);
  const next = operations.replaceMovement(state, movement.id, stopped);
  return operations.appendNotices(next, stoppedJourneyNotices(state, event, movement, operations));
}
function stoppableJourneyRefusal(
  movementId: string,
  transport: NonNullable<Movement["transport"]>,
): string | undefined {
  if (transport.collectedAt === undefined) {
    return `movement ${movementId}'s transport has not been collected yet; use CANCEL_TRANSPORT instead`;
  }
  // Belt and braces alongside the `movement.closure` check above: `PATIENT_ARRIVED` always sets
  // both `transport.arrivedAt` and `movement.closure` in the same update (see `TransportJob`'s
  // own doc comment), so this can only ever fire if that invariant is ever broken elsewhere —
  // and if it is, refusing here on the right symptom beats silently trusting the wrong field.
  if (transport.arrivedAt !== undefined) {
    return `movement ${movementId}'s patient has already arrived`;
  }
  if (transport.diversion) {
    return `movement ${movementId} was diverted; use RELEASE_DIVERTED_BED rather than STOP_TRANSPORT`;
  }
  if (transport.cancelledAt !== undefined) {
    return `transport for movement ${movementId} was already stopped or cancelled`;
  }
  return undefined;
}
function stopAnswersRefusal(event: Extract<TransportStopEvent, { type: "STOP_TRANSPORT" }>): string | undefined {
  if (!STOP_TRANSPORT_REASONS.includes(event.reason)) {
    // Runtime membership, not merely the type — the same discipline every other reason-carrying
    // event in this file holds to, because `vitest run` alone involves no `tsc`.
    return `STOP_TRANSPORT reason must be chosen from STOP_TRANSPORT_REASONS`;
  }
  if (!TRANSPORT_WHEREABOUTS.includes(event.whereabouts)) {
    // Build plan item 31 (T3, 2026-09-17): the same runtime-membership discipline as the reason
    // check just above, for the same reason — `vitest run` alone involves no `tsc`, so a type
    // guarantee alone would never catch a hand-built or malformed dispatch.
    return `STOP_TRANSPORT whereabouts must be chosen from TRANSPORT_WHEREABOUTS`;
  }
  return undefined;
}
function recordedStop(
  movement: Movement,
  event: TransportStopEvent,
  transport: NonNullable<Movement["transport"]>,
): Movement {
  // Owner answer 8 (second round, 2026-09-17): the bed no longer comes back automatically here
  // — see `STAGE_TRANSITION_BLOCKERS.transportStoppedAwaitingRelease`'s own doc comment.
  // `acceptedUnitId` and `admissionId` are left exactly as `movement` already carries them, so
  // whatever bed is held stays held until a `RELEASE_HELD_BED` from the coordinator, the ward,
  // or the referrer.
  const stoppedTransport = transport;
  const stopped: Movement = {
    ...movement,
    transport: {
      ...stoppedTransport,
      // Both written together: `cancelledAt` is the general "this job is over" signal every
      // other reader (`transportStatusLabel`, `orphanedTransport`) already understands, and
      // `stoppedAt`/`stoppedBy`/`stopReason`/`stoppedWhereabouts` are this event's own more
      // specific record of who stopped it, why, and where the patient is — see `TransportJob`'s
      // own doc comment on all four.
      cancelledAt: event.now,
      stoppedAt: event.now,
      stoppedBy: event.role,
      stopReason: event.reason,
      stoppedWhereabouts: event.whereabouts,
    },
    closure: {
      at: event.now,
      outcome: "did_not_proceed",
      // The reason IS the closure reason: `STOP_TRANSPORT_REASONS`' three members are already
      // full sentences (Ward Lead's own wording), so restating them differently here would be
      // two strings for one fact.
      reason: event.reason,
    },
    // ACTIVE, not "None — …": the journey is over but the bed is still held pending a release
    // decision — this overwrites WLQ-4's `examinationRevokedAwaitingRelease` sentence if it was
    // standing, which is correct: that flag was about the SAME bed, and this is the newer,
    // more specific fact about it now.
    blocker: STAGE_TRANSITION_BLOCKERS.transportStoppedAwaitingRelease,
  };
  return stopped;
}
function stoppedJourneyNotices(
  state: WardFlowState,
  event: TransportStopEvent,
  movement: Movement,
  operations: TransportStopOperations,
): Notice[] {
  // Communication addendum §1.3's own principle, extended by WLQ-38 and by build plan item 31 —
  // see `NoticeKind`'s own doc comment for the addendum-row debt this records. The officer is
  // ALWAYS told where the patient now is (the officer is the one who reported it and the one
  // who has to act on it, the same "no placeId, a single role" shape `transport_cancelled_officer`
  // already holds — see `Addressee`'s own doc comment). The receiving ward, if there is one,
  // believed a patient was on the way; it is not coming — unchanged from WLQ-38.
  const stopNotices: Notice[] = [
    operations.makeNotice(
      event.now,
      state.notices.length,
      "transport_stopped_officer",
      { role: "officer" },
      { movementId: movement.id },
      `Transport for ${movement.id} was stopped (${event.reason}). Where the patient is now: ${event.whereabouts}.`,
    ),
  ];
  if (movement.acceptedUnitId !== undefined) {
    const receivingUnitId = movement.acceptedUnitId;
    stopNotices.push(
      operations.makeNotice(
        event.now,
        state.notices.length,
        "transport_stopped_ward",
        { role: "ward", placeId: receivingUnitId },
        { movementId: movement.id, unitId: receivingUnitId },
        `The transport bringing your patient for ${movement.id} was stopped (${event.reason}); the patient is not coming.`,
      ),
    );
  }
  return stopNotices;
}
