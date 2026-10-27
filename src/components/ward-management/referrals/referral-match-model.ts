import { type EligibilityGate } from "@/components/ward-management/ward-eligibility";

/**
 * The match view's gate labels, unavailable-control reasons and decision
 * events, moved unchanged from `referral-match.tsx` so its sections can share them.
 */

export const GATE_LABELS: Record<EligibilityGate, string> = {
  acuity: "Acuity mix",
  age: "Age band",
  allocatable_bed: "Allocatable bed",
  authorisation: "Authorised hospital",
  capacity_freshness: "Capacity freshness",
  cohort: "Ward cohort",
  forensic: "Forensic history",
  legal_status: "Legal status",
  prior_decline: "Prior decline",
  security: "Security level",
  gender_designation: "Gender designation",
  sex_mix: "Gender mix",
  specialling: "Specialling capacity",
};

/**
 * The event types this view's own controls raise, and the one spelling of each in the rejection
 * banner. A refusal the reducer raises for any of them surfaces here rather than being swallowed —
 * including `RECORD_LOCAL_BED_SOUGHT`, whose control this screen owns.
 */
/**
 * ⚠️ THE STATED REASON A CONTROL IS UNAVAILABLE, not a silently grey button. Repo convention: an
 * `aria-disabled` control keeps its tab stop and says why, because a native `disabled` removes the
 * tab stop and the reason is then never reached by anyone moving through the page by keyboard.
 */
/**
 * ⚠️ A WARD MUST STATE WHY IT IS REFUSING A PATIENT. The list had a first member and the control
 * started on it, so a decline nobody thought about was filed as "no suitable bed".
 */
export const DECLINE_REASON_UNCHOSEN = "Choose the reason this ward cannot take this referral before declining it.";

/**
 * Ward audit 2026-09-16 (fix 4): the same "state a reason before declining" rule as
 * `DECLINE_REASON_UNCHOSEN` above, for the emergency-department decline control the "no bed
 * shortlist" panel now also renders (below). `EVENT_ROLE.DECLINE_REFERRAL` (`ward-flow-events.ts`)
 * already permits `"ed"` and the reducer's own `answerableBy` map already accepts a coordinator
 * declining any destination kind (`CO-D2`) — this control was simply never built. Reuses
 * `REFERRAL_DECLINE_REASONS`, the same vocabulary `ed-screen.tsx`'s own inbox decline dispatches
 * with for this exact destination kind (its `ED_DECLINE_REASONS` is that same list with the four
 * bed-shaped reasons filtered out for that screen's own UX — not duplicated here, since this view
 * offers the reason a coordinator gives on the referral's behalf, not the ED's own inbox).
 */
export const DECLINE_REASON_UNCHOSEN_ED =
  "Choose the reason this emergency department cannot take this referral before declining it.";

/**
 * 🔴 **THE COMMUNITY DECLINE CONTROL — engine fix, 2026-09-17, closing the gap this constant's own
 * predecessor (`NOT_WIRED_COMMUNITY_DECLINE`) recorded.**
 *
 * Until this fix, `COMMUNITY_DECLINE_REASONS` (`ward-model.ts`) was a SEPARATE vocabulary by owner
 * ruling O-16.6 — "the overlap in meaning is ZERO" — but `DECLINE_REFERRAL`'s `reason` field was
 * typed `ReferralDeclineReason` only, and the reducer's own membership check was not scoped by
 * `destinationKind` at all, so it would have accepted a WARD reason for a community decline —
 * exactly the wrong-reason-is-worse-than-no-reason failure that ruling exists to prevent — and
 * would have refused a genuine `CommunityDeclineReason` value outright. Both are fixed at the
 * source now: `reason` widens to `ReferralDeclineReason | CommunityDeclineReason`, and the reducer
 * checks a `community_team` decline against `COMMUNITY_DECLINE_REASONS` specifically.
 *
 * So a community-only or community-plus-ED referral now renders a REAL decline control for its
 * community destination, offering `COMMUNITY_DECLINE_REASONS` — never `REFERRAL_DECLINE_REASONS`,
 * which would misuse the ward vocabulary and now be refused outright by the reducer's own check.
 */
export const DECLINE_REASON_UNCHOSEN_COMMUNITY =
  "Choose the reason this community team cannot take this referral before declining it.";

export const OVERRIDE_REASON_UNCHOSEN =
  "Choose the reason for accepting despite this ward's assessment before recording it.";

export const MATCH_VIEW_DECISION_EVENTS = [
  "ACCEPT_REFERRAL",
  "DECLINE_REFERRAL",
  "RECORD_LOCAL_BED_SOUGHT",
  "RECORD_REFERRER_WITHDRAWAL",
] as const;

export const REJECTED_DECISION_LABELS: Record<(typeof MATCH_VIEW_DECISION_EVENTS)[number], string> = {
  ACCEPT_REFERRAL: "Acceptance",
  DECLINE_REFERRAL: "Decline",
  RECORD_LOCAL_BED_SOUGHT: "Local bed search",
  RECORD_REFERRER_WITHDRAWAL: "Withdrawal",
};

/** Brings the confirm row into view when it opens, so Confirm and Cancel are never below the fold.
 *  Module-level so React calls it once on mount, not on every render (site review, 12 Oct 2026). */
export function revealConfirmRow(node: HTMLDivElement | null) {
  node?.scrollIntoView?.({ block: "nearest" });
}
