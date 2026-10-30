"use client";

/**
 * Home and Activity mock-up: a copy of the shortlist panel (Placement) with the 30 October review.
 * The ward list leads: the wards that fit, then fits with no bed now; wards that need an override
 * reason, and wards that cannot take the person, sit behind their own disclosures. Each ward card is
 * two lines (name and road time, then its beds); the checks summary lives once, in the eligibility
 * checks for the ward shown; the phone uses the desktop's two fact lines; the tier targets sit at
 * the foot on every size. Every action, guard and record is unchanged from the real panel.
 */

import { currentLegalDueAt, formProgression } from "@/components/ward-management/legal-forms/legal-form-progression";

import { Check, CheckCircle2, CircleAlert, ChevronDown, ChevronUp, Info } from "lucide-react";
import Link from "next/link";
import { flushSync } from "react-dom";
import { movementHref, patientHref, unitHref } from "@/components/ward-management/shell/ward-facade";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { holdOpenForm } from "@/components/wf/sheet-focus";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import { Button, DisabledReason, SrOnly, StatusGlyph, buttonClass, durMinutes, useIsPhone } from "@/components/wf";

import {
  CANCEL_TRANSPORT_REASONS,
  changeReasonLabels,
  ESCALATION_CONTACTS,
  LEGAL_STATUS_CHANGE_REASONS,
  RELEASE_PULL_REASONS,
  URGENCY_CHANGE_REASONS,
  URGENT_MARK_REASONS,
  type UrgentMarkReason,
  type CancelTransportReason,
  type EscalationContact,
  GENDER_PLACEMENT_REASONS,
  GENDER_PLACEMENT_REFUSAL,
  type GenderPlacementReason,
  type LegalStatusChangeReason,
  type ReleasePullReason,
  type UrgencyChangeReason,
  OVERRIDE_REASONS,
  type OverrideReason,
  WARD_REQUEST_WITHDRAWAL_REASONS,
  wardRequestWithdrawalReasonLabels,
  type WardRequestWithdrawalReason,
  wardIntakeConstraintLabels,
} from "@/components/ward-management/ward-change-reasons";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { bedsPendingPreparation, capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import {
  dayOf,
  formatInstantWithDay,
  type Instant,
  isClockBreached,
  MINUTES_PER_DAY,
  minuteOfDayFromClockText,
  minutesUntil,
  splitDuration,
} from "@/components/ward-management/ward-clock";
import { legalFormName, SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import { isOwnedLegalFormCode } from "@/components/ward-management/legal-forms/legal-forms-view";
import { bedHold } from "@/components/ward-management/ward-bed-hold";
import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";
import {
  LATE_ARRIVAL_GRACE_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
} from "@/components/ward-management/ward-operational-defaults";
import {
  candidateReason,
  destinationUnit,
  elapsedLabel,
  blockingGate,
  referralForMovement,
  shortlistCandidates,
  referralBlockedReason,
  needsNoRecordedReason,
  restrictionNotice,
} from "@/components/ward-management/ward-derivations";
import { checkedGates, eligibility, gateMark, type GateResult } from "@/components/ward-management/ward-eligibility";
import {
  ARRIVAL_MODE_LABELS,
  genderReviewNeeded,
  type ArrivalMode,
  type BedRelease,
  type LeaveBed,
  type LegalStatus,
  type Movement,
  type Referral,
  type Rejection,
  type Unit,
  DECLINE_REASON_NOT_SHARED,
} from "@/components/ward-management/ward-model";
import { DECLINE_REASON_LABELS, referralSuburbLabel } from "@/components/ward-management/ward-referrals";
import { useDueSoonThresholds, useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { patientIdentityLine } from "@/components/ward-management/ward-patient-resolver";
import { urgencyTierLabel, waitFactors } from "@/components/ward-management/ward-priority";
import {
  REFERENCE_DISTANCE_CAVEAT,
  referenceDistance,
} from "@/components/ward-management/reference/ward-reference-distances";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { openWardHelp } from "@/components/ward-management/help/ward-help-events";

import styles from "@/components/ward-management/coordinator/coordinator.module.css";
import shortlistStyles from "@/components/ward-management/coordinator/shortlist-panel.module.css";
import mock from "./placement-panel.module.css";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import { FIT_LABEL, fitGroups, type FitKind } from "@/components/ward-management/coordinator/home-fit";
import { NextWardAfterRefusal } from "@/components/ward-management/coordinator/next-ward-after-refusal";
import { PreMatchCleaningNote } from "@/components/ward-management/coordinator/prematch-cleaning-note";
import { TIER_TARGETS_NOTE, queueWaitThresholds } from "@/components/ward-management/coordinator/priority-queue";
import {
  capacityLine,
  Fact,
  focusFirstCandidate,
  GATE_LABELS,
  GLOSSARY_LINK_TEXT,
  InlineFact,
  LEGAL_STATUS_OPTIONS,
  PULLED_EXPLANATION,
  URGENCY_OPTIONS,
} from "@/components/ward-management/coordinator/shortlist-panel-parts";

/** Same defect, on the two unwind controls: option zero submitted as a stated reason nobody stated. */
const UNWIND_REASON_UNCHOSEN =
  "Choose a reason before recording this. None is chosen for you: an unpicked reason would be filed as the coordinator's own stated reason.";

const LEGAL_STATUS_UNCHOSEN =
  "Choose the new legal status before recording the change. None is chosen for you: a status nobody picked would be filed as the patient's legal status.";

const LEGAL_STATUS_REASON_UNCHOSEN =
  "Choose where this entry came from before recording the change. None is chosen for you: a reason nobody picked would be filed as the treating team's own report.";

type ShortlistPanelProps = {
  movement: Movement | undefined;
  now: Instant;
  units: Unit[];
  bedReleases: BedRelease[];
  /**
   * Threaded through only for the ward-detail block's Confirmed/Expected chips
   * (`capacityBreakdown()` takes it) -- `flow-diagram.tsx`'s `UnitNode` already receives it for
   * the same reason and reads the same function. Every other figure this panel renders
   * (`capacityLine`'s four bed states, via `bedStates`) does not need it.
   */
  leaveBeds: LeaveBed[];
  /** Live admissions, so the four bed states can count Pulled beds (`bedStates`). */
  admissions: readonly Admission[];
  /**
   * Every front-door referral this state holds — the same live collection `useWardFlow()` hands
   * back, never a filtered subset. Added so this panel can resolve `movement.referralId` back to
   * its referral and read `referral.suburb`.
   *
   * ⚠️ **COORDINATOR-ONLY, BY WHICH FILE THIS IS.** Nothing here restricts what a caller could pass
   * — this is a screen-scoping decision, not a runtime one, the same way `ward-referral-visibility`'s
   * own doc comment frames FD-23. `ShortlistPanel` lives under `coordinator/` and nothing under
   * `ward/` imports it, so passing the full `referrals` array here cannot by itself put a suburb on
   * a ward-facing screen. Owner ruling, 2026-09-02: a coordinator may see a patient's suburb.
   */
  referrals: Referral[];
  selectedUnitId: string | undefined;
  onSelectUnit: (unitId: string) => void;
  dispatch: WardCommandDispatch;
  /** Task 7 of the audit-wiring plan, 2026-09-16: the coordinator-configured parallel referral
   *  cap — previously the constant PARALLEL_REFERRAL_CAP, read directly in this file. */
  parallelReferralCap: number;
  /** The configured pull hold (`state.configuration.pullHoldMinutes`), the same figure
   *  `coordinator/priority-queue.tsx` reads for its own hold labels. Optional, defaulted, only so
   *  existing direct-render tests keep their older prop set. */
  pullHoldMinutes?: number;
  /**
   * Home (option B, Josh, 13 Oct 2026; D-30): when given, Refer hands the chosen wards (none is
   * fine) to the page, which opens the referral slide-out for this person so the referral reaches
   * the coordinator queue rather than offering the ward at once. Never greyed: the coordinator is
   * never blocked. Absent (direct-render tests), Refer dispatches `REFER_TO_UNITS` as before.
   */
  onRefer?: (unitIds: string[], unitNames: string[]) => void;
};

/**
 * Task 5 fix round 1. Refer no longer carries any local "you just did this" record — see the
 * comment above `handleRefer` for why: the "Parallel referral" badges above already render
 * straight from `movement.referredUnitIds`, the reducer's own live output, so a second,
 * optimistic local flag would only ever be a second place for the truth to diverge from.
 *
 * ⚠️ **CORRECTED 2026-08-30. THIS PARAGRAPH SAID `REFER_TO_UNITS` CARRIES NO REASON FIELD, AND IT
 * HAD STOPPED BEING TRUE.** The event now carries `overrideReason?: OverrideReason`, the reducer
 * validates it against `OVERRIDE_REASONS` by membership and rejects anything outside the list, and
 * a present reason is stored on `Movement.overrides` — which is the whole of owner decision `OD-3`.
 * The control beside it is a `<select>` over that same list, never a textarea.
 *
 * ⚠️ **AND THE FIRST VERSION OF THIS CORRECTION WAS ITSELF WRONG, WHICH IS THE MORE USEFUL HALF.**
 * It said the paragraph had "misinformed another session" — that Ward Referrals read a rotted
 * comment and filed a request for work already done. **That was not what happened.** The reason
 * field exists on `claude/ward-flow-phases-6-7-design` and does NOT exist on
 * `claude/ward-flow-wave1-referral-corrections`, where that session was standing. **On its branch
 * both the comment and its request were correct.** There was no stale comment and no victim; there
 * were two branches, and I compared its report against my own working tree and read the difference
 * as its mistake.
 *
 * So this paragraph is stale HERE, on this branch, from the day `OD-3` landed here — and it is
 * accurate anywhere the event has not arrived. **An observation carries its branch as well as its
 * date, and a fact with its position stripped off looks like a fact about the world.** I had quoted
 * that exact rule at another session hours earlier, after it reported a defect class closed from a
 * grep on one branch.
 *
 * Override still keeps local state, for a smaller reason than the one this used to give: the
 * `<select>` needs a value between choosing a reason and submitting it. This record is never
 * trusted at face value either: `overrideSucceeded` below reads
 * `movement.referredUnitIds` fresh on every render and only renders a success message when those
 * ids are actually present there, so a refused override (the movement was not in a referable
 * stage, or any other reducer-side reason) can never be reported as one that happened.
 */
type OverrideRecord = { unitIds: string[]; at: Instant; reason: string };

/**
 * Neither a Form 1A nor a Form 3B carries a `dueAt` in this model (see `LegalForm`'s own doc
 * comment in ward-model.ts). For that case this states the form and the real elapsed ED time via
 * the existing `elapsedLabel` (never a new formatter), worded as time IN the department rather
 * than time left against anything, so it can never be misread as a statutory countdown the way a
 * bare number next to a form code could be.
 *
 * The wording is deliberately "no deadline recorded", not "no statutory deadline". It reports
 * what THIS RECORD holds, which is all we can verify. "No statutory deadline" asserts what the
 * Mental Health Act requires, and that is a legal claim this prototype is not entitled to make in
 * either direction — asserting an absence is the same overreach as asserting the seven-day figure
 * that was deleted on 2026-08-23.
 */
function legalFormLine(movement: Movement, now: Instant) {
  if (!movement.legalForm) return "No legal form recorded";
  const formCode = `Form ${movement.legalForm.code}`;
  const progression = formProgression(movement);
  if (progression) return `${formCode} ended ${progression.endedWhen}; Form ${progression.nextCode} to record`;
  const dueAt = currentLegalDueAt(movement);
  if (dueAt === undefined) {
    // States what the record holds, never what the Act requires (tests/ward-legal-figure-guard.test.ts).
    return `${formCode} · no deadline recorded (${elapsedLabel(movement, now)} in ED)`;
  }
  const remaining = minutesUntil(dueAt, now);
  // "passed its deadline" is pinned by tests/ward-legal-figure-guard.test.ts (finding 7).
  // Plain times on every layout ("2d 8h ago", "6h 40m"), never a bare count of minutes: the same
  // formatter as the queue's form line in ward-priority.ts (Home placement redesign, Josh 19 Oct
  // 2026). Only the recorded deadline is reformatted; nothing new is computed.
  return remaining < 0
    ? `${formCode} passed its deadline ${splitDuration(Math.abs(remaining))} ago`
    : `${formCode} due in ${splitDuration(remaining)}`;
}

/**
 * The explainable shortlist: where the placement decision is actually made. Every gate row states
 * its own verdict in real text (never icon-only), every gate the verdict carries renders (never
 * `.slice()`), an ineligible candidate is never presented or styled as a recommendation, and
 * nothing is allocated until a human clicks Confirm or records an override reason.
 *
 * Controller finding this task exists to close: the whole-branch review found a green tick
 * rendered beside "is not authorised under the Mental Health Act" — a gate row whose icon was
 * driven by something other than the gate's own `pass` boolean. Every icon below reads directly
 * off `gate.pass`; nothing else is permitted to decide it (see the report's red/green proof).
 */
const NO_REJECTIONS: readonly Rejection[] = [];

export function PlacementPanel({
  movement,
  now,
  units,
  bedReleases,
  leaveBeds,
  admissions,
  referrals,
  selectedUnitId,
  onSelectUnit,
  dispatch,
  parallelReferralCap,
  pullHoldMinutes = defaultWardConfiguration().pullHoldMinutes,
  onRefer,
}: ShortlistPanelProps) {
  // Owner, 26 Sept 2026: the patient's name, not the WF journey number. Called unconditionally,
  // ahead of the `if (!movement)` early return below, so the hook order stays fixed.
  const thresholds = useDueSoonThresholds();
  const resolvePatientIdentity = usePatientOf();
  // Phone (v10 Home "Patient open"): a 2x2 facts card and less text. Desktop is unchanged.
  const isPhone = useIsPhone();
  // S-8: "Accept for this ward" offers Undo on the toast, like the ward's own acceptance. Read
  // through the context, not `useWardFlow()`, so a direct render without a provider still works.
  const flowContext = useOptionalWardFlowSelect("rejections", "setFocusMovementId");
  const flowRejections = flowContext?.rejections ?? NO_REJECTIONS;
  const flowSetFocusMovementId = flowContext?.setFocusMovementId;
  const [outcomeMessage, setOutcomeMessage] = useState<string | null>(null);
  const { run: runStep } = useUndoableStep({
    dispatch,
    rejections: flowRejections,
    now,
    routeRole: "coordinator",
    onMessage: setOutcomeMessage,
  });
  const holdLabel = pullHoldMinutes % 60 === 0 ? `${pullHoldMinutes / 60}h` : splitDuration(pullHoldMinutes);
  /**
   * ⚠️ EVERY WARD, NOT A FILTERED THREE. This was `eligibleCandidatesAmong(…, PARALLEL_REFERRAL_CAP)`,
   * which dropped every unit of a different cohort BEFORE eligibility was computed and then cut the
   * remainder to a length borrowed from a rule about how many places one referral may be SENT to.
   * A coordinator could not see those wards, reason about them, or override them — they were not
   * there. Hiding them was defensible while the engine refused a mismatched placement outright, and
   * became the defect the moment a judgement gate turned overridable with a recorded reason.
   */
  const shortlist = useMemo(() => (movement ? shortlistCandidates(movement, units, now) : []), [movement, units, now]);
  /** What a coordinator can act on: take it, or take it with a reason. Never collapsed, at any count. */
  const offerable = useMemo(() => shortlist.filter((c) => c.availability !== "unavailable"), [shortlist]);
  /** FitHighlight groups (v10 Home): fits with a bed, fits with no bed now, needs review, and what
   *  no reason can buy (collapsed behind a disclosure that states its count). */
  const groups = useMemo(() => fitGroups(shortlist, movement), [shortlist, movement]);
  const [unavailableOpen, setUnavailableOpen] = useState(false);
  // Wards that take this person only with an override reason sit behind one disclosure, so the
  // wards that fit lead; it opens itself while one of them is chosen.
  const [reviewOpen, setReviewOpen] = useState(false);
  const [candidatesOpen, setCandidatesOpen] = useState(true);
  // A collapsed Candidates list hides every ward, so open it before taking the person there.
  const chooseWard = (from: HTMLElement) => {
    if (!candidatesOpen) flushSync(() => setCandidatesOpen(true));
    focusFirstCandidate(from);
  };

  // The unit whose gates this panel currently explains. A selection carried over from another
  // page (the diagram shares the same `selectedUnitId` state) is honoured even when it falls
  // outside this movement's own candidate list — the truth about an arbitrary unit against this
  // movement is still real data, never fabricated. With nothing selected, this defaults to the
  // list's own first (eligible-first) candidate, so the gate list is never empty the moment a
  // movement is chosen.
  //
  // Whole-branch review Critical 2: this default is ORIENTATION ONLY. It may never be the thing
  // Refer acts on — see `canRefer` below.
  //
  // Whole-branch review Critical 1: resolved from the live `units` the provider hands back —
  // never `unitById`, which reads the frozen fixture and would still call this ward "Eligible
  // now" after it confirmed zero allocatable beds on its own screen.
  const acceptedUnitId = movement?.acceptedUnitId;
  const activeUnit = useMemo(() => {
    if (selectedUnitId) return units.find((unit) => unit.id === selectedUnitId);
    // Audit A1-20: once a destination is accepted, explain that ward's gates, not the list's first.
    const accepted = acceptedUnitId ? units.find((unit) => unit.id === acceptedUnitId) : undefined;
    return accepted ?? shortlist[0]?.unit;
  }, [selectedUnitId, shortlist, units, acceptedUnitId]);

  const activeVerdict = useMemo(() => {
    if (!movement || !activeUnit) return undefined;
    const cached = shortlist.find((candidate) => candidate.unit.id === activeUnit.id);
    return cached ? cached.verdict : eligibility(movement, activeUnit, now);
  }, [movement, activeUnit, shortlist, now]);

  // Failures first, stable otherwise — never a `.slice()`. Every gate the verdict carries renders;
  // the count is whatever `eligibility()` emitted, never a number written down here.
  const sortedGates: GateResult[] = useMemo(
    () => (activeVerdict ? [...activeVerdict.gates].sort((a, b) => Number(a.pass) - Number(b.pass)) : []),
    [activeVerdict],
  );
  // Information-only gates (acuity, specialling) are listed but never counted as checks met.
  const checkedCount = useMemo(() => checkedGates(sortedGates).length, [sortedGates]);
  const metCount = useMemo(() => checkedGates(sortedGates).filter((g) => g.pass).length, [sortedGates]);
  const notMetCount = checkedCount - metCount;
  const eligibilityDetailsRef = useRef<HTMLDetailsElement>(null);

  /**
   * The ward detail block, matching the Command mockup's `wardDetailHtml()` — that ward's own bed
   * states, in this column, once a ward is selected. Not a re-derivation: `bedStates` is the
   * exact function `capacityLine` above already calls for Ready/Pulled/Closed/Occupied, and
   * `capacityBreakdown` is the exact function `flow-diagram.tsx`'s `UnitNode` already calls for
   * Confirmed/Expected — so this block can never show a figure either of those two surfaces
   * contradicts.
   *
   * ⚠️ Confirmed and Expected are drawn from `capacityBreakdown` (bed releases), never from
   * `unit.beds`, and are never summed into the four bed states — the same
   * ruling `coordinator.module.css`'s `.diagramBedChip[data-state="confirmed"]` comment records.
   */
  const activeCapacity = useMemo(
    () => (activeUnit ? bedStates(activeUnit, admissions, bedReleases, leaveBeds) : undefined),
    [activeUnit, admissions, bedReleases, leaveBeds],
  );
  const activeBreakdown = useMemo(
    () => (activeUnit ? capacityBreakdown(activeUnit, bedReleases, leaveBeds, now) : undefined),
    [activeUnit, bedReleases, leaveBeds, now],
  );
  // 🔴 THE READY FIGURE IS CORRECT AND MUST NOT CHANGE. Nothing is subtracted from it for this —
  // see `capacityLine`'s own comment above and `flow-diagram.tsx`'s `UnitNode` for the ruling this
  // repeats a third time. `activeCapacity.ready` is rendered untouched below.
  const activePendingPreparation = activeUnit ? bedsPendingPreparation(activeUnit.id, bedReleases) : 0;

  const [overrideRecord, setOverrideRecord] = useState<OverrideRecord | undefined>(undefined);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const isOverrideDirty = overrideReason.trim().length > 0;
  const handleRestoreOverride = useCallback((cached: string) => {
    setOverrideReason(cached);
    setOverrideOpen(true);
  }, []);

  const { clearDraft: clearOverrideDraft } = useDirtyStateGuard({
    key: movement?.id ? `shortlist-override-${movement.id}` : undefined,
    isDirty: isOverrideDirty,
    value: overrideReason,
    onRestore: handleRestoreOverride,
    confirmMessage: "You have an unsaved clinical override reason. Are you sure you want to leave?",
  });
  /**
   * T12 (item 9, owner answer 9, 17 September 2026): the coordinator's own "checked with the
   * ward" pair for a `Non-binary` placement — two separate facts, neither standing in for the
   * other, the same discipline `ward-screen.tsx`'s own acuity-override tick holds to. Starts
   * unanswered/unticked; nothing here is chosen for the coordinator.
   */
  const [genderPlacementReason, setGenderPlacementReason] = useState("");
  const [genderPlacementChecked, setGenderPlacementChecked] = useState(false);
  const [confirmationMovementId, setConfirmationMovementId] = useState(movement?.id);
  // Task 5: which candidate wards a human has explicitly picked to refer to, capped at
  // `PARALLEL_REFERRAL_CAP`. This is a separate, multi-select truth from `selectedUnitId` (which
  // stays single-valued and shared with the diagram, driving only which candidate's gates are
  // shown) — a coordinator can refer to up to three wards at once, but the diagram and the gate
  // list can only ever explain one at a time.
  //
  // ⚠️ RA1 (item 18): HOLDS ONLY NEWLY-PICKED, NOT-YET-LIVE WARDS. A ward already carrying a live
  // referral (`movement.referredUnitIds`) is shown pre-selected and locked without ever entering
  // this state — see `toggleReferTarget` and the candidate list below. `REFER_TO_UNITS` now unions
  // whatever this dispatches with the movement's own live list, so re-referring can only ever ADD.
  const [referTargets, setReferTargets] = useState<string[]>([]);
  // RA1 (item 18): which live ward's "Withdraw this request" form is open, and the reason chosen
  // in it. Mirrors `releasePullOpen`/`releasePullReason` above — the form only ever renders for a
  // ward that is genuinely live, so it can never advertise an action the reducer would refuse.
  const [withdrawUnitId, setWithdrawUnitId] = useState<string | undefined>(undefined);
  // L3: after an acceptance the next step leads; the bed list stays one tap away ("Find another bed"),
  // so the coordinator can still change the destination or override. Keyed by movement.
  const [otherBedsFor, setOtherBedsFor] = useState<string | undefined>(undefined);
  const [withdrawReason, setWithdrawReason] = useState<WardRequestWithdrawalReason | "">("");
  // Whole-branch review I2 (spec §11): the escalation form's own open/typed-contact state — never
  // the recorded fact itself, which lives on `movement.escalation` and is read fresh on every
  // render, the same discipline `overrideSucceeded` already holds to for the override record.
  const [escalationOpen, setEscalationOpen] = useState(false);
  // Task 6 (spec item 11): chosen, never typed — the free-text `escalationContact` string state
  // this replaces is gone. Finding 110 (27 Oct 2026): opens blank, like every list that records a
  // choice, so Record escalation cannot be pressed without choosing who is being contacted.
  const [escalationContact, setEscalationContact] = useState<EscalationContact | "">("");
  // Task 2: urgency and legal status can change mid-flight. Both a coordinator and the referring
  // ED clinician may make either change (`EVENT_ROLE.CHANGE_URGENCY`/`CHANGE_LEGAL_STATUS`), so
  // this panel dispatches as role "coordinator" — the ED screen's own controls dispatch as "ed".
  const [urgencyChangeOpen, setUrgencyChangeOpen] = useState(false);
  // Finding 156 (Josh, 27 Oct 2026): one urgency control, with Urgent above tier 1. The engine still
  // keeps the flag and the tier apart, so Urgent raises `FLAG_MOVEMENT_URGENT` (its reason is still
  // asked) and a tier clears the flag before `CHANGE_URGENCY`.
  const [urgencyDraft, setUrgencyDraft] = useState<{
    urgency: 1 | 2 | 3 | "urgent";
    reason: UrgencyChangeReason | undefined;
    urgentReason: UrgentMarkReason | undefined;
  }>({
    urgency: movement?.flaggedUrgent ? "urgent" : (movement?.urgency ?? 1),
    reason: undefined,
    urgentReason: undefined,
  });
  const [legalStatusChangeOpen, setLegalStatusChangeOpen] = useState(false);
  const [legalStatusDraft, setLegalStatusDraft] = useState<{
    // Starts UNCHOSEN as well (owner rule, 19 Oct 2026): legal status is never prefilled, so the
    // current status or a default left standing cannot be recorded as a change nobody chose.
    legalStatus: LegalStatus | undefined;
    reason: LegalStatusChangeReason | undefined;
    // Starts UNCHOSEN. `recorded_by_treating_team` used to be pre-selected, so a coordinator
    // correcting a mistyped legal status who never touched the control filed the correction as a
    // fresh report FROM the treating team — a team that never made one. The two options say where
    // the entry came from, not why a status changed: an audit-trail defect, not a clinical one.
  }>({ legalStatus: movement?.legalStatus ?? "Voluntary", reason: undefined });
  // Finding 120 (Josh, 27 Oct 2026): a status that rests on paper asks for the form and the time it
  // was made in the same step. Both open blank and never block the status change; the form is
  // recorded (`RECORD_LEGAL_FORM_WRITTEN`) only when its code and time are both given.
  const [legalFormDraft, setLegalFormDraft] = useState<{ code: string; time: string; day: 0 | -1 }>({
    code: "",
    time: "",
    day: 0,
  });
  // Audit 4 A4-01: while either form is open, a save from it is checked against the board it
  // opened on, as a popup's is, so another desk's change meanwhile is reported, not overwritten.
  const recordFormOpen = urgencyChangeOpen || legalStatusChangeOpen;
  useEffect(() => (recordFormOpen ? holdOpenForm() : undefined), [recordFormOpen]);
  // Task 3: the undo the prototype has never had. Both forms only ever OPEN when the reducer
  // would actually accept the event — see `canReleasePull`/`canCancelTransport` below — so
  // neither control can advertise an action the reducer would silently refuse.
  const [releasePullOpen, setReleasePullOpen] = useState(false);
  const [releasePullReason, setReleasePullReason] = useState<ReleasePullReason | undefined>(undefined);
  const [cancelTransportOpen, setCancelTransportOpen] = useState(false);
  const [cancelTransportReason, setCancelTransportReason] = useState<CancelTransportReason | undefined>(undefined);

  // A confirmation, an open override form, or a referral selection all belong to the movement
  // they were made against — moving to a different movement must never leave a stale "Referred"
  // record from the last one on screen, a half-typed override reason attached to the wrong
  // patient, or a ward selection meant for a different patient. Reset during render (React's
  // documented "adjusting state when a prop changes" pattern) rather than in an effect — an
  // effect body calling `setState` synchronously forces an extra, avoidable render pass.
  if (movement?.id !== confirmationMovementId) {
    setConfirmationMovementId(movement?.id);
    setOverrideRecord(undefined);
    setOverrideOpen(false);
    setOverrideReason("");
    // ⚠️ DO NOT CLEAR THE PERSISTED DRAFT HERE. `useDirtyStateGuard` has already been called with the
    // NEWLY selected movement's key by the time this render-time reset runs, so clearing here would
    // delete the draft of the movement being ARRIVED AT (and leave the one being left). Drafts are
    // kept per movement; only the on-screen state resets, and returning to a movement restores its
    // own draft. A draft is removed only on submit (below), where the key is still the right one.
    setReferTargets([]);
    setEscalationOpen(false);
    setEscalationContact("");
    setUrgencyChangeOpen(false);
    setUrgencyDraft({
      urgency: movement?.flaggedUrgent ? "urgent" : (movement?.urgency ?? 1),
      reason: undefined,
      urgentReason: undefined,
    });
    setLegalStatusChangeOpen(false);
    setLegalStatusDraft({ legalStatus: undefined, reason: undefined });
    setLegalFormDraft({ code: "", time: "", day: 0 });
    setReleasePullOpen(false);
    setReleasePullReason(undefined);
    setCancelTransportOpen(false);
    setCancelTransportReason(undefined);
    setWithdrawUnitId(undefined);
    setWithdrawReason("");
    setGenderPlacementReason("");
    setGenderPlacementChecked(false);
  }

  if (!movement) {
    return (
      <p className={styles.placeholder}>Select a movement from the priority queue to see its explainable shortlist.</p>
    );
  }

  // TypeScript's narrowing of `movement` above does not reach into the `handleRefer` /
  // `handleOverrideSubmit` / `submitEscalation` closures defined further down, so these plain
  // values are what they close over instead of re-checking `movement` themselves.
  const movementId = movement.id;
  const movementForRows: Movement = movement;
  // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
  const patientIdentity = resolvePatientIdentity(movement);
  const patientWho = patientIdentity.displayName;
  const patientUmrn = patientIdentity.umrn;
  // Waiting against the tier target, the same figures the queue reads (status from the clinical
  // values file, labelled where they drive a figure).
  const waitedMinutes = Math.max(0, now - movement.openedAt);
  const targetMinutes = queueWaitThresholds(movement.urgency).overdue;
  const overTarget = waitedMinutes >= targetMinutes;
  const declinedUnitIds = movement.declines.map((decline) => decline.unitId);
  // RA1 (item 18): the same discipline, for `toggleReferTarget` below — a live ward's id, read
  // once rather than through `movement.referredUnitIds` inside that closure.
  const liveUnitIds = movement.referredUnitIds;

  // Task 3: each control renders ONLY when the reducer would accept it — never dispatched
  // optimistically and left for the reducer to refuse silently (the defect Task 5's `canRefer`
  // exists to prevent, applied here to the undo path). Mirrors `RELEASE_PULL`/`CANCEL_TRANSPORT`'s
  // own preconditions in `ward-flow-reducer.ts` exactly.
  const activeTransport = movement.transport !== undefined && movement.transport.cancelledAt === undefined;
  const canReleasePull = movement.stage === "pulled" && !activeTransport;
  const canCancelTransport =
    movement.transport !== undefined &&
    movement.transport.cancelledAt === undefined &&
    movement.transport.collectedAt === undefined &&
    movement.transport.arrivedAt === undefined;

  const originEd = allEmergencyDepartments().find((ed) => ed.id === movement.originEdId);
  // Neutral "currently at" language, never framed as an authorisation requirement — authorisation
  // gates the destination only, and a patient's current ED is never itself a compliance problem.
  const originLabel = originEd
    ? `${originEd.siteCode} · ${originEd.name.replace(/ Emergency Department$/i, "").replace(/ Hospital$/i, "")} ED`
    : "Unresolved ED";

  /**
   * Owner ruling, 2026-09-02: a coordinator may see the suburb a referred patient is from —
   * `PD-3`'s permission reaches this field precisely because a suburb is a service area, never an
   * address. Resolved the same way every other reader of a referral does: `referralForMovement`
   * (`ward-derivations.ts`) joins `movement.referralId` back to `referrals`, and
   * `referralSuburbLabel` (`ward-referrals.ts`) turns the resulting `ReferralSuburb` into the one
   * shared wording a screen shows — never a second copy of "Suburb not known" written here.
   *
   * ⚠️ **`undefined` FOR A MOVEMENT WITH NO REFERRAL, AND THAT IS MOST OF THEM.** Most seeded
   * movements carry no `referralId` at all (see that field's own doc comment on `Movement`), so
   * this line is absent rather than a placeholder for the common case — the same conservative
   * failure the rest of this panel already holds to.
   */
  const referral = referralForMovement(movement, referrals);
  const suburbLabel = referral ? referralSuburbLabel(referral.suburb) : undefined;

  // A form with no current deadline is never breached — `undefined` must never reach
  // `clockState`'s arithmetic. As of the 2026-08-23 product-owner correction, neither a Form 1A
  // nor a Form 3B carries a `dueAt` any longer (Task 6A first established this for 3B; see
  // `LegalForm`'s doc comment in ward-model.ts) — only the transport/transfer forms (4A/4C) do.
  // Only an expiry still in force can produce a current legal warning.
  const legalDueAt = currentLegalDueAt(movement);
  const legalBreached = legalDueAt !== undefined && isClockBreached(legalDueAt, now);

  // The destination slot. An accepted unit and every outstanding referral are independent facts
  // a coordinator acts on differently (same reasoning `flow-diagram.tsx` already applies), so
  // each renders its own badge below from the raw movement fields — never only the first
  // referral, and never conflated with an acceptance (review Minor 6). `destinationUnit`
  // ("accepted, or else the first referral") is consulted only for ruling 5's exact condition.
  // Audit 1, Josh 20 Oct (CS-03): when nothing is recorded the slot names no ward. The old
  // "Suggested destination" badge was a system pick; the candidate fit counts below stay.
  const acceptedUnit = movement.acceptedUnitId ? units.find((unit) => unit.id === movement.acceptedUnitId) : undefined;
  // L3: the one next step once a destination has accepted (see the "Next step" section below).
  // Audit A1-4: the one bed-hold rule (`ward-bed-hold.ts`); a lapsed hold asks for Move or release.
  const hold = bedHold(movement.pullExpiresAt, now);
  const placementNextStep: "hold" | "book" | "booked" | "release" | undefined = !acceptedUnit
    ? undefined
    : movement.transport !== undefined && movement.transport.cancelledAt === undefined
      ? "booked"
      : movement.stage === "placement_requested" ||
          movement.stage === "destination_review" ||
          movement.stage === "accepted_awaiting_bed"
        ? "hold"
        : hold?.state === "lapsed"
          ? "release"
          : "book";
  const referredUnits = movement.referredUnitIds.map((id) => ({ id, unit: units.find((unit) => unit.id === id) }));
  const recordedDestination = destinationUnit(movement, units);
  const hasRecordedReferral =
    recordedDestination !== undefined || Boolean(movement.acceptedUnitId) || movement.referredUnitIds.length > 0;
  const hasEligible = shortlist.some((candidate) => candidate.verdict.eligible);

  // Whole-branch review Critical 2, carried forward into Task 5's Refer/Override. The old Confirm
  // acted on `activeUnit`, which falls back to `shortlist[0]` — a system-chosen default that no
  // human ever picked and that no candidate row reported as `aria-pressed`. A default that Refer
  // will act on IS an auto-allocation with one tap of consent, which is the one thing this phase
  // says it never does. So referring now requires `referTargets` — the real, explicit multi-select
  // state driven by the same candidate-row clicks `aria-pressed` reports below — never a fallback
  // to a default nobody chose. Showing the default's gate list for orientation is still fine;
  // acting on it is not.
  const referredCandidates = referTargets.map((unitId) => shortlist.find((candidate) => candidate.unit.id === unitId));
  const hasReferSelection = referTargets.length > 0;
  const reviewShown =
    reviewOpen ||
    groups.review.some(
      (candidate) => referTargets.includes(candidate.unit.id) || liveUnitIds.includes(candidate.unit.id),
    );
  /** The action bar's "To <ward>": the wards Refer will act on, by name. */
  const referTargetNames = referTargets.map(
    (unitId) => units.find((unit) => unit.id === unitId)?.name ?? "an unresolved unit",
  );
  // ⚠️ `availability`, NEVER `verdict.eligible`. A previously-declining ward has `eligible === false`
  // and yet the owner ruled it may be referred to with nothing recorded. Reading `eligible` here is
  // what made this control say "Not eligible … Use Override instead" about a ward that needs no
  // reason at all — his ruling inverted, on a clinical screen. `needsNoRecordedReason` is the single
  // fact this control and the candidates list both read.
  const allSelectedReferable = referredCandidates.every(
    (candidate) => candidate !== undefined && needsNoRecordedReason(candidate.availability),
  );
  // Fix round 1, Finding 1: `REFER_TO_UNITS` only accepts a movement at `placement_requested` or
  // `destination_review` (`ward-flow-reducer.ts`'s `REFERRABLE_MOVEMENT_STAGES`) — nine of the
  // eighteen hand-authored fixture movements sit outside that, at stages like `pulled`, while
  // still open and still offering eligible candidates. Refer used to dispatch anyway and
  // unconditionally claim success, so a coordinator on one of those nine read "Referred by a
  // human coordinator" while the reducer had silently refused every one of them. Folding this
  // into `canRefer` stops the control from ever advertising an action it cannot perform — the
  // stated reason below names the movement's own real stage, never a generic string.
  const referralBlocked = referralBlockedReason(movement);
  /**
   * T12 (item 9): whether at least one currently-selected candidate is a unit no coordinator
   * record on this movement has yet cleared for a `Non-binary` placement. Read straight off
   * `movement.genderPlacements`, the reducer's own record — never a second, screen-side copy of
   * the rule — so this can never disagree with what `REFER_TO_UNITS` will actually accept.
   */
  const needsGenderPlacement =
    // R7 (25 September 2026): any gender or recorded sex other than female or male, not only non-binary.
    genderReviewNeeded(movement.gender, movement.sex) &&
    referTargets.some((unitId) => !(movement.genderPlacements ?? []).some((record) => record.unitIds.includes(unitId)));
  const canRefer = hasReferSelection && allSelectedReferable && referralBlocked === undefined && !needsGenderPlacement;
  // Override deliberately carries only the explicit-selection guard, NOT the stage guard above.
  // It is the "a human decided to try anyway, with a stated reason" path — for an ineligible
  // candidate (its original purpose) and, now, for a non-referable stage too. Its own success
  // message is never optimistic either: `overrideSucceeded` below reads `movement.referredUnitIds`
  // fresh, so an override attempted against a non-referable movement is refused by the reducer
  // exactly like Refer would be, the refusal surfaces on the Exceptions drawer via `rejections`,
  // and no local flag here is ever left claiming a success that did not happen.
  const canOverride = hasReferSelection;
  // Same fact as `allSelectedReferable`. A ward that only declined before is NOT one of these, so
  // the "Use Override instead" sentence below can never be shown about it again.
  const firstIneligibleSelected = referredCandidates.find(
    (candidate) => candidate && !needsNoRecordedReason(candidate.availability),
  );
  const referUnavailableReason = referralBlocked
    ? referralBlocked
    : !hasReferSelection
      ? "Choose at least one candidate ward before referring — nothing is referred against a default."
      : needsGenderPlacement
        ? GENDER_PLACEMENT_REFUSAL
        : firstIneligibleSelected
          ? `Not eligible — ${candidateReason(firstIneligibleSelected.verdict)}. Use Override instead.`
          : "Eligibility could not be determined for one of the selected wards.";
  const overrideUnavailableReason =
    "Choose at least one candidate ward before overriding — nothing is overridden against a default.";
  const activeNotice = activeUnit ? restrictionNotice(movement, activeUnit) : undefined;

  const factors = waitFactors(movement, now, thresholds);

  /** Adds or removes a unit from the referral selection, capped at the coordinator-configured
   * `parallelReferralCap` (Task 7 of the audit-wiring plan, 2026-09-16 — previously the constant
   * `PARALLEL_REFERRAL_CAP`) — a click past the cap on a NOT-yet-selected unit is a no-op (never
   * silently swaps out an earlier choice), but a click on an already-selected unit can always
   * toggle it back off.
   *
   * ⚠️ RA1 (item 18): a LIVE ward (already in `movement.referredUnitIds`) never reaches this
   * function's own state at all — the candidate row below never wires its click to it for a live
   * ward, so this early return is a second, structural guard rather than the only one. The cap
   * check counts live plus new, per the owner's ruling that re-referring adds rather than replaces:
   * three already live leaves no room for a fourth NEW pick even though `referTargets` itself is
   * still empty.
   *
   * Finding 188 (Josh, 27 Oct 2026): the cap is now a warning everywhere. A pick past it is kept
   * and the footer says the usual limit is passed (`overParallelCap`). */
  function toggleReferTarget(unitId: string) {
    if (liveUnitIds.includes(unitId)) return;
    setReferTargets((current) =>
      current.includes(unitId) ? current.filter((id) => id !== unitId) : [...current, unitId],
    );
  }
  const overParallelCap = referTargets.length > 0 && liveUnitIds.length + referTargets.length > parallelReferralCap;

  /**
   * Dispatches `REFER_TO_UNITS` and nothing else — deliberately no local "it worked" flag.
   * `canRefer` already gates on `referralBlockedReason`, so this can only be reached when the
   * reducer is expected to accept the event; the honest record of whether it actually did is
   * `movement.referredUnitIds` on the next render (the "Parallel referral" badges above), sourced
   * straight from the provider, never a value this function sets and then leaves behind.
   */
  function handleRefer() {
    if (onRefer) {
      onRefer([...referTargets], referTargetNames);
      setOverrideOpen(false);
      return;
    }
    if (!canRefer) return;
    dispatch({ type: "REFER_TO_UNITS", role: "coordinator", now, movementId, unitIds: [...referTargets] });
    setOverrideOpen(false);
  }

  function handleQuickSend() {
    handleRefer();
  }

  /**
   * T12 (item 9): dispatches the SAME `REFER_TO_UNITS` event `handleRefer` does, plus the two
   * fields the reducer requires for a `Non-binary` placement it has not already cleared for these
   * units. Guarded on both fields being present here too, not only by the submit button's own
   * `disabled` — the same double-guard `submitWithdrawWardRequest` above holds to — so a form
   * submitted by Enter with the button not yet reachable still cannot dispatch a half-answered
   * event.
   */
  function submitGenderPlacement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!needsGenderPlacement) return;
    const reason = genderPlacementReason.trim();
    if (reason.length === 0 || !genderPlacementChecked) return;
    // Membership-checked here as well as in the reducer, the same discipline `handleOverrideSubmit`
    // holds to for `OVERRIDE_REASONS` — the reducer's check is the one that matters; this one keeps
    // a malformed value from being reported on screen as recorded.
    if (!GENDER_PLACEMENT_REASONS.includes(reason as GenderPlacementReason)) return;
    dispatch({
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now,
      movementId,
      unitIds: [...referTargets],
      genderPlacementReason: reason as GenderPlacementReason,
      genderPlacementChecked: true,
    });
    setGenderPlacementReason("");
    setGenderPlacementChecked(false);
  }

  /**
   * RA1 (item 18): withdraws exactly ONE live ward's request — never `WITHDRAW_REFERRAL`, which
   * takes back every live referral at once and closes the movement. Only reachable once a reason is
   * chosen from `WARD_REQUEST_WITHDRAWAL_REASONS` — the submit button below stays `aria-disabled`
   * until then, the same discipline `submitUrgencyChange`'s own reason picker holds to.
   */
  function submitWithdrawWardRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (withdrawUnitId === undefined || withdrawReason === "") return;
    dispatch({
      type: "WITHDRAW_WARD_REQUEST",
      role: "coordinator",
      now,
      movementId,
      unitId: withdrawUnitId,
      reason: withdrawReason,
    });
    setWithdrawUnitId(undefined);
    setWithdrawReason("");
  }

  function handleOverrideSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canOverride) return;
    const reason = overrideReason.trim();
    if (reason.length === 0) return;
    // D-86 (findings 111 and 113, Josh, 27 Oct 2026): no second approvers. The reason is the only
    // thing an override needs, the same standard as the Referrals board and the patient page.
    // Membership-checked here as well as in the reducer. The reducer's check is the one that
    // matters; this one keeps a malformed value from being reported on screen as recorded.
    if (!OVERRIDE_REASONS.includes(reason as OverrideReason)) return;
    // OD-3: the reason travels WITH the event now. It used to go only into `overrideRecord`
    // below -- this component's own state, cleared on the next patient selection -- while the
    // governance page said override reasons were recorded. The reducer keeps it on
    // `Movement.overrides`; `overrideRecord` is now only the on-screen confirmation.
    dispatch({
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now,
      movementId,
      unitIds: [...referTargets],
      overrideReason: reason as OverrideReason,
    });
    setOverrideRecord({ unitIds: [...referTargets], at: now, reason });
    setOverrideOpen(false);
    setOverrideReason("");
    clearOverrideDraft();
  }

  /**
   * Whole-branch review I2 (spec §11). `RECORD_ESCALATION`'s own reducer branch
   * (`ward-flow-reducer.ts`) carries no precondition beyond the role check — it stamps
   * `escalation` on any movement that resolves — so unlike Refer/Override this control never
   * needs a `*BlockedReason` guard: nothing here can be refused. `triedUnitIds` is never typed by
   * a human — it is `movement.declines`, the units genuinely referred to and declined, exactly
   * what the "Declines" section immediately above already renders (each with its own real reason
   * — the shortlist's own "what was tried, why each failed"). Deliberately NOT the panel's
   * `shortlist` candidate list: that is capped at `PARALLEL_REFERRAL_CAP` and is a theoretical
   * eligibility scan, not a record of what was actually attempted — using it would let a
   * genuinely untried unit (never referred, only eligibility-checked) be named as "tried".
   * WF-009's own pre-authored fixture escalation (`ward-movements.ts`) uses exactly this shape:
   * its five `triedUnitIds` are its five `declines`, unit for unit. `contact` (a role or service,
   * never a person) is Task 6's fixed `ESCALATION_CONTACTS` picker, not typed text — see the
   * comment above `ward-change-reasons.ts`'s `ESCALATION_CONTACTS`.
   */
  function submitEscalation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Task 6: `escalationContact` is one of `ESCALATION_CONTACTS` once chosen. Finding 110: it
    // opens blank, so an unchosen contact records nothing.
    if (escalationContact === "") return;
    runStep(
      {
        type: "RECORD_ESCALATION",
        role: "coordinator",
        now,
        movementId,
        triedUnitIds: declinedUnitIds,
        contact: escalationContact,
      },
      { success: "Escalation recorded." },
    );
    setEscalationOpen(false);
    setEscalationContact("");
  }

  /**
   * Records who changed the tier, when and why — and nothing else. Nothing auto-allocates: this
   * never re-sorts, re-suggests, un-accepts or re-refers the patient (Global Constraint 3).
   */
  function submitUrgencyChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (urgencyBlocked) return;
    const chosen = urgencyDraft.urgency;
    if (chosen === "urgent") {
      if (urgencyDraft.urgentReason === undefined) return;
      dispatch({
        type: "FLAG_MOVEMENT_URGENT",
        role: "coordinator",
        now,
        movementId,
        reason: urgencyDraft.urgentReason,
      });
    } else {
      const flagged = movement?.flaggedUrgent === true;
      if (flagged) dispatch({ type: "CLEAR_MOVEMENT_URGENT_FLAG", role: "coordinator", now, movementId });
      // Finding 15 (Josh, 27 Oct 2026): the reason is sent when chosen and never required.
      const reason = urgencyDraft.reason;
      if (!flagged || chosen !== movement?.urgency) {
        dispatch({
          type: "CHANGE_URGENCY",
          role: "coordinator",
          now,
          movementId,
          urgency: chosen,
          ...(reason === undefined ? {} : { reason }),
        });
      }
    }
    setUrgencyChangeOpen(false);
  }

  // Finding 156: Urgent needs its own reason (the engine asks for one); a tier never does.
  const urgencyBlocked =
    urgencyDraft.urgency !== "urgent"
      ? undefined
      : movement.flaggedUrgent
        ? "Already flagged urgent. Choose a tier to remove the flag."
        : urgencyDraft.urgentReason === undefined
          ? "Choose why this is urgent first"
          : undefined;

  // Finding 120: the form's fields show for any status other than Voluntary.
  const legalFormAsked = legalStatusDraft.legalStatus !== undefined && legalStatusDraft.legalStatus !== "Voluntary";
  const legalFormMinute = minuteOfDayFromClockText(legalFormDraft.time);
  const legalFormWrittenAt =
    legalFormMinute === undefined ? undefined : (dayOf(now) + legalFormDraft.day) * MINUTES_PER_DAY + legalFormMinute;
  const legalFormLater = legalFormWrittenAt !== undefined && legalFormWrittenAt > now;
  const legalFormWarning = !legalFormAsked
    ? null
    : legalFormDraft.code === ""
      ? "No form chosen. The status is recorded without it. Record the form here or on the Forms page."
      : legalFormDraft.time.trim() === ""
        ? `Form ${legalFormDraft.code} is recorded only with the time it was made.`
        : legalFormMinute === undefined
          ? "Enter the time made as HH:MM, or the form is not recorded."
          : legalFormLater
            ? "The time made cannot be later than now, so the form is not recorded."
            : null;
  const legalFormOptions = SELECTABLE_LEGAL_FORMS.filter((form) => isOwnedLegalFormCode(form.code));

  // Why the legal status change cannot be recorded yet: the new status first, then the reason.
  const legalStatusBlocked =
    legalStatusDraft.legalStatus === undefined
      ? LEGAL_STATUS_UNCHOSEN
      : legalStatusDraft.reason === undefined
        ? LEGAL_STATUS_REASON_UNCHOSEN
        : undefined;

  /**
   * Records the legal status change and nothing else. A status change can make an already
   * accepted destination unlawful (`destinationNoLongerLawful`, surfaced on the Exceptions
   * drawer) — this handler never reacts to that itself.
   */
  function submitLegalStatusChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A real <form>: Enter inside a field submits it whatever the button advertises, and the
    // reducer requires a reason, so an unguarded Enter would dispatch `undefined`.
    if (legalStatusDraft.legalStatus === undefined || legalStatusDraft.reason === undefined) return;
    dispatch({
      type: "CHANGE_LEGAL_STATUS",
      role: "coordinator",
      now,
      movementId,
      legalStatus: legalStatusDraft.legalStatus,
      reason: legalStatusDraft.reason,
    });
    if (legalFormAsked && isOwnedLegalFormCode(legalFormDraft.code) && legalFormWrittenAt !== undefined) {
      dispatch({
        type: "RECORD_LEGAL_FORM_WRITTEN",
        role: "coordinator",
        now,
        movementId,
        formCode: legalFormDraft.code,
        writtenAt: legalFormWrittenAt,
      });
    }
    setLegalStatusChangeOpen(false);
    setLegalFormDraft({ code: "", time: "", day: 0 });
  }

  /**
   * Releases a pulled bed back to allocatable WITHOUT closing the movement, clearing `legalForm`,
   * or touching `referredUnitIds` — the patient survives and keeps their acceptance; only the
   * pull itself unwinds. Dispatched as role "coordinator", so no `actingUnitId` is needed — a
   * coordinator may release a pull at any unit.
   */
  function submitReleasePull(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReleasePull) return;
    // A real <form>: Enter inside a field submits it whatever the button advertises.
    if (releasePullReason === undefined) return;
    runStep(
      { type: "RELEASE_PULL", role: "coordinator", now, movementId, reason: releasePullReason },
      { success: "Pulled bed released." },
    );
    setReleasePullOpen(false);
  }

  /**
   * Cancels the transport job WITHOUT closing the movement — the bed itself (pulled or already
   * occupied) is untouched by this handler. Dispatched as role "coordinator", so no
   * `actingUnitId` is needed.
   */
  function submitCancelTransport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCancelTransport) return;
    // A real <form>: Enter inside a field submits it whatever the button advertises.
    if (cancelTransportReason === undefined) return;
    runStep(
      { type: "CANCEL_TRANSPORT", role: "coordinator", now, movementId, reason: cancelTransportReason },
      { success: "Transport cancelled." },
    );
    setCancelTransportOpen(false);
  }

  // Structurally incapable of claiming an override succeeded when it did not: this checks the
  // movement's OWN post-dispatch `referredUnitIds` — read fresh on every render from the live
  // provider — not a flag captured once at click time. Override is not stage-gated (see the
  // comment above `canOverride`), so a movement outside `REFERRABLE_MOVEMENT_STAGES` really can
  // reach this dispatch; when the reducer refuses it, `referredUnitIds` is untouched, every id
  // below is missing, `overrideSucceeded` is `false`, and nothing renders here — the refusal is
  // instead visible through `rejections` on the Exceptions drawer.
  const overrideSucceeded =
    overrideRecord !== undefined &&
    overrideRecord.unitIds.length > 0 &&
    overrideRecord.unitIds.every((id) => movement.referredUnitIds.includes(id));
  const overrideRecordUnits = overrideRecord
    ? overrideRecord.unitIds.map((id) => units.find((unit) => unit.id === id)?.name ?? "an unresolved unit")
    : [];

  /**
   * One FitHighlight row a coordinator can pick. `aria-pressed` is the explicit multi-select state
   * (`referTargets`); `data-showing` is only which ward's gates are explained. A ward already
   * holding a live referral is pre-selected and locked: taking it back is "Withdraw this request".
   */
  function renderCandidate(candidate: (typeof shortlist)[number], kind: FitKind) {
    const isShown = activeUnit?.id === candidate.unit.id;
    const isLive = liveUnitIds.includes(candidate.unit.id);
    const isSelected = isLive || referTargets.includes(candidate.unit.id);
    const notice = restrictionNotice(movementForRows, candidate.unit);
    // ⚠️ A measured road route, shown only where one exists, informing a choice and never making
    // one. The testid must not begin `ward-shortlist-candidate-` (other suites count those).
    const route = referenceDistance(originEd?.referenceEdId, siteByCode(candidate.unit.siteCode)?.referenceSiteId);
    // The tick and the edge already say Selected; only a live referral needs its word.
    const label = isLive ? "Referred" : undefined;
    return (
      <li key={candidate.unit.id}>
        <button
          type="button"
          data-testid={`ward-shortlist-candidate-${candidate.unit.id}`}
          data-eligible={String(candidate.verdict.eligible)}
          data-more-restrictive={notice ? "true" : undefined}
          data-showing={isShown ? "true" : undefined}
          data-live={isLive ? "true" : undefined}
          data-fit={kind}
          aria-pressed={isSelected}
          className={`${styles.shortlistCandidateRow} ${shortlistStyles.candidateRow} ${shortlistStyles.allocationButtonTouch}`}
          onClick={() => {
            onSelectUnit(candidate.unit.id);
            if (!isLive) toggleReferTarget(candidate.unit.id);
          }}
        >
          <span className={shortlistStyles.tick} aria-hidden="true">
            <Check aria-hidden="true" />
          </span>
          <span className={shortlistStyles.candidateTop}>
            <span className={styles.shortlistCandidateName}>{candidate.unit.name}</span>
            <span className={`${mock.cardRight} ${shortlistStyles.tabularNum}`}>
              {label ? (
                <span className={shortlistStyles.candidateState} data-state="live">
                  <StatusGlyph tone="info" size={9} />
                  {label}
                </span>
              ) : null}
              {route !== null ? (
                <span data-testid={`ward-shortlist-route-${candidate.unit.id}`}>
                  {route.km === 0 ? "Same site" : `${route.min} min`}
                </span>
              ) : null}
            </span>
          </span>
          <span className={`${styles.shortlistCandidateCapacity} ${shortlistStyles.tabularNum}`}>
            {capacityLine(candidate.unit, bedReleases, admissions)}
          </span>
          {candidate.verdict.eligible ? null : (
            <span className={`${styles.shortlistCandidateReasonBad} ${shortlistStyles.candidateReason}`}>
              {candidateReason(candidate.verdict)}
            </span>
          )}
          {notice ? (
            <span
              className={`${
                notice.level === "voluntary_on_locked"
                  ? styles.shortlistCandidateRestrictiveProminent
                  : styles.shortlistCandidateRestrictive
              } ${shortlistStyles.candidateNotice}`}
              data-level={notice.level}
            >
              {notice.text}
            </span>
          ) : null}
        </button>
      </li>
    );
  }

  /**
   * A ward no plain referral can reach. `aria-disabled`, never native `disabled`, so the row keeps
   * its tab stop and its reason. The reason shown is the gate that actually blocks it
   * (`blockingGate`), never merely the first failing one.
   */
  function renderUnavailable(candidate: (typeof shortlist)[number], kind: "no-bed" | "no") {
    const blocking = blockingGate(candidate.verdict);
    const reason = blocking?.detail ?? candidateReason(candidate.verdict);
    const describedBy = `ward-shortlist-unavailable-why-${candidate.unit.id}`;
    return (
      <li key={candidate.unit.id}>
        <button
          type="button"
          data-testid={`ward-shortlist-unavailable-${candidate.unit.id}`}
          data-fit={kind}
          className={`${styles.shortlistCandidateRow} ${shortlistStyles.candidateRow} ${shortlistStyles.allocationButtonTouch}`}
          aria-disabled="true"
          aria-describedby={describedBy}
          title={`${candidate.unit.name} — ${reason}`}
          onClick={ignoreUnavailableActivation}
        >
          <span className={shortlistStyles.candidateTop}>
            <span className={styles.shortlistCandidateName}>{candidate.unit.name}</span>
            {kind === "no-bed" ? null : (
              <span className={shortlistStyles.candidateState} data-state={kind}>
                <StatusGlyph tone={FIT_LABEL[kind].tone} size={9} />
                {FIT_LABEL[kind].word}
              </span>
            )}
          </span>
          <span className={`${styles.shortlistCandidateCapacity} ${shortlistStyles.tabularNum}`}>
            {capacityLine(candidate.unit, bedReleases, admissions)}
          </span>
          <span className={`${styles.shortlistCandidateReasonBad} ${kind === "no-bed" ? mock.quietReason : ""}`}>
            {reason}
          </span>
          <span id={describedBy} className="sr-only">
            Unavailable: {reason}. No recorded reason can place this person here.
          </span>
        </button>
      </li>
    );
  }

  // L3 / decision 3 (site review, 12 Oct 2026, Recommended): once a destination has accepted,
  // the card stops offering beds and Refer and shows the one next step as its primary: hold the
  // bed, or book transport once the bed is held. Both open the patient page, where the hold
  // (with its override reasons and Undo) and the booking (with the sending team's answers)
  // already live, so no second copy of either flow is built here.
  // Home placement redesign (Josh 19 Oct 2026): the next step leads, directly under the patient's
  // name and above the details, so its buttons are the first thing in the panel.
  const nextStepSection =
    placementNextStep !== undefined && acceptedUnit ? (
      <section
        aria-label="Next step"
        className={`${shortlistStyles.candidatesSection} ${shortlistStyles.nextStepLead}`}
        data-testid="ward-shortlist-next-step"
        data-step={placementNextStep}
      >
        <h4 className={styles.shortlistSectionHeading}>Next step</h4>
        <p className={styles.shortlistCandidateCapacity}>
          {placementNextStep === "hold"
            ? `${acceptedUnit.name} has accepted. Pull the bed so it is kept for this patient.`
            : placementNextStep === "book"
              ? `The bed at ${acceptedUnit.name} is pulled. Book transport to move the patient.`
              : placementNextStep === "release" && hold
                ? `${hold.label} at ${acceptedUnit.name}. Move the patient or release the bed.`
                : `Transport is booked to ${acceptedUnit.name}.`}
        </p>
        <div className={styles.shortlistActionRow}>
          <Link
            href={movementHref(movement.id)}
            data-testid={
              placementNextStep === "hold"
                ? "ward-shortlist-hold-bed"
                : placementNextStep === "release"
                  ? "ward-shortlist-move-or-release"
                  : "ward-shortlist-book-transport"
            }
            className={`${styles.shortlistConfirmButton} ${shortlistStyles.allocationButtonTouch}`}
          >
            {placementNextStep === "hold"
              ? "Pull the bed"
              : placementNextStep === "book"
                ? "Book transport"
                : placementNextStep === "release"
                  ? "Move or release"
                  : "Open patient"}
          </Link>
          {otherBedsFor === movement.id ? null : (
            <button
              type="button"
              data-testid="ward-shortlist-find-another-bed"
              className={`${styles.shortlistOverrideButton} ${shortlistStyles.allocationButtonTouch}`}
              aria-expanded={false}
              onClick={() => setOtherBedsFor(movement.id)}
            >
              Find another bed
            </button>
          )}
        </div>
      </section>
    ) : null;

  return (
    <div className={`${styles.shortlistBody} ${shortlistStyles.body}`} data-testid={`ward-shortlist-${movement.id}`}>
      {outcomeMessage ? <p role="status">{outcomeMessage}</p> : null}
      <header className={`${styles.shortlistHeader} ${shortlistStyles.subjectHeader}`}>
        {/* PlacementPanel (v10 Home): the patient as "Given Surname" with UMRN and where they are,
            the Urgent and tier pills, then a facts grid. Words neutral, glyphs carry tone. */}
        <div className={styles.shortlistHeaderTop}>
          <div className={shortlistStyles.subjectWho}>
            <h3 className={`${styles.shortlistMovementId} ${shortlistStyles.subjectId}`}>
              <small>Patient</small>
              {/* Owner, 26 Sept 2026: the patient's name, never a PT or WF number. Written "Surname,
                  First" as the queue beside it writes it (simplification A8, 19 Oct 2026). */}
              <Link href={referral?.patientId ? patientHref(referral.patientId) : movementHref(movement.id)}>
                {patientIdentity.formalName}
              </Link>
              <span
                className={`${styles.shortlistTierBadge} ${shortlistStyles.tierBadge} ${mock.tier}`}
                data-tier={movement.urgency}
              >
                <span aria-hidden="true">T{movement.urgency}</span>
                <SrOnly>Tier {movement.urgency}</SrOnly>
              </span>
            </h3>
            <span className={shortlistStyles.subjectSub}>
              <span className={shortlistStyles.tabularNum}>{patientUmrn}</span> ·{" "}
              {originEd ? originLabel.slice(originEd.siteCode.length + 3) : originLabel}
            </span>
          </div>
          <div className={shortlistStyles.subjectBadges}>
            {/* Owner, 26 Sept 2026: removed — the header above already names the patient, so a
                second badge repeating the WF journey number here would show it twice. */}
            {/* Words neutral, the glyph carries the tone (design system v9). */}
            {movement.flaggedUrgent ? (
              <span className={shortlistStyles.urgentBadge}>
                <StatusGlyph tone="danger" size={9} />
                {/* L4: the flag is not the tier, so a T3 patient is never labelled "Urgent". */}
                Flagged<SrOnly> urgent</SrOnly>
              </span>
            ) : null}
          </div>
        </div>
        {nextStepSection}
        {/* Two fact lines on every size, as the desktop's (Josh, 19 Oct 2026): the phone's four-box
            grid said the same four facts in twice the height. */}
        {
          <div className={shortlistStyles.factLines} data-testid="ward-shortlist-facts">
            <dl className={shortlistStyles.factLine}>
              <InlineFact label="Sex" value={movement.sex} />
              <InlineFact label="Age group" value={movement.cohort} />
              <InlineFact label="Security" value={movement.security} />
              <InlineFact
                label="Legal"
                value={movement.legalForm ? `Form ${movement.legalForm.code}` : movement.legalStatus}
              />
              {suburbLabel ? <InlineFact label="Suburb" value={suburbLabel} testId="ward-shortlist-suburb" /> : null}
            </dl>
            <p
              className={`${shortlistStyles.factLine} ${shortlistStyles.waitLine} ${shortlistStyles.tabularNum}`}
              data-urgent={overTarget ? "true" : undefined}
              data-testid="ward-shortlist-wait-line"
            >
              {overTarget ? <StatusGlyph tone="danger" size={9} /> : null}
              {`Waiting ${durMinutes(waitedMinutes)} (target ${durMinutes(targetMinutes)})`}
              {overTarget ? <span className={shortlistStyles.waitOverdue}>· overdue</span> : null}
            </p>
          </div>
        }
        {movement.legalForm ? (
          <p className={shortlistStyles.legalLine} data-urgent={legalBreached ? "true" : undefined}>
            {`${legalFormLine(movement, now)} · ${movement.legalStatus}`}
            {legalDueAt !== undefined ? <LegalLimitsNotChecked variant="tag" /> : null}
          </p>
        ) : null}

        {hasRecordedReferral ? (
          <>
            {movement.acceptedUnitId ? (
              acceptedUnit ? (
                // The destination and its desk link share one row (Home placement redesign, Josh
                // 19 Oct 2026); the link wraps under it only when the panel is too narrow.
                <div className={shortlistStyles.destRow}>
                  <span className={`${styles.shortlistAcceptedBadge} ${shortlistStyles.destLine}`} data-tone="good">
                    Accepted destination: {acceptedUnit.name}
                  </span>
                  {!movement.referredUnitIds.includes(acceptedUnit.id) ? (
                    <Link
                      href={unitHref(acceptedUnit.id)}
                      data-testid={`ward-shortlist-open-ward-desk-${acceptedUnit.id}`}
                      className={`${styles.shortlistOverrideButton} ${shortlistStyles.allocationButtonTouch} ${shortlistStyles.wardDeskLink}`}
                      onClick={() => {
                        flowSetFocusMovementId?.(movementId);
                      }}
                    >
                      {/* The ward is named on the same row, so the visible words stay short; a
                          screen reader still hears which desk opens. */}
                      Open <SrOnly>{acceptedUnit.name}</SrOnly> desk →
                    </Link>
                  ) : null}
                </div>
              ) : (
                <span className={`${styles.shortlistUnresolvedBadge} ${shortlistStyles.destLine}`} data-tone="danger">
                  Accepted destination could not be resolved.
                </span>
              )
            ) : null}
            {/* Every parallel referral, not only `referredUnitIds[0]` — a movement can carry up
                to PARALLEL_REFERRAL_CAP live referrals at once, and each is a fact a coordinator
                acts on (review Minor 6: a hidden parallel referral is exactly the trust failure
                the cap and this record exist to prevent). "Parallel referral" is the label Task
                5's Refer action uses everywhere this fact is surfaced. Whole-branch review M3:
                `data-testid` here (never present before) is what lets a test assert the real
                COUNT of these badges — the journey's own "Three live referrals" comment used to
                sit over an assertion one badge alone could satisfy.

                ⚠️ THE TWO ARMS CARRY DIFFERENT TESTIDS AND MUST KEEP DOING SO. Until 2026-09-02
                both spans below were `ward-shortlist-referred-badge`, so the one assertion that
                counts them summed two different kinds and could not tell three resolved referrals
                from two resolved plus one unresolved — the precise failure the count exists to
                catch. `origin/main` d29f70eff split them; this branch had drifted back to the
                ambiguous form. Never collapse them again to make one selector simpler. */}
            {referredUnits.map(({ id, unit }) => (
              <Fragment key={id}>
                {unit ? (
                  <span
                    data-testid="ward-shortlist-referred-badge"
                    className={`${styles.shortlistReferredBadge} ${shortlistStyles.destLine}`}
                    data-tone="warn"
                  >
                    {/* ⚠️ NAMES THE HOSPITAL AS WELL AS THE WARD, and that became necessary rather
                        than nice on 2026-09-18. While the demo wards were called "RPH Adult Secure"
                        the site code sat inside the ward name, so a badge showing the ward alone
                        happened to say which hospital too. Real WA ward names do not do that —
                        "Ward 2K", "Moodjar", "Maali" name no hospital, and two hospitals can both
                        have a "Mother and Baby Unit". A coordinator reading a parallel referral has
                        to know where it went. */}
                    Parallel referral: {unit.name}
                    {siteByCode(unit.siteCode) ? `, ${siteByCode(unit.siteCode)!.name}` : ""}
                  </span>
                ) : (
                  <span
                    data-testid="ward-shortlist-unresolved-referred-badge"
                    className={`${styles.shortlistUnresolvedBadge} ${shortlistStyles.destLine}`}
                    data-tone="danger"
                  >
                    Parallel referral to an unresolved unit.
                  </span>
                )}
                {/*
                  RA1 (item 18): withdraws THIS one ward's live request, with a §2 reason — never
                  `WITHDRAW_REFERRAL` (every live referral at once, and it closes the movement).
                  `aria-disabled` until a reason is chosen, the same discipline every other reasoned
                  submit in this panel holds to (`ward-change-urgency`, `ward-change-legal-status`).
                */}
                <button
                  type="button"
                  data-testid={`ward-shortlist-withdraw-toggle-${id}`}
                  className={`${styles.shortlistOverrideButton} ${shortlistStyles.allocationButtonTouch}`}
                  aria-expanded={withdrawUnitId === id}
                  onClick={() => {
                    setWithdrawUnitId((current) => (current === id ? undefined : id));
                    setWithdrawReason("");
                  }}
                >
                  {/* Finding 117: the toggle asks, the submit below commits and names the ward. */}
                  Withdraw this request?
                </button>
                {/* S-8 (audit 13 Oct 2026): the coordinator can do everything, so an offer the
                    coordinator made can also be accepted here for that ward, not only withdrawn. */}
                {unit && !movement.acceptedUnitId ? (
                  <Button
                    variant="pri"
                    size="md"
                    data-placement-action
                    type="button"
                    data-testid={`ward-shortlist-accept-for-ward-${id}`}
                    onClick={() =>
                      runStep(
                        { type: "ACCEPT_IN_PRINCIPLE", role: "coordinator", now, movementId, unitId: id },
                        {
                          success: `Accepted in principle for ${unit.name}.`,
                          undo: (at) => ({
                            type: "UNDO_ACCEPT_IN_PRINCIPLE",
                            role: "coordinator",
                            now: at,
                            movementId,
                          }),
                          undone: "Acceptance undone. The referral is back with the ward.",
                        },
                      )
                    }
                  >
                    Accept for this ward
                  </Button>
                ) : null}
                {unit ? (
                  <Link
                    href={unitHref(unit.id)}
                    data-testid={`ward-shortlist-open-ward-desk-${unit.id}`}
                    className={`${styles.shortlistOverrideButton} ${shortlistStyles.allocationButtonTouch} ${shortlistStyles.wardDeskLink}`}
                    onClick={() => {
                      flowSetFocusMovementId?.(movementId);
                    }}
                  >
                    {`Open ${unit.name} desk →`}
                  </Link>
                ) : null}
                {withdrawUnitId === id ? (
                  <form
                    className={styles.shortlistOverrideForm}
                    data-testid={`ward-shortlist-withdraw-form-${id}`}
                    onSubmit={submitWithdrawWardRequest}
                  >
                    <label
                      id={`ward-shortlist-withdraw-label-${id}`}
                      className={styles.shortlistOverrideLabel}
                      htmlFor={`ward-shortlist-withdraw-reason-${id}`}
                    >
                      Why is this request being withdrawn?
                    </label>
                    <select
                      id={`ward-shortlist-withdraw-reason-${id}`}
                      required
                      className={styles.shortlistOverrideSelect}
                      data-testid={`ward-shortlist-withdraw-reason-${id}`}
                      value={withdrawReason}
                      onChange={(event) => setWithdrawReason(event.target.value as WardRequestWithdrawalReason | "")}
                    >
                      <option value="">Choose a reason</option>
                      {WARD_REQUEST_WITHDRAWAL_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {wardRequestWithdrawalReasonLabels[reason]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className={`${styles.shortlistOverrideSubmit} ${shortlistStyles.allocationButtonTouch}`}
                      data-testid={`ward-shortlist-withdraw-submit-${id}`}
                      aria-disabled={withdrawReason === "" ? "true" : undefined}
                      aria-describedby={
                        withdrawReason === ""
                          ? `ward-shortlist-withdraw-label-${id} ward-shortlist-withdraw-submit-words-${id}`
                          : `ward-shortlist-withdraw-label-${id}`
                      }
                      onClick={withdrawReason === "" ? ignoreUnavailableActivation : undefined}
                    >
                      {unit ? `Withdraw request to ${unit.name}` : "Withdraw request"}
                    </button>
                    {withdrawReason === "" ? (
                      <DisabledReason id={`ward-shortlist-withdraw-submit-words-${id}`}>
                        Choose a reason to withdraw this request
                      </DisabledReason>
                    ) : null}
                  </form>
                ) : null}
              </Fragment>
            ))}
          </>
        ) : (
          <span
            className={`${styles.shortlistUnresolvedBadge} ${shortlistStyles.destLine} ${hasEligible ? mock.quietLine : ""}`}
            data-tone="neutral"
            data-testid="ward-shortlist-no-destination"
          >
            {hasEligible ? "No destination recorded yet." : "No eligible destination found yet."}
          </span>
        )}
      </header>

      {movement.arrivalDetails || movement.stage === "pulled" ? (
        <section
          className={`${styles.shortlistTransitCard} ${shortlistStyles.detailDisclosure}`}
          data-testid="ward-shortlist-transit-card"
          aria-label={`Transport and arrival (${OPERATIONAL_DEFAULT_LABEL})`}
        >
          <h4 className={styles.shortlistSectionHeading}>Transport and arrival</h4>
          <dl className={shortlistStyles.factGrid}>
            <Fact
              label="Accepting inpatient ward"
              value={acceptedUnit ? acceptedUnit.name : (movement.acceptedUnitId ?? "No accepted ward recorded")}
              testId="ward-shortlist-transit-accepting-ward"
            />
            <Fact
              label="Arrival mode"
              value={
                movement.arrivalDetails?.modeOfArrival ??
                (movement.arrivalDetails?.mode
                  ? (ARRIVAL_MODE_LABELS[movement.arrivalDetails.mode] ?? movement.arrivalDetails.mode)
                  : movement.arrivalMode
                    ? (ARRIVAL_MODE_LABELS[movement.arrivalMode as ArrivalMode] ?? movement.arrivalMode)
                    : "Not booked")
              }
              testId="ward-shortlist-transit-mode"
            />
            {movement.arrivalDetails?.trackingNumber ? (
              <Fact
                label="Tracking number"
                value={movement.arrivalDetails.trackingNumber}
                testId="ward-shortlist-transit-tracking"
              />
            ) : null}
            <Fact
              label="Expected arrival (as recorded)"
              value={
                movement.arrivalDetails?.estimatedArrivalAt !== undefined
                  ? now > movement.arrivalDetails.estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES
                    ? `Overdue (+${Math.floor((now - movement.arrivalDetails.estimatedArrivalAt) / 60)}h)`
                    : `ETA in ${Math.max(0, movement.arrivalDetails.estimatedArrivalAt - now)}m`
                  : hold
                    ? hold.label
                    : `${holdLabel} pull, end time not recorded`
              }
              urgent={
                movement.arrivalDetails?.estimatedArrivalAt !== undefined
                  ? now > movement.arrivalDetails.estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES
                  : hold?.state === "lapsed"
              }
              testId="ward-shortlist-transit-countdown"
            />
          </dl>
          {movement.arrivalDetails?.estimatedArrivalAt !== undefined &&
          now > movement.arrivalDetails.estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES ? (
            <div
              className={`${styles.queueTransitOverdue} ${styles.transitOverdueSpaced}`}
              data-testid="ward-shortlist-transit-overdue"
            >
              ⚠ Overdue alert: arrival is +{Math.floor((now - movement.arrivalDetails.estimatedArrivalAt) / 60)}h past
              estimated arrival time.
            </div>
          ) : null}
        </section>
      ) : null}

      {placementNextStep === undefined || otherBedsFor === movement.id ? (
        <>
          <section aria-label="Candidate units" className={shortlistStyles.candidatesSection}>
            <button
              type="button"
              className={shortlistStyles.candidateHeaderToggle}
              onClick={() => setCandidatesOpen((open) => !open)}
              aria-expanded={candidatesOpen}
              aria-controls="ward-shortlist-candidates-content"
              data-testid="ward-shortlist-candidates-toggle"
            >
              <div className={shortlistStyles.candidateHeading}>
                <h4 className={styles.shortlistSectionHeading}>Candidates</h4>
                <span className={`${shortlistStyles.candidateState} ${shortlistStyles.tabularNum}`}>
                  {shortlist.length} wards
                </span>
              </div>
              <span className={shortlistStyles.toggleChevron}>
                {candidatesOpen ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
              </span>
            </button>
            <div id="ward-shortlist-candidates-content" style={candidatesOpen ? undefined : { display: "none" }}>
              {offerable.length === 0 && groups["no-bed"].length === 0 ? (
                <p className={styles.placeholder}>
                  No eligible destination. No ward can take this person, with or without a recorded reason.
                </p>
              ) : null}
              {/* The wards that fit lead: a bed ready, then fits with no bed now (never selectable: the
              engine refuses a ward with no bed). */}
              {groups.bed.length > 0 ? (
                <div className={shortlistStyles.fitGroup} data-fit-group="bed">
                  <h5 className={shortlistStyles.fitGroupHead}>
                    Fits, bed ready <span className={shortlistStyles.fitGroupCount}>{groups.bed.length}</span>
                  </h5>
                  <ul className={styles.shortlistCandidateList}>
                    {groups.bed.map((candidate) => renderCandidate(candidate, "bed"))}
                  </ul>
                </div>
              ) : null}
              {groups["no-bed"].length > 0 ? (
                <div className={shortlistStyles.fitGroup} data-fit-group="no-bed">
                  <h5 className={shortlistStyles.fitGroupHead}>
                    Fits, no bed now <span className={shortlistStyles.fitGroupCount}>{groups["no-bed"].length}</span>
                  </h5>
                  <ul className={styles.shortlistCandidateList}>
                    {groups["no-bed"].map((candidate) => renderUnavailable(candidate, "no-bed"))}
                  </ul>
                </div>
              ) : null}

              {/* Wards that take this person only with an override reason: still choosable, so the
              count is stated while closed and the list opens itself while one of them is chosen. */}
              {groups.review.length > 0 ? (
                <div className={styles.shortlistUnavailableBlock} data-fit-group="review">
                  <button
                    type="button"
                    className={`${styles.shortlistOverrideButton} ${shortlistStyles.allocationButtonTouch} ${mock.disclosure}`}
                    data-testid="ward-shortlist-review-toggle"
                    aria-expanded={reviewShown}
                    onClick={() => setReviewOpen((open) => !open)}
                  >
                    {groups.review.length} {groups.review.length === 1 ? "ward needs" : "wards need"} an override reason
                    <ChevronDown aria-hidden="true" className={mock.chevron} />
                  </button>
                  {reviewShown ? (
                    <ul className={styles.shortlistCandidateList}>
                      {groups.review.map((candidate) => renderCandidate(candidate, "review"))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {/* ⚠️ A DISCLOSURE, NOT A FILTER. These wards fail a gate no recorded reason can buy, so
            there is no choice behind this toggle. The count is stated while collapsed and what is
            behind it is the reasons, not just the names. */}
              {groups.no.length > 0 ? (
                <div className={styles.shortlistUnavailableBlock}>
                  <button
                    type="button"
                    className={`${styles.shortlistOverrideButton} ${shortlistStyles.allocationButtonTouch} ${mock.disclosure}`}
                    data-testid="ward-shortlist-unavailable-toggle"
                    aria-expanded={unavailableOpen}
                    onClick={() => setUnavailableOpen((open) => !open)}
                  >
                    {groups.no.length} {groups.no.length === 1 ? "ward cannot" : "wards cannot"} take this person
                    <ChevronDown aria-hidden="true" className={mock.chevron} />
                  </button>
                  {unavailableOpen ? (
                    <ul className={styles.shortlistCandidateList} data-testid="ward-shortlist-unavailable-list">
                      {groups.no.map((candidate) => renderUnavailable(candidate, "no"))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {/* The road-time caveat and what Pulled means, said once, as one small note (P125 and the
              route caveat keep their words; they no longer sit between the lists). */}
              <p className={`${mock.listNote} ${shortlistStyles.tabularNum}`} data-testid="ward-shortlist-pulled-note">
                {originEd?.referenceEdId !== undefined ? (
                  <span data-testid="ward-shortlist-route-caveat">{REFERENCE_DISTANCE_CAVEAT} </span>
                ) : null}
                {PULLED_EXPLANATION}{" "}
                <button type="button" className={mock.inlineLink} onClick={() => openWardHelp("glossary")}>
                  {GLOSSARY_LINK_TEXT}
                </button>
              </p>
            </div>
          </section>

          <footer className={`${styles.shortlistActions} ${shortlistStyles.actionToolbar}`}>
            {referTargetNames.length === 0 ? null : (
              <p className={`${styles.shortlistAutoAllocationNote} ${shortlistStyles.tabularNum}`}>
                <span className={shortlistStyles.toWard} data-testid="ward-shortlist-to">
                  To <strong>{referTargetNames.join(", ")}</strong>
                </span>
                <span className={shortlistStyles.toMeta}>
                  {referTargets.length} selected · {movement.referredUnitIds.length} of {parallelReferralCap} parallel
                  referrals in use.
                </span>
                {overParallelCap ? (
                  <span role="status" className={shortlistStyles.toMeta} data-testid="ward-shortlist-over-cap">
                    This asks more wards than the usual limit of {parallelReferralCap}. You can still ask.
                  </span>
                ) : null}
              </p>
            )}

            {/* Task 5 fix round 1: rendered only when `overrideSucceeded` — a real check against
            `movement.referredUnitIds`, not the mere existence of `overrideRecord`. A refused
            override leaves this silent here; the refusal is visible on the Exceptions drawer
            instead (`rejections`), never claimed as a success on this footer. */}
            {overrideRecord && overrideSucceeded ? (
              <p
                className={`${styles.shortlistConfirmationRecord} ${shortlistStyles.tabularNum}`}
                data-testid="ward-shortlist-confirmation-record"
              >
                {`Overridden by a human coordinator — referred to ${overrideRecordUnits.join(", ")} at ${formatInstantWithDay(overrideRecord.at, now)} — reason: "${overrideRecord.reason}". No bed was allocated automatically.`}
              </p>
            ) : null}

            <div className={`${styles.shortlistActionRow} ${mock.actions}`}>
              {/* Phone (v10): with no ward picked yet, Refer is never shown greyed. It reads "Choose a
              ward to refer" and takes the person to the fits list; nothing is referred against a
              default (Critical 2), so the choice stays a human tap on a ward. */}
              {isPhone && !onRefer && !hasReferSelection && referralBlocked === undefined ? (
                <button
                  type="button"
                  data-testid="ward-shortlist-refer"
                  data-phone-choose="true"
                  className={`${styles.shortlistConfirmButton} ${shortlistStyles.allocationButtonTouch}`}
                  onClick={(event) => chooseWard(event.currentTarget)}
                >
                  Choose a ward to refer
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="ward-shortlist-refer"
                  aria-disabled={canRefer || onRefer ? undefined : "true"}
                  aria-describedby={canRefer || onRefer ? undefined : "ward-shortlist-refer-unavailable"}
                  title={canRefer || onRefer ? undefined : referUnavailableReason}
                  className={`${styles.shortlistConfirmButton} ${shortlistStyles.allocationButtonTouch}`}
                  onClick={canRefer || onRefer ? handleRefer : ignoreUnavailableActivation}
                >
                  {referTargetNames.length === 1 ? `Refer to ${referTargetNames[0]}` : "Refer"}
                </button>
              )}
              {onRefer && canRefer ? (
                <button
                  type="button"
                  data-testid="ward-shortlist-quick-send"
                  className={`${styles.shortlistOverrideButton} ${shortlistStyles.allocationButtonTouch}`}
                  onClick={handleQuickSend}
                >
                  {/* The ward is named on Refer and the To line, so this stays short enough to share a row. */}
                  Quick send
                </button>
              ) : null}
              <button
                type="button"
                data-testid="ward-shortlist-override-toggle"
                aria-disabled={canOverride || isPhone ? undefined : "true"}
                aria-describedby={canOverride ? undefined : "ward-shortlist-override-unavailable"}
                title={canOverride ? undefined : overrideUnavailableReason}
                aria-expanded={overrideOpen}
                className={`${styles.shortlistOverrideButton} ${shortlistStyles.allocationButtonTouch}`}
                onClick={
                  canOverride
                    ? () => setOverrideOpen((open) => !open)
                    : isPhone
                      ? // Phone: never greyed; with no ward picked it takes the person to the list.
                        (event) => chooseWard(event.currentTarget)
                      : ignoreUnavailableActivation
                }
              >
                Override
              </button>
            </div>
            {!canRefer ? (
              <span id="ward-shortlist-refer-unavailable" className="sr-only">
                {referUnavailableReason}
              </span>
            ) : null}
            {!canOverride ? (
              <span id="ward-shortlist-override-unavailable" className="sr-only">
                {overrideUnavailableReason}
              </span>
            ) : null}
            {!canOverride && !isPhone ? (
              // Usability review, Josh approved 24 Oct 2026: a greyed action names its blocker in short
              // visible words, with the one fix beside it when the fix is on this screen. Screen readers
              // keep the full sentence above (the button's description); the short words are visual.
              // The fix is the same jump to the ward list the phone's Override already makes.
              <span className={shortlistStyles.unavailableLine} data-testid="ward-placement-override-why">
                <span aria-hidden="true">
                  <DisabledReason id="ward-placement-override-words">Override needs a ward chosen first</DisabledReason>
                </span>
                <button
                  type="button"
                  className={buttonClass({ variant: "ghost", size: "sm" })}
                  data-testid="ward-placement-override-fix"
                  onClick={(event) => chooseWard(event.currentTarget)}
                >
                  Choose a ward
                </button>
              </span>
            ) : null}

            {overrideOpen && canOverride ? (
              <form className={styles.shortlistOverrideForm} onSubmit={handleOverrideSubmit}>
                {/*
              ⚠️ WHAT THE BED FAILED ON, IN THE FORM, AT THE MOMENT OF OVERRIDING.
              Derivation by Ward Verifier; the sentence already existed, computed and in scope, one
              line from being rendered — `firstIneligibleSelected` at :404 and `candidateReason` at
              :410, where it feeds the INERT plain-Refer button's `title`.
              And that was the whole problem. Until now the failing gate reached a sighted mouse
              user ONLY as a tooltip on a button they cannot click, plus an `sr-only` span. A
              coordinator on a touch screen never saw it. One moving by keyboard never saw it. One
              who had scrolled past never saw it. So at the only irreversible moment, for a large
              class of users, the advice was never legible at all.
              The owner ruled "keep advising and let the clinician decide". THIS IS THAT RULING'S
              REMAINING WORK — advising where the decision is actually taken.
              ⚠️ NOT A GATE. It does not disable Override, does not add a confirmation step, and
              does not touch `canOverride`. It states the reason and leaves the decision where the
              owner put it.
            */}
                {/*
              TWO BLOCKERS, NOT ONE — and the first version of this block rendered for only one of
              them. Refer can be unavailable because a selected ward is ineligible OR because the
              movement's own stage is not referable, and `canOverride` deliberately carries neither
              guard: overriding a non-referable stage is a documented, intended path (see the
              comment on `canOverride`). Keying this block on `firstIneligibleSelected` alone meant
              a coordinator overriding a STAGE block, with every selected ward eligible, opened the
              form and read nothing at all — the same silence at the same moment, from the other
              cause. Found by Ward Verifier, against my own comment forty lines up that had already
              said the stage path existed.

              ⚠️ BOTH REASONS RENDER WHEN BOTH APPLY, and the stage reason leads. The button shows
              one reason because it has room for one; this form is the moment of the irreversible
              act, and showing only the higher-precedence one would leave a coordinator who has
              just overridden the stage block still unaware the ward is ineligible — which is this
              defect again, one layer down. Leading with the stage matches `referUnavailableReason`
              above, so the form and the button never disagree about which reason comes first.

              ⚠️ STILL NOT A GATE. Neither line touches `canOverride`.
            */}
                {referralBlocked || firstIneligibleSelected ? (
                  /* ⚠️ THE WRAPPER TAKES A NEW ID AND THE OLD ONE GOES BACK WHERE IT MEANT SOMETHING.
                 `ward-shortlist-override-failing-gate` used to name THE INELIGIBILITY SENTENCE. When
                 this became two lines I put it on the wrapper, whose `textContent` is now BOTH
                 sentences concatenated — so a future assertion written against that id would pass
                 for the wrong reason, which is structurally the same defect this block exists to
                 fix. Found by Ward Verifier, which checked the whole tree first and confirmed no
                 test references it today, so nothing breaks. */
                  <div data-testid="ward-shortlist-override-reasons">
                    {referralBlocked ? (
                      <p className={styles.shortlistOverrideLabel} data-testid="ward-shortlist-override-stage-block">
                        {referralBlocked}
                      </p>
                    ) : null}
                    {firstIneligibleSelected ? (
                      <p className={styles.shortlistOverrideLabel} data-testid="ward-shortlist-override-failing-gate">
                        <strong>{firstIneligibleSelected.unit.name}</strong>
                        {" — Not eligible: "}
                        {candidateReason(firstIneligibleSelected.verdict)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <label className={styles.shortlistOverrideLabel} htmlFor="ward-shortlist-override-reason">
                  Reason for overriding the shortlist for{" "}
                  {referredCandidates.map((c) => c?.unit.name ?? "an unresolved unit").join(", ")}
                </label>
                {/*
              Owner decision OD-3: the free-text box is gone and these five replace it. Derived
              from `OVERRIDE_REASONS` rather than written out here — a second copy of an
              owner-approved list is how two screens come to offer different words for one thing.

              ⚠️ NEVER ADD AN "OTHER, PLEASE SPECIFY" (WB-DB-16). That option is precisely how free
              text returns after being removed from the front, and it would undo the decision this
              control implements.
            */}
                <select
                  id="ward-shortlist-override-reason"
                  required
                  className={styles.shortlistOverrideSelect}
                  value={overrideReason}
                  onChange={(event) => setOverrideReason(event.target.value)}
                >
                  <option value="">Choose a reason</option>
                  {OVERRIDE_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className={`${styles.shortlistOverrideSubmit} ${shortlistStyles.allocationButtonTouch}`}
                  aria-disabled={overrideReason === "" ? "true" : undefined}
                  aria-describedby={overrideReason === "" ? "ward-shortlist-override-submit-words" : undefined}
                  onClick={overrideReason === "" ? ignoreUnavailableActivation : undefined}
                >
                  Record override
                </button>
                {overrideReason === "" ? (
                  <DisabledReason id="ward-shortlist-override-submit-words">Choose a reason first</DisabledReason>
                ) : null}
              </form>
            ) : null}

            {/*
          T12 (item 9, owner answer 9, 17 September 2026): "Non-binary patient: coordinator
          places with a recorded reason after checking with the ward, preferring a single room."
          Build plan §2's exact wording — legend, guidance, tick and submit label are quoted, not
          paraphrased, the same discipline `OVERRIDE_REASONS`'s own rendering above holds to.

          Shown WHENEVER it is needed, with no separate toggle to open it — unlike Override, this
          is not an optional escalation a coordinator reaches for; it is the one path through a
          gate `canRefer` above already reports as unavailable, so hiding it behind a second click
          would repeat the exact defect this file's own history records for the override reason
          (a failing gate reaching a sighted mouse user only as a button tooltip).
        */}
            {needsGenderPlacement ? (
              <form
                className={styles.shortlistOverrideForm}
                onSubmit={submitGenderPlacement}
                data-testid="ward-shortlist-gender-placement-form"
              >
                <fieldset>
                  <legend className={styles.shortlistOverrideLabel}>Place a non-binary patient</legend>
                  <p className={styles.shortlistOverrideLabel} data-testid="ward-shortlist-gender-placement-guidance">
                    Check with the ward first. A single room is preferred.
                  </p>
                  <p className={styles.shortlistOverrideLabel} data-testid="ward-shortlist-gender-placement-refusal">
                    {GENDER_PLACEMENT_REFUSAL}
                  </p>
                  <label className={styles.shortlistOverrideLabel} htmlFor="ward-shortlist-gender-placement-reason">
                    Reason
                  </label>
                  <select
                    id="ward-shortlist-gender-placement-reason"
                    required
                    className={styles.shortlistOverrideSelect}
                    data-testid="ward-shortlist-gender-placement-reason"
                    value={genderPlacementReason}
                    onChange={(event) => setGenderPlacementReason(event.target.value)}
                  >
                    <option value="">Choose a reason</option>
                    {GENDER_PLACEMENT_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                  <label className={styles.shortlistOverrideCheckOption}>
                    <input
                      type="checkbox"
                      checked={genderPlacementChecked}
                      onChange={(event) => setGenderPlacementChecked(event.target.checked)}
                      data-testid="ward-shortlist-gender-placement-checked"
                    />
                    I have checked this placement with the ward
                  </label>
                  {(() => {
                    // Finding 114: aria-disabled with the reason shown, like every other form here.
                    const genderPlacementBlocked =
                      genderPlacementReason.trim().length === 0
                        ? "Choose a reason"
                        : !genderPlacementChecked
                          ? "Tick that you checked with the ward"
                          : null;
                    return (
                      <>
                        <button
                          type="submit"
                          className={`${styles.shortlistOverrideSubmit} ${shortlistStyles.allocationButtonTouch}`}
                          aria-disabled={genderPlacementBlocked ? "true" : undefined}
                          aria-describedby={
                            genderPlacementBlocked ? "ward-shortlist-gender-placement-words" : undefined
                          }
                          onClick={genderPlacementBlocked ? ignoreUnavailableActivation : undefined}
                          data-testid="ward-shortlist-gender-placement-submit"
                        >
                          Record reason and place
                        </button>
                        {genderPlacementBlocked ? (
                          <DisabledReason id="ward-shortlist-gender-placement-words">
                            {genderPlacementBlocked}
                          </DisabledReason>
                        ) : null}
                      </>
                    );
                  })()}
                </fieldset>
              </form>
            ) : null}
          </footer>
        </>
      ) : null}

      {(() => {
        const eligibilityBadge = activeUnit
          ? `${metCount} of ${checkedCount} met${notMetCount > 0 ? ` · ${notMetCount} to review` : ""}`
          : "Select ward";
        const eligibilityTone = activeUnit ? (notMetCount > 0 ? "warn" : "good") : "neutral";

        return (
          <details
            ref={eligibilityDetailsRef}
            className={`${shortlistStyles.detailDisclosure} source-print`}
            aria-label="Eligibility checks"
          >
            <summary data-badge={eligibilityBadge} data-badge-tone={eligibilityTone}>
              {activeUnit ? `Checks for ${activeUnit.name}` : "Eligibility checks"}
            </summary>
            {/*
          The ward detail block (Command mockup parity, task C): that ward's own bed states, in
          this column, once a ward is selected. `flow-diagram.tsx` already renders this exact chip
          set (available/held/blocked/occupied/confirmed/expected) on every diagram node ALWAYS;
          this is the genuinely new surface — the same figures reachable from the shortlist column
          the mockup puts them in, without a coordinator having to look back at the diagram.

          ⚠️ Four separate labelled counts, deliberately not the mockup's "N occupied of M beds"
          ratio: `capacityLine` above already states Ready/Pulled/Closed/Occupied this same way for
          every candidate row, and the diagram's own bed chips (`coordinator.module.css`'s
          `.diagramBedChip` rules, reused here rather than duplicated) never use a ratio either.
          Introducing one here would be a fifth reading of the same beds this screen already states
          four ways, and a ratio a coordinator has to do arithmetic on to recover a state count is
          worse than four figures they can read directly — this repo's own form is kept because it
          is already the better one, not merely because it is what was there.
        */}
            {activeUnit && activeCapacity && activeBreakdown ? (
              <div className={styles.shortlistWardDetail} data-testid={`ward-shortlist-ward-detail-${activeUnit.id}`}>
                <span className={styles.diagramBedRow}>
                  <span className={`${styles.diagramBedChip} ${shortlistStyles.tabularNum}`} data-state="available">
                    Ready {activeCapacity.ready}
                  </span>
                  <span className={`${styles.diagramBedChip} ${shortlistStyles.tabularNum}`} data-state="pulled">
                    Pulled {activeCapacity.pulled}
                  </span>
                  <span className={`${styles.diagramBedChip} ${shortlistStyles.tabularNum}`} data-state="closed">
                    Closed {activeCapacity.closed}
                  </span>
                  <span className={`${styles.diagramBedChip} ${shortlistStyles.tabularNum}`} data-state="occupied">
                    Occupied {activeCapacity.occupied}
                  </span>
                  <span className={`${styles.diagramBedChip} ${shortlistStyles.tabularNum}`} data-state="confirmed">
                    Confirmed {activeBreakdown.confirmedToday}
                  </span>
                  <span className={`${styles.diagramBedChip} ${shortlistStyles.tabularNum}`} data-state="expected">
                    Expected {activeBreakdown.expectedToday}
                  </span>
                </span>
                {/*
              BELOW the chip row, never a seventh chip — the same owner ruling `flow-diagram.tsx`'s
              `UnitNode` and `capacityLine` above both already carry: "Ready 2" followed by "1"
              reads as 21. An absence is silence, never "0 being made ready". Nothing is subtracted
              from `activeCapacity.available` above for this — the Ready figure is untouched.
            */}
                {activePendingPreparation > 0 ? (
                  <span
                    className={`${styles.diagramBeingMadeReady} ${shortlistStyles.tabularNum}`}
                    data-testid={`ward-shortlist-ward-detail-pending-${activeUnit.id}`}
                  >
                    {activePendingPreparation} of the ready {activePendingPreparation === 1 ? "bed is" : "beds are"}{" "}
                    still being made ready
                  </span>
                ) : null}
                {/* Owner Answer 18 (second round, 2026-09-17): the ward's own fixed-list answer to
                what is currently limiting who it can accept — the coordinator's ward-detail view
                this ruling names. Chosen labels only, never a code. */}
                {activeUnit.intakeConstraints !== undefined && activeUnit.intakeConstraints.length > 0 ? (
                  <span
                    className={styles.diagramBeingMadeReady}
                    data-testid={`ward-shortlist-ward-detail-constraints-${activeUnit.id}`}
                  >
                    Limiting intake:{" "}
                    {activeUnit.intakeConstraints.map((code) => wardIntakeConstraintLabels[code]).join(", ")}
                  </span>
                ) : null}
              </div>
            ) : null}
            {/* The security gate below will read "Met — Secure ward meets an open requirement" for this
            pairing, which is true and is deliberately left alone (`ward-eligibility.ts` is a
            protected surface). What a tick cannot say is that this is a clinical decision rather
            than a neutral match, so it is said here, immediately above the gate list a coordinator
            reads before referring (review Important 5, Task 5: wording now comes from
            `restrictionNotice`, which distinguishes the sharper voluntary-on-locked case). */}
            {activeNotice ? (
              <p
                className={
                  activeNotice.level === "voluntary_on_locked"
                    ? styles.shortlistRestrictiveNoteProminent
                    : styles.shortlistRestrictiveNote
                }
                data-testid="ward-shortlist-restrictive-note"
                data-level={activeNotice.level}
              >
                {activeNotice.level === "voluntary_on_locked"
                  ? `${activeNotice.text}. The security check below passes, but a voluntary patient on a locked ward is a decision for a human, not a match.`
                  : `${activeNotice.text}. The security check below passes, but placing an open-status patient on a locked ward is a decision for a human, not a match.`}
              </p>
            ) : null}
            {sortedGates.length === 0 ? (
              <p id="ward-shortlist-gate-list" className={styles.placeholder}>
                Select a candidate unit to see its eligibility checks.
              </p>
            ) : (
              <>
                <ol id="ward-shortlist-gate-list" className={styles.shortlistGateList}>
                  {sortedGates.map((gate) => (
                    <li
                      key={gate.gate}
                      data-testid={`ward-gate-${gate.gate}`}
                      data-pass={String(gate.pass)}
                      data-mark={gateMark(gate)}
                      className={styles.shortlistGateRow}
                    >
                      {gateMark(gate) === "info" ? (
                        <Info aria-hidden="true" />
                      ) : gate.pass ? (
                        <CheckCircle2 aria-hidden="true" className={styles.shortlistGateIconOk} />
                      ) : (
                        <CircleAlert aria-hidden="true" className={styles.shortlistGateIconBad} />
                      )}
                      <span className={styles.shortlistGateLabel}>{GATE_LABELS[gate.gate]}</span>
                      <strong
                        className={
                          gateMark(gate) === "info"
                            ? undefined
                            : gate.pass
                              ? styles.shortlistGateVerdictOk
                              : styles.shortlistGateVerdictBad
                        }
                      >
                        {gateMark(gate) === "info" ? "For information" : gate.pass ? "Met" : "Not met"}
                      </strong>
                      <span className={styles.shortlistGateDetail}>{gate.detail}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </details>
        );
      })()}

      {(() => {
        // Less clutter (Home placement redesign, Josh 19 Oct 2026): no "Declines · 0" disclosure
        // when nothing has been declined.
        if (movement.declines.length === 0) return null;
        return (
          <details className={`${shortlistStyles.detailDisclosure} source-print`} aria-label="Declines">
            <summary
              className={shortlistStyles.tabularNum}
              data-badge={`${movement.declines.length} declined`}
              data-badge-tone="warn"
            >
              Declines · {movement.declines.length}
            </summary>
            <ul className={styles.shortlistDeclineList}>
              {movement.declines.map((decline, index) => {
                const unit = units.find((candidate) => candidate.id === decline.unitId);
                return (
                  <li
                    key={`${decline.unitId}-${index}`}
                    data-testid="ward-decline-row"
                    className={styles.shortlistDeclineRow}
                  >
                    <strong>{unit ? unit.name : "Unresolved unit"}</strong>
                    <span>
                      {decline.reason
                        ? (DECLINE_REASON_LABELS[decline.reason] ?? decline.reason)
                        : DECLINE_REASON_NOT_SHARED}
                    </span>
                    <span className={shortlistStyles.tabularTimestamp}>{formatInstantWithDay(decline.at, now)}</span>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })()}

      <NextWardAfterRefusal
        movement={movement}
        units={units}
        now={now}
        chosenUnitIds={referTargets}
        onChoose={(unitId) => {
          toggleReferTarget(unitId);
          onSelectUnit(unitId);
        }}
      />

      {(() => {
        // Top 25 item 15: only the ward this patient is matched to (accepted) or offered to
        // (explicitly selected), never the list's orientation default.
        const matchedUnitId = movement.acceptedUnitId ?? selectedUnitId;
        const matchedUnit = matchedUnitId ? units.find((unit) => unit.id === matchedUnitId) : undefined;
        return matchedUnit ? (
          <PreMatchCleaningNote movement={movement} unit={matchedUnit} bedReleases={bedReleases} />
        ) : null;
      })()}

      {/* Task 2: urgency and legal status can change mid-flight, each change recorded with who
          made it and when. Nothing here auto-allocates — see `submitUrgencyChange` and
          `submitLegalStatusChange` above; a status change that makes the accepted destination
          unlawful surfaces on the Exceptions drawer instead (`destinationNoLongerLawful`). */}
      <details className={shortlistStyles.recordActions}>
        <summary data-badge="Urgency · Legal">Update record</summary>
        <section aria-label="Change urgency or legal status">
          <h4 className={styles.shortlistSectionHeading}>Change urgency or legal status</h4>
          <div className={styles.shortlistActionRow}>
            <button
              type="button"
              data-testid="ward-change-urgency-toggle"
              aria-expanded={urgencyChangeOpen}
              className={`${styles.shortlistOverrideButton} ${shortlistStyles.allocationButtonTouch}`}
              onClick={() => {
                setUrgencyChangeOpen((open) => !open);
                // H-0127: start from the tier on the board now, which another desk may have changed.
                setUrgencyDraft({
                  urgency: movement?.flaggedUrgent ? "urgent" : (movement?.urgency ?? 1),
                  reason: undefined,
                  urgentReason: undefined,
                });
              }}
            >
              Change urgency
            </button>
            <button
              type="button"
              data-testid="ward-change-legal-status-toggle"
              aria-expanded={legalStatusChangeOpen}
              className={`${styles.shortlistOverrideButton} ${shortlistStyles.allocationButtonTouch}`}
              onClick={() => {
                setLegalStatusChangeOpen((open) => !open);
                // Blank on every open or close, so an earlier choice never stands in for a new one.
                setLegalStatusDraft({ legalStatus: undefined, reason: undefined });
                setLegalFormDraft({ code: "", time: "", day: 0 });
              }}
            >
              Change legal status
            </button>
          </div>

          {urgencyChangeOpen ? (
            <form
              className={styles.shortlistOverrideForm}
              onSubmit={submitUrgencyChange}
              data-testid="ward-change-urgency"
            >
              <label className={styles.shortlistOverrideLabel} htmlFor="ward-change-urgency-tier">
                {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                Urgency tier for {patientWho}
              </label>
              <select
                id="ward-change-urgency-tier"
                className={styles.shortlistOverrideSelect}
                value={urgencyDraft.urgency}
                onChange={(event) =>
                  setUrgencyDraft((current) => ({
                    ...current,
                    urgency: event.target.value === "urgent" ? "urgent" : (Number(event.target.value) as 1 | 2 | 3),
                  }))
                }
              >
                <option value="urgent">Urgent · ahead of tier 1</option>
                {/* The option TEXT carries the tier's direction, the option VALUE stays the bare tier.
                  A bare "1"/"2"/"3" left the direction of the scale to the reader on the one control
                  that re-ranks a patient in a queue urgency now dominates. `urgencyTierLabel` is the
                  one spelling, shared with the boards that read the same field back. */}
                {URGENCY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {urgencyTierLabel(option)}
                  </option>
                ))}
              </select>
              <label className={styles.shortlistOverrideLabel} htmlFor="ward-change-urgency-reason">
                {urgencyDraft.urgency === "urgent" ? "Why is this urgent?" : "Reason"}
              </label>
              {urgencyDraft.urgency === "urgent" ? (
                <select
                  id="ward-change-urgency-reason"
                  className={styles.shortlistOverrideSelect}
                  value={urgencyDraft.urgentReason ?? ""}
                  onChange={(event) =>
                    setUrgencyDraft((current) => ({
                      ...current,
                      urgentReason: URGENT_MARK_REASONS.includes(event.target.value as UrgentMarkReason)
                        ? (event.target.value as UrgentMarkReason)
                        : undefined,
                    }))
                  }
                >
                  <option value="">Choose why this is urgent</option>
                  {URGENT_MARK_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {changeReasonLabels[reason]}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  id="ward-change-urgency-reason"
                  className={styles.shortlistOverrideSelect}
                  value={urgencyDraft.reason ?? ""}
                  onChange={(event) =>
                    setUrgencyDraft((current) => ({
                      ...current,
                      reason: event.target.value === "" ? undefined : (event.target.value as UrgencyChangeReason),
                    }))
                  }
                >
                  <option value="">Choose a reason</option>
                  {URGENCY_CHANGE_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {changeReasonLabels[reason]}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="submit"
                className={`${styles.shortlistOverrideSubmit} ${shortlistStyles.allocationButtonTouch}`}
                aria-disabled={urgencyBlocked ? "true" : undefined}
                aria-describedby={urgencyBlocked ? "ward-change-urgency-blocked" : undefined}
                onClick={urgencyBlocked ? ignoreUnavailableActivation : undefined}
              >
                Record urgency change
              </button>
              {urgencyBlocked ? (
                <DisabledReason id="ward-change-urgency-blocked">{urgencyBlocked}</DisabledReason>
              ) : null}
            </form>
          ) : null}

          {legalStatusChangeOpen ? (
            <form
              className={styles.shortlistOverrideForm}
              onSubmit={submitLegalStatusChange}
              data-testid="ward-change-legal-status"
            >
              <label className={styles.shortlistOverrideLabel} htmlFor="ward-change-legal-status-value">
                {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                Legal status for {patientWho}
              </label>
              <select
                id="ward-change-legal-status-value"
                className={styles.shortlistOverrideSelect}
                value={legalStatusDraft.legalStatus ?? ""}
                onChange={(event) =>
                  setLegalStatusDraft((current) => ({
                    ...current,
                    legalStatus: event.target.value === "" ? undefined : (event.target.value as LegalStatus),
                  }))
                }
              >
                <option value="">Choose a legal status</option>
                {LEGAL_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <label className={styles.shortlistOverrideLabel} htmlFor="ward-change-legal-status-reason">
                Reason
              </label>
              <select
                id="ward-change-legal-status-reason"
                required
                className={styles.shortlistOverrideSelect}
                value={legalStatusDraft.reason ?? ""}
                onChange={(event) =>
                  setLegalStatusDraft((current) => ({
                    ...current,
                    reason: event.target.value === "" ? undefined : (event.target.value as LegalStatusChangeReason),
                  }))
                }
              >
                {/* Same wording as this panel's other unchosen-reason select, so the blank option
                  reads as one convention rather than two. */}
                <option value="">Choose a reason</option>
                {LEGAL_STATUS_CHANGE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {changeReasonLabels[reason]}
                  </option>
                ))}
              </select>
              {legalFormAsked ? (
                <>
                  <label className={styles.shortlistOverrideLabel} htmlFor="ward-change-legal-status-form">
                    Form
                  </label>
                  <select
                    id="ward-change-legal-status-form"
                    className={styles.shortlistOverrideSelect}
                    value={legalFormDraft.code}
                    onChange={(event) => setLegalFormDraft((current) => ({ ...current, code: event.target.value }))}
                    data-testid="ward-change-legal-status-form"
                  >
                    <option value="">Choose the form</option>
                    {legalFormOptions.map((form) => (
                      <option key={form.code} value={form.code}>
                        {legalFormName(form)}
                      </option>
                    ))}
                  </select>
                  <label className={styles.shortlistOverrideLabel} htmlFor="ward-change-legal-status-form-day">
                    Day it was made
                  </label>
                  <select
                    id="ward-change-legal-status-form-day"
                    className={styles.shortlistOverrideSelect}
                    value={legalFormDraft.day}
                    onChange={(event) =>
                      setLegalFormDraft((current) => ({ ...current, day: Number(event.target.value) === -1 ? -1 : 0 }))
                    }
                  >
                    <option value={0}>Today</option>
                    <option value={-1}>Yesterday</option>
                  </select>
                  <label className={styles.shortlistOverrideLabel} htmlFor="ward-change-legal-status-form-time">
                    Time it was made
                  </label>
                  <input
                    id="ward-change-legal-status-form-time"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="HH:MM"
                    className={styles.shortlistOverrideSelect}
                    value={legalFormDraft.time}
                    onChange={(event) => setLegalFormDraft((current) => ({ ...current, time: event.target.value }))}
                    data-testid="ward-change-legal-status-form-time"
                  />
                  {legalFormWarning ? (
                    <p
                      className={styles.shortlistOverrideLabel}
                      role="status"
                      data-testid="ward-change-legal-status-form-warning"
                    >
                      {legalFormWarning}
                    </p>
                  ) : null}
                </>
              ) : null}
              <button
                type="submit"
                className={`${styles.shortlistOverrideSubmit} ${shortlistStyles.allocationButtonTouch}`}
                aria-disabled={legalStatusBlocked ? "true" : undefined}
                aria-describedby={legalStatusBlocked ? "ward-change-legal-status-reason-blocked" : undefined}
                onClick={legalStatusBlocked ? ignoreUnavailableActivation : undefined}
              >
                Record legal status change
              </button>
              {legalStatusBlocked ? (
                <DisabledReason id="ward-change-legal-status-reason-blocked">{legalStatusBlocked}</DisabledReason>
              ) : null}
            </form>
          ) : null}
        </section>

        {/* Task 3: the undo the prototype has never had. Before this, the only path that released a
          pulled bed or cancelled a transport job was closing the movement outright, by recording an
          examination with outcome community_order or revoked. Each control renders only while the
          reducer would actually accept it — see `canReleasePull`/`canCancelTransport` above. */}
        {movement.stage === "pulled" || canCancelTransport ? (
          <section aria-label="Release or cancel">
            <h4 className={styles.shortlistSectionHeading}>Release the pulled bed or cancel transport</h4>
            <div className={styles.shortlistActionRow}>
              {movement.stage === "pulled" ? (
                <button
                  type="button"
                  data-testid="ward-release-pull-toggle"
                  aria-expanded={releasePullOpen}
                  aria-disabled={!canReleasePull ? "true" : undefined}
                  aria-describedby={!canReleasePull ? "ward-release-pull-transport-blocked" : undefined}
                  className={`${styles.shortlistOverrideButton} ${shortlistStyles.allocationButtonTouch}`}
                  onClick={canReleasePull ? () => setReleasePullOpen((open) => !open) : ignoreUnavailableActivation}
                >
                  Release the pulled bed
                </button>
              ) : null}
              {canCancelTransport ? (
                <button
                  type="button"
                  data-testid="ward-cancel-transport-toggle"
                  aria-expanded={cancelTransportOpen}
                  className={`${styles.shortlistOverrideButton} ${shortlistStyles.allocationButtonTouch}`}
                  onClick={() => setCancelTransportOpen((open) => !open)}
                >
                  Cancel transport
                </button>
              ) : null}
            </div>

            {movement.stage === "pulled" && activeTransport ? (
              <p id="ward-release-pull-transport-blocked">
                Cancel the active transport booking before releasing the pulled bed.
              </p>
            ) : null}
            {canReleasePull && releasePullOpen ? (
              <form
                className={styles.shortlistOverrideForm}
                onSubmit={submitReleasePull}
                data-testid="ward-release-pull"
              >
                <label className={styles.shortlistOverrideLabel} htmlFor="ward-release-pull-reason">
                  {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                  Reason for releasing the pulled bed for {patientWho}
                </label>
                <select
                  id="ward-release-pull-reason"
                  required
                  className={styles.shortlistOverrideSelect}
                  value={releasePullReason ?? ""}
                  onChange={(event) =>
                    setReleasePullReason(
                      event.target.value === "" ? undefined : (event.target.value as ReleasePullReason),
                    )
                  }
                >
                  <option value="">Choose a reason</option>
                  {RELEASE_PULL_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {changeReasonLabels[reason]}
                    </option>
                  ))}
                </select>
                {/* Audit 24-7 (CT-19): the final button sits beside the patient's name and UMRN. */}
                <p id="ward-release-pull-who" data-testid="ward-release-pull-who">
                  For {patientIdentityLine(patientIdentity)}
                </p>
                <button
                  type="submit"
                  className={`${styles.shortlistOverrideSubmit} ${shortlistStyles.allocationButtonTouch}`}
                  aria-disabled={releasePullReason === undefined ? "true" : undefined}
                  aria-describedby={
                    releasePullReason === undefined
                      ? "ward-release-pull-who ward-release-pull-reason-blocked"
                      : "ward-release-pull-who"
                  }
                  title={releasePullReason === undefined ? UNWIND_REASON_UNCHOSEN : undefined}
                  onClick={releasePullReason === undefined ? ignoreUnavailableActivation : undefined}
                >
                  Release the pulled bed
                </button>
                {releasePullReason === undefined ? (
                  <span id="ward-release-pull-reason-blocked" className="sr-only">
                    {UNWIND_REASON_UNCHOSEN}
                  </span>
                ) : null}
              </form>
            ) : null}

            {canCancelTransport && cancelTransportOpen ? (
              <form
                className={styles.shortlistOverrideForm}
                onSubmit={submitCancelTransport}
                data-testid="ward-cancel-transport"
              >
                <label className={styles.shortlistOverrideLabel} htmlFor="ward-cancel-transport-reason">
                  {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                  Reason for cancelling transport for {patientWho}
                </label>
                <select
                  id="ward-cancel-transport-reason"
                  required
                  className={styles.shortlistOverrideSelect}
                  value={cancelTransportReason ?? ""}
                  onChange={(event) =>
                    setCancelTransportReason(
                      event.target.value === "" ? undefined : (event.target.value as CancelTransportReason),
                    )
                  }
                >
                  <option value="">Choose a reason</option>
                  {CANCEL_TRANSPORT_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {changeReasonLabels[reason]}
                    </option>
                  ))}
                </select>
                {/* Audit 24-7 (CT-19): the final button sits beside the patient's name and UMRN. */}
                <p id="ward-cancel-transport-who" data-testid="ward-cancel-transport-who">
                  For {patientIdentityLine(patientIdentity)}
                </p>
                <button
                  type="submit"
                  className={`${styles.shortlistOverrideSubmit} ${shortlistStyles.allocationButtonTouch}`}
                  aria-disabled={cancelTransportReason === undefined ? "true" : undefined}
                  aria-describedby={
                    cancelTransportReason === undefined
                      ? "ward-cancel-transport-who ward-cancel-transport-reason-blocked"
                      : "ward-cancel-transport-who"
                  }
                  title={cancelTransportReason === undefined ? UNWIND_REASON_UNCHOSEN : undefined}
                  onClick={cancelTransportReason === undefined ? ignoreUnavailableActivation : undefined}
                >
                  Cancel transport
                </button>
                {cancelTransportReason === undefined ? (
                  <span id="ward-cancel-transport-reason-blocked" className="sr-only">
                    {UNWIND_REASON_UNCHOSEN}
                  </span>
                ) : null}
              </form>
            ) : null}
          </section>
        ) : null}
      </details>

      {/* Whole-branch review I2 (spec §11): moved into Phase 3 from Phase 4 on the reasoning
          that "a phase that only proves the loop which succeeds has not proved the loop." The
          shortlist above already renders what was tried (every candidate row) and why each
          failed (`candidateReason` on each one); this section adds the two facts nothing else on
          screen records: that the network really was exhausted, stamped on the movement, and who
          is being contacted next. Rendered whenever a recorded escalation exists (a persistent
          fact, never a toast), and the control to record a new one only while there genuinely is
          no eligible destination — the same `!hasEligible` condition the header
          above already uses for "No eligible destination found yet." */}
      {/* No contradiction (Home placement redesign, Josh 19 Oct 2026): once a destination has
          accepted, the "No eligible destination" prompt and its Record control are hidden. A
          recorded escalation still shows, because it is a fact on the movement. The recorded
          acceptance decides, not the unit lookup: an accepted ward that no longer resolves is
          still an acceptance. */}
      {movement.escalation || (!hasEligible && !movement.acceptedUnitId) ? (
        <section aria-label="Escalation" className={shortlistStyles.escalationSection}>
          <h4 className={styles.shortlistSectionHeading}>Escalation</h4>
          {movement.escalation ? (
            <p
              className={`${styles.shortlistEscalationRecord} ${shortlistStyles.tabularNum}`}
              data-testid="ward-shortlist-escalation-record"
            >
              {`Escalated at ${formatInstantWithDay(movement.escalation.at, now)} — tried ${movement.escalation.triedUnitIds.length} unit${movement.escalation.triedUnitIds.length === 1 ? "" : "s"} — contact: "${movement.escalation.contact}".`}
            </p>
          ) : null}
          {!hasEligible && !movement.acceptedUnitId ? (
            <>
              {!movement.escalation ? (
                <p className={styles.shortlistSectionNote}>
                  {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                  No eligible destination is currently available for {patientWho}. Record what was tried and who is
                  being contacted next.
                </p>
              ) : null}
              <button
                type="button"
                data-testid="ward-shortlist-escalation-toggle"
                aria-expanded={escalationOpen}
                className={`${styles.shortlistOverrideButton} ${shortlistStyles.allocationButtonTouch}`}
                onClick={() => setEscalationOpen((open) => !open)}
              >
                {movement.escalation ? "Update escalation" : "Record escalation"}
              </button>
              {escalationOpen ? (
                <form className={styles.shortlistOverrideForm} onSubmit={submitEscalation}>
                  <label className={styles.shortlistOverrideLabel} htmlFor="ward-shortlist-escalation-contact">
                    Role or service being contacted next — a role or service only, never a person&apos;s name (synthetic
                    data only)
                  </label>
                  <select
                    id="ward-shortlist-escalation-contact"
                    required
                    data-testid="ward-shortlist-escalation-contact"
                    className={styles.shortlistOverrideSelect}
                    value={escalationContact}
                    onChange={(event) => setEscalationContact(event.target.value as EscalationContact | "")}
                  >
                    <option value="">Choose who is being contacted</option>
                    {ESCALATION_CONTACTS.map((contact) => (
                      <option key={contact} value={contact}>
                        {contact}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    data-testid="ward-shortlist-escalation-submit"
                    className={`${styles.shortlistOverrideSubmit} ${shortlistStyles.allocationButtonTouch}`}
                    aria-disabled={escalationContact === "" ? "true" : undefined}
                    aria-describedby={escalationContact === "" ? "ward-shortlist-escalation-submit-words" : undefined}
                    onClick={escalationContact === "" ? ignoreUnavailableActivation : undefined}
                  >
                    Record escalation
                  </button>
                  {escalationContact === "" ? (
                    <DisabledReason id="ward-shortlist-escalation-submit-words">
                      Choose who is being contacted first
                    </DisabledReason>
                  ) : null}
                </form>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      <details className={`${styles.shortlistScoreDetails} ${shortlistStyles.scoreDetails} source-print`}>
        <summary className={`${styles.shortlistScoreSummary} ${shortlistStyles.tabularNum}`}>Why this wait</summary>
        <p className={styles.shortlistScoreNote}>The factors below explain a wait; they do not order the queue.</p>
        {factors.length === 0 ? (
          <p className={styles.placeholder}>No contributing factors currently.</p>
        ) : (
          <ul className={styles.shortlistScoreList}>
            {factors.map((factor) => (
              <li key={factor.label} className={`${styles.shortlistScoreFactor} ${shortlistStyles.tabularNum}`}>
                <strong>{factor.label}</strong> — {factor.detail}
              </li>
            ))}
          </ul>
        )}
      </details>
      {/* Desktop: the tier targets once, as small text at the panel foot rather than under the
          patient (Home placement redesign, Josh 19 Oct 2026). */}
      <p
        className={`${shortlistStyles.targetNote} ${shortlistStyles.footNote}`}
        data-testid="ward-shortlist-tier-targets"
      >
        {TIER_TARGETS_NOTE}
      </p>
    </div>
  );
}
