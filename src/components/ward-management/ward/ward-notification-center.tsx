"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Bell,
  BellOff,
  ClipboardCheck,
  Megaphone,
  MessageSquare,
  ShieldCheck,
  Stethoscope,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";

import { StatusGlyph, type WfTone } from "@/components/wf";
import { type CapacityFigure, type Movement, type Notice } from "@/components/ward-management/ward-model";
import { wardClearanceAlerts } from "./ward-clearance-alerts";
import { type Patient } from "@/components/ward-management/ward-patients";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import {
  formatInstantWithDay,
  minuteOfDay,
  splitDuration,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { noticeIsForWardChrome } from "@/components/ward-management/ward-chrome-role";
import { LATE_ARRIVAL_GRACE_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import {
  NAME_NOT_RECORDED,
  UMRN_NOT_RECORDED,
  resolveSubjectPatient,
  withUmrnInPlaceOfMovementIds,
  type ResolvedPatientInfo,
} from "@/components/ward-management/ward-patient-resolver";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";
import { triggerUrgentBuzzAlert, useAudioBuzzPreference } from "@/components/ward-management/shell/ward-sound-store";

import { buzzKeys, refreshRequestIsOpen } from "./ward-buzz-keys";
// Notices option A (Josh, 22 Oct 2026): the ward's Notices use the shared Alerts drawer's own rows,
// header, filter and footer, so a ward and a coordinator read one pattern.
import drawer from "../ward-tasks-drawer.module.css";
import styles from "./ward-notification-center.module.css";

export interface WardNotificationCenterProps {
  unitId: string;
  unitName: string;
  now: Instant;
  movements: Movement[];
  patients?: readonly Patient[];
  notices: Notice[];
  refreshRequests?: {
    unitId: string;
    at: Instant;
    byRole: string;
    message?: string;
    urgent?: boolean;
    confirmations?: number;
  }[];
  /** The ward's capacity figure: its own confirmation answers a capacity request (DEC-L5-04). */
  allocatable?: Pick<CapacityFigure, "source" | "confirmedAt" | "confirmations">;
  morningRollupConfirmed?: boolean;
  morningRollupDeadlinePassed?: boolean;
  morningRollupDeadlineMinutes?: number;
  onConfirmMorningRollup?: () => void;
  onAcknowledgeNotice?: (noticeId: string) => void;
  onDismissBuzz?: (buzzKey: string) => void;
  onClose?: () => void;
  /** Phone (20 Oct 2026): shown inside a pop-up sheet, which carries its own title and Close. */
  inSheet?: boolean;
}

type FilterKey = "all" | "act" | "check" | "coordinator";

type BuzzEntry = {
  buzz: NonNullable<WardNotificationCenterProps["refreshRequests"]>[number];
  buzzKey: string;
};

/**
 * Phone notices (20 Oct 2026): the same buzz sent again (same sender, words and urgency) shows as
 * one card with how many times it came, newest first, so a run of repeats is answered once. Nothing
 * is merged in the record: each buzz keeps its own key and is acknowledged on its own.
 */
export function groupRepeatedBuzzes(entries: readonly BuzzEntry[]): BuzzEntry[][] {
  const groups = new Map<string, BuzzEntry[]>();
  for (const entry of entries) {
    const key = [entry.buzz.byRole, entry.buzz.message ?? "", entry.buzz.urgent === true].join("\u0000");
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }
  return [...groups.values()].map((group) => [...group].sort((left, right) => right.buzz.at - left.buzz.at));
}

/* Walkthrough code-read, 25 Sept 2026: this called the resolver with movements only, so every
   patient — linked or not — came back "Unknown Patient". Inside the provider it now uses the
   provider's identity projection, exactly as the ward screen does; it never reads the full referral
   array (the ward-only referral boundary). A bare render (component tests) falls back as before. */
function getPatientIdentity(
  movement: Movement,
  movements: Movement[],
  resolveIdentity: ((subject: Movement) => ResolvedPatientInfo) | undefined,
  patients?: readonly Patient[],
): { name: string; umrn?: string } {
  // Some explicitly supplied notification DTOs carry a display name; validate that boundary without an unchecked cast.
  const customName =
    "patientName" in movement && typeof movement.patientName === "string"
      ? movement.patientName
      : "displayName" in movement && typeof movement.displayName === "string"
        ? movement.displayName
        : undefined;
  if (customName) return { name: customName };
  try {
    const resolved = resolveIdentity
      ? resolveIdentity(movement)
      : resolveSubjectPatient(movement, { movements, patients });
    return { name: resolved.displayName, umrn: resolved.umrn === UMRN_NOT_RECORDED ? undefined : resolved.umrn };
  } catch {
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    return { name: NAME_NOT_RECORDED };
  }
}

type RowProps = {
  tone: WfTone;
  icon: LucideIcon;
  title: string;
  /** Status word beside the glyph: "Act now", "Check", "Buzz". */
  status: string;
  meta?: ReactNode;
  value?: string;
  state?: string;
  detail?: ReactNode;
  actions?: ReactNode;
  done?: boolean;
  testId?: string;
};

/** One row in the shared Alerts drawer pattern: icon, title, status line, when, one line of detail, the action. */
function NoticeRow({
  tone,
  icon: RowIcon,
  title,
  status,
  meta,
  value,
  state,
  detail,
  actions,
  done,
  testId,
}: RowProps) {
  const stateTone = tone === "danger" ? "danger" : tone === "warning" ? "warning" : undefined;
  return (
    <li
      className={drawer.row}
      data-tone={tone}
      data-expanded="true"
      data-done={done ? "true" : "false"}
      data-testid={testId}
    >
      <div className={drawer.rowHead}>
        <span className={drawer.rowIcon} aria-hidden="true">
          <RowIcon aria-hidden="true" />
        </span>
        <div className={drawer.rowText}>
          <span className={`${drawer.rowTitle} ${styles.rowTitleWraps}`}>{title}</span>
          <p className={`${drawer.rowMeta} ${styles.rowMetaWraps}`}>
            <StatusGlyph tone={tone} size={9} />
            <span>{status}</span>
            {meta}
          </p>
        </div>
        {value || state ? (
          <div className={drawer.rowWhen}>
            {value ? (
              <span className={drawer.rowValue}>
                {stateTone ? <StatusGlyph tone={tone} size={9} /> : null}
                {value}
              </span>
            ) : null}
            {state ? (
              <span className={drawer.rowState} data-tone={stateTone}>
                {state}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {detail ? (
        <div className={drawer.rowDetail}>
          <p className={drawer.detailLine}>{detail}</p>
        </div>
      ) : null}
      {actions ? <div className={drawer.rowActions}>{actions}</div> : null}
    </li>
  );
}

function PatientMeta({ name, umrn }: { name: string; umrn?: string }) {
  return (
    <>
      <span aria-hidden="true">·</span>
      <strong>{name}</strong>
      {umrn ? (
        <>
          <span aria-hidden="true">·</span>
          <span className={drawer.mono}>{umrn}</span>
        </>
      ) : null}
    </>
  );
}

export function WardNotificationCenter({
  unitId,
  unitName,
  now,
  movements,
  patients,
  notices,
  refreshRequests = [],
  allocatable,
  morningRollupConfirmed = false,
  morningRollupDeadlinePassed = false,
  morningRollupDeadlineMinutes = 570,
  onConfirmMorningRollup,
  onAcknowledgeNotice,
  onDismissBuzz,
  onClose,
  inSheet = false,
}: WardNotificationCenterProps) {
  // Read the provider when present (the ward screen); a bare render (component tests) has none, and
  // the resolver then falls back exactly as before.
  const context = useOptionalWardFlowSelect("resolvePatientIdentity", "patients");
  const resolveIdentity = context?.resolvePatientIdentity;
  const effectivePatients = patients ?? context?.patients;
  // D-39: notices name the patient by UMRN. Inside the provider that comes from its identity
  // projection (referral-linked journeys included, without this screen reading referrals).
  const noticeUmrnLookup = useMemo(
    () =>
      resolveIdentity
        ? (movementId: string) => resolveIdentity({ movementId }).umrn
        : { patients: effectivePatients, movements },
    [resolveIdentity, effectivePatients, movements],
  );
  const identityOf = (m: Movement) => getPatientIdentity(m, movements, resolveIdentity, effectivePatients);
  const rollupHour = Math.floor(morningRollupDeadlineMinutes / 60);
  const rollupMin = morningRollupDeadlineMinutes % 60;
  const rollupTimeLabel = `${String(rollupHour).padStart(2, "0")}:${String(rollupMin).padStart(2, "0")}`;
  const [filter, setFilter] = useState<FilterKey>("all");
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useAudioBuzzPreference();
  const baseId = useId();

  // 1. Coordinator Buzzes matching unitId, still open: the ward's capacity confirmation answers one
  // on every desk (DEC-L5-04). Keys come from the whole list so a dismissal keeps its key.
  const keys = buzzKeys(refreshRequests);
  const matchingBuzzes = refreshRequests
    .map((buzz, index) => ({ buzz, buzzKey: keys[index] ?? "" }))
    .filter(({ buzz }) => buzz.unitId === unitId && refreshRequestIsOpen(buzz, allocatable));

  const hasUrgentBuzz = matchingBuzzes.some(({ buzz }) => buzz.urgent === true);

  // Trigger audio ping when urgent buzz is active
  useEffect(() => {
    if (hasUrgentBuzz) {
      triggerUrgentBuzzAlert();
    }
  }, [hasUrgentBuzz]);

  const handleAcknowledgeBuzz = (buzzKey: string, isUrgent?: boolean) => {
    if (isUrgent) {
      triggerUrgentBuzzAlert();
    }
    onDismissBuzz?.(buzzKey);
  };
  const acknowledgeGroup = (group: readonly BuzzEntry[]) => {
    if (group.some(({ buzz }) => buzz.urgent === true)) triggerUrgentBuzzAlert();
    for (const { buzzKey } of group) onDismissBuzz?.(buzzKey);
  };
  // Urgent buzzes first, then newest first.
  const buzzGroups = groupRepeatedBuzzes(matchingBuzzes).sort(
    (left, right) =>
      Number(right[0]?.buzz.urgent === true) - Number(left[0]?.buzz.urgent === true) ||
      (right[0]?.buzz.at ?? 0) - (left[0]?.buzz.at ?? 0),
  );

  // 2. Ward work: the morning numbers, late arrivals and clearance gaps.
  const isCensusOverdue = Boolean(morningRollupDeadlinePassed && !morningRollupConfirmed);
  const censusLateMinutes = Math.max(0, minuteOfDay(now) - morningRollupDeadlineMinutes);

  const overdueArrivals = movements.filter((m) => {
    if (m.acceptedUnitId !== unitId) return false;
    const eta = m.arrivalDetails?.estimatedArrivalAt;
    if (eta === undefined) return false;
    return now > eta + LATE_ARRIVAL_GRACE_MINUTES;
  });

  // Audit 1, CS-14 (20 Oct 2026): list incoming journeys with no clearance recorded on their own row.
  // A ward screen reads the transfer's own record only: referral data reaches ward code through the
  // ward-scoped projection (FD-23), which carries no clearance, so the row says "on the transfer".
  // Each row counts once in the badge (ward-clearance-alerts.ts), so a shown row never sits under a zero.
  const { missing: missingClearances, unrecorded: unrecordedClearances } = wardClearanceAlerts(movements, unitId);

  // Option A: a clearance row opens that patient's request in the ward's Answer view, or the transfer
  // once accepted. The request is named in the query, so the Answer view does not land on the oldest one.
  const transferAction = (m: Movement) => {
    const accepted = m.acceptedUnitId === unitId;
    return (
      <Link
        className={`${drawer.btn} ${drawer.btnPrimary}`}
        href={
          accepted
            ? movementHref(m.id)
            : `/ward-flow/ward/${encodeURIComponent(unitId)}/answer?movement=${encodeURIComponent(encodeRecordAddress(m.id))}`
        }
        onClick={() => onClose?.()}
      >
        {accepted ? "Open transfer" : "Open request"}
      </Link>
    );
  };

  // 3. Direct Ward Notices
  const wardNotices = notices.filter((n) => noticeIsForWardChrome(n, "ward", unitId, now));

  // Counts for the heading, the filter and the badge. "Check" holds clearance not recorded: a gap to
  // check, not an alarm, but still counted so every row shown is in the total.
  const buzzCount = matchingBuzzes.length;
  const unreadNoticesCount = wardNotices.filter((n) => n.readAt === undefined).length;
  const actCount = (isCensusOverdue ? 1 : 0) + overdueArrivals.length + missingClearances.length;
  const checkCount = unrecordedClearances.length;
  const coordinatorCount = buzzCount + unreadNoticesCount;
  const totalUnreadAlerts = actCount + checkCount + coordinatorCount;

  const filters: { id: FilterKey; label: string; count: number }[] = [
    { id: "all", label: "All", count: totalUnreadAlerts },
    { id: "act", label: "Act now", count: actCount },
    { id: "check", label: "Check", count: checkCount },
    { id: "coordinator", label: "Coordinator", count: coordinatorCount },
  ];
  const showAct = filter === "all" || filter === "act";
  const showCheck = filter === "all" || filter === "check";
  const showCoordinator = filter === "all" || filter === "coordinator";
  const attentionShown = (showAct ? actCount : 0) + (showCheck ? checkCount : 0);

  const attentionRows = (
    <>
      {showAct && isCensusOverdue ? (
        <NoticeRow
          tone="danger"
          icon={ClipboardCheck}
          title="Morning numbers not confirmed"
          status="Act now"
          meta={
            <>
              <span aria-hidden="true">·</span>
              <span>Due {rollupTimeLabel}</span>
            </>
          }
          value={censusLateMinutes > 0 ? splitDuration(censusLateMinutes) : undefined}
          state="Overdue"
          detail="Confirm today's discharges and the beds you can offer."
          testId="ward-census-overdue"
          actions={
            <button
              type="button"
              className={`${drawer.btn} ${drawer.btnPrimary}`}
              onClick={() => onConfirmMorningRollup?.()}
            >
              Confirm numbers
            </button>
          }
        />
      ) : null}
      {showAct
        ? overdueArrivals.map((m) => {
            const who = identityOf(m);
            const eta = formatInstantWithDay(m.arrivalDetails!.estimatedArrivalAt, now);
            return (
              <NoticeRow
                key={`overdue-${m.id}`}
                tone="danger"
                icon={Truck}
                title="Arrival overdue"
                status="Act now"
                meta={<PatientMeta {...who} />}
                value={`ETA ${eta}`}
                state="Overdue"
                detail={`Expected ${eta}. More than ${LATE_ARRIVAL_GRACE_MINUTES} minutes late.`}
                actions={transferAction(m)}
              />
            );
          })
        : null}
      {showAct
        ? missingClearances.map((m) => (
            <NoticeRow
              key={`clearance-${m.id}`}
              tone="danger"
              icon={Stethoscope}
              title="Medical clearance not given"
              status="Act now"
              meta={<PatientMeta {...identityOf(m)} />}
              state="Blocks transfer"
              detail="The transfer cannot go ahead until it is signed off."
              actions={transferAction(m)}
            />
          ))
        : null}
      {showCheck
        ? unrecordedClearances.map((m) => (
            <NoticeRow
              key={`clearance-unrecorded-${m.id}`}
              tone="warning"
              icon={Stethoscope}
              title="Medical clearance not recorded"
              status="Check"
              meta={<PatientMeta {...identityOf(m)} />}
              state="Before arrival"
              detail={
                m.acceptedUnitId === unitId
                  ? "Not recorded on the transfer. Check with the sending team before arrival."
                  : "Not recorded on the transfer. Check with the sending team before you accept."
              }
              testId="ward-clearance-not-recorded"
              actions={transferAction(m)}
            />
          ))
        : null}
    </>
  );

  const buzzRows = buzzGroups.map((group, groupIndex) => {
    const [latest] = group;
    if (!latest) return null;
    const { buzz, buzzKey } = latest;
    const roleLabel =
      buzz.byRole === "coordinator" ? "State Bed Flow Coordinator" : buzz.byRole || "State Bed Flow Coordinator";
    const messageText = buzz.message || "Capacity refresh requested";
    const meta = (
      <>
        <span aria-hidden="true">·</span>
        <span>{roleLabel}</span>
      </>
    );
    if (group.length === 1) {
      return (
        <NoticeRow
          key={`buzz-${buzzKey}`}
          tone={buzz.urgent ? "danger" : "info"}
          icon={Megaphone}
          title={messageText}
          status={buzz.urgent ? "Urgent buzz" : "Buzz"}
          meta={meta}
          value={formatInstantWithDay(buzz.at, now)}
          actions={
            <button
              type="button"
              className={`${drawer.btn} ${drawer.btnPrimary}`}
              onClick={() => handleAcknowledgeBuzz(buzzKey, buzz.urgent)}
            >
              Acknowledge
            </button>
          }
        />
      );
    }
    const open = openGroups.has(buzzKey);
    // The key can hold message text with spaces, which would split aria-controls; use the place.
    const eachId = `${baseId}-each-${groupIndex}`;
    return (
      <NoticeRow
        key={`buzz-group-${buzzKey}`}
        tone={buzz.urgent ? "danger" : "info"}
        icon={Megaphone}
        title={messageText}
        status={`${buzz.urgent ? "Urgent buzz" : "Buzz"} ×${group.length}`}
        meta={meta}
        value={`Latest ${formatInstantWithDay(buzz.at, now)}`}
        testId="ward-buzz-group"
        detail={
          open ? (
            <span id={eachId} className={styles.repeatList}>
              {group.map((entry) => (
                <span key={entry.buzzKey} className={styles.repeatItem}>
                  <time>{formatInstantWithDay(entry.buzz.at, now)}</time>
                  <button
                    type="button"
                    className={drawer.btn}
                    onClick={() => handleAcknowledgeBuzz(entry.buzzKey, entry.buzz.urgent)}
                  >
                    Acknowledge
                  </button>
                </span>
              ))}
            </span>
          ) : undefined
        }
        actions={
          <>
            <button
              type="button"
              className={`${drawer.btn} ${drawer.btnPrimary}`}
              onClick={() => acknowledgeGroup(group)}
            >
              Acknowledge all {group.length}
            </button>
            <button
              type="button"
              className={drawer.btn}
              aria-expanded={open}
              aria-controls={open ? eachId : undefined}
              onClick={() =>
                setOpenGroups((previous) => {
                  const next = new Set(previous);
                  if (next.has(buzzKey)) next.delete(buzzKey);
                  else next.add(buzzKey);
                  return next;
                })
              }
            >
              {open ? "Hide each" : "Show each"}
            </button>
          </>
        }
      />
    );
  });

  const noticeRows = wardNotices.map((notice) => {
    const isRead = notice.readAt !== undefined;
    return (
      <NoticeRow
        key={notice.id}
        tone={isRead ? "success" : "info"}
        icon={MessageSquare}
        title={withUmrnInPlaceOfMovementIds(notice.sentence, noticeUmrnLookup)}
        status={isRead ? "Read" : "Notice"}
        value={formatInstantWithDay(notice.raisedAt, now)}
        done={isRead}
        actions={
          isRead ? undefined : (
            <button
              type="button"
              className={`${drawer.btn} ${drawer.btnPrimary}`}
              onClick={() => onAcknowledgeNotice?.(notice.id)}
            >
              Acknowledge
            </button>
          )
        }
      />
    );
  });

  const nothingFromCoordinator = matchingBuzzes.length === 0 && wardNotices.length === 0;
  const quiet = (text: string) => (
    <p className={styles.quietLine}>
      <StatusGlyph tone="success" size={9} />
      {text}
    </p>
  );

  return (
    // Only the short summary below is a live region, so a change to the counts or filter is heard
    // once rather than as the whole panel re-read. The summary carries a screen-reader-only
    // "sample records" in the same run, so a count is never read out bare (expected red #1,
    // announced figures carry their marker). No visible change.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- catches Escape bubbling up from the focused control inside
    <section
      className={`${styles.panel} ${hasUrgentBuzz ? styles.urgentBuzzPulse : ""} ${inSheet ? styles.inSheet : ""}`}
      aria-label={`Notices for ${unitName}`}
      data-testid="ward-notification-center"
      data-urgent-buzz={hasUrgentBuzz ? "true" : "false"}
      onKeyDown={(event) => {
        if (event.key === "Escape" && onClose) {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <span className="sr-only" aria-live="polite" aria-atomic="true" data-testid="ward-notification-live-summary">
        {`${totalUnreadAlerts} unread notification${totalUnreadAlerts === 1 ? "" : "s"}, ${filter} filter active, sample records`}
      </span>
      {inSheet ? null : (
        <div className={drawer.header}>
          <span className={drawer.headerIcon} aria-hidden="true">
            <Bell aria-hidden="true" />
          </span>
          <div className={drawer.headerText}>
            <h2 className={drawer.heading}>Notices</h2>
            <p className={drawer.headerNote}>{unitName} · this ward only</p>
          </div>
          <span className={drawer.headingCount} data-testid="ward-notification-count">
            <span className={drawer.mono}>{totalUnreadAlerts}</span> open
            <span className="sr-only"> sample records</span>
          </span>
          {onClose ? (
            <button
              type="button"
              className={drawer.closeButton}
              onClick={onClose}
              aria-label="Close notices"
              title="Close notices"
              data-testid="ward-notification-close-btn"
            >
              <X aria-hidden="true" />
            </button>
          ) : null}
        </div>
      )}

      {/* The shared drawer hides its filter on a phone (under 48rem), and so does this one. */}
      <div className={drawer.controls}>
        <div className={drawer.filterBar}>
          <div className={drawer.segmented} role="group" aria-label="Filter notices">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                className={drawer.segment}
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}{" "}
                <span className={drawer.count}>
                  {item.count}
                  <span className="sr-only"> sample records</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`${drawer.drawerBody} ${styles.body}`}>
        {showAct || showCheck ? (
          attentionShown > 0 ? (
            <section className={drawer.section} aria-labelledby={`${baseId}-heading-attention`}>
              <div className={drawer.sectionHead}>
                <ShieldCheck aria-hidden="true" />
                <h3 id={`${baseId}-heading-attention`} className={drawer.sectionTitle}>
                  Needs attention
                </h3>
                <span className={drawer.count}>
                  {attentionShown}
                  <span className="sr-only"> sample records</span>
                </span>
                <span className={drawer.sectionNote}>Leaves when done</span>
              </div>
              <ul className={drawer.list}>{attentionRows}</ul>
            </section>
          ) : filter !== "all" ? (
            quiet(`Nothing to ${filter === "check" ? "check" : "act on"} on ${unitName}.`)
          ) : null
        ) : null}

        {showCoordinator ? (
          nothingFromCoordinator ? (
            quiet(
              attentionShown === 0 && filter === "all"
                ? `Nothing needs attention on ${unitName}.`
                : "No buzzes or notices from the coordinator.",
            )
          ) : (
            <section className={drawer.section} aria-labelledby={`${baseId}-heading-coordinator`}>
              <div className={drawer.sectionHead}>
                <Megaphone aria-hidden="true" />
                <h3 id={`${baseId}-heading-coordinator`} className={drawer.sectionTitle}>
                  From the coordinator
                </h3>
                <span className={drawer.count}>
                  {coordinatorCount}
                  <span className="sr-only"> sample records</span>
                </span>
              </div>
              <ul className={drawer.list}>
                {buzzRows}
                {noticeRows}
              </ul>
            </section>
          )
        ) : null}
      </div>

      <div className={`${drawer.drawerFoot} ${styles.foot}`}>
        <span className={styles.footNote}>Urgent buzzes from the coordinator play a sound.</span>
        <button
          type="button"
          data-testid="ward-buzz-audio-toggle"
          className={drawer.btn}
          aria-pressed={soundEnabled}
          onClick={() => setSoundEnabled(!soundEnabled)}
        >
          {soundEnabled ? <Bell aria-hidden="true" /> : <BellOff aria-hidden="true" />}
          {soundEnabled ? "Buzz sound on" : "Buzz sound off"}
        </button>
      </div>
    </section>
  );
}
