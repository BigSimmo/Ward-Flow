"use client";

import Link from "next/link";
import { useEffect, useCallback, useRef, useState, type FormEvent } from "react";

import {
  BED_PREPARATION_NOTES,
  BED_RELEASE_BLOCKERS,
  type BedPreparationNote,
  type BedReleaseBlocker,
  type ReleasePullReason,
  OVERRIDE_REASONS,
  type OverrideReason,
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
  isOpen,
  overridesAgainstUnit,
  stageCopy,
  unitCapacity,
} from "@/components/ward-management/ward-derivations";
import { HIGH_ACUITY_STAFFING_REFUSAL, OVERRIDE_REASON_REQUIRED } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import type { ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { wardBoardHref } from "@/components/ward-management/shell/ward-facade";
import {
  BED_RELEASE_WAITING_ON,
  type BedReleaseWaitingOn,
  type DeclineReason,
  type Movement,
  type Rejection,
} from "@/components/ward-management/ward-model";
import { edById, siteByCode, WARD_LOCKED_BED_SPLITS } from "@/components/ward-management/ward-sites";
import {
  daysInBed as admissionStayDays,
  stayBand,
  isPastExpectedDischarge,
  LEAVING_DESTINATIONS,
  type LeavingDestination,
} from "@/components/ward-management/ward-admissions";
import { tentativeDiagnosisPhrase } from "@/components/ward-management/ward-diagnosis";
import { patientAgeYears } from "@/components/ward-management/ward-patients";
import { WardDailySheet } from "@/components/ward-management/board/ward-daily-sheet";
import { dayOf, minuteOfDay, type Instant } from "@/components/ward-management/ward-clock";
import { WardNotificationCenter } from "./ward-notification-center";

import { handoverScopeValue } from "@/components/ward-management/handover/handover-page";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
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
import { BED_STATE_DETAILS, BED_STATE_LABELS, bedStates } from "@/components/ward-management/ward-bed-states";
import { WardDecisionsCockpit } from "./ward-decisions-cockpit";
import { WardTelemetryRibbon } from "./ward-telemetry-ribbon";
import { WardHomeTab } from "./ward-home-tab";
import { WardArrivalsCorridor } from "./ward-arrivals-corridor";
import { WardDischargesMatrix } from "./ward-discharges-matrix";
import { WardBedsMatrix } from "./ward-beds-matrix";
import { WardBedDossierDrawer } from "./ward-bed-dossier-drawer";
import {
  LATE_ARRIVAL_GRACE_MINUTES,
  LEAVE_BED_OPEN_WARNING_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
} from "@/components/ward-management/ward-operational-defaults";

type WardScreenProps = { departurePlanning?: boolean; unitId: string; presentation?: "overview" | "answer" };

function originPlaceLabel(originEdId: string): string {
  return edById(originEdId)?.name ?? originEdId;
}

function arrivalIsLate(movement: Movement, now: Instant): boolean {
  const estimatedArrivalAt = movement.arrivalDetails?.estimatedArrivalAt;
  if (estimatedArrivalAt === undefined) return false;
  return now > estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES;
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

export function WardScreen({ unitId, presentation = "overview", departurePlanning = false }: WardScreenProps) {
  if (presentation === "answer") {
    return <WardAnswerView unitId={unitId} />;
  }
  return (
    <WardOverviewScreen
      key={`${unitId}:${departurePlanning}`}
      unitId={unitId}
      presentation={presentation}
      departurePlanning={departurePlanning}
    />
  );
}
// Fail closed for older provider adapters/test doubles without the identity projection.
// Never reconstruct the missing lookup by reaching for the full referral array here.
const unavailablePatientIdentity = (): ResolvedPatientInfo => ({
  displayName: "Not recorded",
  formalName: "Not recorded",
  umrn: "UMRN not recorded",
  initials: "UP",
});

function WardOverviewScreen({ unitId, presentation = "overview", departurePlanning = false }: WardScreenProps) {
  const {
    movements,
    resolvePatientIdentity = unavailablePatientIdentity,
    units,
    bedReleases,
    leaveBeds,
    refreshRequests,
    dispatch,
    recordWardDeparture,
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
  const [leaveAdmissionId, setLeaveAdmissionId] = useState<string>("");
  const [answerIndex, setAnswerIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"attn" | "coming" | "out" | "beds" | "return">(
    departurePlanning ? "return" : "attn",
  );
  const [selectedPod, setSelectedPod] = useState<string>("all");
  const [selectedBed, setSelectedBed] = useState<number | null>(null);
  const [confirmNumbersOpen, setConfirmNumbersOpen] = useState(false);
  const [dailySheetOpen, setDailySheetOpen] = useState(false);
  const [drawerLeavingDestination, setDrawerLeavingDestination] =
    useState<LeavingDestination>("discharged-to-the-community");
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
    // Protected refusals deliberately omit identifiers; retain the name already shown on this scoped card.
    const namedReason =
      reason !== undefined && check.codes.length > 0 && !reason.includes(check.who)
        ? `${check.who}: ${reason}`
        : reason;
    setToastMessage(namedReason !== undefined ? `Not recorded: ${namedReason}. Nothing was changed.` : check.success);
  }, [dischargeToken, rejections]);

  useEffect(() => {
    function syncTabWithHash() {
      if (typeof window === "undefined") return;
      const hash = window.location.hash;
      if (hash === "#bed-capacity") setActiveTab("attn");
      else if (hash === "#ward-daily-return") setActiveTab("return");
      else if (hash === "#ward-flag-bed-release" || hash === "#ward-leave-bed-form") setActiveTab("out");
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
        } else if (dailySheetOpen) {
          setDailySheetOpen(false);
        } else if (confirmNumbersOpen) {
          closeCapacityModal();
        } else if (notificationCenterOpen) {
          setNotificationCenterOpen(false);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedBed, dailySheetOpen, confirmNumbersOpen, notificationCenterOpen, closeBedDrawer, closeCapacityModal]);

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
  // The ruled four boxes — Ready · Pulled · Closed · Occupied — for every bed-state figure this
  // screen shows. `capacity.held` is NOT Closed (it still counts a live pull's empty bed), and
  // "Held" is reserved for a bed kept for a patient on leave.
  const states = bedStates(unit, admissions, bedReleases, leaveBeds);
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
      incomingMovement ??
      (admission
        ? movements.find(
            (m) =>
              (admission.movementId !== null && m.id === admission.movementId) ||
              (admission.referralId !== null && m.referralId === admission.referralId),
          )
        : undefined);
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

    const stayBandObj = admission && stayDays !== null ? stayBand(admission, now) : null;
    const isPastDate = admission ? isPastExpectedDischarge(admission, now) : false;
    const awayHours =
      admission?.awayAtEmergencyDepartmentSince != null
        ? Math.max(0, Math.floor((now - admission.awayAtEmergencyDepartmentSince) / 60))
        : null;
    const expDays =
      admission?.expectedDischargeAt != null && Number.isFinite(admission.expectedDischargeAt)
        ? Math.floor((admission.expectedDischargeAt - now) / 1440)
        : null;
    const tentDiag = admission?.tentativeDiagnosis
      ? (tentativeDiagnosisPhrase(admission.tentativeDiagnosis) ?? undefined)
      : undefined;
    const patientAge = patientInfo?.patient ? patientAgeYears(patientInfo.patient, new Date()) : null;
    const patientSex = patientInfo?.patient?.sex ?? patientInfo?.genderOrSex ?? unit.cohort;
    const patientHomeRegion = admission?.homeRegion ?? null;

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
      stayDays,
      stayBand: stayBandObj?.label,
      pastDate: isPastDate,
      awayAtEdHours: awayHours,
      expectedDays: expDays,
      tentativeDiagnosis: tentDiag,
      blockReason: admission?.blockReason ?? undefined,
      dischargeBarrier: admission?.dischargeBarrier ?? undefined,
      isSpecialling,
      legalStatus: patientLegalStatus,
      legalForm: patientLegalForm,
      legalStatusLabel,
      admissionId: admission?.id,
      age: patientAge,
      sex: patientSex,
      homeRegion: patientHomeRegion,
    };
  });

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
  function handleAcceptInPrinciple(movementId: string, unitId: string) {
    const targetUnit = units.find((u) => u.id === unitId);
    if (!targetUnit) return;
    priorRejectionCountRef.current = rejections.length;
    dispatch({
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now,
      movementId,
      unitId,
    });
    setCheckToken((token) => token + 1);
  }

  function handlePullPatient(movementId: string, unitId: string) {
    const targetUnit = units.find((u) => u.id === unitId);
    if (!targetUnit) return;
    priorRejectionCountRef.current = rejections.length;
    dispatch({
      type: "PULL_PATIENT",
      role: "ward",
      now,
      movementId,
      unitId,
    });
    setCheckToken((t) => t + 1);
  }

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
          )}{" "}
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
    if (recordWardDeparture) recordWardDeparture(admissionId, unitId, dischargeDestination);
    else
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

  function handleDrawerRecordLeft(admissionId: string, who: string) {
    if (!drawerLeavingDestination) return;
    const resolved = resolvePatientIdentity(admissions.find((admission) => admission.id === admissionId));
    dischargeCheckRef.current = {
      prior: rejections.length,
      success: `Recorded: ${who} has left the ward.`,
      who,
      codes: resolved.patient ? [resolved.patient.id, admissionId] : [],
    };
    if (recordWardDeparture) recordWardDeparture(admissionId, unitId, drawerLeavingDestination);
    else
      dispatch({
        type: "RECORD_LEAVING",
        role: "ward",
        now,
        admissionId,
        actingUnitId: unitId,
        leavingDestination: drawerLeavingDestination,
      });
    setDischargeToken((token) => token + 1);
    closeBedDrawer();
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
    // Patient must be explicitly chosen from the form dropdown.
    const isLeaveAdmissionValid = otherOccupants.some((a) => a.id === leaveAdmissionId);
    const chosenAdmissionId: string | undefined = isLeaveAdmissionValid ? leaveAdmissionId : undefined;
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
    setLeaveAdmissionId("");
  }

  // Task 5 addendum (binding spec's Data flow section: "Leave beds follow the same path with a
  // two-state life: recorded, then ended on return."): the second half of that life. Same
  // claim-not-proof discipline as every other control on this screen — `actingUnitId` is this
  // screen's own route parameter, and the reducer compares it against the leave bed's own
  // `unitId` before ending it.
  function endLeaveBed(leaveBedId: string) {
    dispatch({ type: "END_LEAVE_BED", role: "ward", now, leaveBedId, actingUnitId: unitId });
  }

  const departureDecisions = pendingBedReleases
    .filter((release) => release.state === "expected" || release.blocker !== null)
    .map((release) => ({
      id: release.id,
      title: bedRecordLabel(release.admissionId),
      badge: (release.blocker ? "Blocked" : "Ready") as "Blocked" | "Ready",
      onConfirm: release.state === "expected" ? () => confirmBedRelease(release.id) : undefined,
      onClear: release.blocker ? () => clearBedReleaseBlock(release.id) : undefined,
    }));
  const leaveDecisions = unitLeaveBeds.map((leaveBed) => ({
    id: leaveBed.id,
    title: `Bed on leave · back ${formatInstant(leaveBed.expectedReturn)}`,
  }));
  const intakeDecisions = visibleIncoming.map((movement) => ({
    id: movement.id,
    title: resolvePatientIdentity(movement).displayName,
    onAccept: () => handleAcceptInPrinciple(movement.id, unit.id),
  }));
  const decisionsDue =
    intakeDecisions.length +
    departureDecisions.filter((row) => row.badge === "Ready").length +
    (!isRollupConfirmedToday && morningRollupDeadlinePassed ? 1 : 0);
  const decisionsDueLabel =
    decisionsDue > 0 ? `${decisionsDue} decisions due this shift` : "No decisions due this shift";

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
                <h3 className={styles.unitName}>{unit.name}</h3>
                <span className={styles.unitMeta}>
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

              <button
                type="button"
                className={styles.btnDailySheet}
                onClick={() => setDailySheetOpen(true)}
                title="Open the ward's daily sheet and morning handoff."
                data-testid="ward-open-daily-sheet-btn"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 2h10v12H3zM5 5h6M5 8h6M5 11h4" />
                </svg>
                <span>Ward Daily Sheet</span>
              </button>

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

          {/* Unified Flight Deck Telemetry Ribbon */}
          <WardTelemetryRibbon
            unit={unit}
            capacity={capacity}
            staffedSpecialling={staffedSpecialling}
            acceptedCount={accepted.length}
            onOpenBedList={() => setActiveTab("return")}
          />

          {/* Operational Tab Navigation Bar Integrated at Bottom of Command Horizon */}
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
                    style={decisionsDue > 0 ? { color: "var(--danger)", fontWeight: 700 } : undefined}
                    title={decisionsDueLabel}
                    aria-label={decisionsDueLabel}
                  >
                    {decisionsDue > 0 ? `${decisionsDue} Due` : "Done"}
                  </span>
                </button>
              </li>
            </ul>
          </nav>
        </section>

        {/* ───────── TAB 1: WORTH YOUR ATTENTION ───────── */}
        <section
          className={styles.tabPanel}
          id="tab-attn"
          role="tabpanel"
          aria-labelledby="tabBtn-attn"
          data-active={activeTab === "attn"}
        >
          <section
            aria-label="Ward figures, right now"
            id="bed-capacity"
            className={`${styles.bedSection} ${styles.censusCommandCard}`}
            tabIndex={0}
            data-ward-primitive="panel"
          >
            <div className={styles.commandHeader} data-ward-primitive="panel-header">
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
                <span className={styles.capacityTrackMeta}>
                  {states.ready} {BED_STATE_LABELS.ready} · {states.pulled} {BED_STATE_LABELS.pulled} · {states.closed}{" "}
                  {BED_STATE_LABELS.closed} · {states.occupied} {BED_STATE_LABELS.occupied}
                </span>
              </div>

              <div className={`${styles.bedGrid} ${styles.breakdownStatsGrid}`} data-testid="ward-unit-beds">
                {/* The ruled four (`ward-bed-states.ts`). No Blocked box: out-of-service beds are
                    not recorded (owner ruling 2026-09-25) and are folded into Closed. */}
                <span
                  className={`${styles.bedChip} ${styles.statBox}`}
                  data-ward-primitive="chip"
                  data-state="available"
                  title={BED_STATE_DETAILS.ready}
                >
                  <span className={styles.statBoxLabel}>{BED_STATE_LABELS.ready}</span>{" "}
                  <strong className={styles.statBoxVal} style={{ color: "var(--good)" }}>
                    {states.ready}
                  </strong>
                </span>
                <span
                  className={`${styles.bedChip} ${styles.statBox}`}
                  data-ward-primitive="chip"
                  data-state="pulled"
                  title={BED_STATE_DETAILS.pulled}
                >
                  <span className={styles.statBoxLabel}>{BED_STATE_LABELS.pulled}</span>{" "}
                  <strong className={styles.statBoxVal}>{states.pulled}</strong>
                </span>
                <span
                  className={`${styles.bedChip} ${styles.statBox}`}
                  data-ward-primitive="chip"
                  data-state="closed"
                  title={BED_STATE_DETAILS.closed}
                >
                  <span className={styles.statBoxLabel}>{BED_STATE_LABELS.closed}</span>{" "}
                  <strong className={styles.statBoxVal} style={{ color: "var(--accent-ink)" }}>
                    {states.closed}
                  </strong>
                </span>
                <span
                  className={`${styles.bedChip} ${styles.statBox}`}
                  data-ward-primitive="chip"
                  data-state="occupied"
                  title={BED_STATE_DETAILS.occupied}
                >
                  <span className={styles.statBoxLabel}>{BED_STATE_LABELS.occupied}</span>{" "}
                  <strong className={styles.statBoxVal}>{states.occupied}</strong>
                </span>
                <span
                  className={`${styles.bedChip} ${styles.statBox}`}
                  data-ward-primitive="chip"
                  data-state="confirmed"
                >
                  <span className={styles.statBoxLabel}>Confirmed</span>{" "}
                  <strong className={styles.statBoxVal} style={{ color: "var(--accent-ink)" }}>
                    {breakdown.confirmedToday}
                  </strong>
                </span>
                <span
                  className={`${styles.bedChip} ${styles.statBox}`}
                  data-ward-primitive="chip"
                  data-state="expected"
                >
                  <span className={styles.statBoxLabel}>Expected</span>{" "}
                  <strong className={styles.statBoxVal} style={{ color: "var(--warn)" }}>
                    {breakdown.expectedToday}
                  </strong>
                </span>
                <span
                  className={`${styles.bedChip} ${styles.statBox}`}
                  data-ward-primitive="chip"
                  data-state="blocked-release"
                  data-testid="ward-unit-blocked-releases"
                >
                  <span className={styles.statBoxLabel}>{BED_RELEASE_BLOCKED_FIGURE_LABEL}</span>{" "}
                  <strong className={styles.statBoxVal}>{breakdown.blockedToday}</strong>
                </span>
                <span className={`${styles.bedChip} ${styles.statBox}`} data-ward-primitive="chip" data-state="leave">
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
                      {pendingPreparation} of the {capacity.available} ready {capacity.available === 1 ? "bed" : "beds"}{" "}
                      at {unit.name} {pendingPreparation === 1 ? "is" : "are"} still being made ready.
                    </strong>{" "}
                    The bed stays offered and stays counted — pulling the next patient takes hours anyway — but the ward
                    cannot admit into it yet.
                  </span>
                </div>
              ) : null}

              <details className={styles.clinicalDisclosure}>
                <summary>What these bed figures mean</summary>
                <p className={styles.bedNote}>
                  Ready, pulled, closed and occupied total {unit.beds}. Closed means empty but not offered; pulled means
                  allocated to a patient who has not arrived yet. Beds being made ready are counted inside Ready, and
                  beds held for a patient on leave inside Occupied. Confirmed, expected, held-up discharge and leave are
                  flow counts and are not added to that total.
                </p>
              </details>
            </div>
          </section>

          <WardHomeTab
            unit={unit}
            onAcceptInPrinciple={handleAcceptInPrinciple}
            units={units}
            capacity={capacity}
            accepted={accepted}
            incoming={incoming}
            withdrawn={withdrawn}
            overridesHere={overridesHere}
            now={now}
            presentation={presentation}
            activeAnswerIndex={activeAnswerIndex}
            setAnswerIndex={setAnswerIndex}
            visibleIncoming={visibleIncoming}
            declineOpenFor={declineOpenFor}
            toggleDecline={toggleDecline}
            declineReason={declineReason}
            setDeclineReason={setDeclineReason}
            submitDecline={submitDecline}
            priorRejectionCountRef={priorRejectionCountRef}
            rejections={rejections}
            dispatch={dispatch}
            setCheckToken={setCheckToken}
            recentAnswers={recentAnswers}
            breakdown={breakdown}
            capacityConfirmationForm={capacityConfirmationForm}
            pendingBedReleasesCount={pendingBedReleases.length}
            unitLeaveBedsCount={unitLeaveBeds.length}
            resolvePatientIdentity={resolvePatientIdentity}
            lastActionRejection={lastActionRejection}
            overrideReasonForm={overrideReasonForm}
            liveFormAlerts={liveFormAlerts}
            onOpenDecisions={() => setActiveTab("return")}
          />
        </section>

        {/* ───────── TAB 5: TODAY'S DECISIONS & SHIFT COCKPIT ───────── */}
        <section
          className={styles.tabPanel}
          id="tab-return"
          role="tabpanel"
          aria-labelledby="tabBtn-return"
          data-active={activeTab === "return"}
        >
          <WardDecisionsCockpit
            unit={unit}
            rollupOverdue={!isRollupConfirmedToday && morningRollupDeadlinePassed}
            rollupConfirmed={isRollupConfirmedToday}
            rollupTimeLabel={morningRollupTimeLabel}
            plannedDischarges={rollupConfirmation?.expectedDischarges ?? releasesCountedToday.length}
            onConfirmRollup={handleConfirmMorningRollup}
            staffingFact={`${unit.allocatable.value} allocatable`}
            intakes={intakeDecisions}
            departures={departureDecisions}
            leaves={leaveDecisions}
          />
          <footer className={styles.protoBanner}>
            SYNTHETIC PROTOTYPE &middot; Scoped to {unit.name} &middot; Bed decisions remain human-confirmed &middot;
            Not a medical device
          </footer>
        </section>

        {/* ───────── TAB 2: COMING IN ───────── */}
        <section
          className={styles.tabPanel}
          id="tab-coming"
          role="tabpanel"
          aria-labelledby="tabBtn-coming"
          data-active={activeTab === "coming"}
        >
          <WardArrivalsCorridor
            unit={unit}
            onPullPatient={handlePullPatient}
            accepted={accepted}
            now={now}
            resolvePatientIdentity={resolvePatientIdentity}
            releaseOpenFor={releaseOpenFor}
            toggleRelease={toggleRelease}
            releaseReason={releaseReason}
            setReleaseReason={setReleaseReason}
            submitRelease={submitRelease}
            lastActionRejection={lastActionRejection}
            dispatch={dispatch}
            setCheckToken={setCheckToken}
            priorRejectionCountRef={priorRejectionCountRef}
            rejections={rejections}
            overrideReasonForm={overrideReasonForm}
          />
        </section>

        {/* ───────── TAB 3: ON THE WAY OUT ───────── */}
        <section
          className={styles.tabPanel}
          id="tab-out"
          role="tabpanel"
          aria-labelledby="tabBtn-out"
          data-active={activeTab === "out"}
        >
          <WardDischargesMatrix
            unit={unit}
            releasesCountedToday={releasesCountedToday}
            unitLeaveBeds={unitLeaveBeds}
            blockedReleases={blockedReleases}
            now={now}
            confirmBedRelease={confirmBedRelease}
            clearBedReleaseBlock={clearBedReleaseBlock}
            endLeaveBed={endLeaveBed}
          />
        </section>

        {/* ───────── TAB 4: BED BOARD & ROSTER ───────── */}
        <section
          className={styles.tabPanel}
          id="tab-beds"
          role="tabpanel"
          aria-labelledby="tabBtn-beds"
          data-active={activeTab === "beds"}
        >
          <WardBedsMatrix
            unit={unit}
            bedsList={bedsList}
            selectedBed={selectedBed}
            setSelectedBed={setSelectedBed}
            selectedPod={selectedPod}
            setSelectedPod={setSelectedPod}
            isMixed={isMixed}
          />
        </section>

        {/* ───────── BED TELEMETRY & CLINICAL DOSSIER DRAWER ───────── */}
        {selectedBed !== null
          ? (() => {
              const selectedBedItem = bedsList.find((b) => b.bedNumber === selectedBed);
              return (
                <WardBedDossierDrawer
                  selectedBed={selectedBed}
                  bedItem={selectedBedItem}
                  unit={unit}
                  onClose={closeBedDrawer}
                  drawerLeavingDestination={drawerLeavingDestination}
                  setDrawerLeavingDestination={setDrawerLeavingDestination}
                  onRecordLeft={(admissionId, who) => handleDrawerRecordLeft(admissionId, who)}
                  onUpdateBlocker={(admissionId, blocker) => {
                    const pendingRelease = pendingBedReleases.find((r) => r.admissionId === admissionId);
                    if (pendingRelease) {
                      dispatch({
                        type: "BLOCK_BED_RELEASE",
                        role: "ward",
                        now,
                        releaseId: pendingRelease.id,
                        actingUnitId: unitId,
                        blocker: blocker as BedReleaseBlocker,
                      });
                    }
                    setToastMessage(`Discharge blocker recorded: ${blocker}`);
                  }}
                  onMarkAtEd={(bedNum) => {
                    if (selectedBedItem?.admissionId) {
                      dispatch({
                        type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
                        role: "ward",
                        now,
                        admissionId: selectedBedItem.admissionId,
                        actingUnitId: unitId,
                      });
                    }
                    setToastMessage(`Bed ${bedNum} patient marked away at ED.`);
                  }}
                  onMarkBack={(bedNum) => {
                    if (selectedBedItem?.admissionId) {
                      dispatch({
                        type: "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT",
                        role: "ward",
                        now,
                        admissionId: selectedBedItem.admissionId,
                        actingUnitId: unitId,
                      });
                    }
                    setToastMessage(`Bed ${bedNum} patient marked returned to ward.`);
                  }}
                  bedDrawerRef={bedDrawerRef}
                  onKeyDown={handleBedDrawerKeyDown}
                />
              );
            })()
          : null}

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
                          {states.occupied} / {unit.beds} beds (
                          {unit.beds > 0 ? Math.round((states.occupied / unit.beds) * 100) : 0}%)
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
                        <dt>{BED_STATE_LABELS.pulled}, not arrived</dt>
                        <dd
                          style={{
                            fontFamily: "var(--mono, monospace)",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}
                        >
                          {states.pulled} beds
                        </dd>
                      </div>
                      <div>
                        <dt>{BED_STATE_LABELS.closed}, not offered</dt>
                        <dd
                          style={{
                            fontFamily: "var(--mono, monospace)",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}
                        >
                          {states.closed} beds
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

        {/* ─── Ward Daily Sheet Modal Overlay ───────────────────────────── */}
        {dailySheetOpen ? (
          <div
            className={`${styles.modalOverlay} ${styles.show}`}
            onClick={() => setDailySheetOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-daily-sheet-title"
            data-testid="ward-daily-sheet-modal"
          >
            <div className={styles.dailySheetModalContent} onClick={(e) => e.stopPropagation()}>
              <header className={styles.dailySheetModalHeader}>
                <div>
                  <h2 id="modal-daily-sheet-title" className={styles.dailySheetModalTitle}>
                    {unit.name} &middot; Ward Daily Sheet &amp; Morning Handoff
                  </h2>
                  <p className={styles.dailySheetModalSub}>
                    Executive clinical census &middot; day patient movement ledger
                  </p>
                </div>
                <div className={styles.dailySheetModalActions}>
                  <button
                    type="button"
                    className={styles.btnActionSec}
                    onClick={() => window.print()}
                    aria-label="Print daily sheet"
                  >
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M4 2h8v4H4zM3 6h10a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1zM4 11h8v3H4z" />
                    </svg>
                    <span>Print Sheet</span>
                  </button>
                  <button
                    type="button"
                    className={styles.btnActionSec}
                    onClick={() => setDailySheetOpen(false)}
                    aria-label="Close daily sheet"
                  >
                    &times; Close
                  </button>
                </div>
              </header>
              <div className={styles.dailySheetModalBody}>
                <WardDailySheet unit={unit} now={now} onClose={() => setDailySheetOpen(false)} />
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
