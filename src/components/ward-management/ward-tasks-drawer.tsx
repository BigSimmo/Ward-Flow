"use client";

import {
  AlarmClock,
  ArrowUpRight,
  BedDouble,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Filter,
  ListChecks,
  Phone,
  PhoneCall,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  TriangleAlert,
  UserCheck,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState, type Dispatch } from "react";
import { WARD_HOME_HREF, WARD_NAV, WARD_VIEWS } from "@/components/ward-management/ward-nav";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { StatusGlyph, durMinutes, useIsPhone, useOptionalToast, type WfTone } from "@/components/wf";
import { callRows, type CallRow, type CallTarget } from "./patients/patient-call-list";
import { edHealthService } from "./ward-service-scope";
import { resolveSubjectPatient } from "./ward-patient-resolver";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { edById } from "./ward-sites";
import { stageCopy } from "./ward-derivations";
import type { Admission } from "./ward-admissions";
import type { Movement, Referral, Unit } from "./ward-model";
import type { Patient } from "./ward-patients";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import type { WardFlowEvent, WardFlowRole } from "@/components/ward-management/ward-flow-events";
import {
  inboxItemCompletionState,
  type InboxAcknowledgement,
  type InboxCompletionEntry,
} from "@/components/ward-management/ward-flow-reducer";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import type { WardConfiguration } from "./ward-configuration";
import { WARD_FLOW_ROLE_LABELS } from "./ward-flow-roles";
import { decisionTargetReading } from "./ward-decision-targets";
import { DUE_SORT_OPTIONS, sortDueFirst, type DueSortMode } from "./ward-due-sort";
import { inboxItemIsActNow } from "./ward-inbox-reducer";
import {
  activeSnooze,
  currentInboxOwner,
  partitionSnoozed,
  type InboxOwnershipEntry,
  type InboxSnoozeEntry,
} from "./ward-inbox-snooze";
import { InboxRowStatus, InboxSnoozeControl, snoozedLine } from "./inbox-snooze-control";

import styles from "./ward-tasks-drawer.module.css";

type WardTasksDrawerProps = {
  items: InboxItem[];
  acknowledgements: Record<string, InboxAcknowledgement[]>;
  completions: Record<string, InboxCompletionEntry[]>;
  /** Stream A, 9 Oct 2026: who owns each row and each row's snooze history. Optional so a fixture
   *  render without them shows no owner and nothing snoozed. */
  ownership?: Record<string, InboxOwnershipEntry[]>;
  snoozes?: Record<string, InboxSnoozeEntry[]>;
  /** The configured decision targets; when given, each row shows its running target. */
  configuration?: WardConfiguration;
  role: WardFlowRole;
  now: Instant;
  dispatch: Dispatch<WardFlowEvent>;
  onClose: () => void;
  /** `href` is a row's own destination when it is not about a movement (a planned admission). */
  onSelectMovement: (movementId: string, action?: "refer" | "contact", href?: string) => void;
  /** Opens a discharged stay on the discharges board, for rows that carry `admissionId`. */
  onSelectDischarge?: (admissionId: string) => void;
  records?: {
    movements: readonly Movement[];
    admissions?: readonly Admission[];
    patients: readonly Patient[];
    referrals: readonly Referral[];
    units: readonly Unit[];
  };
  withBackdrop?: boolean;
};

type AckFilter = "all" | "open" | "unacknowledged" | "acknowledged" | "completed";

const ACK_FILTER_LABELS: Record<AckFilter, string> = {
  all: "All task states",
  open: "Open tasks",
  unacknowledged: "Not yet acknowledged",
  acknowledged: "Acknowledged",
  completed: "Completed",
};

/** Quick picks only fill the box; the person still records the escalation themselves. */
const ESCALATION_PICKS = ["Duty consultant", "State bed desk", "Executive on call"] as const;

/**
 * Ops-6 (remaining-pages audit, 13 Oct 2026): each escalation pick with the number that answers
 * now, from the On-call directory for the patient's service. Every number is a mock.
 */
function escalationTargets(movement: Movement): CallTarget[] {
  const service = edHealthService(movement.originEdId);
  return [
    {
      kind: "consultant",
      name: "Duty consultant",
      role: "Consultant psychiatrist on call",
      siteCode: edById(movement.originEdId)?.siteCode,
      service,
    },
    { kind: "bedFlow", name: "State bed desk", role: "Statewide bed flow", service: undefined },
    { kind: "executive", name: "Executive on call", role: "Diversion and escalation", service },
  ];
}

/**
 * Ops-5 (remaining-pages audit, 13 Oct 2026): the numbers a task needs, from the On-call
 * directory: transport when a leg is booked or waiting, the sending ED's liaison and the
 * receiving ward's nurse in charge.
 */
function contactTargets(item: InboxItem, movement: Movement, units: readonly Unit[] | undefined): CallTarget[] {
  const targets: CallTarget[] = [];
  if (movement.transport || /transport/i.test(item.title)) {
    targets.push({ kind: "transport", name: "Patient transport", role: "Transport bookings" });
  }
  const ed = edById(movement.originEdId);
  if (ed) {
    targets.push({
      kind: "ed",
      name: ed.name,
      role: "ED mental health liaison",
      siteCode: ed.siteCode,
      line: "liaison",
    });
  }
  const ward = movement.acceptedUnitId
    ? units?.find((candidate) => candidate.id === movement.acceptedUnitId)
    : undefined;
  if (ward) targets.push({ kind: "ward", name: ward.name, role: "Nurse in charge", unitId: ward.id });
  return targets;
}

const ROLE_LABELS: Partial<Record<WardFlowRole, string>> = {
  coordinator: "Bed coordinator",
  ward: "Ward",
  ed: "Emergency department",
  community: "Community team",
};

/** A standing fact whose own time has already passed: the legal due time or the bed pull. */
function isOverdue(item: InboxItem) {
  return item.tone === "danger" && /due time passed|expired/i.test(item.title);
}

function rowIcon(item: InboxItem) {
  if (/transport/i.test(item.title)) return item.icon;
  if (/legal/i.test(item.title)) return FileText;
  if (/bed pull/i.test(item.title)) return BedDouble;
  if (/destination/i.test(item.title)) return TriangleAlert;
  return item.icon;
}

/**
 * The value and state shown at the right of a row, read from the movement's own recorded times.
 * Nothing here is a computed deadline: an overdue row counts up from the time the record holds,
 * and a waiting transport counts up from when it was accepted.
 */
function rowTiming(
  item: InboxItem,
  movement: Movement | undefined,
  now: Instant,
): { value?: string; word?: string; state: string; tone: WfTone; stateTone?: WfTone } {
  if (movement && /bed pull/i.test(item.title) && movement.pullExpiresAt !== undefined) {
    return { value: durMinutes(now - movement.pullExpiresAt), state: "Overdue", tone: "danger", stateTone: "danger" };
  }
  if (movement && /legal/i.test(item.title) && movement.legalForm?.dueAt !== undefined) {
    return { value: durMinutes(now - movement.legalForm.dueAt), state: "Overdue", tone: "danger", stateTone: "danger" };
  }
  if (movement && /transport/i.test(item.title) && movement.transport?.acceptedAt !== undefined) {
    return {
      value: durMinutes(now - movement.transport.acceptedAt),
      word: "waiting",
      state: `Accepted ${formatInstantWithDay(movement.transport.acceptedAt, now)}`,
      tone: "warning",
    };
  }
  if (movement && /declined/i.test(item.title)) {
    return {
      value: String(movement.declines.length),
      word: "wards",
      state: "Declined",
      tone: "closed",
    };
  }
  // Ops-8 (remaining-pages audit, 13 Oct 2026): a row that records when it started (a planned
  // arrival not yet recorded) shows how long it has waited, the figure the phone list sorts by.
  if (item.tone !== "danger" && item.since !== undefined && item.since <= now) {
    return { value: durMinutes(now - item.since), word: "waiting", state: "Review", tone: "warning" };
  }
  return item.tone === "danger"
    ? { state: "Act now", tone: "danger", stateTone: "danger" }
    : { state: "Review", tone: "warning" };
}

/**
 * Phone order, as Alerts orders its queue: act now first, then the longest waiting. A row's wait
 * runs from its due time, or from when it started where it records no due time, so the age each
 * row shows is the age it is sorted by. Rows with neither keep their order and go last.
 */
function sortOldestFirst(items: readonly InboxItem[]): InboxItem[] {
  return sortDueFirst(items, (item) => item.dueAt ?? item.since).sort(
    (a, b) => (a.tone === "danger" ? 0 : 1) - (b.tone === "danger" ? 0 : 1),
  );
}

/** The row's one sentence, from the movement's own recorded times where it holds them. */
function rowDetail(
  item: InboxItem,
  movement: Movement | undefined,
  units: readonly Unit[] | undefined,
  now: Instant,
): string {
  if (movement && /bed pull/i.test(item.title) && movement.pullExpiresAt !== undefined) {
    const unit = units?.find((candidate) => candidate.id === movement.acceptedUnitId);
    return `${unit?.name ?? "The pulled bed"} was held until ${formatInstantWithDay(movement.pullExpiresAt, now)} and has lapsed`;
  }
  if (movement && /legal/i.test(item.title) && movement.legalForm?.dueAt !== undefined) {
    return `Form ${movement.legalForm.code} recorded due time ${formatInstantWithDay(movement.legalForm.dueAt, now)} has passed`;
  }
  return item.detail.replace(`${item.movementId} · `, "");
}

export function WardTasksDrawer({
  items: allItems,
  acknowledgements,
  completions,
  ownership,
  snoozes,
  configuration,
  role,
  now,
  dispatch,
  onClose,
  onSelectMovement,
  onSelectDischarge,
  records,
  withBackdrop = false,
}: WardTasksDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);
  // Phone (v10 Tasks sheet): a plain list, act now then oldest. A row opens in place to show its actions.
  const isPhone = useIsPhone();
  // A2-20: the phone row's name follows Discreet names (initials plus UMRN).
  const nameFor = usePatientNameDisplay();
  const sectionId = useId();

  /** A discharge notification row opens its stay on the discharges board; every other row opens
   *  its movement. */
  function openItem(item: InboxItem) {
    if (item.admissionId !== undefined && onSelectDischarge) onSelectDischarge(item.admissionId);
    // A planned admission row has its own destination (Capacity); every other row opens its movement.
    else if (item.href !== undefined) onSelectMovement(item.movementId, undefined, item.href);
    else onSelectMovement(item.movementId);
  }

  const [escalating, setEscalating] = useState<string | null>(null);
  const [contacting, setContacting] = useState<string | null>(null);
  const [contact, setContact] = useState("");
  const toast = useOptionalToast();

  function handleEscape() {
    if (escalating !== null) {
      const trigger = drawerRef.current?.querySelector<HTMLButtonElement>(
        'button[data-escalate][aria-expanded="true"]',
      );
      setEscalating(null);
      setContact("");
      trigger?.focus();
      return;
    }
    if (contacting !== null) {
      const trigger = drawerRef.current?.querySelector<HTMLButtonElement>(
        'button[aria-label="Contact"][aria-expanded="true"]',
      );
      setContacting(null);
      trigger?.focus();
      return;
    }
    onClose();
  }

  useWardModalFocus(withBackdrop, drawerRef, handleEscape);

  /** Calling is not wired: the number is copied and the toast says so. */
  function callNumber(row: CallRow) {
    const number = row.number;
    if (!number) return;
    const failed = () =>
      toast?.push({ tone: "warning", title: "Number not copied", body: `Copy it by hand: ${number}` });
    // Says copied only once the clipboard has taken it.
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      failed();
      return;
    }
    navigator.clipboard
      .writeText(number)
      .then(() => toast?.push({ tone: "info", title: "Number copied", body: "Not wired in this prototype." }), failed);
  }

  function renderCallRow(row: CallRow, onCall: (from: HTMLElement) => void) {
    return (
      <li key={row.key} className={styles.callRow}>
        <span className={styles.callText}>
          <b>{row.name}</b>
          <span>{row.role}</span>
        </span>
        <span className={styles.callNumber}>
          {row.number ? <b className={styles.mono}>{row.number}</b> : <span>No line held</span>}
          {row.hours ? <span>{row.hours}</span> : null}
        </span>
        {row.number ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnIcon}`}
            aria-label={`Call ${row.name}, ${row.number}`}
            onClick={(event) => onCall(event.currentTarget)}
          >
            <PhoneCall aria-hidden="true" />
          </button>
        ) : null}
      </li>
    );
  }
  const [ackFilter, setAckFilter] = useState<AckFilter>("all");
  const [taskFilter, setTaskFilter] = useState<"all" | "critical" | "review">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<DueSortMode>("default");

  function acknowledge(inboxItemId: string) {
    dispatch({ type: "ACKNOWLEDGE_INBOX_ITEM", role, now, inboxItemId });
  }

  function complete(inboxItemId: string) {
    dispatch({ type: "COMPLETE_INBOX_ITEM", role, now, inboxItemId });
  }

  function reopen(inboxItemId: string) {
    dispatch({ type: "REOPEN_INBOX_ITEM", role, now, inboxItemId });
  }

  function takeOwnership(inboxItemId: string) {
    dispatch({ type: "TAKE_INBOX_ITEM_OWNERSHIP", role, now, inboxItemId });
  }

  function returnSnoozed(inboxItemId: string) {
    dispatch({ type: "UNSNOOZE_INBOX_ITEM", role, now, inboxItemId });
  }

  function acknowledgeAllFacts() {
    visibleUnacknowledged.forEach((item) => {
      dispatch({ type: "ACKNOWLEDGE_INBOX_ITEM", role, now, inboxItemId: item.id });
    });
  }

  // Snoozed rows leave the active list and come back by themselves when their time passes.
  const { active: activeItems, snoozed: snoozedItems } = partitionSnoozed(allItems, snoozes, now);
  const items = isPhone
    ? sortOldestFirst(activeItems)
    : sortMode === "due-first"
      ? sortDueFirst(activeItems, (item) => item.dueAt)
      : activeItems;

  const isComplete = (item: InboxItem) =>
    item.kind === "commitment" && inboxItemCompletionState(completions[item.id]) === "complete";
  const facts = items.filter((item) => item.kind === "fact");
  const criticalFactsCount = facts.filter((item) => item.tone === "danger").length;
  const overdueCount = facts.filter(isOverdue).length;
  const openCount = items.filter((item) => !isComplete(item)).length;

  const acknowledgedFactsCount = facts.filter((item) => acknowledgements[item.id]?.length).length;
  const unacknowledged = facts.filter((item) => !acknowledgements[item.id]?.length);
  const filteredItems = items.filter((item) => {
    if (taskFilter === "critical" && item.tone !== "danger") return false;
    if (taskFilter === "review" && item.tone === "danger") return false;
    const acknowledged = Boolean(acknowledgements[item.id]?.length);
    if (ackFilter === "unacknowledged" && (item.kind !== "fact" || acknowledged)) return false;
    if (ackFilter === "acknowledged" && (item.kind !== "fact" || !acknowledged)) return false;
    const completed = isComplete(item);
    if (ackFilter === "completed" && !completed) return false;
    if (ackFilter === "open" && completed) return false;
    return true;
  });
  const filteredFacts = filteredItems.filter((item) => item.kind === "fact");
  const filteredCommitments = filteredItems.filter((item) => item.kind === "commitment");
  // Ops-9 (remaining-pages audit, 13 Oct 2026): act-now rows are never acknowledged in bulk; each
  // one is opened and acknowledged on its own.
  const visibleUnacknowledged = filteredFacts.filter(
    (item) => item.tone !== "danger" && !acknowledgements[item.id]?.length,
  );
  // One row at a time shows its full detail; the first visible row until someone picks another.
  // Phone: nothing is open until a row is tapped, so the sheet reads as a plain list first.
  const expanded = filteredItems.some((item) => item.id === expandedId)
    ? expandedId
    : isPhone
      ? null
      : (filteredItems[0]?.id ?? null);

  function renderMovementActions(item: InboxItem, movement?: Movement) {
    if (!movement || movement.closure || movement.stage === "arrived") return null;
    return (
      <>
        {!movement.acceptedUnitId ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnIcon}`}
            aria-label="Refer"
            title="Refer"
            onClick={() => {
              onSelectMovement(item.movementId, "refer");
            }}
          >
            <Send aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="button"
          className={`${styles.btn} ${styles.btnIcon}`}
          aria-label="Contact"
          title="Contact"
          aria-expanded={contacting === item.id}
          onClick={() => {
            setContacting(contacting === item.id ? null : item.id);
          }}
        >
          <Phone aria-hidden="true" />
        </button>
        {role === "coordinator" ? (
          <button
            type="button"
            className={styles.btn}
            data-escalate
            aria-expanded={escalating === item.id}
            onClick={() => {
              setEscalating(escalating === item.id ? null : item.id);
              setContact(movement.escalation?.contact ?? "");
            }}
          >
            <TriangleAlert aria-hidden="true" />
            Escalate
          </button>
        ) : null}
      </>
    );
  }

  function renderContacts(item: InboxItem, movement?: Movement) {
    if (contacting !== item.id || !movement) return null;
    const rows = callRows(contactTargets(item, movement, records?.units), now);
    return (
      <div className={styles.escalationForm} data-testid={`ward-task-contacts-${item.id}`}>
        <ul className={styles.callList} aria-label="Who to call, mock numbers">
          {rows.map((row) => renderCallRow(row, () => callNumber(row)))}
        </ul>
        <div className={styles.escalationFoot}>
          <span className={styles.escalationNote}>Mock numbers from On-call.</span>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={() => onSelectMovement(item.movementId, "contact")}
          >
            Open patient contacts
          </button>
        </div>
      </div>
    );
  }

  function renderEscalation(item: InboxItem, movement?: Movement) {
    if (escalating !== item.id || !movement) return null;
    const recordEscalation = (who: string) =>
      dispatch({
        type: "RECORD_ESCALATION",
        role,
        now,
        movementId: movement.id,
        triedUnitIds: [...new Set(movement.declines.map((decline) => decline.unitId))],
        contact: who,
      });
    const focusTrigger = (from: HTMLElement) =>
      from.closest("li[data-expanded]")?.querySelector<HTMLButtonElement>("button[data-escalate]")?.focus();
    return (
      <form
        className={styles.escalationForm}
        onSubmit={(event) => {
          event.preventDefault();
          if (!contact.trim()) return;
          recordEscalation(contact.trim());
          focusTrigger(event.currentTarget);
          setEscalating(null);
          setContact("");
        }}
      >
        <label className={styles.escalationLabel}>
          Who did you escalate to?
          <span className={styles.escalationInput}>
            <input
              // eslint-disable-next-line jsx-a11y/no-autofocus -- the field appears only after the user asks to escalate, so focus moves to it
              autoFocus
              required
              maxLength={160}
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="Contact name or service"
            />
            <span className={styles.escalationCount} aria-hidden="true">
              {contact.length}/160
            </span>
          </span>
        </label>
        <div className={styles.escalationPicks} role="group" aria-label="Common contacts">
          {ESCALATION_PICKS.map((pick) => (
            <button
              key={pick}
              type="button"
              className={styles.pick}
              aria-pressed={contact === pick}
              onClick={() => {
                setContact(pick);
              }}
            >
              {pick}
            </button>
          ))}
        </div>
        {/* Ops-6: each pick's number, with Call. Calling only copies the number and fills in that
            contact; nothing is recorded until Record escalation is pressed. */}
        <ul className={styles.callList} aria-label="Escalation contacts, mock numbers">
          {callRows(escalationTargets(movement), now).map((row) =>
            renderCallRow(row, () => {
              callNumber(row);
              setContact(row.name);
            }),
          )}
        </ul>
        <div className={styles.escalationFoot}>
          <span className={styles.escalationNote}>Records only. Sends nothing.</span>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={(event) => {
              focusTrigger(event.currentTarget);
              setEscalating(null);
            }}
          >
            Cancel
          </button>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={!contact.trim()}>
            Record escalation
          </button>
        </div>
      </form>
    );
  }

  function renderRow(item: InboxItem) {
    const movement = records?.movements.find((row) => row.id === item.movementId);
    const admission = item.admissionId ? records?.admissions?.find((row) => row.id === item.admissionId) : undefined;
    // A planned admission row has no movement or stay: the booking itself names the person.
    const patient = records
      ? resolveSubjectPatient(movement ?? admission ?? item.plannedAdmission, records)
      : undefined;
    const Icon = rowIcon(item);
    const isFact = item.kind === "fact";
    const ackHistory = acknowledgements[item.id] ?? [];
    const latestAck = ackHistory.at(-1);
    const completionHistory = completions[item.id];
    const done = isComplete(item);
    const latestCompletion = done && completionHistory ? completionHistory.at(-1) : undefined;
    const timing = done
      ? {
          value: latestCompletion ? formatInstantWithDay(latestCompletion.at, now) : undefined,
          word: undefined,
          state: "Done",
          tone: "success" as WfTone,
          stateTone: undefined,
        }
      : rowTiming(item, movement, now);
    const isExpanded = expanded === item.id;
    const severity: WfTone = item.tone === "danger" ? "danger" : "warning";
    const detail = rowDetail(item, movement, records?.units, now);
    const phoneName = patient
      ? nameFor(patient.displayName, patient.patient ? patient.umrn : null)
      : "Patient not linked";

    return (
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the row click is a pointer shortcut, and focus does the same for the keyboard
      <li
        key={item.id}
        className={styles.row}
        data-tone={item.tone}
        data-expanded={isExpanded}
        data-done={done}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button, input, form, a")) return;
          setExpandedId(isPhone && isExpanded ? null : item.id);
        }}
        // On a desktop, tabbing into a row shows its detail, the same as clicking it.
        onFocus={isPhone ? undefined : () => setExpandedId(item.id)}
      >
        <div className={styles.rowHead}>
          <span className={styles.rowIcon} aria-hidden="true">
            {isPhone ? (
              <StatusGlyph tone={done ? "success" : item.tone === "danger" ? "danger" : "neutral"} size={10} />
            ) : (
              <Icon aria-hidden="true" />
            )}
          </span>
          <div className={styles.rowText}>
            <button
              type="button"
              data-testid={`ward-task-${item.id}`}
              className={styles.rowTitle}
              aria-expanded={isPhone ? isExpanded : undefined}
              onClick={() => {
                // Phone: the title opens the row's actions (Open is one of them).
                if (isPhone) setExpandedId(isExpanded ? null : item.id);
                else openItem(item);
              }}
            >
              {item.title}
            </button>
            {isPhone ? (
              <p className={styles.rowMeta}>
                <span className={styles.rowWho}>
                  {phoneName}
                  {/* Audit A1-15: name plus UMRN, matching the Exceptions sheet. Discreet names
                      already carry the UMRN, so it is not repeated. */}
                  {patient?.patient && phoneName === patient.displayName ? ` · ${patient.umrn}` : ""}
                </span>
                {latestAck && !isExpanded ? (
                  <span className={styles.rowSeen} data-testid={`ward-task-seen-${item.id}`}>
                    <StatusGlyph tone="info" size={8} />
                    Seen
                  </span>
                ) : null}
              </p>
            ) : null}
            <p className={styles.rowMeta} data-phone-hidden={isPhone || undefined}>
              <StatusGlyph tone={severity} size={9} />
              <span>{item.tone === "danger" ? "Critical" : "Review"}</span>
              <span aria-hidden="true">·</span>
              <strong>{patient?.displayName ?? "Patient not linked"}</strong>
              {patient?.patient ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className={styles.mono}>{patient.umrn}</span>
                </>
              ) : null}
            </p>
          </div>
          {isPhone ? (
            <span className={styles.rowDue} data-tone={timing.stateTone}>
              {timing.value !== undefined && timing.word === "wards"
                ? `${timing.value} declined`
                : (timing.value ?? (item.tone === "danger" && !done ? "Now" : timing.state))}
            </span>
          ) : null}
          <div className={styles.rowWhen} data-phone-hidden={isPhone || undefined}>
            {timing.value ? (
              <span className={styles.rowValue}>
                {timing.tone !== "neutral" ? <StatusGlyph tone={timing.tone} size={9} /> : null}
                {timing.value}
                {timing.word ? <span className={styles.rowWord}>{timing.word}</span> : null}
              </span>
            ) : null}
            <span className={styles.rowState} data-tone={timing.stateTone}>
              {timing.state}
            </span>
          </div>
        </div>

        {isExpanded ? (
          <div className={styles.rowDetail}>
            <p className={styles.detailLine}>{detail}</p>
            {movement ? (
              <p className={styles.detailMeta}>
                <Clock aria-hidden="true" />
                <span>{stageCopy[movement.stage].label}</span>
                <span aria-hidden="true">·</span>
                <span>{edById(movement.originEdId)?.name ?? "Origin not recorded"}</span>
                {movement.escalation ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Escalated to {movement.escalation.contact}</span>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}

        {isPhone && !isExpanded ? null : (
          <>
            {latestAck ? (
              <p className={styles.ackStatus} data-testid={`ward-task-ack-${item.id}`}>
                <StatusGlyph tone="info" size={8} />
                Acknowledged by {latestAck.by} at {formatInstantWithDay(latestAck.at, now)}
                {ackHistory.length > 1 ? ` · ${ackHistory.length} times` : ""}, still open
              </p>
            ) : null}
            <InboxRowStatus
              className={styles.ackStatus}
              ownership={ownership?.[item.id]}
              since={item.since}
              target={movement && configuration ? decisionTargetReading(movement, now, configuration) : undefined}
              now={now}
            />
            {latestCompletion ? (
              <p className={styles.ackStatus} data-testid={`ward-task-done-${item.id}`}>
                <StatusGlyph tone="success" size={9} />
                Done by {latestCompletion.by} · {formatInstantWithDay(latestCompletion.at, now)}
              </p>
            ) : null}

            <div className={styles.rowActions}>
              {isFact ? (
                <button
                  type="button"
                  className={`${styles.btn} ${isExpanded && !latestAck && escalating !== item.id ? styles.btnPrimary : ""}`}
                  onClick={() => {
                    acknowledge(item.id);
                  }}
                >
                  <UserCheck aria-hidden="true" />
                  Acknowledge
                </button>
              ) : done ? (
                /* One control, not two: the reducer refuses COMPLETE on a row that is already complete and
               REOPEN on one that is not, so rendering both would always leave one of them dead. */
                <button
                  type="button"
                  data-testid={`ward-task-reopen-${item.id}`}
                  className={styles.btn}
                  onClick={() => {
                    reopen(item.id);
                  }}
                >
                  <RotateCcw aria-hidden="true" />
                  Reopen
                </button>
              ) : (
                <button
                  type="button"
                  data-testid={`ward-task-complete-${item.id}`}
                  className={`${styles.btn} ${isExpanded ? styles.btnPrimary : ""}`}
                  onClick={() => {
                    complete(item.id);
                  }}
                >
                  <CheckCircle2 aria-hidden="true" />
                  Mark done
                </button>
              )}
              <button
                type="button"
                className={`${styles.btn} ${isExpanded && isFact && latestAck && escalating !== item.id ? styles.btnPrimary : ""}`}
                aria-label={item.plannedAdmission ? "Open planned admission in Capacity" : "Open patient"}
                onClick={() => {
                  openItem(item);
                }}
              >
                <ArrowUpRight aria-hidden="true" />
                Open
              </button>
              {role === "coordinator" &&
              currentInboxOwner(ownership?.[item.id], item.since)?.by !== WARD_FLOW_ROLE_LABELS[role] ? (
                <button
                  type="button"
                  data-testid={`ward-task-own-${item.id}`}
                  className={styles.btn}
                  onClick={() => {
                    takeOwnership(item.id);
                  }}
                >
                  <UserRound aria-hidden="true" />
                  Take
                </button>
              ) : null}
              {role === "coordinator" && !done ? (
                <InboxSnoozeControl
                  subject={`${item.title}, ${patient?.displayName ?? "patient not linked"}`}
                  actNow={inboxItemIsActNow(item.id)}
                  now={now}
                  onSnooze={(until, reason) => {
                    dispatch({ type: "SNOOZE_INBOX_ITEM", role, now, inboxItemId: item.id, until, reason });
                  }}
                />
              ) : null}
              {renderMovementActions(item, movement)}
            </div>
          </>
        )}
        {!isPhone || isExpanded ? renderContacts(item, movement) : null}
        {renderEscalation(item, movement)}
      </li>
    );
  }

  return (
    <>
      {withBackdrop ? (
        <div
          className={styles.drawerBackdrop}
          onClick={onClose}
          aria-hidden="true"
          data-testid="ward-tasks-drawer-backdrop"
        />
      ) : null}
      <aside
        ref={drawerRef}
        className={styles.drawer}
        role={withBackdrop ? "dialog" : "complementary"}
        aria-modal={withBackdrop ? "true" : undefined}
        aria-label="Tasks"
        onKeyDown={(event) => {
          if (!withBackdrop && event.key === "Escape") {
            event.stopPropagation();
            handleEscape();
          }
        }}
      >
        <div className={styles.header}>
          <span className={styles.headerIcon} aria-hidden="true">
            <ListChecks aria-hidden="true" />
          </span>
          <div className={styles.headerText}>
            <h2 className={styles.heading}>Tasks</h2>
            <p className={styles.headerNote}>
              {isPhone
                ? `${openCount} open · act now, then oldest`
                : `${ROLE_LABELS[role] ?? "Tasks"} · synthetic movements`}
            </p>
          </div>
          <span className={styles.headingCount} data-testid="ward-tasks-drawer-count">
            <span className={styles.mono}>{openCount}</span> open
          </span>
          <kbd className={styles.kbd} aria-hidden="true">
            Esc
          </kbd>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close tasks panel"
            title="Close tasks panel"
            data-sheet-autofocus="true"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className={styles.controls}>
          {/* Ops-22 (13 Oct 2026): on desktop the counts sit in the header and the All filter only;
              the stats row repeated them. Phone keeps its one quiet line. */}
          {isPhone ? (
            <div className={styles.summary}>
              <div className={styles.stat}>
                <strong>{overdueCount}</strong>
                <span>
                  {overdueCount > 0 ? <StatusGlyph tone="danger" size={9} /> : null}
                  Overdue
                </span>
              </div>
              <div className={styles.stat}>
                <strong>{criticalFactsCount}</strong>
                <span>Critical facts</span>
              </div>
              <div className={styles.stat}>
                <strong>{unacknowledged.length}</strong>
                <span>To acknowledge</span>
              </div>
              <div className={styles.stat}>
                <strong>{acknowledgedFactsCount}</strong>
                <span>Acknowledged</span>
              </div>
            </div>
          ) : null}

          <div className={styles.filterBar}>
            <div className={styles.segmented} role="group" aria-label="Filter tasks by status">
              {(
                [
                  ["all", "All", items.length],
                  ["critical", "Critical", items.filter((item) => item.tone === "danger").length],
                  ["review", "Review", items.filter((item) => item.tone !== "danger").length],
                ] as const
              ).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  className={styles.segment}
                  aria-pressed={taskFilter === value}
                  onClick={() => {
                    setTaskFilter(value);
                  }}
                >
                  {label} <span className={styles.count}>{count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterMeta}>
            <span role="status" className={styles.filterStatus}>
              <strong className={styles.mono}>{filteredItems.length}</strong> of {items.length}{" "}
              <span className="sr-only">invented </span>tasks
            </span>
            <label className={styles.selectWrap}>
              <Filter aria-hidden="true" />
              <select
                aria-label="Filter task state"
                value={ackFilter}
                onChange={(event) => setAckFilter(event.target.value as AckFilter)}
              >
                {(Object.keys(ACK_FILTER_LABELS) as AckFilter[]).map((value) => (
                  <option key={value} value={value}>
                    {ACK_FILTER_LABELS[value]}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" />
            </label>
            <label className={styles.selectWrap}>
              <select
                aria-label="Sort tasks"
                data-testid="ward-tasks-sort"
                value={sortMode}
                onChange={(event) => {
                  setSortMode(event.target.value as DueSortMode);
                }}
              >
                {DUE_SORT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" />
            </label>
          </div>
        </div>

        <div className={styles.drawerBody}>
          {items.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <ListChecks aria-hidden="true" />
              </span>
              <h3>
                {role !== "coordinator"
                  ? "Bed coordinator's list"
                  : snoozedItems.length > 0
                    ? "Nothing active"
                    : "No outstanding work"}
              </h3>
              <p>{role === "coordinator" ? "New tasks appear here" : "Tasks is the bed coordinator's list."}</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <Search aria-hidden="true" />
              </span>
              <h3>{ackFilter === "completed" ? "No completed tasks" : "No matching tasks"}</h3>
              <p>
                {ackFilter === "completed"
                  ? "Facts stay open until they stop being true"
                  : ackFilter === "acknowledged"
                    ? "Nothing acknowledged yet this shift"
                    : ackFilter === "unacknowledged"
                      ? "Every visible task is acknowledged"
                      : "Clear the filters to see every task"}
              </p>
              <button
                type="button"
                className={styles.btn}
                onClick={() => {
                  setTaskFilter("all");
                  setAckFilter("all");
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              {filteredFacts.length > 0 ? (
                <section className={styles.section} aria-labelledby={`${sectionId}-facts`}>
                  <div className={styles.sectionHead} data-phone-quiet={isPhone || undefined}>
                    <ShieldCheck aria-hidden="true" />
                    <h3 id={`${sectionId}-facts`} className={styles.sectionTitle}>
                      Needs attention
                    </h3>
                    <span className={styles.count}>{filteredFacts.length}</span>
                    <span className={styles.sectionNote}>Leaves when no longer true</span>
                  </div>
                  <ul className={styles.list}>{filteredFacts.map(renderRow)}</ul>
                </section>
              ) : null}

              {filteredCommitments.length > 0 ? (
                <section className={styles.section} aria-labelledby={`${sectionId}-commitments`}>
                  <div className={styles.sectionHead} data-phone-quiet={isPhone || undefined}>
                    <ListChecks aria-hidden="true" />
                    <h3 id={`${sectionId}-commitments`} className={styles.sectionTitle}>
                      Commitments
                    </h3>
                    <span className={styles.count}>{filteredCommitments.length}</span>
                    <span className={styles.sectionNote}>Leaves when marked done</span>
                  </div>
                  <ul className={styles.list}>{filteredCommitments.map(renderRow)}</ul>
                </section>
              ) : null}
            </>
          )}
          {snoozedItems.length > 0 ? (
            <section
              className={styles.section}
              aria-labelledby={`${sectionId}-snoozed`}
              data-testid="ward-tasks-snoozed"
            >
              <div className={styles.sectionHead}>
                <AlarmClock aria-hidden="true" />
                <h3 id={`${sectionId}-snoozed`} className={styles.sectionTitle}>
                  Snoozed
                </h3>
                <span className={styles.count}>{snoozedItems.length}</span>
                <span className={styles.sectionNote}>Back when due</span>
              </div>
              <ul className={styles.list}>
                {snoozedItems.map((item) => {
                  const entry = activeSnooze(snoozes?.[item.id], now, item.since);
                  const movement = records?.movements.find((row) => row.id === item.movementId);
                  const patient = records ? resolveSubjectPatient(movement, records) : undefined;
                  return (
                    <li
                      key={item.id}
                      className={styles.row}
                      data-tone={item.tone}
                      data-testid={`ward-task-snoozed-${item.id}`}
                    >
                      <div className={styles.rowHead}>
                        <span className={styles.rowIcon} aria-hidden="true">
                          <AlarmClock aria-hidden="true" />
                        </span>
                        <div className={styles.rowText}>
                          <span className={styles.rowTitle}>{item.title}</span>
                          <p className={styles.rowMeta}>
                            <strong>{patient?.displayName ?? "Patient not linked"}</strong>
                            {patient?.patient ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className={styles.mono}>{patient.umrn}</span>
                              </>
                            ) : null}
                          </p>
                          {entry ? <p className={styles.rowMeta}>{snoozedLine(entry, now)}</p> : null}
                        </div>
                        <button
                          type="button"
                          className={styles.btn}
                          aria-label="Open patient"
                          data-testid={`ward-task-snoozed-open-${item.id}`}
                          onClick={() => {
                            // The same routing as an active row: a discharge row opens its stay.
                            openItem(item);
                          }}
                        >
                          <ArrowUpRight aria-hidden="true" />
                          Open
                        </button>
                        {role === "coordinator" ? (
                          <button
                            type="button"
                            className={styles.btn}
                            data-testid={`ward-task-unsnooze-${item.id}`}
                            aria-label={`Return ${item.title} now, ${patient?.displayName ?? "patient not linked"}`}
                            onClick={() => {
                              returnSnoozed(item.id);
                            }}
                          >
                            Return now
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>

        <nav
          aria-label="Network exception boards"
          data-testid="ward-tasks-quick-jumps"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
            padding: "8px 14px",
            borderTop: "1px solid var(--wf-line)",
            background: "var(--wf-surface-2)",
            fontSize: "0.75rem",
          }}
        >
          <Link
            href={WARD_VIEWS.find((view) => view.id === "delays")?.href ?? "/mockups/ward-flow/delays"}
            onClick={onClose}
            data-testid="ward-tasks-jump-delays"
            style={{ color: "var(--wf-ink-1)", textDecoration: "none", fontWeight: 600 }}
          >
            Delays board →
          </Link>
          <span aria-hidden="true" style={{ color: "var(--wf-ink-3)" }}>
            ·
          </span>
          <Link
            href={WARD_NAV.find((item) => item.id === "alerts")?.href ?? "/mockups/ward-flow/alerts"}
            onClick={onClose}
            data-testid="ward-tasks-jump-alerts"
            style={{ color: "var(--wf-ink-1)", textDecoration: "none", fontWeight: 600 }}
          >
            Alerts &amp; watches →
          </Link>
          <span aria-hidden="true" style={{ color: "var(--wf-ink-3)" }}>
            ·
          </span>
          <Link
            href={WARD_HOME_HREF}
            onClick={onClose}
            data-testid="ward-tasks-jump-coordinator"
            style={{ color: "var(--wf-ink-1)", textDecoration: "none", fontWeight: 600 }}
          >
            Coordinator workspace →
          </Link>
        </nav>

        <div className={styles.drawerFoot}>
          <span id="taskDrawerSummary">Seen is not resolved</span>
          {visibleUnacknowledged.length > 0 ? (
            <button type="button" className={styles.btn} onClick={acknowledgeAllFacts}>
              <UserCheck aria-hidden="true" />
              Acknowledge visible
              <span className={styles.count}>{visibleUnacknowledged.length}</span>
            </button>
          ) : null}
        </div>
      </aside>
    </>
  );
}
