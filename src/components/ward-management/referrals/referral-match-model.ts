import { type EligibilityGate } from "@/components/ward-management/ward-eligibility";
import { createBrowserStore } from "@/lib/client-store-factory";

/**
 * The match view's gate labels, band-group media query, unavailable-control reasons and decision
 * events, moved unchanged from `referral-match.tsx` so its sections can share them.
 */

export const GATE_LABELS: Record<EligibilityGate, string> = {
  acuity: "Acuity mix",
  age: "Age band",
  allocatable_bed: "Allocatable bed",
  authorisation: "Involuntary-capable",
  capacity_freshness: "Capacity freshness",
  cohort: "Cohort match",
  forensic: "Forensic history",
  legal_status: "Legal status",
  prior_decline: "Prior decline",
  security: "Security level",
  gender_designation: "Gender designation",
  sex_mix: "Sex mix",
  specialling: "Specialling capacity",
};

/**
 * Phase 8, Task 4. The width at which the band groups start open, matching
 * `referrals.module.css`'s own `--ri-two-col-breakpoint` / `@media (max-width: 40rem)` swap so the
 * screen has ONE breakpoint rather than a second one written here that could drift from it.
 *
 * Owner decision, 2026-08-29: shut by default at phone width, open at desktop width. The binding
 * condition on that decision is why it is safe, and it is a condition on the markup below rather
 * than on this constant: every heading and BOTH of its counts render whether the group is open or
 * shut, including for an empty group, so "there is nothing available within an hour" is answerable
 * without opening anything. Collapsing folds; it does not hide. It was approved INSTEAD of a
 * metro/rural toggle, which was declined precisely because that would have hidden beds.
 */
const BAND_GROUPS_OPEN_MEDIA_QUERY = "(min-width: 40rem)";

/**
 * Whether the band groups start open, tracked live so a rotation or a resize is honoured rather
 * than frozen at mount. On the server there is no `matchMedia` at all and the answer is `false` —
 * the phone default — so nothing width-dependent is guessed where no width is known. The `typeof`
 * guards are for a browser-like environment that lacks the API rather than for jsdom, which this
 * repository's `tests/setup/jsdom.setup.ts` always supplies with a stub (defaulting to "no match",
 * so groups mount shut unless a test installs the matching stub itself). A shut group is the
 * conservative answer in any case: every heading and both counts are inside the `<summary>`, which
 * is the part a closed disclosure still paints.
 */
export const useBandGroupsOpenByDefault = createBrowserStore<boolean>(
  (onStoreChange) => {
    if (typeof window.matchMedia !== "function") return () => {};
    const media = window.matchMedia(BAND_GROUPS_OPEN_MEDIA_QUERY);
    media.addEventListener("change", onStoreChange);
    return () => media.removeEventListener("change", onStoreChange);
  },
  () => (typeof window.matchMedia === "function" ? window.matchMedia(BAND_GROUPS_OPEN_MEDIA_QUERY).matches : false),
  false,
);

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
