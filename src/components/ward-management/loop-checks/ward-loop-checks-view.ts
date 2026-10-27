import type {
  AcceptanceConditionAgreedWith,
  AcceptanceConditionKind,
  CancelledMoveCheckItem,
  CancelledMoveCheckMarkKind,
  ClosureTransitionItemKind,
  RestrictionReviewerRole,
  WardRestrictionKind,
} from "./ward-loop-checks";

/** Screen labels for `ward-loop-checks.ts`. Only the screens load this file. */

export const CANCELLED_MOVE_CHECK_LABELS: Record<CancelledMoveCheckItem, string> = {
  transport_booking: "Transport booking",
  escort: "Escort",
  pulled_bed: "Pulled bed",
  receiving_notice: "Receiving ward told",
};

export const CANCELLED_MOVE_MARK_LABELS: Record<CancelledMoveCheckMarkKind, string> = {
  addressed: "Addressed",
  not_applicable: "Not applicable",
};

export const ACCEPTANCE_CONDITION_LABELS: Record<AcceptanceConditionKind, string> = {
  after_medical_clearance: "After medical clearance",
  escort_required: "Escort required",
  bed_after_time: "Bed after a set time",
  legal_papers_first: "Legal papers sent first",
  call_ward_before_leaving: "Call the ward before leaving",
};

export const ACCEPTANCE_AGREED_WITH_LABELS: Record<AcceptanceConditionAgreedWith, string> = {
  coordinator: "Bed coordinator",
  ed: "ED clinician",
  community: "Community service",
  sending_ward: "Sending ward",
};

export const WARD_RESTRICTION_LABELS: Record<WardRestrictionKind, string> = {
  admissions_closure: "Closed to admissions",
  intake_constraints: "Intake limited",
  closed_bays: "Bays closed",
};

export const RESTRICTION_REVIEWER_LABELS: Record<RestrictionReviewerRole, string> = {
  nurse_unit_manager: "Nurse unit manager",
  consultant_psychiatrist: "Consultant psychiatrist",
  site_bed_manager: "Bed manager",
  flow_coordinator: "Bed coordinator",
  after_hours_manager: "After-hours manager",
  service_director: "Service director",
};

export const CLOSURE_TRANSITION_LABELS: Record<ClosureTransitionItemKind, string> = {
  referral: "Referral waiting on this ward",
  bed_request: "Bed request asked this ward",
  accepted: "Accepted here",
  pulled_bed: "Bed pulled here",
  transport: "Transport booked to this ward",
  booked_arrival: "Booked arrival",
};

/** "Accepted with conditions (2 outstanding)", or `null` when there are none. */
export function acceptanceConditionsHeadline(total: number, outstanding: number): string | null {
  if (total === 0) return null;
  return outstanding === 0
    ? "Accepted with conditions (all met)"
    : `Accepted with conditions (${outstanding} outstanding)`;
}
