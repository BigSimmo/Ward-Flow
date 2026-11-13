"use client";

import { fieldsMatchEveryWord } from "@/components/ward-management/search/search-text";
import {
  bedsPendingPreparation,
  openBedReleases,
  stalePreparingReleases,
} from "@/components/ward-management/ward-bed-availability";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import Link from "next/link";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import styles from "./ward-home-tab.module.css";
import { pendingDepartureLogRows, type WardShiftLogRow } from "./ward-departure-log";
import { wardSafeRejectionReason } from "./ward-rejection-text";
import type { Unit, Movement, Rejection, DeclineReason } from "@/components/ward-management/ward-model";
import { EXTRA_TRAVEL_HOLD_MINUTES } from "@/components/ward-management/ward-model";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { withdrawalReasonLabels } from "@/components/ward-management/ward-change-reasons";
import { formatInstantWithDay, formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import { currentShiftStartInstant, releasesDueByShiftEnd } from "@/components/ward-management/ward-board-time-features";
import { pullHoldText } from "@/components/ward-management/ward-bed-hold";
import type { absentOnOrder } from "@/components/ward-management/ward-absence-tasks";
import { heldUpDueByTomorrow } from "@/components/ward-management/ward-held-up";
import {
  BED_RELEASE_BLOCKED_FIGURE_LABEL,
  deriveAfternoonDischarges,
  restrictionNotice,
  type OverrideEntry,
} from "@/components/ward-management/ward-derivations";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import { referralFit, wardStateLine } from "./ward-referral-fit";
import { AwaitingFitLines, AwaitingIdentity, WardReferralDetailDrawer } from "./ward-awaiting-referral";
import { OverrideRegister, WardAcceptDialog } from "./ward-on-demand";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { resolveSubjectPatient, type ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import { LayoutGrid, List } from "lucide-react";
import { WardPlaceOrMove } from "./ward-place-or-move";
import { tileStateLine, WardHomeTileText } from "./ward-home-tab-today";
import { WardComingAndGoing, type ComingRowUndo } from "./ward-coming-and-going";
import { WardDeclineReasons } from "./ward-decline-reasons";
import {
  arrivalRows,
  arrivalsExpectedToday,
  dischargeTodayRows,
  lastFreedToday,
  leaveRows as comingLeaveRows,
  needsALookRows,
  shortDateLabel,
  type ComingRow,
} from "./ward-coming-and-going-rows";
import { WardEverySquares, bedSquareFor } from "./ward-every-bed-squares";
import { BedSquare, BedSquaresKey } from "@/components/ward-management/bed-squares";
import { useWardTomorrowOutlook } from "./ward-home-outlook";
import {
  Button,
  buttonClass,
  Card,
  CardHead,
  Count,
  Drawer,
  durMinutes,
  PhoneSheet,
  Segmented,
  SrOnly,
  StatusGlyph,
  useIsPhone,
  type WfTone,
} from "@/components/wf";
import { bedGlyphTone, type BedItem } from "./ward-bed-tone";
import { CriteriaLedTag } from "./ward-criteria-led-tag";
import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import { useWalkRound, WardWalkRound, bedStripWord, walkRoundBeds, type WalkRoundMark } from "./ward-walk-round";
import type { WardBedFilter } from "./ward-telemetry-ribbon";
import { observationRatio, observationSummary } from "@/components/ward-management/ward-observation";
import { declineTargetLeftNote } from "./decline-target-left";
import { WardPhoneRoundList } from "./ward-phone-round-list";
import { NOT_CONFIRMED_SINCE_OUTAGE, OutageMeta, useWardOutageCatchUp } from "./ward-outage-tags";
import {
  declineReasonText,
  referralAnswerBlocked,
  WARD_ACTION_REJECTION_LABELS,
  wardDischargesDueToday,
  type WardFlowTab,
  type WardShiftView,
} from "./ward-home-tab-model";

export {
  canSubmitDecline,
  canSubmitOverride,
  DECLINE_SUBMIT_UNAVAILABLE_REASON,
  OVERRIDE_SUBMIT_UNAVAILABLE_REASON,
  wardActNowCount,
  type WardFlowTab,
  type WardShiftView,
} from "./ward-home-tab-model";

interface WardHomeTabProps {
  unit: Unit;
  units: Unit[];
  capacity: { available: number; occupied: number };
  accepted: Movement[];
  heldAfterStop?: Movement[];
  incoming: Movement[];
  withdrawn: Movement[];
  overridesHere: OverrideEntry[];
  now: Instant;
  presentation: "overview" | "answer";
  activeAnswerIndex: number;
  setAnswerIndex: React.Dispatch<React.SetStateAction<number>>;
  visibleIncoming: Movement[];
  declineOpenFor: string | null | undefined;
  toggleDecline: (movementId: string) => void;
  declineReason: DeclineReason | "" | undefined;
  setDeclineReason:
    React.Dispatch<React.SetStateAction<DeclineReason | undefined>> | ((reason: DeclineReason | undefined) => void);
  submitDecline: (event: React.FormEvent<HTMLFormElement>, movementId: string) => void;
  priorRejectionCountRef: React.MutableRefObject<number>;
  rejections: Rejection[];
  dispatch: (action: WardFlowEvent) => void;
  setCheckToken: React.Dispatch<React.SetStateAction<number>>;
  recentAnswers: Array<{ key: string; movementId: string; outcome: string; reason?: string; at?: Instant }>;
  breakdown: { confirmedToday: number; expectedToday: number; onLeave: number };
  capacityConfirmationForm?: () => React.ReactNode;
  pendingBedReleasesCount: number;
  unitLeaveBedsCount: number;
  resolvePatientIdentity: (movementOrAdmission: Parameters<typeof resolveSubjectPatient>[0]) => ResolvedPatientInfo;
  lastActionRejection: Rejection | null | undefined;
  overrideReasonForm: (movementId: string) => React.ReactNode;
  onAcceptInPrinciple?: (movementId: string, unitId: string, extendedHold?: boolean) => void;
  /** Why this desk may not answer the ward's referrals at all, such as the site bed manager (D-80). */
  answerBlockedReason?: string;
  liveFormAlerts: Array<{
    key: string;
    title: string;
    countdown: string;
    text: string;
    tone: "critical" | "warning" | "info";
    actionLabel?: string;
    actionTarget?: "answer" | "arrival" | "discharges";
    movementId?: string;
  }>;
  onOpenDecisions?: () => void;
  morningRollupConfirmed?: boolean;
  morningRollupTimeLabel?: string;
  onConfirmMorningRollup?: () => void;
  onConfirmBedsAndMorningRollup?: () => void;
  onOpenConfirmNumbers?: () => void;
  onOpenArrival?: (movementId: string) => void;
  /** Pull a bed for an accepted patient from the Ward flow Admissions list (A1-6). */
  onPullPatient?: (movementId: string, unitId: string) => void;
  onOpenDischarges?: () => void;
  onConfirmRelease?: (releaseId: string) => void; // WH4: the phone round's Confirm discharge
  /** The ward's beds, as the bed board draws them. Drives Every bed. */
  bedsList?: BedItem[];
  /** Audit A3-1: this ward's absences on an order, from `absentOnOrder` (one Act now row each). */
  absencesOnOrder?: ReturnType<typeof absentOnOrder>;
  /** Opens the bed's dossier. */
  onSelectBed?: (bedNumber: number) => void;
  /** A quiet line under the bed squares (the coordinator's refresh request). */
  squaresAfter?: React.ReactNode;
  /** Wave 4 (W7): the inline Undo on an arrival row just pulled ("Undo pull · until 10:46"). */
  undoPullFor?: (movementId: string) => ComingRowUndo | null;
  /** Ruling 11 (D-191): Confirm arrival with no pulled bed opens the pull step, then the arrival. */
  onPullThenArrive?: (movementId: string) => void;
  /** The bed board's filter, owned by the screen so the hero pills can set it. */
  bedFilter?: WardBedFilter;
  onBedFilterChange?: (filter: WardBedFilter) => void;
  /** Find box text from the screen's tool row: beds that do not match fade. */
  bedQuery?: string;
  /** Which list the Ward flow panel shows. */
  flowTab?: WardFlowTab;
  onFlowTabChange?: (tab: WardFlowTab) => void;
  /** Which view This shift shows. */
  shiftView?: WardShiftView;
  onShiftViewChange?: (view: WardShiftView) => void;
  /** True once the morning rollup is past its time and still not confirmed. */
  morningRollupOverdue?: boolean;
  /** Opens every arrival in full (the arrivals view). */
  onOpenArrivals?: () => void;
  /** Opens the full bed list. */
  onOpenBeds?: () => void;
  /** Lets the screen return focus to a bed's tile when its drawer closes. */
  registerBedTrigger?: (bedNumber: number, element: HTMLButtonElement | null) => void;
  /**
   * Bed board (v10 pass 3, opened by Place or move): replaces Every bed and This shift, so Ward flow
   * stays beside it in the rail exactly as on Home.
   */
  bedArea?: React.ReactNode;
  /**
   * Phone (v10): which of This shift or Ward flow is open as a bottom sheet. Passed only on a
   * phone; when it is undefined the cards sit in the page as on desktop.
   */
  phonePanel?: "shift" | "flow" | null;
  onPhonePanelChange?: (panel: "shift" | "flow" | null) => void;
  /** Desktop and iPad (WH2, 3 Nov 2026): whether the This shift sheet is open over Ward home. */
  shiftSheetOpen?: boolean;
  onShiftSheetOpenChange?: (open: boolean) => void;
  /** Phone: the hero's foot facts (shift, cohort, roster, checking), kept in Ward figures. */
  phoneHeroFoot?: React.ReactNode;
  /** Phone: the one line under Ward figures, right now, while it is closed. */
  phoneFiguresSummary?: string;
  /** Phone: the find box, which sits under Every bed. */
  phoneFind?: React.ReactNode;
  /** Phone: the shift name and hours, under the This shift sheet's title. */
  phoneShiftLabel?: string;
  /** Phone: tells the screen a bed's card is open in the round, so the ward card steps aside. */
  onWalkingChange?: (walking: boolean) => void;
  /** Opens placing and moving (the bed board) inside Ward home (`WardPlaceOrMove`). */
  onOpenBoard?: () => void;
  /** People accepted for this ward and waiting to be placed in a bed. */
  boardWaitingCount?: number;
}

export function WardHomeTab({
  unit,
  units,
  accepted,
  heldAfterStop = [],
  incoming,
  withdrawn,
  overridesHere,
  now,
  visibleIncoming,
  declineOpenFor,
  toggleDecline,
  declineReason,
  setDeclineReason,
  submitDecline,
  priorRejectionCountRef,
  rejections,
  setCheckToken,
  recentAnswers,
  resolvePatientIdentity,
  lastActionRejection,
  overrideReasonForm,
  onAcceptInPrinciple,
  answerBlockedReason,
  liveFormAlerts,
  morningRollupConfirmed = false,
  morningRollupTimeLabel = "09:30",
  onConfirmMorningRollup,
  onConfirmBedsAndMorningRollup,
  onOpenConfirmNumbers,
  onOpenArrival,
  onPullPatient,
  onOpenDischarges,
  onOpenDecisions,
  bedsList,
  absencesOnOrder = [],
  onSelectBed,
  squaresAfter,
  undoPullFor,
  onPullThenArrive,
  bedFilter: bedFilterProp,
  onBedFilterChange,
  bedQuery = "",
  onFlowTabChange,
  shiftView: shiftViewProp,
  onShiftViewChange,
  morningRollupOverdue = false,
  onOpenArrivals,
  onOpenBeds,
  registerBedTrigger,
  bedArea,
  phonePanel,
  onPhonePanelChange,
  shiftSheetOpen: shiftSheetOpenProp,
  onShiftSheetOpenChange,
  phoneHeroFoot,
  phoneFiguresSummary,
  phoneFind,
  phoneShiftLabel,
  onWalkingChange,
  onOpenBoard,
  boardWaitingCount = 0,
  onConfirmRelease,
}: WardHomeTabProps) {
  const [, startTransition] = useTransition();
  const phoneSheets = phonePanel !== undefined;
  const {
    bedReleases,
    leaveBeds = [],
    admissions = [],
    configuration,
    dayZero,
  } = useWardFlowSelect("bedReleases", "leaveBeds", "admissions", "configuration", "dayZero");
  const outlook = useWardTomorrowOutlook(unit, accepted, now); // WH3: tomorrow for this ward alone
  const pendingPreparation = bedsPendingPreparation(unit.id, bedReleases);
  const [localChecks, setLocalChecks] = useState<Record<string, Instant | null>>({
    drugs: null,
    seclusion: null,
    afternoon: null,
  });

  // Derived real ward activity events for overhauled Shift Coordinator Log
  const pendingBedReleases = useMemo(() => openBedReleases(bedReleases, unit.id), [bedReleases, unit.id]);
  const dischargedBedReleases = useMemo(
    () => bedReleases.filter((release) => release.unitId === unit.id && release.state === "discharged"),
    [bedReleases, unit.id],
  );
  const unitLeaveBeds = useMemo(() => (leaveBeds ?? []).filter((bed) => bed.unitId === unit.id), [leaveBeds, unit.id]);

  function toggleLocalCheck(id: string) {
    setLocalChecks((current) => ({ ...current, [id]: current[id] === null ? now : null }));
  }

  const [referralDetailFor, setReferralDetailFor] = useState<string | null>(null);

  // Q93 (Josh, 1 Nov 2026): no referral is accepted in one tap. Accept opens the named accept
  // dialog, with its pull time limit, and nothing is recorded until it is confirmed.
  const [acceptFor, setAcceptFor] = useState<string | null>(null);
  const [acceptExtended, setAcceptExtended] = useState(false);
  const acceptDialogRef = useRef<HTMLDivElement | null>(null);

  function acceptIncoming(movementId: string) {
    setAcceptExtended(false);
    setAcceptFor(movementId);
  }

  function recordAccept(movementId: string, extendedHold: boolean) {
    if (onAcceptInPrinciple) {
      onAcceptInPrinciple(movementId, unit.id, extendedHold);
    } else {
      priorRejectionCountRef.current = rejections.length;
      setCheckToken((token) => token + 1);
    }
  }

  // Wave 4: Ward flow's list switch is gone, so a "referrals" pick only scrolls to the part.
  const setFlowTab = (next: WardFlowTab) => {
    startTransition(() => {
      onFlowTabChange?.(next);
    });
  };
  const [innerShiftView, setInnerShiftView] = useState<WardShiftView>("todo");
  const shiftView = shiftViewProp ?? innerShiftView;
  const setShiftView = (next: WardShiftView) => {
    startTransition(() => {
      (onShiftViewChange ?? setInnerShiftView)(next);
    });
  };
  const [innerShiftSheetOpen, setInnerShiftSheetOpen] = useState(false);
  const shiftSheetOpen = shiftSheetOpenProp ?? innerShiftSheetOpen;
  const setShiftSheetOpen = onShiftSheetOpenChange ?? setInnerShiftSheetOpen;
  const [boardView, setBoardView] = useState<"board" | "list">("board");
  const isPhone = useIsPhone();
  // Site bed manager (approved 31 Oct 2026): it looks after the site's beds, not the ward's own round
  // and reminder ticks, so those are left out for it and Morning bed numbers leads This shift.
  const isSiteBedManager = useEffectiveWardAccess().role === "bed_manager";

  function focusAwaiting() {
    setFlowTab("referrals");
    window.requestAnimationFrame(() => {
      const target = document.getElementById("ward-awaiting-answer");
      target?.scrollIntoView({ block: "nearest" });
      target?.focus();
    });
  }
  // Wave 4: Coming and going sits in the page on a phone too, so a request to open the old Ward flow
  // sheet (the Referrals tab's "Answer on Ward home") moves to the waiting referrals instead.
  const flowAsked = phonePanel === "flow";
  useEffect(() => {
    if (!flowAsked) return;
    onPhonePanelChange?.(null);
    window.requestAnimationFrame(() => {
      const target = document.getElementById("ward-awaiting-answer");
      target?.scrollIntoView({ block: "nearest" });
      target?.focus();
    });
  }, [flowAsked, onPhonePanelChange]);

  function runAlert(alert: (typeof liveFormAlerts)[number]) {
    if (alert.actionTarget === "answer") {
      focusAwaiting();
      return;
    }
    if (alert.actionTarget === "arrival" && alert.movementId) onOpenArrival?.(alert.movementId);
    if (alert.actionTarget === "discharges") onOpenDischarges?.();
  }

  const capacityConfirmed = unit.allocatable.confirmedAt !== undefined;
  // Done only when the figures were confirmed during this shift; an older confirmation is not.
  const capacityConfirmedThisShift = capacityConfirmed && unit.allocatable.confirmedAt >= currentShiftStartInstant(now);
  const referralsClear = incoming.length === 0;
  // UX audit 21 Oct 2026: the three local ticks are reminders kept on this screen only, so they are
  // not counted as shift checks done. Only recorded facts count.
  const shiftChecks = [capacityConfirmedThisShift, morningRollupConfirmed, referralsClear];
  const checksDone = shiftChecks.filter(Boolean).length;

  const logRows: WardShiftLogRow[] = [];
  if (capacityConfirmed && unit.allocatable.confirmedAt !== undefined) {
    logRows.push({
      key: "capacity",
      at: unit.allocatable.confirmedAt,
      timeLabel: formatInstant(unit.allocatable.confirmedAt),
      title: "Capacity confirmed",
      detail: `${unit.allocatable.value} ${unit.allocatable.value === 1 ? "bed" : "beds"} free for a new patient`,
      status: "Confirmed by ward",
    });
  }
  logRows.push(...pendingDepartureLogRows(pendingBedReleases, admissions, now));
  for (const release of dischargedBedReleases) {
    logRows.push({
      key: `clean-${release.id}`,
      at: release.confirmedAt,
      timeLabel: formatInstantWithDay(release.confirmedAt, now),
      title: "Discharge completed",
      detail: release.preparationNote ?? (release.preparing ? "Being made ready" : "Clean not recorded"),
      status: "Clean",
    });
  }
  for (const leaveBed of unitLeaveBeds) {
    logRows.push({
      key: `leave-${leaveBed.id}`,
      at: leaveBed.confirmedAt,
      timeLabel: formatInstantWithDay(leaveBed.confirmedAt, now),
      title: leaveBed.absentWithoutLeave ? "Absent without leave" : "Approved leave",
      detail: leaveBed.absentWithoutLeave
        ? `Since ${formatInstantWithDay(leaveBed.absentWithoutLeave.since, now)}`
        : `Expected back ${formatInstant(leaveBed.expectedReturn)}`,
      status: "Leave",
    });
  }
  if (accepted.length > 0) {
    logRows.push({
      key: "inbound",
      at: now,
      timeLabel: "Now",
      title: "Inbound accepted",
      detail: `${resolvePatientIdentity(accepted[0]).formalName}${accepted.length > 1 ? ` and ${accepted.length - 1} more` : ""}`,
      status: "En route",
    });
  }
  logRows.sort((left, right) => right.at - left.at);

  // Every bed: one tile per bed from the same list the bed board draws, so both always agree.
  // The same releases the hero's "Ready by" figure counts, so its pill shows the beds it counted.
  const freeingByShiftEnd = new Set(
    releasesDueByShiftEnd(bedReleases, unit.id, now).map((release) => release.admissionId),
  );
  const bedRows = (bedsList ?? []).map((bed) => {
    // A bed still being made ready is not free to offer, matching the Bed Board.
    const preparing = bed.status === "ready" && bed.preparing === true;
    const free = bed.status === "ready" && !preparing;
    const readyByShiftEnd =
      bed.status === "ready" || (bed.admissionId !== undefined && freeingByShiftEnd.has(bed.admissionId));
    const leaving = !free && (bed.dischargeConfirmed === true || (bed.expectedDays != null && bed.expectedDays <= 0));
    const awayAtEd = bed.awayAtEdHours != null;
    // WT-07: the officer recorded Delivered, so the pull clock has stopped and the ward confirms.
    const delivered = bed.status === "incoming" && typeof bed.deliveredAt === "number";
    const look =
      !free && (bed.pastDate === true || awayAtEd || Boolean(bed.dischargeBarrier) || Boolean(bed.blockReason));
    const stateWord =
      bed.status === "ready"
        ? preparing
          ? BED_STATE_LABELS.beingMadeReady
          : "Ready"
        : bed.status === "leave"
          ? bed.statusText === "Absent without leave"
            ? "Absent without leave"
            : "On leave"
          : bed.status === "incoming"
            ? delivered
              ? "Arrived at ward"
              : "Pulled"
            : bed.status === "closed"
              ? "Closed"
              : "Occupied";
    const days = typeof bed.stayDays === "number" ? `${bed.stayDays}d` : "";
    // Audit A1-3: every pulled bed shows its hold time, from the one bed-hold rule.
    const hold = bed.status === "incoming" ? (bed.bedHold ?? null) : null;
    // Item 6: a closed bed with a review time says it on the tile ("Review 14:00", "Review overdue").
    const note =
      bed.status === "closed" && bed.closedReview
        ? bed.closedReview
        : hold
          ? hold.label
          : delivered
            ? `Arrived at ward ${formatInstantWithDay(bed.deliveredAt as Instant, now)}, confirm arrival`
            : awayAtEd
              ? `Away at an ED ${bed.awayAtEdHours}h`
              : bed.blockReason
                ? `Held up, ${String(bed.blockReason)}`
                : bed.pastDate
                  ? "Past date"
                  : bed.dischargeBarrier
                    ? String(bed.dischargeBarrier)
                    : leaving
                      ? bed.dischargeConfirmed
                        ? "Discharge confirmed"
                        : "Expected out today"
                      : bed.isSpecialling && bed.observation
                        ? observationSummary(bed.observation)
                        : bed.criteriaLedChip && bed.status === "occupied"
                          ? bed.criteriaLedChip.label
                          : free
                            ? "Ready"
                            : stateWord;
    // U1 (site review, 12 Oct 2026): the tile's status word is short so it never truncates
    // ("Discharge confir…", "Held up, Awaiti…"). The full note stays in the accessible name, the
    // list view and the bed panel.
    const tileNote = hold
      ? hold.short
      : delivered
        ? "Confirm arrival"
        : awayAtEd
          ? `At ED ${bed.awayAtEdHours}h`
          : bed.blockReason
            ? "Held up"
            : bed.pastDate
              ? "Past date"
              : bed.dischargeBarrier
                ? "Held up"
                : leaving
                  ? bed.dischargeConfirmed
                    ? "Confirmed out"
                    : "Discharge due"
                  : bed.isSpecialling && bed.observation
                    ? `Constant ${observationRatio(bed.observation.level)}`
                    : note;
    const glyph = bedGlyphTone(bed);
    // C3 (phone simplification, 19 Oct 2026): one word for the phone bed strip, from the same state.
    const stripWord = bedStripWord(bed, { free, preparing, awayAtEd, leaving });
    // D-64: when a higher note takes the tile (Past date, Due out), the CLD state still shows as a tag.
    const criteriaTag = bed.criteriaLedChip && note !== bed.criteriaLedChip.label ? bed.criteriaLedChip : null;
    const number = String(bed.bedNumber).padStart(2, "0");
    const name = free ? "Ready" : (bed.patientAlias ?? stateWord);
    // The occupant's name is shown on the tile, so a screen reader hears it too.
    const spokenState = [
      stateWord,
      days ? `${bed.stayDays} days in bed` : "",
      // A tile showing the short CLD chip is read out in full; otherwise the CLD state is added.
      bed.criteriaLedChip && note === bed.criteriaLedChip.label ? bed.criteriaLedChip.phrase : note,
      bed.criteriaLedChip && note !== bed.criteriaLedChip.label ? bed.criteriaLedChip.phrase : "",
    ];
    const accessibleName = [bed.bedLabel, free ? "" : (bed.patientAlias ?? ""), ...spokenState]
      .filter(Boolean)
      .join(", ");
    // CB-3 (axe 4.14 label-content-name-mismatch): the tile's name reads its own words first, in order.
    const shownNote = free ? (stateWord === name ? "" : stateWord) : note === name ? "" : tileNote;
    const tileName = [bed.bedLabel, criteriaTag?.label ?? "", name, tileStateLine(shownNote, days), ...spokenState]
      .filter(Boolean)
      .join(", ");
    return {
      bed,
      free,
      shownNote,
      tileName,
      // Q7 (4 Nov 2026): the Ready chip and hero pill count as the hero and board do (`boardReadyCounts`).
      // D-179 item 8: a bed still being made ready is not Ready.
      readyNow: bed.status === "ready" && bed.heldFor === undefined && bed.preparing !== true,
      leaving,
      look,
      readyByShiftEnd,
      stateWord,
      days,
      note,
      tileNote,
      stripWord,
      criteriaTag,
      glyph,
      number,
      name,
      accessibleName,
    };
  });
  // Batch 4 item 25 (D-142): each bed says so in full until the ward confirms after a recorded outage.
  const outageTags = useWardOutageCatchUp(unit, now)?.caughtUp === false;
  const [innerBedFilter, setInnerBedFilter] = useState<WardBedFilter>("all");
  const bedFilter = bedFilterProp ?? innerBedFilter;
  const setBedFilter = onBedFilterChange ?? setInnerBedFilter;
  // v10: a filter or a search highlights the beds it matches and dims the rest by colour. No bed
  // is ever hidden, so the board keeps its shape and every tile stays focusable.
  const matchesFilter = (row: (typeof bedRows)[number]) => {
    switch (bedFilter) {
      case "look":
        return row.look;
      case "leaving":
        return row.leaving;
      case "free":
        return row.readyNow;
      case "occupied":
        // The ruled Occupied state, as the hero and the bed figures count it (leave holds inside).
        return row.bed.status === "occupied" || row.bed.status === "leave";
      case "shift-end":
        return row.readyByShiftEnd;
      default:
        return true;
    }
  };
  // Search audit, 8 Nov 2026: "bed" (or "beds") alone names no bed, so it lights nothing and dims nothing.
  const typedBedQuery = bedQuery.trim().toLowerCase();
  const query = /^beds?$/.test(typedBedQuery) ? "" : typedBedQuery;
  // Every word, folded, in any order: "bed 4" or a name typed without its apostrophe (31 Oct 2026).
  const matchesQuery = (row: (typeof bedRows)[number]) =>
    query === "" ||
    fieldsMatchEveryWord(query, [`bed ${row.number}`, row.bed.bedLabel, String(row.bed.patientAlias ?? "")], ["bed"]) ||
    row.number === query;
  const highlighting = bedFilter !== "all" || query !== "";
  const isLit = (row: (typeof bedRows)[number]) => matchesFilter(row) && matchesQuery(row);
  const litCount = bedRows.filter(isLit).length;
  const makingReady = bedRows.filter(
    (row) => row.bed.status === "ready" && row.bed.heldFor === undefined && row.bed.preparing === true,
  ).length;
  const shownBeds = bedRows;
  // One partition, the ruled four bed states, so this key, the hero and the bed figures agree.
  const bedTally = {
    occupied: bedRows.filter((row) => row.bed.status === "occupied" || row.bed.status === "leave").length,
    free: bedRows.filter((row) => row.free).length,
    pulled: bedRows.filter((row) => row.bed.status === "incoming").length,
    closed: bedRows.filter((row) => row.bed.status === "closed").length,
  };
  // Option B (Josh, 20 Oct 2026): Ward home is the run-through, one bed at a time in bed order;
  // Bed board is the map. The round's list is plain bed order, never grouped or re-sorted.
  // Item 23: the walk round's state sits here, above the phone and desktop branch, so turning the
  // phone to landscape and back keeps the round.
  const walkBeds = walkRoundBeds(bedRows, pendingBedReleases);
  const [walkRound, setWalkRound] = useWalkRound(unit.id, walkBeds);
  const walkRowLabel = (name: string, marks: WalkRoundMark) =>
    [
      name,
      marks.changed ? "changed this round" : "",
      marks.reviewed ? "reviewed" : "",
      // The site bed manager has no round, so a row opens the bed.
      isSiteBedManager ? "open the bed" : "open in the round",
    ]
      .filter(Boolean)
      .join(", ");
  const walkingOnPhone = isPhone && phoneSheets && walkRound.walking !== null;
  useEffect(() => {
    onWalkingChange?.(walkingOnPhone);
  }, [onWalkingChange, walkingOnPhone]);
  const phoneRoundList = (mark: (bedNumber: number) => WalkRoundMark, walkFrom: (bedNumber: number) => void) => (
    <WardPhoneRoundList
      rows={bedRows}
      unitName={unit.name}
      mark={mark}
      walkFrom={walkFrom}
      isLit={isLit}
      rowLabel={walkRowLabel}
      outage={outageTags}
    />
  );

  const bedByAdmission = (admissionId: string | undefined) =>
    admissionId === undefined ? undefined : (bedsList ?? []).find((item) => item.admissionId === admissionId);

  // Wave 4 (D-191): Coming and going, one list in place of Ward flow's three-way switch. Every row
  // names the person and the bed; the counts use the selectors this page already had.
  const deskRole = useEffectiveWardAccess().role;
  const nameOf = (movement: Movement) => resolvePatientIdentity(movement).formalName;
  // Accepted referrals with no movement yet stay off this page: the shared pull step needs the full
  // referral, which FD-23 keeps from ward-only modules (tests/ward-referral-screen-boundary.test.ts).
  // Review F-3: "Arrivals · today" lists only people expected today, by the hero's own rule.
  // Review P4-4: the rest of the accepted list is due on a later day, said under the group.
  const arrivingToday = arrivalsExpectedToday(accepted, now);
  const laterArrivals = accepted.length - arrivingToday.length;
  const comingArrivals = arrivalRows({
    accepted: arrivingToday,
    beds: bedsList ?? [],
    unit,
    now,
    nameOf,
    desk: deskRole,
  });
  const comingLeave = comingLeaveRows(unitLeaveBeds, bedsList ?? [], now);
  // Review FS-9: the time column says the date ("14 Nov"), as Capacity's held-up rail does.
  const rowDate = shortDateLabel(dayZero, now);
  const needsALook = needsALookRows(pendingBedReleases, bedsList ?? [], now, rowDate);
  const dischargesToday = dischargeTodayRows(pendingBedReleases, bedsList ?? [], now, rowDate);

  // This shift: one to do list, sorted into act now, later today and done. Every row is a recorded
  // fact or one of the ward's own reminder ticks, which are listed but never counted as to do.
  // D-191 item 5 (Josh, 13 Nov 2026): held up is due by tomorrow, as everywhere but Discharges.
  const heldUp = heldUpDueByTomorrow(pendingBedReleases, now);
  type TodoRow = {
    key: string;
    title: string;
    detail: string;
    meta?: string;
    tone: WfTone;
    action?: { label: string; run: () => void };
    secondaryAction?: { label: string; run: () => void };
    tick?: keyof typeof localChecks;
  };
  const actNow: TodoRow[] = [
    // Audit A3-1: absent without leave on an order is the most urgent row, as on the task list.
    ...absencesOnOrder.map(({ leaveBed, admission }): TodoRow => {
      const bed = bedByAdmission(admission.id);
      return {
        key: `absent-${admission.id}`,
        title: "Absent without leave on an order",
        detail: `${bed?.bedLabel ?? "A bed"} missing since ${formatInstantWithDay(leaveBed.absentWithoutLeave.since, now)}, order stays in force`,
        tone: "danger",
        action: bed ? { label: "Open bed", run: () => onSelectBed?.(Number(bed.bedNumber)) } : undefined,
      };
    }),
    ...liveFormAlerts.map((alert): TodoRow => ({
      key: alert.key,
      title: alert.title,
      detail: alert.text,
      meta: alert.countdown,
      tone: alert.tone === "critical" ? "danger" : alert.tone === "warning" ? "warning" : "info",
      action: alert.actionLabel
        ? {
            label: alert.actionLabel,
            run: () => {
              runAlert(alert);
            },
          }
        : undefined,
    })),
  ];
  if (incoming.length > 0) {
    actNow.push({
      key: "referrals",
      title: "Referrals waiting",
      // Polish (1 Nov 2026): no count under these rows; the detail already names each bed or count.
      detail: `${incoming.length} waiting for this ward's answer`,
      tone: "danger",
      action: { label: "Answer", run: focusAwaiting },
    });
  }
  if (heldUp.length > 0) {
    actNow.push({
      key: "held",
      title: BED_RELEASE_BLOCKED_FIGURE_LABEL,
      detail: heldUp
        .map((release) => `${bedByAdmission(release.admissionId)?.bedLabel ?? "A bed"} ${release.blocker}`)
        .join(", "),
      tone: "danger",
      action: { label: "Review", run: () => onOpenDischarges?.() },
    });
  }
  // Audit A1-3: a lapsed bed hold is act now on its ward, the same rule Handover and Tasks use.
  const lapsedHolds = (bedsList ?? []).filter((bed) => bed.status === "incoming" && bed.bedHold?.state === "lapsed");
  if (lapsedHolds.length > 0) {
    actNow.push({
      key: "holds",
      title: lapsedHolds.length === 1 ? "Pull expired, bed still pulled" : "Pulls expired, beds still pulled",
      detail: lapsedHolds
        .map(
          (bed) =>
            `${bed.bedLabel}${bed.patientAlias ? ` ${bed.patientAlias}` : ""}, ${bed.bedHold!.short.toLowerCase()}`,
        )
        .join("; "),
      tone: "danger",
      action: { label: "Move or release", run: () => onSelectBed?.(Number(lapsedHolds[0]!.bedNumber)) },
    });
  }
  if (heldAfterStop.length > 0) {
    actNow.push({
      key: "stopped-holds",
      title:
        heldAfterStop.length === 1 ? "Stopped transport, bed still pulled" : "Stopped transports, beds still pulled",
      detail: heldAfterStop
        .map((movement) => `${resolvePatientIdentity(movement).formalName}, transport stopped after collection`)
        .join("; "),
      tone: "warning",
      action: onOpenArrivals ? { label: "Release pulled bed", run: onOpenArrivals } : undefined,
    });
  }
  if (morningRollupOverdue && !morningRollupConfirmed) {
    actNow.push({
      key: "rollup",
      // Overall review (20 Oct 2026): "morning rollup" and "allocatable" were project jargon; these
      // match the ward decisions list ("Morning bed numbers not confirmed, due 09:30").
      title: "Morning bed numbers",
      detail: `Not confirmed, due ${morningRollupTimeLabel}`,
      tone: "danger",
      action: { label: "Confirm", run: () => onConfirmMorningRollup?.() },
      secondaryAction:
        !capacityConfirmedThisShift && onConfirmBedsAndMorningRollup
          ? {
              label: `Confirm beds and morning numbers (due ${morningRollupTimeLabel})`,
              run: () => onConfirmBedsAndMorningRollup(),
            }
          : onOpenDischarges
            ? {
                label: "Review today's expected discharges",
                run: () => onOpenDischarges(),
              }
            : undefined,
    });
  }
  const laterToday: TodoRow[] = [];
  const doneRows: TodoRow[] = [];
  if (capacityConfirmedThisShift) {
    doneRows.push({
      key: "capacity",
      title: "Capacity numbers",
      detail: `Confirmed ${formatInstant(unit.allocatable.confirmedAt)}`,
      tone: "success",
    });
  } else {
    laterToday.push({
      key: "capacity",
      title: "Capacity numbers",
      detail: "Not confirmed this shift",
      tone: "neutral",
      action: { label: "Confirm", run: () => onOpenConfirmNumbers?.() },
      secondaryAction:
        !morningRollupConfirmed && onConfirmBedsAndMorningRollup
          ? {
              label: `Confirm beds and morning numbers (due ${morningRollupTimeLabel})`,
              run: () => onConfirmBedsAndMorningRollup(),
            }
          : onOpenDischarges
            ? {
                label: "Review today's expected discharges",
                run: () => onOpenDischarges(),
              }
            : undefined,
    });
  }
  if (morningRollupConfirmed) {
    doneRows.push({
      key: "rollup",
      title: "Morning bed numbers",
      detail: "Confirmed today",
      tone: "success",
      secondaryAction: onOpenDischarges
        ? {
            label: "Review today's expected discharges",
            run: () => onOpenDischarges(),
          }
        : undefined,
    });
  } else if (!morningRollupOverdue) {
    laterToday.push({
      key: "rollup",
      title: "Morning bed numbers",
      detail: "Still due",
      tone: "neutral",
      action: { label: "Confirm", run: () => onConfirmMorningRollup?.() },
      secondaryAction:
        !capacityConfirmedThisShift && onConfirmBedsAndMorningRollup
          ? {
              label: `Confirm beds and morning numbers (due ${morningRollupTimeLabel})`,
              run: () => onConfirmBedsAndMorningRollup(),
            }
          : onOpenDischarges
            ? {
                label: "Review today's expected discharges",
                run: () => onOpenDischarges(),
              }
            : undefined,
    });
  }
  if (referralsClear) {
    doneRows.push({ key: "referrals", title: "Unanswered referrals", detail: "None waiting", tone: "success" });
  }
  const signOff = pendingBedReleases.length - heldUp.length;
  if (signOff > 0) {
    laterToday.push({
      key: "departures",
      title: "Discharges to sign off",
      // Same population as the Discharges tab: every open release, held up ones counted apart.
      // Every figure names its noun (audit 11 Oct 2026): the bare "12" beside "14 open" read as a
      // third discharge count.
      detail: `${signOff} ready · ${heldUp.length} held up · ${pendingBedReleases.length} open`,
      tone: "neutral",
      action: { label: "Open", run: () => onOpenDecisions?.() },
      secondaryAction: onOpenDischarges
        ? {
            label: "Review today's expected discharges",
            run: () => onOpenDischarges(),
          }
        : undefined,
    });
  }
  // Top 25 item 5: each stay due out within the discharge prep window, with its barrier, so the
  // barrier is recorded before the day. Named by bed, like every discharge row on this list.
  const dueSoon = deriveAfternoonDischarges(
    admissions.filter((admission) => admission.unitId === unit.id && admission.state === "occupied"),
    now,
  );
  for (const admission of dueSoon) {
    const bed = bedByAdmission(admission.id);
    if (!bed || admission.expectedDischargeAt === null) continue;
    const holdUp = admission.blockReason ?? admission.dischargeBarrier;
    laterToday.push({
      key: `prep-${admission.id}`,
      title: `${bed.bedLabel} discharge due ${formatInstantWithDay(admission.expectedDischargeAt, now)}`,
      detail: holdUp ? `Held up: ${holdUp}` : "Hold-up not recorded",
      tone: holdUp ? "warning" : "neutral",
      action: { label: "Open bed", run: () => onSelectBed?.(Number(bed.bedNumber)) },
    });
  }
  // Top 25 item 4: a bed still being made ready past the set time asks the ward to confirm it is
  // ready. The row only opens the bed; Ready in the bed panel is what offers it again.
  for (const { release, minutes } of stalePreparingReleases(unit.id, bedReleases, now)) {
    const bed = (bedsList ?? []).find((item) => item.preparingReleaseId === release.id);
    if (!bed) continue;
    laterToday.push({
      key: `preparing-${release.id}`,
      title: `${bed.bedLabel} still being made ready`,
      detail: `For ${durMinutes(minutes)}. Is it ready now?`,
      tone: "warning",
      action: { label: "Check bed", run: () => onSelectBed?.(Number(bed.bedNumber)) },
    });
  }
  // The ward's own reminder ticks are not offered to the site bed manager.
  for (const [id, label, hint, at] of isSiteBedManager
    ? []
    : ([
        ["drugs", "Controlled drug count", "Check the register.", localChecks.drugs],
        ["seclusion", "Seclusion check", "Check the suite and duress alarm.", localChecks.seclusion],
        ["afternoon", "Afternoon sign-off", "Sign the midday numbers.", localChecks.afternoon],
      ] as const)) {
    const row: TodoRow = {
      key: id,
      title: label,
      detail: at === null ? hint : "Ticked here only.",
      meta: at === null ? undefined : formatInstantWithDay(at, now),
      tone: at === null ? "neutral" : "success",
      tick: id,
    };
    (at === null ? laterToday : doneRows).push(row);
  }
  // Site bed manager: Morning bed numbers, with its Confirm, leads its column of This shift.
  if (isSiteBedManager) {
    for (const rows of [actNow, laterToday])
      rows.sort((a, b) => Number(b.key === "rollup") - Number(a.key === "rollup"));
  }
  // Polish (1 Nov 2026): several rows offer the same "Review today's expected discharges" link; it
  // shows once, on the first row that carries it, so the columns do not repeat it.
  {
    let reviewShown = false;
    for (const row of [...actNow, ...laterToday, ...doneRows]) {
      if (row.secondaryAction?.label !== "Review today's expected discharges") continue;
      if (reviewShown) row.secondaryAction = undefined;
      reviewShown = true;
    }
  }
  const todoOpen = actNow.length + laterToday.filter((row) => !row.tick).length;

  // Polish (1 Nov 2026): three columns, each a quiet head with its count, then one row a task with
  // its action on the right and any time or count under the detail.
  function renderTodoColumn(id: string, title: string, tone: WfTone, rows: TodoRow[]) {
    const items = rows.filter((row) => !row.tick);
    const reminders = rows.filter((row) => row.tick);
    return (
      <section className={styles.todoCol} data-tone={tone} aria-labelledby={`ward-todo-${id}`}>
        <div className={styles.groupHead}>
          <StatusGlyph tone={tone} size={9} />
          <h3 id={`ward-todo-${id}`} className={styles.groupTitle}>
            {title}
          </h3>
          <Count n={items.length} />
        </div>
        {items.length === 0 ? <p className={styles.groupEmpty}>Nothing here.</p> : renderTodoList(items)}
        {reminders.length > 0 ? (
          <>
            <h4 className={styles.groupHead}>Reminders, not saved</h4>
            {renderTodoList(reminders)}
          </>
        ) : null}
      </section>
    );
  }

  // The This shift sheet steps aside when a task opens a bed, a dialog or another view (WH2).
  function runFromSheet(run: () => void) {
    if (!phoneSheets) setShiftSheetOpen(false);
    run();
  }

  function renderTodoList(rows: TodoRow[]) {
    return (
      <ul className={styles.todoList}>
        {rows.map((row) => (
          <li key={row.key} className={styles.todoItem}>
            <div className={styles.todoRow}>
              <StatusGlyph tone={row.tone} size={9} />
              {row.tick ? (
                <label className={styles.todoMain}>
                  <input
                    type="checkbox"
                    className={styles.todoTick}
                    checked={localChecks[row.tick] !== null}
                    onChange={() => {
                      if (row.tick) toggleLocalCheck(row.tick);
                    }}
                    aria-label={row.title}
                  />
                  <span className={styles.todoTitle}>{row.title}</span>
                  <span className={styles.todoDetail}>{row.detail}</span>
                </label>
              ) : (
                <span className={styles.todoMain}>
                  <span className={styles.todoTitle}>{row.title}</span>
                  <span className={styles.todoDetail} title={row.detail}>
                    {row.detail}
                  </span>
                </span>
              )}
              {row.meta ? <span className={styles.todoMeta}>{row.meta}</span> : null}
              {row.action ? (
                <button
                  type="button"
                  className={buttonClass({ variant: "sec", size: "sm" })}
                  onClick={() => runFromSheet(row.action!.run)}
                >
                  {row.action.label}
                  <SrOnly> {row.title}</SrOnly>
                </button>
              ) : null}
            </div>
            {row.secondaryAction ? (
              <button
                type="button"
                className={`${buttonClass({ variant: "ghost", size: "sm" })} ${styles.todoSecondary}`}
                onClick={() => runFromSheet(row.secondaryAction!.run)}
              >
                {row.secondaryAction.label}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    );
  }

  const declineLeftNote = declineTargetLeftNote(declineOpenFor, incoming, recentAnswers, (id) =>
    withdrawn.some((movement) => movement.id === id),
  );

  // Wave 4 (D-191): the squares, from the same bed rows as the tiles, so a tile's mark matches its square.
  const freeingToday = new Set(wardDischargesDueToday(pendingBedReleases, now).map((release) => release.admissionId));
  const squareOf = (bed: BedItem) =>
    bedSquareFor(bed, bed.admissionId !== undefined && freeingToday.has(bed.admissionId));
  const everySquares = (
    <WardEverySquares
      unit={unit}
      squares={bedRows.map((row) => squareOf(row.bed))}
      heldUp={heldUp.length}
      pulled={bedTally.pulled}
      onLeave={unitLeaveBeds.length}
      after={squaresAfter}
    />
  );

  const bedKeyBlock = (
    <div className={styles.bedKey}>
      {/* Wave 4 (D-191): the squares' key, then the row glyphs, in one line at the card foot. */}
      <BedSquaresKey className={styles.squaresKey} />
      <span className={styles.keyItems} role="group" aria-label="Symbol key">
        <span>
          <StatusGlyph tone="danger" size={9} />
          Act now
        </span>
        <span>
          <StatusGlyph tone="warning" size={9} />
          At risk
        </span>
        <span>
          <StatusGlyph tone="info" size={9} />
          Moving
        </span>
        <span>
          <StatusGlyph tone="neutral" size={9} />
          Waiting
        </span>
      </span>
      {onOpenBeds ? (
        <button type="button" className={styles.keyLink} onClick={onOpenBeds}>
          Full bed list
        </button>
      ) : null}
    </div>
  );

  // WH5 (3 Nov 2026): a quiet, static mark that the figures are current. No pulse.
  const liveMark = (
    <span className={styles.liveMark}>
      <span className={styles.liveDot} aria-hidden="true" />
      Updated {formatInstantWithDay(now, now)}
    </span>
  );

  function refusalUnder(movementId: string) {
    return lastActionRejection?.movementId === movementId ? (
      <span className={styles.noticeProminent} role="alert">
        {WARD_ACTION_REJECTION_LABELS[lastActionRejection.attempted] ?? lastActionRejection.attempted} not recorded:{" "}
        {wardSafeRejectionReason(lastActionRejection.reason)}
      </span>
    ) : null;
  }

  function confirmArrival(row: ComingRow) {
    // Ruling 11 (D-191): with no pulled bed the pull step comes first, then the arrival.
    if (!row.movementId) return;
    // Only a row still waiting for its bed: the engine pulls at that stage alone (PULL_PATIENT).
    if (row.action === "pull" && !row.hasPulledBed && onPullThenArrive) {
      onPullThenArrive(row.movementId);
      return;
    }
    onOpenArrival?.(row.movementId);
  }

  function renderFlowCard() {
    return (
      <WardComingAndGoing
        phone={phoneSheets}
        updated={liveMark}
        arrivals={comingArrivals}
        laterArrivals={laterArrivals}
        backFromLeave={comingLeave}
        referralsWaiting={incoming.length}
        answeredToday={recentAnswers.length}
        referrals={
          <>
            <section
              id="ward-awaiting-answer"
              aria-label="Awaiting your answer"
              tabIndex={-1}
              className={styles.awaitingCard}
            >
              {declineLeftNote ? (
                <p className={styles.noticeProminent} role="status" data-testid="ward-decline-target-left">
                  {declineLeftNote}
                </p>
              ) : null}
              {incoming.length === 0 ? (
                <p className={styles.groupEmpty}>No referrals waiting.</p>
              ) : (
                <ul className={styles.awaitingList}>
                  {visibleIncoming.map((movement) => {
                    const blocked = answerBlockedReason ?? referralAnswerBlocked(movement, unit);
                    const notice = restrictionNotice(movement, unit);
                    const fit = referralFit(eligibility(movement, unit, now).gates, unit, now);
                    const wardLine = wardStateLine(fit, now, unit);
                    const declineOpen = declineOpenFor === movement.id;

                    return (
                      <li
                        key={movement.id}
                        className={styles.awaitingRow}
                        data-testid={`ward-incoming-${movement.id}`}
                        data-held-form={`movement:${movement.id}`}
                      >
                        <AwaitingIdentity
                          movement={movement}
                          person={resolvePatientIdentity(movement)}
                          now={now}
                          onOpen={() => setReferralDetailFor(movement.id)}
                        />

                        {notice ? (
                          <span
                            className={notice.level === "voluntary_on_locked" ? styles.noticeProminent : styles.notice}
                            data-testid={`ward-restriction-notice-${movement.id}`}
                            data-level={notice.level}
                          >
                            {notice.text}
                          </span>
                        ) : null}

                        <AwaitingFitLines
                          movementId={movement.id}
                          fit={fit}
                          wardLine={wardLine}
                          onUpdateBeds={onOpenConfirmNumbers}
                        />

                        <div className={styles.awaitingActions}>
                          <Button
                            variant="sec"
                            size="md"
                            data-placement-action
                            disabledReason={blocked}
                            reasonDisplay="tooltip"
                            type="button"
                            data-testid={`ward-decline-toggle-${movement.id}`}
                            aria-expanded={declineOpen}
                            onClick={
                              blocked
                                ? ignoreUnavailableActivation
                                : () => {
                                    toggleDecline(movement.id);
                                  }
                            }
                          >
                            Decline
                          </Button>
                          <Button
                            variant="pri"
                            size="md"
                            data-placement-action
                            disabledReason={blocked}
                            reasonDisplay="tooltip"
                            type="button"
                            data-testid={`ward-accept-${movement.id}`}
                            onClick={blocked ? ignoreUnavailableActivation : () => acceptIncoming(movement.id)}
                          >
                            Accept in principle
                          </Button>
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
                          <WardDeclineReasons
                            movementId={movement.id}
                            declineReason={declineReason}
                            onReason={(reason) => setDeclineReason(reason)}
                            onSubmit={(event) => submitDecline(event, movement.id)}
                            className={styles.declineForm}
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            {incoming.length > 0 ? (
              <Link className={styles.keyLink} href={`/ward-flow/ward/${unit.id}/answer`}>
                Answer one by one
              </Link>
            ) : null}
          </>
        }
        needsALook={needsALook}
        dischargesToday={dischargesToday}
        lastFreed={lastFreedToday(dischargedBedReleases, bedsList ?? [], now)}
        outlook={outlook}
        openReleases={pendingBedReleases.length}
        undoFor={(movementId) => undoPullFor?.(movementId) ?? null}
        refusalFor={refusalUnder}
        onPull={(row) => row.movementId && onPullPatient?.(row.movementId, unit.id)}
        onConfirmArrival={confirmArrival}
        onOpenArrival={(movementId) => onOpenArrival?.(movementId)}
        onOpenBed={(bedNumber) => onSelectBed?.(bedNumber)}
        onOpenArrivals={onOpenArrivals}
        onOpenDischarges={onOpenDischarges}
      />
    );
  }

  // WH2 (Josh, 3 Nov 2026): This shift is one summary line that opens a sheet. The sheet holds the
  // To do list and the shift's history (the old Log). Length of stay moved to Statistics, Wards.
  const shiftSummary = `${checksDone} of ${shiftChecks.length} checks done, ${todoOpen} to do`;
  const shiftSwitch = (
    <Segmented
      label="This shift view"
      items={[
        { id: "todo", label: "To do", count: todoOpen },
        { id: "log", label: "History", count: logRows.length },
      ]}
      value={shiftView}
      onChange={setShiftView}
    />
  );
  function renderShiftBody() {
    return (
      <div className={styles.shiftBody} id="ward-this-shift-body">
        <div className={styles.phoneShiftSwitch}>{shiftSwitch}</div>
        <div className={styles.shiftPane} data-active={shiftView === "todo"}>
          <div className={styles.todoGrid}>
            {renderTodoColumn("now", "Act now", "danger", actNow)}
            {renderTodoColumn("later", "Later today", "neutral", laterToday)}
            {renderTodoColumn("done", "Done", "success", doneRows)}
          </div>
        </div>
        <div className={styles.shiftPane} data-active={shiftView === "log"}>
          <h3 className={styles.paneHead}>Shift history</h3>
          <div className={styles.logBody}>
            {logRows.length === 0 ? (
              <p className={styles.timelineEmpty}>No shift activity recorded yet.</p>
            ) : (
              <ol className={styles.timelineStream}>
                {logRows.map((row) => (
                  <li key={row.key} className={styles.timelineEntry}>
                    <span className={styles.timelineTime}>{row.timeLabel}</span>
                    <span className={styles.timelineDot} aria-hidden="true" />
                    <span className={styles.timelineBody}>
                      <strong>{row.title}</strong>
                      <span className={styles.timelineDetail}>{row.detail}</span>
                      {row.nested ? (
                        <details className={styles.timelineMore}>
                          <summary>Times ({row.nested.length})</summary>
                          <ul className={styles.timelineNested}>
                            {row.nested.map((item) => (
                              <li key={item.key}>{item.detail}</li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </span>
                    <span className={styles.statusWord}>{row.status}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
        <div className={styles.shiftFoot}>
          <span>
            <b>{checksDone}</b> of {shiftChecks.length} checks done
          </span>
          {/* Audit 11 Oct 2026: one footnote for the form times, not a tag crowding Act now. */}
          {liveFormAlerts.length > 0 ? (
            <span className={styles.legalTag}>
              Form times <LegalLimitsNotChecked variant="tag" />
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  // Phone: the place or move line sits above the round while someone is waiting for a bed.
  const phoneBoardHint =
    phoneSheets && !bedArea && !walkingOnPhone && onOpenBoard ? (
      <WardPlaceOrMove variant="phone" waiting={boardWaitingCount} onOpen={onOpenBoard} />
    ) : null;
  return (
    <div className={styles.homeWrap}>
      {/* Visual desk, 22 Oct 2026: an absence is silence, never "0 being made ready". */}
      {pendingPreparation > 0 ? <span className="sr-only">{pendingPreparation} being made ready</span> : null}

      {/* Wave 4 (D-191): on a phone the squares, then Coming and going in place (no My list hop),
          then the round. */}
      {phoneSheets && !bedArea && !walkingOnPhone ? (
        <>
          <section className={styles.phoneSquares} aria-label={`Beds at ${unit.name}, in squares`}>
            {everySquares}
          </section>
          {renderFlowCard()}
        </>
      ) : null}

      <div className={styles.homeTop} data-board={bedArea ? "true" : undefined}>
        {bedArea ? <div className={styles.boardArea}>{bedArea}</div> : null}
        {phoneSheets && !bedArea && !walkingOnPhone ? (
          <div className={styles.phoneBedsHead}>
            <h2 className={styles.phoneSectionHead}>
              <span id="ward-home-every-bed">Round</span>
              <Count n={bedRows.length} />
            </h2>
            {phoneFind}
          </div>
        ) : null}
        {phoneBoardHint !== null && boardWaitingCount > 0 ? phoneBoardHint : null}
        <Card
          hidden={bedArea ? true : undefined}
          className={`${styles.areaBeds} ${styles.v6Card}`}
          data-walking={walkingOnPhone ? "true" : undefined}
          id="bed-capacity"
          tabIndex={-1}
          aria-labelledby="ward-home-every-bed"
        >
          {phoneSheets ? null : (
            <CardHead
              id="ward-home-every-bed"
              className={styles.bedsHead}
              title="Every bed"
              meta={<OutageMeta on={outageTags}>{liveMark}</OutageMeta>}
              action={
                <span className={styles.headTools}>
                  <WardPlaceOrMove variant="head" waiting={boardWaitingCount} onOpen={onOpenBoard} />
                  <Segmented
                    label="Highlight beds"
                    items={[
                      { id: "all", label: "All", count: bedRows.length },
                      { id: "look", label: "Needs a look", count: bedRows.filter((row) => row.look).length },
                      { id: "leaving", label: "Discharges today", count: bedRows.filter((row) => row.leaving).length },
                      { id: "free", label: "Ready", count: bedRows.filter((row) => row.readyNow).length },
                      // The hero's Occupied figure sets a filter this group does not list, so it joins
                      // the group while on and a radio is always checked.
                      ...(bedFilter === "occupied"
                        ? [{ id: "occupied" as const, label: "Occupied", count: bedTally.occupied }]
                        : []),
                    ]}
                    value={bedFilter}
                    onChange={setBedFilter}
                  />
                  <span className={styles.viewSwitch} role="group" aria-label="Bed view">
                    <button
                      type="button"
                      aria-pressed={boardView === "board"}
                      aria-label="Board"
                      title="Board"
                      onClick={() => {
                        setBoardView("board");
                      }}
                    >
                      <LayoutGrid strokeWidth={1.75} size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-pressed={boardView === "list"}
                      aria-label="List"
                      title="List"
                      onClick={() => {
                        setBoardView("list");
                      }}
                    >
                      <List strokeWidth={1.75} size={16} aria-hidden="true" />
                    </button>
                  </span>
                </span>
              }
            />
          )}
          {phoneSheets ? null : <div className={styles.squaresHead}>{everySquares}</div>}
          {highlighting && bedRows.length > 0 ? (
            <p className={styles.highlightNote} data-testid="ward-bed-highlight-note">
              <span>
                <b>{litCount}</b> of <b>{bedRows.length}</b> beds highlighted.
              </span>
              {litCount === 0 ? <span>No bed matches this choice.</span> : null}
              {bedFilter === "free" && makingReady > 0 ? (
                <span>{makingReady} more being made ready, not counted as ready.</span>
              ) : null}
              {bedFilter === "all" ? null : (
                <button
                  type="button"
                  className={styles.keyLink}
                  onClick={() => {
                    setBedFilter("all");
                  }}
                >
                  Clear highlight
                </button>
              )}
            </p>
          ) : null}
          {bedRows.length === 0 ? (
            <p className={styles.v6Empty}>No beds are recorded for {unit.name}.</p>
          ) : isPhone && isSiteBedManager ? (
            // Site bed manager: the bed list without Start the round; a row opens the bed.
            phoneRoundList(
              () => ({ reviewed: false, changed: false }),
              (bedNumber) => onSelectBed?.(bedNumber),
            )
          ) : isPhone ? (
            <WardWalkRound
              beds={walkBeds}
              round={walkRound}
              setRound={setWalkRound}
              registerTrigger={registerBedTrigger}
              onOpenBed={(bedNumber) => onSelectBed?.(bedNumber)}
              onConfirmRelease={onConfirmRelease}
              renderList={phoneRoundList}
            />
          ) : boardView === "board" ? (
            <ul className={styles.bedTiles} aria-label={`Beds at ${unit.name}`}>
              {shownBeds.map((row) => (
                <li key={row.bed.bedNumber}>
                  <button
                    type="button"
                    ref={(element) => registerBedTrigger?.(Number(row.bed.bedNumber), element)}
                    className={styles.bedTile}
                    data-status={String(row.bed.status)}
                    data-look={row.look ? "true" : undefined}
                    data-act={row.glyph === "danger" ? "true" : undefined}
                    data-lit={highlighting && isLit(row) ? "true" : undefined}
                    data-dim={isLit(row) ? undefined : "true"}
                    aria-haspopup="dialog"
                    aria-label={outageTags ? `${row.tileName}, ${NOT_CONFIRMED_SINCE_OUTAGE}` : row.tileName}
                    title={row.accessibleName}
                    onClick={() => {
                      onSelectBed?.(Number(row.bed.bedNumber));
                    }}
                  >
                    <span className={styles.bedTileTop} aria-hidden="true">
                      <span className={styles.bedTileNum}>
                        <BedSquare state={squareOf(row.bed)} className={styles.bedTileSquare} />
                        <b>{row.number}</b>
                      </span>
                      {row.criteriaTag ? " " : null}
                      {row.criteriaTag ? <CriteriaLedTag chip={row.criteriaTag} className={styles.bedTileTag} /> : null}
                      {row.glyph ? <StatusGlyph tone={row.glyph} size={10} /> : null}
                    </span>{" "}
                    <WardHomeTileText
                      name={row.bed.patientAlias ? row.name : null}
                      label={row.name}
                      note={row.shownNote}
                      days={row.days}
                      outage={outageTags}
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.bedTableWrap}>
              <table className={styles.bedTable} aria-label={`Beds at ${unit.name}, as a list`}>
                <thead>
                  <tr>
                    <th scope="col">Bed</th>
                    <th scope="col">Patient</th>
                    <th scope="col">Stay</th>
                    <th scope="col">Legal</th>
                    <th scope="col">Going out</th>
                    <th scope="col">Now</th>
                  </tr>
                </thead>
                <tbody>
                  {shownBeds.map((row) => (
                    <tr
                      key={row.bed.bedNumber}
                      data-look={row.look ? "true" : undefined}
                      data-dim={isLit(row) ? undefined : "true"}
                    >
                      <td>
                        <button
                          type="button"
                          className={styles.bedTableBed}
                          aria-haspopup="dialog"
                          aria-label={row.accessibleName}
                          onClick={() => {
                            onSelectBed?.(Number(row.bed.bedNumber));
                          }}
                        >
                          {row.glyph ? <StatusGlyph tone={row.glyph} size={9} /> : <span className={styles.glyphGap} />}
                          {row.number}
                        </button>
                      </td>
                      <td className={styles.bedTableName}>
                        {row.name}
                        {typeof row.bed.age === "number" || row.bed.sex ? (
                          <span className={styles.bedTableSub}>
                            {[typeof row.bed.age === "number" ? String(row.bed.age) : "", row.bed.sex ?? ""]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        ) : null}
                      </td>
                      {/* A stay belongs to someone in the bed: none for a free, closed or pulled bed. */}
                      <td className={styles.bedTableMono}>
                        {row.bed.status === "occupied" || row.bed.status === "leave" ? row.days || "Not recorded" : ""}
                      </td>
                      <td>{row.bed.legalStatusLabel ?? "Not recorded"}</td>
                      <td>{row.free ? "" : (row.bed.expectedDischargeLabel ?? "Not recorded")}</td>
                      <td className={styles.bedTableNow}>{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {phoneSheets ? null : bedKeyBlock}
        </Card>
        {phoneBoardHint !== null && boardWaitingCount === 0 ? phoneBoardHint : null}
        {phoneSheets && !bedArea && !walkingOnPhone ? (
          <details className={styles.phoneFigures} data-testid="ward-phone-figures">
            <summary>
              {/* Audit 11 Oct 2026: the bed counts here repeated the hero and the group headings, so
                  the fold keeps only the ward's details and what is not checked. */}
              <span className={styles.phoneFiguresTitle}>Ward details and checks</span>
              {phoneFiguresSummary ? <span className={styles.phoneFiguresLine}>{phoneFiguresSummary}</span> : null}
            </summary>
            <div className={styles.phoneFiguresBody}>
              {phoneHeroFoot ? <div className={styles.phoneFiguresFoot}>{phoneHeroFoot}</div> : null}
            </div>
          </details>
        ) : null}

        {phoneSheets ? null : <div className={styles.flowWrap}>{renderFlowCard()}</div>}
      </div>

      {phoneSheets ? (
        <PhoneSheet
          open={phonePanel === "shift"}
          onClose={() => onPhonePanelChange?.(null)}
          title="This shift"
          description={`${phoneShiftLabel ?? "This shift"} · legal limits not checked here`}
          height="tall"
          className={styles.phoneSheetBody}
          data-testid="ward-phone-shift-sheet"
        >
          {renderShiftBody()}
        </PhoneSheet>
      ) : (
        <>
          <Drawer
            open={shiftSheetOpen}
            onClose={() => setShiftSheetOpen(false)}
            title="This shift"
            description={`${shiftSummary} · legal limits not checked here`}
            closeLabel="Close This shift"
            testId="ward-shift-sheet"
            bodyClassName={styles.shiftSheetBody}
          >
            {renderShiftBody()}
          </Drawer>
        </>
      )}

      {(() => {
        const detailMovement = visibleIncoming.find((movement) => movement.id === referralDetailFor);
        if (!detailMovement) return null;
        return (
          <WardReferralDetailDrawer
            movement={detailMovement}
            unit={unit}
            now={now}
            identity={resolvePatientIdentity(detailMovement)}
            onClose={() => setReferralDetailFor(null)}
            onUpdateBeds={onOpenConfirmNumbers}
            blocked={answerBlockedReason ?? referralAnswerBlocked(detailMovement, unit)}
            onDecline={() => {
              setReferralDetailFor(null);
              if (declineOpenFor !== detailMovement.id) toggleDecline(detailMovement.id);
            }}
            onAccept={() => {
              setReferralDetailFor(null);
              acceptIncoming(detailMovement.id);
            }}
          />
        );
      })()}

      {(() => {
        // The referral the accept dialog was opened for, while it is still waiting here (CS-08).
        const acceptMovement = visibleIncoming.find((movement) => movement.id === acceptFor);
        if (!acceptMovement) return null;
        const acceptIdentity = resolvePatientIdentity(acceptMovement);
        return (
          <WardAcceptDialog
            movement={acceptMovement}
            patientName={acceptIdentity.formalName}
            patientUmrn={acceptIdentity.umrn.trim() || undefined}
            unitName={unit.name}
            now={now}
            extended={acceptExtended}
            holdChoices={[
              { extended: false, label: `${pullHoldText(configuration.pullHoldMinutes)} standard` },
              {
                extended: true,
                label: `${pullHoldText(configuration.pullHoldMinutes + EXTRA_TRAVEL_HOLD_MINUTES)} with extra travel`,
              },
            ]}
            dialogRef={acceptDialogRef}
            onChooseHold={setAcceptExtended}
            onCancel={() => {
              setAcceptFor(null);
            }}
            onConfirm={() => {
              setAcceptFor(null);
              recordAccept(acceptMovement.id, acceptExtended);
            }}
          />
        );
      })()}

      {/* Preserved test contracts for withdrawn referrals, overrides and answer history. */}
      <div className={styles.visuallyHidden}>
        <section aria-labelledby="ward-withdrawn-heading">
          <h2 id="ward-withdrawn-heading">Withdrawn from {unit.name}</h2>
          {withdrawn.length === 0 ? (
            <p>No referral to {unit.name} has been withdrawn.</p>
          ) : (
            <ul>
              {withdrawn.map((movement) => {
                const entry = movement.withdrawnReferrals.find((c) => c.unitId === unit.id);
                const patientInfo = resolvePatientIdentity(movement);
                return (
                  <li key={movement.id} data-testid={`ward-withdrawn-${movement.id}`}>
                    <strong>{patientInfo.formalName}</strong>
                    <span data-testid={`ward-withdrawn-reason-${movement.id}`}>
                      {entry ? withdrawalReasonLabels[entry.reason] : "Withdrawn — reason unresolved"}
                    </span>
                    {entry ? <span>{formatInstantWithDay(entry.at, now)}</span> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="ward-overrides-heading">
          <h2 id="ward-overrides-heading">Overrides recorded against {unit.name}</h2>
          <OverrideRegister entries={overridesHere} units={units} now={now} />
        </section>

        {recentAnswers.length > 0 ? (
          <div data-testid="ward-answer-history">
            <h2 id="ward-answer-history-heading">Recent answers</h2>
            <ul>
              {recentAnswers.map((answer) => (
                <li key={answer.key} data-testid={`ward-answer-history-${answer.key}`}>
                  <strong>{resolvePatientIdentity({ movementId: answer.movementId }).umrn}</strong>
                  <span>{answer.outcome}</span>
                  <span>{answer.reason ? declineReasonText(answer.reason) : "Accepted by this ward"}</span>
                  {answer.at === undefined ? (
                    <span>Time not recorded</span>
                  ) : (
                    <time>{formatInstantWithDay(answer.at, now)}</time>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
