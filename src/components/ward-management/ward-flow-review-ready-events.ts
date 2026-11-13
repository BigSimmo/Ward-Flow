import type { AuditDecision } from "./ward-audit";
import type { Instant } from "./ward-clock";
import type { WardFlowRole } from "./ward-flow-roles";
import type { findMovement, findUnit, reject, replaceMovement, replaceUnit, WardFlowState } from "./ward-flow-reducer";
import { PSYCH_REVIEW_GRADES, type PsychReviewGrade } from "./ward-model-movement-parts";
import type { Unit } from "./ward-model";
import { reduceEscalationCall, type EscalationCallEvent } from "./escalation/escalation-calls";

/**
 * PSYCHIATRY REVIEW TRACKER AND WARD READY FOR NEXT PATIENT (Josh, 9 Nov 2026). Records times as a
 * person states them. Nothing here scores, ranks, re-orders or places anyone, and nothing happens
 * by itself: the coordinator still chooses and pulls by hand.
 */
export type ReviewReadyWardFlowEvent =
  // Escalation calls (item 3, D-133): an ED wait step's call and outcome, declared in its own file and
  // joined here so `ward-flow-events.ts` and the reducer stay under their line caps.
  | EscalationCallEvent
  | {
      /** The emergency department has asked for a psychiatric review. A time only. */
      type: "REQUEST_PSYCH_REVIEW";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
    }
  | {
      /** The registrar or the consultant has seen the person for the review asked for. */
      type: "RECORD_PSYCH_REVIEW_SEEN";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      grade: PsychReviewGrade;
    }
  | {
      /** The ward says it is ready for its next patient, or with `cancel` takes that back. */
      type: "MARK_WARD_READY_FOR_NEXT";
      role: WardFlowRole;
      now: Instant;
      unitId: string;
      /** The ward's own claim, refused when it is not `unitId`. Absent for the coordinator. */
      actingUnitId?: string;
      cancel?: true;
    };

export type ReviewReadyHelpers = {
  findMovement: typeof findMovement;
  findUnit: typeof findUnit;
  reject: typeof reject;
  replaceMovement: typeof replaceMovement;
  replaceUnit: typeof replaceUnit;
};

export function reduceReviewReadyEvent(
  state: WardFlowState,
  event: ReviewReadyWardFlowEvent,
  decision: AuditDecision,
  { findMovement, findUnit, reject, replaceMovement, replaceUnit }: ReviewReadyHelpers,
): WardFlowState {
  if (event.type === "RECORD_ESCALATION_CALL")
    return reduceEscalationCall(state, event, reject, { findMovement, replaceMovement });
  const accept = () => {
    decision.outcome = "accepted";
    decision.reasonCode = "none";
  };
  // Every event here writes `event.now` into the record, so a non-finite time never gets that far.
  if (!Number.isFinite(event.now)) return reject(state, event, `${event.type} requires a finite current time`);
  switch (event.type) {
    case "REQUEST_PSYCH_REVIEW": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) return reject(state, event, "This movement is closed.");
      if (movement.psychReview) return reject(state, event, "A psychiatric review is already asked for.");
      accept();
      return replaceMovement(state, movement.id, { ...movement, psychReview: { requestedAt: event.now } });
    }
    case "RECORD_PSYCH_REVIEW_SEEN": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) return reject(state, event, "This movement is closed.");
      // A type-only union passes `vitest run` with no tsc, so membership is enforced at runtime too.
      if (!(PSYCH_REVIEW_GRADES as readonly string[]).includes(event.grade)) {
        return reject(state, event, `RECORD_PSYCH_REVIEW_SEEN grade must be "registrar" or "consultant"`);
      }
      const review = movement.psychReview;
      if (!review) return reject(state, event, "No psychiatric review has been asked for yet.");
      const field = event.grade === "registrar" ? "registrarSeenAt" : "consultantSeenAt";
      if (review[field] !== undefined) return reject(state, event, `The ${event.grade} review is already recorded.`);
      accept();
      return replaceMovement(state, movement.id, { ...movement, psychReview: { ...review, [field]: event.now } });
    }
    case "MARK_WARD_READY_FOR_NEXT": {
      // Claim, not proof, as CLOSE_WARD_TO_ADMISSIONS: a ward acts only on itself.
      if (event.role === "ward" && event.actingUnitId !== event.unitId) {
        return reject(
          state,
          event,
          `${event.type} was raised acting as unit ${event.actingUnitId ?? "no named ward"} but names unit ${event.unitId}; a ward marks only itself`,
        );
      }
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      if (event.cancel === true) {
        if (unit.readyForNextAt === undefined) return reject(state, event, `${unit.name} is not marked ready.`);
        const cleared: Unit = { ...unit };
        delete cleared.readyForNextAt;
        accept();
        return replaceUnit(state, unit.id, cleared);
      }
      if (unit.isClosed) return reject(state, event, `${unit.name} is closed to admissions.`);
      if (unit.readyForNextAt !== undefined) return reject(state, event, `${unit.name} is already marked ready.`);
      accept();
      return replaceUnit(state, unit.id, { ...unit, readyForNextAt: event.now });
    }
  }
}
