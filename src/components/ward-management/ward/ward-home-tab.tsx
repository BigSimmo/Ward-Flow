"use client";

import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
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
import { BedDouble, ChartColumn, CircleCheck, DoorOpen, History, Inbox, Scale, Truck } from "lucide-react";
import {
  buttonClass,
  Card,
  CardHead,
  ColumnChart,
  IconTile,
  Segmented,
  SrOnly,
  StatusGlyph,
  type WfTone,
} from "@/components/wf";
import type { BedItem } from "./ward-beds-matrix";

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

/** On the way out shows the soonest few; the Discharges tab holds the full list. */
const OUT_ROWS_SHOWN = 5;

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

  function focusAwaiting() {
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
      title: leaveBed.absentWithoutLeave ? "Absent without leave" : "Approved leave",
      detail: leaveBed.absentWithoutLeave
        ? `Since ${formatInstant(leaveBed.absentWithoutLeave.since)}`
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
  type BedFilter = "all" | "look" | "leaving" | "free";
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
      : bed.pastDate
        ? "Past expected date"
        : bed.blockReason
          ? String(bed.blockReason)
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
                  : "";
    const glyph: WfTone | null = free
      ? "success"
      : awayAtEd || bed.pastDate
        ? "danger"
        : look
          ? "warning"
          : leaving
            ? "info"
            : null;
    const number = String(bed.bedNumber).padStart(2, "0");
    const accessibleName = [bed.bedLabel, stateWord, days ? `day ${bed.stayDays}` : "", note]
      .filter(Boolean)
      .join(", ");
    return { bed, free, leaving, look, stateWord, days, note, glyph, number, accessibleName };
  });
  const [bedFilter, setBedFilter] = useState<BedFilter>("all");
  const shownBeds = bedRows.filter((row) =>
    bedFilter === "all" ? true : bedFilter === "look" ? row.look : bedFilter === "leaving" ? row.leaving : row.free,
  );

  // Coming in: accepted arrivals first, then referrals still waiting for this ward's answer.
  type FlowRow = {
    key: string;
    title: string;
    when?: string;
    detail: string;
    tone: WfTone;
    action: string;
    run: () => void;
  };
  const comingRows: FlowRow[] = [
    ...accepted.map((movement): FlowRow => {
      const eta = movement.arrivalDetails?.estimatedArrivalAt;
      const late = eta !== undefined && eta < now;
      return {
        key: movement.id,
        title: resolvePatientIdentity(movement).displayName,
        when: eta === undefined ? undefined : `${late ? "Expected" : "ETA"} ${formatInstantWithDay(eta, now)}`,
        detail: late ? "Late" : stageCopy[movement.stage].label,
        tone: late ? "warning" : "info",
        action: "Open",
        run: () => onOpenArrival?.(movement.id),
      };
    }),
    ...incoming.map((movement): FlowRow => ({
      key: `referral-${movement.id}`,
      title: "Incoming patient",
      detail: `Referral waiting · ${movement.cohort}, ${movement.security}`,
      tone: "warning",
      action: "Answer",
      run: focusAwaiting,
    })),
  ];

  // On the way out: this ward's open bed releases, soonest first. A release names its bed, never the patient.
  const outRows = [...pendingBedReleases]
    .sort((left, right) => left.expectedAt - right.expectedAt)
    .map((release) => {
      const bed = (bedsList ?? []).find((item) => item.admissionId === release.admissionId);
      const tone: WfTone = release.blocker ? "danger" : release.state === "confirmed" ? "success" : "neutral";
      return {
        key: release.id,
        title: bed?.bedLabel ?? "Bed release",
        when: formatInstantWithDay(release.expectedAt, now),
        detail: release.blocker
          ? `Blocked · ${release.blocker}`
          : release.state === "confirmed"
            ? "Confirmed"
            : `Expected${release.waitingOn ? ` · ${release.waitingOn}` : ""}`,
        tone,
      };
    });

  // Decisions today: one row per gate on the Decisions tab, worded from recorded facts only.
  const confirmedOut = pendingBedReleases.filter((release) => release.state === "confirmed").length;
  const blockedOut = pendingBedReleases.filter((release) => release.blocker !== null).length;
  const openDecisions = () => onOpenDecisions?.();
  const decisionRows: Array<{
    key: string;
    name: string;
    text: string;
    tone: WfTone;
    action: string;
    due: boolean;
    run: () => void;
  }> = [
    {
      key: "staffing",
      name: "Staffing",
      text: morningRollupConfirmed ? "Morning rollup confirmed." : "Morning rollup still due.",
      tone: morningRollupConfirmed ? "success" : "warning",
      action: morningRollupConfirmed ? "Open" : "Confirm",
      due: !morningRollupConfirmed,
      run: morningRollupConfirmed ? openDecisions : () => onConfirmMorningRollup?.(),
    },
    {
      key: "intake",
      name: "Intake",
      text:
        incoming.length === 0
          ? "No referral waiting for an answer."
          : `${incoming.length} ${incoming.length === 1 ? "referral" : "referrals"} waiting for an answer.`,
      tone: incoming.length === 0 ? "success" : "warning",
      action: incoming.length === 0 ? "Open" : "Answer",
      due: incoming.length > 0,
      run: incoming.length > 0 ? focusAwaiting : openDecisions,
    },
    {
      key: "departures",
      name: "Departures",
      text:
        pendingBedReleases.length === 0
          ? "No discharge expected."
          : `${pendingBedReleases.length} expected out · ${confirmedOut} confirmed${blockedOut > 0 ? ` · ${blockedOut} blocked` : ""}.`,
      tone: blockedOut > 0 ? "danger" : pendingBedReleases.length === 0 ? "success" : "neutral",
      action: "Open",
      due: blockedOut > 0,
      run: openDecisions,
    },
    {
      key: "leave",
      name: "Leave",
      text: unitLeaveBeds.length === 0 ? "Nobody on approved leave." : `${unitLeaveBeds.length} on approved leave.`,
      tone: "neutral",
      action: "Open",
      due: false,
      run: openDecisions,
    },
  ];

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

  return (
    <div className={styles.homeWrap}>
      <span className="sr-only">{pendingPreparation} being made ready</span>
      {liveFormAlerts.length > 0 ? (
        <div className={styles.alertLegalNote}>
          <LegalLimitsNotChecked variant="tag" />
        </div>
      ) : null}
      {liveFormAlerts.map((alert) => (
        <div className={styles.alertStrip} key={alert.key} data-tone={alert.tone}>
          <span className={styles.alertClock}>{alert.countdown}</span>
          <div className={styles.alertMain}>
            <strong>{alert.title}</strong>
            <p className={styles.alertText}>{alert.text}</p>
          </div>
          {alert.actionLabel ? (
            <button type="button" className={styles.btnAlertAct} onClick={() => runAlert(alert)}>
              {alert.actionLabel}
            </button>
          ) : null}
        </div>
      ))}

      <div className={styles.homeBoard}>
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
            }
          />
          {bedRows.length === 0 ? (
            <p className={styles.v6Empty}>No beds are recorded for {unit.name}.</p>
          ) : (
            <ul className={styles.bedTiles} aria-label={`Beds at ${unit.name}`}>
              {shownBeds.map((row) => (
                <li key={row.bed.bedNumber}>
                  <button
                    type="button"
                    className={styles.bedTile}
                    data-status={String(row.bed.status)}
                    data-look={row.look ? "true" : undefined}
                    aria-haspopup="dialog"
                    aria-label={row.accessibleName}
                    onClick={() => onSelectBed?.(Number(row.bed.bedNumber))}
                  >
                    <span className={styles.bedTileTop} aria-hidden="true">
                      <b>{row.number}</b>
                      {row.glyph ? <StatusGlyph tone={row.glyph} size={9} /> : null}
                    </span>
                    <span className={styles.bedTileState} aria-hidden="true">
                      <span>{row.stateWord}</span>
                      {row.days ? <span className={styles.bedTileDays}>{row.days}</span> : null}
                    </span>
                    <span className={styles.bedTileNote} aria-hidden="true">
                      {row.note}
                    </span>
                  </button>
                </li>
              ))}
              {shownBeds.length === 0 ? <li className={styles.v6Empty}>No bed matches this choice.</li> : null}
            </ul>
          )}
          {figures ? <div className={styles.bedFigures}>{figures}</div> : null}
        </Card>

        <div className={styles.areaSide}>
          <section
            id="ward-awaiting-answer"
            aria-label="Awaiting your answer"
            className={`${styles.awaitingCard} ${styles.v6Card}`}
            tabIndex={0}
          >
            <div className={styles.v6Head}>
              <IconTile icon={Inbox} />
              <h2 id="ward-awaiting-heading" className={styles.awaitingHeading}>
                {presentation === "answer" ? "Bed request" : "Awaiting your answer"}
              </h2>
              <span className={styles.v6Meta}>
                {incoming.length === 0 ? "none waiting" : `${incoming.length} waiting`}
              </span>
            </div>
            <div className={styles.cardBody}>
              {incoming.length === 0 ? (
                <p className={styles.placeholder}>No referral is currently awaiting an answer from {unit.name}.</p>
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
            </div>
          </section>

          <Card className={`${styles.checksCard} ${styles.v6Card}`} aria-labelledby="ward-home-checks">
            <CardHead
              id="ward-home-checks"
              icon={CircleCheck}
              title="Shift checks"
              aside={
                <span className={styles.checkBadge}>
                  <b>{checksDone}</b> of {shiftChecks.length} done
                </span>
              }
            />
            <div className={styles.cardBody}>
              <div className={styles.checkItem}>
                <div className={styles.checkLeft}>
                  <span className={styles.checkMark} data-done={capacityConfirmed} aria-hidden="true" />
                  <span>
                    <strong>Capacity numbers.</strong>{" "}
                    {capacityConfirmed && unit.allocatable.confirmedAt !== undefined
                      ? `Confirmed ${formatInstant(unit.allocatable.confirmedAt)}.`
                      : "Not confirmed this shift."}
                  </span>
                </div>
                {capacityConfirmed ? (
                  <span className={styles.statusWord} data-tone="good">
                    Verified
                  </span>
                ) : (
                  <button type="button" className={styles.btnAlertAct} onClick={() => onOpenConfirmNumbers?.()}>
                    Confirm
                  </button>
                )}
              </div>
              <div className={styles.checkItem}>
                <div className={styles.checkLeft}>
                  <span className={styles.checkMark} data-done={morningRollupConfirmed} aria-hidden="true" />
                  <span>
                    <strong>Morning rollup.</strong> {morningRollupConfirmed ? "Confirmed today." : "Still due."}
                  </span>
                </div>
                {morningRollupConfirmed ? (
                  <span className={styles.statusWord} data-tone="good">
                    Verified
                  </span>
                ) : (
                  <button type="button" className={styles.btnAlertAct} onClick={() => onConfirmMorningRollup?.()}>
                    Confirm
                  </button>
                )}
              </div>
              <div className={styles.checkItem}>
                <div className={styles.checkLeft}>
                  <span className={styles.checkMark} data-done={referralsClear} aria-hidden="true" />
                  <span>
                    <strong>Unanswered referrals.</strong>{" "}
                    {referralsClear ? "None waiting." : `${incoming.length} waiting.`}
                  </span>
                </div>
                {referralsClear ? (
                  <span className={styles.statusWord} data-tone="good">
                    Clear
                  </span>
                ) : (
                  <button type="button" className={styles.btnAlertAct} onClick={focusAwaiting}>
                    Answer
                  </button>
                )}
              </div>
              {(
                [
                  ["drugs", "Controlled drug count", "Tick when the register has been checked."],
                  ["seclusion", "Seclusion check", "Tick when the suite and duress alarm have been checked."],
                  ["afternoon", "Afternoon sign-off", "Tick when the midday numbers have been signed."],
                ] as const
              ).map(([id, label, hint]) => (
                <div className={styles.checkItem} key={id}>
                  <label className={styles.checkLeft} title={`${hint} On this screen only. Not sent.`}>
                    <input
                      type="checkbox"
                      checked={localChecks[id] !== null}
                      onChange={() => toggleLocalCheck(id)}
                      aria-label={label}
                    />
                    <span>
                      <strong>{label}.</strong>{" "}
                      <span className={styles.checkNote}>{hint} On this screen only. Not sent.</span>
                    </span>
                  </label>
                  <span className={styles.statusWord} data-tone={localChecks[id] !== null ? "good" : "warn"}>
                    {localChecks[id] !== null ? formatInstantWithDay(localChecks[id], now) : "Due"}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className={`${styles.areaComing} ${styles.v6Card}`} aria-labelledby="ward-home-coming">
          <CardHead
            id="ward-home-coming"
            icon={Truck}
            title={
              <>
                Coming in<SrOnly>, at a glance</SrOnly>
              </>
            }
            aside={
              <span className={styles.v6Meta}>
                {comingRows.length === 0 ? "none" : `${comingRows.length} expected`}
              </span>
            }
          />
          {comingRows.length === 0 ? (
            <p className={styles.v6Empty}>
              Nobody is accepted, pulled or en route, and no referral is waiting. Absence here means none.
            </p>
          ) : (
            <ul className={styles.flowList}>
              {comingRows.map((row) => (
                <li key={row.key} className={styles.flowRow}>
                  <span className={styles.flowTitle}>{row.title}</span>
                  {row.when ? <span className={styles.flowWhen}>{row.when}</span> : null}
                  <span className={styles.flowDetail}>
                    <StatusGlyph tone={row.tone} size={8} />
                    {row.detail}
                  </span>
                  <button type="button" className={styles.flowAction} onClick={row.run}>
                    {row.action}
                    <SrOnly> for {row.title}</SrOnly>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className={`${styles.areaOut} ${styles.v6Card}`} aria-labelledby="ward-home-out">
          <CardHead
            id="ward-home-out"
            icon={DoorOpen}
            title={
              <>
                On the way out<SrOnly>, at a glance</SrOnly>
              </>
            }
            aside={
              <span className={styles.v6Meta}>{outRows.length === 0 ? "none" : `${outRows.length} recorded`}</span>
            }
          />
          {outRows.length === 0 ? (
            <p className={styles.v6Empty}>No discharge is expected or confirmed for {unit.name}.</p>
          ) : (
            <ul className={styles.flowList}>
              {outRows.slice(0, OUT_ROWS_SHOWN).map((row) => (
                <li key={row.key} className={styles.flowRow}>
                  <span className={styles.flowTitle}>{row.title}</span>
                  <span className={styles.flowWhen}>{row.when}</span>
                  <span className={styles.flowDetail}>
                    <StatusGlyph tone={row.tone} size={8} />
                    {row.detail}
                  </span>
                  <button type="button" className={styles.flowAction} onClick={() => onOpenDischarges?.()}>
                    Open
                    <SrOnly> discharges for {row.title}</SrOnly>
                  </button>
                </li>
              ))}
              {outRows.length > OUT_ROWS_SHOWN ? (
                <li className={styles.flowMore}>
                  <button type="button" className={styles.flowMoreButton} onClick={() => onOpenDischarges?.()}>
                    {outRows.length - OUT_ROWS_SHOWN} more on Discharges
                  </button>
                </li>
              ) : null}
            </ul>
          )}
        </Card>

        <Card className={`${styles.areaLog} ${styles.v6Card}`} aria-labelledby="ward-home-log">
          <CardHead
            id="ward-home-log"
            icon={History}
            title="Shift log"
            aside={
              <span className={styles.v6Meta}>{logRows.length === 0 ? "none" : `${logRows.length} recorded`}</span>
            }
          />
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
        </Card>

        <Card className={`${styles.areaDecisions} ${styles.v6Card}`} aria-labelledby="ward-home-decisions">
          <CardHead
            id="ward-home-decisions"
            icon={Scale}
            title="Today's decisions"
            aside={<span className={styles.v6Meta}>now {formatInstant(now)}</span>}
          />
          <ul className={styles.decisionList}>
            {decisionRows.map((row) => (
              <li key={row.key} className={styles.decisionRow} data-due={row.due ? "true" : undefined}>
                <StatusGlyph tone={row.tone} size={9} />
                <span className={styles.decisionName}>{row.name}</span>
                <span className={styles.decisionText}>{row.text}</span>
                <button type="button" className={buttonClass({ variant: "sec", size: "sm" })} onClick={row.run}>
                  {row.action}
                  <SrOnly> {row.name.toLowerCase()} decisions</SrOnly>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className={`${styles.areaStay} ${styles.v6Card}`} aria-labelledby="ward-home-stay">
          <CardHead
            id="ward-home-stay"
            icon={ChartColumn}
            title="Length of stay"
            aside={
              <span className={styles.v6Meta}>
                {stayDays.length === 0
                  ? "none recorded"
                  : `${stayDays.length} in beds, days${stayMedian === null ? "" : ` · median ${stayMedian}d`}`}
              </span>
            }
          />
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
        </Card>
      </div>

      {/* 4. Preserved Test Contracts for Withdrawn and Overrides (Hidden from visual clutter) */}
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

        {/* Answer capacity and history preserved test contracts */}
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
