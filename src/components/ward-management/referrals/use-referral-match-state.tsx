import { useEffect, useRef, useState, type Dispatch } from "react";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { type WardRequestWithdrawalReason } from "@/components/ward-management/ward-change-reasons";
import { type Instant } from "@/components/ward-management/ward-clock";
import { WARD_FLOW_ROLE_LABELS, type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { wardAddressing, wardAddressings } from "@/components/ward-management/ward-eligibility";
import {
  type CommunityDeclineReason,
  type Referral,
  type ReferralDeclineReason,
  type Rejection,
} from "@/components/ward-management/ward-model";
import { referralSenderRole, referralWithdrawable } from "@/components/ward-management/ward-referrals";
import styles from "./referrals.module.css";
import { useBandGroupsOpenByDefault, MATCH_VIEW_DECISION_EVENTS } from "./referral-match-model";

/**
 * The match view's state, its rejection check, the ward arm under review and the controls built
 * before any early return, moved unchanged and in their original order from `referral-match.tsx`.
 * Every hook the view has is called here, so none can sit beneath one of its early returns.
 */
export function useReferralMatchState({
  referral,
  rejections,
  dispatch,
  now,
}: {
  referral: Referral;
  rejections: Rejection[];
  dispatch: Dispatch<WardFlowEvent>;
  now: Instant;
}) {
  // S2-14: linked movements gate whole-referral withdrawal (in transit, arrived or closed refuses).
  const linkedMovements = useOptionalWardFlowSelect("movements")?.movements;
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
  const [edDeclineReason, setEdDeclineReason] = useState<ReferralDeclineReason | undefined>(undefined);
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
  // Same async-detection pattern the referral slide-out uses for its own send (`submissionRef`) —
  // `dispatch` never returns whether
  // the reducer accepted or refused an event, so the only way to know is to compare `rejections`
  // before and after, on the next render.
  const priorRejectionCountRef = useRef(rejections.length);
  const [checkToken, setCheckToken] = useState(0);
  const [collapsedTiers, setCollapsedTiers] = useState<Record<number, boolean>>({});
  /* v10 phone sheet: the picked unit, whether the decline reasons are showing, and the fit list cap. */
  const [phonePick, setPhonePick] = useState<string | undefined>(undefined);
  const [phoneDeclining, setPhoneDeclining] = useState(false);
  const [phoneAllFits, setPhoneAllFits] = useState(false);

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
  // Audit 11 Oct 2026: Decide holds the decision; withdrawing sits one tap away in a disclosure.
  const wholeWithdrawControl = referralWithdrawable(referral, linkedMovements) ? (
    <details className={styles.moreActions} data-testid="ward-referral-match-more-actions">
      <summary className={styles.moreActionsSummary}>Referrer cancelled?</summary>
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
    </details>
  ) : null;

  return {
    linkedMovements,
    bandGroupsOpenByDefault,
    declineReason,
    setDeclineReason,
    edDeclineReason,
    setEdDeclineReason,
    expandedUnitGates,
    setExpandedUnitGates,
    communityDeclineReason,
    setCommunityDeclineReason,
    communityWithdrawReason,
    setCommunityWithdrawReason,
    edAcceptConfirmOpen,
    setEdAcceptConfirmOpen,
    withdrawRecorder,
    setWithdrawRecorder,
    withdrawConfirmOpen,
    setWithdrawConfirmOpen,
    lastRejection,
    setLastRejection,
    priorRejectionCountRef,
    checkToken,
    setCheckToken,
    collapsedTiers,
    setCollapsedTiers,
    phonePick,
    setPhonePick,
    phoneDeclining,
    setPhoneDeclining,
    phoneAllFits,
    setPhoneAllFits,
    reviewUnitId,
    setReviewUnitId,
    wardArms,
    selectedWard,
    ward,
    gpSourceNotice,
    edAddressing,
    communityAddressing,
    senderRole,
    senderLabel,
    handleWholeWithdraw,
    wholeWithdrawControl,
  } as const;
}

/** Everything the match view's sections read, from one call per render. */
export type ReferralMatchState = ReturnType<typeof useReferralMatchState>;
