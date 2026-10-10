import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import { STAGE_TRANSITION_BLOCKERS } from "./ward-stage-transition-blockers";
import { TRANSPORT_PROVIDERS, TRANSPORT_LEGAL_STATUSES, type Movement, type Unit } from "./ward-model";
import { stageCopy } from "./ward-stage-copy";
import { communityTeamById } from "./community/community-derivations";
type TransportBookingEvent = Extract<WardFlowEvent, { type: "BOOK_TRANSPORT" }>;
type TransportBookingOperations = {
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;
  findMovement: (state: WardFlowState, id: string) => Movement | undefined;
  findUnit: (state: WardFlowState, id: string) => Unit | undefined;
  replaceMovement: (state: WardFlowState, id: string, next: Movement) => WardFlowState;
};
/** Record the phone booking and its human answers. Permission, revision and audit remain in the facade. */
export function reduceTransportBookingEvent(
  state: WardFlowState,
  event: TransportBookingEvent,
  operations: TransportBookingOperations,
): WardFlowState {
  return bookTransport(state, event, operations);
}

function bookTransport(
  state: WardFlowState,
  event: TransportBookingEvent,
  operations: TransportBookingOperations,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);
  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);
  const refusal =
    bookingMovementRefusal(movement) ??
    bookingPhoneFactsRefusal(event) ??
    bookingWardClaimRefusal(state, event, operations) ??
    bookingCommunityClaimRefusal(event) ??
    bookingDestinationRefusal(movement, event);
  if (refusal !== undefined) return operations.reject(state, event, refusal);
  return operations.replaceMovement(state, movement.id, recordedBooking(movement, event));
}
function bookingMovementRefusal(movement: Movement): string | undefined {
  if (movement.closure) {
    return `cannot book transport for a closed movement (${movement.closure.reason})`;
  }
  // Owner answer 30 (2026-09-17), build plan item 30: "no automatic rebooking; a person books
  // again" — including from `handover_ready`. Before this ruling `CANCEL_TRANSPORT` always
  // left a replacement job standing while a bed was held, so nobody needed to book from
  // `handover_ready`: a job was always already there. Now `CANCEL_TRANSPORT` removes the job
  // in every case (see that case's own comment), so a cancel reached after `HANDOVER_READY`
  // has run must be reachable here too, or the movement is stuck with a held bed and no way to
  // book transport for it again.
  if (movement.stage !== "pulled" && movement.stage !== "handover_ready") {
    return `cannot book transport at the movement's current stage (${stageCopy[movement.stage].label})`;
  }
  // A second booking would replace a job a provider may already have accepted, and the
  // acceptance timestamps would vanish with it. Cancel first (`CANCEL_TRANSPORT`), then rebook.
  if (movement.transport && movement.transport.cancelledAt === undefined) {
    return `transport for movement ${movement.id} is already booked`;
  }
  return undefined;
}

function bookingPhoneFactsRefusal(event: TransportBookingEvent): string | undefined {
  if (!TRANSPORT_PROVIDERS.includes(event.provider)) {
    return `BOOK_TRANSPORT provider must be chosen from TRANSPORT_PROVIDERS`;
  }
  // ⚠️ A MISSING ESCORT ANSWER IS REFUSED RATHER THAN DEFAULTED, and that is the whole event.
  // The control opens blank; storing `false` for a question nobody answered would put "no
  // escort required" on screen as though a clinician had said so, which is exactly the defect
  // `HANDOVER_READY`'s derivation commits and the reason `TR-D1` puts booking on the team that
  // knows. `typeof` because the payload reaches this from JavaScript, where the field can be
  // absent whatever the type says.
  if (typeof event.escortRequired !== "boolean") {
    return `BOOK_TRANSPORT escortRequired must be answered, and it has no default`;
  }
  // Owner's third ruling, 2026-09-17: booking this control LOGS a booking already made by
  // phone, and the three facts the caller was given on that call are all required, never
  // defaulted — the identical "answered by a person" discipline `escortRequired` just above
  // already holds to. `typeof`/membership checks throughout, because the payload reaches this
  // from JavaScript, where a field can be absent or wrong-shaped whatever the type says.
  if (typeof event.cadNumber !== "string" || event.cadNumber.trim().length === 0) {
    return `BOOK_TRANSPORT cadNumber must be answered, and it has no default`;
  }
  if (!TRANSPORT_LEGAL_STATUSES.includes(event.transportLegalStatus)) {
    return `BOOK_TRANSPORT transportLegalStatus must be chosen from TRANSPORT_LEGAL_STATUSES`;
  }
  if (typeof event.estimatedAt !== "number" || !Number.isFinite(event.estimatedAt)) {
    return `BOOK_TRANSPORT estimatedAt must be answered, and it has no default`;
  }
  return undefined;
}

function bookingWardClaimRefusal(
  state: WardFlowState,
  event: TransportBookingEvent,
  operations: TransportBookingOperations,
): string | undefined {
  if (event.role !== "ward") return undefined;
  // WLQ-11 (owner, 2026-09-15): `CANCEL_TRANSPORT`'s `ward` branch needs to tell the booking
  // ward from any other later, so a `ward` booker must state its claim now — a booking this
  // field cannot name could never be matched against a later cancellation claim. Same
  // discipline as `escortRequired` just above: required and never defaulted.
  if (!event.actingUnitId) {
    return `BOOK_TRANSPORT raised as ward must state its actingUnitId, and it has no default`;
  }
  // Opus adversarial review, 2026-09-17, P2 finding 1: the check above only tested PRESENCE,
  // never that the claimed unit is real. `bookedBy.unitId` (below) is later compared against a
  // `ward` canceller's own claim (`CANCEL_TRANSPORT`'s own comment), so an invented unit id would
  // be stored as though it named a real ward and could never be matched against anything real.
  if (!operations.findUnit(state, event.actingUnitId)) {
    return `BOOK_TRANSPORT actingUnitId ${event.actingUnitId} does not name a real unit`;
  }
  return undefined;
}

function bookingCommunityClaimRefusal(event: TransportBookingEvent): string | undefined {
  if (event.role !== "community") return undefined;
  // Owner's third ruling, 2026-09-17 (answer 9): "only the community team that booked
  // transport may cancel it" — a `community` booker must state its claim now, the identical
  // reason and identical discipline as the `ward` pair of checks just above.
  if (!event.actingPlaceId) {
    return `BOOK_TRANSPORT raised as community must state its actingPlaceId, and it has no default`;
  }
  if (!communityTeamById(event.actingPlaceId)) {
    return `BOOK_TRANSPORT actingPlaceId ${event.actingPlaceId} does not name a real community team`;
  }
  return undefined;
}

function bookingDestinationRefusal(movement: Movement, event: TransportBookingEvent): string | undefined {
  if (!movement.acceptedUnitId && !movement.admissionId) {
    return `cannot book transport for movement ${movement.id} without an accepted destination ward or admission`;
  }
  if (event.role !== "ed" || !event.actingPlaceId) return undefined;
  if (movement.originEdId && event.actingPlaceId !== movement.originEdId) {
    return `BOOK_TRANSPORT raised as ED acting as ${event.actingPlaceId} may only book transport for movements originating from its own ED (${movement.originEdId})`;
  }
  return undefined;
}
function recordedBooking(movement: Movement, event: TransportBookingEvent): Movement {
  // 🔴 THIRD FIX ROUND (Opus debugger, 3b3f215ba1, via `CANCEL_TRANSPORT`'s own no-bed-held
  // branch): a plain `${movement.id}-transport` collides with an earlier job the same movement
  // had cancelled while no bed was held — `CANCEL_TRANSPORT` removes that job outright rather
  // than replacing it (nothing to replace when no bed is held), so a later re-pull's booking
  // reaches here with the identical template and would mint the SAME id a second time, even
  // though it names a different job with its own timestamps. Counted off `unwinds`, the one
  // append-only record already proven immune to this movement's own history (see
  // `CANCEL_TRANSPORT`'s replacement-id counter just below, which counts the same way) —
  // deterministic, no `Date.now`, no random value. The common case (no prior cancellation) is
  // unchanged: the id stays exactly `${movement.id}-transport`, so every existing booking this
  // movement has never had cancelled keeps its familiar id.
  const priorTransportCancellations = movement.unwinds.filter((entry) => entry.kind === "transport_cancelled").length;
  const booked: Movement = {
    ...movement,
    transport: {
      id:
        priorTransportCancellations === 0
          ? `${movement.id}-transport`
          : `${movement.id}-transport-${priorTransportCancellations + 1}`,
      provider: event.provider,
      escortRequired: event.escortRequired,
      // Owner's third ruling, 2026-09-17: the phone-logged facts, required and stored exactly
      // as answered — see each field's own doc comment on `TransportJob` (`ward-model.ts`).
      cadNumber: event.cadNumber,
      transportLegalStatus: event.transportLegalStatus,
      estimatedAt: event.estimatedAt,
      // Carried forward from RECORD_TRANSPORT_NEED so the "no transport needed" branches in
      // HANDOVER_READY / PATIENT_ARRIVED can read a runtime-booked job the same way they read a
      // seed-authored one.
      needed: movement.transportNeed?.needed,
      // WLQ-11 (owner, 2026-09-15) / third ruling (2026-09-17): who booked this job. `unitId`
      // is recorded only for a `ward` booker, `placeId` only for a `community` booker — see
      // `TransportJob.bookedBy`'s own doc comment for why `ed` carries a role and nothing more.
      bookedBy: {
        role: event.role,
        ...(event.role === "ward" ? { unitId: event.actingUnitId } : {}),
        ...(event.role === "community" ? { placeId: event.actingPlaceId } : {}),
        ...(event.role === "ed" && event.actingPlaceId ? { placeId: event.actingPlaceId } : {}),
      },
    },
    // A job now exists and the provider has not answered it. Deliberately says only that: which
    // provider, and whether an escort was asked for, are already on the job itself and
    // `transportStatusLabel` renders them — restating them here would be two sentences for one
    // fact, the drift this codebase produces most reliably.
    blocker: STAGE_TRANSITION_BLOCKERS.transportBooked,
  };
  return booked;
}
