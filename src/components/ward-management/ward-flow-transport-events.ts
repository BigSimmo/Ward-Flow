import { numberedBedKind } from "./ward-bed-designation";
import { finiteInstant, type AuditDecision } from "./ward-audit";
import { journeySentByKind } from "@/components/ward-management/ward-journey-sender";
import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import {
  CANCEL_TRANSPORT_REASONS,
  GENDER_NO_LONGER_SUITS_REFUSAL,
  STOP_TRANSPORT_REASONS,
  TRANSPORT_WHEREABOUTS,
} from "@/components/ward-management/ward-change-reasons";
import { cadNumberProblem } from "@/components/ward-management/ward-cad-number";
import { adjustSexMix, eligibility, mixSexOf } from "@/components/ward-management/ward-eligibility";
import { heldUnitAuthorisationRefusal } from "@/components/ward-management/ward-held-legal-check";
import { type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { ARRIVAL_LATE_AFTER_MINUTES, isArrivalLate } from "@/components/ward-management/ward-legal-clock";
import {
  MOVEMENT_STAGES,
  TRANSPORT_LEGAL_STATUSES,
  TRANSPORT_PROVIDERS,
  type Movement,
  type MovementArrivalDetails,
  type Notice,
  type Unit,
} from "@/components/ward-management/ward-model";
import { stageCopy } from "@/components/ward-management/ward-stage-copy";
import { transportExceptionRecord } from "@/components/ward-management/ward-transport-checks";
import { movementBedReservation } from "./ward-movement-bed-hold";
import type { TransportEventHelpers, WardFlowState } from "./ward-flow-reducer";

/**
 * Handover, transport and arrival: `reduceClinicalEvent`'s cases for these events, moved here
 * unchanged. The reducer passes its helpers in, since this file may not import the reducer at run
 * time.
 */
export type TransportEvent = Extract<
  WardFlowEvent,
  {
    type:
      | "HANDOVER_READY"
      | "TRANSPORT_ACCEPTED"
      | "TRANSPORT_EN_ROUTE"
      | "PATIENT_COLLECTED"
      | "PATIENT_ARRIVED"
      | "BOOK_TRANSPORT"
      | "CANCEL_TRANSPORT"
      | "STOP_TRANSPORT"
      | "SET_ARRIVAL_DETAILS"
      | "EVALUATE_ARRIVAL_LATENESS";
  }
>;

export function reduceTransportEvent(
  state: WardFlowState,
  event: TransportEvent,
  decision: AuditDecision,
  helpers: TransportEventHelpers,
): WardFlowState {
  const {
    STAGE_TRANSITION_BLOCKERS,
    appendNotices,
    bedNumberRefusal,
    heldBedRefusal,
    departAdmission,
    findAdmission,
    findMovement,
    findReferral,
    findUnit,
    heldUnitGenderRefusal,
    makeNotice,
    movementHoldsBedByStage,
    movementSourceAdmission,
    reject,
    replaceAdmission,
    replaceMovement,
    replaceReferral,
    replaceUnit,
  } = helpers;
  switch (event.type) {
    case "HANDOVER_READY": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // D-80: a ward or team acts here only on a journey its kind of desk sent (scope is the server's).
      if (!journeySentByKind(state.referrals, movement, event.role)) {
        return reject(state, event, `only the desk that sent movement ${movement.id} may ready its handover`);
      }
      if (movement.closure) {
        return reject(state, event, `cannot ready a handover for a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "pulled") {
        return reject(
          state,
          event,
          `cannot ready a handover at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      /**
       * Handover ready requires a booked transport (or a recorded "no transport needed"); nothing
       * here invents a job, provider or escort answer. Escort is a fact the sending team knows and
       * books (TR-D1).
       */
      const noTransportNeeded = (movement.transportNeed?.needed ?? movement.transport?.needed) === false;
      if (!movement.transport && !noTransportNeeded) {
        return reject(state, event, `cannot ready a handover before transport is booked (BOOK_TRANSPORT)`);
      }
      // P1-3: re-run at every forward step while a bed is held; see `heldUnitGenderRefusal`.
      const handoverGenderRefusal = heldUnitGenderRefusal(state, movement, event.now);
      if (handoverGenderRefusal) return reject(state, event, handoverGenderRefusal);
      // Audit 2 E-03: the same re-check for a legal status change since the bed was held.
      const handoverLegalRefusal = heldUnitAuthorisationRefusal(state, movement);
      if (handoverLegalRefusal) return reject(state, event, handoverLegalRefusal);
      const updated: Movement = {
        ...movement,
        stage: "handover_ready",
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: "handover_ready", by: event.role },
        ],
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "TRANSPORT_ACCEPTED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot accept transport for a closed movement (${movement.closure.reason})`);
      }

      // WLQ-4: do not advance the transport pathway while a revoked or community_order examination
      // still holds a bed. PATIENT_ARRIVED stays reachable (owner answer 5).
      {
        const examinationOutcome = movement.examination?.outcome;
        const examinationRevokedHoldingBed =
          (examinationOutcome === "community_order" || examinationOutcome === "revoked") &&
          movementHoldsBedByStage(movement);
        const awaitingRelease = movement.blocker === STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease;
        if (examinationRevokedHoldingBed || awaitingRelease) {
          return reject(
            state,
            event,
            `cannot advance transport for movement ${movement.id}: the examination was revoked and the bed is still pulled — a coordinator must release the bed first`,
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
      // Instant 0 is a recorded midnight, not "unset" — never truthiness-check timestamps.
      if (movement.transport.acceptedAt !== undefined) {
        return reject(state, event, `transport for movement ${movement.id} was already accepted`);
      }
      // P1-3 (Ward Lead ruling, 17 September 2026) — see `heldUnitGenderRefusal`'s own doc comment.
      const transportAcceptedGenderRefusal = heldUnitGenderRefusal(state, movement, event.now);
      if (transportAcceptedGenderRefusal) return reject(state, event, transportAcceptedGenderRefusal);
      // Audit 2 E-03: the same re-check for a legal status change since the bed was held.
      const transportAcceptedLegalRefusal = heldUnitAuthorisationRefusal(state, movement);
      if (transportAcceptedLegalRefusal) return reject(state, event, transportAcceptedLegalRefusal);
      const updated: Movement = {
        ...movement,
        transport: { ...movement.transport, acceptedAt: event.now },
        // The provider has answered, so "Awaiting a transport provider response" is contradicted by
        // `acceptedAt` beside it.
        blocker: STAGE_TRANSITION_BLOCKERS.transportAccepted,
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "TRANSPORT_EN_ROUTE": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot move transport for a closed movement (${movement.closure.reason})`);
      }

      // WLQ-4: do not advance the transport pathway while a revoked or community_order examination
      // still holds a bed. PATIENT_ARRIVED stays reachable (owner answer 5).
      {
        const examinationOutcome = movement.examination?.outcome;
        const examinationRevokedHoldingBed =
          (examinationOutcome === "community_order" || examinationOutcome === "revoked") &&
          movementHoldsBedByStage(movement);
        const awaitingRelease = movement.blocker === STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease;
        if (examinationRevokedHoldingBed || awaitingRelease) {
          return reject(
            state,
            event,
            `cannot advance transport for movement ${movement.id}: the examination was revoked and the bed is still pulled — a coordinator must release the bed first`,
          );
        }
      }
      /**
       * The message reports the two facts the guard checks rather than naming one as the cause: at
       * stage `moving`, `transport.acceptedAt` is already set. Do not restore the removed wording,
       * even quoted.
       *
       * Instant 0 is a recorded midnight — compare with `=== undefined`, never truthiness.
       */
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
        // The vehicle is moving. Still an active blocker: nobody has been collected.
        blocker: STAGE_TRANSITION_BLOCKERS.transportEnRoute,
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "PATIENT_COLLECTED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot collect a patient for a closed movement (${movement.closure.reason})`);
      }
      // T9 (owner answer 5): while a withdrawn or revoked examination still holds the bed,
      // collection is refused until someone releases the bed or records a repeat examination.
      // `PATIENT_ARRIVED` must stay reachable. Inlines `examinationRevokedWhileBedHeld`
      // (`ward-derivations.ts`) to avoid a circular import.
      const examinationOutcome = movement.examination?.outcome;
      const examinationRevokedHoldingBed =
        (examinationOutcome === "community_order" || examinationOutcome === "revoked") &&
        movementHoldsBedByStage(movement);
      const awaitingRelease = movement.blocker === STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease;
      if (examinationRevokedHoldingBed || awaitingRelease) {
        return reject(
          state,
          event,
          `cannot collect a patient for movement ${movement.id}: the examination was revoked and this movement still holds a bed — a person must release the bed first`,
        );
      }
      /**
       * As for `TRANSPORT_EN_ROUTE`: at `moving`, `enRouteAt` is already set, so the message
       * reports the facts checked rather than a cause.
       *
       * Instant 0 is a recorded midnight — compare with `=== undefined`, never truthiness.
       */
      if (movement.stage !== "handover_ready" || movement.transport?.enRouteAt === undefined) {
        return reject(
          state,
          event,
          `cannot collect a patient: the movement must be at ${stageCopy.handover_ready.label} ` +
            `with transport en route (it is at ${stageCopy[movement.stage].label}, transport ` +
            `${movement.transport?.enRouteAt !== undefined ? "en route" : "not en route"})`,
        );
      }
      // P1-3 (Ward Lead ruling, 17 September 2026) — see `heldUnitGenderRefusal`'s own doc comment.
      // The last of the four re-checks: `PATIENT_ARRIVED` deliberately has none.
      const collectedGenderRefusal = heldUnitGenderRefusal(state, movement, event.now);
      if (collectedGenderRefusal) return reject(state, event, collectedGenderRefusal);
      // Audit 2 E-03: the same re-check for a legal status change since the bed was held.
      const collectedLegalRefusal = heldUnitAuthorisationRefusal(state, movement);
      if (collectedLegalRefusal) return reject(state, event, collectedLegalRefusal);
      // Audit fix (13 Oct 2026): collected with a check open (no Form 4A, no clearance) records why.
      const collectedException =
        event.exception === undefined
          ? undefined
          : transportExceptionRecord(event.exception, event.now, event.role, "collected");
      if (typeof collectedException === "string")
        return reject(state, event, `PATIENT_COLLECTED ${collectedException}`);
      const updated: Movement = {
        ...movement,
        stage: "moving",
        transport: {
          ...movement.transport,
          collectedAt: movement.transport.collectedAt ?? event.now,
          ...(collectedException ? { exceptions: [...(movement.transport.exceptions ?? []), collectedException] } : {}),
        },
        // Nothing is blocking a patient who is in a vehicle — and the SEED already says so in these
        // exact words on its two `moving` movements. Reused verbatim rather than reworded.
        blocker: STAGE_TRANSITION_BLOCKERS.collected,
        // A stage correction can keep the original physical collection fact. Restoring the
        // recorded stage is a new entry, not a second collection at a later time.
        stageChanges: [
          ...movement.stageChanges,
          {
            at: event.now,
            from: movement.stage,
            to: "moving",
            by: event.role,
            ...(movement.transport.collectedAt === undefined ? {} : { reason: "Restored after stage correction" }),
          },
        ],
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "PATIENT_ARRIVED": {
      // Refuse a non-finite `now` before any other logic, so NaN never reaches `closure.at`,
      // `transport.arrivedAt` or `stageChanges`.
      if (finiteInstant(event.now) === null) {
        return reject(state, event, "PATIENT_ARRIVED now must be a finite instant");
      }
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot arrive a patient for a closed movement (${movement.closure.reason})`);
      }
      if (movement.transport?.diversion) {
        return reject(
          state,
          event,
          `movement ${movement.id} was diverted; use RELEASE_DIVERTED_BED rather than recording arrival`,
        );
      }
      // Owner answer 10: "'No transport needed' is recorded at pull, booking is skipped, and the
      // ward records the arrival." When a person recorded no transport is needed and no live job
      // exists, the ward may record arrival straight from `pulled`. Both halves are required: a
      // live (uncancelled) job means the ordinary chain applies, whatever the need flag says (audit
      // §3 item 4).
      const liveTransportJob = movement.transport !== undefined && movement.transport.cancelledAt === undefined;
      const noTransportNeeded =
        (movement.transportNeed?.needed ?? movement.transport?.needed) === false &&
        !liveTransportJob &&
        movement.transport?.collectedAt === undefined;
      // Audit r1 item 4: arrival with no transport leg and fit to travel open records why.
      const arrivalException =
        event.exception === undefined
          ? undefined
          : transportExceptionRecord(event.exception, event.now, event.role, "arrived");
      if (typeof arrivalException === "string") return reject(state, event, `PATIENT_ARRIVED ${arrivalException}`);
      if (noTransportNeeded) {
        if (movement.stage !== "pulled" && movement.stage !== "handover_ready") {
          return reject(
            state,
            event,
            `cannot arrive a patient with no transport needed at the movement's current stage (${stageCopy[movement.stage].label}); the bed must be pulled first`,
          );
        }
      } else if (movement.stage !== "moving" || movement.transport?.collectedAt === undefined) {
        return reject(
          state,
          event,
          `cannot arrive a patient at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      if (!movement.acceptedUnitId) {
        return reject(state, event, `movement ${movement.id} has no accepted destination unit`);
      }
      // A `ward` caller with no `actingUnitId` is refused outright, as `BOOK_TRANSPORT` and
      // `CANCEL_TRANSPORT` do.
      if (event.role === "ward" && !event.actingUnitId) {
        return reject(
          state,
          event,
          `PATIENT_ARRIVED raised as ward must state its actingUnitId, and it has no default`,
        );
      }
      if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId) {
        return reject(
          state,
          event,
          `ward ${event.actingUnitId} cannot confirm arrival for a patient accepted at ${movement.acceptedUnitId}`,
        );
      }
      const unit = findUnit(state, movement.acceptedUnitId);
      if (!unit) return reject(state, event, `no unit found for id ${movement.acceptedUnitId}`);

      /**
       * A4-16 (Josh): the receiving ward closes the transfer on arrival and handover. The officer's
       * Delivered ends the transport leg only: it records `transport.arrivedAt` and leaves the
       * movement open at `moving`. The ward (or coordinator) then confirms arrival with this same
       * event.
       */
      if (event.role === "officer") {
        // Master plan 5.2 random run: with no transport needed there is no leg to deliver, and
        // Delivered used to be accepted as a silent no-op. The officer screen already refuses it.
        if (noTransportNeeded) {
          return reject(state, event, "No transport leg to deliver; the receiving ward confirms arrival");
        }
        if (movement.transport?.arrivedAt !== undefined) {
          return reject(
            state,
            event,
            `transport for movement ${movement.id} was already delivered; the receiving ward confirms arrival`,
          );
        }
        return replaceMovement(state, movement.id, {
          ...movement,
          transport: movement.transport && { ...movement.transport, arrivedAt: event.now },
        });
      }

      const patientId =
        movement.patientId ??
        state.referrals.find((r) => r.id === movement.referralId)?.patientId ??
        (movement.admissionId ? findAdmission(state, movement.admissionId)?.patientId : undefined);
      const source = movementSourceAdmission(state, movement);
      if (
        (movement.sourceAdmissionId && !source) ||
        (source && (source.state !== "occupied" || source.patientId !== patientId || source.unitId === unit.id))
      ) {
        return reject(
          state,
          event,
          "Repatriation arrival needs the patient's occupied source stay at a different ward.",
        );
      }
      if (
        patientId &&
        state.admissions.some(
          (a) =>
            a.patientId === patientId &&
            (a.state === "pulled" || a.state === "occupied") &&
            a.id !== movement.admissionId &&
            a.id !== source?.id,
        )
      ) {
        return reject(state, event, "This patient already holds another bed or occupies another ward.");
      }
      const linkedAdmission =
        movement.admissionId === undefined ? undefined : findAdmission(state, movement.admissionId);
      if (
        movement.admissionId !== undefined &&
        (!linkedAdmission ||
          linkedAdmission.state !== "pulled" ||
          linkedAdmission.unitId !== unit.id ||
          (linkedAdmission.movementId !== movement.id &&
            !(linkedAdmission.movementId === null && !linkedAdmission.id.startsWith("AD-ARR-"))) ||
          (patientId !== undefined && linkedAdmission.patientId !== patientId))
      ) {
        return reject(state, event, "Arrival needs this movement's matching held admission at its accepted ward.");
      }
      const { referralArm: heldReferral, bedNumber: reservedBed } = movementBedReservation(
        movement,
        state.referrals,
        unit.id,
      );
      // The patient lands in the bed held for them; if that bed has since been taken they still
      // arrive, with no bed recorded, rather than being refused at the door.
      const heldBed = reservedBed ?? linkedAdmission?.bedNumber;
      const heldBedNumber =
        heldBed !== undefined &&
        bedNumberRefusal(state, unit, heldBed, linkedAdmission?.id) === null &&
        heldBedRefusal(state, unit, heldBed, movement.id, movement.referralId) === null &&
        linkedAdmission?.bedKind === numberedBedKind(unit, heldBed)
          ? heldBed
          : undefined;
      // A seeded pulled stay (`movementId` null) is already counted as a taken bed and in the sex
      // mix (`bedStates`), so its arrival takes no second bed. Before this, arriving one moved
      // Occupied up by two and Ready down by one (release gate, 15 Oct 2026).
      const bedAlreadyCounted = linkedAdmission?.movementId === null;
      const isBedTurnaround = !bedAlreadyCounted && unit.empty.value <= 0;

      // Owner ruling 2026-09-25: occupant counts follow gender (recorded sex for a non-binary person).
      const arriverSex = mixSexOf(movement.gender, movement.sex);
      const countedSex =
        linkedAdmission === undefined ? arriverSex : mixSexOf(linkedAdmission.gender, linkedAdmission.sex);
      const updatedSexMix =
        bedAlreadyCounted && countedSex !== arriverSex
          ? adjustSexMix(adjustSexMix(unit.sexMix, countedSex, -1), arriverSex, 1)
          : bedAlreadyCounted
            ? unit.sexMix
            : adjustSexMix(unit.sexMix, arriverSex, 1);

      /*
       * A no-transport arrival jumps from `pulled` or `handover_ready` straight here and skips
       * `HANDOVER_READY`, `TRANSPORT_ACCEPTED` and `PATIENT_COLLECTED`, which already call
       * `heldUnitGenderRefusal`. Re-ask only `gender_designation` on that shortcut, using the same
       * refusal those steps use. Do not call the full helper: its placement-record check would
       * refuse a non-binary arrival on an undesignated ward, which the 2026-09-25 sex-mix ruling
       * still counts under recorded sex.
       *
       * A patient already `moving` is not refused here. `heldUnitGenderRefusal` documents why:
       * blocking arrival strands someone already in transit, and `RECORD_MOVEMENT_GENDER` has
       * already notified the coordinator.
       */
      if (movement.stage !== "moving") {
        const genderGate = eligibility(movement, unit, event.now).gates.find(
          (gate) => gate.gate === "gender_designation",
        );
        if (genderGate && !genderGate.pass) {
          return reject(state, event, GENDER_NO_LONGER_SUITS_REFUSAL);
        }
        // Audit 2 E-03: the no-transport shortcut skips the three steps above, so re-ask the legal
        // status check here too. Never once moving: arrival is always recorded.
        const arrivalLegalRefusal = heldUnitAuthorisationRefusal(state, movement);
        if (arrivalLegalRefusal) return reject(state, event, arrivalLegalRefusal);
      }

      const updatedUnit: Unit = {
        ...unit,
        empty: bedAlreadyCounted ? unit.empty : { ...unit.empty, value: Math.max(0, unit.empty.value - 1) },
        sexMix: updatedSexMix,
        ...(isBedTurnaround
          ? {
              arrivalCapacityConflicts: [
                ...(unit.arrivalCapacityConflicts ?? []),
                {
                  movementId: movement.id,
                  ...((movement.admissionId ?? linkedAdmission?.id) === undefined
                    ? {}
                    : { admissionId: movement.admissionId ?? linkedAdmission?.id }),
                  at: event.now,
                },
              ],
            }
          : {}),
      };
      const { heldBedNumber: _heldBedNumber, ...movementWithoutHeldBed } = movement;
      void _heldBedNumber;
      const updatedMovement: Movement = {
        ...movementWithoutHeldBed,
        stage: "arrived",
        // A cancelled job may still sit on `movement.transport`; this route never writes
        // `arrivedAt` onto it.
        transport:
          movement.transport === undefined || noTransportNeeded
            ? movement.transport
            : { ...movement.transport, arrivedAt: movement.transport.arrivedAt ?? event.now },
        ...(arrivalException ? { arrivalException } : {}),
        closure: {
          at: event.now,
          outcome: "arrived",
          reason: noTransportNeeded
            ? "Patient arrived at the accepting unit (no transport needed)"
            : "Patient arrived at the accepting unit",
        },
        // When empty beds are exhausted, arrival enters a holding state awaiting bed turnaround.
        blocker: isBedTurnaround ? "Arrived — Bed Turnaround" : STAGE_TRANSITION_BLOCKERS.arrived,
        // `closure.at` above agrees with this entry's `at` — see `StageChange`'s doc comment.
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: "arrived", by: event.role },
        ],
      };
      const withUnit = replaceUnit(state, unit.id, updatedUnit);
      /**
       * The only event that may write `arrivedAt` (owner ruling: "a patient is not marked as
       * arrived until the ward says they have arrived."). The person becomes `occupied` and the
       * stay clock starts.
       *
       * The admission is looked up by id, never by unit and state: two people pulled to one ward is
       * ordinary. A hand-authored seed movement has no `admissionId`; no occupant is fabricated for
       * it.
       */
      const pulledAdmission =
        movement.admissionId === undefined ? undefined : findAdmission(withUnit, movement.admissionId);
      let withPerson: WardFlowState;
      // Audit §3 items 2, 5, 6: an absent admission is left alone, never invented.
      if (pulledAdmission && pulledAdmission.state === "pulled") {
        const { bedNumber: _previousNumber, ...withoutBedNumber } = pulledAdmission;
        void _previousNumber;
        withPerson = replaceAdmission(withUnit, pulledAdmission.id, {
          ...withoutBedNumber,
          state: "occupied",
          gender: movement.gender,
          arrivedAt: event.now,
          ...(heldBedNumber === undefined ? {} : { bedNumber: heldBedNumber }),
          ...(isBedTurnaround ? { blockReason: "Awaiting clean" } : {}),
        });
      } else {
        withPerson = withUnit;
      }
      /*
       * A repatriation or recorded ward transfer carries the sending stay (via
       * `sourceAdmissionId` or a psychiatric-ward referral). Arrival at the receiving ward ends
       * that stay as a transfer, so one person never holds a bed at both hospitals. A stay that
       * has already left (or has gone) is left alone.
       */
      const sendingUnit = source ? findUnit(withPerson, source.unitId) : undefined;
      if (source && sendingUnit && source.state === "occupied") {
        withPerson = departAdmission(
          withPerson,
          source,
          sendingUnit,
          event.now,
          "transferred-to-another-psychiatric-ward",
          event.role,
        );
      }
      if (heldReferral && movement.referralId) {
        const referral = findReferral(withPerson, movement.referralId);
        if (referral) {
          withPerson = replaceReferral(withPerson, referral.id, {
            ...referral,
            destinations: referral.destinations.map((arm) => {
              if (
                arm.state !== "accepted" ||
                arm.heldBedNumber === undefined ||
                arm.destination.kind !== "psychiatric_ward" ||
                (arm.acceptedUnitId ?? arm.destination.unitId) !== unit.id
              )
                return arm;
              const { heldBedNumber: _heldBed, ...releasedArm } = arm;
              void _heldBed;
              return releasedArm;
            }),
          });
        }
      }
      return replaceMovement(withPerson, movement.id, updatedMovement);
    }

    case "BOOK_TRANSPORT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot book transport for a closed movement (${movement.closure.reason})`);
      }
      // Owner answer 30: "no automatic rebooking; a person books again", including from
      // `handover_ready`, since `CANCEL_TRANSPORT` now removes the job in every case.
      if (movement.stage !== "pulled" && movement.stage !== "handover_ready") {
        return reject(
          state,
          event,
          `cannot book transport at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      // A second booking would replace a job a provider may already have accepted, and the
      // acceptance timestamps would vanish with it. Cancel first (`CANCEL_TRANSPORT`), then rebook.
      if (movement.transport && movement.transport.cancelledAt === undefined) {
        return reject(state, event, `transport for movement ${movement.id} is already booked`);
      }
      if (!TRANSPORT_PROVIDERS.includes(event.provider)) {
        return reject(state, event, `BOOK_TRANSPORT provider must be chosen from TRANSPORT_PROVIDERS`);
      }
      // A missing escort answer is refused, never defaulted: `false` would claim "no escort
      // required" as though a clinician said so (TR-D1). `typeof`, because the payload may arrive
      // from JavaScript.
      if (typeof event.escortRequired !== "boolean") {
        return reject(state, event, `BOOK_TRANSPORT escortRequired must be answered, and it has no default`);
      }
      // Owner's third ruling: this logs a booking already made by phone, and the three facts from
      // that call are required, never defaulted.
      if (typeof event.cadNumber !== "string" || event.cadNumber.trim().length === 0) {
        return reject(state, event, `BOOK_TRANSPORT cadNumber must be answered, and it has no default`);
      }
      // HAZ-03 (#430): a placeholder or free text is not a dispatch number. Same rule as the forms.
      const cadProblem = cadNumberProblem(event.cadNumber);
      if (cadProblem !== undefined) {
        return reject(state, event, `BOOK_TRANSPORT cadNumber refused: ${cadProblem}`);
      }
      if (!TRANSPORT_LEGAL_STATUSES.includes(event.transportLegalStatus)) {
        return reject(state, event, `BOOK_TRANSPORT transportLegalStatus must be chosen from TRANSPORT_LEGAL_STATUSES`);
      }
      if (typeof event.estimatedAt !== "number" || !Number.isFinite(event.estimatedAt)) {
        return reject(state, event, `BOOK_TRANSPORT estimatedAt must be answered, and it has no default`);
      }
      // WLQ-11 (owner): a `ward` booker must state its unit now, so `CANCEL_TRANSPORT` can later
      // tell the booking ward from any other.
      if (event.role === "ward" && !event.actingUnitId) {
        return reject(state, event, `BOOK_TRANSPORT raised as ward must state its actingUnitId, and it has no default`);
      }
      // The claimed unit must be real, or `bookedBy.unitId` could never match a later cancellation
      // claim.
      if (event.role === "ward" && event.actingUnitId !== undefined && !findUnit(state, event.actingUnitId)) {
        return reject(state, event, `BOOK_TRANSPORT actingUnitId ${event.actingUnitId} does not name a real unit`);
      }
      if (event.role === "ward" && event.actingUnitId !== undefined) {
        const referral = movement.referralId ? findReferral(state, movement.referralId) : undefined;
        // The stay a journey leaves names its sender first, as in the access check (review on PR #617).
        const sendingWard =
          movementSourceAdmission(state, movement)?.unitId ??
          referral?.originUnitId ??
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
      // Owner's third ruling (answer 9): "only the community team that booked transport may cancel
      // it", so a `community` booker states its place now.
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
      if (event.role === "ed" && event.actingPlaceId !== undefined && event.actingPlaceId !== movement.originEdId) {
        return reject(
          state,
          event,
          `${event.type} was raised acting as ED ${event.actingPlaceId} but movement origin is ${movement.originEdId ?? "a community team"}; only the origin ED can book or record transport for its own movement`,
        );
      }
      // The job id counts prior cancellations from `unwinds` (append-only), so a re-booking after a
      // no-bed-held cancellation never reuses an earlier job's id. Deterministic; with no prior
      // cancellation the id stays `${movement.id}-transport`.
      const priorTransportCancellations = movement.unwinds.filter(
        (entry) => entry.kind === "transport_cancelled",
      ).length;
      // Audit fix (13 Oct 2026): a booking whose status differs from Legal now records why.
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
          // Owner's third ruling, 2026-09-17: the phone-logged facts, required and stored exactly
          // as answered — see each field's own doc comment on `TransportJob` (`ward-model.ts`).
          cadNumber: event.cadNumber,
          transportLegalStatus: event.transportLegalStatus,
          estimatedAt: event.estimatedAt,
          ...(bookingException ? { exceptions: [bookingException] } : {}),
          // Carried forward from RECORD_TRANSPORT_NEED so the "no transport needed" branches read a
          // runtime-booked job as they read a seeded one.
          needed: movement.transportNeed?.needed,
          // WLQ-11 / third ruling: who booked this job. See `TransportJob.bookedBy`.
          bookedBy: {
            role: event.role,
            ...(event.role === "ward" ? { unitId: event.actingUnitId } : {}),
            ...(event.role === "community" ? { placeId: event.actingPlaceId } : {}),
            ...(event.role === "ed" && event.actingPlaceId ? { placeId: event.actingPlaceId } : {}),
          },
        },
        // A job exists and the provider has not answered. Provider and escort are on the job
        // itself, so they are not restated here.
        blocker: STAGE_TRANSITION_BLOCKERS.transportBooked,
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
      /**
       * TR-D6 (owner): a transport may be cancelled by the team that booked it and by the
       * coordinator, never by the receiving ward. WLQ-11 (owner): "whoever booked transport may
       * cancel it; the receiving ward still may not." A `ward` caller's claim is compared against
       * `transport.bookedBy` (claim-not-proof); an absent `bookedBy` refuses. Coordinator and `ed`
       * rights are unconditional. `community` gets the same check against `bookedBy.placeId` just
       * below.
       */
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
      // Owner's third ruling (answer 9): "only the community team that booked transport may cancel
      // it." Refused when the claim does not match, including when `bookedBy` has no `placeId`.
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
        /**
         * Runtime membership, not merely the type: a type-only guarantee passes `vitest run` with
         * no `tsc` involved. TR-D6 says the reason must not become optional.
         */
        return reject(state, event, `CANCEL_TRANSPORT reason must be chosen from CANCEL_TRANSPORT_REASONS`);
      }
      // Never closes the movement: only the transport job unwinds, and the bed is untouched. The
      // cancelled job stays named in the audit trail.
      //
      // The stage is left exactly as found in every reachable case: unwinding a job never changes
      // where the patient sits in the pathway (`STEP_BACK_STAGE` and `RELEASE_PULL` can leave a
      // booked job at `accepted_awaiting_bed`; see `tests/ward-cancel-transport-stage.test.ts`).
      //
      // Owner answer 30: "Cancelling transport while a bed is held: no automatic rebooking; a
      // person books again." Both branches remove the job
      // (`tests/ward-transport-cancel-no-rebook.test.ts`,
      // `tests/ward-cancel-transport-no-bed-held.test.ts`); `BOOK_TRANSPORT` accepts a new booking
      // from `pulled` or `handover_ready`.
      const cancelledTransport = movement.transport;
      // WFA-001: same OR as `releasePulledBedAndAdmission`: a stepped-back movement can hold its
      // admission and bed before `pulled`.
      const bedIsHeld =
        movement.admissionId !== undefined ||
        MOVEMENT_STAGES.indexOf(movement.stage) >= MOVEMENT_STAGES.indexOf("pulled");
      const updatedMovement: Movement = {
        ...movement,
        // `stage` is deliberately not written: cancelling never moves the stage. No branch replaces
        // the job: an absent job is "nothing to flag" for `orphanedTransport` and lets
        // `BOOK_TRANSPORT` succeed again.
        transport: undefined,
        // The job is gone, so a provider-progress sentence is now false. Bed held:
        // `transportCancelled` (still held, not booked again). No bed: as at first acceptance.
        blocker: bedIsHeld ? STAGE_TRANSITION_BLOCKERS.transportCancelled : STAGE_TRANSITION_BLOCKERS.accepted,
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
        // No entry appended: `stage` never moves here, so a transition would misstate this
        // cancellation.
        stageChanges: movement.stageChanges,
      };
      const next = replaceMovement(state, movement.id, updatedMovement);
      /**
       * Addendum §1.3: "CANCEL_TRANSPORT — the officer and the receiving ward — somebody is
       * expecting a person who is no longer coming." Two notices, each its own `NoticeKind`. The
       * officer is always told; the receiving ward is `movement.acceptedUnitId`, guarded rather
       * than asserted.
       *
       * Owner answer 30: nothing arranges a replacement on either branch, so each sentence states
       * only that the job was cancelled and nothing has been rebooked. Wording from
       * `docs/ward-flow/plans/2026-09-17-build-plan-referrals-transport.md` §4, T1.
       */
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

    /**
     * The referrer or coordinator stops a collected journey (WLQ-38; see `ward-flow-events.ts`).
     * `EVENT_ROLE.STOP_TRANSPORT` already restricts the caller, so the role is not re-checked.
     */
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
      // Belt and braces: `PATIENT_ARRIVED` sets `arrivedAt` and `closure` together, so this fires
      // only if that invariant breaks.
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
        // Runtime membership, not merely the type — the same discipline every other reason-carrying
        // event in this file holds to, because `vitest run` alone involves no `tsc`.
        return reject(state, event, `STOP_TRANSPORT reason must be chosen from STOP_TRANSPORT_REASONS`);
      }
      if (!TRANSPORT_WHEREABOUTS.includes(event.whereabouts)) {
        // Item 31 (T3): runtime membership, since `vitest run` alone involves no `tsc`.
        return reject(state, event, `STOP_TRANSPORT whereabouts must be chosen from TRANSPORT_WHEREABOUTS`);
      }

      // Owner answer 8: the bed no longer comes back automatically. `acceptedUnitId` and
      // `admissionId` stay as they are until `RELEASE_HELD_BED`.
      const stoppedTransport = movement.transport;
      const stopped: Movement = {
        ...movement,
        transport: {
          ...stoppedTransport,
          // `cancelledAt` is the general "this job is over" signal other readers understand; the
          // `stopped*` fields record who stopped it, why and where the patient is. See
          // `TransportJob`.
          cancelledAt: event.now,
          stoppedAt: event.now,
          stoppedBy: event.role,
          stopReason: event.reason,
          stoppedWhereabouts: event.whereabouts,
        },
        closure: {
          at: event.now,
          outcome: "did_not_proceed",
          // `STOP_TRANSPORT_REASONS` members are already full sentences, so the reason is the
          // closure reason.
          reason: event.reason,
        },
        // Active: the journey is over but the bed is held pending a release decision. Supersedes
        // WLQ-4's `examinationRevokedAwaitingRelease` for the same bed.
        blocker: STAGE_TRANSITION_BLOCKERS.transportStoppedAwaitingRelease,
      };
      const next = replaceMovement(state, movement.id, stopped);
      // Addendum §1.3, extended by WLQ-38 and item 31: the officer is always told where the patient
      // now is, and the receiving ward, if any, that the patient is not coming.
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

    case "SET_ARRIVAL_DETAILS": {
      const movement = state.movements.find((m) => m.id === event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, "cannot update arrival details on closed movement");
      }
      // Audit 2 E-13: arrival plans belong to a ward that has said yes; before that there is no
      // destination to arrive at.
      if (movement.acceptedUnitId === undefined) {
        return reject(state, event, "Arrival details need a ward that has accepted this patient.");
      }
      // A ward must name itself, so the shared backend can check that desk is the receiving ward
      // and not the sending one (review on PR #365).
      if (
        event.role === "ward" &&
        (event.actingUnitId === undefined || event.actingUnitId !== movement.acceptedUnitId)
      ) {
        return reject(
          state,
          event,
          `SET_ARRIVAL_DETAILS was raised acting as unit ${event.actingUnitId} but destination is unit ${movement.acceptedUnitId}; only destination ward or coordinator can set arrival details`,
        );
      }

      // The first recording keeps its time and role; a later edit is stamped as an update, so the
      // ED timeline, chronology and pilot measures never read the latest edit as the first.
      const firstRecording = movement.arrivalDetails;
      const arrivalDetails: MovementArrivalDetails = {
        mode: event.arrivalMode,
        trackingNumber: event.trackingNumber?.trim() || undefined,
        estimatedArrivalAt: event.estimatedArrivalAt,
        recordedAt: firstRecording?.recordedAt ?? event.now,
        recordedBy: firstRecording?.recordedBy ?? event.role,
        ...(firstRecording ? { updatedAt: event.now, updatedBy: event.role } : {}),
      };

      let updatedMovement: Movement = {
        ...movement,
        // Audit 2 E-13 (Josh, 20 Oct 2026): the bed-hold timer is kept. An arrival plan is not an
        // arrival, and only a person releases or moves a held bed.
        arrivalDetails,
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

    default: {
      // Sub-reducer slice narrowed via `Extract<WardFlowEvent, ...>`; ensure every TransportEvent case is handled.
      const _exhaustive: never = event;
      void _exhaustive;
      return state;
    }
  }
}
