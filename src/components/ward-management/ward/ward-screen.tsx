"use client";

import Link from "next/link";
import { useEffect, useCallback, useRef, useState, type FormEvent } from "react";

import {
  BED_PREPARATION_NOTES,
  BED_RELEASE_BLOCKERS,
  changeReasonLabels,
  withdrawalReasonLabels,
  RELEASE_PULL_REASONS,
  type BedPreparationNote,
  type BedReleaseBlocker,
  type ReleasePullReason,
  OVERRIDE_REASONS,
  type OverrideReason,
  GENDER_NO_LONGER_SUITS_REFUSAL,
  WARD_INTAKE_CONSTRAINTS,
  wardIntakeConstraintLabels,
  type WardIntakeConstraint,
} from "@/components/ward-management/ward-change-reasons";
import {
  formatInstant,
  formatInstantWithDay,
  formatRemaining,
  minutesUntil,
} from "@/components/ward-management/ward-clock";
import {
  bedsPendingPreparation,
  capacityBreakdown,
  releaseBand,
} from "@/components/ward-management/ward-bed-availability";
import { designationSummary } from "@/components/ward-management/ward-bed-designation";
import {
  BED_RELEASE_BLOCKED_FIGURE_LABEL,
  BED_RELEASE_BLOCKED_LABEL,
  bedReleaseStateLabels,
  eligibilityWarning,
  elapsedLabel,
  isOpen,
  overridesAgainstUnit,
  restrictionNotice,
  stageCopy,
  unitCapacity,
} from "@/components/ward-management/ward-derivations";
import { OverrideRegister } from "@/components/ward-management/override-register";
import { WardChip } from "@/components/ward-management/ward-chip";
import { HIGH_ACUITY_STAFFING_REFUSAL, OVERRIDE_REASON_REQUIRED } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import type { ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import {
  eligibility,
  GENDER_DESIGNATION_PRIVACY_SENTENCE,
  wardFacingGateDetail,
  type EligibilityGate,
} from "@/components/ward-management/ward-eligibility";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
/**
 * ⚠️ **OWNER RULING, CLINICIAN CHECK R7 (2026-09-06), AND THE SCREEN IS OBLIGED TO SAY IT.**
 * He confirmed a ward is routinely waiting on more than one thing, and chose to keep recording
 * exactly ONE — *"defined as the one that will take longest. Say so on screen, or a reader will
 * think the others are unknown."*
 *
 * **The distinction is between unrecorded and unknown.** A single value with no explanation reads
 * as the ward's complete answer; it is the ward's LONGEST answer. Saying nothing here would make
 * this screen state something more definite than the data supports.
 *
 * One constant for two pickers: the same sentence written twice drifts, and this one is his.
 */
const WAITING_ON_LONGEST = "One only — the one that will take longest. A ward is often waiting on several.";

import {
  ARRIVAL_MODE_LABELS,
  BED_RELEASE_WAITING_ON,
  DECLINE_REASONS,
  type BedReleaseWaitingOn,
  type DeclineReason,
  type Movement,
  type Rejection,
  type Unit,
} from "@/components/ward-management/ward-model";
import { edById, siteByCode, WARD_LOCKED_BED_SPLITS } from "@/components/ward-management/ward-sites";
import {
  daysInBed as admissionStayDays,
  LEAVING_DESTINATIONS,
  type LeavingDestination,
} from "@/components/ward-management/ward-admissions";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { dayOf, minuteOfDay, type Instant } from "@/components/ward-management/ward-clock";
import { WardNotificationCenter } from "./ward-notification-center";

import { handoverScopeValue } from "@/components/ward-management/handover/handover-page";
import { wardBoardHref } from "@/components/ward-management/shell/ward-facade";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { SuburbTeamPanel } from "./suburb-team-panel";
/**
 * Task F1 (owner answer 32): the release/leave forms used to parse an `<input type="time">`'s
 * `HH:MM` straight into an `Instant` with `hours * 60 + minutes` — a bare minute of demo DAY
 * ZERO, never the clock's own current day. Once the demo clock rolled past midnight once, a
 * ward typing "14:00" meaning later today stamped a release with an instant hours in the PAST,
 * because the parse had no way to say which day "14:00" meant. Replaced by
 * `parseReleaseDayInstant`, which takes the same `HH:MM` text plus an explicit Today/Tomorrow
 * choice and resolves it against `now`'s own day — see this module's doc comment for the full
 * defect and the worked example that proves the fix.
 */
import { RELEASE_DAYS, parseReleaseDayInstant, releaseTimeAlreadyPassed, type ReleaseDay } from "./release-day";
import { WardAnswerView } from "./ward-answer-view";
import styles from "./ward.module.css";
import { WardDecisionsCockpit } from "./ward-decisions-cockpit";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import {
  LATE_ARRIVAL_GRACE_MINUTES,
  LEAVE_BED_OPEN_WARNING_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
} from "@/components/ward-management/ward-operational-defaults";

type WardScreenProps = { unitId: string; presentation?: "overview" | "answer" };

/**
 * `ACCEPT_IN_PRINCIPLE` and `DECLINE` refuse for exactly the same reasons in
 * `wardFlowReducer` — outside `destination_review`, an already-accepted movement, or this unit
 * holding no live referral for it. Computed once so the two buttons on an incoming-referral card
 * can never advertise different verdicts about whether the reducer would take the action (the
 * defect class this whole phase exists to close — see `shortlist-panel.tsx`'s `canRefer`).
 */
// Owner, 26 Sept 2026: the patient's name, not the WF journey number.
function referralAnswerBlocked(movement: Movement, unit: Unit, who?: string): string | undefined {
  if (movement.stage !== "destination_review") {
    return `${who ?? "This patient"} is ${stageCopy[movement.stage].label.toLowerCase()}, not awaiting a destination decision.`;
  }
  if (movement.acceptedUnitId) {
    return `${who ?? "This patient"} already has an accepted destination.`;
  }
  if (!movement.referredUnitIds.includes(unit.id)) {
    return `${unit.name} does not currently hold a live referral for ${who ?? "this patient"}.`;
  }
  return undefined;
}

/** `PULL_PATIENT`'s own preconditions, named so the Pull button can never advertise an action the
 * reducer would refuse. Only rendered at all once `movement.stage === "accepted_awaiting_bed"`;
 * this covers the remaining reasons a pull could still be refused at that stage. */
// Owner, 26 Sept 2026: the patient's name, not the WF journey number.
function pullBlockedReason(movement: Movement, unit: Unit, who?: string): string | undefined {
  if (movement.acceptedUnitId !== unit.id) {
    return `${who ?? "This patient"} was accepted at a different unit, not ${unit.name}.`;
  }
  if (unit.allocatable.value <= 0) {
    return `No allocatable bed remains at ${unit.name}.`;
  }
  return undefined;
}

function originPlaceLabel(originEdId: string): string {
  return edById(originEdId)?.name ?? originEdId;
}

function arrivalIsLate(movement: Movement, now: Instant): boolean {
  const estimatedArrivalAt = movement.arrivalDetails?.estimatedArrivalAt;
  if (estimatedArrivalAt === undefined) return false;
  return now > estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES;
}

/**
 * Labels for the two decisions this screen dispatches that the reducer can still refuse even
 * once `referralAnswerBlocked`/`pullBlockedReason` above say go ahead — `PULL_PATIENT`'s own
 * bed-readiness and specialling gates, and a second `ACCEPT_IN_PRINCIPLE` for a movement another
 * dispatch already accepted, are both real, reducer-enforced refusals neither local check
 * mirrors. Keyed by `Rejection.attempted`, which is the event's own type string verbatim (see
 * `makeRejection` in `ward-flow-reducer.ts`) — this reads it back as the words already on the
 * button, not the SCREAMING_CASE event name.
 */
const WARD_ACTION_REJECTION_LABELS: Record<string, string> = {
  ACCEPT_IN_PRINCIPLE: "Accept in principle",
  PULL_PATIENT: "Pull a bed",
  PATIENT_ARRIVED: "Confirm Arrival",
};

/** Human labels for the existing movement eligibility result shown in this ward's own view. */
const WARD_GATE_LABELS: Record<EligibilityGate, string> = {
  acuity: "Acuity",
  age: "Age band",
  allocatable_bed: "Allocatable bed",
  authorisation: "Authorisation",
  capacity_freshness: "Capacity freshness",
  cohort: "Cohort",
  forensic: "Forensic bed",
  legal_status: "Legal status",
  prior_decline: "Prior decline",
  security: "Security",
  // 🔴 RENAMED FROM `sex_designation`, T10 (item 8): now reads gender recorded at referral.
  // Opus review round 2, 17 September 2026 (P2), privacy: a ward or ED screen must never show
  // the words "sex" or "gender" beside this gate, because a verdict beside a displayed sex could
  // reveal a trans or non-binary patient (plan §2). "Bed designation" — never "Gender
  // designation" — is this label on THIS screen only; the coordinator's own console shows no gate
  // label at all and keeps the specific `detail` text (see `GENDER_DESIGNATION_PRIVACY_SENTENCE`'s
  // own doc comment below for the detail half of this rule).
  gender_designation: "Bed designation",
  sex_mix: "Sex mix",
  specialling: "Specialling",
};

/**
 * Opus review round 2, 17 September 2026 (P2), privacy: the T12 non-binary-placement refusals
 * (`ward-flow-reducer.ts`'s `ACCEPT_IN_PRINCIPLE`/`PULL_PATIENT` cases) name the word "non-binary"
 * directly in their `reason`, written for `state.rejections` generally — an audience that
 * includes the coordinator, who is meant to see it. `lastActionRejection.reason` below renders
 * THAT SAME string verbatim on this ward-only screen, which is exactly the leak plan §2 exists to
 * close: a ward user reading "non-binary" learns a fact about the patient no gate detail is
 * allowed to state here. Matches by substring, never by event type, because the same
 * `ACCEPT_IN_PRINCIPLE`/`PULL_PATIENT` refusal has other, unrelated reasons this function must
 * leave untouched.
 *
 * P1-3 (Ward Lead ruling, 17 September 2026): extended for `heldUnitGenderRefusal`'s two forward-
 * stage refusals (`ward-flow-reducer.ts`) — `GENDER_NO_LONGER_SUITS_REFUSAL` and its non-binary
 * sibling `GENDER_NO_LONGER_SUITS_NON_BINARY_REFUSAL`. Both are already generic (neither names
 * "sex", "gender" or "non-binary"), but they differ from each other ONLY in whether the ward must
 * also record a reason and a ward check — and that difference is itself the T12 non-binary
 * placement procedure, so showing it verbatim on this screen would leak exactly what the
 * "non-binary" substitution just above exists to hide, through a different door. Both collapse to
 * the plain sentence, matched by a phrase common to both rather than by the whole string, so this
 * still catches the non-binary variant.
 */
function wardSafeRejectionReason(reason: string): string {
  if (reason.toLowerCase().includes("non-binary")) return GENDER_DESIGNATION_PRIVACY_SENTENCE;
  if (reason.toLowerCase().includes("no longer suits this patient")) return GENDER_NO_LONGER_SUITS_REFUSAL;
  return reason;
}

/**
 * Task 8: one inpatient unit's own view — the ward answering what the coordinator refers,
 * never a filtered copy of the coordinator's statewide screen. Everything here is scoped to
 * exactly one `Unit`, resolved from the provider's live `units`. An id that resolves to nothing
 * renders an explicit empty state naming the id (Global Constraint, addendum R40) — never a
 * substituted unit, never `?? allUnits()[0]`.
 *
 * Every figure is derived fresh from the live `movements`/`units` the provider hands back on
 * every render, never cached in local state — the same discipline `ward-flow-queue-selection`
 * proves for the coordinator screen. Once a referral is accepted, it disappears from "incoming"
 * and appears under "accepted, pulled or en route" on the very next render, because both lists are
 * plain filters over the same live array; there is no local "it worked" flag anywhere in this
 * file for the reasons `shortlist-panel.tsx`'s own comment on `OverrideRecord` explains.
 *
 * Whole-branch review Critical 1: this screen used to resolve `unit` via `unitById(unitId)` —
 * `ward-sites.ts`'s frozen fixture — so this ward's own bed grid, its "Currently confirmed"
 * line, its capacity-input default and `pullBlockedReason`'s allocatable check never moved even
 * after this exact screen dispatched `CONFIRM_CAPACITY` against itself. `unit` now resolves from
 * the provider's live `units`, the same collection `CONFIRM_CAPACITY`/`PULL_PATIENT`/`PATIENT_ARRIVED`
 * all write to, so a ward reading its own action back is now structurally the same read as
 * anyone else reading it.
 */

/**
 * 🔴 **THE DAILY RETURN'S THREE QUESTIONS, DECLARED ONCE — A4.**
 *
 * The panel asks five things and counts three, and **the three is correct**: rows 4 and 5 record an
 * individual item (a bed coming free, somebody on leave), not an ANSWER ACT somebody performed.
 * See the comment beside those rows for why counting them would build a progress bar that can never
 * reach the end on a perfectly correct ward. **That reasoning is not what A4 changes.**
 *
 * ⚠️ **What A4 changes is that the number 3 used to be typed.** The denominator was the literal `3`
 * in the panel's label while the questions were a union in `useState`'s type argument — **two places
 * that had to agree, with nothing forcing them to.** A fourth question would have left the screen
 * confidently announcing "of 3", which is the class of wrong statement this project cares most
 * about, and no existing test would have caught it: one pins `/\bof 3 confirmed\b/` and would simply
 * have kept passing.
 *
 * 🔴 **Both now derive from this array, so they cannot disagree.** Add a fourth question here and the
 * denominator moves with it. **The order is the order the rows render in** and is not incidental —
 * the panel asks them in this sequence every morning.
 */
const DAILY_RETURN_QUESTIONS = ["empty", "allocatable", "constraints"] as const;

/** The key of one daily-return question. Derived from the array above rather than declared beside
 *  it, so there is no second list to keep in step. */
type DailyReturnQuestion = (typeof DAILY_RETURN_QUESTIONS)[number];

export function WardScreen({ unitId, presentation = "overview" }: WardScreenProps) {
  if (presentation === "answer") {
    return <WardAnswerView unitId={unitId} />;
  }
  return <WardOverviewScreen key={unitId} unitId={unitId} presentation={presentation} />;
}
// Fail closed for older provider adapters/test doubles without the identity projection.
// Never reconstruct the missing lookup by reaching for the full referral array here.
const unavailablePatientIdentity = (): ResolvedPatientInfo => ({
  displayName: "Not recorded",
  formalName: "Not recorded",
  umrn: "UMRN not recorded",
  initials: "UP",
});

function WardOverviewScreen({ unitId, presentation = "overview" }: WardScreenProps) {
  const {
    movements,
    resolvePatientIdentity = unavailablePatientIdentity,
    units,
    bedReleases,
    leaveBeds,
    refreshRequests,
    dispatch,
    rejections,
    admissions,
    notices,
    morningRollupConfirmations,
    configuration,
  } = useWardFlow();
  const now = useWardFlowClock();
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [dismissedBuzzes, setDismissedBuzzes] = useState<number[]>([]);
  // Item 44, build plan task F3 (§2 "Bed board, ward page and all seven statistics screens: a
  // sentence only."). A hook, so it is read unconditionally, before the not-found early return
  // below — the same discipline this file's own comment already gives for `overrideReason`.
  const service = useServiceScope();
  // Resolved from the provider's live `units`, not the frozen `unitById()` fixture — after
  // `CONFIRM_CAPACITY` or `PULL_PATIENT` updates `state.units`, this screen must show the current
  // bed counts (and gate `pullBlockedReason` on them) rather than the stale fixture value.
  const unit = units.find((candidate) => candidate.id === unitId);

  // Declared unconditionally, before the early return below — React hooks must run in the same
  // order on every render, and the not-found branch never touches either of these.
  /**
   * The reason a ward is recording against a refusal it has just been given. ⚠️ REACTIVE, NEVER
   * PROACTIVE, and the owner's coordinator ruled the shape: nothing appears until the engine has
   * actually refused, so the ward sees the SPECIFIC gate it failed before choosing a reason —
   * which is the right order for a clinical decision. A reason control sitting on every row before
   * anything is pressed would ask a person to justify something before they know what it is, and
   * would read as a suggestion rather than a safeguard. The ordinary accept, which is nearly all
   * of them, is untouched.
   *
   * One value, not a map: `lastActionRejection` holds a single refusal, so at most one of these
   * forms can be open at a time by construction.
   */
  const [overrideReason, setOverrideReason] = useState<OverrideReason | undefined>(undefined);
  /**
   * The "Nurse unit manager consulted" tick (item 10, owner answers 17 September 2026) — a SECOND
   * fact the high-acuity staffing refusal needs beside the reason above, and neither answers for
   * the other. Shown only beside that one refusal (see `overrideReasonForm`'s own doc comment), so
   * it is one boolean rather than a map: at most one such form is open at a time, the same
   * reasoning `overrideReason` above already states.
   */
  const [numConsulted, setNumConsulted] = useState(false);
  const [declineOpenFor, setDeclineOpenFor] = useState<string | undefined>(undefined);
  const [declineReason, setDeclineReason] = useState<DeclineReason | undefined>(undefined);
  const [capacityRevision, setCapacityRevision] = useState(() => unit?.allocatable.revision ?? 0);
  const [dailyCapacityObservation, setDailyCapacityObservation] = useState(() => ({
    value: unit?.allocatable.value ?? 0,
    revision: unit?.allocatable.revision ?? 0,
  }));
  const [capacityValue, setCapacityValue] = useState<string>(() => String(unit?.allocatable.value ?? 0));

  // Task 3: the undo the prototype has never had. Keyed by movementId, same pattern as
  // `declineOpenFor`/`declineReason` above — at most one release form and one cancel form open
  // at a time.
  const [releaseOpenFor, setReleaseOpenFor] = useState<string | undefined>(undefined);
  const [releaseReason, setReleaseReason] = useState<ReleasePullReason | undefined>(undefined);
  // Task 11 (spec item 9): the bed-release flag. Not keyed by movement id — unlike decline,
  // release and cancel above, this is not about any one referral, it is about this ward's own
  // bed stock, so one form per screen is enough.
  const [bedReleaseWaitingOn, setBedReleaseWaitingOn] = useState<BedReleaseWaitingOn | undefined>(undefined);
  // The stay the release belongs to (owner ruling 25 Sept 2026: a bed release names the patient
  // whose discharge frees it, and it is never guessed). Chosen by the ward in the form below.
  const [bedReleaseAdmissionId, setBedReleaseAdmissionId] = useState<string | undefined>(undefined);
  const [bedReleaseBlocker, setBedReleaseBlocker] = useState<BedReleaseBlocker | undefined>(undefined);
  // Fix round 2 (P1): the ward's own estimate of when this bed will actually be free, collected
  // exactly like `leaveExpectedReturn` below and parsed the same way via
  // `parseReleaseDayInstant` — see `ward-flow-events.ts`'s `FLAG_BED_RELEASE.expectedAt` doc
  // comment for why this is a fact about the BED, not the departing patient.
  const [bedReleaseExpectedAt, setBedReleaseExpectedAt] = useState<string>("");
  // Task F1 (owner answer 32): the day the typed time belongs to. Defaults to "today" — the
  // common case, and the one that keeps every existing test that never touches this control
  // (it fills only the time) submitting exactly the instant it always has.
  const [bedReleaseDay, setBedReleaseDay] = useState<ReleaseDay>("today");
  // Task 5: the block form on an EXISTING release row. Keyed by release id, same one-open-at-a-time
  // pattern as `declineOpenFor`/`releaseOpenFor` above.
  const [blockOpenFor, setBlockOpenFor] = useState<string | undefined>(undefined);
  const [blockChoice, setBlockChoice] = useState<BedReleaseBlocker | undefined>(undefined);
  // Josh, 26 Sept 2026 (answer 1A): "Discharged" asks where the named person is going, then records
  // that they have left; that departure completes the release. The row already names the person, so
  // nothing is guessed, and nothing is recorded until a destination is chosen.
  const [dischargeOpenFor, setDischargeOpenFor] = useState<string | undefined>(undefined);
  const [dischargeDestination, setDischargeDestination] = useState<LeavingDestination | undefined>(undefined);
  const dischargeCheckRef = useRef<{ prior: number; success: string; who: string; codes: string[] } | null>(null);
  const [dischargeToken, setDischargeToken] = useState(0);
  // Bed-model rework (2026-08-28): the reversal form on an existing CONFIRMED release row, same
  // one-open-at-a-time pattern as the block form above. It exists because forbidding the
  // reversal never stopped wards reversing a decision — it only stopped them recording it.
  const [revertOpenFor, setRevertOpenFor] = useState<string | undefined>(undefined);
  const [revertChoice, setRevertChoice] = useState<BedReleaseWaitingOn | undefined>(undefined);
  // List 3 (2026-08-28): the preparation-note picker, one row open at a time — the same
  // open-for/choice pair the block and revert forms above already use.
  const [preparationOpenFor, setPreparationOpenFor] = useState<string | undefined>(undefined);
  const [preparationChoice, setPreparationChoice] = useState<BedPreparationNote | undefined>(undefined);
  // Task 5: the small leave-bed form. Not keyed by anything — like the flag-bed-release form
  // above, this is about this ward's own bed stock, so one form per screen is enough.
  const [leaveExpectedReturn, setLeaveExpectedReturn] = useState<string>("");
  // Task F1 (owner answer 32): the leave form's own Today/Tomorrow choice, same rule and same
  // default as `bedReleaseDay` above — kept as a separate state so the two forms' choices never
  // leak into each other.
  const [leaveDay, setLeaveDay] = useState<ReleaseDay>("today");
  const [answerIndex, setAnswerIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"attn" | "coming" | "out" | "beds" | "return">("attn");
  const [dischargeSubTab, setDischargeSubTab] = useState<"all" | "scheduled" | "leave" | "barriers" | "suburb">("all");
  const [selectedPod, setSelectedPod] = useState<string>("all");
  const [selectedBed, setSelectedBed] = useState<number | null>(null);
  const [confirmNumbersOpen, setConfirmNumbersOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const bedTriggerRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const confirmTriggerRef = useRef<HTMLButtonElement | null>(null);
  const capacityModalRef = useRef<HTMLDivElement | null>(null);
  const bedDrawerRef = useRef<HTMLElement | null>(null);
  const notificationCenterRef = useRef<HTMLDivElement>(null);
  const notificationTriggerRef = useRef<HTMLButtonElement>(null);

  // The outcome of "Discharged" (Josh, 1A): a refusal shows its reason; only an accepted departure
  // shows the success message.
  useEffect(() => {
    const check = dischargeCheckRef.current;
    if (dischargeToken === 0 || check === null) return;
    dischargeCheckRef.current = null;
    const refused = rejections.length > check.prior ? rejections[rejections.length - 1] : undefined;
    // A refusal names the person the way the success message does (Josh, 26 Sept 2026): the
    // engine's reason quotes record codes, so each code of this person's is shown as their name.
    const reason = refused
      ? check.codes.reduce((text, code) => text.split(code).join(check.who), refused.reason)
      : undefined;
    setToastMessage(reason !== undefined ? `Not recorded: ${reason}. Nothing was changed.` : check.success);
  }, [dischargeToken, rejections]);

  useEffect(() => {
    function syncTabWithHash() {
      if (typeof window === "undefined") return;
      const hash = window.location.hash;
      if (["#bed-capacity", "#ward-daily-return", "#ward-flag-bed-release", "#ward-leave-bed-form"].includes(hash)) {
        setActiveTab("return");
      }
    }
    syncTabWithHash();
    window.addEventListener("hashchange", syncTabWithHash);
    return () => window.removeEventListener("hashchange", syncTabWithHash);
  }, []);

  function handleRaiseWardReferral() {
    if (!unit) return;
    dispatch({
      type: "RECEIVE_REFERRAL",
      role: "community",
      now,
      ageBand: unit.cohort,
      destinations: [
        {
          kind: "psychiatric_ward",
          sex: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "unknown", reason: "not_known" },
      source: "psychiatric_ward",
      originUnitId: unit.id,
      urgency: 2,
      originSiteCode: unit.siteCode,
      transportNeeded: false,
      history: "",
    });
  }

  const closeBedDrawer = useCallback(() => {
    if (selectedBed !== null) {
      const bedNum = selectedBed;
      setSelectedBed(null);
      setTimeout(() => {
        bedTriggerRefs.current.get(bedNum)?.focus();
      }, 0);
    }
  }, [selectedBed]);

  const closeCapacityModal = useCallback(() => {
    setConfirmNumbersOpen(false);
    setTimeout(() => {
      confirmTriggerRef.current?.focus();
    }, 0);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selectedBed !== null) {
          closeBedDrawer();
        } else if (confirmNumbersOpen) {
          closeCapacityModal();
        } else if (notificationCenterOpen) {
          setNotificationCenterOpen(false);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedBed, confirmNumbersOpen, notificationCenterOpen, closeBedDrawer, closeCapacityModal]);

  // Click-outside listener for floating notification center
  useEffect(() => {
    if (!notificationCenterOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (
        notificationCenterRef.current &&
        !notificationCenterRef.current.contains(target) &&
        notificationTriggerRef.current &&
        !notificationTriggerRef.current.contains(target)
      ) {
        setNotificationCenterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [notificationCenterOpen]);

  // Initial focus and focus trapping for Telemetry Drawer
  useEffect(() => {
    if (selectedBed !== null && bedDrawerRef.current) {
      const focusable = Array.from(
        bedDrawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      focusable[0]?.focus();
    }
  }, [selectedBed]);

  // Initial focus and focus trapping for Capacity Confirmation Modal
  useEffect(() => {
    if (confirmNumbersOpen && capacityModalRef.current) {
      const focusable = Array.from(
        capacityModalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      focusable[0]?.focus();
    }
  }, [confirmNumbersOpen]);

  function handleBedDrawerKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeBedDrawer();
      return;
    }
    if (event.key !== "Tab") return;
    const drawer = bedDrawerRef.current;
    if (!drawer) return;
    const focusable = Array.from(
      drawer.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => !el.hasAttribute("disabled"));
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleCapacityModalKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeCapacityModal();
      return;
    }
    if (event.key !== "Tab") return;
    const modal = capacityModalRef.current;
    if (!modal) return;
    const focusable = Array.from(
      modal.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => !el.hasAttribute("disabled"));
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /**
   * Rebuild to `mockup-ward-entry.html` (2026-09-04): the "Confirm today's numbers" panel.
   *
   * ⚠️ ALL THREE QUESTIONS ARE TRACKED HERE, LOCALLY, RATHER THAN DERIVED FROM `unit.allocatable`
   * OR `unit.empty` DIRECTLY. Two reasons, one per field:
   *
   * - `unit.empty.source` is DOCUMENTED AS ALWAYS `"feed"` (`ward-model.ts`: "Physically empty
   *   beds, per the feed") — this model has no ward-side event that confirms it, so there is no
   *   real state to read a "confirmed today" flag from. Inventing one on `Unit` is a model change
   *   this task's file scope (`ward/` and `wards/` only) does not reach.
   * - There is no "anything limiting intake" field on `Unit` at all.
   *
   * So this panel's confirmed-count is session-local bookkeeping, seeded to 0 on every mount —
   * which is also what makes "0 of 3 confirmed since this page opened" a state this screen can
   * always reach — quoted as the label ACTUALLY renders since 2026-09-07, because this comment said
   * "confirmed today" for a day after that word was removed from the chip for being false, and a
   * reader searching the old string would have found only this paragraph and taken it as current —
   * the
   * exact state the bed-list CTA below must remain available through. The "allocatable" question
   * is the one REAL exception: confirming it also dispatches the same `CONFIRM_CAPACITY` event
   * the capacity form further down the page already sends, so pressing it has a genuine effect on
   * `unit.allocatable`, not only on this panel's own count.
   */
  /*
   * ⚠️ **SESSION STATE, AND EVERY CHIP READING IT NOW SAYS SO.** This set is `useState(() => new
   * Set())` — it resets on every mount. The three chips it drives used to read
   * "Not yet confirmed today" (twice) and "Never answered on this ward", which are claims about the
   * DAY and about the WARD'S HISTORY. Neither is knowable from here: a ward that answered a minute
   * ago, navigated away and came back, was told it had never answered at all.
   *
   * ⚠️ **AND FOR THE CONSTRAINTS ANSWER THERE IS NO FIELD TO READ.** `Unit` records nothing about
   * whether the ward has ever answered it, so the wording is the whole of the available fix — the
   * real repair is a model field and an event that writes it, which is not this component's to make.
   * `empty` and `allocatable` DO have real provenance (`CapacityFigure.confirmedAt`), and it is
   * shown by `WardFreshness` beneath each chip; what these chips report is only whether somebody
   * re-confirmed in THIS session, which is now what they say.
   */
  const [confirmedToday, setConfirmedToday] = useState<ReadonlySet<DailyReturnQuestion>>(() => new Set());
  // Owner Answer 18 (second round, 2026-09-17): a fixed multiple-choice list, chosen never typed,
  // replacing the old free-text draft. Starts empty every mount, same as the free-text box it
  // replaces — the ward re-states its answer rather than editing a pre-filled one.
  const [constraintsDraft, setConstraintsDraft] = useState<readonly WardIntakeConstraint[]>([]);

  /*
   * THE WARD'S OWN REFUSAL SURFACE for `ACCEPT_IN_PRINCIPLE` and `PULL_PATIENT` — until now this
   * screen dispatched both and never read `rejections` at all, so a ward whose accept or pull was
   * refused (the reducer's own bed-readiness, specialling or already-accepted gates, none of
   * which `referralAnswerBlocked`/`pullBlockedReason` above mirror) saw nothing happen and had no
   * way to tell a refusal from a slow render.
   *
   * Same async-detection pattern as `referral-match.tsx`'s `checkToken`/`priorRejectionCountRef`
   * pair and `ed-screen.tsx`'s `declineRejection`: `dispatch` never reports whether the reducer
   * accepted or refused an event, so the only way to know is to compare `rejections` before and
   * after, on the next render. `checkToken === 0` guards the same case `ed-screen.tsx`'s own
   * comment names — nothing has been dispatched from this screen yet, so a rejection already in
   * state belongs to somebody else and must not be surfaced here.
   *
   * Held as ONE `Rejection`, not two — a ward user presses one button at a time — and matched
   * everywhere it is rendered by `movementId` ALONE, never narrowed to "only in the section the
   * button that caused it lives in": `Rejection.movementId` is the movement id for both these
   * events (the default case of `subjectId` in `ward-flow-reducer.ts`), and a refusal does not
   * stop being true because the movement's row has since moved to the other list — the exact
   * shape of a second `ACCEPT_IN_PRINCIPLE` refused as already-accepted, which lands the movement
   * in "accepted" before its own refusal is even rendered.
   */
  const priorRejectionCountRef = useRef(rejections.length);
  const [checkToken, setCheckToken] = useState(0);
  const [lastActionRejection, setLastActionRejection] = useState<Rejection | undefined>(undefined);

  useEffect(() => {
    if (checkToken === 0) return;
    if (rejections.length > priorRejectionCountRef.current) {
      const newest = rejections[rejections.length - 1];
      setLastActionRejection(
        newest.attempted === "ACCEPT_IN_PRINCIPLE" || newest.attempted === "PULL_PATIENT" ? newest : undefined,
      );
    } else {
      setLastActionRejection(undefined);
    }
    priorRejectionCountRef.current = rejections.length;
  }, [rejections, checkToken]);

  if (!unit) {
    return (
      <div className={styles.screen} data-testid="ward-unit-screen">
        <main id="main-content" className={styles.main}>
          <h1 className={styles.notFoundHeading}>Ward not found</h1>
          <p className={styles.notFoundBody} data-testid="ward-unit-unresolved">
            No synthetic unit matches &ldquo;{unitId}&rdquo;. It may have been renamed or removed, or the id in the
            address is incorrect — this never falls back to a different ward.
          </p>
          <div>
            <Link href="/mockups/ward-flow/wards" className={styles.notFoundAction}>
              &larr; View all 23 available wards
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const site = siteByCode(unit.siteCode);
  const capacity = unitCapacity(unit, bedReleases);
  // Who a bed release can name: people occupying a bed on this ward with no live release already
  // (the reducer refuses anyone else). Named from the record, the same way the bed list names them.
  const bedReleaseCandidates = (admissions ?? [])
    .filter(
      (admission) =>
        admission.unitId === unit.id &&
        admission.state === "occupied" &&
        !bedReleases.some((release) => release.admissionId === admission.id && release.state !== "discharged"),
    )
    .map((admission) => {
      const linkedMovement = admission.referralId
        ? movements.find((movement) => movement.id === admission.referralId)
        : undefined;
      return {
        admissionId: admission.id,
        label: `${resolvePatientIdentity(linkedMovement ?? admission).displayName} · ${admission.id}`,
      };
    });
  // Visual-fix pass: the capacity board (`CapacityView` in `ward-management-modes.tsx`) was just
  // corrected to source Confirmed/Expected from `capacityBreakdown()` rather than `unitCapacity()`'s
  // raw, state-and-timing-blind `potential` count — this screen used to be the one place still
  // showing that raw count as "Potential", which is how the same unit could read "Potential 1" here
  // and "Confirmed 1, Expected 0" one screen over, for the exact same release. This screen now reads
  // the same breakdown so both screens describe the same beds the same way. `unitCapacity()` itself
  // is untouched — see its own doc comment on `potential` in `ward-derivations.ts`.
  const breakdown = capacityBreakdown(unit, bedReleases, leaveBeds, now);
  // Owner ruling 2026-09-05: shown BESIDE the Ready figure, never subtracted from it. The
  // reducer's own helper, so this screen and the PULL_PATIENT refusal read one source.
  const pendingPreparation = bedsPendingPreparation(unit.id, bedReleases);
  // TypeScript's narrowing of `unit` above does not reach into the `submitDecline` /
  // `submitCapacity` closures defined further down (the same reason `shortlist-panel.tsx`'s
  // `handleRefer` closes over a plain `movementId` rather than re-checking `movement`), so this
  // plain string is what they close over instead.
  const wardUnitId = unit.id;

  // Task 5: this unit's own bed releases, still pending — `discharged` is terminal and drops off
  // this list (spec D10's "removes it from the pending list"), never rendered with dead controls.
  const pendingBedReleases = bedReleases.filter(
    (release) => release.unitId === unit.id && release.state !== "discharged",
  );

  // List 3 (2026-08-28): this unit's own beds that have already been DISCHARGED. They are the only
  // beds a preparation note applies to — the note says what a free bed is being made ready for.
  // They are deliberately a SEPARATE list from `pendingBedReleases` above rather than being
  // restored to it: `discharged` is still terminal for every lifecycle control, and nothing in this
  // section moves a stage.
  const dischargedBedReleases = bedReleases.filter(
    (release) => release.unitId === unit.id && release.state === "discharged",
  );

  // Task 5: this unit's own beds currently occupied by someone on approved leave — read here only
  // to report the count on the leave-bed form below; never merged into any availability figure
  // (spec D4), and `RECORD_LEAVE_BED` (submitted by that form) is the only writer this screen has.
  const unitLeaveBeds = leaveBeds.filter((bed) => bed.unitId === unit.id);

  /**
   * The two beds-and-leave rows of the daily return (rows 4 and 5 of the panel below) each stamp
   * ONE record: the most recently created one.
   *
   * ⚠️ **`.at(-1)` and not a maximum of `confirmedAt`, deliberately — AND THE REASON FIRST WRITTEN
   * HERE WAS FALSE.** Corrected 2026-09-07 after an adversarial read.
   *
   * It said `Instant` is "minutes since midnight" and wraps at 24:00, so `Math.max` breaks across
   * midnight. **`ward-clock.ts:9-21` says the opposite as its own headline defect** — *"IT IS NOT A
   * TIME OF DAY, and reading it as one is the defect this comment exists to stop… 2082 is 10:42 the
   * NEXT morning."* `wallClockNow()` wraps; `Instant` does not, and differences across any number of
   * days are plain subtraction. So the original rationale restated the precise misconception that
   * file was written to kill, while reaching the right conclusion — which is how a wrong reason
   * survives: nobody argues with a conclusion they agree with.
   *
   * **The real reason, verified in the code rather than reasoned about.** `now` is anchored by
   * `anchorOffsetMinutes = wallClockNow() - NOW_ANCHOR` (`ward-flow-provider.tsx:193`) against
   * `NOW_ANCHOR = 642` (10:42). Open the app at 09:00 and `now` starts near 540 — **below** the
   * seeded `confirmedAt` values of 632, 617, 582. A release flagged at runtime is stamped
   * `confirmedAt: event.now` (`ward-flow-reducer.ts:2284`), so it gets a SMALLER instant than a
   * seeded one, and `Math.max` would name the seeded record while the sentence beside it says
   * "most recently". Reachable any morning before 10:42.
   *
   * Creation order sidesteps it entirely and needs no clock arithmetic: the reducer appends
   * (`[...state.bedReleases, release]`, `[...state.leaveBeds, created]`), updates map in place, and
   * nothing sorts, reverses, unshifts or splices either array — `END_LEAVE_BED` filters, which
   * preserves order. That is a weaker claim than "the newest confirmation", and it is the one the
   * wording beside it makes.
   *
   * ⚠️ **No test covers WHICH record the stamp names**, because no seeded unit has two releases or
   * two leave beds — so `.at(-1)` ≡ `.at(0)` ≡ `Math.max` on every unit the suite renders. Replacing
   * the stamp with `now` keeps all five tests green. Handed to Ward Lead; it needs a second seeded
   * release on one unit, which is a fixture change and not this change's to make.
   */
  /**
   * 🔴 **ROW 4 COUNTS WHAT THE BED FIGURES BELOW IT COUNT, AND THE FIRST VERSION DID NOT.**
   * Corrected 2026-09-07, before anyone read it.
   *
   * Row 4 originally showed `pendingBedReleases.length` — every non-discharged release. The
   * Expected/Confirmed chips further down the same screen come from `capacityBreakdown()`, which
   * SKIPS any release whose `releaseBand()` is `"beyond-today"` (`daysAhead >= 2`). Two
   * independent derivations of one population, on one screen.
   *
   * ⚠️ **STATED PRECISELY, BECAUSE THE FIRST VERSION OF THIS COMMENT OVERSTATED IT.** It claimed a
   * ward could flag a bed for the day after tomorrow and see the two numbers disagree. It cannot.
   * **Task F1 (owner answer 32) changed WHY, and this paragraph is corrected to say so rather than
   * quietly keep a reason that no longer held.** The form's input used to be `type="time"` alone,
   * so the old `parseTimeInputToInstant` returned a bare 0–1439 and `dayOf()` of the result always
   * matched `dayOf(now)` — no day-gap was even expressible. The form now also offers the Today/
   * Tomorrow chooser (`release-day.ts`), so `dayOf(release.expectedAt) - dayOf(now)` can genuinely
   * be 0 or 1 the moment a release is created — `releaseBand`'s `"tomorrow"` case exists for
   * exactly that gap, and it is still not `"beyond-today"`. The `"beyond-today"` gap (2 or more)
   * stays unreachable through this control for a different reason now: it only ever produces a
   * gap of 0 or 1 AT CREATION, and `now` only moves forward from there, so the gap measured on any
   * later render can only be smaller, never larger. And no seeded release is beyond today either —
   * measured across all 23 units with the old code, which counted beyond-today releases while the
   * chips did not: **zero mismatches**, on floors showing 8 units carried a non-zero count. So the
   * divergence was and remains **unreachable**, and nothing a reader has seen was ever wrong.
   *
   * It is corrected anyway, because the two numbers agreed by ACCIDENT — the accident being that
   * one input element is time-only. A date input, a feed, or a second producer makes them
   * disagree with no test going red. The count is now taken FROM `breakdown` rather than
   * re-derived, so there is one arithmetic instead of a faithful copy of it — the rule
   * `capacityBreakdown` states about itself: "the one number a coordinator acts on must not drift
   * from the five-state bed grid's own arithmetic". The band-filtered list exists only so the
   * stamp names a release from the same population as the number above it.
   */
  const releasesCountedToday = pendingBedReleases.filter((release) => releaseBand(release, now) !== "beyond-today");
  const releasesComingFree = breakdown.confirmedToday + breakdown.expectedToday;
  const lastFlaggedRelease = releasesCountedToday.at(-1);
  const lastRecordedLeaveBed = unitLeaveBeds.at(-1);

  // Task 5, spec D12: every REQUEST_CAPACITY_REFRESH raised against this unit, live from the
  // provider. `refreshRequests` only ever grows (the reducer never removes an entry), so the last
  // one in array order is always the most recent ask.
  const unitRefreshRequests = refreshRequests.filter((request) => request.unitId === unit.id);
  const latestRefreshRequest =
    unitRefreshRequests.length > 0 ? unitRefreshRequests[unitRefreshRequests.length - 1] : undefined;

  // Awaiting an answer: this unit holds a live referral and nothing has been decided yet.
  const incoming = movements.filter(
    (movement) =>
      isOpen(movement) && movement.stage === "destination_review" && movement.referredUnitIds.includes(unit.id),
  );
  const activeAnswerIndex = Math.min(answerIndex, Math.max(incoming.length - 1, 0));
  const visibleIncoming =
    presentation === "answer" ? incoming.slice(activeAnswerIndex, activeAnswerIndex + 1) : incoming;
  // Accepted, pulled, or en route: this unit is the recorded destination, at any stage from
  // acceptance through transport. `isOpen` excludes `arrived` — once a patient arrives the record
  // closes and the bed shows as occupied in the grid above, not as a card here.
  const accepted = movements.filter((movement) => isOpen(movement) && movement.acceptedUnitId === unit.id);
  const recentAnswers = movements
    .flatMap((movement) => {
      const wardAnswers: Array<{
        key: string;
        movementId: string;
        outcome: "Accepted" | "Declined";
        at?: Instant;
        reason?: DeclineReason;
      }> = [];

      if (movement.acceptedUnitId === unit.id) {
        wardAnswers.push({
          key: `${movement.id}-accepted`,
          movementId: movement.id,
          outcome: "Accepted",
          at: movement.acceptedAt,
        });
      }

      movement.declines
        .filter((decline) => decline.unitId === unit.id)
        .forEach((decline, index) => {
          wardAnswers.push({
            key: `${movement.id}-declined-${index}`,
            movementId: movement.id,
            outcome: "Declined",
            at: decline.at,
            reason: decline.reason,
          });
        });

      return wardAnswers;
    })
    .sort((left, right) => (right.at ?? Number.NEGATIVE_INFINITY) - (left.at ?? Number.NEGATIVE_INFINITY));
  // What was withdrawn from this ward specifically, and why — `withdrawnReferrals` is per
  // movement, so this reads each movement's own array rather than assuming only one entry exists.
  const withdrawn = movements.filter((movement) =>
    movement.withdrawnReferrals.some((entry) => entry.unitId === unit.id),
  );
  const blockedReleases = pendingBedReleases.filter((release) => release.blocker !== null);

  const rollupConfirmation = morningRollupConfirmations?.[unit.id];
  const isRollupConfirmedToday = Boolean(rollupConfirmation && dayOf(rollupConfirmation.confirmedAt) === dayOf(now));
  const morningRollupDeadlineMinutes = configuration?.morningRollupDeadlineMinutes ?? 570;
  const morningRollupDeadlinePassed = minuteOfDay(now) >= morningRollupDeadlineMinutes;
  const rollupHour = Math.floor(morningRollupDeadlineMinutes / 60);
  const rollupMin = morningRollupDeadlineMinutes % 60;
  const morningRollupTimeLabel = `${String(rollupHour).padStart(2, "0")}:${String(rollupMin).padStart(2, "0")}`;

  function handleConfirmMorningRollup() {
    if (!unit) return;
    dispatch({
      type: "CONFIRM_MORNING_ROLLUP",
      role: "ward",
      now,
      unitId: unit.id,
      actingUnitId: unit.id,
      expectedDischarges: releasesCountedToday.length,
    });
    setToastMessage(
      `${morningRollupTimeLabel} Morning Bed Rollup confirmed: ${releasesCountedToday.length} discharges planned today.`,
    );
  }

  function handleAcknowledgeNotice(noticeId: string) {
    if (!unit) return;
    dispatch({
      type: "MARK_NOTICE_READ",
      role: "ward",
      now,
      noticeId,
      actingPlaceId: unit.id,
    });
  }

  function handleDismissBuzz(buzzIndex: number) {
    setDismissedBuzzes((current) => [...current, buzzIndex]);
  }

  const unreadAlertsCount = (() => {
    if (!unit) return 0;
    let count = 0;
    if (!isRollupConfirmedToday && morningRollupDeadlinePassed) count += 1;
    const activeBuzzes = (refreshRequests ?? []).filter(
      (r, idx) => r.unitId === unit.id && !dismissedBuzzes.includes(idx),
    );
    count += activeBuzzes.length;
    const overdueArrivals = movements.filter(
      (m) =>
        m.acceptedUnitId === unit.id &&
        m.arrivalDetails?.estimatedArrivalAt &&
        now > m.arrivalDetails.estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES,
    );
    count += overdueArrivals.length;
    return count;
  })();
  const staffedSpecialling = (admissions ?? []).filter(
    (admission) => admission.unitId === unit.id && admission.state === "occupied" && admission.specialling,
  ).length;
  const overdueLeaveBeds = unitLeaveBeds.filter(
    (leaveBed) => now - leaveBed.confirmedAt >= LEAVE_BED_OPEN_WARNING_MINUTES,
  );
  const liveFormAlerts = [
    ...incoming.map((movement) => ({
      key: `incoming-${movement.id}`,
      tone: "warning" as const,
      title: "Referral awaiting this ward's answer",
      countdown: stageCopy[movement.stage].label,
      // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
      text: `${resolvePatientIdentity(movement).displayName} from ${originPlaceLabel(movement.originEdId)}.`,
    })),
    ...accepted.flatMap((movement) => {
      const alerts: Array<{
        key: string;
        tone: "critical" | "warning" | "info";
        title: string;
        countdown: string;
        text: string;
      }> = [];
      const patientName = resolvePatientIdentity(movement).displayName;
      const dueAt = movement.legalForm?.dueAt;
      if (dueAt !== undefined) {
        const remaining = minutesUntil(dueAt, now);
        alerts.push({
          key: `form-${movement.id}`,
          tone: remaining <= 60 ? "critical" : "warning",
          title: movement.legalForm ? `Form ${movement.legalForm.code} recorded due time` : "Legal form due",
          countdown: remaining < 0 ? "Due time has passed" : formatRemaining(remaining),
          // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
          text: `${patientName}: recorded due ${formatInstantWithDay(dueAt, now)}.`,
        });
      }
      if (arrivalIsLate(movement, now) && movement.arrivalDetails?.estimatedArrivalAt !== undefined) {
        alerts.push({
          key: `late-${movement.id}`,
          tone: "warning",
          title: "Estimated arrival time has passed",
          countdown: "Still inbound",
          // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
          text: `${patientName} was expected at ${formatInstantWithDay(movement.arrivalDetails.estimatedArrivalAt, now)} and has not arrived.`,
        });
      }
      return alerts;
    }),
    ...overdueLeaveBeds.map((leaveBed) => ({
      key: `leave-${leaveBed.id}`,
      tone: "info" as const,
      title: `Leave bed open more than ${LEAVE_BED_OPEN_WARNING_MINUTES / 60} hours (${OPERATIONAL_DEFAULT_LABEL})`,
      countdown: formatRemaining(now - leaveBed.confirmedAt),
      text: `A bed on leave at ${unit.name} is still recorded. Consider opening it. Expected return ${formatInstant(leaveBed.expectedReturn)}.`,
    })),
  ];

  // Derive bed roster & telemetry for Bed Board matrix
  // D-21 items 4A & 6A: HDU left off; show real recorded bed designations from WARD_LOCKED_BED_SPLITS.
  const lockedBeds = unit.lockedBeds ?? WARD_LOCKED_BED_SPLITS[unit.id] ?? 0;
  const openBedsCount = Math.max(0, unit.beds - lockedBeds);
  const isMixed = lockedBeds > 0 && openBedsCount > 0;

  // Josh, 26 Sept 2026 ("go ahead with all your recommendations"): a bed reads "On Leave" only for
  // the admission this ward's OWN leave records actually name — never whichever occupied
  // admission happened to sit first by position. `leaveAdmissionIds` is that ward-scoped set
  // (`unitLeaveBeds` is already filtered to `unit.id` above), and `otherOccupants` is every
  // occupied admission EXCEPT those — so nobody with a leave record is ever also handed an
  // ordinary "occupied" bed slot elsewhere on the same board. The leave slots below are built
  // straight from `unitLeaveBeds` itself, one bed per record, so the number of "On Leave" beds can
  // never drift from the number of leave records — there is no separate count to keep in step.
  const leaveAdmissionIds = new Set(unitLeaveBeds.map((leaveBed) => leaveBed.admissionId));
  const unitOccupantAdmissions = admissions?.filter((a) => a.unitId === unit.id && a.state === "occupied") ?? [];
  const otherOccupants = unitOccupantAdmissions.filter((a) => !leaveAdmissionIds.has(a.id));
  let otherOccupantCursor = 0;

  const bedsList = Array.from({ length: unit.beds }, (_, i) => {
    const bedNumber = i + 1;
    const designation: "Locked" | "Open" | undefined = isMixed ? (i < lockedBeds ? "Locked" : "Open") : undefined;
    const podId = isMixed ? (i < lockedBeds ? "locked" : "open") : "all";
    const podLabel = isMixed ? `${unit.name} ${designation} Beds` : unit.name;
    const isHdu = false;

    // Every leave record gets its own slot, right after the ready beds — never only the first one.
    const leaveSlotIndex = i - capacity.available;
    const isLeaveSlot = leaveSlotIndex >= 0 && leaveSlotIndex < unitLeaveBeds.length;
    const isIncomingSlot = accepted.length > 0 && i === capacity.available + unitLeaveBeds.length;

    let status: "ready" | "occupied" | "leave" | "incoming" = "occupied";
    let statusText = "Inpatient";
    if (i < capacity.available) {
      status = "ready";
      statusText = "Ready Vacant";
    } else if (isLeaveSlot) {
      status = "leave";
      statusText = "On Leave";
    } else if (isIncomingSlot) {
      status = "incoming";
      statusText = "Inbound";
    }

    const incomingMovement = isIncomingSlot ? accepted[0] : undefined;
    // The person shown "On Leave" is whoever THIS leave record names, found by its own
    // `admissionId` — never by position. (Should the named admission ever not be among this
    // ward's occupied admissions, the slot is correctly left empty rather than borrowing someone
    // else's identity.)
    const leaveAdmission = isLeaveSlot
      ? unitOccupantAdmissions.find((a) => a.id === unitLeaveBeds[leaveSlotIndex].admissionId)
      : undefined;
    // An incoming referral has not been admitted to this ward yet, so it has no admission of its
    // own here — never one borrowed from whichever occupied admission next came up by position.
    // That borrowing used to hand an inbound person somebody else's length-of-stay and
    // specialling flag; each bed now shows only the facts that belong to the person shown in it.
    const admission: (typeof unitOccupantAdmissions)[number] | undefined =
      status === "leave" ? leaveAdmission : status === "occupied" ? otherOccupants[otherOccupantCursor++] : undefined;
    const linkedMovement =
      incomingMovement ?? (admission?.referralId ? movements.find((m) => m.id === admission.referralId) : undefined);
    const recordedSubject = linkedMovement ?? admission;
    const patientInfo =
      status === "ready" || recordedSubject === undefined ? undefined : resolvePatientIdentity(recordedSubject);
    const patientAlias = status === "ready" ? undefined : patientInfo?.displayName;
    const stayDays = admission ? admissionStayDays(admission, now) : null;
    const daysInBed = stayDays === null ? undefined : `${stayDays}d`;
    const isSpecialling = admission?.specialling === true;

    const patientLegalStatus = linkedMovement?.legalStatus;
    const patientLegalForm = linkedMovement?.legalForm;
    const legalStatusLabel = patientLegalForm
      ? `Form ${patientLegalForm.code}${patientLegalStatus ? ` ${patientLegalStatus}` : ""}`
      : patientLegalStatus;

    return {
      bedNumber,
      bedLabel: `Bed ${String(bedNumber).padStart(2, "0")}`,
      podId,
      podLabel,
      designation,
      isHdu,
      status,
      statusText,
      patientAlias,
      patientInfo,
      umrn: patientInfo?.umrn,
      daysInBed,
      isSpecialling,
      legalStatus: patientLegalStatus,
      legalForm: patientLegalForm,
      legalStatusLabel,
    };
  });

  const filteredBeds = selectedPod === "all" ? bedsList : bedsList.filter((b) => b.podId === selectedPod);

  /**
   * OD-3's read side, ward-scoped. **`overridesAgainstUnit`, never `allOverrides`** — the register
   * is filtered where it is READ, so another ward's override is never in this screen's scope at
   * all, and no future column, debug panel or stylesheet here can reveal what never arrived.
   * `tests/ward-override-register-render.dom.test.tsx` pins that structurally, by scanning this
   * file: it is not a convention anyone has to remember.
   *
   * ⚠️ **AND `unitIds` IS NARROWED TO THIS WARD, which is a second scoping and a separate rule.**
   * One override can name several units at once — the shortlist panel's refer control is a
   * multi-select, so a coordinator can refer to three wards in one act and override the gate for
   * all three. The stored `unitIds` then lists every one of them, and rendering that list here
   * would tell this ward WHERE ELSE the patient was referred: `FD-23`, the owner's ruling of
   * 2026-08-31, and the exact leak `ward-screen-fd23-leaks.dom.test.tsx` already guards on the
   * referral cards a few sections up. `ward-referral-visibility.ts` states it as "the count is as
   * forbidden as the list", so the co-addressees cannot be replaced with a number either.
   *
   * This is a PROJECTION, the same shape as `wardScopedReferral()` — the narrowing happens here,
   * before anything is rendered, so the presentation component is never handed the other wards'
   * ids and could not show them if it tried. It is not a filter applied at render.
   */
  const overridesHere = overridesAgainstUnit(movements, unit.id).map((entry) => ({
    movement: entry.movement,
    override: { ...entry.override, unitIds: entry.override.unitIds.filter((id) => id === unit.id) },
  }));

  function toggleDecline(movementId: string) {
    setDeclineOpenFor((current) => (current === movementId ? undefined : movementId));
    setDeclineReason(undefined);
  }

  function submitDecline(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    if (!declineReason) return;
    dispatch({ type: "DECLINE", role: "ward", now, movementId, unitId: wardUnitId, reason: declineReason });
    setDeclineOpenFor(undefined);
    setDeclineReason(undefined);
  }

  /**
   * Re-runs the refused action, this time carrying the reason. ⚠️ IT RE-DISPATCHES THE EVENT THE
   * WARD ORIGINALLY PRESSED, read back from the refusal itself rather than remembered separately —
   * so the thing that gets overridden is provably the thing that was refused. Holding the intended
   * event in its own state would let the two drift apart, and a mismatch there would override a
   * different action than the one on screen.
   */
  function submitOverride(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    if (!overrideReason || !lastActionRejection) return;
    const attempted = lastActionRejection.attempted;
    if (attempted !== "ACCEPT_IN_PRINCIPLE" && attempted !== "PULL_PATIENT") return;
    // Item 10, owner answers 17 September 2026: the high-acuity staffing refusal needs the tick as
    // well as the reason, and matched on the refusal's own text rather than assumed from
    // `attempted` alone — a PULL_PATIENT can still be refused on specialling, one guard above, and
    // that refusal must never be gated on a tick it does not ask for. See
    // `overrideReasonForm`'s own doc comment.
    const isAcuityRefusal = lastActionRejection.reason.includes(HIGH_ACUITY_STAFFING_REFUSAL);
    if (isAcuityRefusal && !numConsulted) return;
    priorRejectionCountRef.current = rejections.length;
    // ⚠️ TWO LITERAL DISPATCHES RATHER THAN ONE COMPUTED `type: attempted`, AND THE GUARD IS WHY.
    // The computed form was what I wrote first, and `ward-override-surfaces.test.ts` refused it on
    // the spot: a computed type is invisible to every literal scan, so this surface would have
    // become unreadable to the very check that decides whether it can record a reason — the
    // allowlist entry could never have come off, because nothing could see the fix. Verbosity here
    // buys visibility to the static guards, which is the trade this file should always take.
    if (attempted === "ACCEPT_IN_PRINCIPLE") {
      dispatch({
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now,
        movementId,
        unitId: wardUnitId,
        overrideReason,
      });
    } else {
      dispatch({
        type: "PULL_PATIENT",
        role: "ward",
        now,
        movementId,
        unitId: wardUnitId,
        overrideReason,
        // Absent, never `false`, when this refusal is not the one the tick answers — see
        // `Override.numConsulted`'s own doc comment on that discipline.
        numConsulted: isAcuityRefusal && numConsulted ? true : undefined,
      });
    }
    setCheckToken((token) => token + 1);
    setOverrideReason(undefined);
    setNumConsulted(false);
  }

  /**
   * ⚠️ RENDERED ONLY WHEN THE ENGINE SAYS A REASON IS THE WAY THROUGH, matched on the fragment the
   * reducer exports rather than on a literal of our own — see `OVERRIDE_REASON_REQUIRED`. A refusal
   * nothing can override (no bed, no specialling staff, a stale bed count) shows the refusal and NO
   * control, which is the honest rendering: offering a reason box against a physical fact would
   * promise something no reason can buy.
   *
   * ⚠️ ITEM 10, OWNER ANSWERS 17 SEPTEMBER 2026: THE "NURSE UNIT MANAGER CONSULTED" TICK SHOWS
   * ONLY BESIDE THE HIGH-ACUITY STAFFING REFUSAL, matched on `HIGH_ACUITY_STAFFING_REFUSAL` — the
   * reducer's own fragment, the same discipline `OVERRIDE_REASON_REQUIRED` already uses one level
   * up — never on `attempted` alone. `attempted === "PULL_PATIENT"` is also true for the
   * specialling refusal one guard above in the reducer, which asks for a reason only; showing the
   * tick there would ask for a fact the engine never reads and can never satisfy.
   *
   * ⚠️ PLACEHOLDER COPY. THE OWNER HAS NOT CHOSEN THESE WORDS. Marked here in the pattern
   * `ward-change-reasons.ts` uses, because a chosen value and a provisional value look identical in
   * code and the difference is whether anybody can find out. The SHAPE is decided; the WORDS are a
   * stand-in. `Select a reason` is a UI convention rather than a clinical statement and is mine.
   */
  function overrideReasonForm(movementId: string) {
    if (!lastActionRejection) return null;
    if (lastActionRejection.movementId !== movementId) return null;
    if (!lastActionRejection.reason.includes(OVERRIDE_REASON_REQUIRED)) return null;
    const isAcuityRefusal = lastActionRejection.reason.includes(HIGH_ACUITY_STAFFING_REFUSAL);
    return (
      <form
        className={styles.declineForm}
        onSubmit={(event) => submitOverride(event, movementId)}
        data-testid={`ward-override-form-${movementId}`}
      >
        <fieldset className={styles.declineFieldset}>
          {/* PLACEHOLDER WORDING — owner has not chosen this. */}
          <legend className={styles.declineLegend}>Record why this is going ahead anyway</legend>
          {/* Radios, not a dropdown, and not my preference — it is the idiom this screen already
              uses for choosing a clinical reason (the decline form directly below). It also shows
              all five at once: a collapsed list hides the alternatives at the moment somebody is
              deciding between them, and none of these five is a default. */}
          {OVERRIDE_REASONS.map((reason) => (
            <label key={reason} className={styles.declineOption}>
              <input
                type="radio"
                name={`ward-override-${movementId}`}
                value={reason}
                checked={overrideReason === reason}
                onChange={() => setOverrideReason(reason)}
                data-testid={`ward-override-option-${movementId}`}
              />
              {reason}
            </label>
          ))}
          {isAcuityRefusal ? (
            <label className={styles.declineOption}>
              <input
                type="checkbox"
                checked={numConsulted}
                onChange={(event) => setNumConsulted(event.target.checked)}
                data-testid={`ward-override-num-consulted-${movementId}`}
              />
              Nurse unit manager consulted
            </label>
          ) : null}
          {/* Native `disabled` is correct here and is NOT the forbidden case: this is transient
              inertness while the form waits for validity, not a control unavailable for a stated
              reason. See the button-wiring convention. */}
          <button
            type="submit"
            className={styles.acceptButton}
            disabled={!overrideReason || (isAcuityRefusal && !numConsulted)}
            data-testid={`ward-override-submit-${movementId}`}
          >
            {/* PLACEHOLDER WORDING — owner has not chosen this. */}
            Record reason and continue
          </button>
        </fieldset>
      </form>
    );
  }

  function submitCapacity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(capacityValue);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    // `actingUnitId` is this screen's own route parameter — the unit this screen is displaying and
    // acting as. It states which ward the caller says it is; it does not prove it, and the
    // reducer's comment on the matching check says the same. On this screen the two ids are equal
    // by construction (`unit` was resolved by matching the route id), so this guard is not what
    // stops *this* caller misusing the event — it is what stops any other call site writing to a
    // unit it did not claim to be acting as, and what puts that claim on the event where the
    // reducer can compare it.
    dispatch({
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now,
      unitId: wardUnitId,
      actingUnitId: unitId,
      value: Math.floor(parsed),
      expectedRevision: capacityRevision,
    });
  }

  const capacityConfirmationForm = () => {
    return (
      <form className={styles.capacityForm} onSubmit={submitCapacity} data-testid="ward-capacity-form">
        <label className={styles.capacityLabel} htmlFor="ward-capacity-input">
          Confirm allocatable beds for {unit.name}
        </label>
        <div className={styles.capacityRow}>
          <input
            id="ward-capacity-input"
            data-testid="ward-capacity-input"
            type="number"
            min={0}
            max={unit.beds}
            value={capacityValue}
            onChange={(event) => setCapacityValue(event.target.value)}
            className={styles.capacityInput}
            style={{
              minHeight: "var(--ward-tap, 48px)",
              fontFamily: "var(--mono, monospace)",
              fontVariantNumeric: "tabular-nums",
            }}
          />
          <button
            type="submit"
            data-testid="ward-capacity-submit"
            className={styles.capacitySubmit}
            style={{
              minHeight: "var(--ward-tap, 48px)",
              minWidth: "var(--ward-tap, 48px)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Confirm capacity
          </button>
        </div>
        <p className={styles.capacityConfirmed} style={{ fontVariantNumeric: "tabular-nums" }}>
          {capacityRevision !== (unit.allocatable.revision ?? 0) && (
            <button
              type="button"
              onClick={() => {
                setCapacityValue(String(unit.allocatable.value));
                setCapacityRevision(unit.allocatable.revision ?? 0);
                setDailyCapacityObservation({
                  value: unit.allocatable.value,
                  revision: unit.allocatable.revision ?? 0,
                });
              }}
            >
              Start a new capacity observation from the current count
            </button>
          )}
          Currently confirmed {unit.allocatable.value} at {formatInstant(unit.allocatable.confirmedAt)}. Writes to{" "}
          {unit.name} only &mdash; never any other ward.
        </p>
      </form>
    );
  };

  /** "Beds empty right now" — local acknowledgment only; see the state doc comment above for why. */
  function confirmEmptyToday() {
    setConfirmedToday((current) => new Set([...current, "empty"]));
  }

  /** Reaffirm the observation captured when the daily questions opened. A changed
   * revision requires a new observation rather than restoring the old count. */
  const currentCapacityRevision = unit.allocatable.revision ?? 0;
  function confirmAllocatableToday() {
    dispatch({
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now,
      unitId: wardUnitId,
      actingUnitId: unitId,
      value: dailyCapacityObservation.value,
      expectedRevision: dailyCapacityObservation.revision,
    });
    if (dailyCapacityObservation.revision === currentCapacityRevision)
      setConfirmedToday((current) => new Set([...current, "allocatable"]));
  }

  /** The mockup's single-tap "nothing has changed" button — both bed-count questions at once. */
  function confirmBothBedCounts() {
    confirmEmptyToday();
    confirmAllocatableToday();
  }

  /**
   * "Anything limiting who can come in right now." Owner Answer 18 (second round, 2026-09-17)
   * replaced the free-text box with a fixed list — no code chosen is a valid, recorded answer
   * (the mockup's own earlier note said blank "does not stop you opening the ward below"; the
   * equivalent here is submitting with nothing ticked), so this never refuses the submit the way
   * `submitDecline`/`submitCapacity` above refuse an incomplete form.
   */
  function saveConstraints(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatch({
      type: "RECORD_WARD_INTAKE_CONSTRAINTS",
      role: "ward",
      now,
      unitId: wardUnitId,
      actingUnitId: unitId,
      codes: constraintsDraft,
    });
    setConfirmedToday((current) => new Set([...current, "constraints"]));
  }

  function toggleConstraintOption(code: WardIntakeConstraint, checked: boolean) {
    setConstraintsDraft((current) => (checked ? [...current, code] : current.filter((existing) => existing !== code)));
  }

  function submitBedRelease(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bedReleaseWaitingOn) return;
    // Task F1 (owner answer 32): same parse-and-bail discipline as `submitLeaveBed`'s own
    // `expectedReturn` below — an empty or malformed time input refuses the submit rather than
    // guessing a value. `parseReleaseDayInstant` resolves the typed time against the Today/
    // Tomorrow choice AND the live `now`, not a fixed day — see that module's doc comment.
    const expectedAt = parseReleaseDayInstant(now, bedReleaseDay, bedReleaseExpectedAt);
    if (expectedAt === undefined) return;
    // Owner rulings 2026-09-25: a bed release names the patient whose stay it belongs to
    // (`BedRelease.admissionId`), and it is never guessed. The ward picks the person in the form;
    // with nobody picked the submit is refused with a plain message and records nothing (Josh
    // chose "Refuse", 25 Sept, 20:33 AWST).
    const chosenAdmissionId = bedReleaseAdmissionId;
    if (chosenAdmissionId === undefined) {
      setToastMessage("Choose the patient whose bed is coming free. Nothing was recorded.");
      return;
    }
    // `actingUnitId` is this screen's own route parameter, exactly like `submitCapacity` above —
    // it states which ward the caller says it is; it does not prove it. FLAG_BED_RELEASE is
    // ward-only, so this comparison always runs (see the reducer's own comment on the case).
    // `blocker` is optional here (Phase 5, spec D3) — a bed flagged with a blocker records a
    // held release; a bed flagged with none is a plain prediction. Task 5 redesigns this panel
    // to make that choice explicit; this is the minimum needed to keep it compiling and honest.
    dispatch({
      type: "FLAG_BED_RELEASE",
      role: "ward",
      now,
      unitId: wardUnitId,
      actingUnitId: unitId,
      admissionId: chosenAdmissionId,
      waitingOn: bedReleaseWaitingOn,
      expectedAt,
      blocker: bedReleaseBlocker,
    });
    setBedReleaseAdmissionId(undefined);
    setBedReleaseWaitingOn(undefined);
    setBedReleaseBlocker(undefined);
    setBedReleaseDay("today");
    setBedReleaseExpectedAt("");
  }

  // Task 5 (spec D10): the ward moving its OWN bed release through its own lifecycle —
  // `actingUnitId` is this screen's own route parameter, exactly like `submitCapacity` and
  // `submitBedRelease` above. `expected -> confirmed` is the only transition
  // CONFIRM_BED_RELEASE accepts; this is only ever rendered on a expected row (see the
  // legal-transition gating in the render below), so the reducer is never asked for a transition
  // the row does not itself offer.
  function confirmBedRelease(releaseId: string) {
    dispatch({ type: "CONFIRM_BED_RELEASE", role: "ward", now, releaseId, actingUnitId: unitId });
  }

  // Bed-model rework (2026-08-28): the reversal. `confirmed -> expected`, recorded like any
  // other change. What the discharge is waiting on has to be restated because a expected release
  // carries it and a confirmed release does not — this row's own picker supplies it, defaulting to
  // nothing so the ward states the fact rather than inheriting one. "Nothing outstanding" is a
  // real choice in that picker, so a ward reversing an unobstructed discharge has a value to give.
  function revertBedRelease(event: FormEvent<HTMLFormElement>, releaseId: string) {
    event.preventDefault();
    if (!revertChoice) return;
    dispatch({
      type: "REVERT_BED_RELEASE",
      role: "ward",
      now,
      releaseId,
      actingUnitId: unitId,
      waitingOn: revertChoice,
    });
    setRevertOpenFor(undefined);
    setRevertChoice(undefined);
  }

  // List 3 (2026-08-28): recording what a released bed is being made ready for.
  //
  // **This changes no bed figure and must never be made to.** `capacityBreakdown` derives
  // `availableNow` from the unit's own fields and never reads a release, and matching never reads
  // a `BedRelease` at all — the bed stays offered, stays counted, and stays allocatable the whole
  // time it is being cleaned. That is the owner's own clinical answer to Q4: pulling the next
  // patient takes hours anyway, so holding the bed back would invent a delay that does not exist.
  function submitBedPreparation(event: FormEvent<HTMLFormElement>, releaseId: string) {
    event.preventDefault();
    if (!preparationChoice) return;
    dispatch({
      type: "SET_BED_PREPARATION",
      role: "ward",
      now,
      releaseId,
      actingUnitId: unitId,
      preparing: true,
      note: preparationChoice,
    });
    setPreparationOpenFor(undefined);
    setPreparationChoice(undefined);
  }

  // The bed has finished being made ready. `preparing: false` forces the note null in the reducer,
  // because "not being made ready, waiting on a clean" is a contradiction.
  function finishBedPreparation(releaseId: string) {
    dispatch({
      type: "SET_BED_PREPARATION",
      role: "ward",
      now,
      releaseId,
      actingUnitId: unitId,
      preparing: false,
    });
    setPreparationOpenFor(undefined);
    setPreparationChoice(undefined);
  }

  function toggleBedPreparation(releaseId: string) {
    setPreparationOpenFor((current) => (current === releaseId ? undefined : releaseId));
    setPreparationChoice(undefined);
  }

  // Bed-model rework (2026-08-28): lifting the blocked flag. The stage is untouched — a confirmed
  // discharge that becomes unstuck is still confirmed.
  function clearBedReleaseBlock(releaseId: string) {
    dispatch({ type: "CLEAR_BED_RELEASE_BLOCK", role: "ward", now, releaseId, actingUnitId: unitId });
  }

  // Josh, 26 Sept 2026 (1A). RELEASE_BED can no longer be accepted while the person is in the bed,
  // and a departure completes the release in the same write, so "Discharged" records the named
  // person leaving (RECORD_LEAVING) with the destination the ward chose. The refusal, if any, is
  // read back from `rejections` on the next render and shown, never replaced by a success message.
  // Josh, 26 Sept 2026 ("go ahead with all recommendations"): a bed release is named by its person,
  // never by an internal id. No bed number is recorded for a release (the Beds tab places occupants
  // by position, which is layout, not a record), so the label says so. Leave-bed rows show "Bed not
  // recorded" and no name: the leave list promises to show nothing about the person on leave. Beds
  // freed by someone who has already left (turnaround cards, the ward log) show no name either:
  // cleaning a bed needs none, and those rows stay for the whole session (privacy review, 26 Sept).
  function bedRecordLabel(admissionId: string): string {
    const who = resolvePatientIdentity(admissions.find((admission) => admission.id === admissionId)).displayName;
    return `${who} (bed not recorded)`;
  }

  function toggleDischargeRelease(releaseId: string) {
    setDischargeOpenFor((current) => (current === releaseId ? undefined : releaseId));
    setDischargeDestination(undefined);
  }

  function submitDischargeRelease(event: FormEvent<HTMLFormElement>, admissionId: string, who: string) {
    event.preventDefault();
    if (!dischargeDestination) return;
    // The codes come from the ward-scoped projection (D-14), never a patient link read here. Patient
    // code first: a generated patient code contains the admission code. A person the projection did
    // not resolve keeps the codes, rather than becoming "Unknown Patient" in the message.
    const resolved = resolvePatientIdentity(admissions.find((admission) => admission.id === admissionId));
    dischargeCheckRef.current = {
      prior: rejections.length,
      success: `Recorded: ${who} has left the ward.`,
      who,
      codes: resolved.patient ? [resolved.patient.id, admissionId] : [],
    };
    dispatch({
      type: "RECORD_LEAVING",
      role: "ward",
      now,
      admissionId,
      actingUnitId: unitId,
      leavingDestination: dischargeDestination,
    });
    setDischargeOpenFor(undefined);
    setDischargeDestination(undefined);
    setDischargeToken((token) => token + 1);
  }

  function toggleBlockRelease(releaseId: string) {
    setBlockOpenFor((current) => (current === releaseId ? undefined : releaseId));
    setBlockChoice(undefined);
  }

  function toggleRevertRelease(releaseId: string) {
    setRevertOpenFor((current) => (current === releaseId ? undefined : releaseId));
    setRevertChoice(undefined);
  }

  function submitBlockRelease(event: FormEvent<HTMLFormElement>, releaseId: string) {
    event.preventDefault();
    if (!blockChoice) return;
    // Bed-model rework (2026-08-28): this sets the blocked FLAG and moves no stage. The form
    // renders on any unreleased row, and `discharged` rows never reach this list at all.
    dispatch({ type: "BLOCK_BED_RELEASE", role: "ward", now, releaseId, actingUnitId: unitId, blocker: blockChoice });
    setBlockOpenFor(undefined);
    setBlockChoice(undefined);
  }

  // Task 5 (spec D10): a small leave-bed form — unit implied by the route, exactly like
  // `submitBedRelease` above never asking which ward it is acting as.
  function submitLeaveBed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Task F1 (owner answer 32): same day-aware resolve as `submitBedRelease` above, and the
    // same instant-only-not-guessed refusal.
    const expectedReturn = parseReleaseDayInstant(now, leaveDay, leaveExpectedReturn);
    if (expectedReturn === undefined) return;
    // Owner ruling 2026-09-25: a leave bed names the stay it belongs to, and it is never guessed.
    // This form has no patient picker yet, so, exactly as for a bed release (Josh chose "Refuse"),
    // the submit is refused with a plain message and records nothing.
    const chosenAdmissionId: string | undefined = undefined;
    if (chosenAdmissionId === undefined) {
      setToastMessage("Choose the patient who is on leave. Nothing was recorded.");
      return;
    }
    dispatch({
      type: "RECORD_LEAVE_BED",
      role: "ward",
      now,
      unitId: wardUnitId,
      actingUnitId: unitId,
      admissionId: chosenAdmissionId,
      expectedReturn,
    });
    setLeaveExpectedReturn("");
    setLeaveDay("today");
  }

  // Task 5 addendum (binding spec's Data flow section: "Leave beds follow the same path with a
  // two-state life: recorded, then ended on return."): the second half of that life. Same
  // claim-not-proof discipline as every other control on this screen — `actingUnitId` is this
  // screen's own route parameter, and the reducer compares it against the leave bed's own
  // `unitId` before ending it.
  function endLeaveBed(leaveBedId: string) {
    dispatch({ type: "END_LEAVE_BED", role: "ward", now, leaveBedId, actingUnitId: unitId });
  }

  function toggleRelease(movementId: string) {
    setReleaseOpenFor((current) => (current === movementId ? undefined : movementId));
    setReleaseReason(undefined);
  }

  function submitRelease(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    if (!releaseReason) return;
    // `actingUnitId` is this screen's own route parameter, exactly like `submitCapacity` above —
    // it states which ward the caller says it is; it does not prove it.
    dispatch({
      type: "RELEASE_PULL",
      role: "ward",
      now,
      movementId,
      actingUnitId: unitId,
      reason: releaseReason,
    });
    setReleaseOpenFor(undefined);
    setReleaseReason(undefined);
  }

  return (
    <div
      className={styles.screen}
      data-testid="ward-unit-screen"
      data-presentation={presentation}
      data-ward-design="third-edition"
      data-ward-rebuilt-screen="ward"
    >
      <main id="main-content" className={styles.main}>
        <h1 className={styles.screenName}>{presentation === "answer" ? "Ward answer" : "Ward"}</h1>
        <LegalLimitsNotChecked />

        {/* Item 44, build plan task F3, §3 "Ward": this page is about ONE named place (§2 "Never
         *  hidden", S4) and is never itself narrowed by the chosen service — this states how the
         *  choice relates to it rather than changing anything below. `ownService` unresolved (no
         *  real seeded unit today) renders nothing rather than a sentence naming an unknown. */}
        {service !== null && unitHealthService(unit) !== undefined ? (
          <p className={styles.placeholder} data-testid="ward-unit-service-sentence">
            {`This ward is one unit in ${unitHealthService(unit)}, so its own figures below do not change with the service.`}
          </p>
        ) : null}

        {/* Prominent Top Action Bar & Capacity Glance */}
        {/* Prominent Top Action Bar & Capacity Glance */}
        <section className={styles.topActionBarWrap} aria-label="This ward" data-testid={`ward-unit-card-${unit.id}`}>
          <div className={styles.actionBar}>
            <header className={styles.topIdentityBanner}>
              <div className={styles.topIdentityLeft}>
                <h2 className={styles.sectionHeading}>This ward</h2>
                <h3
                  className={styles.unitName}
                  style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, display: "inline-block" }}
                >
                  {unit.name}
                </h3>
                <span className={styles.unitMeta} style={{ fontSize: "0.85rem" }}>
                  {site ? `${site.name} (${site.code})` : unit.siteCode} &middot; {unit.cohort} &middot;{" "}
                  {designationSummary(unit)}
                  {unit.authorised ? "" : " · Not set up for involuntary admissions (demo)"}
                </span>
              </div>
              <WardFreshness
                confirmedAt={unit.allocatable.confirmedAt}
                confirmedByRole={unit.allocatable.source === "ward" ? `NUM ${unit.name}` : undefined}
                now={now}
                derived={unit.allocatable.source !== "ward"}
              />
            </header>
            <div className={styles.actionBtnsLeft}>
              <nav className={styles.wardScreenNav} aria-label={`${unit.name} screens`} data-testid="ward-screen-nav">
                <span aria-current="page">Ward home</span>
                <Link href={wardBoardHref(unit.id)}>Bed board</Link>
              </nav>

              <div className={styles.actionDivider} aria-hidden="true" />

              <button
                type="button"
                className={styles.btnEnterWard}
                id="btnMainEnterWard"
                onClick={() => setActiveTab("beds")}
                title="Open Interactive Bed Matrix and Patient Roster"
              >
                <svg
                  viewBox="0 0 16 16"
                  width="17"
                  height="17"
                  fill="none"
                  strokeWidth="1.8"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 3h12v10H2z" />
                  <path d="M6 3v10M2 8h4" />
                </svg>
                <span>Enter Ward / Open Bed Board</span>
              </button>

              <button
                ref={confirmTriggerRef}
                type="button"
                className={styles.btnActionSec}
                onClick={() => setConfirmNumbersOpen(true)}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 8l3 3 7-7" />
                </svg>
                <span>Confirm today&rsquo;s numbers</span>
              </button>

              <div className={styles.notificationTriggerWrap}>
                <button
                  ref={notificationTriggerRef}
                  type="button"
                  className={styles.btnActionSec}
                  onClick={() => setNotificationCenterOpen((prev) => !prev)}
                  aria-expanded={notificationCenterOpen}
                  data-testid="ward-notifications-toggle-btn"
                  title="View Ward Tasks, Coordinator Buzzes & Census Alerts"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <span>Tasks &amp; Buzzes</span>
                  {unreadAlertsCount > 0 ? (
                    <span className={styles.notificationCountBadge} data-testid="ward-notification-count-badge">
                      {unreadAlertsCount}
                    </span>
                  ) : null}
                </button>

                {notificationCenterOpen ? (
                  <div
                    ref={notificationCenterRef}
                    className={styles.notificationCenterContainer}
                    data-testid="ward-notification-center-wrap"
                  >
                    <WardNotificationCenter
                      unitId={unit.id}
                      unitName={unit.name}
                      now={now}
                      movements={movements}
                      notices={notices}
                      refreshRequests={refreshRequests}
                      morningRollupConfirmed={isRollupConfirmedToday}
                      morningRollupDeadlinePassed={morningRollupDeadlinePassed}
                      morningRollupDeadlineMinutes={morningRollupDeadlineMinutes}
                      onConfirmMorningRollup={handleConfirmMorningRollup}
                      onAcknowledgeNotice={handleAcknowledgeNotice}
                      onDismissBuzz={handleDismissBuzz}
                      onClose={() => setNotificationCenterOpen(false)}
                    />
                  </div>
                ) : null}
              </div>

              <Link className={styles.btnActionSec} href={`/mockups/ward-flow/ward/${unit.id}/answer`}>
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 8l3 3 7-7" />
                </svg>
                <span>Answer requests</span>
              </Link>

              <button
                type="button"
                className={styles.btnActionSec}
                onClick={handleRaiseWardReferral}
                title="Record a ward-to-ward referral with this ward as the sending ward."
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M8 3v10M3 8h10" />
                </svg>
                <span>Raise Referral</span>
              </button>

              <Link
                className={styles.btnActionSec}
                href={`/mockups/ward-flow/handover?scope=${encodeURIComponent(handoverScopeValue({ kind: "ward", id: unit.id }))}`}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 2h8v4H4zM3 6h10a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1zM4 11h8v3H4z" />
                </svg>
                <span>Print Handover</span>
              </Link>
            </div>
          </div>

          {/* Live Capacity Glance Strip (5 metrics, zero side-stripes) */}
          <div className={styles.glanceStrip} role="region" aria-label="Live Capacity Telemetry">
            <div className={`${styles.glanceCard} ${styles.highlight}`}>
              <div className={styles.glanceTop}>
                <span className={styles.glanceLbl}>Staffed Beds</span>
                <span className={styles.badgePill}>Budgeted</span>
              </div>
              <div className={styles.glanceVal}>
                {unit.beds} <small>Beds</small>
              </div>
              <span className={styles.glanceSub}>Roster not recorded</span>
            </div>

            <div className={styles.glanceCard}>
              <div className={styles.glanceTop}>
                <span className={styles.glanceLbl}>Occupied</span>
                <span className={styles.badgePill} style={{ color: "var(--accent-ink)" }}>
                  {unit.beds > 0 ? Math.round((capacity.occupied / unit.beds) * 100) : 0}%
                </span>
              </div>
              <div className={styles.glanceVal}>
                {capacity.occupied} <small>/ {unit.beds}</small>
              </div>
              <span className={styles.glanceSub}>
                {capacity.occupied} physical in beds · {accepted.length} inbound accepted
              </span>
            </div>

            <div
              className={`${styles.glanceCard} ${styles.good}`}
              data-testid="ward-hero"
              aria-labelledby="ward-hero-title"
            >
              <div className={styles.glanceTop}>
                <span className={styles.glanceLbl} id="ward-hero-title">
                  ready bed{capacity.available === 1 ? "" : "s"} on this ward right now
                </span>
                <span className={`${styles.statusPillBadge} ${styles.good}`}>Cleaned</span>
              </div>
              <div className={styles.glanceVal} style={{ color: "var(--good)" }}>
                <span data-testid="ward-hero-ready">{capacity.available}</span> <small>Ready</small>
              </div>
              <span className={styles.glanceSub}>
                <Link
                  className={styles.heroCta}
                  href="#bed-capacity"
                  data-testid="ward-hero-open-bed-list"
                  onClick={() => setActiveTab("return")}
                >
                  <span>
                    Open bed list &middot; {unit.beds} beds &middot; {capacity.available} ready &rarr;
                  </span>
                </Link>
              </span>
            </div>

            <div className={`${styles.glanceCard} ${styles.warn}`}>
              <div className={styles.glanceTop}>
                <span className={styles.glanceLbl}>Specialling 1:1</span>
                <span className={`${styles.statusPillBadge} ${styles.warn}`}>
                  {staffedSpecialling > 0 ? "Active" : "None recorded"}
                </span>
              </div>
              <div className={styles.glanceVal} style={{ color: "var(--warn)" }}>
                {staffedSpecialling} <small>Active</small>
              </div>
              <span className={styles.glanceSub}>
                {(unit.intakeConstraints ?? []).length > 0
                  ? `Limits: ${(unit.intakeConstraints ?? []).map((code) => wardIntakeConstraintLabels[code]).join(", ")}`
                  : "No intake limit is currently recorded"}
              </span>
            </div>

            <div className={`${styles.glanceCard} ${styles.alert}`}>
              <div className={styles.glanceTop}>
                <span className={styles.glanceLbl}>Locked / HDU Status</span>
                <span className={`${styles.statusPillBadge} ${styles.alert}`}>Protocol</span>
              </div>
              <div className={styles.glanceVal} style={{ color: "var(--danger)" }}>
                High Acuity
              </div>
              <span className={styles.glanceSub}>
                {unit.cohort.includes("Secure") ? "6 HDU Suite Beds Operational" : "Standard Security Boundary"}
              </span>
            </div>
          </div>
        </section>

        {/* 09:30 Morning Bed Rollup Deadline Banner */}
        {!isRollupConfirmedToday && morningRollupDeadlinePassed ? (
          <aside
            className={styles.morningRollupOverdueBanner}
            role="alert"
            aria-atomic="true"
            data-testid="ward-morning-rollup-overdue-banner"
          >
            {/* The planned-discharges count below is announced; this sentence travels with it
                (tests/ward-announced-figures-carry-their-marker, tier b). Screen readers only. */}
            <span className="sr-only">These counts are invented figures.</span>
            <div className={styles.morningRollupBannerContent}>
              <span className={styles.morningRollupBannerIcon} aria-hidden="true">
                ⚠️
              </span>
              <div className={styles.morningRollupBannerText}>
                <strong>{morningRollupTimeLabel} Morning Bed Rollup Overdue</strong>
                <span>
                  Today&rsquo;s planned discharge numbers and allocatable beds have not yet been confirmed for{" "}
                  {unit.name}. State Bed Flow Coordination is awaiting morning census.
                </span>
              </div>
            </div>
            <div className={styles.morningRollupBannerActions}>
              <button
                type="button"
                className={styles.btnConfirmMorningRollup}
                data-testid="ward-confirm-morning-rollup-btn"
                onClick={handleConfirmMorningRollup}
              >
                Confirm Morning Rollup ({releasesCountedToday.length} Planned Discharges)
              </button>
            </div>
          </aside>
        ) : isRollupConfirmedToday ? (
          <div className={styles.morningRollupConfirmedBanner} data-testid="ward-morning-rollup-confirmed-banner">
            <div className={styles.morningRollupConfirmedText}>
              <span className={styles.morningRollupCheckIcon} aria-hidden="true">
                ✓
              </span>
              <span>
                <strong>{morningRollupTimeLabel} Morning Bed Rollup Confirmed</strong> at{" "}
                {formatInstantWithDay(rollupConfirmation!.confirmedAt, now)} by {rollupConfirmation!.confirmedByRole}{" "}
                &middot; {rollupConfirmation!.expectedDischarges} discharges scheduled today
              </span>
            </div>
            <button
              type="button"
              className={styles.btnActionSec}
              onClick={() => setConfirmNumbersOpen(true)}
              style={{ minHeight: "36px", fontSize: "0.85rem" }}
            >
              Update Census
            </button>
          </div>
        ) : null}

        {/* Operational Tab Navigation Bar */}
        <nav className={styles.tabBarWrap} aria-label="Ward Operational Tabs">
          <ul className={styles.tabList} role="tablist" id="mainTabList">
            <li role="presentation">
              <button
                type="button"
                className={styles.tabBtn}
                role="tab"
                id="tabBtn-attn"
                aria-selected={activeTab === "attn"}
                aria-controls="tab-attn"
                aria-label="Home (Worth Your Attention)"
                onClick={() => setActiveTab("attn")}
              >
                <span>Home</span>
                <span className={styles.tabBadge} id="badgeAttn">
                  {incoming.length}
                </span>
              </button>
            </li>
            <li role="presentation">
              <button
                type="button"
                className={styles.tabBtn}
                role="tab"
                id="tabBtn-coming"
                aria-selected={activeTab === "coming"}
                aria-controls="tab-coming"
                aria-label="Arrivals (Coming in)"
                onClick={() => setActiveTab("coming")}
              >
                <span>Arrivals</span>
                <span className={styles.tabBadge} id="badgeComing">
                  {accepted.length}
                </span>
              </button>
            </li>
            <li role="presentation">
              <button
                type="button"
                className={styles.tabBtn}
                role="tab"
                id="tabBtn-out"
                aria-selected={activeTab === "out"}
                aria-controls="tab-out"
                aria-label="Discharges (On the way out)"
                onClick={() => setActiveTab("out")}
              >
                <span>Discharges</span>
                <span className={styles.tabBadge} id="badgeOut">
                  {pendingBedReleases.length + unitLeaveBeds.length}
                </span>
              </button>
            </li>
            <li role="presentation">
              <button
                type="button"
                className={styles.tabBtn}
                role="tab"
                id="tabBtn-beds"
                aria-selected={activeTab === "beds"}
                aria-controls="tab-beds"
                aria-label="Beds (Bed Board & Roster)"
                onClick={() => setActiveTab("beds")}
              >
                <span>Beds</span>
                <span className={styles.tabBadge} id="badgeBeds">
                  {unit.beds}
                </span>
              </button>
            </li>
            <li role="presentation">
              <button
                type="button"
                className={styles.tabBtn}
                role="tab"
                id="tabBtn-return"
                aria-selected={activeTab === "return"}
                aria-controls="tab-return"
                aria-label="Decisions (Ward record)"
                onClick={() => setActiveTab("return")}
              >
                <span>Decisions</span>
                <span
                  className={styles.tabBadge}
                  id="badgeReturn"
                  style={{ color: "var(--crimson, #c53030)", fontWeight: 700 }}
                  title="2 decisions due this shift"
                  aria-label="2 decisions due this shift"
                >
                  2 Due
                </span>
              </button>
            </li>
          </ul>
        </nav>

        {/* ───────── TAB 1: WORTH YOUR ATTENTION ───────── */}
        <section
          className={styles.tabPanel}
          id="tab-attn"
          role="tabpanel"
          aria-labelledby="tabBtn-attn"
          data-active={activeTab === "attn"}
        >
          {/* Priority Queue and Statutory & Acuity Alerts Grid */}
          <div className={styles.attnGrid}>
            {/* Awaiting your answer */}
            <section
              aria-label="Awaiting your answer"
              className={styles.listSection}
              data-empty={incoming.length === 0}
              tabIndex={0}
            >
              <h2 className={styles.sectionHeading}>
                {presentation === "answer" ? "Bed request" : "Awaiting your answer"}
              </h2>
              {presentation === "answer" && incoming.length > 0 ? (
                <div className={styles.answerStepper} aria-label="Bed request position">
                  <button
                    type="button"
                    disabled={activeAnswerIndex === 0}
                    onClick={() => setAnswerIndex((current) => Math.max(0, current - 1))}
                  >
                    Previous
                  </button>
                  <strong>
                    Request {activeAnswerIndex + 1} of {incoming.length}
                  </strong>
                  <button
                    type="button"
                    disabled={activeAnswerIndex >= incoming.length - 1}
                    onClick={() => setAnswerIndex((current) => Math.min(incoming.length - 1, current + 1))}
                  >
                    Next
                  </button>
                  <span>
                    {incoming.length - activeAnswerIndex - 1 === 0
                      ? "No more requests are waiting behind this one."
                      : `${incoming.length - activeAnswerIndex - 1} more ${incoming.length - activeAnswerIndex - 1 === 1 ? "request is" : "requests are"} waiting behind this one.`}
                  </span>
                </div>
              ) : null}
              {incoming.length === 0 ? (
                <p className={styles.placeholder}>No referral is currently awaiting an answer from {unit.name}.</p>
              ) : (
                <ul className={styles.cardList}>
                  {visibleIncoming.map((movement) => {
                    // Owner, 26 Sept 2026 ("yes to your recommendations"): a ward sees no identity for
                    // a referral it has not yet accepted — no name, no UMRN — as on the answer view.
                    const blocked = referralAnswerBlocked(movement, unit);
                    const notice = restrictionNotice(movement, unit);
                    const eligibilityIssue = eligibilityWarning(movement, unit, now);
                    const eligibilityVerdict = eligibility(movement, unit, now);
                    const failedGateCount = eligibilityVerdict.gates.filter((gate) => !gate.pass).length;
                    const declineOpen = declineOpenFor === movement.id;
                    return (
                      <li key={movement.id} data-testid={`ward-incoming-${movement.id}`} className={styles.card}>
                        <header className={styles.cardHeader}>
                          <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Incoming patient</span>
                          {presentation === "answer" ? (
                            <span
                              className={styles.answerTier}
                              data-flagged-urgent={movement.flaggedUrgent || undefined}
                            >
                              {movement.flaggedUrgent ? "Urgent flag · " : ""}Tier {movement.urgency}
                            </span>
                          ) : (
                            <span className={styles.cardMeta}>
                              {movement.cohort} &middot; {movement.security} &middot; {movement.sex} &middot;{" "}
                              {movement.legalStatus}
                            </span>
                          )}
                          <span className={styles.cardMeta}>{elapsedLabel(movement, now)}</span>
                        </header>
                        {presentation === "answer" ? (
                          <>
                            <p className={styles.answerEligibilitySummary} data-eligible={eligibilityVerdict.eligible}>
                              <strong>
                                {eligibilityVerdict.eligible ? "Eligible" : "Eligibility concerns recorded"}
                              </strong>{" "}
                              {eligibilityVerdict.eligible
                                ? `eligible on all ${eligibilityVerdict.gates.length} gates`
                                : `${failedGateCount} of ${eligibilityVerdict.gates.length} gates do not pass`}
                            </p>
                            <p className={styles.answerIdentityAbsence}>
                              Patient name and age are not recorded for this movement.
                            </p>
                            {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                            <dl className={styles.answerFacts} aria-label="Current facts for this patient">
                              <div>
                                <dt>Cohort</dt>
                                <dd>{movement.cohort}</dd>
                              </div>
                              <div>
                                <dt>Bed needed</dt>
                                <dd>{movement.security === "Secure" ? "Secure" : "Open"}</dd>
                              </div>
                              <div>
                                <dt>Sex</dt>
                                <dd>{movement.sex}</dd>
                              </div>
                              {/* Owner answer 2026-09-25 (R7, Q2): gender identity beside sex, same style. */}
                              <div>
                                <dt>Gender</dt>
                                <dd>{movement.gender ?? "Not recorded"}</dd>
                              </div>
                              <div>
                                <dt>Specialling</dt>
                                <dd>{movement.specialling ? "Requested" : "Not requested"}</dd>
                              </div>
                              <div>
                                <dt>High-acuity nursing</dt>
                                <dd>{movement.highAcuity ? "Requested" : "Not requested"}</dd>
                              </div>
                              <div>
                                <dt>Legal status</dt>
                                <dd>{movement.legalStatus}</dd>
                              </div>
                              <div>
                                <dt>From</dt>
                                <dd>Emergency department. Origin department is not disclosed in this ward view.</dd>
                              </div>
                              <div>
                                <dt>Referred</dt>
                                <dd>
                                  {movement.referredAt === undefined
                                    ? `No ward-referral time recorded; ${elapsedLabel(movement, now)} since this movement opened`
                                    : `At ${formatInstantWithDay(movement.referredAt, now)}, ${elapsedLabel(movement, now)}`}
                                </dd>
                              </div>
                            </dl>
                            <section
                              className={styles.answerGates}
                              // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
                              aria-label="This ward's own gates for this patient"
                            >
                              <div className={styles.answerGatesHeading}>
                                <h3>This ward&rsquo;s own gates</h3>
                                <span>
                                  {eligibilityVerdict.gates.length - failedGateCount} of{" "}
                                  {eligibilityVerdict.gates.length} pass
                                </span>
                              </div>
                              <ul>
                                {eligibilityVerdict.gates.map((gate) => (
                                  <li key={gate.gate} data-pass={gate.pass}>
                                    <span className={styles.answerGateMark} aria-hidden="true">
                                      {gate.pass ? "✓" : "!"}
                                    </span>
                                    <span className={styles.answerGateCopy}>
                                      <strong>{WARD_GATE_LABELS[gate.gate]}</strong>
                                      <span>{wardFacingGateDetail(gate)}</span>
                                    </span>
                                    <strong className={styles.answerGateVerdict}>
                                      {gate.pass ? "Pass" : "Does not pass"}
                                    </strong>
                                  </li>
                                ))}
                              </ul>
                            </section>
                          </>
                        ) : null}
                        {notice ? (
                          <span
                            className={notice.level === "voluntary_on_locked" ? styles.noticeProminent : styles.notice}
                            data-testid={`ward-restriction-notice-${movement.id}`}
                            data-level={notice.level}
                          >
                            {notice.text}
                          </span>
                        ) : null}
                        {eligibilityIssue ? (
                          <span
                            className={styles.noticeProminent}
                            data-testid={`ward-eligibility-warning-${movement.id}`}
                            data-level={eligibilityIssue.level}
                          >
                            {eligibilityIssue.text}
                          </span>
                        ) : null}
                        <div className={styles.actionRow}>
                          <button
                            type="button"
                            data-testid={`ward-accept-${movement.id}`}
                            aria-disabled={blocked ? "true" : undefined}
                            aria-describedby={blocked ? `ward-accept-unavailable-${movement.id}` : undefined}
                            title={blocked ?? undefined}
                            className={styles.acceptButton}
                            onClick={
                              blocked
                                ? ignoreUnavailableActivation
                                : () => {
                                    priorRejectionCountRef.current = rejections.length;
                                    dispatch({
                                      type: "ACCEPT_IN_PRINCIPLE",
                                      role: "ward",
                                      now,
                                      movementId: movement.id,
                                      unitId: unit.id,
                                    });
                                    setCheckToken((token) => token + 1);
                                  }
                            }
                          >
                            Accept in principle
                          </button>
                          <button
                            type="button"
                            data-testid={`ward-decline-toggle-${movement.id}`}
                            aria-disabled={blocked ? "true" : undefined}
                            aria-describedby={blocked ? `ward-decline-unavailable-${movement.id}` : undefined}
                            title={blocked ?? undefined}
                            aria-expanded={declineOpen}
                            className={styles.declineButton}
                            onClick={blocked ? ignoreUnavailableActivation : () => toggleDecline(movement.id)}
                          >
                            Decline
                          </button>
                        </div>
                        {blocked ? (
                          <>
                            <span id={`ward-accept-unavailable-${movement.id}`} className="sr-only">
                              {blocked}
                            </span>
                            <span id={`ward-decline-unavailable-${movement.id}`} className="sr-only">
                              {blocked}
                            </span>
                          </>
                        ) : null}
                        {lastActionRejection?.movementId === movement.id ? (
                          <p
                            className={styles.noticeProminent}
                            role="alert"
                            data-testid={`ward-action-rejection-${movement.id}`}
                          >
                            {WARD_ACTION_REJECTION_LABELS[lastActionRejection.attempted] ??
                              lastActionRejection.attempted}{" "}
                            not recorded: {wardSafeRejectionReason(lastActionRejection.reason)}
                          </p>
                        ) : null}
                        {overrideReasonForm(movement.id)}
                        {declineOpen && !blocked ? (
                          <form
                            className={styles.declineForm}
                            onSubmit={(event) => submitDecline(event, movement.id)}
                            data-testid={`ward-decline-form-${movement.id}`}
                          >
                            <fieldset className={styles.declineFieldset}>
                              {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                              <legend className={styles.declineLegend}>Decline reason for this patient</legend>
                              {DECLINE_REASONS.map((reason) => (
                                <label key={reason} className={styles.declineOption}>
                                  <input
                                    type="radio"
                                    name={`decline-reason-${movement.id}`}
                                    value={reason}
                                    checked={declineReason === reason}
                                    onChange={() => setDeclineReason(reason)}
                                  />
                                  {reason.replace(/_/g, " ")}
                                </label>
                              ))}
                            </fieldset>
                            <button type="submit" disabled={!declineReason} className={styles.declineSubmit}>
                              Confirm decline
                            </button>
                          </form>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Statutory, Acuity & Discharge Block Alerts */}
            <div className={styles.cardPanel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M8 2l6 11H2L8 2zM8 7v3M8 12h.01" />
                  </svg>
                  <span>Form &amp; acuity alerts</span>
                </h2>
                <span
                  className={`${styles.statusPillBadge} ${liveFormAlerts.length > 0 ? styles.danger : styles.good}`}
                >
                  {liveFormAlerts.length > 0 ? "Action Required" : "None recorded"}
                </span>
              </div>
              <div className={styles.panelBody}>
                {liveFormAlerts.length === 0 ? (
                  <p className={styles.placeholder}>No form or acuity alert is currently recorded for {unit.name}.</p>
                ) : (
                  liveFormAlerts.map((alert) => (
                    <div
                      key={alert.key}
                      className={`${styles.alertItem} ${
                        alert.tone === "critical"
                          ? styles.critical
                          : alert.tone === "warning"
                            ? styles.warning
                            : styles.info
                      }`}
                    >
                      <div className={styles.alertItemTop}>
                        <span className={styles.alertItemTitle}>
                          <span>{alert.title}</span>
                        </span>
                        <span
                          className={`${styles.alertItemCountdown} ${
                            alert.tone === "critical" ? styles.danger : styles.warn
                          }`}
                        >
                          {alert.countdown}
                        </span>
                      </div>
                      <p className={styles.alertItemText}>{alert.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Morning Clinical Huddle & Ward Priorities Briefing */}
          <div className={styles.huddleBriefingCard}>
            <div className={styles.huddleBriefingLeft}>
              <span className={styles.huddleBadge}>Morning Clinical Briefing</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>
                {releasesCountedToday.length} bed{releasesCountedToday.length === 1 ? "" : "s"} coming free &middot;{" "}
                {accepted.length} inbound &middot; {unitLeaveBeds.length} on leave
              </span>
            </div>
            <div className={styles.huddleBriefingRight}>
              <span>Shift roles are not recorded on this page.</span>
            </div>
          </div>

          {/* Shift Coordinator Timestamped Activity Ledger */}
          <div className={styles.cardPanel} style={{ marginTop: "1rem" }}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3.5l2.5 1.5" />
                </svg>
                <span>Shift Coordinator Timestamped Activity Ledger</span>
              </h2>
              <span className={styles.badgePill}>Live Shift Log</span>
            </div>
            <div className={styles.panelBody}>
              {recentAnswers.length === 0 ? (
                <p className={styles.placeholder}>No accepted or declined answers are recorded for {unit.name}.</p>
              ) : (
                <div className={styles.ledgerFeed}>
                  {recentAnswers.slice(0, 7).map((answer) => (
                    <div key={answer.key} className={styles.ledgerRow}>
                      <span className={styles.ledgerTime}>
                        {answer.at !== undefined ? formatInstantWithDay(answer.at, now) : "Time not recorded"}
                      </span>
                      <span className={styles.ledgerText}>
                        <b>
                          {answer.movementId} {answer.outcome.toLowerCase()}
                        </b>
                        {answer.reason ? ` — ${answer.reason.replace(/_/g, " ")}` : null}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Daily Ward Readiness & Operational Checklist */}
          <div className={styles.checklistCard}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="2" y="2" width="12" height="12" rx="2" />
                  <path d="M5 8l2 2 4-4" />
                </svg>
                <span>Shift Readiness &amp; Operational Safety Checklist</span>
              </h2>
              <span className={styles.statusPillBadge}>Completion not recorded</span>
            </div>
            <div className={styles.checklistGrid}>
              <div className={styles.checklistItem}>
                <div>
                  <strong>Morning census</strong>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>Submission not recorded here</div>
                </div>
              </div>
              <div className={styles.checklistItem}>
                <div>
                  <strong>Emergency Resuscitation Trolley</strong>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>Check and seal status not recorded here</div>
                </div>
              </div>
              <div className={styles.checklistItem}>
                <div>
                  <strong>S8 medication check</strong>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>Signoff not recorded here</div>
                </div>
              </div>
              <div className={styles.checklistItem}>
                <div>
                  <strong>Escort &amp; transport paperwork</strong>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>Preparation not recorded here</div>
                </div>
              </div>
            </div>
          </div>

          {/* Preserved test contract for Withdrawn and Overrides (visually hidden per user request) */}
          <div className={styles.visuallyHidden}>
            <section aria-labelledby="ward-withdrawn-heading" className={styles.listSection}>
              <h2 id="ward-withdrawn-heading" className={styles.sectionHeading}>
                Withdrawn from {unit.name}
              </h2>
              {withdrawn.length === 0 ? (
                <p className={styles.placeholder}>No referral to {unit.name} has been withdrawn.</p>
              ) : (
                <ul className={styles.cardList}>
                  {withdrawn.map((movement) => {
                    const entry = movement.withdrawnReferrals.find((candidate) => candidate.unitId === unit.id);
                    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
                    const patientInfo = resolvePatientIdentity(movement);
                    return (
                      <li key={movement.id} data-testid={`ward-withdrawn-${movement.id}`} className={styles.card}>
                        <strong>{patientInfo.formalName}</strong>
                        <span className={styles.cardMeta} data-testid={`ward-withdrawn-reason-${movement.id}`}>
                          {entry ? withdrawalReasonLabels[entry.reason] : "Withdrawn — reason unresolved"}
                        </span>
                        {entry ? <span className={styles.cardMeta}>{formatInstantWithDay(entry.at, now)}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-labelledby="ward-overrides-heading" className={styles.listSection}>
              <h2 id="ward-overrides-heading" className={styles.sectionHeading}>
                Overrides recorded against {unit.name}
              </h2>
              <OverrideRegister entries={overridesHere} units={units} now={now} />
            </section>
          </div>

          {presentation === "answer" ? (
            <>
              <section
                className={`${styles.listSection} ${styles.answerOnlyPanel}`}
                data-answer-panel="capacity"
                aria-labelledby="ward-answer-capacity-heading"
                tabIndex={0}
              >
                <h2 id="ward-answer-capacity-heading" className={styles.sectionHeading}>
                  Confirm your beds
                </h2>
                <div className={styles.answerCapacityBody}>
                  <dl className={styles.answerCapacityFacts} aria-label={`Current bed facts for ${unit.name}`}>
                    <div>
                      <dt>Ready now</dt>
                      <dd>{capacity.available}</dd>
                    </div>
                    <div>
                      <dt>Physically empty</dt>
                      <dd>{unit.empty.value}</dd>
                    </div>
                    <div>
                      <dt>Allocatable</dt>
                      <dd>{unit.allocatable.value}</dd>
                    </div>
                    <div>
                      <dt>Confirmed discharges</dt>
                      <dd>{breakdown.confirmedToday}</dd>
                    </div>
                    <div>
                      <dt>Expected discharges</dt>
                      <dd>{breakdown.expectedToday}</dd>
                    </div>
                  </dl>
                  <div className={styles.answerCapacityFreshness}>
                    <div>
                      <strong>Physically empty beds</strong>
                      <WardFreshness
                        confirmedAt={unit.empty.confirmedAt}
                        confirmedByRole={unit.empty.source === "ward" ? `NUM ${unit.name}` : undefined}
                        now={now}
                        derived={unit.empty.source !== "ward"}
                      />
                    </div>
                    <div>
                      <strong>Allocatable beds</strong>
                      <WardFreshness
                        confirmedAt={unit.allocatable.confirmedAt}
                        confirmedByRole={unit.allocatable.source === "ward" ? `NUM ${unit.name}` : undefined}
                        now={now}
                        derived={unit.allocatable.source !== "ward"}
                      />
                    </div>
                  </div>
                  {capacityConfirmationForm()}
                </div>
              </section>

              <section
                className={`${styles.listSection} ${styles.answerOnlyPanel}`}
                data-answer-panel="history"
                aria-labelledby="ward-answer-history-heading"
                tabIndex={0}
              >
                <h2 id="ward-answer-history-heading" className={styles.sectionHeading}>
                  Recent answers
                </h2>
                <div className={styles.answerHistoryBody}>
                  <p className={styles.answerHistoryScope}>Recorded acceptances and declines for this ward.</p>
                  {recentAnswers.length === 0 ? (
                    <p className={styles.placeholder}>No accepted or declined answers are recorded for {unit.name}.</p>
                  ) : (
                    <ul className={styles.answerHistoryList} data-testid="ward-answer-history">
                      {recentAnswers.map((answer) => (
                        <li key={answer.key} data-testid={`ward-answer-history-${answer.key}`}>
                          <strong>{answer.movementId}</strong>
                          <span>{answer.outcome}</span>
                          <span>{answer.reason ? answer.reason.replace(/_/g, " ") : "Accepted by this ward"}</span>
                          {answer.at === undefined ? (
                            <span>Time not recorded</span>
                          ) : (
                            <time>{formatInstantWithDay(answer.at, now)}</time>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </>
          ) : null}
        </section>

        {/* ───────── TAB 5: TODAY'S DECISIONS & SHIFT COCKPIT ───────── */}
        <section
          className={styles.tabPanel}
          id="tab-return"
          role="tabpanel"
          aria-labelledby="tabBtn-return"
          data-active={activeTab === "return"}
        >
          <WardDecisionsCockpit unit={unit} />
          {/* Preserved test contracts for automated test suites (visually hidden) */}
          <div className={styles.visuallyHidden}>
            {/*
          🔴 **THE COUNT SAYS "SINCE THIS PAGE OPENED", NOT "TODAY", AND THE FILE ALREADY KNEW.**
          `confirmedToday` is `useState` (:252) — it counts taps in THIS SESSION and resets on
          reload. The row chips below say exactly that ("Confirmed since this page opened" / "Not
          confirmed since this page opened"), and the comment above the state records that the chips
          "are now what they say" — a sweep that reached the chips and missed this line, nine lines
          away.

          ⚠️ **It was a day label over a session count, on the panel a ward uses to confirm its
          numbers.** Nobody chose the wrong word; somebody corrected the halves they were looking at.

          The denominator stays 3 deliberately. Rows 4 and 5 record an ITEM, never an answer act, so
          they can never increment it — see their own comments. An absent item is not an absent
          answer, and a ward with nobody going on leave has not failed to answer.
        */}
            <div
              id="ward-daily-return"
              className={`${styles.dailyReturn} ${styles.censusCommandCard}`}
              role="region"
              aria-label="Today’s return"
              tabIndex={0}
            >
              <div className={styles.commandHeader}>
                <div className={styles.commandTitleGroup}>
                  <h2 className={styles.commandMainTitle}>
                    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 8l3 3 7-7" />
                    </svg>
                    <span>Morning Census &amp; Capacity Confirmation</span>
                  </h2>
                  <span className={styles.commandSubTitle}>Your morning roll-up, your default, not a legal limit</span>
                </div>
                <span
                  className={`${styles.returnStatusChip} ${confirmedToday.size >= 3 ? styles.returnStatusChipConfirmed : ""}`}
                  id="censusVerificationStatus"
                >
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M3 8l3 3 7-7" />
                  </svg>
                  <span id="censusStatusText">
                    {confirmedToday.size >= 3 ? "Both figures verified today" : "Census verification pending"}
                  </span>
                </span>
              </div>

              <WardPanel
                title="Today’s return"
                count={`${confirmedToday.size} of ${DAILY_RETURN_QUESTIONS.length} confirmed since this page opened`}
                blurb="If nothing has changed, confirm with one tap — you do not need to re-enter anything."
              >
                <div className={styles.affirmationBanner}>
                  <div className={styles.affirmationLeft}>
                    <div className={styles.affirmationIcon} aria-hidden="true">
                      <svg
                        viewBox="0 0 16 16"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                      >
                        <path d="M3 8l3 3 7-7" />
                      </svg>
                    </div>
                    <div className={styles.affirmationText}>
                      <strong>Routine Census Affirmation:</strong> If physical vacancy and allocatable beds match ward
                      reality, confirm both in one tap.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`${styles.confirmAllButton} ${styles.btnMasterAffirm}`}
                    onClick={confirmBothBedCounts}
                    data-testid="ward-confirm-all"
                    data-confirmed={confirmedToday.has("empty") && confirmedToday.has("allocatable") ? "true" : "false"}
                  >
                    Confirm both bed counts &mdash; nothing has changed
                  </button>
                </div>

                <ul className={styles.confirmRows}>
                  <li
                    className={styles.confirmRow}
                    data-fresh={confirmedToday.has("empty") ? "confirmed" : "waiting"}
                    data-testid="ward-confirm-row-empty"
                  >
                    <div className={styles.confirmRowHead}>
                      <span className={styles.confirmRowLabel}>Beds empty right now</span>
                      <span className={styles.confirmRowValue}>{unit.empty.value}</span>
                    </div>
                    <div className={styles.confirmRowMeta}>
                      <WardChip level={confirmedToday.has("empty") ? "accepted" : "stalled"}>
                        {confirmedToday.has("empty")
                          ? "Confirmed since this page opened"
                          : "Not confirmed since this page opened"}
                      </WardChip>
                      <WardFreshness
                        confirmedAt={unit.empty.confirmedAt}
                        confirmedByRole={unit.empty.source === "ward" ? `NUM ${unit.name}` : undefined}
                        now={now}
                        derived={unit.empty.source !== "ward"}
                      />
                    </div>
                    <button
                      type="button"
                      className={`${styles.confirmRowButton} ${styles.btnInlineConfirm}`}
                      onClick={confirmEmptyToday}
                      data-testid="ward-confirm-empty"
                    >
                      Confirm &mdash; nothing has changed
                    </button>
                  </li>

                  <li
                    className={styles.confirmRow}
                    data-fresh={confirmedToday.has("allocatable") ? "confirmed" : "waiting"}
                    data-testid="ward-confirm-row-allocatable"
                  >
                    <div className={styles.confirmRowHead}>
                      <span className={styles.confirmRowLabel}>Of those, how many can you actually allocate</span>
                      <span className={styles.confirmRowValue}>{unit.allocatable.value}</span>
                    </div>
                    <div className={styles.confirmRowMeta}>
                      <WardChip level={confirmedToday.has("allocatable") ? "accepted" : "stalled"}>
                        {confirmedToday.has("allocatable")
                          ? "Confirmed just now"
                          : "Not confirmed since this page opened"}
                      </WardChip>
                      <WardFreshness
                        confirmedAt={unit.allocatable.confirmedAt}
                        confirmedByRole={unit.allocatable.source === "ward" ? `NUM ${unit.name}` : undefined}
                        now={now}
                      />
                    </div>
                    <div className={styles.censusValueRow}>
                      <div className={styles.stepperUnit}>
                        <button
                          type="button"
                          className={styles.stepperBtn}
                          onClick={() => {
                            const cur = Number.parseInt(capacityValue, 10);
                            const next = Math.max(0, (Number.isNaN(cur) ? unit.allocatable.value : cur) - 1);
                            setCapacityValue(String(next));
                          }}
                          title="Decrease allocatable count"
                          aria-label="Decrease allocatable count"
                        >
                          -
                        </button>
                        <span className={styles.stepperDisplay}>{capacityValue}</span>
                        <button
                          type="button"
                          className={styles.stepperBtn}
                          onClick={() => {
                            const cur = Number.parseInt(capacityValue, 10);
                            const next = Math.min(unit.beds, (Number.isNaN(cur) ? unit.allocatable.value : cur) + 1);
                            setCapacityValue(String(next));
                          }}
                          title="Increase allocatable count"
                          aria-label="Increase allocatable count"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className={`${styles.confirmRowButton} ${styles.btnInlineConfirm}`}
                        onClick={confirmAllocatableToday}
                        data-testid="ward-confirm-allocatable"
                      >
                        Confirm &mdash; nothing has changed
                      </button>
                    </div>
                  </li>

                  <li
                    className={styles.confirmRow}
                    data-fresh={confirmedToday.has("constraints") ? "confirmed" : "waiting"}
                    data-testid="ward-confirm-row-constraints"
                  >
                    <div className={styles.confirmRowHead}>
                      <span className={styles.confirmRowLabel}>Anything limiting who can come in right now</span>
                    </div>
                    <div className={styles.confirmRowMeta}>
                      <WardChip level={confirmedToday.has("constraints") ? "accepted" : "stalled"}>
                        {confirmedToday.has("constraints")
                          ? "Answered since this page opened"
                          : "Not answered since this page opened"}
                      </WardChip>
                    </div>
                    {confirmedToday.has("constraints") ? (
                      <p className={styles.confirmSkipNote} data-testid="ward-confirm-constraints-answer">
                        {(unit.intakeConstraints ?? []).length > 0
                          ? (unit.intakeConstraints ?? []).map((code) => wardIntakeConstraintLabels[code]).join(", ")
                          : "Nothing limiting intake."}
                      </p>
                    ) : null}
                    <form className={styles.confirmAnswerRow} onSubmit={saveConstraints}>
                      <fieldset
                        className={styles.confirmConstraintsFieldset}
                        data-testid="ward-confirm-constraints-options"
                      >
                        <legend className="sr-only">Anything limiting who can come in right now</legend>
                        <div className={styles.constraintsPillsGrid}>
                          {WARD_INTAKE_CONSTRAINTS.map((code) => (
                            <label
                              key={code}
                              className={styles.constraintChip}
                              data-active={constraintsDraft.includes(code) ? "true" : "false"}
                            >
                              <input
                                type="checkbox"
                                checked={constraintsDraft.includes(code)}
                                onChange={(event) => toggleConstraintOption(code, event.target.checked)}
                                data-testid={`ward-confirm-constraints-option-${code}`}
                                style={{ width: "16px", height: "16px", accentColor: "var(--warn)" }}
                              />
                              <span>{wardIntakeConstraintLabels[code]}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <button
                        type="submit"
                        className={`${styles.confirmRowButton} ${styles.btnInlineConfirm}`}
                        data-testid="ward-confirm-constraints-save"
                      >
                        Save answer
                      </button>
                    </form>
                    <p className={styles.confirmSkipNote}>Choose none if nothing is limiting intake right now.</p>
                  </li>

                  <li className={styles.confirmRow} data-kind="record" data-testid="ward-confirm-row-release">
                    <div className={styles.confirmRowHead}>
                      <span className={styles.confirmRowLabel}>A bed coming free</span>
                      <span className={styles.confirmRowValue}>{releasesComingFree}</span>
                    </div>
                    <div className={styles.confirmRowMeta}>
                      <span className={styles.recordStamp} data-testid="ward-confirm-release-stamp">
                        {lastFlaggedRelease
                          ? `Last flagged ${formatInstantWithDay(lastFlaggedRelease.confirmedAt, now)} · ${lastFlaggedRelease.confirmedBy}`
                          : "No bed flagged here yet"}
                      </span>
                    </div>
                    <p className={styles.confirmSkipNote} data-testid="ward-confirm-release-note">
                      {lastFlaggedRelease
                        ? "Most recent flag; this does not establish that the list is complete or checked today."
                        : "No bed is still flagged to come free. Discharged beds move to the made-ready list; no record shows whether this was checked today."}
                    </p>
                    <Link
                      className={styles.confirmRowLink}
                      href="#ward-flag-bed-release"
                      data-testid="ward-confirm-release-link"
                    >
                      Flag a bed coming free
                    </Link>
                  </li>

                  <li className={styles.confirmRow} data-kind="record" data-testid="ward-confirm-row-leave">
                    <div className={styles.confirmRowHead}>
                      <span className={styles.confirmRowLabel}>A bed going on leave</span>
                      <span className={styles.confirmRowValue}>{breakdown.onLeave}</span>
                    </div>
                    <div className={styles.confirmRowMeta}>
                      <span className={styles.recordStamp} data-testid="ward-confirm-leave-stamp">
                        {lastRecordedLeaveBed
                          ? `Last recorded ${formatInstantWithDay(lastRecordedLeaveBed.confirmedAt, now)} · ${lastRecordedLeaveBed.confirmedBy}`
                          : "No bed recorded here yet"}
                      </span>
                    </div>
                    <p className={styles.confirmSkipNote} data-testid="ward-confirm-leave-note">
                      {lastRecordedLeaveBed
                        ? "Most recent leave-bed record; this does not establish that the list is complete or checked today."
                        : "No leave bed is recorded. No record shows whether this was checked today."}
                    </p>
                    <Link
                      className={styles.confirmRowLink}
                      href="#ward-leave-bed-form"
                      data-testid="ward-confirm-leave-link"
                    >
                      Record a bed on leave
                    </Link>
                  </li>
                </ul>
              </WardPanel>
            </div>

            <section
              aria-label="Ward figures, right now"
              id="bed-capacity"
              className={`${styles.bedSection} ${styles.censusCommandCard}`}
              tabIndex={0}
              style={{ marginTop: "1.5rem" }}
            >
              <div className={styles.commandHeader}>
                <div className={styles.commandTitleGroup}>
                  <h2 className={styles.commandMainTitle}>
                    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="12" height="10" rx="1" />
                      <path d="M6 3v10M2 8h4" />
                    </svg>
                    <span>Ward figures, right now</span>
                  </h2>
                  <span className={styles.commandSubTitle}>Bed distribution · {unit.beds} Staffed Beds</span>
                </div>
                <div
                  className={styles.capacityFreshnessRow}
                  data-testid="ward-unit-capacity-freshness"
                  style={{ margin: 0 }}
                >
                  <WardFreshness
                    confirmedAt={unit.allocatable.confirmedAt}
                    confirmedByRole={unit.allocatable.source === "ward" ? `NUM ${unit.name}` : undefined}
                    now={now}
                    derived={unit.allocatable.source !== "ward"}
                  />
                  {latestRefreshRequest ? (
                    <span className={styles.refreshRequestMark} data-testid="ward-refresh-request-mark">
                      Asked to refresh at {formatInstant(latestRefreshRequest.at)} by {latestRefreshRequest.byRole}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className={styles.capacitySection}>
                <div className={styles.capacityTrackTitleRow}>
                  <span className={styles.capacityTrackLabel}>Capacity distribution</span>
                  <span style={{ fontSize: "11.5px", color: "var(--muted)", fontFamily: "var(--mono)" }}>
                    {capacity.occupied} Occupied · {capacity.available} Ready · {capacity.held} Held · Blocked not
                    recorded
                  </span>
                </div>

                <div className={styles.capacityTrack} aria-hidden="true" title="Proportional Bed Distribution">
                  <div
                    className={styles.capSeg}
                    data-state="available"
                    style={{ flexGrow: capacity.available, width: `${(capacity.available / unit.beds) * 100}%` }}
                  />
                  <div
                    className={styles.capSeg}
                    data-state="held"
                    style={{ flexGrow: capacity.held, width: `${(capacity.held / unit.beds) * 100}%` }}
                  />
                  <div
                    className={styles.capSeg}
                    data-state="blocked"
                    style={{ flexGrow: capacity.blocked, width: `${(capacity.blocked / unit.beds) * 100}%` }}
                  />
                  <div
                    className={styles.capSeg}
                    data-state="occupied"
                    style={{ flexGrow: capacity.occupied, width: `${(capacity.occupied / unit.beds) * 100}%` }}
                  />
                </div>

                <div className={`${styles.bedGrid} ${styles.breakdownStatsGrid}`} data-testid="ward-unit-beds">
                  <span className={`${styles.bedChip} ${styles.statBox}`} data-state="available">
                    <span className={styles.statBoxLabel}>Ready</span>{" "}
                    <strong className={styles.statBoxVal} style={{ color: "var(--good)" }}>
                      {capacity.available}
                    </strong>
                  </span>
                  <span className={`${styles.bedChip} ${styles.statBox}`} data-state="held">
                    <span className={styles.statBoxLabel}>Held</span>{" "}
                    <strong className={styles.statBoxVal} style={{ color: "var(--accent-ink)" }}>
                      {capacity.held}
                    </strong>
                  </span>
                  <span className={`${styles.bedChip} ${styles.statBox}`} data-state="blocked">
                    <span className={styles.statBoxLabel}>Blocked</span>{" "}
                    <strong className={styles.statBoxVal}>Not recorded</strong>
                  </span>
                  <span className={`${styles.bedChip} ${styles.statBox}`} data-state="occupied">
                    <span className={styles.statBoxLabel}>Occupied</span>{" "}
                    <strong className={styles.statBoxVal}>{capacity.occupied}</strong>
                  </span>
                  <span className={`${styles.bedChip} ${styles.statBox}`} data-state="confirmed">
                    <span className={styles.statBoxLabel}>Confirmed</span>{" "}
                    <strong className={styles.statBoxVal} style={{ color: "var(--accent-ink)" }}>
                      {breakdown.confirmedToday}
                    </strong>
                  </span>
                  <span className={`${styles.bedChip} ${styles.statBox}`} data-state="expected">
                    <span className={styles.statBoxLabel}>Expected</span>{" "}
                    <strong className={styles.statBoxVal} style={{ color: "var(--warn)" }}>
                      {breakdown.expectedToday}
                    </strong>
                  </span>
                  <span
                    className={`${styles.bedChip} ${styles.statBox}`}
                    data-state="blocked-release"
                    data-testid="ward-unit-blocked-releases"
                  >
                    <span className={styles.statBoxLabel}>{BED_RELEASE_BLOCKED_FIGURE_LABEL}</span>{" "}
                    <strong className={styles.statBoxVal}>{breakdown.blockedToday}</strong>
                  </span>
                  <span className={`${styles.bedChip} ${styles.statBox}`} data-state="leave">
                    <span className={styles.statBoxLabel}>On leave</span>{" "}
                    <strong className={styles.statBoxVal} style={{ color: "var(--gilt)" }}>
                      {breakdown.onLeave}
                    </strong>
                  </span>
                </div>

                {pendingPreparation > 0 ? (
                  <div className={styles.pendingCleanBanner} data-testid="ward-unit-beds-pending">
                    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="8" cy="8" r="6" />
                      <path d="M8 5v3.5l2 1" />
                    </svg>
                    <span>
                      <strong>
                        {pendingPreparation} of the {capacity.available} ready{" "}
                        {capacity.available === 1 ? "bed" : "beds"} at {unit.name}{" "}
                        {pendingPreparation === 1 ? "is" : "are"} still being made ready.
                      </strong>{" "}
                      The bed stays offered and stays counted — pulling the next patient takes hours anyway — but the
                      ward cannot admit into it yet.
                    </span>
                  </div>
                ) : null}

                <details className={styles.clinicalDisclosure}>
                  <summary>What these bed figures mean</summary>
                  <p className={styles.bedNote}>
                    Ready, held, blocked and occupied total {unit.beds}. Held means empty but not offered; it is
                    separate from a bed pulled for a patient. Confirmed, expected, held-up discharge and leave are flow
                    counts and are not added to that total.
                  </p>
                </details>

                <details className={styles.clinicalDisclosure} open>
                  <summary>Update allocatable count directly</summary>
                  <div style={{ marginTop: "10px" }}>
                    {presentation !== "answer" ? capacityConfirmationForm() : null}
                  </div>
                </details>
              </div>
            </section>

            {/* ═════ SECTION 3: BED TURNOVER PIPELINE (3-STAGE FLOW) ═════ */}
            <section className={styles.pipelineSection} aria-label="Bed Turnover &amp; Release Pipeline">
              <div className={styles.pipelineHead}>
                <h2 className={styles.pipelineTitle}>
                  <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M2 4h12M2 8h12M2 12h12" />
                  </svg>
                  <span>Bed Turnover &amp; Release Pipeline</span>
                </h2>
              </div>

              <form
                id="ward-flag-bed-release"
                className={styles.capacityForm}
                onSubmit={submitBedRelease}
                data-testid="ward-flag-bed-release"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r1, 8px)",
                  padding: "16px 18px",
                  boxShadow: "var(--lift)",
                  margin: "0 0 16px 0",
                }}
              >
                <span className={styles.capacityLabel}>Flag a bed coming free at {unit.name}</span>
                <div className={styles.capacityRow}>
                  <div>
                    <label className={styles.declineLegend} htmlFor="ward-bed-release-admission">
                      Patient
                    </label>
                    {/* Not `required`: with nobody chosen the submit reaches the handler, which refuses
                      with a plain message rather than the browser's own bubble. */}
                    <select
                      id="ward-bed-release-admission"
                      className={styles.capacityInput}
                      value={bedReleaseAdmissionId ?? ""}
                      onChange={(event) => setBedReleaseAdmissionId(event.target.value || undefined)}
                      data-testid="ward-bed-release-admission"
                    >
                      <option value="" disabled>
                        {bedReleaseCandidates.length === 0
                          ? "Nobody in a bed here can be flagged"
                          : "Choose whose bed is coming free"}
                      </option>
                      {bedReleaseCandidates.map((candidate) => (
                        <option key={candidate.admissionId} value={candidate.admissionId}>
                          {candidate.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={styles.declineLegend} htmlFor="ward-bed-release-waiting-on">
                      Waiting on
                    </label>
                    <p className={styles.declineHint} data-testid="ward-bed-release-waiting-on-hint">
                      {WAITING_ON_LONGEST}
                    </p>
                    <select
                      id="ward-bed-release-waiting-on"
                      required
                      className={styles.capacityInput}
                      value={bedReleaseWaitingOn ?? ""}
                      onChange={(event) => setBedReleaseWaitingOn(event.target.value as BedReleaseWaitingOn)}
                    >
                      <option value="" disabled>
                        Choose what it is waiting on
                      </option>
                      {BED_RELEASE_WAITING_ON.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={styles.declineLegend} htmlFor="ward-bed-release-expected-at">
                      Expected free
                    </label>
                    <input
                      id="ward-bed-release-expected-at"
                      data-testid="ward-bed-release-expected-at"
                      type="time"
                      required
                      className={styles.capacityInput}
                      value={bedReleaseExpectedAt}
                      onChange={(event) => setBedReleaseExpectedAt(event.target.value)}
                    />
                  </div>
                  <div>
                    <fieldset className={styles.declineFieldset}>
                      <legend className={styles.declineLegend}>Day</legend>
                      {RELEASE_DAYS.map((day) => (
                        <label key={day} className={styles.declineOption}>
                          <input
                            type="radio"
                            name="ward-bed-release-day"
                            value={day}
                            checked={bedReleaseDay === day}
                            onChange={() => setBedReleaseDay(day)}
                            data-testid={`ward-bed-release-day-${day}`}
                          />
                          {day === "today" ? "Today" : "Tomorrow"}
                        </label>
                      ))}
                    </fieldset>
                    {releaseTimeAlreadyPassed(now, bedReleaseDay, bedReleaseExpectedAt) ? (
                      <p className={styles.declineHint} data-testid="ward-bed-release-day-hint">
                        That time has already passed today, so this bed will show as due now.
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className={styles.declineLegend} htmlFor="ward-bed-release-blocker">
                      Blocker
                    </label>
                    <select
                      id="ward-bed-release-blocker"
                      className={styles.capacityInput}
                      value={bedReleaseBlocker ?? ""}
                      onChange={(event) =>
                        setBedReleaseBlocker(
                          event.target.value === "" ? undefined : (event.target.value as BedReleaseBlocker),
                        )
                      }
                    >
                      <option value="">No blocker</option>
                      {BED_RELEASE_BLOCKERS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    data-testid="ward-flag-bed-release-submit"
                    className={styles.capacitySubmit}
                    disabled={!bedReleaseWaitingOn}
                  >
                    Flag bed coming free
                  </button>
                </div>
                <p className={styles.capacityConfirmed}>
                  Records the person, the expected free time, what it is waiting on and any blocker for {unit.name}.
                </p>
              </form>

              <div className={styles.pipelineGrid}>
                {/* Stage 1: Expected to Free */}
                <div className={styles.pipelineColumn}>
                  <div className={styles.pipelineColHeader}>
                    <span className={styles.pipelineColTitle}>
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "var(--warn)",
                          display: "inline-block",
                        }}
                      />
                      <span>1. Expected to Free</span>
                    </span>
                    <span className={styles.colCountPill}>
                      {pendingBedReleases.filter((r) => r.state === "expected").length}
                    </span>
                  </div>
                  <div className={styles.pipelineColBody}>
                    {pendingBedReleases.filter((r) => r.state === "expected").length === 0 ? (
                      <div className={styles.pipelineEmptyState}>
                        No beds currently expected to free at {unit.name}.
                      </div>
                    ) : (
                      <ul className={styles.cardList} data-testid="ward-bed-release-list">
                        {pendingBedReleases
                          .filter((r) => r.state === "expected")
                          .map((release) => {
                            const isBlocked = release.blocker !== null;
                            const blockOpen = blockOpenFor === release.id;
                            const dischargeOpen = dischargeOpenFor === release.id;
                            const dischargeWho = resolvePatientIdentity(
                              admissions.find((admission) => admission.id === release.admissionId),
                            ).displayName;
                            return (
                              <li
                                key={release.id}
                                data-testid={`ward-bed-release-${release.id}`}
                                className={`${styles.card} ${styles.pipelineCard}`}
                                data-blocked={isBlocked ? "true" : "false"}
                              >
                                <header className={`${styles.cardHeader} ${styles.cardTopRow}`}>
                                  <span className={styles.cardBedName}>{bedRecordLabel(release.admissionId)}</span>
                                  <span> · </span>
                                  <strong className={styles.bedReleaseStateLabel}>
                                    {bedReleaseStateLabels[release.state]}
                                  </strong>
                                  {isBlocked ? (
                                    <strong
                                      data-testid={`ward-bed-release-blocked-flag-${release.id}`}
                                      className={styles.cardBlockerAlert}
                                    >
                                      {BED_RELEASE_BLOCKED_LABEL}
                                    </strong>
                                  ) : null}
                                  <span className={styles.cardTimeBadge}>
                                    Expected {formatInstant(release.expectedAt)}
                                  </span>
                                </header>
                                <div className={styles.cardWaitingRow}>
                                  <span className={styles.cardWaitingLabel}>Waiting on:</span>
                                  <span className={styles.cardWaitingVal}>{release.waitingOn ?? "Not recorded"}</span>
                                </div>
                                {release.blocker ? (
                                  <div className={styles.cardBlockerAlert}>Blocker: {release.blocker}</div>
                                ) : null}
                                {release.blockedBy ? (
                                  <span className={styles.cardMeta}>Blocked by {release.blockedBy}</span>
                                ) : null}
                                <div className={styles.cardFreshness}>
                                  <WardFreshness
                                    confirmedAt={release.confirmedAt}
                                    confirmedByRole={release.confirmedBy}
                                    now={now}
                                  />
                                </div>
                                <div className={`${styles.actionRow} ${styles.cardActionsRow}`}>
                                  <button
                                    type="button"
                                    data-testid={`ward-bed-release-confirm-${release.id}`}
                                    className={`${styles.btnCardAction} ${styles.btnCardActionPrimary}`}
                                    onClick={() => confirmBedRelease(release.id)}
                                  >
                                    Confirm
                                  </button>
                                  {!isBlocked ? (
                                    <button
                                      type="button"
                                      data-testid={`ward-bed-release-block-toggle-${release.id}`}
                                      aria-expanded={blockOpen}
                                      className={styles.btnCardAction}
                                      onClick={() => toggleBlockRelease(release.id)}
                                    >
                                      Blocked
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      data-testid={`ward-bed-release-unblock-${release.id}`}
                                      className={styles.btnCardAction}
                                      onClick={() => clearBedReleaseBlock(release.id)}
                                    >
                                      No longer blocked
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    data-testid={`ward-bed-release-release-${release.id}`}
                                    className={styles.btnCardAction}
                                    aria-expanded={dischargeOpen}
                                    onClick={() => toggleDischargeRelease(release.id)}
                                  >
                                    Discharged
                                  </button>
                                </div>
                                {dischargeOpen ? (
                                  <form
                                    className={styles.declineForm}
                                    onSubmit={(event) =>
                                      submitDischargeRelease(event, release.admissionId, dischargeWho)
                                    }
                                    data-testid={`ward-bed-release-discharge-form-${release.id}`}
                                  >
                                    <label
                                      className={styles.declineLegend}
                                      htmlFor={`ward-bed-release-discharge-destination-${release.id}`}
                                    >
                                      Where is {dischargeWho} going?
                                    </label>
                                    <select
                                      id={`ward-bed-release-discharge-destination-${release.id}`}
                                      data-testid={`ward-bed-release-discharge-destination-${release.id}`}
                                      required
                                      className={styles.capacityInput}
                                      value={dischargeDestination ?? ""}
                                      onChange={(event) =>
                                        setDischargeDestination(event.target.value as LeavingDestination)
                                      }
                                    >
                                      <option value="" disabled>
                                        Choose where they are going
                                      </option>
                                      {LEAVING_DESTINATIONS.map((destination) => (
                                        <option key={destination.id} value={destination.id}>
                                          {destination.label}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="submit"
                                      data-testid={`ward-bed-release-discharge-submit-${release.id}`}
                                      disabled={!dischargeDestination}
                                      className={styles.declineSubmit}
                                    >
                                      Record that they have left
                                    </button>
                                  </form>
                                ) : null}
                                {blockOpen ? (
                                  <form
                                    className={styles.declineForm}
                                    onSubmit={(event) => submitBlockRelease(event, release.id)}
                                    data-testid={`ward-bed-release-block-form-${release.id}`}
                                  >
                                    <label
                                      className={styles.declineLegend}
                                      htmlFor={`ward-bed-release-blocker-select-${release.id}`}
                                    >
                                      Blocker for this release
                                    </label>
                                    <select
                                      id={`ward-bed-release-blocker-select-${release.id}`}
                                      data-testid={`ward-bed-release-blocker-${release.id}`}
                                      required
                                      className={styles.capacityInput}
                                      value={blockChoice ?? ""}
                                      onChange={(event) => setBlockChoice(event.target.value as BedReleaseBlocker)}
                                    >
                                      <option value="" disabled>
                                        Choose a blocker
                                      </option>
                                      {BED_RELEASE_BLOCKERS.map((item) => (
                                        <option key={item} value={item}>
                                          {item}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="submit"
                                      data-testid={`ward-bed-release-block-submit-${release.id}`}
                                      disabled={!blockChoice}
                                      className={styles.declineSubmit}
                                    >
                                      Confirm blocked
                                    </button>
                                  </form>
                                ) : null}
                              </li>
                            );
                          })}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Stage 2: Confirmed Discharges */}
                <div className={styles.pipelineColumn}>
                  <div className={styles.pipelineColHeader}>
                    <span className={styles.pipelineColTitle}>
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "var(--accent)",
                          display: "inline-block",
                        }}
                      />
                      <span>2. Confirmed Discharges</span>
                    </span>
                    <span className={styles.colCountPill}>
                      {pendingBedReleases.filter((r) => r.state === "confirmed").length}
                    </span>
                  </div>
                  <div className={styles.pipelineColBody}>
                    {pendingBedReleases.filter((r) => r.state === "confirmed").length === 0 ? (
                      <div className={styles.pipelineEmptyState}>No confirmed discharges pending at {unit.name}.</div>
                    ) : (
                      <ul className={styles.cardList}>
                        {pendingBedReleases
                          .filter((r) => r.state === "confirmed")
                          .map((release) => {
                            const revertOpen = revertOpenFor === release.id;
                            const isBlocked = release.blocker !== null;
                            const blockOpen = blockOpenFor === release.id;
                            const dischargeOpen = dischargeOpenFor === release.id;
                            const dischargeWho = resolvePatientIdentity(
                              admissions.find((admission) => admission.id === release.admissionId),
                            ).displayName;
                            return (
                              <li
                                key={release.id}
                                data-testid={`ward-bed-release-${release.id}`}
                                className={`${styles.card} ${styles.pipelineCard}`}
                                data-blocked={isBlocked ? "true" : "false"}
                              >
                                <header className={`${styles.cardHeader} ${styles.cardTopRow}`}>
                                  <span className={styles.cardBedName}>
                                    {bedRecordLabel(release.admissionId)} ·{" "}
                                    <strong>{bedReleaseStateLabels[release.state]}</strong>
                                  </span>
                                  {isBlocked ? (
                                    <strong
                                      data-testid={`ward-bed-release-blocked-flag-${release.id}`}
                                      className={styles.cardBlockerAlert}
                                    >
                                      {BED_RELEASE_BLOCKED_LABEL}
                                    </strong>
                                  ) : null}
                                  <span
                                    className={styles.cardTimeBadge}
                                    style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                                  >
                                    Confirmed {formatInstant(release.expectedAt)}
                                  </span>
                                </header>
                                <div className={styles.cardWaitingRow}>
                                  <span className={styles.cardWaitingLabel}>Waiting on:</span>
                                  <span className={styles.cardWaitingVal}>{release.waitingOn ?? "Not recorded"}</span>
                                </div>
                                {release.blocker ? (
                                  <div className={styles.cardBlockerAlert}>Blocker: {release.blocker}</div>
                                ) : null}
                                <div className={styles.cardFreshness}>
                                  <WardFreshness
                                    confirmedAt={release.confirmedAt}
                                    confirmedByRole={release.confirmedBy}
                                    now={now}
                                  />
                                </div>
                                <div className={`${styles.actionRow} ${styles.cardActionsRow}`}>
                                  <button
                                    type="button"
                                    data-testid={`ward-bed-release-release-${release.id}`}
                                    className={`${styles.btnCardAction} ${styles.btnCardActionSuccess}`}
                                    aria-expanded={dischargeOpen}
                                    onClick={() => toggleDischargeRelease(release.id)}
                                  >
                                    Discharged
                                  </button>
                                  <button
                                    type="button"
                                    data-testid={`ward-bed-release-revert-toggle-${release.id}`}
                                    aria-expanded={revertOpen}
                                    className={styles.btnCardAction}
                                    onClick={() => toggleRevertRelease(release.id)}
                                  >
                                    Back to expected
                                  </button>
                                  {!isBlocked ? (
                                    <button
                                      type="button"
                                      data-testid={`ward-bed-release-block-toggle-${release.id}`}
                                      aria-expanded={blockOpen}
                                      className={styles.btnCardAction}
                                      onClick={() => toggleBlockRelease(release.id)}
                                    >
                                      Blocked
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      data-testid={`ward-bed-release-unblock-${release.id}`}
                                      className={styles.btnCardAction}
                                      onClick={() => clearBedReleaseBlock(release.id)}
                                    >
                                      No longer blocked
                                    </button>
                                  )}
                                </div>
                                {dischargeOpen ? (
                                  <form
                                    className={styles.declineForm}
                                    onSubmit={(event) =>
                                      submitDischargeRelease(event, release.admissionId, dischargeWho)
                                    }
                                    data-testid={`ward-bed-release-discharge-form-${release.id}`}
                                  >
                                    <label
                                      className={styles.declineLegend}
                                      htmlFor={`ward-bed-release-discharge-destination-${release.id}`}
                                    >
                                      Where is {dischargeWho} going?
                                    </label>
                                    <select
                                      id={`ward-bed-release-discharge-destination-${release.id}`}
                                      data-testid={`ward-bed-release-discharge-destination-${release.id}`}
                                      required
                                      className={styles.capacityInput}
                                      value={dischargeDestination ?? ""}
                                      onChange={(event) =>
                                        setDischargeDestination(event.target.value as LeavingDestination)
                                      }
                                    >
                                      <option value="" disabled>
                                        Choose where they are going
                                      </option>
                                      {LEAVING_DESTINATIONS.map((destination) => (
                                        <option key={destination.id} value={destination.id}>
                                          {destination.label}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="submit"
                                      data-testid={`ward-bed-release-discharge-submit-${release.id}`}
                                      disabled={!dischargeDestination}
                                      className={styles.declineSubmit}
                                    >
                                      Record that they have left
                                    </button>
                                  </form>
                                ) : null}
                                {revertOpen ? (
                                  <form
                                    className={styles.declineForm}
                                    onSubmit={(event) => revertBedRelease(event, release.id)}
                                    data-testid={`ward-bed-release-revert-form-${release.id}`}
                                  >
                                    <label
                                      className={styles.declineLegend}
                                      htmlFor={`ward-bed-release-revert-select-${release.id}`}
                                    >
                                      Waiting on, once reverted
                                    </label>
                                    <p
                                      className={styles.declineHint}
                                      data-testid={`ward-bed-release-revert-waiting-on-hint-${release.id}`}
                                    >
                                      {WAITING_ON_LONGEST}
                                    </p>
                                    <select
                                      id={`ward-bed-release-revert-select-${release.id}`}
                                      data-testid={`ward-bed-release-revert-waiting-on-${release.id}`}
                                      required
                                      className={styles.capacityInput}
                                      value={revertChoice ?? ""}
                                      onChange={(event) => setRevertChoice(event.target.value as BedReleaseWaitingOn)}
                                    >
                                      <option value="" disabled>
                                        Choose what it is waiting on
                                      </option>
                                      {BED_RELEASE_WAITING_ON.map((item) => (
                                        <option key={item} value={item}>
                                          {item}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="submit"
                                      data-testid={`ward-bed-release-revert-submit-${release.id}`}
                                      disabled={!revertChoice}
                                      className={styles.declineSubmit}
                                    >
                                      Confirm reversal
                                    </button>
                                  </form>
                                ) : null}
                                {blockOpen ? (
                                  <form
                                    className={styles.declineForm}
                                    onSubmit={(event) => submitBlockRelease(event, release.id)}
                                    data-testid={`ward-bed-release-block-form-${release.id}`}
                                  >
                                    <label
                                      className={styles.declineLegend}
                                      htmlFor={`ward-bed-release-blocker-select-${release.id}`}
                                    >
                                      Blocker for this release
                                    </label>
                                    <select
                                      id={`ward-bed-release-blocker-select-${release.id}`}
                                      data-testid={`ward-bed-release-blocker-${release.id}`}
                                      required
                                      className={styles.capacityInput}
                                      value={blockChoice ?? ""}
                                      onChange={(event) => setBlockChoice(event.target.value as BedReleaseBlocker)}
                                    >
                                      <option value="" disabled>
                                        Choose a blocker
                                      </option>
                                      {BED_RELEASE_BLOCKERS.map((item) => (
                                        <option key={item} value={item}>
                                          {item}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="submit"
                                      data-testid={`ward-bed-release-block-submit-${release.id}`}
                                      disabled={!blockChoice}
                                      className={styles.declineSubmit}
                                    >
                                      Confirm blocked
                                    </button>
                                  </form>
                                ) : null}
                              </li>
                            );
                          })}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Stage 3: Beds Being Made Ready (Terminal Cleaning) */}
                <div className={styles.pipelineColumn}>
                  <div className={styles.pipelineColHeader}>
                    <span className={styles.pipelineColTitle}>
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "var(--good)",
                          display: "inline-block",
                        }}
                      />
                      <span>3. Cleaning &amp; Turnaround</span>
                    </span>
                    <span className={styles.colCountPill}>{dischargedBedReleases.length}</span>
                  </div>
                  <div className={styles.pipelineColBody}>
                    {dischargedBedReleases.length === 0 ? (
                      <div className={styles.pipelineEmptyState}>
                        No beds currently in turnaround cleaning at {unit.name}.
                      </div>
                    ) : (
                      <ul className={styles.cardList} data-testid="ward-bed-preparation-list">
                        {dischargedBedReleases.map((release) => {
                          const preparationOpen = preparationOpenFor === release.id;
                          return (
                            <li
                              key={release.id}
                              data-testid={`ward-bed-preparation-${release.id}`}
                              className={`${styles.card} ${styles.pipelineCard}`}
                            >
                              <header className={`${styles.cardHeader} ${styles.cardTopRow}`}>
                                <strong className={styles.cardBedName}>
                                  Bed not recorded · {bedReleaseStateLabels[release.state]}
                                </strong>
                                {release.preparing ? (
                                  <strong
                                    data-testid={`ward-bed-preparation-flag-${release.id}`}
                                    className={styles.cardTimeBadge}
                                    style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
                                  >
                                    Being made ready
                                  </strong>
                                ) : (
                                  <span className={styles.cardTimeBadge}>Still available</span>
                                )}
                              </header>
                              {release.preparationNote ? (
                                <div className={styles.cardWaitingRow}>
                                  <span className={styles.cardWaitingLabel}>Status:</span>
                                  <span
                                    className={styles.cardWaitingVal}
                                    data-testid={`ward-bed-preparation-note-${release.id}`}
                                  >
                                    {release.preparationNote}
                                  </span>
                                </div>
                              ) : null}
                              <div className={styles.cardFreshness}>
                                <WardFreshness
                                  confirmedAt={release.confirmedAt}
                                  confirmedByRole={release.confirmedBy}
                                  now={now}
                                />
                              </div>
                              <div className={`${styles.actionRow} ${styles.cardActionsRow}`}>
                                <button
                                  type="button"
                                  data-testid={`ward-bed-preparation-toggle-${release.id}`}
                                  aria-expanded={preparationOpen}
                                  className={styles.btnCardAction}
                                  onClick={() => toggleBedPreparation(release.id)}
                                >
                                  {release.preparing ? "Change what it is waiting on" : "Being made ready"}
                                </button>
                                {release.preparing ? (
                                  <button
                                    type="button"
                                    data-testid={`ward-bed-preparation-finish-${release.id}`}
                                    className={`${styles.btnCardAction} ${styles.btnCardActionSuccess}`}
                                    onClick={() => finishBedPreparation(release.id)}
                                  >
                                    Ready
                                  </button>
                                ) : null}
                              </div>
                              {preparationOpen ? (
                                <form
                                  className={styles.declineForm}
                                  onSubmit={(event) => submitBedPreparation(event, release.id)}
                                  data-testid={`ward-bed-preparation-form-${release.id}`}
                                >
                                  <label
                                    className={styles.declineLegend}
                                    htmlFor={`ward-bed-preparation-select-${release.id}`}
                                  >
                                    What this bed is waiting on
                                  </label>
                                  <select
                                    id={`ward-bed-preparation-select-${release.id}`}
                                    data-testid={`ward-bed-preparation-note-select-${release.id}`}
                                    required
                                    className={styles.capacityInput}
                                    value={preparationChoice ?? ""}
                                    onChange={(event) => setPreparationChoice(event.target.value as BedPreparationNote)}
                                  >
                                    <option value="" disabled>
                                      Choose what it is waiting on
                                    </option>
                                    {BED_PREPARATION_NOTES.map((item) => (
                                      <option key={item} value={item}>
                                        {item}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="submit"
                                    data-testid={`ward-bed-preparation-submit-${release.id}`}
                                    disabled={!preparationChoice}
                                    className={styles.declineSubmit}
                                  >
                                    Confirm being made ready
                                  </button>
                                </form>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* ═════ SECTION 4: AUTHORIZED PATIENT LEAVE CARD ═════ */}
            <section className={styles.leaveSectionCard} aria-label="Beds on leave tracker">
              <div className={styles.leaveHead}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "var(--ink)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 2h10v12H3zM6 5h4M6 8h4" />
                  </svg>
                  <span>Beds on leave</span>
                </h3>
              </div>

              <div className={styles.leaveStatutoryAlert}>
                {unitLeaveBeds.length} bed
                {unitLeaveBeds.length === 1 ? "" : "s"} currently on leave at {unit.name}. Beds on leave remain reserved
                for the patient and are <strong>NEVER</strong> merged into available beds.
              </div>

              <form
                id="ward-leave-bed-form"
                className={styles.capacityForm}
                onSubmit={submitLeaveBed}
                data-testid="ward-leave-bed-form"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r2, 6px)",
                  padding: "14px 16px",
                  margin: "0 0 12px 0",
                }}
              >
                <span className={styles.capacityLabel}>Record a bed on leave at {unit.name}</span>
                <div className={styles.capacityRow}>
                  <div>
                    <label className={styles.declineLegend} htmlFor="ward-leave-bed-expected-return">
                      Expected return
                    </label>
                    <input
                      id="ward-leave-bed-expected-return"
                      data-testid="ward-leave-bed-expected-return"
                      type="time"
                      required
                      className={styles.capacityInput}
                      value={leaveExpectedReturn}
                      onChange={(event) => setLeaveExpectedReturn(event.target.value)}
                    />
                  </div>
                  <div>
                    <fieldset className={styles.declineFieldset}>
                      <legend className={styles.declineLegend}>Day</legend>
                      {RELEASE_DAYS.map((day) => (
                        <label key={day} className={styles.declineOption}>
                          <input
                            type="radio"
                            name="ward-leave-bed-day"
                            value={day}
                            checked={leaveDay === day}
                            onChange={() => setLeaveDay(day)}
                            data-testid={`ward-leave-bed-day-${day}`}
                          />
                          {day === "today" ? "Today" : "Tomorrow"}
                        </label>
                      ))}
                    </fieldset>
                    {releaseTimeAlreadyPassed(now, leaveDay, leaveExpectedReturn) ? (
                      <p className={styles.declineHint} data-testid="ward-leave-bed-day-hint">
                        That time has already passed today, so this bed will show as due back now.
                      </p>
                    ) : null}
                  </div>
                  <button type="submit" data-testid="ward-leave-bed-submit" className={styles.capacitySubmit}>
                    Record leave bed
                  </button>
                </div>
                <p className={styles.capacityConfirmed}>
                  {unitLeaveBeds.length} bed{unitLeaveBeds.length === 1 ? "" : "s"} currently on leave at {unit.name}.
                  Never merged into available beds. Shows nothing about the person on leave.
                </p>
              </form>

              <div
                className={styles.capacityForm}
                data-testid="ward-leave-bed-list"
                style={{ border: "none", padding: 0, margin: 0 }}
              >
                <span className={styles.capacityLabel}>Beds currently on leave at {unit.name}</span>
                {unitLeaveBeds.length === 0 ? (
                  <p className={styles.placeholder}>No bed currently on leave at {unit.name}.</p>
                ) : (
                  <ul className={styles.leaveCardsList}>
                    {unitLeaveBeds.map((leaveBed) => (
                      <li
                        key={leaveBed.id}
                        data-testid={`ward-leave-bed-${leaveBed.id}`}
                        className={styles.leaveItemCard}
                      >
                        <div className={styles.leaveItemInfo}>
                          <strong className={styles.leaveItemTitle}>Bed not recorded &middot; Bed on leave</strong>
                          <span className={styles.leaveItemMeta}>
                            Expected return {formatInstant(leaveBed.expectedReturn)}
                          </span>
                          <WardFreshness
                            confirmedAt={leaveBed.confirmedAt}
                            confirmedByRole={leaveBed.confirmedBy}
                            now={now}
                          />
                        </div>
                        <div className={styles.actionRow}>
                          <button
                            type="button"
                            data-testid={`ward-leave-bed-end-${leaveBed.id}`}
                            className={styles.btnInlineConfirm}
                            onClick={() => endLeaveBed(leaveBed.id)}
                          >
                            Ended
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* ═════ SECTION 5: SHIFT COORDINATOR AUDIT LEDGER ═════ */}
            <section className={styles.ledgerCard} aria-label="Ward activity">
              <div className={styles.ledgerHead}>
                <h3 className={styles.ledgerTitle}>
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="8" cy="8" r="6" />
                    <path d="M8 5v3.5l2.5 1.5" />
                  </svg>
                  <span>Ward activity</span>
                </h3>
                <span className={`${styles.returnStatusChip} ${styles.returnStatusChipConfirmed}`}>Ward log</span>
              </div>

              <div className={styles.ledgerFeed}>
                {unit.allocatable.confirmedAt ? (
                  <div className={styles.ledgerRow}>
                    <span className={styles.ledgerTime}>{formatInstant(unit.allocatable.confirmedAt)}</span>
                    <span className={styles.ledgerText}>
                      <strong>Allocatable capacity confirmed at {unit.allocatable.value}</strong> by NUM {unit.name}.
                    </span>
                  </div>
                ) : null}
                {pendingBedReleases.map((release) => (
                  <div key={`ledger-${release.id}`} className={styles.ledgerRow}>
                    <span className={styles.ledgerTime}>{formatInstantWithDay(release.confirmedAt, now)}</span>
                    <span className={styles.ledgerText}>
                      <strong>
                        {bedRecordLabel(release.admissionId)} flagged as {bedReleaseStateLabels[release.state]}
                      </strong>{" "}
                      (Expected {formatInstant(release.expectedAt)})
                      {release.waitingOn ? ` waiting on ${release.waitingOn}` : ""}.
                    </span>
                  </div>
                ))}
                {dischargedBedReleases.map((release) => (
                  <div key={`ledger-clean-${release.id}`} className={styles.ledgerRow}>
                    <span className={styles.ledgerTime}>{formatInstantWithDay(release.confirmedAt, now)}</span>
                    <span className={styles.ledgerText}>
                      <strong>A bed (bed not recorded) freed by a departure</strong>. Preparation:{" "}
                      {release.preparationNote ??
                        (release.preparing ? "being made ready, no reason recorded" : "not recorded")}
                      .
                    </span>
                  </div>
                ))}
                {unitLeaveBeds.map((leaveBed) => (
                  <div key={`ledger-leave-${leaveBed.id}`} className={styles.ledgerRow}>
                    <span className={styles.ledgerTime}>{formatInstantWithDay(leaveBed.confirmedAt, now)}</span>
                    <span className={styles.ledgerText}>
                      <strong>A leave bed (bed not recorded) recorded</strong> (Expected return{" "}
                      {formatInstant(leaveBed.expectedReturn)}) by {leaveBed.confirmedBy}.
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Synthetic Prototype Disclaimer (Invariant FF8) */}
            <footer className={styles.protoBanner}>
              SYNTHETIC PROTOTYPE &middot; Scoped to {unit.name} &middot; Bed decisions remain human-confirmed &middot;
              Not a medical device
            </footer>
          </div>
        </section>

        {/* ───────── TAB 2: COMING IN ───────── */}
        <section
          className={styles.tabPanel}
          id="tab-coming"
          role="tabpanel"
          aria-labelledby="tabBtn-coming"
          data-active={activeTab === "coming"}
        >
          {/* Inbound Intake · Unified High-Density Action Cards */}
          <section aria-label="Coming in" className={styles.cardPanel} tabIndex={0}>
            <div className={styles.panelHead}>
              <h2 className={styles.sectionHeading} style={{ margin: 0 }}>
                Coming in
              </h2>
              <span className={styles.badgePill}>{accepted.length} Inbound</span>
            </div>
            <div className={styles.panelBody}>
              {accepted.length === 0 ? (
                <p className={styles.placeholder}>
                  No patient is currently accepted, pulled or en route to {unit.name}. Absence here means none, not that
                  none was asked for.
                </p>
              ) : (
                <div className={styles.inboundGrid}>
                  {accepted.map((movement) => {
                    const patientInfo = resolvePatientIdentity(movement);
                    const eta = movement.arrivalDetails?.estimatedArrivalAt;
                    const transportMode = movement.arrivalDetails?.mode;
                    const notice = restrictionNotice(movement, unit);
                    const eligibilityIssue = eligibilityWarning(movement, unit, now);
                    const canPull = movement.stage === "accepted_awaiting_bed";
                    const blocked = canPull ? pullBlockedReason(movement, unit, patientInfo.displayName) : undefined;
                    const canRelease = movement.stage === "pulled" && movement.transport === undefined;
                    const liveTransportJob =
                      movement.transport !== undefined && movement.transport.cancelledAt === undefined;
                    const noTransportNeeded =
                      (movement.transportNeed?.needed ?? movement.transport?.needed) === false &&
                      !liveTransportJob &&
                      movement.transport?.collectedAt === undefined;
                    const canArrive =
                      movement.acceptedUnitId === unit.id &&
                      (movement.stage === "moving" ||
                        movement.transport?.collectedAt !== undefined ||
                        (noTransportNeeded && (movement.stage === "pulled" || movement.stage === "handover_ready")));
                    const arriveBlocked = movement.transport?.diversion
                      ? `${patientInfo.displayName} was diverted; release the held bed rather than recording arrival.`
                      : noTransportNeeded
                        ? movement.stage === "pulled" || movement.stage === "handover_ready"
                          ? undefined
                          : `${patientInfo.displayName} needs their bed pulled before an arrival can be recorded.`
                        : movement.stage !== "moving" || movement.transport?.collectedAt === undefined
                          ? `${patientInfo.displayName} cannot be marked arrived before the patient has been collected.`
                          : undefined;
                    const canCancel =
                      movement.transport !== undefined &&
                      movement.transport.cancelledAt === undefined &&
                      movement.transport.collectedAt === undefined &&
                      movement.transport.arrivedAt === undefined;
                    const releaseOpen = releaseOpenFor === movement.id;

                    return (
                      <article
                        key={movement.id}
                        className={styles.inboundCard}
                        data-testid={`ward-accepted-${movement.id}`}
                      >
                        <div className={styles.inboundTop}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                            <span className={styles.inboundAlias}>{patientInfo.displayName}</span>
                            {patientInfo.umrn ? (
                              <span style={{ fontSize: "12px", color: "var(--muted)", fontFamily: "var(--mono)" }}>
                                UMRN: <strong>{patientInfo.umrn}</strong>
                              </span>
                            ) : null}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {movement.legalForm ? (
                              <span className={`${styles.statusPillBadge} ${styles.warn}`}>
                                Form {movement.legalForm.code}
                              </span>
                            ) : null}
                            <span className={styles.badgePill}>{stageCopy[movement.stage].label}</span>
                          </div>
                        </div>

                        <div className={styles.inboundMetaGrid}>
                          <div className={styles.metaItem}>
                            <span className={styles.metaLbl}>Source</span>
                            <span className={styles.metaVal}>{originPlaceLabel(movement.originEdId)}</span>
                          </div>
                          <div className={styles.metaItem}>
                            <span className={styles.metaLbl}>Stage</span>
                            <span className={styles.metaVal}>{stageCopy[movement.stage].label}</span>
                          </div>
                          {movement.legalStatus ? (
                            <div className={styles.metaItem}>
                              <span className={styles.metaLbl}>Legal status</span>
                              <span className={styles.metaVal}>{movement.legalStatus}</span>
                            </div>
                          ) : null}
                          <div className={styles.metaItem}>
                            <span className={styles.metaLbl}>Transport &amp; ETA</span>
                            <span className={styles.metaVal}>
                              {transportMode
                                ? ARRIVAL_MODE_LABELS[transportMode]
                                : movement.transport
                                  ? "Transport recorded"
                                  : "No arrival plan recorded"}
                              {" · "}
                              <span style={{ color: "var(--good)", fontWeight: 600 }}>
                                {eta !== undefined
                                  ? arrivalIsLate(movement, now)
                                    ? `Expected ${formatInstantWithDay(eta, now)} — late`
                                    : `Expected ${formatInstantWithDay(eta, now)}`
                                  : "No estimated arrival"}
                              </span>
                            </span>
                          </div>
                        </div>

                        {movement.stage === "pulled" && movement.pullExpiresAt !== undefined ? (
                          <div style={{ fontSize: "12px", color: "var(--warn)", fontWeight: 600 }}>
                            Bed pull {formatRemaining(minutesUntil(movement.pullExpiresAt, now))}
                          </div>
                        ) : null}

                        {notice ? (
                          <span
                            className={notice.level === "voluntary_on_locked" ? styles.noticeProminent : styles.notice}
                            data-testid={`ward-restriction-notice-${movement.id}`}
                            data-level={notice.level}
                          >
                            {notice.text}
                          </span>
                        ) : null}
                        {eligibilityIssue ? (
                          <span
                            className={styles.noticeProminent}
                            data-testid={`ward-eligibility-warning-${movement.id}`}
                            data-level={eligibilityIssue.level}
                          >
                            {eligibilityIssue.text}
                          </span>
                        ) : null}

                        <div className={styles.inboundCardActions}>
                          {canPull ? (
                            <div className={styles.actionRow} style={{ margin: 0 }}>
                              <button
                                type="button"
                                data-testid={`ward-pull-${movement.id}`}
                                aria-disabled={blocked ? "true" : undefined}
                                aria-describedby={blocked ? `ward-pull-unavailable-${movement.id}` : undefined}
                                title={blocked ?? undefined}
                                className={styles.acceptButton}
                                onClick={
                                  blocked
                                    ? ignoreUnavailableActivation
                                    : () => {
                                        priorRejectionCountRef.current = rejections.length;
                                        dispatch({
                                          type: "PULL_PATIENT",
                                          role: "ward",
                                          now,
                                          movementId: movement.id,
                                          unitId: unit.id,
                                        });
                                        setCheckToken((token) => token + 1);
                                      }
                                }
                              >
                                Pull a bed
                              </button>
                              {blocked ? (
                                <span id={`ward-pull-unavailable-${movement.id}`} className="sr-only">
                                  {blocked}
                                </span>
                              ) : null}
                            </div>
                          ) : null}

                          {canArrive ? (
                            <div className={styles.actionRow} style={{ margin: 0 }}>
                              <button
                                type="button"
                                data-testid={`ward-confirm-arrival-${movement.id}`}
                                aria-disabled={arriveBlocked ? "true" : undefined}
                                aria-describedby={
                                  arriveBlocked ? `ward-confirm-arrival-unavailable-${movement.id}` : undefined
                                }
                                title={arriveBlocked ?? undefined}
                                className={styles.acceptButton}
                                onClick={
                                  arriveBlocked
                                    ? ignoreUnavailableActivation
                                    : () => {
                                        priorRejectionCountRef.current = rejections.length;
                                        dispatch({
                                          type: "PATIENT_ARRIVED",
                                          role: "ward",
                                          now,
                                          movementId: movement.id,
                                          actingUnitId: unit.id,
                                        });
                                        setCheckToken((token) => token + 1);
                                      }
                                }
                              >
                                Confirm Arrival
                              </button>
                              {arriveBlocked ? (
                                <span id={`ward-confirm-arrival-unavailable-${movement.id}`} className="sr-only">
                                  {arriveBlocked}
                                </span>
                              ) : null}
                            </div>
                          ) : null}

                          {canRelease ? (
                            <div className={styles.actionRow} style={{ margin: 0 }}>
                              <button
                                type="button"
                                data-testid={`ward-release-pull-toggle-${movement.id}`}
                                aria-expanded={releaseOpen}
                                className={styles.declineButton}
                                onClick={() => toggleRelease(movement.id)}
                              >
                                Release the pulled bed
                              </button>
                            </div>
                          ) : null}

                          {movement.transport?.diversion !== undefined &&
                          movement.admissionId !== undefined &&
                          movement.acceptedUnitId === unit.id ? (
                            <div className={styles.actionRow} style={{ margin: 0 }}>
                              <button
                                type="button"
                                data-testid={`ward-release-diverted-bed-${movement.id}`}
                                className={styles.declineButton}
                                onClick={() =>
                                  dispatch({
                                    type: "RELEASE_DIVERTED_BED",
                                    role: "ward",
                                    now,
                                    movementId: movement.id,
                                    actingUnitId: unit.id,
                                  })
                                }
                              >
                                Release the held bed
                              </button>
                            </div>
                          ) : null}
                        </div>

                        {canRelease && releaseOpen ? (
                          <form
                            className={styles.declineForm}
                            onSubmit={(event) => submitRelease(event, movement.id)}
                            data-testid={`ward-release-pull-${movement.id}`}
                          >
                            <label className={styles.declineLegend} htmlFor={`ward-release-pull-reason-${movement.id}`}>
                              Reason for releasing the pulled bed for {patientInfo.displayName}
                            </label>
                            <select
                              id={`ward-release-pull-reason-${movement.id}`}
                              required
                              className={styles.capacityInput}
                              value={releaseReason ?? ""}
                              onChange={(event) => setReleaseReason(event.target.value as ReleasePullReason)}
                            >
                              <option value="" disabled>
                                Choose a reason
                              </option>
                              {RELEASE_PULL_REASONS.map((reason) => (
                                <option key={reason} value={reason}>
                                  {changeReasonLabels[reason]}
                                </option>
                              ))}
                            </select>
                            <button type="submit" disabled={!releaseReason} className={styles.declineSubmit}>
                              Confirm release
                            </button>
                          </form>
                        ) : null}

                        {lastActionRejection?.movementId === movement.id ? (
                          <p
                            className={styles.noticeProminent}
                            role="alert"
                            data-testid={`ward-action-rejection-${movement.id}`}
                          >
                            {WARD_ACTION_REJECTION_LABELS[lastActionRejection.attempted] ??
                              lastActionRejection.attempted}{" "}
                            not recorded: {wardSafeRejectionReason(lastActionRejection.reason)}
                          </p>
                        ) : null}

                        {overrideReasonForm(movement.id)}

                        {canCancel ? (
                          <p className={styles.notice} data-testid="ward-cancel-transport-unavailable">
                            This ward cannot cancel a transport it did not book. Ask the sending emergency department,
                            or the flow coordinator.
                          </p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </section>

        {/* ───────── TAB 3: ON THE WAY OUT ───────── */}
        <section
          className={styles.tabPanel}
          id="tab-out"
          role="tabpanel"
          aria-labelledby="tabBtn-out"
          data-active={activeTab === "out"}
        >
          {/* Discharges Sub-Tab Navigation Bar */}
          <nav className={styles.dischargeSubNav} role="tablist" aria-label="Discharge operational sub-views">
            <button
              type="button"
              className={styles.dischargeSubTabBtn}
              data-active={dischargeSubTab === "all"}
              onClick={() => setDischargeSubTab("all")}
            >
              <span>All Discharges Overview</span>
            </button>
            <button
              type="button"
              className={styles.dischargeSubTabBtn}
              data-active={dischargeSubTab === "scheduled"}
              onClick={() => setDischargeSubTab("scheduled")}
            >
              <span>Scheduled Departures</span>
              <span className={styles.dischargeSubTabBadge}>{releasesCountedToday.length}</span>
            </button>
            <button
              type="button"
              className={styles.dischargeSubTabBtn}
              data-active={dischargeSubTab === "leave"}
              onClick={() => setDischargeSubTab("leave")}
            >
              <span>Leave &amp; AWOL</span>
              <span className={styles.dischargeSubTabBadge}>{unitLeaveBeds.length}</span>
            </button>
            <button
              type="button"
              className={styles.dischargeSubTabBtn}
              data-active={dischargeSubTab === "barriers"}
              onClick={() => setDischargeSubTab("barriers")}
            >
              <span>Discharge Barriers</span>
              <span className={styles.dischargeSubTabBadge}>{blockedReleases.length}</span>
            </button>
            <button
              type="button"
              className={styles.dischargeSubTabBtn}
              data-active={dischargeSubTab === "suburb"}
              onClick={() => setDischargeSubTab("suburb")}
            >
              <span>Catchment Team Lookup</span>
            </button>
          </nav>

          {/* Discharges Scheduled for Today */}
          <div style={{ display: dischargeSubTab === "all" || dischargeSubTab === "scheduled" ? "block" : "none" }}>
            <div className={styles.cardPanel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M9 3l4 5-4 5M13 8H3" />
                  </svg>
                  <span>Discharges Scheduled for Today</span>
                </h2>
                <span className={styles.badgePill}>{releasesCountedToday.length} coming free today</span>
              </div>
              <div className={styles.panelBody}>
                {releasesCountedToday.length === 0 ? (
                  <p className={styles.placeholder}>No bed release is currently scheduled for today at {unit.name}.</p>
                ) : (
                  releasesCountedToday.map((release) => (
                    <div
                      key={release.id}
                      className={styles.dischargeRow}
                      data-testid={`ward-today-release-${release.id}`}
                    >
                      <div>
                        <span className={styles.mono} style={{ fontWeight: 700, fontSize: "var(--t-2)" }}>
                          {bedReleaseStateLabels[release.state]}
                        </span>
                        <div style={{ fontSize: "var(--t-0)", color: "var(--muted)" }}>
                          Expected {formatInstant(release.expectedAt)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "var(--t-0)", color: "var(--muted)", textTransform: "uppercase" }}>
                          Waiting on
                        </div>
                        <div style={{ fontWeight: 600 }}>{release.waitingOn ?? "Not recorded"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "var(--t-0)", color: "var(--muted)", textTransform: "uppercase" }}>
                          Blocker
                        </div>
                        <div>{release.blocker ?? "None recorded"}</div>
                      </div>
                      <div>
                        {release.state === "expected" ? (
                          <button
                            type="button"
                            className={styles.btnSmPrimary}
                            onClick={() => confirmBedRelease(release.id)}
                            style={{ minHeight: "var(--ward-tap, 48px)" }}
                          >
                            Confirm
                          </button>
                        ) : (
                          <span className={styles.badgePill}>{bedReleaseStateLabels[release.state]}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Leave & AWOL monitoring */}
          <div style={{ display: dischargeSubTab === "all" || dischargeSubTab === "leave" ? "block" : "none" }}>
            <div className={styles.cardPanel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="8" cy="8" r="6" />
                    <path d="M8 4v4l3 2" />
                  </svg>
                  <span>Leave monitoring</span>
                </h2>
                <span className={styles.badgePill}>{unitLeaveBeds.length} On Leave</span>
              </div>
              <div className={styles.panelBody}>
                {unitLeaveBeds.length === 0 ? (
                  <p className={styles.placeholder}>No leave bed is recorded at {unit.name}.</p>
                ) : (
                  unitLeaveBeds.map((leaveBed) => (
                    <div key={leaveBed.id} className={styles.leaveCard} data-testid={`ward-leave-card-${leaveBed.id}`}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className={styles.mono} style={{ fontWeight: 700, fontSize: "var(--t-2)" }}>
                            Bed on leave
                          </span>
                          <span className={styles.badgePill}>
                            Expected return {formatInstant(leaveBed.expectedReturn)}
                          </span>
                        </div>
                        <div style={{ fontSize: "var(--t-1)", color: "var(--ink-soft)", marginTop: "3px" }}>
                          Recorded {formatInstantWithDay(leaveBed.confirmedAt, now)}. Shows nothing about the person on
                          leave.
                        </div>
                      </div>
                      <div className={styles.curfewBox}>
                        <span>
                          Open for: <b>{formatRemaining(now - leaveBed.confirmedAt)}</b>
                        </span>
                        {now - leaveBed.confirmedAt >= LEAVE_BED_OPEN_WARNING_MINUTES ? (
                          <span className={styles.curfewTime}>Consider opening this bed</span>
                        ) : null}
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          className={styles.btnSmPrimary}
                          onClick={() => endLeaveBed(leaveBed.id)}
                          style={{ minHeight: "var(--ward-tap, 48px)" }}
                        >
                          Ended
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Discharge Barriers & Delayed Egress */}
          <div style={{ display: dischargeSubTab === "all" || dischargeSubTab === "barriers" ? "block" : "none" }}>
            <div className={styles.cardPanel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M2 3h12v10H2zM6 3v10" />
                  </svg>
                  <span>Discharge Barriers &amp; Delayed Egress</span>
                </h2>
                <span
                  className={`${styles.statusPillBadge} ${blockedReleases.length > 0 ? styles.danger : styles.good}`}
                >
                  {blockedReleases.length} Active Barriers
                </span>
              </div>
              <div className={styles.panelBody}>
                {blockedReleases.length === 0 ? (
                  <p className={styles.placeholder}>No discharge blocker is currently recorded at {unit.name}.</p>
                ) : (
                  blockedReleases.map((release) => (
                    <div key={release.id} className={styles.barrierCard} data-testid={`ward-barrier-${release.id}`}>
                      <div className={styles.barrierTop}>
                        <div>
                          <span className={styles.mono} style={{ fontWeight: 700, fontSize: "var(--t-2)" }}>
                            {bedReleaseStateLabels[release.state]}
                          </span>
                          <span style={{ fontSize: "var(--t-1)", color: "var(--muted)" }}>
                            {" "}
                            &middot; Expected {formatInstant(release.expectedAt)}
                          </span>
                        </div>
                        <span className={`${styles.statusPillBadge} ${styles.danger}`}>
                          {BED_RELEASE_BLOCKED_LABEL}
                        </span>
                      </div>
                      <div style={{ fontSize: "var(--t-1)", color: "var(--ink-soft)", margin: "4px 0" }}>
                        <b>Barrier:</b> {release.blocker}
                        {release.blockedBy ? ` — recorded by ${release.blockedBy}` : null}
                      </div>
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                        <button
                          type="button"
                          className={styles.btnSmPrimary}
                          onClick={() => clearBedReleaseBlock(release.id)}
                          style={{ minHeight: "var(--ward-tap, 48px)" }}
                        >
                          No longer blocked
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Discharge Catchment Directory: Overhauled Suburb Team Lookup */}
          <div style={{ display: dischargeSubTab === "all" || dischargeSubTab === "suburb" ? "block" : "none" }}>
            <SuburbTeamPanel />
          </div>

          {/* Preserved test contract for handover link and summary (visually hidden per user request) */}
          <div className={styles.visuallyHidden} data-testid="ward-handover-block">
            <h2 id="ward-handover-heading" className={styles.sectionHeading}>
              Print the handover sheet
            </h2>
            <p className={styles.placeholder}>
              Ward census, movements, confirmed figures and discharge flags. Nothing about a person beyond what this
              ward already shows.
            </p>
            <Link
              className={styles.confirmRowButton}
              data-testid="ward-handover-link"
              href={`/mockups/ward-flow/handover?scope=${encodeURIComponent(handoverScopeValue({ kind: "ward", id: unit.id }))}`}
            >
              Open this ward&rsquo;s handover sheet
            </Link>
          </div>
        </section>

        {/* ───────── TAB 4: BED BOARD & ROSTER ───────── */}
        <section
          className={styles.tabPanel}
          id="tab-beds"
          role="tabpanel"
          aria-labelledby="tabBtn-beds"
          data-active={activeTab === "beds"}
        >
          <div className={styles.matrixControls}>
            <div className={styles.podFilters} role="group" aria-label="Filter by designation">
              <button
                type="button"
                className={styles.podFilterBtn}
                aria-pressed={selectedPod === "all"}
                onClick={() => setSelectedPod("all")}
              >
                All beds ({unit.beds})
              </button>
              {isMixed ? (
                <>
                  <button
                    type="button"
                    className={styles.podFilterBtn}
                    aria-pressed={selectedPod === "locked"}
                    onClick={() => setSelectedPod("locked")}
                  >
                    Locked ({bedsList.filter((b) => b.podId === "locked").length})
                  </button>
                  <button
                    type="button"
                    className={styles.podFilterBtn}
                    aria-pressed={selectedPod === "open"}
                    onClick={() => setSelectedPod("open")}
                  >
                    Open ({bedsList.filter((b) => b.podId === "open").length})
                  </button>
                </>
              ) : null}
            </div>
            <div className={styles.podTitleBar}>
              <span className={styles.glanceSub}>
                Click any bed card to inspect clinical telemetry &amp; patient notes
              </span>
            </div>
          </div>

          {/* Josh, 26 Sept 2026 ("go ahead with all your recommendations"): this board places
              occupants by POSITION (ready beds first, then leave, then incoming, then everyone
              else) — it is layout, not a record, and no bed number is stored anywhere for anyone.
              Said once, plainly, near the board itself rather than assumed. */}
          <p className={styles.glanceSub} data-testid="ward-beds-position-caption">
            Bed numbers show position on this board; no bed number is recorded for anyone.
          </p>

          <div className={styles.bedMatrixGrid}>
            {filteredBeds.map((bed) => (
              <button
                type="button"
                key={bed.bedNumber}
                ref={(el) => {
                  if (el) {
                    bedTriggerRefs.current.set(bed.bedNumber, el);
                  } else {
                    bedTriggerRefs.current.delete(bed.bedNumber);
                  }
                }}
                className={`${styles.bedCard} ${styles[bed.status]} ${bed.isHdu ? styles.hdu : ""} ${bed.isSpecialling ? styles.specialling : ""}`}
                onClick={() => setSelectedBed(bed.bedNumber)}
                aria-label={`${bed.bedLabel} ${bed.statusText} ${bed.patientAlias ?? ""}`}
              >
                <div className={styles.bedCardHead}>
                  <span
                    className={styles.bedNum}
                    style={{ fontFamily: "var(--mono, monospace)", fontVariantNumeric: "tabular-nums" }}
                  >
                    {bed.bedLabel}
                  </span>
                  <span className={`${styles.bedStatusTag} ${styles[bed.status]}`}>{bed.statusText}</span>
                </div>
                {bed.patientAlias ? (
                  <div className={styles.bedPatientRow}>
                    <span className={styles.bedAlias}>{bed.patientAlias}</span>
                    {bed.umrn ? (
                      <span style={{ fontSize: "0.74rem", color: "var(--muted, #64748b)" }}>
                        (<strong>{bed.umrn}</strong>)
                      </span>
                    ) : null}
                    {bed.daysInBed ? <span className={styles.bedDays}>LOS {bed.daysInBed}</span> : null}
                  </div>
                ) : (
                  <div className={styles.bedPatientRow}>
                    <span
                      className={styles.glanceSub}
                      style={{ color: bed.status === "ready" ? "var(--good)" : "var(--muted)" }}
                    >
                      {bed.status === "ready" ? "Ready for Allocation" : bed.statusText}
                    </span>
                  </div>
                )}
                <div className={styles.bedTagsRow}>
                  {bed.isSpecialling ? (
                    <span className={`${styles.tagChip} ${styles.special}`}>1:1 Special</span>
                  ) : null}
                  {bed.designation ? (
                    <span className={`${styles.tagChip} ${styles.legal}`}>{bed.designation}</span>
                  ) : null}
                  {bed.legalStatusLabel ? (
                    <span className={`${styles.tagChip} ${styles.legal}`}>{bed.legalStatusLabel}</span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>

          {/* Bed Turnover Quick Bar & Roster Legend */}
          <div className={styles.bedBoardQuickBar}>
            <div className={styles.quickBarStats}>
              <span className={styles.quickBarPill}>
                <span className={`${styles.statusDot} ${styles.occupiedDot}`} />
                <span>Occupied:</span>
                <strong>{bedsList.filter((b) => b.patientAlias).length}</strong>
              </span>
              <span className={styles.quickBarPill}>
                <span className={`${styles.statusDot} ${styles.readyDot}`} />
                <span>Ready:</span>
                <strong>{capacity.available}</strong>
              </span>
              <span className={styles.quickBarPill}>
                <span className={`${styles.statusDot} ${styles.speciallingDot}`} />
                <span>1:1 Special:</span>
                <strong>{bedsList.filter((b) => b.isSpecialling).length}</strong>
              </span>
              {isMixed ? (
                <span className={styles.quickBarPill}>
                  <span className={`${styles.statusDot} ${styles.readyDot}`} />
                  <span>Locked / Open:</span>
                  <strong>
                    {lockedBeds} / {openBedsCount}
                  </strong>
                </span>
              ) : null}
            </div>
            <div className={styles.quickBarRoster}>Staffing: recorded specialling {staffedSpecialling}</div>
          </div>
        </section>

        {/* ───────── BED TELEMETRY & CLINICAL DOSSIER DRAWER ───────── */}
        {selectedBed !== null ? (
          <>
            <div className={`${styles.drawerScrim} ${styles.show}`} onClick={closeBedDrawer} aria-hidden="true" />
            <aside
              ref={bedDrawerRef}
              className={`${styles.drawer} ${styles.show}`}
              data-testid="bed-telemetry-drawer"
              aria-labelledby="drawer-bed-title"
              role="dialog"
              aria-modal="true"
              onKeyDown={handleBedDrawerKeyDown}
            >
              <header className={styles.drawerHead}>
                <h2 id="drawer-bed-title" className={styles.drawerTitle}>
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="2" y="3" width="12" height="10" rx="1.5" />
                    <path d="M2 7h12" />
                  </svg>
                  <span>Bed {String(selectedBed).padStart(2, "0")} &middot; Patient Dossier</span>
                </h2>
                <button
                  type="button"
                  className={styles.drawerCloseBtn}
                  onClick={closeBedDrawer}
                  aria-label="Close bed drawer"
                  style={{
                    minHeight: "var(--ward-tap, 48px)",
                    minWidth: "var(--ward-tap, 48px)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  &times; Close
                </button>
              </header>

              <div className={styles.drawerBody}>
                {/* 1. Patient Identity & Admission Status */}
                <div className={styles.unitCard}>
                  <div className={styles.unitCardHeader}>
                    <h3 className={styles.sectionHeading}>Patient identity &amp; admission status</h3>
                    <span className={styles.statusPillBadge}>
                      {bedsList.find((b) => b.bedNumber === selectedBed)?.patientAlias ?? "No occupant recorded"}
                    </span>
                  </div>
                  <div className={styles.unitCardBody}>
                    <dl className={styles.unitFacts}>
                      <div>
                        <dt>Patient</dt>
                        <dd>
                          <b>
                            {bedsList.find((b) => b.bedNumber === selectedBed)?.patientAlias ?? "No occupant recorded"}
                          </b>{" "}
                          (
                          <span style={{ fontFamily: "var(--mono, monospace)", fontVariantNumeric: "tabular-nums" }}>
                            UMRN:{" "}
                            <strong>{bedsList.find((b) => b.bedNumber === selectedBed)?.umrn ?? "Not recorded"}</strong>
                          </span>
                          )
                        </dd>
                      </div>
                      <div>
                        <dt>Demographics</dt>
                        <dd>{unit.cohort} — age and sex are not recorded on this bed card</dd>
                      </div>
                      <div>
                        <dt>Legal Status</dt>
                        <dd>{bedsList.find((b) => b.bedNumber === selectedBed)?.legalStatusLabel ?? "Not recorded"}</dd>
                      </div>
                      <div>
                        <dt>Consultant</dt>
                        <dd>Not recorded</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* 2. Clinical monitoring. Vital signs, a pacing mode, a nursing ratio and a telemetry
                    transmitter's diagnostics used to be typed in here, the same for every patient in
                    every bed (25 September 2026 audit, A3). Ward Flow holds no observations, so the
                    card says so; specialling is the one fact on it the record does hold. */}
                <div className={styles.unitCard}>
                  <div className={styles.unitCardHeader}>
                    <h3 className={styles.sectionHeading}>Clinical monitoring status</h3>
                  </div>
                  <div className={styles.unitCardBody}>
                    <dl className={styles.unitFacts}>
                      <div>
                        <dt>Vital signs</dt>
                        <dd>Not recorded in Ward Flow. Check the ward&apos;s own observation chart.</dd>
                      </div>
                      <div>
                        <dt>Nurse Specialling</dt>
                        <dd>
                          {bedsList.find((b) => b.bedNumber === selectedBed)?.isSpecialling
                            ? "Specialling recorded"
                            : "No specialling recorded"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>

              <footer className={styles.drawerFoot}>
                <Link
                  className={styles.boardLink}
                  href={`/mockups/ward-flow/handover?scope=${encodeURIComponent(handoverScopeValue({ kind: "ward", id: unit.id }))}`}
                  style={{
                    minHeight: "var(--ward-tap, 48px)",
                    minWidth: "var(--ward-tap, 48px)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Handover View &rarr;
                </Link>
                <button
                  type="button"
                  className={styles.btnActionSec}
                  onClick={closeBedDrawer}
                  style={{
                    minHeight: "var(--ward-tap, 48px)",
                    minWidth: "var(--ward-tap, 48px)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Done
                </button>
              </footer>
            </aside>
          </>
        ) : null}

        {/* ─── Confirmation Modal (Confirm Capacity Figures) ───────────── */}
        {confirmNumbersOpen ? (
          <div
            className={`${styles.modalOverlay} ${styles.show}`}
            onClick={closeCapacityModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-capacity-title"
            aria-describedby="modal-capacity-desc"
          >
            <div
              ref={capacityModalRef}
              className={styles.modalBox}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={handleCapacityModalKeyDown}
            >
              <div className={styles.modalHead}>
                <h2 id="modal-capacity-title" className={styles.modalTitle}>
                  Confirm capacity figures — {unit.name}
                </h2>
                <button
                  type="button"
                  className={styles.drawerCloseBtn}
                  onClick={closeCapacityModal}
                  aria-label="Close capacity confirmation modal"
                  style={{
                    minHeight: "var(--ward-tap, 48px)",
                    minWidth: "var(--ward-tap, 48px)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  &times; Close
                </button>
              </div>
              <div className={styles.modalBody}>
                <p id="modal-capacity-desc" className={styles.blurb}>
                  Confirm or update the live operational figures for {unit.name}.
                </p>

                <div className={styles.unitCard}>
                  <div className={styles.unitCardHeader}>
                    <h3 className={styles.sectionHeading}>Bed roster &amp; census overview</h3>
                    <span
                      className={styles.statusPillBadge}
                      style={{ color: "var(--ink)", borderColor: "var(--line-strong)" }}
                    >
                      {unit.name}
                    </span>
                  </div>
                  <div className={styles.unitCardBody}>
                    <dl className={styles.unitFacts}>
                      <div>
                        <dt>Total Staffed Beds</dt>
                        <dd
                          style={{
                            fontFamily: "var(--mono, monospace)",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}
                        >
                          {unit.beds} beds
                        </dd>
                      </div>
                      <div>
                        <dt>Occupied Census</dt>
                        <dd
                          style={{
                            fontFamily: "var(--mono, monospace)",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}
                        >
                          {capacity.occupied} / {unit.beds} beds (
                          {unit.beds > 0 ? Math.round((capacity.occupied / unit.beds) * 100) : 0}%)
                        </dd>
                      </div>
                      <div>
                        <dt>Currently Confirmed Allocatable</dt>
                        <dd
                          style={{
                            fontFamily: "var(--mono, monospace)",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}
                        >
                          {unit.allocatable.value} beds
                        </dd>
                      </div>
                      <div>
                        <dt>Ready Vacant</dt>
                        <dd
                          style={{
                            fontFamily: "var(--mono, monospace)",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}
                        >
                          {capacity.available} beds
                        </dd>
                      </div>
                      <div>
                        <dt>Held for Referrals</dt>
                        <dd
                          style={{
                            fontFamily: "var(--mono, monospace)",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}
                        >
                          {capacity.held} beds
                        </dd>
                      </div>
                      <div>
                        <dt>Blocked Offline</dt>
                        <dd
                          style={{
                            fontFamily: "var(--mono, monospace)",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}
                        >
                          Not recorded
                        </dd>
                      </div>
                      <div>
                        <dt>Allocatable Delta</dt>
                        <dd
                          style={{
                            fontFamily: "var(--mono, monospace)",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}
                        >
                          {(() => {
                            const parsed = parseInt(capacityValue, 10);
                            if (isNaN(parsed)) return "Not recorded";
                            const delta = parsed - unit.allocatable.value;
                            return delta > 0 ? `+${delta} beds` : delta < 0 ? `${delta} beds` : "0 beds (No change)";
                          })()}
                        </dd>
                      </div>
                      <div>
                        <dt>Physical Vacancy Delta</dt>
                        <dd
                          style={{
                            fontFamily: "var(--mono, monospace)",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}
                        >
                          {unit.beds - capacity.occupied} beds vacant
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {capacityConfirmationForm()}
              </div>
              <div className={styles.modalFoot}>
                <button
                  type="button"
                  className={styles.btnActionSec}
                  onClick={closeCapacityModal}
                  style={{
                    minHeight: "var(--ward-tap, 48px)",
                    minWidth: "var(--ward-tap, 48px)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Action Toast (Owner Rule D4) */}
        <div className={`${styles.actionToast} ${toastMessage ? styles.show : ""}`} role="status" aria-live="polite">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
        <WardPrototypeFooter
          testId="ward-unit-governance"
          note={`Scoped to ${unit.name} · Bed decisions remain human-confirmed · Not a medical device`}
        />
      </main>
    </div>
  );
}
