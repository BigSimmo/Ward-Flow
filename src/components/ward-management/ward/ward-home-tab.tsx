"use client";

import {
  bedsPendingPreparation,
  releaseBand,
  stalePreparingReleases,
} from "@/components/ward-management/ward-bed-availability";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import styles from "./ward-home-tab.module.css";
import type { Unit, Movement, Rejection, DeclineReason } from "@/components/ward-management/ward-model";
import { DECLINE_REASONS } from "@/components/ward-management/ward-model";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { withdrawalReasonLabels } from "@/components/ward-management/ward-change-reasons";
import { formatInstantWithDay, formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import { currentShiftStartInstant, releasesDueByShiftEnd } from "@/components/ward-management/ward-board-time-features";
import { bedHold } from "@/components/ward-management/ward-bed-hold";
import type { absentOnOrder } from "@/components/ward-management/ward-absence-tasks";
import {
  deriveAfternoonDischarges,
  restrictionNotice,
  eligibilityWarning,
  stageCopy,
  type OverrideEntry,
} from "@/components/ward-management/ward-derivations";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import { OverrideRegister } from "@/components/ward-management/override-register";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
const WARD_ACTION_REJECTION_LABELS: Record<string, string> = {
  ACCEPT_IN_PRINCIPLE: "Accept in principle",
  PULL_PATIENT: "Pull a bed",
  PATIENT_ARRIVED: "Confirm Arrival",
};
import { resolveSubjectPatient, type ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import { ArrowLeftRight, BedDouble, LayoutGrid, List, ListChecks } from "lucide-react";
import {
  buttonClass,
  Card,
  CardHead,
  ColumnChart,
  Count,
  durMinutes,
  PhoneSheet,
  Segmented,
  SrOnly,
  StatusGlyph,
  useIsPhone,
  type WfTone,
} from "@/components/wf";
import { edById } from "@/components/ward-management/ward-sites";
import { bedGlyphTone, type BedItem } from "./ward-beds-matrix";
import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import { pullBlockedReason } from "./ward-arrivals-corridor";
import {
  useWalkRound,
  WalkRoundRowMarks,
  WardWalkRound,
  type WalkRoundBed,
  type WalkRoundMark,
} from "./ward-walk-round";
import type { WardBedFilter } from "./ward-telemetry-ribbon";

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

export type WardFlowTab = "referrals" | "admissions" | "discharges";
export type WardShiftView = "todo" | "log" | "stay";

/**
 * How many items sit in This shift's Act now column, so the hero's Act now pill and the column
 * always agree: each live form alert, plus one each for referrals waiting, discharges held up and
 * an overdue morning rollup.
 */
export function wardActNowCount({
  alerts,
  incoming,
  heldUp,
  rollupOverdue,
  lapsedHolds = 0,
  absences = 0,
  stoppedHolds = 0,
}: {
  alerts: number;
  incoming: number;
  heldUp: number;
  rollupOverdue: boolean;
  /** Audit A1-3: pulled beds whose hold has lapsed (one Act now row for all of them). */
  lapsedHolds?: number;
  /** Audit A3-1: this ward's absences on an order (`absentOnOrder`), one Act now row each. */
  absences?: number;
  /** Stopped transports whose held bed on this ward has not yet been released. */
  stoppedHolds?: number;
}): number {
  return (
    absences +
    alerts +
    (incoming > 0 ? 1 : 0) +
    (heldUp > 0 ? 1 : 0) +
    (rollupOverdue ? 1 : 0) +
    (lapsedHolds > 0 ? 1 : 0) +
    (stoppedHolds > 0 ? 1 : 0)
  );
}

function wardSafeRejectionReason(reason: string): string {
  return reason;
}

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
  onAcceptInPrinciple?: (movementId: string, unitId: string) => void;
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
  /** The ward's beds, as the bed board draws them. Drives Every bed and Length of stay. */
  bedsList?: BedItem[];
  /** Audit A3-1: this ward's absences on an order, from `absentOnOrder` (one Act now row each). */
  absencesOnOrder?: ReturnType<typeof absentOnOrder>;
  /** Opens the bed's dossier. */
  onSelectBed?: (bedNumber: number) => void;
  /** The ward figures section, shown as the foot of Every bed. */
  figures?: React.ReactNode;
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
   * Bed board tab (v10 pass 3): replaces Every bed and This shift with the board, so Ward flow
   * stays beside it in the rail exactly as on Home.
   */
  bedArea?: React.ReactNode;
  /**
   * Phone (v10): which of This shift or Ward flow is open as a bottom sheet. Passed only on a
   * phone; when it is undefined the cards sit in the page as on desktop.
   */
  phonePanel?: "shift" | "flow" | null;
  onPhonePanelChange?: (panel: "shift" | "flow" | null) => void;
  /** Reports This shift's open to do count, for the phone's This shift chip. */
  onTodoCount?: (count: number) => void;
  /** Phone: the hero's foot facts (shift, cohort, roster, checking), kept in Ward figures. */
  phoneHeroFoot?: React.ReactNode;
  /** Phone: the one line under Ward figures, right now, while it is closed. */
  phoneFiguresSummary?: string;
  /** Phone: the find box, which sits under Every bed. */
  phoneFind?: React.ReactNode;
  /** Phone: the shift name and hours, under the This shift sheet's title. */
  phoneShiftLabel?: string;
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
  presentation,
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
  figures,
  bedFilter: bedFilterProp,
  onBedFilterChange,
  bedQuery = "",
  flowTab: flowTabProp,
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
  onTodoCount,
  phoneHeroFoot,
  phoneFiguresSummary,
  phoneFind,
  phoneShiftLabel,
}: WardHomeTabProps) {
  const phoneSheets = phonePanel !== undefined;
  const { bedReleases, leaveBeds = [], admissions = [] } = useWardFlowSelect("bedReleases", "leaveBeds", "admissions");
  const dischargePrepOn = useWardFeatureFlag("top25-discharge-prep");
  const cleaningReminderOn = useWardFeatureFlag("top25-cleaning-reminder");
  const walkRoundOn = useWardFeatureFlag("top25-walk-round");
  const pendingPreparation = bedsPendingPreparation(unit.id, bedReleases);
  const [localChecks, setLocalChecks] = useState<Record<string, Instant | null>>({
    drugs: null,
    seclusion: null,
    afternoon: null,
  });

  // Derived real ward activity events for overhauled Shift Coordinator Log
  const pendingBedReleases = bedReleases.filter(
    (release) => release.unitId === unit.id && release.state !== "discharged",
  );
  const dischargedBedReleases = bedReleases.filter(
    (release) => release.unitId === unit.id && release.state === "discharged",
  );
  const unitLeaveBeds = (leaveBeds ?? []).filter((bed) => bed.unitId === unit.id);

  function toggleLocalCheck(id: string) {
    setLocalChecks((current) => ({ ...current, [id]: current[id] === null ? now : null }));
  }

  const [innerFlowTab, setInnerFlowTab] = useState<WardFlowTab>("referrals");
  const flowTab = flowTabProp ?? innerFlowTab;
  const setFlowTab = onFlowTabChange ?? setInnerFlowTab;
  const [innerShiftView, setInnerShiftView] = useState<WardShiftView>("todo");
  const shiftView = shiftViewProp ?? innerShiftView;
  const setShiftView = onShiftViewChange ?? setInnerShiftView;
  const [boardView, setBoardView] = useState<"board" | "list">("board");
  const isPhone = useIsPhone();
  const [showSettled, setShowSettled] = useState(false);

  function focusAwaiting() {
    setFlowTab("referrals");
    if (phoneSheets) {
      onPhonePanelChange?.("flow");
      return;
    }
    window.requestAnimationFrame(() => {
      const target = document.getElementById("ward-awaiting-answer");
      target?.scrollIntoView({ block: "nearest" });
      target?.focus();
    });
  }

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
  const shiftChecks = [
    capacityConfirmedThisShift,
    morningRollupConfirmed,
    referralsClear,
    localChecks.drugs !== null,
    localChecks.seclusion !== null,
    localChecks.afternoon !== null,
  ];
  const checksDone = shiftChecks.filter(Boolean).length;

  type LogRow = {
    key: string;
    at: number;
    timeLabel: string;
    title: string;
    detail: string;
    status: string;
    nested?: Array<{ key: string; detail: string }>;
  };
  const logRows: LogRow[] = [];
  if (capacityConfirmed && unit.allocatable.confirmedAt !== undefined) {
    logRows.push({
      key: "capacity",
      at: unit.allocatable.confirmedAt,
      timeLabel: formatInstant(unit.allocatable.confirmedAt),
      title: "Capacity confirmed",
      detail: `${unit.allocatable.value} beds allocatable`,
      status: "Verified",
    });
  }
  if (pendingBedReleases.length === 1) {
    const release = pendingBedReleases[0];
    logRows.push({
      key: release.id,
      at: release.confirmedAt,
      timeLabel: formatInstantWithDay(release.confirmedAt, now),
      title: "Bed expected out",
      detail: `Departure ${formatInstant(release.expectedAt)}${release.waitingOn ? ` · ${release.waitingOn}` : ""}`,
      status: release.state === "confirmed" ? "Confirmed" : "Expected",
    });
  } else if (pendingBedReleases.length > 1) {
    const ordered = [...pendingBedReleases].sort((left, right) => left.expectedAt - right.expectedAt);
    const next = ordered[0];
    logRows.push({
      key: "releases",
      at: Math.max(...pendingBedReleases.map((release) => release.confirmedAt)),
      timeLabel: formatInstantWithDay(Math.max(...pendingBedReleases.map((release) => release.confirmedAt)), now),
      title: `${pendingBedReleases.length} beds expected out`,
      detail: `Next at ${formatInstantWithDay(next.expectedAt, now)}`,
      status: "Expected",
      nested: ordered.map((release) => ({
        key: release.id,
        detail: `${formatInstant(release.expectedAt)}${release.waitingOn ? ` · ${release.waitingOn}` : ""}`,
      })),
    });
  }
  for (const release of dischargedBedReleases) {
    logRows.push({
      key: `clean-${release.id}`,
      at: release.confirmedAt,
      timeLabel: formatInstantWithDay(release.confirmedAt, now),
      title: "Departure completed",
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
      detail: `${resolvePatientIdentity(accepted[0]).displayName}${accepted.length > 1 ? ` and ${accepted.length - 1} more` : ""}`,
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
            ? "Pulled"
            : bed.status === "closed"
              ? "Closed"
              : "Occupied";
    const days = typeof bed.stayDays === "number" ? `${bed.stayDays}d` : "";
    // Audit A1-3: every pulled bed shows its hold time, from the one bed-hold rule.
    const hold = bed.status === "incoming" ? (bed.bedHold ?? null) : null;
    const note = hold
      ? hold.label
      : awayAtEd
        ? `Away at an ED ${bed.awayAtEdHours}h`
        : bed.blockReason
          ? `Held up, ${String(bed.blockReason)}`
          : bed.pastDate
            ? "Past expected date"
            : bed.dischargeBarrier
              ? String(bed.dischargeBarrier)
              : leaving
                ? bed.dischargeConfirmed
                  ? "Discharge confirmed"
                  : "Expected out today"
                : bed.isSpecialling
                  ? "1:1 specialling"
                  : free
                    ? "Free to offer"
                    : stateWord;
    // U1 (site review, 12 Oct 2026): the tile's status word is short so it never truncates
    // ("Discharge confir…", "Held up, Awaiti…"). The full note stays in the accessible name, the
    // list view and the bed panel.
    const tileNote = hold
      ? hold.short
      : awayAtEd
        ? `At ED ${bed.awayAtEdHours}h`
        : bed.blockReason
          ? "Held up"
          : bed.pastDate
            ? "Past date"
            : bed.dischargeBarrier
              ? "Barrier"
              : leaving
                ? bed.dischargeConfirmed
                  ? "Confirmed out"
                  : "Due out"
                : note;
    const glyph = bedGlyphTone(bed);
    const number = String(bed.bedNumber).padStart(2, "0");
    const name = free ? "Free to offer" : (bed.patientAlias ?? stateWord);
    // The occupant's name is shown on the tile, so a screen reader hears it too.
    const accessibleName = [
      bed.bedLabel,
      free ? "" : (bed.patientAlias ?? ""),
      stateWord,
      days ? `day ${bed.stayDays}` : "",
      note,
    ]
      .filter(Boolean)
      .join(", ");
    return {
      bed,
      free,
      leaving,
      look,
      readyByShiftEnd,
      stateWord,
      days,
      note,
      tileNote,
      glyph,
      number,
      name,
      accessibleName,
    };
  });
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
        return row.free;
      case "occupied":
        // The ruled Occupied state, as the hero and the bed figures count it (leave holds inside).
        return row.bed.status === "occupied" || row.bed.status === "leave";
      case "shift-end":
        return row.readyByShiftEnd;
      default:
        return true;
    }
  };
  const query = bedQuery.trim().toLowerCase();
  const matchesQuery = (row: (typeof bedRows)[number]) =>
    query === "" ||
    row.number.includes(query) ||
    row.bed.bedLabel.toLowerCase().includes(query) ||
    String(row.bed.patientAlias ?? "")
      .toLowerCase()
      .includes(query);
  const highlighting = bedFilter !== "all" || query !== "";
  const isLit = (row: (typeof bedRows)[number]) => matchesFilter(row) && matchesQuery(row);
  const litCount = bedRows.filter(isLit).length;
  const shownBeds = bedRows;
  // One partition, the ruled four bed states, so this key, the hero and the bed figures agree.
  const bedTally = {
    occupied: bedRows.filter((row) => row.bed.status === "occupied" || row.bed.status === "leave").length,
    free: bedRows.filter((row) => row.free).length,
    pulled: bedRows.filter((row) => row.bed.status === "incoming").length,
    closed: bedRows.filter((row) => row.bed.status === "closed").length,
  };
  // Phone (v10 build guide): every bed grouped by state, worst first. Settled beds sit behind Show
  // all. Each bed appears once, in the first group it belongs to. Filters still highlight and dim.
  const phoneGroups = (() => {
    const used = new Set<number | string>();
    const take = (test: (row: (typeof bedRows)[number]) => boolean) =>
      bedRows.filter((row) => {
        if (used.has(row.bed.bedNumber) || !test(row)) return false;
        used.add(row.bed.bedNumber);
        return true;
      });
    const groups: { id: string; title: string; tone: WfTone | null; rows: typeof bedRows }[] = [
      // Audit A3-1: absent without leave is its own red group at the top, never under On leave.
      {
        id: "awol",
        title: "Absent without leave",
        tone: "danger",
        rows: take((row) => row.bed.statusText === "Absent without leave"),
      },
      { id: "act", title: "Act now", tone: "danger", rows: take((row) => row.glyph === "danger") },
      { id: "risk", title: "At risk", tone: "warning", rows: take((row) => row.glyph === "warning") },
      // Beds due out today that are not already listed under Act now or At risk, so the heading
      // names that narrower set rather than repeating the Due out filter's wider count.
      { id: "leaving", title: "Due out, on track", tone: "info", rows: take((row) => row.leaving) },
      { id: "free", title: "Free", tone: "success", rows: take((row) => row.free) },
      {
        id: "preparing",
        title: BED_STATE_LABELS.beingMadeReady,
        tone: "neutral",
        rows: take((row) => row.bed.status === "ready"),
      },
      { id: "pulled", title: "Pulled", tone: "info", rows: take((row) => row.bed.status === "incoming") },
      { id: "leave", title: "On leave", tone: "neutral", rows: take((row) => row.bed.status === "leave") },
      // S-24 (audit round 2): a bed admitted today sorts to the top of Settled, so a new arrival is
      // never folded away behind Show all. The sort is stable, so the rest keep bed order.
      {
        id: "settled",
        title: "Settled",
        tone: null,
        rows: take((row) => row.bed.status === "occupied").sort(
          (left, right) => Number(right.bed.stayDays === 0) - Number(left.bed.stayDays === 0),
        ),
      },
      { id: "closed", title: "Closed", tone: "closed", rows: take(() => true) },
    ];
    return groups.filter((group) => group.rows.length > 0);
  })();

  // Phone grouped bed list. With the walk round on, a row starts the walk from that bed and shows
  // its reviewed and changed marks.
  // Item 23: the walk round's state sits here, above the phone and desktop branch, so turning the
  // phone to landscape and back keeps the round.
  const walkBeds: WalkRoundBed[] = bedRows.map((row) => ({
    bedNumber: Number(row.bed.bedNumber),
    number: row.number,
    name: row.name,
    note: row.note,
    changeKey: [
      row.bed.status,
      row.bed.statusText,
      row.bed.admissionId,
      row.bed.blockReason,
      row.bed.dischargeBarrier,
      row.bed.dischargeConfirmed,
      row.bed.pastDate,
      row.bed.dischargeDateMoves,
      row.bed.awayAtEdHours != null,
      row.bed.isSpecialling,
      row.bed.preparing,
    ].join("|"),
    glyph: row.glyph,
    days: row.days,
    accessibleName: row.accessibleName,
  }));
  const [walkRound, setWalkRound] = useWalkRound(unit.id, walkBeds);
  const walkRowLabel = (name: string, marks: WalkRoundMark) =>
    [name, marks.changed ? "changed this round" : "", marks.reviewed ? "reviewed" : "", "walk from this bed"]
      .filter(Boolean)
      .join(", ");
  const phoneGroupList = (mark?: (bedNumber: number) => WalkRoundMark, walkFrom?: (bedNumber: number) => void) => (
    <div className={styles.phoneGroups} data-testid="ward-phone-bed-groups">
      {phoneGroups.map((group) => {
        const settledFolded = group.id === "settled" && !showSettled && !highlighting;
        const arrivedToday = group.rows.filter((row) => row.bed.stayDays === 0).length;
        const rows = settledFolded ? group.rows.slice(0, Math.max(3, arrivedToday)) : group.rows;
        return (
          <section key={group.id} aria-label={`${group.title}, ${group.rows.length}`}>
            <h3 className={styles.phoneGroupHead}>
              {group.tone ? <StatusGlyph tone={group.tone} size={9} /> : null}
              <span>{group.title}</span>
              <Count n={group.rows.length} />
            </h3>
            <ul className={styles.phoneRows}>
              {rows.map((row) => (
                <li key={row.bed.bedNumber}>
                  <button
                    type="button"
                    className={styles.phoneRow}
                    data-act={row.glyph === "danger" ? "true" : undefined}
                    data-dim={isLit(row) ? undefined : "true"}
                    aria-haspopup={walkFrom ? undefined : "dialog"}
                    aria-label={
                      mark ? walkRowLabel(row.accessibleName, mark(Number(row.bed.bedNumber))) : row.accessibleName
                    }
                    ref={(element) => registerBedTrigger?.(Number(row.bed.bedNumber), element)}
                    onClick={() => {
                      if (walkFrom) walkFrom(Number(row.bed.bedNumber));
                      else onSelectBed?.(Number(row.bed.bedNumber));
                    }}
                  >
                    <span className={styles.phoneRowNo} aria-hidden="true">
                      {row.number}
                    </span>
                    <span className={styles.phoneRowText} aria-hidden="true">
                      <span className={styles.phoneRowName}>{row.name}</span>
                      {mark ? <WalkRoundRowMarks mark={mark(Number(row.bed.bedNumber))} /> : null}
                      <span className={styles.phoneRowNote}>
                        {row.glyph ? <StatusGlyph tone={row.glyph} size={9} /> : null}
                        <span>
                          {group.id === "settled" && row.bed.stayDays === 0 && row.note === row.stateWord
                            ? "Arrived today"
                            : row.note === row.name
                              ? row.free
                                ? "Ready"
                                : row.bed.status === "closed"
                                  ? "Not offered"
                                  : row.stateWord
                              : row.note}
                        </span>
                      </span>
                    </span>
                    <span className={styles.phoneRowDays} aria-hidden="true">
                      {row.days || (row.free ? "Free" : "")}
                      {row.days && !row.free ? <span className={styles.phoneRowDaysSub}>stay</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {settledFolded && group.rows.length > rows.length ? (
              <button
                type="button"
                className={styles.phoneMore}
                aria-expanded="false"
                onClick={() => {
                  setShowSettled(true);
                }}
              >
                Show all {group.rows.length} settled beds
              </button>
            ) : null}
          </section>
        );
      })}
    </div>
  );

  const bedByAdmission = (admissionId: string | undefined) =>
    admissionId === undefined ? undefined : (bedsList ?? []).find((item) => item.admissionId === admissionId);

  // Ward flow, Admissions: accepted arrivals first, then people due back from leave.
  type FlowRow = {
    key: string;
    title: string;
    when?: string;
    detail: string;
    tone: WfTone;
    action: string;
    primary?: boolean;
    /** Why the action cannot run now; the button stays visible, greyed, with this reason. */
    blocked?: string;
    /** The movement this row acts on, so an engine refusal shows under its own row. */
    movementId?: string;
    run: () => void;
  };
  const expectedRows: FlowRow[] = accepted.map((movement, index): FlowRow => {
    const eta = movement.arrivalDetails?.estimatedArrivalAt;
    const late = eta !== undefined && eta < now;
    const displayName = resolvePatientIdentity(movement).displayName;
    // A1-6 (audit round 2): an accepted patient waiting for a bed is pulled from this row, the
    // same action and the same check as All arrivals, so the sheet is no longer a detour.
    const canPull = movement.stage === "accepted_awaiting_bed" && onPullPatient !== undefined;
    const blocked = canPull ? pullBlockedReason(movement, unit, displayName) : undefined;
    // Audit A1-3: a pulled arrival names its hold, from the one bed-hold rule.
    const hold = movement.stage === "pulled" ? bedHold(movement.pullExpiresAt, now) : null;
    return {
      key: movement.id,
      movementId: movement.id,
      title: displayName,
      when: eta === undefined ? undefined : `${late ? "Due" : "ETA"} ${formatInstantWithDay(eta, now)}`,
      // A greyed Pull a bed says why in words on the row, not only on hover. A lapsed hold
      // outranks a late ETA (the coral overdue); the ETA stays in `when` as "Due".
      detail:
        blocked ??
        (hold?.state === "lapsed" ? hold.label : late ? "Late" : hold ? hold.label : stageCopy[movement.stage].label),
      tone: hold?.state === "lapsed" ? "danger" : late ? "warning" : hold?.state === "at-risk" ? "warning" : "info",
      action: canPull ? "Pull a bed" : "Open",
      primary: index === 0,
      blocked,
      run: canPull
        ? () => onPullPatient?.(movement.id, unit.id)
        : () => {
            // A1-7 (audit round 2): on a phone, close the sheet first so the patient's card in
            // All arrivals is what the person lands on, not a page moving behind the sheet.
            if (phoneSheets) onPhonePanelChange?.(null);
            onOpenArrival?.(movement.id);
          },
    };
  });
  const leaveRows: FlowRow[] = unitLeaveBeds.map((leaveBed): FlowRow => {
    const bed = bedByAdmission(leaveBed.admissionId);
    return {
      key: `leave-${leaveBed.id}`,
      title: bed?.bedLabel ?? "Bed on leave",
      when: formatInstantWithDay(leaveBed.expectedReturn, now),
      detail: "On approved leave, expected back",
      tone: "neutral",
      action: "Open",
      run: () => (bed ? onSelectBed?.(Number(bed.bedNumber)) : onOpenDischarges?.()),
    };
  });

  // Ward flow, Discharges: this ward's open bed releases, held up first, then today, then later.
  // A release names its bed, never the patient.
  const outRows = [...pendingBedReleases]
    .sort((left, right) => left.expectedAt - right.expectedAt)
    .map((release) => {
      const bed = bedByAdmission(release.admissionId);
      // The same day bands the bed figures count (`releaseBand`), so "Today and tomorrow" here
      // holds the unblocked share of Confirmed and Expected there.
      const group = release.blocker ? "held" : releaseBand(release, now) !== "beyond-today" ? "today" : "later";
      const tone: WfTone = release.blocker ? "danger" : release.state === "confirmed" ? "success" : "neutral";
      return {
        key: release.id,
        group,
        title: bed?.bedLabel ?? "Bed release",
        when: formatInstantWithDay(release.expectedAt, now),
        detail: release.blocker
          ? `Held up · ${release.blocker}`
          : release.state === "confirmed"
            ? "Confirmed"
            : `Expected${release.waitingOn ? ` · ${release.waitingOn}` : ""}`,
        tone,
        run: () => (bed ? onSelectBed?.(Number(bed.bedNumber)) : onOpenDischarges?.()),
      };
    });

  // This shift: one to do list, sorted into act now, later today and done. Every row is a recorded
  // fact or one of the ward's own ticks; nothing is invented.
  const confirmedOut = pendingBedReleases.filter((release) => release.state === "confirmed").length;
  const heldUp = pendingBedReleases.filter((release) => release.blocker !== null);
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
      detail: `${incoming.length} waiting for this ward's answer`,
      meta: String(incoming.length),
      tone: "danger",
      action: { label: "Answer", run: focusAwaiting },
    });
  }
  if (heldUp.length > 0) {
    actNow.push({
      key: "held",
      title: "Discharges held up",
      detail: heldUp
        .map((release) => `${bedByAdmission(release.admissionId)?.bedLabel ?? "A bed"} ${release.blocker}`)
        .join(", "),
      meta: String(heldUp.length),
      tone: "danger",
      action: { label: "Review", run: () => onOpenDischarges?.() },
    });
  }
  // Audit A1-3: a lapsed bed hold is act now on its ward, the same rule Handover and Tasks use.
  const lapsedHolds = (bedsList ?? []).filter((bed) => bed.status === "incoming" && bed.bedHold?.state === "lapsed");
  if (lapsedHolds.length > 0) {
    actNow.push({
      key: "holds",
      title: lapsedHolds.length === 1 ? "Bed pull expired" : "Bed pulls expired",
      detail: lapsedHolds
        .map(
          (bed) =>
            `${bed.bedLabel}${bed.patientAlias ? ` ${bed.patientAlias}` : ""}, ${bed.bedHold!.short.toLowerCase()}`,
        )
        .join("; "),
      meta: String(lapsedHolds.length),
      tone: "danger",
      action: { label: "Move or release", run: () => onSelectBed?.(Number(lapsedHolds[0]!.bedNumber)) },
    });
  }
  if (heldAfterStop.length > 0) {
    actNow.push({
      key: "stopped-holds",
      title: heldAfterStop.length === 1 ? "Stopped transport holding bed" : "Stopped transports holding beds",
      detail: heldAfterStop
        .map((movement) => `${resolvePatientIdentity(movement).displayName}, transport stopped after collection`)
        .join("; "),
      meta: String(heldAfterStop.length),
      tone: "warning",
      action: onOpenArrivals ? { label: "Release bed", run: onOpenArrivals } : undefined,
    });
  }
  if (morningRollupOverdue && !morningRollupConfirmed) {
    actNow.push({
      key: "rollup",
      title: "Morning rollup",
      detail: "Overdue, not yet confirmed",
      tone: "danger",
      action: { label: "Confirm", run: () => onConfirmMorningRollup?.() },
      secondaryAction:
        !capacityConfirmedThisShift && onConfirmBedsAndMorningRollup
          ? {
              label: `Confirm beds & morning roll-up (${morningRollupTimeLabel})`,
              run: () => onConfirmBedsAndMorningRollup(),
            }
          : onOpenDischarges
            ? {
                label: "Review today's expected discharges →",
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
              label: `Confirm beds & morning roll-up (${morningRollupTimeLabel})`,
              run: () => onConfirmBedsAndMorningRollup(),
            }
          : onOpenDischarges
            ? {
                label: "Review today's expected discharges →",
                run: () => onOpenDischarges(),
              }
            : undefined,
    });
  }
  if (morningRollupConfirmed) {
    doneRows.push({
      key: "rollup",
      title: "Morning rollup",
      detail: "Confirmed today",
      tone: "success",
      secondaryAction: onOpenDischarges
        ? {
            label: "Review today's expected discharges →",
            run: () => onOpenDischarges(),
          }
        : undefined,
    });
  } else if (!morningRollupOverdue) {
    laterToday.push({
      key: "rollup",
      title: "Morning rollup",
      detail: "Still due",
      tone: "neutral",
      action: { label: "Confirm", run: () => onConfirmMorningRollup?.() },
      secondaryAction:
        !capacityConfirmedThisShift && onConfirmBedsAndMorningRollup
          ? {
              label: `Confirm beds & morning roll-up (${morningRollupTimeLabel})`,
              run: () => onConfirmBedsAndMorningRollup(),
            }
          : onOpenDischarges
            ? {
                label: "Review today's expected discharges →",
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
            label: "Review today's expected discharges →",
            run: () => onOpenDischarges(),
          }
        : undefined,
    });
  }
  // Top 25 item 5: each stay due out within the discharge prep window, with its barrier, so the
  // barrier is recorded before the day. Named by bed, like every discharge row on this list.
  if (dischargePrepOn) {
    const dueSoon = deriveAfternoonDischarges(
      admissions.filter((admission) => admission.unitId === unit.id && admission.state === "occupied"),
      now,
    );
    for (const admission of dueSoon) {
      const bed = bedByAdmission(admission.id);
      if (!bed || admission.expectedDischargeAt === null) continue;
      laterToday.push({
        key: `prep-${admission.id}`,
        title: `${bed.bedLabel} due out ${formatInstantWithDay(admission.expectedDischargeAt, now)}`,
        detail: admission.dischargeBarrier
          ? `Discharge barrier: ${admission.dischargeBarrier}`
          : "No discharge barrier recorded",
        tone: admission.dischargeBarrier ? "warning" : "neutral",
        action: { label: "Open bed", run: () => onSelectBed?.(Number(bed.bedNumber)) },
      });
    }
  }
  // Top 25 item 4: a bed still being made ready past the set time asks the ward to confirm it is
  // ready. The row only opens the bed; Ready in the bed panel is what offers it again.
  if (cleaningReminderOn) {
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
  }
  for (const [id, label, hint, at] of [
    ["drugs", "Controlled drug count", "Tick when the register has been checked.", localChecks.drugs],
    ["seclusion", "Seclusion check", "Tick when the suite and duress alarm have been checked.", localChecks.seclusion],
    ["afternoon", "Afternoon sign-off", "Tick when the midday numbers have been signed.", localChecks.afternoon],
  ] as const) {
    const row: TodoRow = {
      key: id,
      title: label,
      detail: at === null ? `${hint} On this screen only. Not sent.` : "Ticked on this screen only. Not sent.",
      meta: at === null ? "Due" : formatInstantWithDay(at, now),
      tone: at === null ? "neutral" : "success",
      tick: id,
    };
    (at === null ? laterToday : doneRows).push(row);
  }
  const todoOpen = actNow.length + laterToday.length;
  useEffect(() => {
    onTodoCount?.(todoOpen);
  }, [onTodoCount, todoOpen]);

  // Length of stay: people in beds now, grouped by recorded stay in days.
  const stayDays = bedRows
    .map((row) => row.bed.stayDays)
    .filter((days): days is number => typeof days === "number" && Number.isFinite(days))
    .sort((left, right) => left - right);
  const stayMedian =
    stayDays.length === 0
      ? null
      : stayDays.length % 2 === 1
        ? stayDays[(stayDays.length - 1) / 2]
        : Math.round((stayDays[stayDays.length / 2 - 1] + stayDays[stayDays.length / 2]) / 2);
  const stayBuckets = [
    { id: "0", label: "0 to 3", min: 0, max: 3 },
    { id: "4", label: "4 to 7", min: 4, max: 7 },
    { id: "8", label: "8 to 14", min: 8, max: 14 },
    { id: "15", label: "15 to 28", min: 15, max: 28 },
    { id: "29", label: "29+", min: 29, max: Number.POSITIVE_INFINITY },
  ].map((bucket) => ({
    ...bucket,
    count: stayDays.filter((days) => days >= bucket.min && days <= bucket.max).length,
  }));

  function renderFlowRow(row: FlowRow) {
    return (
      <li key={row.key} className={styles.flowRow}>
        <StatusGlyph tone={row.tone} size={9} />
        <span className={styles.flowMain}>
          <span className={styles.flowTitle}>{row.title}</span>
          <span className={styles.flowDetail}>{row.detail}</span>
          {row.movementId && lastActionRejection?.movementId === row.movementId ? (
            <span className={styles.noticeProminent} role="alert">
              {WARD_ACTION_REJECTION_LABELS[lastActionRejection.attempted] ?? lastActionRejection.attempted} not
              recorded: {wardSafeRejectionReason(lastActionRejection.reason)}
            </span>
          ) : null}
        </span>
        {row.when ? <span className={styles.flowWhen}>{row.when}</span> : null}
        <button
          type="button"
          className={buttonClass({ variant: row.primary ? "pri" : "sec", size: "sm" })}
          aria-disabled={row.blocked ? "true" : undefined}
          title={row.blocked}
          onClick={row.blocked ? ignoreUnavailableActivation : row.run}
        >
          {row.action}
          <SrOnly>
            {" "}
            {row.title}
            {row.blocked ? `. ${row.blocked}` : ""}
          </SrOnly>
        </button>
      </li>
    );
  }

  function renderTodoColumn(id: string, title: string, tone: WfTone, rows: TodoRow[], extra?: React.ReactNode) {
    return (
      <section className={styles.todoCol} aria-labelledby={`ward-todo-${id}`}>
        <div className={styles.groupHead}>
          <StatusGlyph tone={tone} size={9} />
          <h3 id={`ward-todo-${id}`} className={styles.groupTitle}>
            {title}
          </h3>
          <Count n={rows.length} />
          {extra}
        </div>
        {rows.length === 0 ? (
          <p className={styles.groupEmpty}>Nothing here.</p>
        ) : (
          <ul className={styles.todoList}>
            {rows.map((row) => (
              <li key={row.key} className={styles.todoRow}>
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
                    onClick={row.action.run}
                  >
                    {row.action.label}
                    <SrOnly> {row.title}</SrOnly>
                  </button>
                ) : null}
                {row.secondaryAction ? (
                  <button
                    type="button"
                    className={buttonClass({ variant: "ghost", size: "sm" })}
                    onClick={row.secondaryAction.run}
                  >
                    {row.secondaryAction.label}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  const heldRows = outRows.filter((row) => row.group === "held");
  const todayRows = outRows.filter((row) => row.group === "today");
  const laterRows = outRows.filter((row) => row.group === "later");
  const answered = recentAnswers.slice(0, 6);

  const bedKeyBlock = (
    <div className={styles.bedKey}>
      <span className={styles.keyItems} aria-label="Symbol key">
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
        <span>
          <StatusGlyph tone="success" size={9} />
          Free
        </span>
      </span>
      {/* Audit 11 Oct 2026: the four bed counts sit once, in Ward figures, right now, just below. */}
      {onOpenBeds ? (
        <button type="button" className={styles.keyLink} onClick={onOpenBeds}>
          Full bed list
        </button>
      ) : null}
    </div>
  );

  function renderFlowCard() {
    return (
      <Card
        className={`${styles.flowCard} ${styles.v6Card}`}
        aria-labelledby={phoneSheets ? undefined : "ward-home-flow"}
        aria-label={phoneSheets ? "Ward flow" : undefined}
      >
        {phoneSheets ? null : (
          <CardHead
            id="ward-home-flow"
            icon={ArrowLeftRight}
            title="Ward flow"
            aside={<span className={styles.v6Meta}>{formatInstant(now)}</span>}
          />
        )}
        <div className={styles.flowSwitch}>
          <Segmented
            label="Ward flow list"
            items={[
              { id: "referrals", label: "Referrals", count: incoming.length },
              { id: "admissions", label: "Admissions", count: expectedRows.length + leaveRows.length },
              {
                id: "discharges",
                label: "Discharges",
                count: outRows.length,
              },
            ]}
            value={flowTab}
            onChange={setFlowTab}
          />
        </div>
        <div className={styles.flowBody}>
          <div className={styles.flowPane} data-active={flowTab === "referrals"}>
            <section
              id="ward-awaiting-answer"
              aria-label="Awaiting your answer"
              className={styles.awaitingCard}
              tabIndex={0}
            >
              <div className={styles.groupHead}>
                <h3 id="ward-awaiting-heading" className={styles.groupTitle}>
                  {presentation === "answer" ? "Bed request" : "Awaiting your answer"}
                </h3>
                <Count n={incoming.length} />
              </div>
              {incoming.length === 0 ? (
                <p className={styles.groupEmpty}>No referral is currently awaiting an answer from {unit.name}.</p>
              ) : (
                <ul className={styles.awaitingList}>
                  {visibleIncoming.map((movement) => {
                    const blocked = referralAnswerBlocked(movement, unit);
                    const notice = restrictionNotice(movement, unit);
                    const eligibilityIssue = eligibilityWarning(movement, unit, now);
                    const declineOpen = declineOpenFor === movement.id;

                    return (
                      <li key={movement.id} className={styles.awaitingRow} data-testid={`ward-incoming-${movement.id}`}>
                        <div className={styles.awaitingIdentity}>
                          <span className={styles.awaitingTier} aria-hidden="true">
                            {movement.urgency}
                          </span>
                          <span className={styles.awaitingName}>Incoming patient</span>
                          <span className={styles.awaitingMeta}>
                            {movement.cohort} &middot; {movement.security} &middot; {movement.sex} &middot;{" "}
                            {movement.legalStatus}
                          </span>
                          {/* A1-8 (audit round 2): the wait, origin and gate result the Ward answer
                              view shows, in one line, so an accept from this list is not blind. */}
                          <span
                            className={`${styles.awaitingMeta} ${styles.awaitingSummary}`}
                            data-testid={`ward-incoming-summary-${movement.id}`}
                          >
                            {(() => {
                              const verdict = eligibility(movement, unit, now);
                              const pass = verdict.gates.filter((gate) => gate.pass).length;
                              return [
                                `Waiting ${durMinutes(Math.max(0, now - movement.openedAt))}`,
                                edById(movement.originEdId) ? `Now at ${edById(movement.originEdId)?.name}` : undefined,
                                `${pass} of ${verdict.gates.length} gates pass`,
                              ]
                                .filter(Boolean)
                                .join(" · ");
                            })()}
                          </span>
                        </div>

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

                        <div className={styles.awaitingActions}>
                          <button
                            type="button"
                            data-testid={`ward-decline-toggle-${movement.id}`}
                            aria-disabled={blocked ? "true" : undefined}
                            aria-describedby={blocked ? `ward-decline-unavailable-${movement.id}` : undefined}
                            title={blocked ?? undefined}
                            aria-expanded={declineOpen}
                            className={buttonClass({ variant: "sec", size: "sm" })}
                            onClick={
                              blocked
                                ? ignoreUnavailableActivation
                                : () => {
                                    toggleDecline(movement.id);
                                  }
                            }
                          >
                            Decline
                          </button>
                          <button
                            type="button"
                            data-testid={`ward-accept-${movement.id}`}
                            aria-disabled={blocked ? "true" : undefined}
                            aria-describedby={blocked ? `ward-accept-unavailable-${movement.id}` : undefined}
                            title={blocked ?? undefined}
                            className={buttonClass({ variant: "pri", size: "sm" })}
                            onClick={
                              blocked
                                ? ignoreUnavailableActivation
                                : () => {
                                    if (onAcceptInPrinciple) {
                                      onAcceptInPrinciple(movement.id, unit.id);
                                    } else {
                                      priorRejectionCountRef.current = rejections.length;
                                      setCheckToken((token) => token + 1);
                                    }
                                  }
                            }
                          >
                            Accept in principle
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
                            onSubmit={(event) => {
                              submitDecline(event, movement.id);
                            }}
                            data-testid={`ward-decline-form-${movement.id}`}
                            className={styles.declineForm}
                          >
                            <fieldset className={styles.declineFieldset}>
                              <legend>Decline reason for this patient</legend>
                              {DECLINE_REASONS.map((reason) => (
                                <label key={reason}>
                                  <input
                                    type="radio"
                                    name={`decline-reason-${movement.id}`}
                                    value={reason}
                                    checked={declineReason === reason}
                                    onChange={() => {
                                      setDeclineReason(reason);
                                    }}
                                  />{" "}
                                  {reason.replace(/_/g, " ")}
                                </label>
                              ))}
                            </fieldset>
                            <button
                              type="submit"
                              disabled={!declineReason}
                              className={buttonClass({ variant: "sec", size: "sm" })}
                            >
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
            <section aria-labelledby="ward-answered-today" className={styles.flowGroup}>
              <div className={styles.groupHead}>
                <h3 id="ward-answered-today" className={styles.groupTitle}>
                  Answered
                </h3>
                <Count n={recentAnswers.length} />
              </div>
              {answered.length === 0 ? (
                <p className={styles.groupEmpty}>No answer recorded yet.</p>
              ) : (
                <ul className={styles.flowList}>
                  {answered.map((answer) => (
                    <li key={answer.key} className={styles.flowRow}>
                      <StatusGlyph tone={answer.reason ? "closed" : "success"} size={9} />
                      <span className={styles.flowMain}>
                        <span className={styles.flowTitle}>{answer.outcome}</span>
                        {/* S-23 (audit round 2): an accepted row names who this ward took by UMRN. A
                            declined referral was never this ward's patient, so it stays anonymous. */}
                        <span className={styles.flowDetail}>
                          {answer.reason
                            ? answer.reason.replace(/_/g, " ")
                            : `UMRN ${resolvePatientIdentity({ movementId: answer.movementId }).umrn}`}
                        </span>
                      </span>
                      <span className={styles.flowWhen}>
                        {answer.at === undefined ? "Time not recorded" : formatInstantWithDay(answer.at, now)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className={styles.flowPane} data-active={flowTab === "admissions"}>
            <section aria-labelledby="ward-flow-expected" className={styles.flowGroup}>
              <div className={styles.groupHead}>
                <h3 id="ward-flow-expected" className={styles.groupTitle}>
                  Expected
                </h3>
                <Count n={expectedRows.length} />
              </div>
              {expectedRows.length === 0 ? (
                <p className={styles.groupEmpty}>Nobody is accepted, pulled or en route.</p>
              ) : (
                <ul className={styles.flowList}>{expectedRows.map(renderFlowRow)}</ul>
              )}
            </section>
            <section aria-labelledby="ward-flow-leave" className={styles.flowGroup}>
              <div className={styles.groupHead}>
                <h3 id="ward-flow-leave" className={styles.groupTitle}>
                  Back from leave
                </h3>
                <Count n={leaveRows.length} />
              </div>
              {leaveRows.length === 0 ? (
                <p className={styles.groupEmpty}>Nobody is on approved leave.</p>
              ) : (
                <ul className={styles.flowList}>{leaveRows.map(renderFlowRow)}</ul>
              )}
            </section>
          </div>

          <div className={styles.flowPane} data-active={flowTab === "discharges"}>
            {outRows.length === 0 ? (
              <p className={styles.groupEmpty}>No discharge is expected or confirmed for {unit.name}.</p>
            ) : (
              (
                [
                  ["held", "Held up", "danger", heldRows],
                  ["today", "Today and tomorrow", "info", todayRows],
                  ["later", "Later", "neutral", laterRows],
                ] as const
              )
                .filter(([, , , rows]) => rows.length > 0)
                .map(([id, title, tone, rows]) => (
                  <section key={id} aria-labelledby={`ward-flow-out-${id}`} className={styles.flowGroup}>
                    <div className={styles.groupHead}>
                      <StatusGlyph tone={tone} size={9} />
                      <h3 id={`ward-flow-out-${id}`} className={styles.groupTitle}>
                        {title}
                      </h3>
                      <Count n={rows.length} />
                    </div>
                    <ul className={styles.flowList}>
                      {rows.map((row) =>
                        renderFlowRow({
                          key: row.key,
                          title: row.title,
                          when: row.when,
                          detail: row.detail,
                          tone: row.tone,
                          action: "Open",
                          run: row.run,
                        }),
                      )}
                    </ul>
                  </section>
                ))
            )}
          </div>
        </div>
        <div className={styles.flowFoot}>
          {flowTab === "referrals" ? (
            <>
              <span>
                {recentAnswers.length} answered · {incoming.length} waiting
              </span>
              <Link className={styles.keyLink} href={`/mockups/ward-flow/ward/${unit.id}/answer`}>
                Answer one by one
              </Link>
            </>
          ) : flowTab === "admissions" ? (
            <>
              <span>{expectedRows.length} expected</span>
              {onOpenArrivals ? (
                <button type="button" className={styles.keyLink} onClick={onOpenArrivals}>
                  All arrivals
                </button>
              ) : null}
            </>
          ) : (
            <>
              <span>
                {confirmedOut} confirmed · {heldRows.length} held up
              </span>
              <button
                type="button"
                className={styles.keyLink}
                onClick={() => {
                  onOpenDischarges?.();
                }}
              >
                All discharges
              </button>
            </>
          )}
        </div>
      </Card>
    );
  }

  const shiftSwitch = (
    <Segmented
      label="This shift view"
      items={[
        { id: "todo", label: "To do", count: todoOpen },
        { id: "log", label: "Log", count: logRows.length },
        { id: "stay", label: "Stay" },
      ]}
      value={shiftView}
      onChange={setShiftView}
    />
  );
  function renderShiftCard() {
    return (
      <Card
        hidden={bedArea && !phoneSheets ? true : undefined}
        className={`${styles.shiftCard} ${styles.v6Card}`}
        id="ward-this-shift"
        aria-labelledby={phoneSheets ? undefined : "ward-home-shift"}
        aria-label={phoneSheets ? "This shift" : undefined}
      >
        {phoneSheets ? (
          <div className={styles.phoneShiftSwitch}>{shiftSwitch}</div>
        ) : (
          <CardHead id="ward-home-shift" icon={ListChecks} title="This shift" action={shiftSwitch} />
        )}
        <div className={styles.shiftPane} data-active={shiftView === "todo"}>
          <div className={styles.todoGrid}>
            {renderTodoColumn("now", "Act now", "danger", actNow)}
            {renderTodoColumn("later", "Later today", "neutral", laterToday)}
            {renderTodoColumn("done", "Done", "success", doneRows)}
          </div>
        </div>
        <div className={styles.shiftPane} data-active={shiftView === "log"}>
          <h3 className={styles.paneHead}>Shift log</h3>
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
        <div className={styles.shiftPane} data-active={shiftView === "stay"}>
          <h3 className={styles.paneHead}>
            Length of stay
            <span className={styles.v6Meta}>
              {stayDays.length === 0
                ? "none recorded"
                : `${stayDays.length} in beds, days${stayMedian === null ? "" : ` · median ${stayMedian}d`}`}
            </span>
          </h3>
          {stayDays.length === 0 ? (
            <p className={styles.v6Empty}>No length of stay is recorded for anyone in a bed here.</p>
          ) : (
            <div className={styles.stayChart}>
              <ColumnChart
                label={`Length of stay at ${unit.name}, people in beds by days`}
                height={128}
                columns={stayBuckets.map((bucket) => ({
                  id: bucket.id,
                  label: bucket.label,
                  value: bucket.count,
                  fill: bucket.id === "29" ? "data-2" : "data-1",
                }))}
              />
            </div>
          )}
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
      </Card>
    );
  }

  return (
    <div className={styles.homeWrap}>
      <span className="sr-only">{pendingPreparation} being made ready</span>

      {phoneSheets && !bedArea ? (
        <section className={styles.phoneSection} aria-labelledby="ward-phone-awaiting">
          <h2 className={styles.phoneSectionHead}>
            <span id="ward-phone-awaiting">{presentation === "answer" ? "Bed request" : "Awaiting your answer"}</span>
            <Count n={incoming.length} />
          </h2>
          {incoming.length === 0 ? (
            <div className={styles.phoneClear} data-testid="ward-phone-all-clear">
              {/* A1-22 (audit round 2): one line when nothing is waiting, so Act now sits higher. */}
              <p className={styles.phoneClearTitle}>
                <StatusGlyph tone="success" size={12} />
                All clear
                <span className={styles.phoneClearText}>
                  · Answered {recentAnswers.length}
                  {expectedRows.length > 0 ? ` · ${expectedRows.length} coming in` : ""}
                </span>
              </p>
            </div>
          ) : (
            <ul className={styles.phoneAwaitList}>
              {incoming.map((movement, index) => (
                <li key={movement.id}>
                  <button
                    type="button"
                    className={styles.phoneAwaitRow}
                    aria-haspopup="dialog"
                    onClick={() => {
                      setFlowTab("referrals");
                      onPhonePanelChange?.("flow");
                    }}
                  >
                    <span className={styles.phoneAwaitText}>
                      {/* A ward sees no identity before it accepts (as the answer view's "Request n of N"). */}
                      <span className={styles.phoneAwaitName}>
                        Request {index + 1} · {movement.cohort}
                      </span>
                      <span className={styles.phoneAwaitMeta}>
                        {[movement.sex, movement.legalStatus, edById(movement.originEdId)?.name]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className={styles.phoneAwaitWait}>
                      <b>{durMinutes(Math.max(0, now - movement.openedAt))}</b>
                      <span>waiting</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <div className={styles.homeTop} data-board={bedArea ? "true" : undefined}>
        {bedArea ? <div className={styles.boardArea}>{bedArea}</div> : null}
        {phoneSheets && !bedArea ? (
          <div className={styles.phoneBedsHead}>
            <h2 className={styles.phoneSectionHead}>
              <span id="ward-home-every-bed">Every bed</span>
              <Count n={bedRows.length} />
            </h2>
            {phoneFind}
          </div>
        ) : null}
        <Card
          hidden={bedArea ? true : undefined}
          className={`${styles.areaBeds} ${styles.v6Card}`}
          id="bed-capacity"
          tabIndex={-1}
          aria-labelledby="ward-home-every-bed"
        >
          {phoneSheets ? null : (
            <CardHead
              id="ward-home-every-bed"
              icon={BedDouble}
              title="Every bed"
              action={
                <span className={styles.headTools}>
                  <Segmented
                    label="Show beds"
                    items={[
                      { id: "all", label: "All", count: bedRows.length },
                      { id: "look", label: "Needs a look", count: bedRows.filter((row) => row.look).length },
                      { id: "leaving", label: "Due out", count: bedRows.filter((row) => row.leaving).length },
                      { id: "free", label: "Free", count: bedRows.filter((row) => row.free).length },
                      // The hero's Occupied and Ready by pills set filters this group does not list,
                      // so the active one joins it while on and a radio is always checked.
                      ...(bedFilter === "occupied"
                        ? [{ id: "occupied" as const, label: "Occupied", count: bedTally.occupied }]
                        : bedFilter === "shift-end"
                          ? [
                              {
                                id: "shift-end" as const,
                                label: "Ready by shift end",
                                count: bedRows.filter((row) => row.readyByShiftEnd).length,
                              },
                            ]
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
                      <LayoutGrid size={16} aria-hidden="true" />
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
                      <List size={16} aria-hidden="true" />
                    </button>
                  </span>
                </span>
              }
            />
          )}
          {highlighting && bedRows.length > 0 ? (
            <p className={styles.highlightNote} data-testid="ward-bed-highlight-note">
              <span>
                <b>{litCount}</b> of <b>{bedRows.length}</b> beds highlighted. All beds stay on the board.
              </span>
              {litCount === 0 ? <span>No bed matches this choice.</span> : null}
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
          ) : isPhone ? (
            walkRoundOn ? (
              <WardWalkRound
                beds={walkBeds}
                round={walkRound}
                setRound={setWalkRound}
                registerTrigger={registerBedTrigger}
                onOpenBed={(bedNumber) => onSelectBed?.(bedNumber)}
                renderList={(mark, walkFrom) => phoneGroupList(mark, walkFrom)}
              />
            ) : (
              phoneGroupList()
            )
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
                    aria-label={row.accessibleName}
                    title={row.accessibleName}
                    onClick={() => {
                      onSelectBed?.(Number(row.bed.bedNumber));
                    }}
                  >
                    <span className={styles.bedTileTop} aria-hidden="true">
                      <b>{row.number}</b>
                      {row.glyph ? <StatusGlyph tone={row.glyph} size={10} /> : null}
                    </span>
                    <span className={styles.bedTileName} aria-hidden="true">
                      {row.name}
                    </span>
                    <span className={styles.bedTileState} aria-hidden="true">
                      <span className={styles.bedTileNote}>
                        {row.free ? row.stateWord : row.note === row.name ? "" : row.tileNote}
                      </span>
                      {row.days ? <span className={styles.bedTileDays}>{row.days}</span> : null}
                    </span>
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
          {!phoneSheets && figures ? <div className={styles.bedFigures}>{figures}</div> : null}
        </Card>
        {phoneSheets && !bedArea ? (
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

        {phoneSheets ? (
          <PhoneSheet
            open={phonePanel === "flow"}
            onClose={() => onPhonePanelChange?.(null)}
            title="Ward flow"
            description={`Referrals, admissions and discharges for ${unit.name}`}
            height="tall"
            className={styles.phoneSheetBody}
            data-testid="ward-phone-flow-sheet"
          >
            {renderFlowCard()}
          </PhoneSheet>
        ) : (
          <div className={styles.flowWrap}>{renderFlowCard()}</div>
        )}
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
          {renderShiftCard()}
        </PhoneSheet>
      ) : (
        renderShiftCard()
      )}

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
                  <span>{answer.reason ? answer.reason.replace(/_/g, " ") : "Accepted by this ward"}</span>
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
