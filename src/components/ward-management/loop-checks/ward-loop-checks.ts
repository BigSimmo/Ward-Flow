import type { PlannedAdmission } from "../ward-admissions";
import type { Instant } from "../ward-clock";
import type { WardFlowRole } from "../ward-flow-roles";
import type { Movement, Referral, Unit } from "../ward-model";
import { pointedAtWard } from "../capacity/ward-closure";

/**
 * CLOSING THE LOOP, PACKAGE D (24 Oct 2026): four records that only say what people did or agreed.
 *
 * 1. A cancelled move's checklist: transport booking, escort, pulled bed and receiving ward notice,
 *    each marked addressed or not applicable by a role at a time. Nothing is cancelled or released
 *    by a mark: a pulled bed is released only by the existing release step.
 * 2. Conditions a ward attached to its acceptance, from a fixed list, who they were agreed with and
 *    whether each is met. Placement and eligibility read none of it.
 * 3. A named reviewer (a role) and a review time for a temporary restriction on a ward. "Review
 *    overdue" is read from the recorded time. Nothing lifts a restriction by itself.
 * 4. A ward closure's transition list: what still points at the closed ward, each marked dealt with
 *    by a role. No reassignment and no suggested ward.
 *
 * Every field is an id, a choice from a fixed list or an instant, so nothing typed is stored (D-18).
 * The reducer reads this file, so it must not import the derivations. Labels live in
 * `ward-loop-checks-view.ts`, which only the screens load.
 */

// ── 1. Cancelled move checklist ─────────────────────────────────────────────────────────────────

export const CANCELLED_MOVE_CHECK_ITEMS = ["transport_booking", "escort", "pulled_bed", "receiving_notice"] as const;
export type CancelledMoveCheckItem = (typeof CANCELLED_MOVE_CHECK_ITEMS)[number];

export const CANCELLED_MOVE_CHECK_MARKS = ["addressed", "not_applicable"] as const;
export type CancelledMoveCheckMarkKind = (typeof CANCELLED_MOVE_CHECK_MARKS)[number];

/** One item reviewed after a move was cancelled. A later mark for the same item replaces it. */
export type CancelledMoveCheck = {
  item: CancelledMoveCheckItem;
  mark: CancelledMoveCheckMarkKind;
  at: Instant;
  /** The role label of whoever marked it. */
  by: string;
};

/** A move that did not proceed: the only kind the checklist is for. */
export function isCancelledMove(movement: Movement): boolean {
  return movement.closure?.outcome === "did_not_proceed";
}

/** A bed is still pulled for this closed move: the release step has not run. */
export function cancelledMoveStillHoldsBed(movement: Movement): boolean {
  return movement.admissionId !== undefined || movement.heldBedNumber !== undefined;
}

export function cancelledMoveCheck(movement: Movement, item: CancelledMoveCheckItem): CancelledMoveCheck | undefined {
  return movement.cancellationChecks?.find((check) => check.item === item);
}

// ── 2. Conditions attached to an acceptance ─────────────────────────────────────────────────────

export const ACCEPTANCE_CONDITION_KINDS = [
  "after_medical_clearance",
  "escort_required",
  "bed_after_time",
  "legal_papers_first",
  "call_ward_before_leaving",
] as const;
export type AcceptanceConditionKind = (typeof ACCEPTANCE_CONDITION_KINDS)[number];

/** Who the accepting ward agreed the condition with. */
export const ACCEPTANCE_CONDITION_AGREED_WITH = ["coordinator", "ed", "community", "sending_ward"] as const;
export type AcceptanceConditionAgreedWith = (typeof ACCEPTANCE_CONDITION_AGREED_WITH)[number];

/** Clock-hour choices for "bed after", as hours from now. */
export const ACCEPTANCE_BED_AFTER_HOURS = [1, 2, 3, 4, 6, 8, 12] as const;

export type AcceptanceCondition = {
  kind: AcceptanceConditionKind;
  /** The accepting ward. The condition stands only while that ward's acceptance stands. */
  unitId: string;
  /** The acceptance it belongs to (`Movement.acceptedAt` when it was recorded). */
  acceptedAt?: Instant;
  agreedWith: AcceptanceConditionAgreedWith;
  /** The role label of whoever recorded it. */
  agreedBy: string;
  recordedAt: Instant;
  /** `bed_after_time` only: the bed is offered from this time. */
  readyAt?: Instant;
  met?: { at: Instant; by: string };
};

/** Conditions on the acceptance that stands now. A withdrawn or replaced acceptance carries none. */
export function currentAcceptanceConditions(movement: Movement): AcceptanceCondition[] {
  if (movement.acceptedUnitId === undefined || movement.closure !== undefined) return [];
  return (movement.acceptanceConditions ?? []).filter(
    (condition) => condition.unitId === movement.acceptedUnitId && condition.acceptedAt === movement.acceptedAt,
  );
}

export function outstandingAcceptanceConditions(movement: Movement): AcceptanceCondition[] {
  return currentAcceptanceConditions(movement).filter((condition) => condition.met === undefined);
}

// ── 3. Review dates for temporary restrictions ──────────────────────────────────────────────────

export const WARD_RESTRICTION_KINDS = ["admissions_closure", "intake_constraints", "closed_bays"] as const;
export type WardRestrictionKind = (typeof WARD_RESTRICTION_KINDS)[number];

/** The reviewer is a role, never a person's name. */
export const RESTRICTION_REVIEWER_ROLES = [
  "nurse_unit_manager",
  "consultant_psychiatrist",
  "site_bed_manager",
  "flow_coordinator",
  "after_hours_manager",
  "service_director",
] as const;
export type RestrictionReviewerRole = (typeof RESTRICTION_REVIEWER_ROLES)[number];

/** Review choices, in hours from now. Seven days at most. */
export const RESTRICTION_REVIEW_AFTER_HOURS = [4, 8, 12, 24, 48, 72, 168] as const;

export type WardRestrictionReview = {
  restriction: WardRestrictionKind;
  reviewer: RestrictionReviewerRole;
  /** When the restriction is to be reviewed. A prompt only. */
  expectedAt: Instant;
  recordedAt: Instant;
  /** The role label of whoever recorded it. */
  by: string;
  /** `admissions_closure` only: the closure it belongs to (`admissionsClosure.at`). */
  startedAt?: Instant;
};

/** The restrictions in place on this ward now, in a fixed order. */
export function activeWardRestrictions(unit: Unit): WardRestrictionKind[] {
  return WARD_RESTRICTION_KINDS.filter((kind) => {
    if (kind === "admissions_closure") return unit.isClosed === true;
    if (kind === "intake_constraints") return (unit.intakeConstraints ?? []).length > 0;
    return (unit.closedBayIds ?? []).length > 0;
  });
}

/** The review recorded for this restriction as it stands now, if any. */
export function currentRestrictionReview(
  unit: Unit,
  restriction: WardRestrictionKind,
): WardRestrictionReview | undefined {
  if (!activeWardRestrictions(unit).includes(restriction)) return undefined;
  return unit.restrictionReviews?.find(
    (review) =>
      review.restriction === restriction &&
      (restriction !== "admissions_closure" || review.startedAt === unit.admissionsClosure?.at),
  );
}

/** The recorded review time has passed and the restriction is still in place. Never lifts it. */
export function restrictionReviewOverdue(review: WardRestrictionReview, now: Instant): boolean {
  return now >= review.expectedAt;
}

// ── 4. Ward closure transition checklist ────────────────────────────────────────────────────────

export const CLOSURE_TRANSITION_ITEM_KINDS = [
  "referral",
  "bed_request",
  "accepted",
  "pulled_bed",
  "transport",
  "booked_arrival",
] as const;
export type ClosureTransitionItemKind = (typeof CLOSURE_TRANSITION_ITEM_KINDS)[number];

export type ClosureTransitionItem = { kind: ClosureTransitionItemKind; recordId: string };

/** One item a person said was dealt with while the ward was closed. Kept on the closure record. */
export type ClosureTransitionMark = ClosureTransitionItem & { at: Instant; by: string };

/**
 * What still points at this ward, in recorded order: referrals waiting on its answer, bed requests
 * that asked it or were accepted or pulled here, live transport to it, and booked arrivals. A list
 * to work through, never a reassignment.
 */
export function closureTransitionItems(
  unit: Unit,
  movements: readonly Movement[],
  referrals: readonly Referral[],
  plannedAdmissions: readonly PlannedAdmission[],
): ClosureTransitionItem[] {
  const items: ClosureTransitionItem[] = pointedAtWard(unit.id, movements, referrals).map((entry) =>
    entry.kind === "referral"
      ? { kind: "referral", recordId: entry.id }
      : {
          kind: entry.status === "asked" ? "bed_request" : entry.status === "accepted" ? "accepted" : "pulled_bed",
          recordId: entry.id,
        },
  );
  for (const movement of movements) {
    if (movement.closure || movement.stage === "arrived" || movement.acceptedUnitId !== unit.id) continue;
    if (movement.transport && movement.transport.cancelledAt === undefined) {
      items.push({ kind: "transport", recordId: movement.id });
    }
  }
  for (const booking of plannedAdmissions) {
    if (booking.unitId === unit.id && booking.state === "booked") {
      items.push({ kind: "booked_arrival", recordId: booking.id });
    }
  }
  return items;
}

export function closureTransitionMark(unit: Unit, item: ClosureTransitionItem): ClosureTransitionMark | undefined {
  return unit.admissionsClosure?.transitionMarks?.find(
    (mark) => mark.kind === item.kind && mark.recordId === item.recordId,
  );
}

// ── Events ──────────────────────────────────────────────────────────────────────────────────────

/** The five events that write these records, joined into `WardFlowEvent`. */
export type LoopCheckWardFlowEvent =
  | {
      /**
       * Closing the loop D1: one item on a cancelled move's checklist is addressed or does not
       * apply. Records the mark only: it cancels no transport and releases no bed. The coordinator,
       * or the accepting ward for its own move.
       */
      type: "MARK_CANCELLED_MOVE_CHECK";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      actingUnitId?: string;
      item: CancelledMoveCheckItem;
      mark: CancelledMoveCheckMarkKind;
    }
  | {
      /**
       * Closing the loop D2: a condition the accepting ward attached to its acceptance, from
       * `ACCEPTANCE_CONDITION_KINDS`, and who it was agreed with. `readyAt` for `bed_after_time`
       * only. Changes no stage, placement or eligibility.
       */
      type: "RECORD_ACCEPTANCE_CONDITION";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      actingUnitId?: string;
      condition: AcceptanceConditionKind;
      agreedWith: AcceptanceConditionAgreedWith;
      readyAt?: Instant;
    }
  | {
      /** Closing the loop D2: a person says this condition is now met. */
      type: "MARK_ACCEPTANCE_CONDITION_MET";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      actingUnitId?: string;
      condition: AcceptanceConditionKind;
    }
  | {
      /**
       * Closing the loop D3: who reviews a temporary restriction on this ward, and when. A later
       * review for the same restriction replaces it. Never lifts the restriction.
       */
      type: "RECORD_RESTRICTION_REVIEW";
      role: WardFlowRole;
      now: Instant;
      unitId: string;
      actingUnitId?: string;
      restriction: WardRestrictionKind;
      reviewer: RestrictionReviewerRole;
      expectedAt: Instant;
    }
  | {
      /**
       * Closing the loop D4: one item still pointed at a closed ward was dealt with by a person.
       * Names the record by its own id field. Moves, cancels and reassigns nothing.
       */
      type: "MARK_CLOSURE_TRANSITION_ITEM";
      role: WardFlowRole;
      now: Instant;
      unitId: string;
      actingUnitId?: string;
      item: ClosureTransitionItemKind;
      movementId?: string;
      referralId?: string;
      plannedAdmissionId?: string;
    };

/** The record id a transition event names, from the field its item kind uses. */
export function closureTransitionEventRecordId(
  event: Extract<LoopCheckWardFlowEvent, { type: "MARK_CLOSURE_TRANSITION_ITEM" }>,
): string | undefined {
  if (event.item === "referral") return event.referralId;
  if (event.item === "booked_arrival") return event.plannedAdmissionId;
  return event.movementId;
}
