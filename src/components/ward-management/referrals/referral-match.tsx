"use client";

import { ReferralIntakeSummary } from "./referral-intake-summary";
import { useState, type ReactNode } from "react";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import {
  WARD_REQUEST_WITHDRAWAL_REASONS,
  wardRequestWithdrawalReasonLabels,
  type GenderPlacementReason,
  type OverrideReason,
  type WardRequestWithdrawalReason,
} from "@/components/ward-management/ward-change-reasons";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import { NOT_RECORDED_LABEL, SYNTHETIC_TRAVEL_TIMES_NOTICE } from "@/components/ward-management/ward-distance";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import {
  COMMUNITY_DECLINE_REASONS,
  ED_DECLINE_REASONS,
  REFERRAL_DECLINE_REASONS,
  genderReviewNeeded,
  type BedRelease,
  type CommunityDeclineReason,
  type Referral,
  type ReferralDeclineReason,
  type ReferralDestinationKind,
  type Rejection,
  type Unit,
} from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { formatUmrn } from "@/components/ward-management/ward-patients";
import { unitHasLockedBeds } from "@/components/ward-management/ward-bed-designation";
import {
  candidateAccepts,
  COMMUNITY_DECLINE_REASON_LABELS,
  DECLINE_REASON_LABELS,
  groupCandidatesByTravelBand,
  aFreeBedCouldChangeThis,
  networkHasCohort,
  noBedBreakdown,
  referralCandidates,
  travelBandGroupCounts,
  travelBandGroupLabel,
  type ReferralCandidate,
  referralPersonFacts,
  referralAddressingStateLabel,
  referralSuburbLabel,
} from "@/components/ward-management/ward-referrals";
import { getReferralPriority, referralPriorityLabel, PriorityGlyph } from "./referral-priority";
import { referralWaitLine } from "./referral-wait";
import styles from "./referrals.module.css";
import ph from "./referral-match-phone.module.css";
import { Button, StatusGlyph } from "@/components/wf";
import {
  GATE_LABELS,
  DECLINE_REASON_UNCHOSEN,
  DECLINE_REASON_UNCHOSEN_ED,
  DECLINE_REASON_UNCHOSEN_COMMUNITY,
  MATCH_VIEW_DECISION_EVENTS,
  REJECTED_DECISION_LABELS,
} from "./referral-match-model";
import { ReferralHistoryAndCorrections } from "./referral-history-corrections";
import { BandGroup, MatchRow } from "./referral-match-rows";
import { useReferralMatchState } from "./use-referral-match-state";
import { renderNotABedPhoneReview, renderNotABedPanel } from "./referral-match-not-a-bed";
import { renderReferralMatchTiers } from "./referral-match-tiers";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import {
  movementHasOpenTurnaroundRequest,
  referralHasOpenTurnaroundRequest,
  turnaroundEligibilityAllows,
  unitTurnaroundSource,
} from "@/components/ward-management/ward-turnaround-priority";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import { wardRaise } from "@/components/ward-management/ward-flow-raise";

const NO_ADMISSIONS: readonly Admission[] = [];
const NO_RELEASES: readonly BedRelease[] = [];

type ReferralMatchViewProps = {
  referral: Referral;
  units: Unit[];
  now: Instant;
  dispatch: WardCommandDispatch;
  rejections: Rejection[];
  patientInfo?: { displayName: string; umrn: string };
  hideDossierHeader?: boolean;
  /**
   * Carries the decision's completion so the board offers Undo only after acceptance.
   */
  onDecision?: (title: string, completion: ReturnType<WardCommandDispatch>) => void;
  /**
   * v10 phone only. When set, the ward decision renders as the phone's one scrolling sheet: the
   * candidate lists ("Fits, bed ready", "Fits, no bed now", "Needs review") with Decline and Accept
   * pinned at the bottom. The node is the board's own extras (claim, timeline, patient details),
   * rendered under the lists. Same handlers, same dispatches as the desktop view.
   */
  phone?: ReactNode;
  /** For the shared occupancy figure (`ward-occupancy.ts`): occupied plus pulled, over every bed. */
  admissions?: readonly Admission[];
  bedReleases?: readonly BedRelease[];
};

/** Moved to `./referral-history-corrections`; re-exported so imports keep working. */
export { ReferralHistoryAndCorrections };

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
  onDecision,
  phone,
  admissions = NO_ADMISSIONS,
  bedReleases = NO_RELEASES,
}: ReferralMatchViewProps) {
  // Keep every hook above the destination-specific early returns.
  const s = useReferralMatchState({ referral, rejections, dispatch, now });
  const turnaroundState = useOptionalWardFlowSelect(
    "admissions",
    "patients",
    "movements",
    "bedReleases",
    "referrals",
    "plannedAdmissions",
  );
  const cldEnabled = useWardFeatureFlag("top25-criteria-led-discharge");
  const [turnaroundRejectionStart, setTurnaroundRejectionStart] = useState<number | null>(null);
  const turnaroundRejection =
    turnaroundRejectionStart !== null && rejections.length > turnaroundRejectionStart
      ? rejections
          .slice(turnaroundRejectionStart)
          .findLast(
            (rejection) =>
              (rejection.attempted === "FLAG_MOVEMENT_TURNAROUND_PRIORITY" ||
                rejection.attempted === "FLAG_REFERRAL_TURNAROUND_PRIORITY") &&
              (rejection.movementId === referral.id ||
                turnaroundState?.movements.some(
                  (movement) => movement.referralId === referral.id && movement.id === rejection.movementId,
                )),
          )
      : undefined;
  const {
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
    lastRejection,
    priorRejectionCountRef,
    setCheckToken,
    collapsedTiers,
    setCollapsedTiers,
    phonePick,
    setPhonePick,
    phoneDeclining,
    setPhoneDeclining,
    phoneAllFits,
    setPhoneAllFits,
    setReviewUnitId,
    wardArms,
    ward,
    gpSourceNotice,
    edAddressing,
    communityAddressing,
    wholeWithdrawControl,
  } = s;
  if (!ward && phone !== undefined && edAddressing?.state === "queued" && communityAddressing?.state !== "queued") {
    /* v10 phone, ED review: one scrolling sheet with Decline and Accept presentation pinned in the
       foot, as the ward sheet does. Decline opens the reasons as radio rows; Accept asks once. */
    return renderNotABedPhoneReview({ s, referral, patientInfo, phone, handleDecline, handleEdAccept });
  }
  if (!ward) {
    return renderNotABedPanel({
      s,
      referral,
      now,
      dispatch,
      patientInfo,
      phone,
      handleDecline,
      handleEdAccept,
      handleCommunityDecline,
      handleCommunityAccept,
    });
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
  const linkedMovements = turnaroundState?.movements.filter((movement) => movement.referralId === referral.id) ?? [];
  const linkedMovement =
    linkedMovements.find((movement) => !movement.closure && movement.stage !== "arrived" && !movement.acceptedUnitId) ??
    linkedMovements[0];
  const turnaroundForUnit = (unitId: string) => {
    if (!turnaroundState) return { disabledReason: "Live referral and movement records are unavailable." };
    if (
      linkedMovements.filter(
        (movement) => !movement.closure && movement.stage !== "arrived" && !movement.acceptedUnitId,
      ).length > 1
    )
      return { disabledReason: "Multiple linked movements require coordinator review." };
    if (
      linkedMovement &&
      (linkedMovement.closure || linkedMovement.stage === "arrived" || linkedMovement.acceptedUnitId)
    )
      return { disabledReason: "Turnaround preference requires a waiting, unplaced movement." };
    const targetUnit = units.find((unit) => unit.id === unitId);
    const openRequest = linkedMovement
      ? movementHasOpenTurnaroundRequest(turnaroundState, linkedMovement, unitId)
      : referralHasOpenTurnaroundRequest(referral, unitId);
    if (!openRequest)
      return { disabledReason: "Turnaround preference requires an open request for this receiving unit." };
    if (linkedMovement) {
      if (targetUnit) {
        const movementVerdict = eligibility(linkedMovement, targetUnit, now);
        if (!turnaroundEligibilityAllows(movementVerdict, targetUnit)) {
          const blockedGate = movementVerdict.gates.find(
            (gate) =>
              !gate.pass &&
              gate.gate !== "allocatable_bed" &&
              gate.gate !== "capacity_freshness" &&
              !(gate.gate === "security" && unitHasLockedBeds(targetUnit)),
          );
          return {
            disabledReason:
              blockedGate?.detail ?? "The receiving unit's clinical and legal gates must allow this movement.",
          };
        }
      } else {
        return { disabledReason: "The receiving unit is unavailable." };
      }
    }
    const source = unitTurnaroundSource(turnaroundState, unitId, now, cldEnabled);
    if (!source)
      return { disabledReason: "No current CLD-ready admission or unblocked confirmed departure on this unit." };
    const preference = linkedMovement?.turnaroundPriority ?? (linkedMovement ? undefined : referral.turnaroundPriority);
    if (preference?.unitId === unitId && preference.source === source)
      return {
        disabledReason: "Turnaround preference already recorded for this unit.",
        recordedSource: source,
        source,
      };
    return { source };
  };
  const raise = wardRaise(dispatch, "coordinator", now);
  const handleFlagTurnaround = (unitId: string) => {
    const { disabledReason, source } = turnaroundForUnit(unitId);
    if (disabledReason || !source) return;
    setTurnaroundRejectionStart(rejections.length);
    if (linkedMovement) {
      raise("FLAG_MOVEMENT_TURNAROUND_PRIORITY", { movementId: linkedMovement.id, unitId, source });
    } else {
      raise("FLAG_REFERRAL_TURNAROUND_PRIORITY", { referralId: referral.id, unitId, source });
    }
  };
  const tier2Candidates = candidates.filter(
    (c) =>
      !candidateAccepts(c) &&
      c.verdict.gates.every(
        (g) =>
          g.pass ||
          g.gate === "allocatable_bed" ||
          g.gate === "capacity_freshness" ||
          // A clearing locked bed permits staging only. Immediate placement still fails the original verdict.
          (g.gate === "security" &&
            unitHasLockedBeds(c.unit) &&
            turnaroundState &&
            unitTurnaroundSource(turnaroundState, c.unit.id, now, cldEnabled) !== null),
      ),
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
    const completion = dispatch({
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
    onDecision?.(`Accepted at ${units.find((unit) => unit.id === unitId)?.name ?? "the ward"}`, completion);
  }

  /**
   * The tier-1 card's own route into the same gender-placement form: a plain accept there would
   * only meet `GENDER_PLACEMENT_REFUSAL` in the reducer. Opens the unit's travel-band group and
   * moves focus to the form's reason, so the one form (and the one dispatch) stays in `MatchRow`.
   */
  function revealGenderPlacementForm(unitId: string) {
    const reason = document.getElementById(`ward-referral-match-gender-placement-reason-${unitId}`);
    if (!reason) return;
    const group = reason.closest("details");
    if (group && !group.open) group.open = true;
    reason.scrollIntoView?.({ block: "center" });
    reason.focus();
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
  function handleDecline(destinationKind: ReferralDestinationKind, reason: ReferralDeclineReason = declineReason!) {
    priorRejectionCountRef.current = rejections.length;
    // ⚠️ GUARDED HERE TOO, NOT ONLY ON THE BUTTON. `aria-disabled` keeps the control focusable on
    // purpose, so it can still be activated — and an unstated reason must never reach the record
    // by that route. Belt and braces, because the thing being prevented is a fabricated clinical
    // judgement rather than an inconvenience.
    if (reason === undefined) return;
    const completion = dispatch({
      type: "DECLINE_REFERRAL",
      role: "coordinator",
      now,
      referralId: referral.id,
      destinationKind,
      unitId: destinationKind === "psychiatric_ward" ? ward?.destination.unitId : undefined,
      reason,
    });
    setCheckToken((token) => token + 1);
    onDecision?.("Referral declined", completion);
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
    const completion = dispatch({
      type: "DECLINE_REFERRAL",
      role: "coordinator",
      now,
      referralId: referral.id,
      destinationKind: "community_team",
      reason: communityDeclineReason,
    });
    setCheckToken((token) => token + 1);
    onDecision?.("Community referral declined", completion);
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
    const completion = dispatch({
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now,
      referralId: referral.id,
      destinationKind: "community_team",
    });
    setCheckToken((token) => token + 1);
    onDecision?.("Accepted for community follow-up", completion);
  }

  function handleEdAccept() {
    priorRejectionCountRef.current = rejections.length;
    const completion = dispatch({
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now,
      referralId: referral.id,
      destinationKind: "emergency_department",
    });
    setEdAcceptConfirmOpen(false);
    setCheckToken((token) => token + 1);
    onDecision?.("Accepted by the emergency department", completion);
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
            </>
          ) : (
            "This referral"
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
        {renderEdControls()}
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
        {phone}
      </section>
    );
  }

  const communityControls =
    communityAddressing && communityAddressing.state === "queued" && communityAddressing.withdrawnAt === undefined ? (
      <>
        <div className={styles.matchRowTop} data-testid="ward-referral-match-accept-controls-community_team">
          <Button
            variant="pri"
            size="md"
            data-placement-action
            type="button"
            data-testid="ward-referral-match-accept-community_team"
            onClick={handleCommunityAccept}
          >
            Accept referral
          </Button>
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
          <Button
            variant="sec"
            size="md"
            data-placement-action="decline"
            disabledReason={communityDeclineReason === undefined ? DECLINE_REASON_UNCHOSEN_COMMUNITY : undefined}
            reasonDisplay="tooltip"
            type="button"
            data-testid="ward-referral-match-decline-community_team"
            onClick={communityDeclineReason === undefined ? ignoreUnavailableActivation : handleCommunityDecline}
          >
            Decline referral
          </Button>
        </div>
      </>
    ) : null;

  function renderEdControls() {
    return edAddressing && edAddressing.state === "queued" && edAddressing.withdrawnAt === undefined ? (
      <>
        <div
          className={styles.matchRowTop}
          data-confirming={edAcceptConfirmOpen ? "true" : undefined}
          data-testid="ward-referral-match-accept-controls-emergency_department"
        >
          {!edAcceptConfirmOpen ? (
            <Button
              variant="pri"
              size="md"
              data-placement-action
              type="button"
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
              <span>Accept presentation</span>
            </Button>
          ) : (
            <div className={styles.confirmActionRow}>
              <Button
                variant="pri"
                size="md"
                data-placement-action
                type="button"
                data-testid="ward-referral-match-confirm-accept-emergency_department"
                onClick={handleEdAccept}
              >
                Confirm acceptance
              </Button>
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
        <div className={styles.declineControls} data-testid="ward-referral-match-decline-controls-emergency_department">
          <label className={styles.fieldLegend} htmlFor="ward-referral-match-decline-reason-emergency_department">
            Decline reason (emergency department)
          </label>
          <div className={styles.selectWithActionRow}>
            <select
              id="ward-referral-match-decline-reason-emergency_department"
              data-testid="ward-referral-match-decline-reason-emergency_department"
              className={styles.select}
              value={edDeclineReason ?? ""}
              onChange={(event) => {
                const chosen = event.target.value;
                setEdDeclineReason(
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
            <Button
              variant="sec"
              size="md"
              data-placement-action="decline"
              disabledReason={edDeclineReason === undefined ? DECLINE_REASON_UNCHOSEN_ED : undefined}
              reasonDisplay="tooltip"
              type="button"
              data-testid="ward-referral-match-decline-emergency_department"
              onClick={
                edDeclineReason === undefined
                  ? ignoreUnavailableActivation
                  : () => handleDecline("emergency_department", edDeclineReason)
              }
            >
              Decline referral
            </Button>
          </div>
        </div>
      </>
    ) : null;
  }

  const edControls = renderEdControls();

  /*
   * v10 phone: the decision reads as ONE scrolling sheet — three candidate lists, the board's own
   * extras under them, and Decline and Accept pinned at the bottom. Every dispatch below is one of
   * this view's own handlers above; nothing here decides anything the desktop view does not.
   */
  if (phone !== undefined) {
    const bandOf = new Map<string, string>();
    bandGroups.forEach((group) =>
      group.candidates.forEach((candidate) => bandOf.set(candidate.unit.id, travelBandGroupLabel(group.band))),
    );
    // Audit 1, Josh 20 Oct (CS-03, WP-05): no ward starts picked. Accept waits for the coordinator's tap.
    const pick = phonePick === undefined ? undefined : candidates.find((c) => c.unit.id === phonePick);
    const acceptUnavailable =
      candidates.length === 0 ? "No unit to accept at in this network." : "Choose a ward first.";
    const pickPlain = pick !== undefined && candidateAccepts(pick) && !needsGenderPlacement(pick.unit.id);
    const pickTurnaround = pick && tier2Candidates.includes(pick) ? turnaroundForUnit(pick.unit.id) : undefined;
    const FIT_CAP = 3;
    const fitsShown = phoneAllFits ? tier1Candidates : tier1Candidates.slice(0, FIT_CAP);
    const fitsHidden = tier1Candidates.length - fitsShown.length;

    const candRow = (c: ReferralCandidate, kind: "yes" | "nobed" | "review") => {
      const failed = c.verdict.gates.find((gate) => !gate.pass);
      // Capacity-pending candidates can lack any bed, a locked bed, or a current count: name the constraint.
      const noBed = c.verdict.gates.some((gate) => gate.gate === "allocatable_bed" && !gate.pass);
      const noLockedBed = c.verdict.gates.some((gate) => gate.gate === "security" && !gate.pass);
      const label =
        kind === "yes"
          ? "Fits"
          : kind === "nobed"
            ? noBed
              ? "No bed now"
              : noLockedBed
                ? "No locked bed free now"
                : "Count not current"
            : failed
              ? GATE_LABELS[failed.gate]
              : "Review";
      const tone = kind === "yes" ? "success" : kind === "nobed" ? "warning" : "neutral";
      const checked = pick?.unit.id === c.unit.id;
      return (
        <button
          key={c.unit.id}
          type="button"
          role="radio"
          aria-checked={checked}
          className={ph.cand}
          data-kind={kind}
          data-testid={`ward-referral-match-phone-cand-${c.unit.id}`}
          onClick={() => setPhonePick(c.unit.id)}
        >
          <span className={checked ? `${ph.rad} ${ph.radOn}` : ph.rad} aria-hidden="true" />
          <span className={ph.who}>
            <span className={ph.nm}>{c.unit.name}</span>
            <span className={ph.sub}>
              {bandOf.get(c.unit.id) ?? NOT_RECORDED_LABEL} · {c.unit.allocatable.value} ready
            </span>
          </span>
          <span className={ph.lab}>
            <StatusGlyph tone={tone} size={9} />
            {label}
          </span>
        </button>
      );
    };

    const group = (title: string, list: ReferralCandidate[], kind: "yes" | "nobed" | "review") =>
      list.length > 0 ? (
        <>
          <p className={ph.ch}>
            {title} <span className={ph.k}>{list.length}</span>
          </p>
          <div className={ph.cands} role="radiogroup" aria-label={title}>
            {(kind === "yes" ? fitsShown : list).map((c) => candRow(c, kind))}
          </div>
          {kind === "yes" && fitsHidden > 0 ? (
            <button type="button" className={ph.more} onClick={() => setPhoneAllFits(true)}>
              Show {fitsHidden} more with a bed ready
            </button>
          ) : null}
        </>
      ) : null;

    /* A pick that needs a reason (an override, or a gender placement check) accepts through the one
       form `MatchRow` already owns: Accept takes the coordinator to it rather than skipping it. */
    const revealPickForm = () => {
      if (!pick) return;
      const field =
        document.getElementById(`ward-referral-match-gender-placement-reason-${pick.unit.id}`) ??
        document.getElementById(`ward-referral-match-override-reason-${pick.unit.id}`);
      field?.scrollIntoView?.({ block: "center" });
      field?.focus();
    };

    return (
      <section className={`${styles.matchPanel} ${ph.sheet}`} data-testid="ward-referral-match-panel" data-phone="true">
        <div className="sr-only">
          <span>{patientInfo ? formatUmrn(patientInfo.umrn) : "This referral"}</span>
          <span data-testid="ward-referral-match-tier" data-tier={referral.urgency}>
            {urgencyTierLabel(referral.urgency)}
          </span>
          <span data-testid="ward-referral-match-accepting-count">
            {accepting.length} of {candidates.length} units accept this referral right now.
          </span>
        </div>
        {lastRejection ? (
          <p className={styles.rejection} data-testid="ward-referral-match-rejection" role="alert">
            {REJECTED_DECISION_LABELS[lastRejection.attempted as (typeof MATCH_VIEW_DECISION_EVENTS)[number]]} not
            recorded: {lastRejection.reason}
          </p>
        ) : null}

        {turnaroundRejection ? (
          <p role="alert" className={styles.unitNoticeMuted} data-testid="ward-turnaround-rejection">
            Turnaround preference not recorded: {turnaroundRejection.reason}
          </p>
        ) : null}
        {phoneDeclining ? (
          <>
            <p className={ph.ch}>Why decline?</p>
            <div className={ph.cands} role="radiogroup" aria-label="Why decline?">
              {REFERRAL_DECLINE_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  role="radio"
                  aria-checked={declineReason === reason}
                  className={ph.cand}
                  data-testid={`ward-referral-match-phone-decline-${reason}`}
                  onClick={() => setDeclineReason(reason)}
                >
                  <span className={declineReason === reason ? `${ph.rad} ${ph.radOn}` : ph.rad} aria-hidden="true" />
                  <span className={ph.nm}>{DECLINE_REASON_LABELS[reason] ?? reason}</span>
                </button>
              ))}
            </div>
            <p className={ph.matchHint} id="ward-referral-match-decline-blocked">
              {declineReason === undefined ? "Choose a reason to decline." : "Decline records this reason."}
            </p>
          </>
        ) : (
          <>
            {gpSourceNotice}
            {!hasCohort ? (
              <p className={styles.structuralGap} role="alert" data-testid="ward-referral-match-structural-gap">
                No {referral.ageBand.toLowerCase()} unit exists in this network.
              </p>
            ) : noBed ? (
              <p className={ph.matchHint} role="alert" data-testid="ward-referral-match-no-bed">
                No unit accepts this referral right now. Every unit is listed below with its reason.
              </p>
            ) : null}
            {group("Fits, bed ready", tier1Candidates, "yes")}
            {group("Fits, no bed now", tier2Candidates, "nobed")}
            {group("Needs review", tier3Candidates, "review")}
            {pick && pickTurnaround ? (
              <div className={styles.unitActionStatusWrap}>
                <Button
                  variant="sec"
                  size="md"
                  disabledReason={pickTurnaround.disabledReason}
                  onClick={() => handleFlagTurnaround(pick.unit.id)}
                >
                  Flag Turnaround Priority
                </Button>
                <p className={ph.matchHint}>
                  {pickTurnaround.recordedSource
                    ? `Turnaround preference recorded for ${pickTurnaround.recordedSource === "cld" ? "Criteria-Led Discharge" : "confirmed departure"}; placement still needs confirmation.`
                    : `Records a preference for ${pick.unit.name} only; placement and transport still need confirmation.`}
                </p>
              </div>
            ) : null}
            {pick && !pickPlain ? (
              <ul className={`${styles.bandRows} ${ph.pickForm}`}>
                <MatchRow
                  key={pick.unit.id}
                  candidate={pick}
                  bandText={bandOf.get(pick.unit.id) ?? NOT_RECORDED_LABEL}
                  onAccept={handleAccept}
                  needsGenderPlacement={needsGenderPlacement(pick.unit.id)}
                />
              </ul>
            ) : null}
            <p className={ph.note} data-testid="ward-referral-match-governance">
              Not approved for clinical use. Within each group, units follow the network&apos;s fixed order; a
              coordinator decides each placement. {SYNTHETIC_TRAVEL_TIMES_NOTICE}
            </p>
            {phone}
            {referral.localBedSought ? (
              <p className={ph.matchHint} data-testid="ward-referral-match-local-bed-sought-record">
                A local bed was sought and none was suitable, at {formatInstant(referral.localBedSought.at)}.
              </p>
            ) : (
              <button
                type="button"
                className={ph.more}
                data-testid="ward-referral-match-local-bed-sought"
                onClick={handleLocalBedSought}
              >
                Record a local bed was sought
              </button>
            )}
            {communityControls}
            {edControls}
            {wholeWithdrawControl}
          </>
        )}

        <div className={ph.foot}>
          {phoneDeclining ? (
            <>
              <button type="button" className={ph.sec} onClick={() => setPhoneDeclining(false)}>
                Back
              </button>
              <Button
                variant="sec"
                size="md"
                data-placement-action="decline"
                disabledReason={declineReason === undefined ? DECLINE_REASON_UNCHOSEN : undefined}
                reasonDisplay="tooltip"
                type="button"
                data-tone="danger"
                data-testid="ward-referral-match-decline"
                onClick={
                  declineReason === undefined
                    ? ignoreUnavailableActivation
                    : () => {
                        handleDecline("psychiatric_ward");
                        setPhoneDeclining(false);
                      }
                }
              >
                <span className={ph.ell}>Decline referral</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="sec"
                size="md"
                data-placement-action
                type="button"
                onClick={() => setPhoneDeclining(true)}
              >
                Decline
              </Button>
              <Button
                variant="pri"
                size="md"
                data-placement-action
                disabledReason={pick === undefined ? acceptUnavailable : undefined}
                reasonDisplay="tooltip"
                type="button"
                data-testid="ward-referral-match-phone-accept"
                onClick={
                  pick === undefined
                    ? ignoreUnavailableActivation
                    : pickPlain
                      ? () => handleAccept(pick.unit.id)
                      : revealPickForm
                }
              >
                <span className={ph.ell}>
                  {pick ? `Accept at ${pick.unit.name}` : candidates.length === 0 ? "Accept" : "Choose a ward first"}
                </span>
              </Button>
            </>
          )}
        </div>
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
                  </>
                ) : (
                  "This referral"
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
            <span>{patientInfo ? formatUmrn(patientInfo.umrn) : "This referral"}</span>
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
                <span className={styles.triageGlyph}>●</span> {tier1Candidates.length} immediate{" "}
                {tier1Candidates.length === 1 ? "vacancy" : "vacancies"}
              </span>
              <span
                className={`${styles.triageMiniPill} ${tier2Candidates.length > 0 ? styles.pillWarn : styles.pillMuted}`}
              >
                <span className={styles.triageGlyph}>▲</span> {tier2Candidates.length} capacity unresolved
              </span>
              <span className={`${styles.triageMiniPill} ${styles.pillMuted}`}>
                <span className={styles.triageGlyph}>✕</span> {tier3Candidates.length} excluded
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
                <strong>Not approved for clinical use.</strong> Within each group, units follow fixed network order —
                this view places nobody: a coordinator decides each placement, one at a time, and nothing is accepted
                until recorded ·{" "}
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
            <strong>Not approved for clinical use.</strong> Every unit below is listed in the network&apos;s own fixed
            order. This view places nobody: a coordinator decides every placement, one at a time, and nothing is
            accepted until they record it.
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
      {turnaroundRejection ? (
        <p role="alert" className={styles.unitNoticeMuted} data-testid="ward-turnaround-rejection">
          Turnaround preference not recorded: {turnaroundRejection.reason}
        </p>
      ) : null}
      {renderReferralMatchTiers({
        tier1Candidates,
        tier2Candidates,
        tier3Candidates,
        isTier1Expanded,
        isTier2Expanded,
        isTier3Expanded,
        toggleTier,
        expandedUnitGates,
        toggleGates,
        needsGenderPlacement,
        revealGenderPlacementForm,
        handleAccept,
        admissions,
        bedReleases,
        turnaroundForUnit,
        handleFlagTurnaround,
      })}

      <section className={styles.geographySection}>
        <div className={styles.geographyHeader}>
          <span className={styles.geographyTitle}>Travel bands</span>
          <span className={styles.geographyBadge}>{groupedUnitCount} units</span>
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
        <Button
          variant="sec"
          size="md"
          data-placement-action="decline"
          disabledReason={declineReason === undefined ? DECLINE_REASON_UNCHOSEN : undefined}
          reasonDisplay="tooltip"
          type="button"
          data-testid="ward-referral-match-decline"
          onClick={declineReason === undefined ? ignoreUnavailableActivation : () => handleDecline("psychiatric_ward")}
        >
          Decline referral
        </Button>
      </div>

      {communityControls}
      {edControls}

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
