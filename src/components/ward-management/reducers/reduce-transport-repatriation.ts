import type { Admission } from "../ward-admissions";
import { CANCEL_TRANSPORT_REASONS, STOP_TRANSPORT_REASONS, TRANSPORT_WHEREABOUTS } from "../ward-change-reasons";
import type { WardFlowEvent } from "../ward-flow-events";
import type { WardFlowState } from "../ward-flow-reducer";
import {
  MOVEMENT_STAGES,
  TRANSPORT_LEGAL_STATUSES,
  TRANSPORT_PROVIDERS,
  type Addressee,
  type Movement,
  type Unit,
  type Referral,
  type Notice,
  type NoticeKind,
} from "../ward-model";
import { stageCopy } from "../ward-stage-copy";
import { ARRIVAL_LATE_AFTER_MINUTES, isArrivalLate } from "../ward-legal-clock";
import { communityTeamById } from "../community/community-derivations";
import { transportExceptionRecord } from "../ward-transport-checks";

export type TransportContext = {
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;
  findMovement: (state: WardFlowState, movementId: string) => Movement | undefined;
  replaceMovement: (state: WardFlowState, movementId: string, next: Movement) => WardFlowState;
  findUnit: (state: WardFlowState, unitId: string) => Unit | undefined;
  findReferral: (state: WardFlowState, referralId: string) => Referral | undefined;
  movementSourceAdmission: (state: WardFlowState, movement: Movement) => Admission | undefined;
  heldUnitGenderRefusal: (state: WardFlowState, movement: Movement, now: number) => string | null;
  movementHoldsBedByStage: (movement: Movement) => boolean;
  releasePulledBedAndAdmission: (state: WardFlowState, movement: Movement, now: number) => WardFlowState;
  makeNotice: (
    now: number,
    count: number,
    kind: NoticeKind,
    to: Addressee,
    about: Notice["about"],
    sentence: string,
  ) => Notice;
  appendNotices: (state: WardFlowState, notices: readonly Notice[]) => WardFlowState;
  stageTransitionBlockers: Record<string, string>;
};

export function reduceTransport(state: WardFlowState, event: WardFlowEvent, context: TransportContext): WardFlowState {
  const {
    reject,
    findMovement,
    replaceMovement,
    findUnit,
    findReferral,
    movementSourceAdmission,
    heldUnitGenderRefusal,
    movementHoldsBedByStage,
    releasePulledBedAndAdmission,
    makeNotice,
    appendNotices,
    stageTransitionBlockers,
  } = context;

  switch (event.type) {
    case "RECORD_TRANSPORT_NEED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(
          state,
          event,
          `cannot record a transport need for a closed movement (${movement.closure.reason})`,
        );
      }
      if (event.role === "ward" && event.actingUnitId !== undefined) {
        const referral = movement.referralId ? findReferral(state, movement.referralId) : undefined;
        const sendingWard =
          referral?.originUnitId ??
          movementSourceAdmission(state, movement)?.unitId ??
          (movement as { originUnitId?: string }).originUnitId;
        if (sendingWard) {
          if (event.actingUnitId !== sendingWard) {
            return reject(
              state,
              event,
              `RECORD_TRANSPORT_NEED was raised acting as unit ${event.actingUnitId} but movement origin is ward ${sendingWard}; only the sending ward can record transport need`,
            );
          }
        } else if (movement.acceptedUnitId && event.actingUnitId === movement.acceptedUnitId) {
          return reject(
            state,
            event,
            `RECORD_TRANSPORT_NEED was raised acting as destination ward ${event.actingUnitId}; receiving ward cannot record transport need`,
          );
        }
      }
      if (
        !event.needed &&
        movement.transport !== undefined &&
        movement.transport.cancelledAt === undefined &&
        movement.transport.arrivedAt === undefined
      ) {
        return reject(
          state,
          event,
          `movement ${movement.id} has a booked transport job; cancel it before recording that no transport is needed`,
        );
      }
      const updated: Movement = {
        ...movement,
        transportNeed: { needed: event.needed, at: event.now },
        ...(movement.transport ? { transport: { ...movement.transport, needed: event.needed } } : {}),
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "TRANSPORT_ACCEPTED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot accept transport for a closed movement (${movement.closure.reason})`);
      }

      {
        const examinationOutcome = movement.examination?.outcome;
        const examinationRevokedHoldingBed =
          (examinationOutcome === "community_order" || examinationOutcome === "revoked") &&
          movementHoldsBedByStage(movement);
        const awaitingRelease = movement.blocker === stageTransitionBlockers.examinationRevokedAwaitingRelease;
        if (examinationRevokedHoldingBed || awaitingRelease) {
          return reject(
            state,
            event,
            `cannot advance transport for movement ${movement.id}: the examination was revoked and the bed is still held — a coordinator must release the bed first`,
          );
        }
      }
      if (movement.stage !== "handover_ready" || !movement.transport) {
        return reject(
          state,
          event,
          `cannot accept transport at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      if (movement.transport.acceptedAt !== undefined) {
        return reject(state, event, `transport for movement ${movement.id} was already accepted`);
      }
      const transportAcceptedGenderRefusal = heldUnitGenderRefusal(state, movement, event.now);
      if (transportAcceptedGenderRefusal) return reject(state, event, transportAcceptedGenderRefusal);
      const updated: Movement = {
        ...movement,
        transport: { ...movement.transport, acceptedAt: event.now },
        blocker: stageTransitionBlockers.transportAccepted,
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "TRANSPORT_EN_ROUTE": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot move transport for a closed movement (${movement.closure.reason})`);
      }

      {
        const examinationOutcome = movement.examination?.outcome;
        const examinationRevokedHoldingBed =
          (examinationOutcome === "community_order" || examinationOutcome === "revoked") &&
          movementHoldsBedByStage(movement);
        const awaitingRelease = movement.blocker === stageTransitionBlockers.examinationRevokedAwaitingRelease;
        if (examinationRevokedHoldingBed || awaitingRelease) {
          return reject(
            state,
            event,
            `cannot advance transport for movement ${movement.id}: the examination was revoked and the bed is still held — a coordinator must release the bed first`,
          );
        }
      }
      if (movement.stage !== "handover_ready" || movement.transport?.acceptedAt === undefined) {
        return reject(
          state,
          event,
          `cannot mark transport en route: the movement must be at ${stageCopy.handover_ready.label} ` +
            `with transport accepted (it is at ${stageCopy[movement.stage].label}, transport ` +
            `${movement.transport?.acceptedAt !== undefined ? "accepted" : "not accepted"})`,
        );
      }
      if (movement.transport.enRouteAt !== undefined) {
        return reject(state, event, `transport for movement ${movement.id} is already en route`);
      }
      const updated: Movement = {
        ...movement,
        transport: { ...movement.transport, enRouteAt: event.now },
        blocker: stageTransitionBlockers.transportEnRoute,
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "BOOK_TRANSPORT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot book transport for a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "pulled" && movement.stage !== "handover_ready") {
        return reject(
          state,
          event,
          `cannot book transport at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      if (movement.transport && movement.transport.cancelledAt === undefined) {
        return reject(state, event, `transport for movement ${movement.id} is already booked`);
      }
      if (!TRANSPORT_PROVIDERS.includes(event.provider)) {
        return reject(state, event, `BOOK_TRANSPORT provider must be chosen from TRANSPORT_PROVIDERS`);
      }
      if (typeof event.escortRequired !== "boolean") {
        return reject(state, event, `BOOK_TRANSPORT escortRequired must be answered, and it has no default`);
      }
      if (typeof event.cadNumber !== "string" || event.cadNumber.trim().length === 0) {
        return reject(state, event, `BOOK_TRANSPORT cadNumber must be answered, and it has no default`);
      }
      if (!TRANSPORT_LEGAL_STATUSES.includes(event.transportLegalStatus)) {
        return reject(state, event, `BOOK_TRANSPORT transportLegalStatus must be chosen from TRANSPORT_LEGAL_STATUSES`);
      }
      if (typeof event.estimatedAt !== "number" || !Number.isFinite(event.estimatedAt)) {
        return reject(state, event, `BOOK_TRANSPORT estimatedAt must be answered, and it has no default`);
      }
      if (event.role === "ward" && !event.actingUnitId) {
        return reject(state, event, `BOOK_TRANSPORT raised as ward must state its actingUnitId, and it has no default`);
      }
      if (event.role === "ward" && event.actingUnitId !== undefined && !findUnit(state, event.actingUnitId)) {
        return reject(state, event, `BOOK_TRANSPORT actingUnitId ${event.actingUnitId} does not name a real unit`);
      }
      if (event.role === "ward" && event.actingUnitId !== undefined) {
        const referral = movement.referralId ? findReferral(state, movement.referralId) : undefined;
        const sendingWard =
          referral?.originUnitId ??
          movementSourceAdmission(state, movement)?.unitId ??
          (movement as { originUnitId?: string }).originUnitId;
        if (sendingWard) {
          if (event.actingUnitId !== sendingWard) {
            return reject(
              state,
              event,
              `BOOK_TRANSPORT was raised acting as unit ${event.actingUnitId} but movement origin is ward ${sendingWard}; only the sending ward can book transport`,
            );
          }
        } else if (movement.acceptedUnitId && event.actingUnitId === movement.acceptedUnitId) {
          return reject(
            state,
            event,
            `BOOK_TRANSPORT was raised acting as destination ward ${event.actingUnitId}; receiving ward cannot book transport`,
          );
        }
      }
      if (event.role === "community" && !event.actingPlaceId) {
        return reject(
          state,
          event,
          `BOOK_TRANSPORT raised as community must state its actingPlaceId, and it has no default`,
        );
      }
      if (event.role === "community" && event.actingPlaceId !== undefined && !communityTeamById(event.actingPlaceId)) {
        return reject(
          state,
          event,
          `BOOK_TRANSPORT actingPlaceId ${event.actingPlaceId} does not name a real community team`,
        );
      }
      if (!movement.acceptedUnitId && !movement.admissionId) {
        return reject(
          state,
          event,
          `cannot book transport for movement ${movement.id} without an accepted destination ward or admission`,
        );
      }
      if (
        event.role === "ed" &&
        event.actingPlaceId &&
        movement.originEdId &&
        event.actingPlaceId !== movement.originEdId
      ) {
        return reject(
          state,
          event,
          `BOOK_TRANSPORT raised as ED acting as ${event.actingPlaceId} may only book transport for movements originating from its own ED (${movement.originEdId})`,
        );
      }
      const priorTransportCancellations = movement.unwinds.filter(
        (entry) => entry.kind === "transport_cancelled",
      ).length;
      const bookingException =
        event.exception === undefined
          ? undefined
          : transportExceptionRecord(event.exception, event.now, event.role, "booked");
      if (typeof bookingException === "string") return reject(state, event, `BOOK_TRANSPORT ${bookingException}`);
      const booked: Movement = {
        ...movement,
        transport: {
          id:
            priorTransportCancellations === 0
              ? `${movement.id}-transport`
              : `${movement.id}-transport-${priorTransportCancellations + 1}`,
          provider: event.provider,
          escortRequired: event.escortRequired,
          cadNumber: event.cadNumber,
          transportLegalStatus: event.transportLegalStatus,
          estimatedAt: event.estimatedAt,
          ...(bookingException ? { exceptions: [bookingException] } : {}),
          needed: movement.transportNeed?.needed,
          bookedBy: {
            role: event.role,
            ...(event.role === "ward" ? { unitId: event.actingUnitId } : {}),
            ...(event.role === "community" ? { placeId: event.actingPlaceId } : {}),
            ...(event.role === "ed" && event.actingPlaceId ? { placeId: event.actingPlaceId } : {}),
          },
        },
        blocker: stageTransitionBlockers.transportBooked,
      };
      return replaceMovement(state, movement.id, booked);
    }

    case "CANCEL_TRANSPORT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot cancel transport for a closed movement (${movement.closure.reason})`);
      }
      if (!movement.transport) {
        return reject(state, event, `movement ${movement.id} has no transport job to cancel`);
      }
      if (movement.transport.cancelledAt !== undefined) {
        return reject(state, event, `transport for movement ${movement.id} was already cancelled`);
      }
      if (movement.transport.arrivedAt !== undefined) {
        return reject(state, event, `cannot cancel transport for movement ${movement.id} — the patient has arrived`);
      }
      if (movement.transport.collectedAt !== undefined) {
        return reject(state, event, `cannot cancel transport for movement ${movement.id} — the patient has departed`);
      }
      if (event.role === "ward") {
        if (
          movement.transport.bookedBy?.role !== "ward" ||
          !event.actingUnitId ||
          movement.transport.bookedBy.unitId !== event.actingUnitId
        ) {
          return reject(
            state,
            event,
            `CANCEL_TRANSPORT raised as ward acting as ${event.actingUnitId} may only cancel transport it booked for movement ${movement.id}`,
          );
        }
      }
      if (event.role === "community") {
        if (
          movement.transport.bookedBy?.role !== "community" ||
          !event.actingPlaceId ||
          movement.transport.bookedBy.placeId !== event.actingPlaceId
        ) {
          return reject(
            state,
            event,
            `CANCEL_TRANSPORT raised as community acting as ${event.actingPlaceId} may only cancel transport it booked for movement ${movement.id}`,
          );
        }
      }
      if (event.role === "ed" && event.actingPlaceId) {
        if (movement.transport.bookedBy?.placeId && movement.transport.bookedBy.placeId !== event.actingPlaceId) {
          return reject(
            state,
            event,
            `CANCEL_TRANSPORT raised as ED acting as ${event.actingPlaceId} may only cancel transport it booked for movement ${movement.id}`,
          );
        }
      }
      if (!CANCEL_TRANSPORT_REASONS.includes(event.reason)) {
        return reject(state, event, `CANCEL_TRANSPORT reason must be chosen from CANCEL_TRANSPORT_REASONS`);
      }

      const cancelledTransport = movement.transport;
      const bedIsHeld =
        movement.admissionId !== undefined ||
        MOVEMENT_STAGES.indexOf(movement.stage) >= MOVEMENT_STAGES.indexOf("pulled");
      const updatedMovement: Movement = {
        ...movement,
        transport: undefined,
        blocker: bedIsHeld ? stageTransitionBlockers.transportCancelled : stageTransitionBlockers.accepted,
        unwinds: [
          ...movement.unwinds,
          {
            at: event.now,
            kind: "transport_cancelled",
            by: event.role,
            reason: event.reason,
            transportId: cancelledTransport.id,
            cadNumber: cancelledTransport.cadNumber,
          },
        ],
        stageChanges: movement.stageChanges,
      };
      const next = replaceMovement(state, movement.id, updatedMovement);
      const cancelledNote = bedIsHeld
        ? "the bed is still held and nothing has been rebooked."
        : "no bed is held and nothing has been rebooked.";
      const transportNotices: Notice[] = [
        makeNotice(
          event.now,
          state.notices.length,
          "transport_cancelled_officer",
          { role: "officer" },
          { movementId: movement.id },
          `Transport for ${movement.id} was cancelled (${event.reason.replace(/_/g, " ")}); ${cancelledNote}`,
        ),
      ];
      if (movement.acceptedUnitId !== undefined) {
        const receivingUnitId = movement.acceptedUnitId;
        transportNotices.push(
          makeNotice(
            event.now,
            state.notices.length,
            "transport_cancelled_ward",
            { role: "ward", placeId: receivingUnitId },
            { movementId: movement.id, unitId: receivingUnitId },
            `The transport bringing your patient for ${movement.id} was cancelled (${event.reason.replace(/_/g, " ")}); ${cancelledNote}`,
          ),
        );
      }
      return appendNotices(next, transportNotices);
    }

    case "STOP_TRANSPORT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot stop transport for a closed movement (${movement.closure.reason})`);
      }
      if (!movement.transport) {
        return reject(state, event, `movement ${movement.id} has no transport job to stop`);
      }
      if (movement.transport.collectedAt === undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id}'s transport has not been collected yet; use CANCEL_TRANSPORT instead`,
        );
      }
      if (movement.transport.arrivedAt !== undefined) {
        return reject(state, event, `movement ${movement.id}'s patient has already arrived`);
      }
      if (movement.transport.diversion) {
        return reject(
          state,
          event,
          `movement ${movement.id} was diverted; use RELEASE_DIVERTED_BED rather than STOP_TRANSPORT`,
        );
      }
      if (movement.transport.cancelledAt !== undefined) {
        return reject(state, event, `transport for movement ${movement.id} was already stopped or cancelled`);
      }
      if (!STOP_TRANSPORT_REASONS.includes(event.reason)) {
        return reject(state, event, `STOP_TRANSPORT reason must be chosen from STOP_TRANSPORT_REASONS`);
      }
      if (!TRANSPORT_WHEREABOUTS.includes(event.whereabouts)) {
        return reject(state, event, `STOP_TRANSPORT whereabouts must be chosen from TRANSPORT_WHEREABOUTS`);
      }

      const stoppedTransport = movement.transport;
      const stopped: Movement = {
        ...movement,
        transport: {
          ...stoppedTransport,
          cancelledAt: event.now,
          stoppedAt: event.now,
          stoppedBy: event.role,
          stopReason: event.reason,
          stoppedWhereabouts: event.whereabouts,
        },
        closure: {
          at: event.now,
          outcome: "did_not_proceed",
          reason: event.reason,
        },
        blocker: stageTransitionBlockers.transportStoppedAwaitingRelease,
      };
      const next = replaceMovement(state, movement.id, stopped);
      const stopNotices: Notice[] = [
        makeNotice(
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
          makeNotice(
            event.now,
            state.notices.length,
            "transport_stopped_ward",
            { role: "ward", placeId: receivingUnitId },
            { movementId: movement.id, unitId: receivingUnitId },
            `The transport bringing your patient for ${movement.id} was stopped (${event.reason}); the patient is not coming.`,
          ),
        );
      }
      return appendNotices(next, stopNotices);
    }

    case "RELEASE_HELD_BED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      const isStoppedTransport = movement.transport?.stoppedAt !== undefined;
      const examinationOutcome = movement.examination?.outcome;
      const isRevokedExamHold =
        (examinationOutcome === "community_order" || examinationOutcome === "revoked") &&
        (movement.admissionId !== undefined || (movement.closure === undefined && movementHoldsBedByStage(movement)));
      const awaitingRelease = movement.blocker === stageTransitionBlockers.examinationRevokedAwaitingRelease;

      if (!isStoppedTransport && !isRevokedExamHold && !awaitingRelease) {
        return reject(
          state,
          event,
          `movement ${movement.id} was not stopped by STOP_TRANSPORT and has no examination-revoked hold, so there is no held bed to release this way`,
        );
      }
      const heldBedOutstanding =
        movement.admissionId !== undefined ||
        (movement.closure === undefined && movementHoldsBedByStage(movement)) ||
        movement.blocker === stageTransitionBlockers.transportStoppedAwaitingRelease ||
        movement.blocker === stageTransitionBlockers.examinationRevokedAwaitingRelease;
      if (!heldBedOutstanding) {
        return reject(state, event, `movement ${movement.id} holds no bed — it may already have been released`);
      }
      if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId) {
        return reject(
          state,
          event,
          `RELEASE_HELD_BED was raised acting as unit ${event.actingUnitId} but movement ${movement.id}'s bed is held at ${movement.acceptedUnitId}`,
        );
      }
      const withoutHeldBed = releasePulledBedAndAdmission(state, movement, event.now);
      const released: Movement = {
        ...movement,
        admissionId: undefined,
        ...(isRevokedExamHold || awaitingRelease
          ? {
              acceptedUnitId: undefined,
              referredUnitIds: [],
              ...(movement.transport && movement.transport.cancelledAt === undefined
                ? {
                    transport: {
                      ...movement.transport,
                      cancelledAt: event.now,
                    },
                  }
                : {}),
            }
          : {}),
        blocker: stageTransitionBlockers.didNotProceed,
        examRevoked: undefined,
        closure: movement.closure ?? {
          at: event.now,
          outcome: "did_not_proceed",
          reason: isRevokedExamHold || awaitingRelease ? "examination_revoked" : "bed_released",
        },
      };
      return replaceMovement(withoutHeldBed, movement.id, released);
    }

    case "SET_ARRIVAL_DETAILS": {
      const movement = state.movements.find((m) => m.id === event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, "cannot update arrival details on closed movement");
      }
      if (
        event.role === "ward" &&
        event.actingUnitId !== undefined &&
        movement.acceptedUnitId !== undefined &&
        event.actingUnitId !== movement.acceptedUnitId
      ) {
        return reject(
          state,
          event,
          `SET_ARRIVAL_DETAILS was raised acting as unit ${event.actingUnitId} but destination is unit ${movement.acceptedUnitId}; only destination ward or coordinator can set arrival details`,
        );
      }

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
        pullExpiresAt: undefined,
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
        const notices = [
          makeNotice(
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
            makeNotice(
              event.now,
              next.notices.length + 1,
              "arrival_late_ward",
              { role: "ward", placeId: movement.acceptedUnitId },
              { movementId: movement.id, unitId: movement.acceptedUnitId },
              `Arrival for ${movement.id} is more than ${ARRIVAL_LATE_AFTER_MINUTES} minutes past the planned time and they have not arrived.`,
            ),
          );
        }
        return appendNotices(next, notices);
      }

      return next;
    }

    case "EVALUATE_ARRIVAL_LATENESS": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) return reject(state, event, "This movement is closed.");
      if (movement.arrivalLateNotifiedAt !== undefined) return state;
      if (!isArrivalLate(movement.arrivalDetails?.estimatedArrivalAt, movement.stage, event.now)) {
        return state;
      }
      const updated: Movement = { ...movement, arrivalLateNotifiedAt: event.now };
      const next = replaceMovement(state, movement.id, updated);
      const notices = [
        makeNotice(
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
          makeNotice(
            event.now,
            next.notices.length + 1,
            "arrival_late_ward",
            { role: "ward", placeId: movement.acceptedUnitId },
            { movementId: movement.id, unitId: movement.acceptedUnitId },
            `Arrival for ${movement.id} is more than ${ARRIVAL_LATE_AFTER_MINUTES} minutes past the planned time and they have not arrived.`,
          ),
        );
      }
      return appendNotices(next, notices);
    }

    default:
      return state;
  }
}
