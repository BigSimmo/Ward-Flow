"use client";

import { ReferralIntakeSummary } from "./referral-intake-summary";

import { useEffect, useRef, useState, type Dispatch } from "react";

import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import {
  GENDER_PLACEMENT_REASONS,
  GENDER_PLACEMENT_REFUSAL,
  OVERRIDE_REASONS,
  WARD_REQUEST_WITHDRAWAL_REASONS,
  wardRequestWithdrawalReasonLabels,
  type GenderPlacementReason,
  type OverrideReason,
  type WardRequestWithdrawalReason,
} from "@/components/ward-management/ward-change-reasons";
import { formatInstant, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { NOT_RECORDED_LABEL, SYNTHETIC_TRAVEL_TIMES_NOTICE } from "@/components/ward-management/ward-distance";
import { WARD_FLOW_ROLE_LABELS, type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { wardAddressing, wardAddressings, type EligibilityGate } from "@/components/ward-management/ward-eligibility";
import {
  COMMUNITY_DECLINE_REASONS,
  ED_DECLINE_REASONS,
  REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS,
  REFERRAL_DECLINE_REASONS,
  genderReviewNeeded,
  type CommunityDeclineReason,
  type Referral,
  type ReferralDeclineReason,
  type ReferralDestinationKind,
  type Rejection,
  type Unit,
} from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import {
  candidateAccepts,
  COMMUNITY_DECLINE_REASON_LABELS,
  DECLINE_REASON_LABELS,
  groupCandidatesByTravelBand,
  matchReason,
  aFreeBedCouldChangeThis,
  networkHasCohort,
  noBedBreakdown,
  referralCandidates,
  TRAVEL_BAND_GROUP_EMPTY_SENTENCE,
  travelBandGroupCounts,
  travelBandGroupCountsSentence,
  travelBandGroupLabel,
  type ReferralCandidate,
  type TravelBandGroup,
  type TravelBandGroupCounts,
  referralPersonFacts,
  referralDestinationLabels,
  referralAddressingStateLabel,
  referralSuburbLabel,
  referralSenderRole,
  referralWithdrawable,
} from "@/components/ward-management/ward-referrals";
import { createBrowserStore } from "@/lib/client-store-factory";

import { getReferralPriority, referralPriorityLabel, PriorityGlyph } from "./referral-priority";
import { referralWaitLine } from "./referral-wait";
import styles from "./referrals.module.css";

const GATE_LABELS: Record<EligibilityGate, string> = {
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
const useBandGroupsOpenByDefault = createBrowserStore<boolean>(
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
const DECLINE_REASON_UNCHOSEN = "Choose the reason this ward cannot take this referral before declining it.";

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
const DECLINE_REASON_UNCHOSEN_ED =
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
const DECLINE_REASON_UNCHOSEN_COMMUNITY =
  "Choose the reason this community team cannot take this referral before declining it.";

const OVERRIDE_REASON_UNCHOSEN = "Choose the reason for accepting despite this ward's assessment before recording it.";

const MATCH_VIEW_DECISION_EVENTS = [
  "ACCEPT_REFERRAL",
  "DECLINE_REFERRAL",
  "RECORD_LOCAL_BED_SOUGHT",
  "RECORD_REFERRER_WITHDRAWAL",
] as const;

const REJECTED_DECISION_LABELS: Record<(typeof MATCH_VIEW_DECISION_EVENTS)[number], string> = {
  ACCEPT_REFERRAL: "Acceptance",
  DECLINE_REFERRAL: "Decline",
  RECORD_LOCAL_BED_SOUGHT: "Local bed search",
  RECORD_REFERRER_WITHDRAWAL: "Withdrawal",
};

function formatUmrn(umrn: string): string {
  if (!umrn || umrn === "UMRN not recorded") return "UMRN not recorded";
  if (umrn.toUpperCase().startsWith("UMRN")) return umrn;
  return `UMRN: ${umrn}`;
}

type ReferralMatchViewProps = {
  referral: Referral;
  units: Unit[];
  now: Instant;
  dispatch: Dispatch<WardFlowEvent>;
  rejections: Rejection[];
  patientInfo?: { displayName: string; umrn: string };
  hideDossierHeader?: boolean;
};

/**
 * RB7, build plan item 27 (2026-09-17). Shows the referrer's own written history unchanged, every
 * correction added on top of it since — each its own attributed, timestamped entry, never a
 * rewrite of the history above it — and a control to add one. See `Referral.corrections`'s own doc
 * comment (`ward-model.ts`) for why the two are held structurally apart, and
 * `tests/ward-referral-history-immutable.test.ts` for the reducer-level proof that
 * `ADD_REFERRAL_CORRECTION` never touches `history`.
 *
 * 🔴 **DISPATCHES AS `coordinator`, NOT A SELECTED VIEWER ROLE — AND THAT IS THIS SCREEN, NOT THE
 * EVENT.** `EVENT_ROLE.ADD_REFERRAL_CORRECTION` permits `community`/`ed`/`coordinator`, but every
 * OTHER dispatch already in this file (`ACCEPT_REFERRAL`, `DECLINE_REFERRAL`,
 * `RECORD_LOCAL_BED_SOUGHT`) hardcodes `role: "coordinator"` too — `ReferralMatchView` has exactly
 * one mount site (`referral-board.tsx`'s coordinator register, itself the whole app's only render
 * of this component) and carries no viewer-role concept to select from. `community`/`ed` are for a
 * DIFFERENT screen — an ED's or a community team's own — that does not exist yet.
 *
 * Owns its own hooks (the draft note), independent of `ReferralMatchView`'s own strict hook order,
 * so it can be called from any of that component's three return branches without disturbing it.
 */
export function ReferralHistoryAndCorrections({
  referral,
  now,
  dispatch,
}: {
  referral: Referral;
  now: Instant;
  dispatch: Dispatch<WardFlowEvent>;
}) {
  const [note, setNote] = useState("");
  const trimmedNote = note.trim();

  /**
   * ⚠️ NO REJECTION PATH REACHES THIS BUTTON. `ADD_REFERRAL_CORRECTION` refuses only a blank note
   * (guarded by `aria-disabled` below, the same belt-and-braces discipline `handleDecline` already
   * uses for its own guard), an over-limit note (prevented outright — `maxLength` on the textarea
   * makes typing past `REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS` impossible), or an unknown referral (this
   * component is only ever mounted on a referral that already exists). So a guarded dispatch here
   * always succeeds, and the draft is cleared unconditionally rather than built on the
   * rejection-tracking machinery `handleAccept`/`handleDecline` need for genuinely refusable acts.
   */
  function handleAddCorrection() {
    if (trimmedNote.length === 0) return;
    dispatch({
      type: "ADD_REFERRAL_CORRECTION",
      role: "coordinator",
      now,
      referralId: referral.id,
      note,
    });
    setNote("");
  }

  return (
    <section className={styles.historyCorrectionsSection} data-testid="ward-referral-history-and-corrections">
      <div className={styles.historyCard}>
        <h3 className={styles.historySectionHeading}>Written history</h3>
        <div className={styles.historyTextContainer}>
          <p data-testid="ward-referral-history-text" className={styles.historyText}>
            {referral.history === "" ? "Not written yet." : referral.history}
          </p>
        </div>
      </div>

      <div className={styles.correctionsCard}>
        <h3 className={styles.historySectionHeading}>Corrections</h3>
        {referral.corrections === undefined || referral.corrections.length === 0 ? (
          <p data-testid="ward-referral-corrections-empty" className={styles.correctionsEmpty}>
            No corrections have been added.
          </p>
        ) : (
          <ul data-testid="ward-referral-corrections-list" className={styles.correctionsList}>
            {referral.corrections.map((correction, index) => (
              // Index key: corrections are append-only and never reordered or removed (see the type's
              // own doc comment), so position is a stable identity for this read-only list.
              <li key={index} className={styles.correctionItem}>
                <p className={styles.correctionNoteText}>{correction.note}</p>
                <p className={styles.correctionMetaText}>
                  {/* Corrections are append-only over the referral's whole life, so one added days
                      ago must say which day, not just the bare clock face — the same reason
                      ward-instant-display.test.ts moved history surfaces onto this helper. */}
                  {WARD_FLOW_ROLE_LABELS[correction.by]} at {formatInstantWithDay(correction.at, now)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.correctionControlsWrap} data-testid="ward-referral-correction-controls">
          <label className={styles.fieldLegend} htmlFor="ward-referral-correction-note">
            Add a correction note
          </label>
          <textarea
            id="ward-referral-correction-note"
            data-testid="ward-referral-correction-note"
            className={styles.correctionNote}
            value={note}
            maxLength={REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS}
            placeholder="Document clinical addendum or update..."
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            data-gramm="false"
            data-enable-grammarly="false"
            spellCheck={false}
            autoComplete="off"
          />
          <div className={styles.correctionActionRow}>
            <button
              type="button"
              className={styles.addCorrectionBtn}
              data-testid="ward-referral-add-correction"
              aria-disabled={trimmedNote.length === 0 ? "true" : undefined}
              aria-describedby={trimmedNote.length === 0 ? "ward-referral-correction-blocked" : undefined}
              title={trimmedNote.length === 0 ? "Write a note before adding a correction." : undefined}
              onClick={trimmedNote.length === 0 ? ignoreUnavailableActivation : handleAddCorrection}
            >
              Add a correction
            </button>
            <span className={styles.correctionDisclaimer}>
              Corrections are added as new notes. The history sent with the referral is never changed.
            </span>
          </div>
          {trimmedNote.length === 0 ? (
            <span id="ward-referral-correction-blocked" className="sr-only">
              Write a note before adding a correction.
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/**
 * Task 5 (Phase 7, "The front door", spec D10): the match view. One referral, every unit in the
 * network — `referralCandidates` (`ward-referrals.ts`) never truncates, sorts or ranks it, so
 * this component must not either. Every unit renders in the exact order `units` arrives in (the
 * site table's own order, the same fixed order the morning page uses) — a table row NEVER moves
 * because it accepts the referral, because that would read as a recommendation, and D10 is
 * explicit that this view shows candidates and a human decides.
 *
 * The parent (`ReferralBoard`) mounts this keyed on `referral.id`, so switching which referral is
 * selected always remounts fresh local state here (the decline-reason draft, the rejection banner)
 * rather than carrying one referral's leftover UI state onto the next.
 */
export function ReferralMatchView({
  referral,
  units,
  now,
  dispatch,
  rejections,
  patientInfo,
  hideDossierHeader = false,
}: ReferralMatchViewProps) {
  /*
   * EVERY HOOK THIS VIEW HAS IS CALLED HERE, above the not-a-bed-question return below, and none
   * of them may move under it. React identifies a hook by its position in the call order, so a
   * component whose hook COUNT depends on a prop has no stable identity for its own state. While
   * these sat beneath that return, a render for a referral with no ward destination called none of
   * them, and the next render that did reach them was treated as a fresh mount.
   *
   * React raises nothing for that exact shape — an early return above EVERY hook leaves both of
   * its guards asleep, since `current.memoizedState` stays null (so the MOUNT dispatcher is chosen
   * again) and `currentHook` is never set (so `didRenderTooFewHooks` cannot fire). So it failed
   * silently rather than loudly: the decline reason a coordinator had already chosen was discarded,
   * and the media-query subscription was replaced without its predecessor's cleanup ever running.
   * `tests/ward-referral-match-hooks-order.dom.test.tsx` pins both. It stops being silent and
   * becomes React's "Rendered more hooks…" crash the day a second early return lands between two
   * hooks, which is why the lint rule refuses the arrangement rather than the consequence.
   *
   * None of the six needs a value the early return guards. Their arguments are constants
   * (`REFERRAL_DECLINE_REASONS[0]`, `undefined`, `0`) or props that arrive on every render
   * (`rejections`), and the effect reads only `rejections`, `checkToken` and `referral.id` —
   * nothing derived from `ward`. There is therefore no no-ward stand-in value to invent here;
   * everything that IS derived from `ward` stays below, where it runs only once there is one.
   */
  /* Shut on a phone, open at desktop width — read through the repository's own SSR-safe external
   * store rather than by setting state in an effect, so the value is already correct on the first
   * client render and no cascading re-render is needed to reach it. */
  const bandGroupsOpenByDefault = useBandGroupsOpenByDefault();

  /**
   * ⚠️ UNCHOSEN, AND THIS IS THE MOST CONSEQUENTIAL PLACE IN THE APP FOR THAT TO BE TRUE.
   *
   * This was `REFERRAL_DECLINE_REASONS[0]`, which is `"no_suitable_bed"`. So a ward that pressed
   * Decline without touching the control recorded THAT as its clinical reason for refusing a
   * patient — and it is the sentence the coordinator then reads when deciding where to try next.
   * It may be untrue, and it is untrue in the direction that sounds most ordinary, which is why
   * nobody would ever query it.
   *
   * ⚠️ `undefined` IS NOT A SIXTH REASON. There is deliberately no "not stated" option in the
   * list: that would be a value a ward could choose on purpose, which is a different feature
   * nobody has asked for. This is the absence of an answer, and the control refuses to submit
   * until there is one.
   */
  const [declineReason, setDeclineReason] = useState<ReferralDeclineReason | undefined>(undefined);
  const [expandedUnitGates, setExpandedUnitGates] = useState<Set<string>>(new Set());
  /**
   * A SEPARATE draft from `declineReason` above, deliberately — not a second use of the same
   * state. The `!ward` branch below can render an emergency-department decline control AND a
   * community decline control side by side (a referral may be addressed to both at once), unlike
   * the ward and ED controls, which are mutually exclusive by construction (the ward branch is an
   * early return). One shared draft typed `ReferralDeclineReason` could never hold a genuine
   * `CommunityDeclineReason` value anyway — the two vocabularies share zero overlap (O-16.6).
   */
  const [communityDeclineReason, setCommunityDeclineReason] = useState<CommunityDeclineReason | undefined>(undefined);
  /**
   * Owner ruling 11 (2026-09-17) — the draft reason for withdrawing JUST a live community-team arm,
   * kept as its own state for the same reason `communityDeclineReason` is its own state above: a
   * genuinely different vocabulary (`WardRequestWithdrawalReason`, reused rather than a third one —
   * see `RECORD_REFERRER_WITHDRAWAL`'s own doc comment, `ward-flow-events.ts`) from either decline
   * reason on this screen.
   */
  const [communityWithdrawReason, setCommunityWithdrawReason] = useState<WardRequestWithdrawalReason | undefined>(
    undefined,
  );
  const [edAcceptConfirmOpen, setEdAcceptConfirmOpen] = useState(false);
  /**
   * Who is recording the referrer's whole-referral withdrawal. Owner, 4 October 2026: the community
   * team and the ED may record it "if they are cancelling their referral", so the choice offered is
   * the coordinator or the side that sent THIS referral (`referralSenderRole`), never the other side.
   */
  const [withdrawRecorder, setWithdrawRecorder] = useState<"coordinator" | "sender">("coordinator");
  const [withdrawConfirmOpen, setWithdrawConfirmOpen] = useState(false);
  const [lastRejection, setLastRejection] = useState<Rejection | undefined>(undefined);
  // Same async-detection pattern as `referral-intake.tsx`'s own `checkToken`/`priorRejectionCountRef`
  // pair (see that file's doc comment for the full reasoning) — `dispatch` never returns whether
  // the reducer accepted or refused an event, so the only way to know is to compare `rejections`
  // before and after, on the next render.
  const priorRejectionCountRef = useRef(rejections.length);
  const [checkToken, setCheckToken] = useState(0);
  const [collapsedTiers, setCollapsedTiers] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (checkToken === 0) return;
    if (rejections.length > priorRejectionCountRef.current) {
      const newest = rejections[rejections.length - 1];
      // Scoped to THIS referral's own ACCEPT_REFERRAL/DECLINE_REFERRAL — `Rejection.movementId`
      // carries the referral id for these two event types (see `subjectId` in
      // `ward-flow-reducer.ts`), never a movement id. A rejection some other coordinator action
      // raised elsewhere must never surface here as though it were about this referral.
      const isForThisDecision =
        newest.movementId === referral.id &&
        (MATCH_VIEW_DECISION_EVENTS as readonly string[]).includes(newest.attempted);
      setLastRejection(isForThisDecision ? newest : undefined);
    } else {
      setLastRejection(undefined);
    }
    priorRejectionCountRef.current = rejections.length;
  }, [rejections, checkToken, referral.id]);

  /*
   * This whole view answers one question -- WHICH BED -- and only a psychiatric ward referral has
   * that question. An ED, a medical ward and a community team are answered by a person or a team.
   *
   * Said out loud rather than left as an empty candidate list, because the two render almost
   * identically and mean opposite things: an empty list here reads as "the network has no bed for
   * this person", which for a community referral is not a shortage, it is a category error.
   */
  const [reviewUnitId, setReviewUnitId] = useState("");
  const wardArms = wardAddressings(referral);
  const selectedWard = wardArms.find(
    (arm) => arm.destination.kind === "psychiatric_ward" && arm.destination.unitId === reviewUnitId,
  );
  const ward =
    selectedWard?.destination.kind === "psychiatric_ward"
      ? (selectedWard as import("../ward-model").WardAddressing)
      : wardAddressing(referral);
  /**
   * Owner answer 25, 2026-09-17: *"GP referrals: the GP is told by phone or letter for now; add
   * 'GP' as a referral source."* `referralReferrer` (`ward-flow-reducer.ts`) resolves no addressee
   * for `gp`, so a decline here reaches nobody automatically — this is the one place that fact is
   * said out loud to whoever is about to accept or decline, on every branch this view can render,
   * computed once so the two branches below can never carry two different spellings of it.
   */
  const gpSourceNotice =
    referral.source === "gp" ? (
      <p className={styles.matchSummary} data-testid="ward-referral-match-gp-source-notice">
        This system does not contact the GP. Tell them by phone or letter.
      </p>
    ) : null;
  const edAddressing = referral.destinations.find((candidate) => candidate.destination.kind === "emergency_department");
  const communityAddressing = referral.destinations.find(
    (candidate) => candidate.destination.kind === "community_team",
  );
  const senderRole = referralSenderRole(referral);
  const senderLabel = senderRole === "ed" ? "The referring emergency department" : "The referring community team";
  function handleWholeWithdraw() {
    priorRejectionCountRef.current = rejections.length;
    dispatch({
      type: "RECORD_REFERRER_WITHDRAWAL",
      role: withdrawRecorder === "sender" ? senderRole : "coordinator",
      now,
      referralId: referral.id,
    });
    setWithdrawConfirmOpen(false);
    setCheckToken((token) => token + 1);
  }
  /*
   * FD-5: the referrer takes back the WHOLE referral. Every destination still waiting is marked
   * withdrawn; any answer already given stands. Offered only while the reducer would accept it.
   */
  const wholeWithdrawControl = referralWithdrawable(referral) ? (
    <div className={styles.declineControls} data-testid="ward-referral-match-withdraw-controls">
      <label className={styles.fieldLegend} htmlFor="ward-referral-match-withdraw-recorder">
        Referrer cancelled this referral — recorded by
      </label>
      <div className={styles.selectWithActionRow}>
        <select
          id="ward-referral-match-withdraw-recorder"
          data-testid="ward-referral-match-withdraw-recorder"
          className={styles.select}
          value={withdrawRecorder}
          onChange={(event) => setWithdrawRecorder(event.target.value === "sender" ? "sender" : "coordinator")}
        >
          <option value="coordinator">{WARD_FLOW_ROLE_LABELS.coordinator}</option>
          <option value="sender">{senderLabel}</option>
        </select>
        {!withdrawConfirmOpen ? (
          <button
            type="button"
            className={styles.declineButton}
            data-testid="ward-referral-match-withdraw"
            onClick={() => setWithdrawConfirmOpen(true)}
          >
            Withdraw referral
          </button>
        ) : (
          <div className={styles.matchRowTop} data-testid="ward-referral-match-withdraw-confirm-group">
            <button
              type="button"
              className={styles.declineButton}
              data-testid="ward-referral-match-confirm-withdraw"
              onClick={handleWholeWithdraw}
            >
              Confirm withdrawal
            </button>
            <button
              type="button"
              className={styles.acceptButton}
              data-testid="ward-referral-match-cancel-withdraw"
              onClick={() => setWithdrawConfirmOpen(false)}
            >
              Keep referral
            </button>
          </div>
        )}
      </div>
    </div>
  ) : null;
  if (!ward) {
    return (
      <section className={styles.matchPanel} data-testid="ward-referral-match-not-a-bed-question">
        <div className={styles.presentationNoticeCard}>
          <div className={styles.presentationNoticeHeader}>
            <span className={styles.presentationBadge}>Direct Presentation · Non-Inpatient</span>
            <span className={styles.presentationMeta}>Triage &amp; Departmental Review</span>
          </div>
          <p className={styles.matchSummary}>
            {patientInfo ? (
              <>
                <span className={styles.matchHeadingUmrn}>{formatUmrn(patientInfo.umrn)}</span>{" "}
                <span className="sr-only">{referral.id}</span>
              </>
            ) : (
              referral.id
            )}{" "}
            was sent to {referralDestinationLabels(referral).join(", ").toLowerCase()} — none of which is answered by
            matching a bed. There is no bed shortlist for this referral.
          </p>
          {gpSourceNotice}
        </div>

        <div className={styles.presentationActionCard}>
          <div className={styles.presentationActionHeader}>
            <span className={styles.presentationActionTitle}>Departmental Intake Actions</span>
            <span className={styles.presentationActionSubtitle}>Record presentation outcome</span>
          </div>

          {edAddressing && edAddressing.state === "queued" ? (
            <div className={styles.matchRowTop} data-testid="ward-referral-match-accept-controls-emergency_department">
              {!edAcceptConfirmOpen ? (
                <button
                  type="button"
                  className={styles.acceptPresentationBtn}
                  data-testid="ward-referral-match-accept-emergency_department"
                  onClick={() => setEdAcceptConfirmOpen(true)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="15"
                    height="15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Accept presentation / referral</span>
                </button>
              ) : (
                <div
                  className={styles.confirmActionRow}
                  data-testid="ward-referral-match-accept-confirm-group-emergency_department"
                >
                  <button
                    type="button"
                    className={styles.acceptPresentationBtn}
                    data-testid="ward-referral-match-confirm-accept-emergency_department"
                    onClick={handleEdAccept}
                  >
                    Confirm acceptance
                  </button>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    data-testid="ward-referral-match-cancel-accept-emergency_department"
                    onClick={() => setEdAcceptConfirmOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {edAddressing && edAddressing.state === "queued" ? (
            <div
              className={styles.declineControls}
              data-testid="ward-referral-match-decline-controls-emergency_department"
            >
              <label className={styles.fieldLegend} htmlFor="ward-referral-match-decline-reason-emergency_department">
                Decline reason (emergency department)
              </label>
              <div className={styles.selectWithActionRow}>
                <select
                  id="ward-referral-match-decline-reason-emergency_department"
                  data-testid="ward-referral-match-decline-reason-emergency_department"
                  className={styles.select}
                  value={declineReason ?? ""}
                  onChange={(event) => {
                    const chosen = event.target.value;
                    // Membership, never truthiness — same discipline as the ward select above.
                    setDeclineReason(
                      ED_DECLINE_REASONS.includes(chosen as ReferralDeclineReason)
                        ? (chosen as ReferralDeclineReason)
                        : undefined,
                    );
                  }}
                >
                  <option value="">Choose a reason…</option>
                  {ED_DECLINE_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {DECLINE_REASON_LABELS[reason] ?? reason}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.declineButton}
                  data-testid="ward-referral-match-decline-emergency_department"
                  aria-disabled={declineReason === undefined ? "true" : undefined}
                  aria-describedby={
                    declineReason === undefined ? "ward-referral-match-decline-blocked-emergency_department" : undefined
                  }
                  title={declineReason === undefined ? DECLINE_REASON_UNCHOSEN_ED : undefined}
                  onClick={
                    declineReason === undefined
                      ? ignoreUnavailableActivation
                      : () => handleDecline("emergency_department")
                  }
                >
                  Decline referral
                </button>
              </div>
              {declineReason === undefined ? (
                <span id="ward-referral-match-decline-blocked-emergency_department" className="sr-only">
                  {DECLINE_REASON_UNCHOSEN_ED}
                </span>
              ) : null}
            </div>
          ) : null}

          {communityAddressing && communityAddressing.state === "queued" ? (
            <div className={styles.matchRowTop} data-testid="ward-referral-match-accept-controls-community_team">
              {/*
               * RB5 (item 16, 2026-09-17) — "a community team may accept, for follow-up only". Same
               * button style as the ward bed accept above (`styles.acceptButton`), no reason and no
               * unit to gate on (see `handleCommunityAccept`'s own doc comment), so unlike every
               * decline control on this screen this one is never `aria-disabled`.
               */}
              <button
                type="button"
                className={styles.acceptPresentationBtn}
                data-testid="ward-referral-match-accept-community_team"
                onClick={handleCommunityAccept}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Accept referral</span>
              </button>
            </div>
          ) : null}

          {communityAddressing && communityAddressing.state === "queued" ? (
            <div className={styles.declineControls} data-testid="ward-referral-match-decline-controls-community_team">
              <label className={styles.fieldLegend} htmlFor="ward-referral-match-decline-reason-community_team">
                Decline reason (community team)
              </label>
              <div className={styles.selectWithActionRow}>
                <select
                  id="ward-referral-match-decline-reason-community_team"
                  data-testid="ward-referral-match-decline-reason-community_team"
                  className={styles.select}
                  value={communityDeclineReason ?? ""}
                  onChange={(event) => {
                    const chosen = event.target.value;
                    // Membership, never truthiness — same discipline as the ward and ED selects above.
                    setCommunityDeclineReason(
                      COMMUNITY_DECLINE_REASONS.includes(chosen as CommunityDeclineReason)
                        ? (chosen as CommunityDeclineReason)
                        : undefined,
                    );
                  }}
                >
                  <option value="">Choose a reason…</option>
                  {COMMUNITY_DECLINE_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {COMMUNITY_DECLINE_REASON_LABELS[reason]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.declineButton}
                  data-testid="ward-referral-match-decline-community_team"
                  aria-disabled={communityDeclineReason === undefined ? "true" : undefined}
                  aria-describedby={
                    communityDeclineReason === undefined
                      ? "ward-referral-match-decline-blocked-community_team"
                      : undefined
                  }
                  title={communityDeclineReason === undefined ? DECLINE_REASON_UNCHOSEN_COMMUNITY : undefined}
                  onClick={communityDeclineReason === undefined ? ignoreUnavailableActivation : handleCommunityDecline}
                >
                  Decline referral
                </button>
              </div>
              {communityDeclineReason === undefined ? (
                <span id="ward-referral-match-decline-blocked-community_team" className="sr-only">
                  {DECLINE_REASON_UNCHOSEN_COMMUNITY}
                </span>
              ) : null}
            </div>
          ) : null}

          {wholeWithdrawControl}
        </div>

        {lastRejection ? (
          <p className={styles.rejection} data-testid="ward-referral-match-rejection" role="alert">
            {REJECTED_DECISION_LABELS[lastRejection.attempted as (typeof MATCH_VIEW_DECISION_EVENTS)[number]]} not
            recorded: {lastRejection.reason}
          </p>
        ) : null}
        <ReferralHistoryAndCorrections referral={referral} now={now} dispatch={dispatch} />
      </section>
    );
  }
  const candidates = referralCandidates(referral, ward.destination, units, now);
  const accepting = candidates.filter(candidateAccepts);
  const hasCohort = networkHasCohort(referral, units);
  /* Why nobody can take this patient, as three counts. `undefined` whenever somebody can. */
  const noBed = noBedBreakdown(candidates);
  /*
   * Phase 8, Task 4. The grouping is asked for ONCE and everything on this screen below reads that
   * one answer — the group headings, their two counts, each row's own band, and the
   * every-candidate-unrecorded sentence. A second lookup into the fixture for any of those is how
   * one screen ends up giving two answers about the same pair, which is the defect Phase 5 shipped.
   */
  const bandGroups = groupCandidatesByTravelBand(referral, candidates);
  const bandGroupCounts = bandGroups.map(travelBandGroupCounts);
  const groupedUnitCount = bandGroupCounts.reduce((total, counts) => total + counts.units, 0);
  const notRecordedIndex = bandGroups.findIndex((group) => group.band === "not_recorded");
  /* Derived from the grouping's OWN output, never from a second read of the travel-band table. */
  const everyCandidateUnrecorded =
    groupedUnitCount > 0 && notRecordedIndex >= 0 && bandGroupCounts[notRecordedIndex].units === groupedUnitCount;

  const tier1Candidates = candidates.filter(candidateAccepts);
  const tier2Candidates = candidates.filter(
    (c) =>
      !candidateAccepts(c) &&
      c.verdict.gates.every((g) => (g.gate === "allocatable_bed" || g.gate === "capacity_freshness" ? true : g.pass)),
  );
  const tier3Candidates = candidates.filter((c) => !candidateAccepts(c) && !tier2Candidates.includes(c));

  const isTier1Expanded = collapsedTiers[1] !== true;
  const isTier2Expanded = collapsedTiers[2] !== true;
  const isTier3Expanded = collapsedTiers[3] !== true;

  const toggleTier = (tier: number) => {
    setCollapsedTiers((prev) => ({
      ...prev,
      [tier]: prev[tier] !== true,
    }));
  };

  const toggleGates = (id: string) => {
    setExpandedUnitGates((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  /**
   * T12 (item 9, owner answer 9, 17 September 2026), the front door's own half of the same check
   * `shortlist-panel.tsx`'s own `needsGenderPlacement` already applies on the movement path. Read
   * straight off `referral.genderPlacements`, the reducer's own record — never a second,
   * screen-side copy of the rule — so this can never disagree with what `ACCEPT_REFERRAL` will
   * actually accept. `ward.destination.gender` is this referral's own ward-arm gender, never the
   * movement's — a referral is not yet a movement (see this file's own comment on `ward`, above).
   */
  const needsGenderPlacement = (unitId: string) =>
    // R7 (25 September 2026): any gender or recorded sex other than female or male, not only non-binary.
    genderReviewNeeded(ward.destination.gender, ward.destination.sex) &&
    !(referral.genderPlacements ?? []).some((record) => record.unitIds.includes(unitId));

  /**
   * ⚠️ `overrideReason` IS SENT ONLY WHEN A WARD ACTUALLY FAILED A GATE, AND THAT IS A RULE, NOT
   * AN ACCIDENT OF THE CALLERS.
   *
   * The eligible arm below calls this with one argument, so a clean acceptance can never carry a
   * reason. The reducer discards an override that overrode nothing anyway — but relying on it to
   * clean up after this screen would be the wrong shape: a record saying a clinical rule was bent,
   * on an acceptance where none was, is a false entry in the one place anyone would later go
   * looking for the real ones.
   *
   * T12 (item 9): the two gender-placement fields follow the identical discipline — sent only by
   * the gender-placement form below, when `needsGenderPlacement(unitId)` is true, never by the
   * plain "Accept at X" button.
   */
  function handleAccept(
    unitId: string,
    overrideReason?: OverrideReason,
    genderPlacementReason?: GenderPlacementReason,
    genderPlacementChecked?: true,
  ) {
    priorRejectionCountRef.current = rejections.length;
    dispatch({
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now,
      referralId: referral.id,
      destinationKind: "psychiatric_ward",
      unitId,
      overrideReason,
      genderPlacementReason,
      genderPlacementChecked,
    });
    setCheckToken((token) => token + 1);
  }

  /*
   * The optional local-bed step (spec D8-6). One control, on this screen, creating a record only
   * when it is taken — never a field on the intake form, because a form field is the one shape
   * guaranteed to read as owed. It is offered on EVERY referral, not only country ones: offering
   * it only on country referrals would assert that looking closer to home first is a country
   * practice, which is precisely the question nobody has answered.
   */
  function handleLocalBedSought() {
    priorRejectionCountRef.current = rejections.length;
    dispatch({ type: "RECORD_LOCAL_BED_SOUGHT", role: "coordinator", now, referralId: referral.id });
    setCheckToken((token) => token + 1);
  }

  /**
   * Parameterised on `destinationKind` (ward audit 2026-09-16, fix 4) so the same control, the
   * same draft state and the same rejection banner serve both the ward shortlist's own decline
   * button below and the emergency-department decline control the `!ward` branch above now
   * renders — never a second, independently-typed copy of this dispatch that could drift from it.
   * Every caller names its own destinationKind rather than defaulting it, so the reducer is never
   * left to guess which destination replied.
   */
  function handleDecline(destinationKind: ReferralDestinationKind) {
    priorRejectionCountRef.current = rejections.length;
    // ⚠️ GUARDED HERE TOO, NOT ONLY ON THE BUTTON. `aria-disabled` keeps the control focusable on
    // purpose, so it can still be activated — and an unstated reason must never reach the record
    // by that route. Belt and braces, because the thing being prevented is a fabricated clinical
    // judgement rather than an inconvenience.
    if (declineReason === undefined) return;
    dispatch({
      type: "DECLINE_REFERRAL",
      role: "coordinator",
      now,
      referralId: referral.id,
      destinationKind,
      unitId: destinationKind === "psychiatric_ward" ? ward?.destination.unitId : undefined,
      reason: declineReason,
    });
    setCheckToken((token) => token + 1);
  }

  /**
   * The community decline's own dispatch, kept separate from `handleDecline` above rather than
   * parameterised alongside it — `handleDecline` reads `declineReason` (`ReferralDeclineReason`),
   * and a community decline's reason is a `CommunityDeclineReason`, a genuinely different
   * vocabulary (O-16.6) with its own draft state (`communityDeclineReason`) for the reason that
   * state's own doc comment gives. Only ever called for a `community_team` destination, so
   * `destinationKind` is not a parameter here the way it is on `handleDecline`.
   */
  function handleCommunityDecline() {
    priorRejectionCountRef.current = rejections.length;
    // ⚠️ GUARDED HERE TOO, NOT ONLY ON THE BUTTON — same reasoning as `handleDecline` above.
    if (communityDeclineReason === undefined) return;
    dispatch({
      type: "DECLINE_REFERRAL",
      role: "coordinator",
      now,
      referralId: referral.id,
      destinationKind: "community_team",
      reason: communityDeclineReason,
    });
    setCheckToken((token) => token + 1);
  }

  /**
   * RB5 (item 16, 2026-09-17) — "a community team may accept, for follow-up only", and the
   * missing half of this screen's own community control: `handleCommunityDecline` above existed,
   * `handleCommunityAccept` did not, because `EVENT_ROLE.ACCEPT_REFERRAL` did not yet permit
   * `community`. It now does.
   *
   * Dispatched as `role: "coordinator"`, the same as `handleCommunityDecline` and every other
   * decision this coordinator-facing shortlist screen makes on a destination's behalf (`CO-D2`) —
   * this is not the community team's own screen, and a community team acting for itself dispatches
   * as `role: "community"` from `community-screen.tsx` instead. No reason and no unit accompany a
   * community acceptance (`ward-flow-reducer.ts`'s `ACCEPT_REFERRAL` case never asks either of a
   * `community_team` destination), so there is no draft state to gate this button on, unlike the
   * decline control beside it.
   */
  function handleCommunityAccept() {
    priorRejectionCountRef.current = rejections.length;
    dispatch({
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now,
      referralId: referral.id,
      destinationKind: "community_team",
    });
    setCheckToken((token) => token + 1);
  }

  function handleEdAccept() {
    priorRejectionCountRef.current = rejections.length;
    dispatch({
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now,
      referralId: referral.id,
      destinationKind: "emergency_department",
    });
    setEdAcceptConfirmOpen(false);
    setCheckToken((token) => token + 1);
  }

  /**
   * Owner ruling 11 (2026-09-17): the referrer may withdraw JUST a live community-team arm — this
   * screen's own `handleAccept`/`handleDecline` precedent for dispatching a referral-scoped act as
   * `role: "coordinator"` on the referrer's behalf, same as every other control here. Guarded here
   * too, not only by the button's `aria-disabled`, for the same belt-and-braces reason
   * `handleDecline` gives.
   */
  function handleCommunityWithdraw() {
    priorRejectionCountRef.current = rejections.length;
    if (communityWithdrawReason === undefined) return;
    dispatch({
      type: "RECORD_REFERRER_WITHDRAWAL",
      role: "coordinator",
      now,
      referralId: referral.id,
      destinationKind: "community_team",
      reason: communityWithdrawReason,
    });
    setCheckToken((token) => token + 1);
  }

  // This panel answers "what happened to the WARD ask", not "what happened to the referral" —
  // the ward declining leaves the other destinations live (FD-24), so the referral itself may
  // still be queued while this screen has nothing left to offer.
  if (ward.state !== "queued") {
    const acceptedUnit = units.find((unit) => unit.id === ward.acceptedUnitId);
    /*
     * Owner ruling 11 (2026-09-17): the one case this event's own doc comment names — a ward
     * already decided (this branch's whole reason for existing) while a community-team arm the
     * same referral also carries is still live. `RECEIVE_REFERRAL` refuses two destinations of the
     * same kind, so `.find` is exact, the same discipline the `!ward` branch's own community lookup
     * above already holds to.
     */
    const communityAddressing = referral.destinations.find(
      (candidate) => candidate.destination.kind === "community_team",
    );
    const communityArmLive = communityAddressing?.state === "queued" && communityAddressing.withdrawnAt === undefined;
    return (
      <section className={styles.matchPanel} data-testid="ward-referral-match-panel">
        <ReferralIntakeSummary intake={referral.intake} />
        {wardArms.length > 1 && (
          <label className={styles.fieldLabel}>
            Review recipient ward
            <select
              className={styles.select}
              value={ward?.destination.unitId ?? ""}
              onChange={(event) => setReviewUnitId(event.target.value)}
            >
              {wardArms.map(
                (arm) =>
                  arm.destination.kind === "psychiatric_ward" && (
                    <option key={arm.destination.unitId} value={arm.destination.unitId}>
                      {units.find((unit) => unit.id === arm.destination.unitId)?.name ?? arm.destination.unitId} ·{" "}
                      {arm.state}
                    </option>
                  ),
              )}
            </select>
          </label>
        )}
        {/*
         * ⚠️ **THE HEADING CARRIES NO STATE WORD, AND THAT IS DELIBERATE.** It used to render
         * `{referral.id} — {ward.state}`, which put the RAW UNION MEMBER on screen, lowercase and
         * unmapped: a clinician read "RF-006 — cancelled" in an `<h2>`. `.matchHeading` applies no
         * `text-transform`, so that was the literal token. It was a FOURTH spelling of the state
         * word and the only one bypassing `referralAddressingStateLabel`, whose entire purpose is
         * to be the one home — and `cancelled` is the one state whose whole point is that nobody
         * decided it, so a bare token is the worst possible place to lose the sentence.
         * The paragraph below carries the proper wording, from the one home. Do not reintroduce a
         * short state word here: a second, shorter spelling is how the first one got in.
         */}
        <h2 className={styles.matchHeading}>
          {patientInfo ? (
            <>
              <span className={styles.matchHeadingUmrn}>{formatUmrn(patientInfo.umrn)}</span>
              <span className={styles.matchHeadingName}>{patientInfo.displayName}</span>
              <span className="sr-only">{referral.id}</span>
            </>
          ) : (
            referral.id
          )}
        </h2>
        <p data-testid="ward-referral-match-decided">
          {ward.state === "accepted"
            ? acceptedUnit
              ? `Accepted at ${acceptedUnit.name}.`
              : // The board's own spelling of this identical gap (`outcomeDetail`, "Unit not
                // recorded") rather than a second one. The previous text — `Accepted, but no
                // synthetic unit matches "<id>"` — was developer prose on a clinical screen: it
                // named an internal id and the word "synthetic" to somebody deciding about a bed.
                "Accepted — unit not recorded."
            : referralAddressingStateLabel(ward)}
        </p>
        {communityArmLive ? (
          <div className={styles.declineControls} data-testid="ward-referral-match-withdraw-controls-community_team">
            <label className={styles.fieldLegend} htmlFor="ward-referral-match-withdraw-reason-community_team">
              Withdraw reason (community team)
            </label>
            <select
              id="ward-referral-match-withdraw-reason-community_team"
              data-testid="ward-referral-match-withdraw-reason-community_team"
              className={styles.select}
              value={communityWithdrawReason ?? ""}
              onChange={(event) => {
                const chosen = event.target.value;
                setCommunityWithdrawReason(
                  WARD_REQUEST_WITHDRAWAL_REASONS.includes(chosen as WardRequestWithdrawalReason)
                    ? (chosen as WardRequestWithdrawalReason)
                    : undefined,
                );
              }}
            >
              <option value="">Choose a reason…</option>
              {WARD_REQUEST_WITHDRAWAL_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {wardRequestWithdrawalReasonLabels[reason]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.declineButton}
              data-testid="ward-referral-match-withdraw-community_team"
              aria-disabled={communityWithdrawReason === undefined ? "true" : undefined}
              aria-describedby={
                communityWithdrawReason === undefined
                  ? "ward-referral-match-withdraw-blocked-community_team"
                  : undefined
              }
              title={
                communityWithdrawReason === undefined
                  ? "Choose a reason before withdrawing the community team's part of this referral."
                  : undefined
              }
              onClick={communityWithdrawReason === undefined ? ignoreUnavailableActivation : handleCommunityWithdraw}
            >
              Withdraw referral to community team
            </button>
            {communityWithdrawReason === undefined ? (
              <span id="ward-referral-match-withdraw-blocked-community_team" className="sr-only">
                Choose a reason before withdrawing the community team&apos;s part of this referral.
              </span>
            ) : null}
          </div>
        ) : null}
        {wholeWithdrawControl}
        {lastRejection ? (
          <p className={styles.rejection} data-testid="ward-referral-match-rejection" role="alert">
            {REJECTED_DECISION_LABELS[lastRejection.attempted as (typeof MATCH_VIEW_DECISION_EVENTS)[number]]} not
            recorded: {lastRejection.reason}
          </p>
        ) : null}
        <ReferralHistoryAndCorrections referral={referral} now={now} dispatch={dispatch} />
      </section>
    );
  }

  return (
    <section className={styles.matchPanel} data-testid="ward-referral-match-panel">
      <ReferralIntakeSummary intake={referral.intake} />
      {wardArms.length > 1 && (
        <label className={styles.fieldLabel}>
          Review recipient ward
          <select
            className={styles.select}
            value={ward?.destination.unitId ?? ""}
            onChange={(event) => setReviewUnitId(event.target.value)}
          >
            {wardArms.map(
              (arm) =>
                arm.destination.kind === "psychiatric_ward" && (
                  <option key={arm.destination.unitId} value={arm.destination.unitId}>
                    {units.find((unit) => unit.id === arm.destination.unitId)?.name ?? arm.destination.unitId} ·{" "}
                    {arm.state}
                  </option>
                ),
            )}
          </select>
        </label>
      )}
      {!hideDossierHeader ? (
        <div className={styles.matchDossierHeader}>
          <div className={styles.matchDossierTop}>
            <div className={styles.matchIdCluster}>
              <h2 className={styles.matchHeading}>
                {patientInfo ? (
                  <>
                    <span className={styles.matchHeadingUmrn}>{formatUmrn(patientInfo.umrn)}</span>
                    <span className={styles.matchHeadingName}>{patientInfo.displayName}</span>
                    <span className="sr-only">{referral.id}</span>
                  </>
                ) : (
                  referral.id
                )}
              </h2>
              <div className={styles.matchTierRow}>
                <span
                  className={styles.priorityBadge}
                  data-priority={getReferralPriority(referral, now)}
                  data-testid="ward-referral-match-priority"
                >
                  <PriorityGlyph priority={getReferralPriority(referral, now)} />
                  <span className={styles.priorityText}>
                    {referralPriorityLabel(getReferralPriority(referral, now))}
                  </span>
                </span>
                <p className={styles.matchTier} data-testid="ward-referral-match-tier" data-tier={referral.urgency}>
                  {urgencyTierLabel(referral.urgency)}
                </p>
              </div>
            </div>
            <p className={styles.waitBadge} data-testid="ward-referral-match-wait">
              {referralWaitLine(referral, now)}
            </p>
          </div>

          <div className={styles.matchDemographicsStrip}>
            <p className={styles.matchSummary} data-testid="ward-referral-match-summary">
              {referralPersonFacts(referral).join(" · ")}
            </p>
            <p className={styles.matchSummary} data-testid="ward-referral-match-suburb">
              {referral.suburb.kind === "named" ? `From ${referral.suburb.name}` : referralSuburbLabel(referral.suburb)}
            </p>
          </div>

          {gpSourceNotice}
        </div>
      ) : (
        <div className={styles.matchCompactNoticeWrap}>
          <div className="sr-only">
            <span>{referral.id}</span>
            <span data-testid="ward-referral-match-tier" data-tier={referral.urgency}>
              {urgencyTierLabel(referral.urgency)}
            </span>
            <span data-testid="ward-referral-match-wait">{referralWaitLine(referral, now)}</span>
            <span data-testid="ward-referral-match-summary">{referralPersonFacts(referral).join(" · ")}</span>
            <span data-testid="ward-referral-match-suburb">
              {referral.suburb.kind === "named" ? `From ${referral.suburb.name}` : referralSuburbLabel(referral.suburb)}
            </span>
          </div>
          {gpSourceNotice}
        </div>
      )}

      {!hasCohort ? (
        <p className={styles.structuralGap} role="alert" data-testid="ward-referral-match-structural-gap">
          No {referral.ageBand.toLowerCase()} unit exists in this network.
        </p>
      ) : noBed ? (
        <p className={styles.noBedAccepts} role="alert" data-testid="ward-referral-match-no-bed">
          {!aFreeBedCouldChangeThis(noBed)
            ? `No unit in this network can take this patient. All ${noBed.total} are ruled out for clinical, legal or cohort reasons, not for want of a bed — a bed becoming free will not on its own change this. Every reason is listed below.`
            : noBed.notSuitable === 0
              ? `No unit accepts this referral right now. ${noBed.noBedFree > 0 ? `${noBed.noBedFree} of ${noBed.total} have no free bed` : `${noBed.total} of ${noBed.total} have never confirmed a bed count`}${noBed.noBedFree > 0 && noBed.capacityUnknown > 0 ? ` and ${noBed.capacityUnknown} have never confirmed a count` : ""}, so this may change. Every reason is listed below.`
              : `No unit accepts this referral right now. ${noBed.notSuitable} of ${noBed.total} are ruled out for reasons a free bed alone will not change; the remaining ${noBed.total - noBed.notSuitable} turn on a bed. Every reason is listed below.`}
        </p>
      ) : null}

      {hasCohort ? (
        <div
          className={`${styles.unifiedTriageBanner} ${accepting.length === 0 ? styles.unifiedTriageBannerZero : ""}`}
        >
          <div className={styles.triageSummaryRow}>
            <div className={styles.triageLeadText}>
              <span className={styles.triageLargeCount} data-testid="ward-referral-match-accepting-count">
                {accepting.length} of {candidates.length} units accept this referral right now.
              </span>
            </div>
            <div className={styles.triagePillGroup}>
              <span className={`${styles.triageMiniPill} ${accepting.length > 0 ? styles.pillGood : styles.pillMuted}`}>
                ● {tier1Candidates.length} Immediate Vacancies
              </span>
              <span
                className={`${styles.triageMiniPill} ${tier2Candidates.length > 0 ? styles.pillWarn : styles.pillMuted}`}
              >
                ▲ {tier2Candidates.length} Blocked (No Bed)
              </span>
              <span className={`${styles.triageMiniPill} ${styles.pillMuted}`}>
                ✕ {tier3Candidates.length} Excluded
              </span>
            </div>
          </div>
          <div className={styles.governanceDisclosure}>
            <p className={styles.governanceNoticeText} data-testid="ward-referral-match-governance">
              <svg
                className={styles.infoIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width="14"
                height="14"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>
                <strong>Not a medical device.</strong> Every unit is listed in fixed network order — this view places
                nobody: a coordinator decides each placement, one at a time, and nothing is accepted until recorded ·{" "}
                <span className={styles.syntheticNoticeInline} data-testid="ward-referral-match-synthetic-notice">
                  {SYNTHETIC_TRAVEL_TIMES_NOTICE}
                </span>
              </span>
            </p>
          </div>
        </div>
      ) : (
        <div className={styles.matchCompactNoticeWrap}>
          <p className={styles.matchGovernance} data-testid="ward-referral-match-governance">
            <strong>Not a medical device.</strong> Every unit below is listed in the network&apos;s own fixed order.
            This view places nobody: a coordinator decides every placement, one at a time, and nothing is accepted until
            they record it.
          </p>
          <p className={styles.syntheticNotice} data-testid="ward-referral-match-synthetic-notice">
            {SYNTHETIC_TRAVEL_TIMES_NOTICE}
          </p>
        </div>
      )}

      {everyCandidateUnrecorded ? (
        <p className={styles.allNotRecorded} data-testid="ward-referral-match-all-not-recorded">
          <strong>{NOT_RECORDED_LABEL}</strong> — This prototype holds no travel time between this person&apos;s home
          region and these sites. That is a gap in the invented data, not a statement that these beds are far away.
        </p>
      ) : null}

      {/* TIER ACCORDION GROUP — cohesive container with zero white space between closed tabs */}
      <div className={styles.tierAccordionGroup} data-testid="ward-referral-tier-accordion-group">
        {/* TIER 1: AVAILABLE BEDS */}
        <div className={styles.tierCard}>
          <button
            type="button"
            className={`${styles.tierCardHeader} ${isTier1Expanded ? styles.tierCardHeaderExpanded : ""}`}
            onClick={() => toggleTier(1)}
            aria-expanded={isTier1Expanded}
            aria-controls="referral-match-tier-1-body"
          >
            <div className={styles.tierCardHeaderLeft}>
              <span
                className={`${styles.tierChevronChip} ${isTier1Expanded ? styles.tierChevronChipExpanded : ""}`}
                aria-hidden="true"
              >
                ▶
              </span>
              <div className={styles.tierTitleGroup}>
                <span className={styles.tierTitleText}>Available Beds</span>
                <span className="sr-only">TIER 1: READY TO PLACE NOW (IMMEDIATE CONFIRMED VACANCIES)</span>
                <span className={styles.tierSubtitle}>Immediate confirmed vacancies</span>
              </div>
            </div>
            <div className={styles.tierCardHeaderRight}>
              <span
                className={`${styles.tierCountBadge} ${tier1Candidates.length > 0 ? styles.tierCountBadgeActive : styles.tierCountBadgeZero}`}
              >
                {tier1Candidates.length} {tier1Candidates.length === 1 ? "unit available" : "units available"}
              </span>
            </div>
          </button>

          {isTier1Expanded ? (
            <div id="referral-match-tier-1-body" className={styles.tierBody}>
              {tier1Candidates.length === 0 ? (
                <div className={styles.tierEmptyWell}>
                  <span className={styles.tierEmptyIconWrap} aria-hidden="true">
                    ✓
                  </span>
                  <p className={styles.tierEmptyText}>
                    No units in the network currently meet all clinical criteria with an immediately confirmed
                    allocatable bed.
                  </p>
                </div>
              ) : (
                tier1Candidates.map((c) => {
                  const passedGates = c.verdict.gates.filter((g) => g.pass);
                  const totalGates = c.verdict.gates.length;
                  const gateKey = `alt2-t1-${c.unit.id}`;
                  const isGatesExpanded = expandedUnitGates.has(gateKey);
                  const freeBeds = c.unit.allocatable.value;
                  const bedLabel = freeBeds > 0 ? `${freeBeds} ${freeBeds === 1 ? "bed" : "beds"} ready` : "Bed ready";
                  const hospitalName = siteByCode(c.unit.siteCode)?.name ?? c.unit.siteCode;
                  const occPct =
                    c.unit.beds > 0 ? Math.round(((c.unit.beds - c.unit.empty.value) / c.unit.beds) * 100) : 0;

                  return (
                    <div key={c.unit.id} className={`${styles.unitCard} ${styles.unitCardReady}`}>
                      <div className={styles.unitCardTop}>
                        <div>
                          <div className={styles.unitName}>
                            <span>{c.unit.name}</span>
                            <span
                              className={styles.bandAvailableBadge}
                              style={{ fontSize: "var(--text-xs)", padding: "1px 6px" }}
                            >
                              {bedLabel}
                            </span>
                          </div>
                          <div className={styles.unitSub}>
                            {hospitalName} · {c.unit.cohort} · Contact: Not recorded
                          </div>
                        </div>
                        <button type="button" className={styles.btnGood} onClick={() => handleAccept(c.unit.id)}>
                          ✓ Accept Bed at {c.unit.name}
                        </button>
                      </div>

                      <div className={styles.unitIntelRow}>
                        <span>
                          Bed Allocation: <strong>Allocatable bed recorded</strong>
                        </span>
                        <span className={styles.demoDot}>·</span>
                        <span>
                          Transit: <strong>Not recorded</strong>
                        </span>
                        <span className={styles.demoDot}>·</span>
                        <span>
                          Census:{" "}
                          <strong>
                            {c.unit.beds - c.unit.empty.value}/{c.unit.beds} ({occPct}% Occ)
                          </strong>
                        </span>
                      </div>

                      <div className={styles.gateSummary}>
                        <button
                          type="button"
                          className={styles.gateToggle}
                          onClick={() => toggleGates(gateKey)}
                          aria-expanded={isGatesExpanded}
                          aria-controls={`gate-grid-${gateKey}`}
                        >
                          <span>
                            ✓ {passedGates.length}/{totalGates} Statutory & Clinical Criteria Met
                          </span>
                          <span style={{ fontFamily: "var(--mono)", fontSize: "var(--text-xs)" }}>
                            {isGatesExpanded ? "▲ Hide Verification Gates" : "▼ Show Verification Gates"}
                          </span>
                        </button>
                        {isGatesExpanded ? (
                          <div id={`gate-grid-${gateKey}`} className={styles.gateGrid}>
                            {c.verdict.gates.map((g) => (
                              <div key={g.gate} className={`${styles.gatePill} ${styles.gatePillPassed}`}>
                                ✓ {GATE_LABELS[g.gate] ?? g.gate}: {g.detail}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : null}
        </div>

        {/* TIER 2: CAPACITY PENDING */}
        <div className={styles.tierCard}>
          <button
            type="button"
            className={`${styles.tierCardHeader} ${isTier2Expanded ? styles.tierCardHeaderExpanded : ""}`}
            onClick={() => toggleTier(2)}
            aria-expanded={isTier2Expanded}
            aria-controls="referral-match-tier-2-body"
          >
            <div className={styles.tierCardHeaderLeft}>
              <span
                className={`${styles.tierChevronChip} ${isTier2Expanded ? styles.tierChevronChipExpanded : ""}`}
                aria-hidden="true"
              >
                ▶
              </span>
              <div className={styles.tierTitleGroup}>
                <span className={styles.tierTitleText}>Capacity Pending</span>
                <span className="sr-only">TIER 2: CAPACITY CHECKS OUTSTANDING</span>
                <span className={styles.tierSubtitle}>Outstanding capacity checks</span>
              </div>
            </div>
            <div className={styles.tierCardHeaderRight}>
              <span
                className={`${styles.tierCountBadge} ${tier2Candidates.length > 0 ? styles.tierCountBadgeActive : styles.tierCountBadgeZero}`}
              >
                {tier2Candidates.length} {tier2Candidates.length === 1 ? "unit pending" : "units pending"}
              </span>
            </div>
          </button>

          {isTier2Expanded ? (
            <div id="referral-match-tier-2-body" className={styles.tierBody}>
              {tier2Candidates.length === 0 ? (
                <div className={styles.tierEmptyWell}>
                  <span className={styles.tierEmptyIconWrap} aria-hidden="true">
                    ○
                  </span>
                  <p className={styles.tierEmptyText}>No candidates have capacity checks outstanding.</p>
                </div>
              ) : (
                tier2Candidates.map((c) => {
                  const gateKey = `alt2-t2-${c.unit.id}`;
                  const isGatesExpanded = expandedUnitGates.has(gateKey);
                  const hospitalName = siteByCode(c.unit.siteCode)?.name ?? c.unit.siteCode;

                  return (
                    <div key={c.unit.id} className={`${styles.unitCard} ${styles.unitCardTurnaround}`}>
                      <div className={styles.unitCardTop}>
                        <div>
                          <div className={styles.unitName}>
                            <span>{c.unit.name}</span>
                            <span
                              style={{
                                fontSize: "var(--text-xs)",
                                padding: "1px 6px",
                                borderRadius: "10px",
                                background: "var(--warn-soft)",
                                color: "var(--warn)",
                                fontWeight: 700,
                              }}
                            >
                              Capacity unresolved
                            </span>
                          </div>
                          <div className={styles.unitSub}>
                            {hospitalName} · {c.unit.cohort}
                          </div>
                        </div>
                        <div className={styles.unitActionStatusWrap}>
                          <button
                            type="button"
                            className={styles.btnSubtle}
                            aria-disabled="true"
                            aria-describedby={`turnaround-unavailable-${c.unit.id}`}
                            title="Turnaround prioritisation is unavailable: no supported scheduling workflow is recorded here."
                            onClick={ignoreUnavailableActivation}
                          >
                            Flag Turnaround Priority
                          </button>
                          <span id={`turnaround-unavailable-${c.unit.id}`} className={styles.unitNoticeMuted}>
                            This turnaround prioritisation is unavailable: scheduling workflow not recorded
                          </span>
                        </div>
                      </div>

                      <div className={styles.unitIntelRow}>
                        <span>
                          Recorded capacity checks:{" "}
                          <strong>
                            {c.verdict.gates
                              .filter((gate) => !gate.pass)
                              .map((gate) => `${GATE_LABELS[gate.gate] ?? gate.gate}: ${gate.detail}`)
                              .join(" · ")}
                          </strong>
                        </span>
                      </div>

                      <div className={styles.gateSummary}>
                        <button
                          type="button"
                          className={`${styles.gateToggle} ${styles.gateToggleWarn}`}
                          onClick={() => toggleGates(gateKey)}
                          aria-expanded={isGatesExpanded}
                          aria-controls={`gate-grid-${gateKey}`}
                        >
                          <span>Capacity checks outstanding · other recorded gates passed</span>
                          <span style={{ fontFamily: "var(--mono)", fontSize: "var(--text-xs)" }}>
                            {isGatesExpanded ? "▲ Hide Verification Gates" : "▼ Show Verification Gates"}
                          </span>
                        </button>
                        {isGatesExpanded ? (
                          <div id={`gate-grid-${gateKey}`} className={styles.gateGrid}>
                            {c.verdict.gates.map((g) => {
                              const isPending = !g.pass;
                              return (
                                <div
                                  key={g.gate}
                                  className={`${styles.gatePill} ${isPending ? styles.gatePillPending : styles.gatePillPassed}`}
                                >
                                  {isPending ? "○" : "✓"} {GATE_LABELS[g.gate] ?? g.gate}: {g.detail}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : null}
        </div>

        {/* TIER 3: INELIGIBLE UNITS */}
        <div className={styles.tierCard}>
          <button
            type="button"
            className={`${styles.tierCardHeader} ${isTier3Expanded ? styles.tierCardHeaderExpanded : ""}`}
            onClick={() => toggleTier(3)}
            aria-expanded={isTier3Expanded}
            aria-controls="referral-match-tier-3-body"
          >
            <div className={styles.tierCardHeaderLeft}>
              <span
                className={`${styles.tierChevronChip} ${isTier3Expanded ? styles.tierChevronChipExpanded : ""}`}
                aria-hidden="true"
              >
                ▶
              </span>
              <div className={styles.tierTitleGroup}>
                <span className={styles.tierTitleText}>Ineligible Units</span>
                <span className="sr-only">TIER 3: INELIGIBLE CRITERIA EXCLUSIONS & STATUTORY POLICY LOCKOUTS</span>
                <span className={styles.tierSubtitle}>Clinical & policy exclusions</span>
              </div>
            </div>
            <div className={styles.tierCardHeaderRight}>
              <span
                className={`${styles.tierCountBadge} ${tier3Candidates.length > 0 ? styles.tierCountBadgeActive : styles.tierCountBadgeZero}`}
              >
                {tier3Candidates.length} {tier3Candidates.length === 1 ? "unit excluded" : "units excluded"}
              </span>
            </div>
          </button>

          {isTier3Expanded ? (
            <div id="referral-match-tier-3-body" className={styles.tierBody}>
              {tier3Candidates.length === 0 ? (
                <div className={styles.tierEmptyWell}>
                  <span className={styles.tierEmptyIconWrap} aria-hidden="true">
                    ✓
                  </span>
                  <p className={styles.tierEmptyText}>
                    No units in this network are excluded by statutory or cohort criteria.
                  </p>
                </div>
              ) : (
                tier3Candidates.map((c) => {
                  const gateKey = `alt2-t3-${c.unit.id}`;
                  const isGatesExpanded = expandedUnitGates.has(gateKey);
                  const failedGates = c.verdict.gates.filter((g) => !g.pass);
                  const hospitalName = siteByCode(c.unit.siteCode)?.name ?? c.unit.siteCode;

                  return (
                    <div key={c.unit.id} className={`${styles.unitCard} ${styles.unitCardIneligible}`}>
                      <div className={styles.unitCardTop}>
                        <div>
                          <div className={styles.unitName}>
                            <span>{c.unit.name}</span>
                            <span
                              style={{
                                fontSize: "var(--text-xs)",
                                padding: "1px 6px",
                                borderRadius: "10px",
                                background: "var(--danger-soft)",
                                color: "var(--danger)",
                                fontWeight: 700,
                              }}
                            >
                              Statutory Exclusion
                            </span>
                          </div>
                          <div className={styles.unitSub}>
                            {hospitalName} · {c.unit.cohort}
                          </div>
                        </div>
                        <div className={styles.unitActionStatusWrap}>
                          <button
                            type="button"
                            className={styles.btnSubtle}
                            aria-disabled="true"
                            aria-describedby={`clinical-override-unavailable-${c.unit.id}`}
                            title="This clinical override is unavailable. Existing authorised, reason-gated exceptions remain in the ward request workflow."
                            onClick={ignoreUnavailableActivation}
                          >
                            Clinical Override
                          </button>
                          <span id={`clinical-override-unavailable-${c.unit.id}`} className={styles.unitNoticeMuted}>
                            This clinical override is unavailable: reason-gated workflow required
                          </span>
                        </div>
                      </div>

                      <div className={styles.unitIntelRow}>
                        <span>
                          Statutory Barrier:{" "}
                          <strong style={{ color: "var(--danger)" }}>
                            ✕ {failedGates[0]?.detail ?? "Statutory policy restriction"}
                          </strong>
                        </span>
                      </div>

                      <div className={styles.gateSummary}>
                        <button
                          type="button"
                          className={`${styles.gateToggle} ${styles.gateToggleDanger}`}
                          onClick={() => toggleGates(gateKey)}
                          aria-expanded={isGatesExpanded}
                          aria-controls={`gate-grid-${gateKey}`}
                        >
                          <span>
                            ✕ {failedGates.length} of {c.verdict.gates.length} Criteria Failed · Statutory Exclusion
                            Breakdown
                          </span>
                          <span style={{ fontFamily: "var(--mono)", fontSize: "var(--text-xs)" }}>
                            {isGatesExpanded ? "▲ Hide Failed Gate Breakdown" : "▼ Show Failed Gate Breakdown"}
                          </span>
                        </button>
                        {isGatesExpanded ? (
                          <div id={`gate-grid-${gateKey}`} className={styles.gateGrid}>
                            {c.verdict.gates.map((g) => (
                              <div
                                key={g.gate}
                                className={`${styles.gatePill} ${g.pass ? styles.gatePillPassed : styles.gatePillFailed}`}
                              >
                                {g.pass ? "✓" : "✕"} {GATE_LABELS[g.gate] ?? g.gate}: {g.detail}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : null}
        </div>
      </div>

      <section className={styles.geographySection}>
        <div className={styles.geographyHeader}>
          <span className={styles.geographyTitle}>Travel Band Network Triage &amp; Geography Breakdown</span>
          <span className={styles.geographyBadge}>{groupedUnitCount} Units Mapped</span>
        </div>
        <div className={styles.matchList} data-testid="ward-referral-match-list">
          {bandGroups.map((group, index) => (
            <BandGroup
              key={`${group.band}-${bandGroupsOpenByDefault}`}
              group={group}
              counts={bandGroupCounts[index]}
              openByDefault={bandGroupsOpenByDefault}
              onAccept={handleAccept}
              needsGenderPlacement={needsGenderPlacement}
            />
          ))}
        </div>
      </section>

      {/*
       * Rule 3 of the optional step, and the reason this branch has no `else` that renders
       * anything: absence renders as NOTHING AT ALL. No "Not recorded", no empty checkbox, no grey
       * placeholder, no warning icon, no amber row. A referral without the record must look exactly
       * like a referral that never needed one, because it may be one — and no figure anywhere on
       * this screen or any other counts how many referrals lack it.
       */}
      <div className={styles.localBed} data-testid="ward-referral-match-local-bed">
        {referral.localBedSought ? (
          <p className={styles.localBedRecord} data-testid="ward-referral-match-local-bed-sought-record">
            A local bed was sought and none was suitable, at {formatInstant(referral.localBedSought.at)}.
          </p>
        ) : (
          <button
            type="button"
            className={styles.localBedButton}
            data-testid="ward-referral-match-local-bed-sought"
            onClick={handleLocalBedSought}
          >
            Record that a local bed was sought and none was suitable
          </button>
        )}
      </div>

      <div className={styles.declineControls} data-testid="ward-referral-match-decline-controls">
        <label className={styles.fieldLegend} htmlFor="ward-referral-match-decline-reason">
          Decline reason
        </label>
        <select
          id="ward-referral-match-decline-reason"
          data-testid="ward-referral-match-decline-reason"
          className={styles.select}
          value={declineReason ?? ""}
          onChange={(event) => {
            const chosen = event.target.value;
            setDeclineReason(
              REFERRAL_DECLINE_REASONS.includes(chosen as ReferralDeclineReason)
                ? (chosen as ReferralDeclineReason)
                : undefined,
            );
          }}
        >
          <option value="">Choose a reason…</option>
          {REFERRAL_DECLINE_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {DECLINE_REASON_LABELS[reason] ?? reason}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.declineButton}
          data-testid="ward-referral-match-decline"
          aria-disabled={declineReason === undefined ? "true" : undefined}
          aria-describedby={declineReason === undefined ? "ward-referral-match-decline-blocked" : undefined}
          title={declineReason === undefined ? DECLINE_REASON_UNCHOSEN : undefined}
          onClick={declineReason === undefined ? ignoreUnavailableActivation : () => handleDecline("psychiatric_ward")}
        >
          Decline referral
        </button>
        {declineReason === undefined ? (
          <span id="ward-referral-match-decline-blocked" className="sr-only">
            {DECLINE_REASON_UNCHOSEN}
          </span>
        ) : null}
      </div>

      {communityAddressing &&
      communityAddressing.state === "queued" &&
      communityAddressing.withdrawnAt === undefined ? (
        <>
          <div className={styles.matchRowTop} data-testid="ward-referral-match-accept-controls-community_team">
            <button
              type="button"
              className={styles.acceptButton}
              data-testid="ward-referral-match-accept-community_team"
              onClick={handleCommunityAccept}
            >
              Accept referral
            </button>
          </div>
          <div className={styles.declineControls} data-testid="ward-referral-match-decline-controls-community_team">
            <label className={styles.fieldLegend} htmlFor="ward-referral-match-decline-reason-community_team">
              Decline reason (community team)
            </label>
            <select
              id="ward-referral-match-decline-reason-community_team"
              data-testid="ward-referral-match-decline-reason-community_team"
              className={styles.select}
              value={communityDeclineReason ?? ""}
              onChange={(event) => {
                const chosen = event.target.value;
                setCommunityDeclineReason(
                  COMMUNITY_DECLINE_REASONS.includes(chosen as CommunityDeclineReason)
                    ? (chosen as CommunityDeclineReason)
                    : undefined,
                );
              }}
            >
              <option value="">Choose a reason…</option>
              {COMMUNITY_DECLINE_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {COMMUNITY_DECLINE_REASON_LABELS[reason]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.declineButton}
              data-testid="ward-referral-match-decline-community_team"
              aria-disabled={communityDeclineReason === undefined ? "true" : undefined}
              aria-describedby={
                communityDeclineReason === undefined ? "ward-referral-match-decline-blocked-community_team" : undefined
              }
              title={communityDeclineReason === undefined ? DECLINE_REASON_UNCHOSEN_COMMUNITY : undefined}
              onClick={communityDeclineReason === undefined ? ignoreUnavailableActivation : handleCommunityDecline}
            >
              Decline referral
            </button>
            {communityDeclineReason === undefined ? (
              <span id="ward-referral-match-decline-blocked-community_team" className="sr-only">
                {DECLINE_REASON_UNCHOSEN_COMMUNITY}
              </span>
            ) : null}
          </div>
        </>
      ) : null}

      {wholeWithdrawControl}

      {lastRejection ? (
        <p className={styles.rejection} data-testid="ward-referral-match-rejection" role="alert">
          {REJECTED_DECISION_LABELS[lastRejection.attempted as (typeof MATCH_VIEW_DECISION_EVENTS)[number]]} not
          recorded: {lastRejection.reason}
        </p>
      ) : null}
      {!hideDossierHeader ? <ReferralHistoryAndCorrections referral={referral} now={now} dispatch={dispatch} /> : null}
    </section>
  );
}

/**
 * One band group: its heading, its two counts, and the rows in it.
 *
 * `<details>`/`<summary>` rather than a hand-built disclosure, deliberately. The summary — heading
 * and BOTH counts — is rendered whether the group is open or shut, and it is rendered for an empty
 * group exactly as for a populated one, which is the binding condition the owner attached to
 * collapsing at all. Nothing is omitted, nothing is reordered, and the open/shut state depends only
 * on viewport width: never on which band this is, and never on either count. Making an empty group
 * non-collapsible would be exactly that forbidden dependency, so every group behaves the same.
 *
 * The band is taken from the GROUP this row sits in rather than looked up again per row. A band
 * looked up in two places is a band that can disagree with itself, and here the heading and the
 * rows beneath it would be the two places.
 */
function BandGroup({
  group,
  counts,
  openByDefault,
  onAccept,
  needsGenderPlacement,
}: {
  group: TravelBandGroup;
  counts: TravelBandGroupCounts;
  openByDefault: boolean;
  onAccept: (
    unitId: string,
    overrideReason?: OverrideReason,
    genderPlacementReason?: GenderPlacementReason,
    genderPlacementChecked?: true,
  ) => void;
  needsGenderPlacement: (unitId: string) => boolean;
}) {
  const [open, setOpen] = useState(openByDefault);

  const label = travelBandGroupLabel(group.band);
  const hasAvailable = counts.accepting > 0;

  return (
    <details
      className={hasAvailable ? `${styles.bandGroup} ${styles.bandGroupHasAvailable}` : styles.bandGroup}
      data-testid={`ward-referral-match-band-group-${group.band}`}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className={styles.bandSummary}>
        <div className={styles.bandSummaryLead}>
          <span className={styles.bandLabel}>{label}</span>
          {hasAvailable ? (
            <span className={styles.bandAvailableBadge}>
              {counts.accepting} {counts.accepting === 1 ? "bed ready" : "beds ready"}
            </span>
          ) : null}
        </div>
        <span className={styles.bandCounts} data-testid={`ward-referral-match-band-counts-${group.band}`}>
          {travelBandGroupCountsSentence(counts)}
        </span>
      </summary>
      {group.candidates.length === 0 ? (
        <p className={styles.bandEmpty} data-testid={`ward-referral-match-band-empty-${group.band}`}>
          {TRAVEL_BAND_GROUP_EMPTY_SENTENCE}
        </p>
      ) : (
        <ul className={styles.bandRows}>
          {group.candidates.map((candidate) => (
            <MatchRow
              key={candidate.unit.id}
              candidate={candidate}
              bandText={label}
              onAccept={onAccept}
              needsGenderPlacement={needsGenderPlacement(candidate.unit.id)}
            />
          ))}
        </ul>
      )}
    </details>
  );
}

function MatchRow({
  candidate,
  bandText,
  onAccept,
  needsGenderPlacement,
}: {
  candidate: ReferralCandidate;
  bandText: string;
  onAccept: (
    unitId: string,
    overrideReason?: OverrideReason,
    genderPlacementReason?: GenderPlacementReason,
    genderPlacementChecked?: true,
  ) => void;
  needsGenderPlacement: boolean;
}) {
  const { unit } = candidate;
  const [overrideReason, setOverrideReason] = useState<OverrideReason | undefined>(undefined);
  const [genderPlacementReason, setGenderPlacementReason] = useState<GenderPlacementReason | "">("");
  const [genderPlacementChecked, setGenderPlacementChecked] = useState(false);

  const genderPlacementPending =
    needsGenderPlacement &&
    candidate.verdict.gates.some((gate) => gate.gate === "gender_designation" && !gate.pass) &&
    candidate.verdict.gates.filter((gate) => !gate.pass).length === 1;
  const accepts = candidateAccepts(candidate) || genderPlacementPending;
  const totalGates = candidate.verdict.gates.length;
  const passingGates = candidate.verdict.gates.filter((gate) => gate.pass).length;

  return (
    <li
      className={accepts ? styles.matchRowAccepts : styles.matchRowDeclines}
      data-testid={`ward-referral-match-row-${unit.id}`}
    >
      <div className={styles.matchRowTop}>
        <div className={styles.matchUnitInfo}>
          <span className={styles.matchUnitName}>{unit.name}</span>
          {unit.forensic ? (
            <span className={styles.forensicBadge} data-testid={`ward-referral-match-forensic-${unit.id}`}>
              Forensic
            </span>
          ) : null}
        </div>
        {accepts ? (
          <span className={styles.acceptsLabel} data-testid={`ward-referral-match-accepts-${unit.id}`}>
            Accepts this referral
          </span>
        ) : (
          <span className={styles.declinedBadge}>Ineligible / full</span>
        )}
      </div>

      <p className={styles.matchBand} data-testid={`ward-referral-match-band-${unit.id}`}>
        {bandText}
      </p>

      <details className={styles.criteriaDisclosure} data-testid={`ward-referral-match-criteria-${unit.id}`}>
        <summary className={styles.criteriaSummary}>
          <span className={styles.criteriaSummaryTitle}>
            Clinical criteria:{" "}
            <strong>
              {passingGates} of {totalGates} gates met
            </strong>
          </span>
          <span className={styles.criteriaSummaryHint}>{accepts ? "View gates" : "Inspect mismatch"}</span>
        </summary>
        <div className={styles.criteriaList} role="list" aria-label={`Eligibility criteria for ${unit.name}`}>
          {candidate.verdict.gates.map((gate) => (
            <div
              key={gate.gate}
              className={gate.pass ? styles.criteriaPass : styles.criteriaFail}
              role="listitem"
              data-testid={`ward-referral-match-criteria-item-${unit.id}-${gate.gate}`}
            >
              <span className={styles.criteriaGlyph} aria-hidden="true">
                {gate.pass ? "✓" : "✕"}
              </span>
              <span className={styles.criteriaName}>{GATE_LABELS[gate.gate] ?? gate.gate}</span>
              <span className={styles.criteriaDetail}>{gate.detail}</span>
            </div>
          ))}
        </div>
      </details>

      {accepts ? (
        <div className={styles.matchAcceptRow}>
          {needsGenderPlacement ? (
            <form
              className={styles.matchOverrideRow}
              data-testid={`ward-referral-match-gender-placement-form-${unit.id}`}
              onSubmit={(event) => {
                event.preventDefault();
                if (genderPlacementReason === "" || !genderPlacementChecked) return;
                onAccept(unit.id, undefined, genderPlacementReason, true);
              }}
            >
              <p
                className={styles.matchReasonText}
                data-testid={`ward-referral-match-gender-placement-guidance-${unit.id}`}
              >
                Check with the ward first. A single room is preferred.
              </p>
              <p
                className={styles.matchReasonText}
                data-testid={`ward-referral-match-gender-placement-refusal-${unit.id}`}
              >
                {GENDER_PLACEMENT_REFUSAL}
              </p>
              <label
                className={styles.matchOverrideLabel}
                htmlFor={`ward-referral-match-gender-placement-reason-${unit.id}`}
              >
                Reason
              </label>
              <select
                id={`ward-referral-match-gender-placement-reason-${unit.id}`}
                required
                className={styles.matchOverrideSelect}
                data-testid={`ward-referral-match-gender-placement-reason-${unit.id}`}
                value={genderPlacementReason}
                onChange={(event) => {
                  const chosen = event.target.value;
                  setGenderPlacementReason(
                    GENDER_PLACEMENT_REASONS.includes(chosen as GenderPlacementReason)
                      ? (chosen as GenderPlacementReason)
                      : "",
                  );
                }}
              >
                <option value="">Choose a reason…</option>
                {GENDER_PLACEMENT_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
              <label className={styles.matchOverrideLabel}>
                <input
                  type="checkbox"
                  checked={genderPlacementChecked}
                  onChange={(event) => setGenderPlacementChecked(event.target.checked)}
                  data-testid={`ward-referral-match-gender-placement-checked-${unit.id}`}
                />
                I have checked this placement with the ward
              </label>
              <button
                type="submit"
                className={styles.matchOverrideButton}
                disabled={genderPlacementReason === "" || !genderPlacementChecked}
                data-testid={`ward-referral-match-gender-placement-submit-${unit.id}`}
              >
                Record reason and accept at {unit.name}
              </button>
            </form>
          ) : (
            <button
              type="button"
              className={styles.acceptButton}
              data-testid={`ward-referral-match-accept-${unit.id}`}
              onClick={() => onAccept(unit.id)}
            >
              Accept at {unit.name}
            </button>
          )}
        </div>
      ) : (
        <div className={styles.matchDeclineSection}>
          <p className={styles.matchReasonText} data-testid={`ward-referral-match-reason-${unit.id}`}>
            {matchReason(candidate)}
          </p>
          <div className={styles.matchOverrideRow} data-testid={`ward-referral-match-override-${unit.id}`}>
            <label className={styles.matchOverrideLabel} htmlFor={`ward-referral-match-override-reason-${unit.id}`}>
              Accept anyway — record why
            </label>
            <div className={styles.matchOverrideControls}>
              <select
                id={`ward-referral-match-override-reason-${unit.id}`}
                className={styles.matchOverrideSelect}
                data-testid={`ward-referral-match-override-reason-${unit.id}`}
                value={overrideReason ?? ""}
                onChange={(event) => {
                  const chosen = event.target.value;
                  setOverrideReason(
                    OVERRIDE_REASONS.includes(chosen as OverrideReason) ? (chosen as OverrideReason) : undefined,
                  );
                }}
              >
                <option value="">Choose a reason…</option>
                {OVERRIDE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={styles.matchOverrideButton}
                data-testid={`ward-referral-match-override-accept-${unit.id}`}
                aria-disabled={overrideReason === undefined ? "true" : undefined}
                aria-describedby={
                  overrideReason === undefined ? `ward-referral-match-override-blocked-${unit.id}` : undefined
                }
                title={overrideReason === undefined ? OVERRIDE_REASON_UNCHOSEN : undefined}
                onClick={
                  overrideReason === undefined ? ignoreUnavailableActivation : () => onAccept(unit.id, overrideReason)
                }
              >
                Accept anyway at {unit.name}
              </button>
            </div>
            {overrideReason === undefined ? (
              <span id={`ward-referral-match-override-blocked-${unit.id}`} className="sr-only">
                {OVERRIDE_REASON_UNCHOSEN}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </li>
  );
}
