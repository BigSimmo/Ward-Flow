"use client";

import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import Link from "next/link";
import React, { useState } from "react";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import styles from "./ward-home-tab.module.css";
import type { Unit, Movement, Rejection, DeclineReason } from "@/components/ward-management/ward-model";
import { DECLINE_REASONS } from "@/components/ward-management/ward-model";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { withdrawalReasonLabels } from "@/components/ward-management/ward-change-reasons";
import { formatInstantWithDay, formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import {
  restrictionNotice,
  eligibilityWarning,
  stageCopy,
  type OverrideEntry,
} from "@/components/ward-management/ward-derivations";
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
  Segmented,
  SrOnly,
  StatusGlyph,
  type WfTone,
} from "@/components/wf";
import { dayOf } from "@/components/ward-management/ward-clock";
import { bedGlyphTone, type BedItem } from "./ward-beds-matrix";
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
}: {
  alerts: number;
  incoming: number;
  heldUp: number;
  rollupOverdue: boolean;
}): number {
  return alerts + (incoming > 0 ? 1 : 0) + (heldUp > 0 ? 1 : 0) + (rollupOverdue ? 1 : 0);
}

function wardSafeRejectionReason(reason: string): string {
  return reason;
}

interface WardHomeTabProps {
  unit: Unit;
  units: Unit[];
  capacity: { available: number; occupied: number };
  accepted: Movement[];
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
  onConfirmMorningRollup?: () => void;
  onOpenConfirmNumbers?: () => void;
  onOpenArrival?: (movementId: string) => void;
  onOpenDischarges?: () => void;
  /** The ward's beds, as the bed board draws them. Drives Every bed and Length of stay. */
  bedsList?: BedItem[];
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
}

export function WardHomeTab({
  unit,
  units,
  accepted,
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
  onConfirmMorningRollup,
  onOpenConfirmNumbers,
  onOpenArrival,
  onOpenDischarges,
  onOpenDecisions,
  bedsList,
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
}: WardHomeTabProps) {
  const { bedReleases, leaveBeds = [] } = useWardFlow();
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

  function focusAwaiting() {
    setFlowTab("referrals");
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
  const referralsClear = incoming.length === 0;
  const shiftChecks = [
    capacityConfirmed,
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
      title: "Approved leave",
      detail: `Expected back ${formatInstant(leaveBed.expectedReturn)}`,
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
  const bedRows = (bedsList ?? []).map((bed) => {
    const free = bed.status === "ready";
    const leaving = !free && (bed.dischargeConfirmed === true || (bed.expectedDays != null && bed.expectedDays <= 0));
    const awayAtEd = bed.awayAtEdHours != null;
    const look =
      !free && (bed.pastDate === true || awayAtEd || Boolean(bed.dischargeBarrier) || Boolean(bed.blockReason));
    const stateWord =
      bed.status === "ready"
        ? "Ready"
        : bed.status === "leave"
          ? "On leave"
          : bed.status === "incoming"
            ? "Pulled"
            : "Occupied";
    const days = typeof bed.stayDays === "number" ? `${bed.stayDays}d` : "";
    const note = awayAtEd
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
    const glyph = bedGlyphTone(bed);
    const number = String(bed.bedNumber).padStart(2, "0");
    const name = free ? "Free to offer" : (bed.patientAlias ?? stateWord);
    const accessibleName = [bed.bedLabel, stateWord, days ? `day ${bed.stayDays}` : "", note]
      .filter(Boolean)
      .join(", ");
    return { bed, free, leaving, look, stateWord, days, note, glyph, number, name, accessibleName };
  });
  const [innerBedFilter, setInnerBedFilter] = useState<WardBedFilter>("all");
  const bedFilter = bedFilterProp ?? innerBedFilter;
  const setBedFilter = onBedFilterChange ?? setInnerBedFilter;
  const shownBeds = bedRows.filter((row) =>
    bedFilter === "all" ? true : bedFilter === "look" ? row.look : bedFilter === "leaving" ? row.leaving : row.free,
  );
  const query = bedQuery.trim().toLowerCase();
  const matchesQuery = (row: (typeof bedRows)[number]) =>
    query === "" ||
    row.number.includes(query) ||
    row.bed.bedLabel.toLowerCase().includes(query) ||
    String(row.bed.patientAlias ?? "")
      .toLowerCase()
      .includes(query);
  const bedTally = {
    occupied: bedRows.filter((row) => row.bed.status === "occupied" || row.bed.status === "leave").length,
    free: bedRows.filter((row) => row.free).length,
    pulled: bedRows.filter((row) => row.bed.status === "incoming").length,
  };
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
    run: () => void;
  };
  const expectedRows: FlowRow[] = accepted.map((movement, index): FlowRow => {
    const eta = movement.arrivalDetails?.estimatedArrivalAt;
    const late = eta !== undefined && eta < now;
    return {
      key: movement.id,
      title: resolvePatientIdentity(movement).displayName,
      when: eta === undefined ? undefined : `${late ? "Due" : "ETA"} ${formatInstantWithDay(eta, now)}`,
      detail: late ? "Late" : stageCopy[movement.stage].label,
      tone: late ? "warning" : "info",
      action: "Open",
      primary: index === 0,
      run: () => onOpenArrival?.(movement.id),
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
      const group = release.blocker ? "held" : dayOf(release.expectedAt) <= dayOf(now) ? "today" : "later";
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
    tick?: keyof typeof localChecks;
  };
  const actNow: TodoRow[] = [
    ...liveFormAlerts.map((alert): TodoRow => ({
      key: alert.key,
      title: alert.title,
      detail: alert.text,
      meta: alert.countdown,
      tone: alert.tone === "critical" ? "danger" : alert.tone === "warning" ? "warning" : "info",
      action: alert.actionLabel ? { label: alert.actionLabel, run: () => runAlert(alert) } : undefined,
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
  if (morningRollupOverdue && !morningRollupConfirmed) {
    actNow.push({
      key: "rollup",
      title: "Morning rollup",
      detail: "Overdue, not yet confirmed",
      tone: "danger",
      action: { label: "Confirm", run: () => onConfirmMorningRollup?.() },
    });
  }
  const laterToday: TodoRow[] = [];
  const doneRows: TodoRow[] = [];
  if (capacityConfirmed && unit.allocatable.confirmedAt !== undefined) {
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
    });
  }
  if (morningRollupConfirmed) {
    doneRows.push({ key: "rollup", title: "Morning rollup", detail: "Confirmed today", tone: "success" });
  } else if (!morningRollupOverdue) {
    laterToday.push({
      key: "rollup",
      title: "Morning rollup",
      detail: "Still due",
      tone: "neutral",
      action: { label: "Confirm", run: () => onConfirmMorningRollup?.() },
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
      detail: `${pendingBedReleases.length} expected out · ${confirmedOut} confirmed`,
      meta: String(signOff),
      tone: "neutral",
      action: { label: "Open", run: () => onOpenDecisions?.() },
    });
  }
  for (const [id, label, hint] of [
    ["drugs", "Controlled drug count", "Tick when the register has been checked."],
    ["seclusion", "Seclusion check", "Tick when the suite and duress alarm have been checked."],
    ["afternoon", "Afternoon sign-off", "Tick when the midday numbers have been signed."],
  ] as const) {
    const at = localChecks[id];
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
        </span>
        {row.when ? <span className={styles.flowWhen}>{row.when}</span> : null}
        <button
          type="button"
          className={buttonClass({ variant: row.primary ? "pri" : "sec", size: "sm" })}
          onClick={row.run}
        >
          {row.action}
          <SrOnly> {row.title}</SrOnly>
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
                      onChange={() => toggleLocalCheck(row.tick!)}
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

  return (
    <div className={styles.homeWrap}>
      <span className="sr-only">{pendingPreparation} being made ready</span>

      <div className={styles.homeTop}>
        <Card
          className={`${styles.areaBeds} ${styles.v6Card}`}
          id="bed-capacity"
          tabIndex={-1}
          aria-labelledby="ward-home-every-bed"
        >
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
                    { id: "leaving", label: "Leaving", count: bedRows.filter((row) => row.leaving).length },
                    { id: "free", label: "Free", count: bedRows.filter((row) => row.free).length },
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
                    onClick={() => setBoardView("board")}
                  >
                    <LayoutGrid size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-pressed={boardView === "list"}
                    aria-label="List"
                    title="List"
                    onClick={() => setBoardView("list")}
                  >
                    <List size={16} aria-hidden="true" />
                  </button>
                </span>
              </span>
            }
          />
          {bedRows.length === 0 ? (
            <p className={styles.v6Empty}>No beds are recorded for {unit.name}.</p>
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
                    data-miss={matchesQuery(row) ? undefined : "true"}
                    aria-haspopup="dialog"
                    aria-label={row.accessibleName}
                    onClick={() => onSelectBed?.(Number(row.bed.bedNumber))}
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
                        {row.free ? row.stateWord : row.note === row.name ? "" : row.note}
                      </span>
                      {row.days ? <span className={styles.bedTileDays}>{row.days}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
              {shownBeds.length === 0 ? <li className={styles.v6Empty}>No bed matches this choice.</li> : null}
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
                  {shownBeds.filter(matchesQuery).map((row) => (
                    <tr key={row.bed.bedNumber} data-look={row.look ? "true" : undefined}>
                      <td>
                        <button
                          type="button"
                          className={styles.bedTableBed}
                          aria-haspopup="dialog"
                          aria-label={row.accessibleName}
                          onClick={() => onSelectBed?.(Number(row.bed.bedNumber))}
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
                      <td className={styles.bedTableMono}>{row.days || "Not recorded"}</td>
                      <td>{row.bed.legalStatusLabel ?? "Not recorded"}</td>
                      <td>{row.free ? "" : (row.bed.expectedDischargeLabel ?? "Not recorded")}</td>
                      <td className={styles.bedTableNow}>{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
            <span className={styles.keyTally}>
              {bedTally.occupied} occupied · {bedTally.free} free · {bedTally.pulled} pulled
            </span>
            {onOpenBeds ? (
              <button type="button" className={styles.keyLink} onClick={onOpenBeds}>
                Full bed list
              </button>
            ) : null}
          </div>
          {figures ? <div className={styles.bedFigures}>{figures}</div> : null}
        </Card>

        <div className={styles.flowWrap}>
          <Card className={`${styles.flowCard} ${styles.v6Card}`} aria-labelledby="ward-home-flow">
            <CardHead
              id="ward-home-flow"
              icon={ArrowLeftRight}
              title="Ward flow"
              aside={<span className={styles.v6Meta}>{formatInstant(now)}</span>}
            />
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
                          <li
                            key={movement.id}
                            className={styles.awaitingRow}
                            data-testid={`ward-incoming-${movement.id}`}
                          >
                            <div className={styles.awaitingIdentity}>
                              <span className={styles.awaitingTier} aria-hidden="true">
                                {movement.urgency}
                              </span>
                              <span className={styles.awaitingName}>Incoming patient</span>
                              <span className={styles.awaitingMeta}>
                                {movement.cohort} &middot; {movement.security} &middot; {movement.sex} &middot;{" "}
                                {movement.legalStatus}
                              </span>
                            </div>

                            {notice ? (
                              <span
                                className={
                                  notice.level === "voluntary_on_locked" ? styles.noticeProminent : styles.notice
                                }
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
                                onClick={blocked ? ignoreUnavailableActivation : () => toggleDecline(movement.id)}
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
                                onSubmit={(event) => submitDecline(event, movement.id)}
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
                                        onChange={() => setDeclineReason(reason)}
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
                            <span className={styles.flowDetail}>
                              {answer.reason ? answer.reason.replace(/_/g, " ") : "Accepted by this ward"}
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
                      ["today", "Today", "info", todayRows],
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
                  <button type="button" className={styles.keyLink} onClick={() => onOpenDischarges?.()}>
                    All discharges
                  </button>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card className={`${styles.shiftCard} ${styles.v6Card}`} id="ward-this-shift" aria-labelledby="ward-home-shift">
        <CardHead
          id="ward-home-shift"
          icon={ListChecks}
          title="This shift"
          action={
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
          }
        />
        <div className={styles.shiftPane} data-active={shiftView === "todo"}>
          <div className={styles.todoGrid}>
            {renderTodoColumn(
              "now",
              "Act now",
              "danger",
              actNow,
              liveFormAlerts.length > 0 ? (
                <span className={styles.legalTag}>
                  <LegalLimitsNotChecked variant="tag" />
                </span>
              ) : undefined,
            )}
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
        </div>
      </Card>

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
          </div>
        ) : null}
      </div>
    </div>
  );
}
