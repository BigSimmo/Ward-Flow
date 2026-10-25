import type { AuditDecision } from "./ward-audit";
import {
  ACCEPTANCE_BED_AFTER_HOURS,
  ACCEPTANCE_CONDITION_AGREED_WITH,
  ACCEPTANCE_CONDITION_KINDS,
  CANCELLED_MOVE_CHECK_ITEMS,
  CANCELLED_MOVE_CHECK_MARKS,
  CLOSURE_TRANSITION_ITEM_KINDS,
  RESTRICTION_REVIEW_AFTER_HOURS,
  RESTRICTION_REVIEWER_ROLES,
  WARD_RESTRICTION_KINDS,
  activeWardRestrictions,
  cancelledMoveStillHoldsBed,
  closureTransitionEventRecordId,
  closureTransitionItems,
  closureTransitionMark,
  currentAcceptanceConditions,
  isCancelledMove,
  type LoopCheckWardFlowEvent,
  type WardRestrictionReview,
} from "./loop-checks/ward-loop-checks";
import type { findMovement, findUnit, reject, replaceMovement, replaceUnit, WardFlowState } from "./ward-flow-reducer";
import { WARD_FLOW_ROLE_LABELS } from "./ward-flow-roles";
import type { Movement, Unit } from "./ward-model";

/**
 * CLOSING THE LOOP, PACKAGE D (24 Oct 2026): the reducer half of `loop-checks/ward-loop-checks.ts`.
 * Each event writes one small record and changes nothing else: no stage, bed, transport, placement
 * or restriction moves because of a mark.
 *
 * The reducer passes its helpers in, since this file may not import the reducer at run time.
 */
export type LoopCheckHelpers = {
  findMovement: typeof findMovement;
  findUnit: typeof findUnit;
  reject: typeof reject;
  replaceMovement: typeof replaceMovement;
  replaceUnit: typeof replaceUnit;
};

const has = (list: readonly string[], value: unknown) => typeof value === "string" && list.includes(value);

function accept(decision: AuditDecision) {
  decision.outcome = "accepted";
  decision.reasonCode = "none";
}

export function reduceLoopCheckEvent(
  state: WardFlowState,
  event: LoopCheckWardFlowEvent,
  decision: AuditDecision,
  helpers: LoopCheckHelpers,
): WardFlowState {
  const { reject } = helpers;
  const by = WARD_FLOW_ROLE_LABELS[event.role];

  switch (event.type) {
    case "MARK_CANCELLED_MOVE_CHECK": {
      const movement = helpers.findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      const refusal = movementWardRefusal(event, movement);
      if (refusal) return reject(state, event, refusal);
      if (!isCancelledMove(movement)) return reject(state, event, "This move was not cancelled");
      if (!has(CANCELLED_MOVE_CHECK_ITEMS, event.item) || !has(CANCELLED_MOVE_CHECK_MARKS, event.mark)) {
        return reject(state, event, `${event.type} item and mark must be chosen from their lists`);
      }
      // A mark is a reminder ticked off, never the release itself: a bed still pulled stays open.
      if (event.item === "pulled_bed" && event.mark === "addressed" && cancelledMoveStillHoldsBed(movement)) {
        return reject(state, event, "The bed is still pulled. Release it first, then mark it addressed");
      }
      accept(decision);
      const others = (movement.cancellationChecks ?? []).filter((check) => check.item !== event.item);
      return helpers.replaceMovement(state, movement.id, {
        ...movement,
        cancellationChecks: [...others, { item: event.item, mark: event.mark, at: event.now, by }],
      });
    }

    case "RECORD_ACCEPTANCE_CONDITION":
    case "MARK_ACCEPTANCE_CONDITION_MET": {
      const movement = helpers.findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.acceptedUnitId === undefined || movement.closure !== undefined) {
        return reject(state, event, "No acceptance stands on this bed request");
      }
      const refusal = movementWardRefusal(event, movement);
      if (refusal) return reject(state, event, refusal);
      if (!has(ACCEPTANCE_CONDITION_KINDS, event.condition)) {
        return reject(state, event, `${event.type} condition must be chosen from ACCEPTANCE_CONDITION_KINDS`);
      }
      const current = currentAcceptanceConditions(movement);
      const existing = current.find((condition) => condition.kind === event.condition);
      const all = movement.acceptanceConditions ?? [];

      if (event.type === "RECORD_ACCEPTANCE_CONDITION") {
        if (!has(ACCEPTANCE_CONDITION_AGREED_WITH, event.agreedWith)) {
          return reject(state, event, `${event.type} agreedWith must be chosen from its list`);
        }
        if (existing) return reject(state, event, "That condition is already recorded on this acceptance");
        if (event.condition === "bed_after_time") {
          if (event.readyAt === undefined || event.readyAt <= event.now) {
            return reject(state, event, "The time the bed is offered from must be later than now");
          }
          if (event.readyAt - event.now > Math.max(...ACCEPTANCE_BED_AFTER_HOURS) * 60) {
            return reject(state, event, "The time the bed is offered from must be within the listed choices");
          }
        } else if (event.readyAt !== undefined) {
          return reject(state, event, "Only a bed-after condition carries a time");
        }
        accept(decision);
        return helpers.replaceMovement(state, movement.id, {
          ...movement,
          acceptanceConditions: [
            ...all,
            {
              kind: event.condition,
              unitId: movement.acceptedUnitId,
              ...(movement.acceptedAt !== undefined ? { acceptedAt: movement.acceptedAt } : {}),
              agreedWith: event.agreedWith,
              agreedBy: by,
              recordedAt: event.now,
              ...(event.readyAt !== undefined ? { readyAt: event.readyAt } : {}),
            },
          ],
        });
      }

      if (!existing) return reject(state, event, "That condition is not recorded on this acceptance");
      if (existing.met) return reject(state, event, "That condition is already marked met");
      accept(decision);
      return helpers.replaceMovement(state, movement.id, {
        ...movement,
        acceptanceConditions: all.map((condition) =>
          condition === existing ? { ...condition, met: { at: event.now, by } } : condition,
        ),
      });
    }

    case "RECORD_RESTRICTION_REVIEW": {
      const unit = helpers.findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      const refusal = unitWardRefusal(event);
      if (refusal) return reject(state, event, refusal);
      if (!has(WARD_RESTRICTION_KINDS, event.restriction) || !has(RESTRICTION_REVIEWER_ROLES, event.reviewer)) {
        return reject(state, event, `${event.type} restriction and reviewer must be chosen from their lists`);
      }
      if (!activeWardRestrictions(unit).includes(event.restriction)) {
        return reject(state, event, `${unit.name} has no such restriction in place`);
      }
      if (event.expectedAt <= event.now) return reject(state, event, "The review time must be later than now");
      if (event.expectedAt - event.now > Math.max(...RESTRICTION_REVIEW_AFTER_HOURS) * 60) {
        return reject(state, event, "The review time must be within the listed choices");
      }
      accept(decision);
      const review: WardRestrictionReview = {
        restriction: event.restriction,
        reviewer: event.reviewer,
        expectedAt: event.expectedAt,
        recordedAt: event.now,
        by,
        ...(event.restriction === "admissions_closure" && unit.admissionsClosure
          ? { startedAt: unit.admissionsClosure.at }
          : {}),
      };
      const others = (unit.restrictionReviews ?? []).filter((entry) => entry.restriction !== event.restriction);
      return helpers.replaceUnit(state, unit.id, { ...unit, restrictionReviews: [...others, review] });
    }

    case "MARK_CLOSURE_TRANSITION_ITEM": {
      const unit = helpers.findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      const refusal = unitWardRefusal(event);
      if (refusal) return reject(state, event, refusal);
      if (!unit.isClosed || !unit.admissionsClosure) {
        return reject(state, event, `${unit.name} is not closed to admissions`);
      }
      if (!has(CLOSURE_TRANSITION_ITEM_KINDS, event.item)) {
        return reject(state, event, `${event.type} item must be chosen from CLOSURE_TRANSITION_ITEM_KINDS`);
      }
      const recordId = closureTransitionEventRecordId(event);
      const item = closureTransitionItems(unit, state.movements, state.referrals, state.plannedAdmissions).find(
        (candidate) => candidate.kind === event.item && candidate.recordId === recordId,
      );
      if (!item) return reject(state, event, "That item no longer points at this ward");
      if (closureTransitionMark(unit, item)) return reject(state, event, "That item is already marked dealt with");
      accept(decision);
      const closed: Unit = {
        ...unit,
        admissionsClosure: {
          ...unit.admissionsClosure,
          transitionMarks: [...(unit.admissionsClosure.transitionMarks ?? []), { ...item, at: event.now, by }],
        },
      };
      return helpers.replaceUnit(state, unit.id, closed);
    }
  }
}

/** A ward acts only for a move it accepted. Claim, not proof, as the closure events. */
function movementWardRefusal(event: { role: string; actingUnitId?: string; type: string }, movement: Movement) {
  if (event.role !== "ward") return null;
  return event.actingUnitId !== undefined && event.actingUnitId === movement.acceptedUnitId
    ? null
    : `${event.type} was raised acting as unit ${event.actingUnitId ?? "no named ward"}, which did not accept this move`;
}

/** A ward acts only on itself. */
function unitWardRefusal(event: { role: string; actingUnitId?: string; unitId: string; type: string }) {
  if (event.role !== "ward" || event.actingUnitId === event.unitId) return null;
  return `${event.type} was raised acting as unit ${event.actingUnitId ?? "no named ward"} but names unit ${event.unitId}; a ward acts only on itself`;
}
