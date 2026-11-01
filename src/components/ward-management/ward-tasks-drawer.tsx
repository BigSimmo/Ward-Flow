"use client";

import {
  AlarmClock,
  ArrowUpRight,
  BedDouble,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Filter,
  ListChecks,
  Phone,
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
import { useCallback, useEffect, useId, useRef, useState, type Dispatch, type MouseEvent, type RefObject } from "react";
import { WARD_ALERTS_HREF, WARD_HOME_HREF, WARD_NAV, WARD_VIEWS } from "@/components/ward-management/ward-nav";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import {
  StatusGlyph,
  buttonClass,
  durMinutes,
  hasConfirmHost,
  requestConfirm,
  useIsPhone,
  type WfTone,
} from "@/components/wf";
import { typedClock } from "@/components/ward-management/legal-forms/legal-time-as-typed";
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
import { alertActionFor, alertGroupOf, resolveAlertSubject } from "./alerts/alerts-model";
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
import { useDirtyStateGuard } from "./use-dirty-state-guard";
import { AcknowledgeVisibleButton } from "./tasks-acknowledge-visible";

import styles from "./ward-tasks-drawer.module.css";
import { AlertKindGroupRow, groupByTitle } from "./ward-tasks-drawer-group";
import { originName, originSiteCode } from "@/components/ward-management/ward-movement-origin";

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
  /** The shell consults this drawer's own draft decision before closing its outer Sheet. */
  dismissalGuardRef?: RefObject<((retry?: () => void) => boolean) | null>;
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
  /** False when this desk's role may not open the Alerts screen: no link to it is offered. */
  alertsScreenOpen?: boolean;
  /** One Alerts queue: false for a desk that is not the bed coordinator (its task list is empty), so
   *  the drawer keeps its Tasks words and "Bed coordinator's list" empty state. */
  alertsQueueForDesk?: boolean;
};

type AckFilter = "all" | "open" | "unacknowledged" | "acknowledged" | "completed";

/**
 * The drawer's words. For the bed coordinator's desk, Tasks and Alerts are one queue (Josh, D-61,
 * 16 Oct 2026), so the drawer uses the Alerts screen's name and groups. Red rows are act now and
 * every other row is waiting, the same split `inboxItemIsActNow` makes for the Alerts screen.
 */
type DrawerWords = { name: string; plural: string; act: string; wait: string; running?: string };
// The drawer is called Alerts on every desk, as its button is (Josh, 31 Oct 2026). Desks without the
// one Alerts queue keep their own filters and row behaviour, which follow these words by identity.
const TASKS_WORDS: DrawerWords = { name: "Alerts", plural: "alerts", act: "Critical", wait: "Review" };
const ALERTS_WORDS: DrawerWords = {
  name: "Alerts",
  plural: "alerts",
  act: "Act now",
  wait: "Waiting",
  running: "Running",
};

function ackFilterLabels(words: DrawerWords): Record<AckFilter, string> {
  const singular = words.plural.slice(0, -1);
  return {
    all: `All ${singular} states`,
    open: `Open ${words.plural}`,
    unacknowledged: "Not yet acknowledged",
    acknowledged: "Acknowledged",
    completed: "Completed",
  };
}

/** Quick picks only fill the box; the person still records the escalation themselves. */
const ESCALATION_PICKS = ["Duty consultant", "State bed desk", "Executive on call"] as const;
const DISCARD_ESCALATION = "You have an unsaved escalation contact. Discard it?";
// These links dismiss the drawer as well as navigating, including a link to the current page.
const isTasksDrawerLink = (anchor: HTMLAnchorElement) => anchor.closest("[data-ward-tasks-drawer]") !== null;

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
      siteCode: originSiteCode(movement),
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
  // D-80: the task rows the bed manager owns are its own.
  bed_manager: "Bed manager",
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
 * Nothing here is a computed deadline: a bed pull past its limit counts up from the time the
 * record holds, a passed legal form shows only its typed time, and a waiting transport counts up
 * from when it was accepted.
 */
function rowTiming(
  item: InboxItem,
  movement: Movement | undefined,
  now: Instant,
  waitWord: string,
): { value?: string; word?: string; state: string; tone: WfTone; stateTone?: WfTone } {
  if (movement && /bed pull/i.test(item.title) && movement.pullExpiresAt !== undefined) {
    // pop-alerts (Josh, 31 Oct 2026): "Past pull limit", because "overdue" means form times.
    return {
      value: durMinutes(now - movement.pullExpiresAt),
      state: "Past pull limit",
      tone: "danger",
      stateTone: "danger",
    };
  }
  if (movement && /legal/i.test(item.title) && movement.legalForm?.dueAt !== undefined) {
    // Legal times only as typed (31 Oct 2026): the typed clock time, never a count past it.
    return {
      value: typedClock(movement.legalForm.dueAt, now),
      state: "Ended, as typed",
      tone: "danger",
      stateTone: "danger",
    };
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
      // pop-alerts: the row's title already says "declined", so the right side keeps the figure only.
      state: "",
      tone: "closed",
    };
  }
  // Ops-8 (remaining-pages audit, 13 Oct 2026): a row that records when it started (a planned
  // arrival not yet recorded) shows how long it has waited, the figure the phone list sorts by.
  if (item.tone !== "danger" && item.since !== undefined && item.since <= now) {
    // pop-alerts: the figure already says "waiting"; the row's meta line names its group.
    return { value: durMinutes(now - item.since), word: "waiting", state: "", tone: "warning" };
  }
  return item.tone === "danger"
    ? { state: "Act now", tone: "danger", stateTone: "danger" }
    : { state: waitWord, tone: "warning" };
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
    return `${unit?.name ?? "The pulled bed"}: the pull time limit passed at ${formatInstantWithDay(movement.pullExpiresAt, now)}`;
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
  dismissalGuardRef,
  onSelectMovement,
  onSelectDischarge,
  records,
  withBackdrop = false,
  alertsScreenOpen = true,
  alertsQueueForDesk = true,
}: WardTasksDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);
  const words = alertsScreenOpen && alertsQueueForDesk ? ALERTS_WORDS : TASKS_WORDS;
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
  const escalatingItem = allItems.find((item) => item.id === escalating);
  const savedContact =
    records?.movements.find((movement) => movement.id === escalatingItem?.movementId)?.escalation?.contact ?? "";
  const hasUnsavedEscalation = escalating !== null && contact !== savedContact;
  const dirtyEscalationRef = useRef(hasUnsavedEscalation);
  useEffect(() => {
    dirtyEscalationRef.current = hasUnsavedEscalation;
  }, [hasUnsavedEscalation]);
  const { approveNextHistoryNavigation } = useDirtyStateGuard({
    isDirty: hasUnsavedEscalation,
    value: JSON.stringify([escalating, contact]),
    confirmMessage: DISCARD_ESCALATION,
    skipAnchor: isTasksDrawerLink,
  });

  /**
   * True when there is no unsaved escalation (or the person lets it go). With `retry` and the kit's
   * styled confirm mounted, an unsaved escalation returns false at once, the question is asked in the
   * styled dialog, and on Discard the draft is cleared and `retry` runs the step again. Without
   * `retry` the browser's confirm box asks, as before.
   */
  const discardEscalation = useCallback((retry?: () => void) => {
    const clear = () => {
      // The shell can recheck within this event, before React commits the cleared draft below.
      dirtyEscalationRef.current = false;
      setEscalating(null);
      setContact("");
    };
    if (dirtyEscalationRef.current && retry && hasConfirmHost()) {
      void requestConfirm({
        title: "Discard the escalation contact?",
        message: DISCARD_ESCALATION,
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
      }).then((confirmed) => {
        if (!confirmed) return;
        clear();
        retry();
      });
      return false;
    }
    if (dirtyEscalationRef.current && !window.confirm(DISCARD_ESCALATION)) return false;
    clear();
    return true;
  }, []);

  const confirmDrawerDismissal = useCallback(
    (retry?: () => void) => {
      if (!discardEscalation(retry)) return false;
      approveNextHistoryNavigation();
      return true;
    },
    [discardEscalation, approveNextHistoryNavigation],
  );

  useEffect(() => {
    if (!dismissalGuardRef) return;
    dismissalGuardRef.current = confirmDrawerDismissal;
    return () => {
      if (dismissalGuardRef.current === confirmDrawerDismissal) dismissalGuardRef.current = null;
    };
  }, [dismissalGuardRef, confirmDrawerDismissal]);

  function closeDrawer(): boolean {
    if (!confirmDrawerDismissal(closeDrawer)) return false;
    // The shell may close through browser Back. The local decision owns this one traversal.
    onClose();
    return true;
  }

  function closeFromLink(event: MouseEvent<HTMLAnchorElement>) {
    const link = event.currentTarget;
    // On Discard the same link is pressed again, now with nothing unsaved.
    if (!confirmDrawerDismissal(() => link.click())) {
      event.preventDefault();
      return;
    }
    onClose();
  }

  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!withBackdrop && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
      openerRef.current = document.activeElement;
    }
  }, [withBackdrop]);

  function handleEscape(target: EventTarget | null = document.activeElement) {
    const inContacts = target instanceof Element && target.closest("[data-ward-task-contacts]") !== null;
    if (contacting !== null && (escalating === null || inContacts)) {
      const trigger = drawerRef.current?.querySelector<HTMLButtonElement>(
        `button[data-contact="${CSS.escape(contacting)}"]`,
      );
      setContacting(null);
      trigger?.focus();
      return;
    }
    if (escalating !== null) {
      const trigger = drawerRef.current?.querySelector<HTMLButtonElement>(
        'button[data-escalate][aria-expanded="true"]',
      );
      if (discardEscalation(() => trigger?.focus())) trigger?.focus();
      return;
    }
    const opener = !withBackdrop
      ? (openerRef.current ??
        document.querySelector<HTMLElement>(
          '[data-testid="ward-tasks-opener"], button[aria-controls*="tasks"], button[aria-label*="Tasks"]',
        ))
      : null;
    if (!closeDrawer()) return;
    if (opener && opener.isConnected) opener.focus();
  }

  useWardModalFocus(withBackdrop, drawerRef, handleEscape);

  // The inline panel has no modal focus handling, so Escape pressed inside it is caught here. A
  // native listener, because the panel is a non-interactive landmark and takes no JSX key handler.
  const handleEscapeRef = useRef(handleEscape);
  useEffect(() => {
    handleEscapeRef.current = handleEscape;
  });
  useEffect(() => {
    const drawer = drawerRef.current;
    if (withBackdrop || !drawer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Let nested popovers/dialogs (such as the Snooze popover) handle Escape first:
      const nestedDialog = event.target instanceof Element ? event.target.closest('[role="dialog"]') : null;
      if (nestedDialog && drawer.contains(nestedDialog)) return;
      event.stopPropagation();
      handleEscapeRef.current(event.target);
    };
    drawer.addEventListener("keydown", onKeyDown);
    return () => drawer.removeEventListener("keydown", onKeyDown);
  }, [withBackdrop]);

  function renderCallRow(row: CallRow) {
    return (
      <li key={row.key} className={styles.callRow}>
        <span className={styles.callText}>
          <b>{row.name}</b>
          <span>{row.role}</span>
        </span>
        <span className={styles.callNumber}>
          {row.number ? <b className={styles.mono}>{row.number}</b> : <span>No line recorded</span>}
          {row.hours ? <span>{row.hours}</span> : null}
        </span>
      </li>
    );
  }
  const [ackFilter, setAckFilter] = useState<AckFilter>("all");
  type TaskFilter = "all" | "critical" | "review" | "running";
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
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

  function acknowledgeAllFacts(ids: readonly string[]) {
    ids.forEach((inboxItemId) => dispatch({ type: "ACKNOWLEDGE_INBOX_ITEM", role, now, inboxItemId }));
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
  const alertsQueue = words === ALERTS_WORDS;
  // Change 7: the desktop Alerts drawer gives each row one action. Phone has its own Alerts screen.
  const oneAction = alertsQueue && !isPhone;
  const filteredItems = items.filter((item) => {
    const group = alertsQueue ? alertGroupOf(item) : item.tone === "danger" ? "act" : "wait";
    if (taskFilter === "critical" && group !== "act") return false;
    if (taskFilter === "review" && group !== "wait") return false;
    if (taskFilter === "running" && group !== "running") return false;
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

  // pop-alerts (Josh, 31 Oct 2026): the drawer's one filled button belongs to its most urgent row,
  // the first one shown.
  const urgentId = (filteredFacts[0] ?? filteredCommitments[0])?.id;

  /** pop-alerts: alerts of the same kind share one row ("Transport awaiting departure"), one line per person. */
  function renderRows(rows: readonly InboxItem[]) {
    if (!oneAction) return rows.map(renderRow);
    return groupByTitle(rows).map((group) => {
      const first = group.items[0]!;
      if (group.items.length === 1) return renderRow(first);
      const groupWord =
        alertGroupOf(first) === "running"
          ? (words.running ?? words.wait)
          : first.tone === "danger"
            ? words.act
            : words.wait;
      return (
        <AlertKindGroupRow
          key={group.key}
          group={group}
          icon={rowIcon(first)}
          groupWord={groupWord}
          listId={`${sectionId}-${group.key}`}
          renderMember={renderGroupMember}
        />
      );
    });
  }

  function renderGroupMember(item: InboxItem) {
    const movement = records?.movements.find((row) => row.id === item.movementId);
    const admission = item.admissionId ? records?.admissions?.find((row) => row.id === item.admissionId) : undefined;
    const patient = records
      ? resolveSubjectPatient(movement ?? admission ?? item.plannedAdmission, records)
      : undefined;
    const timing = isComplete(item)
      ? { value: undefined, word: undefined, state: "Done", tone: "success" as WfTone, stateTone: undefined }
      : rowTiming(item, movement, now, words.wait);
    const name = patient?.formalName ?? "Patient not linked";
    // A grouped alert keeps its own acknowledgement line, worded as a single row's, so staff can
    // still tell seen from unseen after "Acknowledge visible".
    const ackHistory = acknowledgements[item.id] ?? [];
    const latestAck = ackHistory.at(-1);
    return (
      <li key={item.id} className={styles.groupMember} data-testid={`ward-task-member-${item.id}`}>
        <span className={styles.memberText}>
          <span className={styles.memberWho}>
            <strong>{name}</strong>
            {patient?.patient ? <span className={styles.mono}>{patient.umrn}</span> : null}
          </span>
          <span className={styles.memberWhen}>
            {timing.value ? (
              <span className={styles.rowValue}>
                {timing.tone !== "neutral" ? <StatusGlyph tone={timing.tone} size={9} /> : null}
                {timing.value}
                {timing.word ? <span className={styles.rowWord}>{timing.word}</span> : null}
              </span>
            ) : null}
            {/* The dot only joins two parts, so a line with no figure never starts with one. */}
            {timing.value && timing.state ? <span aria-hidden="true">·</span> : null}
            {timing.state ? (
              <span className={styles.rowState} data-tone={timing.stateTone}>
                {timing.state}
              </span>
            ) : null}
          </span>
          {latestAck ? (
            <span className={`${styles.ackStatus} ${styles.memberAck}`} data-testid={`ward-task-ack-${item.id}`}>
              <StatusGlyph tone="info" size={8} />
              Acknowledged by {latestAck.by} at {formatInstantWithDay(latestAck.at, now)}
              {ackHistory.length > 1 ? ` · ${ackHistory.length} times` : ""}, still open
            </span>
          ) : null}
        </span>
        <span className={styles.memberActions}>
          {renderOneAction(item, movement)}
          <button
            type="button"
            className={styles.btn}
            data-testid={`ward-task-${item.id}`}
            aria-label={item.plannedAdmission ? "Open planned admission in Capacity" : "Open patient"}
            onClick={() => {
              openItem(item);
            }}
          >
            <ArrowUpRight aria-hidden="true" />
            Open
          </button>
        </span>
      </li>
    );
  }

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
          data-contact={item.id}
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
            onClick={(event) => {
              const button = event.currentTarget;
              if (!discardEscalation(() => button.click())) return;
              if (escalating === item.id) {
                event.currentTarget.focus();
                return;
              }
              setEscalating(item.id);
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
      <div className={styles.escalationForm} data-ward-task-contacts data-testid={`ward-task-contacts-${item.id}`}>
        <ul className={styles.callList} aria-label="Who to call, mock numbers">
          {rows.map((row) => renderCallRow(row))}
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
        {/* Ops-6: each pick's number. Nothing is recorded until Record escalation is pressed. */}
        <ul className={styles.callList} aria-label="Escalation contacts, mock numbers">
          {callRows(escalationTargets(movement), now).map((row) => renderCallRow(row))}
        </ul>
        <div className={styles.escalationFoot}>
          <span className={styles.escalationNote}>Records only. Sends nothing.</span>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={(event) => {
              const button = event.currentTarget;
              if (!discardEscalation(() => focusTrigger(button))) return;
              focusTrigger(button);
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

  /**
   * Change 7 (D-77, 21 Oct 2026): on the bed coordinator's desktop the Alerts drawer is a short
   * preview. Each row offers the one action that clears it, the same one the Alerts screen's row
   * offers (`alertActionFor`), beside Open. Acknowledge, Take, Snooze, calls and Escalate stay on
   * the Alerts screen. A bed release needs its reason, so Release bed opens that alert there.
   */
  function renderOneAction(item: InboxItem, movement: Movement | undefined) {
    const admission = item.admissionId ? records?.admissions?.find((row) => row.id === item.admissionId) : undefined;
    const subject = resolveAlertSubject(
      movement,
      item.movementId,
      records ?? {},
      records?.units ?? [],
      item.plannedAdmission ? { planned: item.plannedAdmission, personLabel: item.personLabel } : undefined,
      admission,
      item.personId,
    );
    const action = alertActionFor(item, subject);
    return (
      <Link
        href={
          action.kind === "release" ? `${WARD_ALERTS_HREF}?alert=${encodeURIComponent(item.id)}&release=1` : action.href
        }
        onClick={closeFromLink}
        data-testid={`ward-task-action-${item.id}`}
        className={`${styles.btn} ${item.id === urgentId ? styles.btnPrimary : ""}`}
      >
        {action.label}
      </Link>
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
      : rowTiming(item, movement, now, words.wait);
    const isExpanded = expanded === item.id;
    const severity: WfTone = item.tone === "danger" ? "danger" : "warning";
    const detail = rowDetail(item, movement, records?.units, now);
    const phoneName = patient
      ? nameFor(patient.formalName, patient.patient ? patient.umrn : null)
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
                  {patient?.patient && phoneName === patient.formalName ? ` · ${patient.umrn}` : ""}
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
              <span>
                {alertsQueue && alertGroupOf(item) === "running"
                  ? words.running
                  : item.tone === "danger"
                    ? words.act
                    : words.wait}
              </span>
              <span aria-hidden="true">·</span>
              <strong>{patient?.formalName ?? "Patient not linked"}</strong>
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
            {timing.state ? (
              <span className={styles.rowState} data-tone={timing.stateTone}>
                {timing.state}
              </span>
            ) : null}
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
                <span>{originName(movement) ?? "Origin not recorded"}</span>
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
              {oneAction ? (
                renderOneAction(item, movement)
              ) : isFact ? (
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
                className={`${styles.btn} ${!oneAction && isExpanded && isFact && latestAck && escalating !== item.id ? styles.btnPrimary : ""}`}
                aria-label={item.plannedAdmission ? "Open planned admission in Capacity" : "Open patient"}
                onClick={() => {
                  openItem(item);
                }}
              >
                <ArrowUpRight aria-hidden="true" />
                Open
              </button>
              {!oneAction &&
              role === "coordinator" &&
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
              {!oneAction && role === "coordinator" && !done ? (
                <InboxSnoozeControl
                  subject={`${item.title}, ${patient?.formalName ?? "patient not linked"}`}
                  actNow={inboxItemIsActNow(item.id)}
                  now={now}
                  onSnooze={(until, reason) => {
                    const snooze = () =>
                      dispatch({ type: "SNOOZE_INBOX_ITEM", role, now, inboxItemId: item.id, until, reason });
                    if (escalating === item.id && !discardEscalation(snooze)) return;
                    snooze();
                  }}
                />
              ) : null}
              {oneAction ? null : renderMovementActions(item, movement)}
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
          onClick={closeDrawer}
          aria-hidden="true"
          data-testid="ward-tasks-drawer-backdrop"
        />
      ) : null}
      <aside
        ref={drawerRef}
        className={styles.drawer}
        role={withBackdrop ? "dialog" : "complementary"}
        aria-modal={withBackdrop ? "true" : undefined}
        aria-label={words.name}
        data-ward-tasks-drawer
      >
        <div className={styles.header}>
          <span className={styles.headerIcon} aria-hidden="true">
            <Bell aria-hidden="true" />
          </span>
          <div className={styles.headerText}>
            <h2 className={styles.heading}>{words.name}</h2>
            <p className={styles.headerNote}>
              {isPhone
                ? `${openCount} open · act now, then oldest`
                : `${ROLE_LABELS[role] ?? words.name} · synthetic movements`}
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
            onClick={closeDrawer}
            aria-label={`Close ${words.plural} panel`}
            title={`Close ${words.plural} panel`}
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
            <div className={styles.segmented} role="group" aria-label={`Filter ${words.plural} by status`}>
              {(
                (alertsQueue
                  ? [
                      ["all", "All", items.length],
                      ["critical", words.act, items.filter((item) => alertGroupOf(item) === "act").length],
                      ["review", words.wait, items.filter((item) => alertGroupOf(item) === "wait").length],
                      [
                        "running",
                        words.running ?? "Running",
                        items.filter((item) => alertGroupOf(item) === "running").length,
                      ],
                    ]
                  : [
                      ["all", "All", items.length],
                      ["critical", words.act, items.filter((item) => item.tone === "danger").length],
                      ["review", words.wait, items.filter((item) => item.tone !== "danger").length],
                    ]) as [TaskFilter, string, number][]
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
                  {label}{" "}
                  <span className={styles.count} data-zero={count === 0 || undefined}>
                    {count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterMeta}>
            {/* pop-alerts: "12 of 12" repeats the All count, so it shows only while a filter narrows the list. */}
            <span role="status" className={filteredItems.length === items.length ? "sr-only" : styles.filterStatus}>
              <strong className={styles.mono}>{filteredItems.length}</strong> of {items.length}{" "}
              <span className="sr-only">invented </span>alerts
            </span>
            {oneAction ? null : (
              <>
                <label className={styles.selectWrap}>
                  <Filter aria-hidden="true" />
                  <select
                    aria-label={`Filter ${words.plural.slice(0, -1)} state`}
                    value={ackFilter}
                    onChange={(event) => setAckFilter(event.target.value as AckFilter)}
                  >
                    {(Object.entries(ackFilterLabels(words)) as [AckFilter, string][]).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown aria-hidden="true" />
                </label>
                <label className={styles.selectWrap}>
                  <select
                    aria-label={`Sort ${words.plural}`}
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
              </>
            )}
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
                  ? `Nothing for ${WARD_FLOW_ROLE_LABELS[role]}`
                  : snoozedItems.length > 0
                    ? "Nothing active"
                    : "No outstanding work"}
              </h3>
              <p>
                {role === "coordinator"
                  ? `New ${words.plural} appear here`
                  : `${words.name} here is worked by the bed coordinator.`}
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <Search aria-hidden="true" />
              </span>
              <h3>{ackFilter === "completed" ? `No completed ${words.plural}` : `No matching ${words.plural}`}</h3>
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
                  <ul className={styles.list}>{renderRows(filteredFacts)}</ul>
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
                  <ul className={styles.list}>{renderRows(filteredCommitments)}</ul>
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
                            <strong>{patient?.formalName ?? "Patient not linked"}</strong>
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
                            aria-label={`Return ${item.title} now, ${patient?.formalName ?? "patient not linked"}`}
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

        {oneAction ? null : (
          <nav aria-label="Network exception boards" data-testid="ward-tasks-quick-jumps" className={styles.quickJumps}>
            {/* One Alerts queue: this drawer is the quick look, and the full screen holds the detail,
              broadcast and history. */}
            {words === ALERTS_WORDS ? (
              <Link
                href={WARD_ALERTS_HREF}
                onClick={closeFromLink}
                data-testid="ward-tasks-open-alerts"
                className={buttonClass({ variant: "pri", size: "sm" })}
              >
                Open the Alerts screen
              </Link>
            ) : null}
            <Link
              href={WARD_VIEWS.find((view) => view.id === "delays")?.href ?? "/ward-flow/waiting"}
              onClick={closeFromLink}
              data-testid="ward-tasks-jump-delays"
              className={styles.quickJump}
            >
              Waiting list →
            </Link>
            <span aria-hidden="true" className={styles.quickJumpSep}>
              ·
            </span>
            {words === ALERTS_WORDS || !alertsScreenOpen ? null : (
              <>
                <Link
                  href={WARD_NAV.find((item) => item.id === "alerts")?.href ?? WARD_ALERTS_HREF}
                  onClick={closeFromLink}
                  data-testid="ward-tasks-jump-alerts"
                  className={styles.quickJump}
                >
                  Alerts &amp; watches →
                </Link>
                <span aria-hidden="true" className={styles.quickJumpSep}>
                  ·
                </span>
              </>
            )}
            <Link
              href={WARD_HOME_HREF}
              onClick={closeFromLink}
              data-testid="ward-tasks-jump-coordinator"
              className={styles.quickJump}
            >
              Home →
            </Link>
          </nav>
        )}

        <div className={styles.drawerFoot}>
          {/* Change 7: the one way on from the preview is the Alerts screen itself. */}
          {oneAction ? (
            <Link
              href={WARD_ALERTS_HREF}
              onClick={closeFromLink}
              data-testid="ward-tasks-open-alerts"
              className={buttonClass({ variant: "sec", size: "sm" })}
            >
              Open Alerts
            </Link>
          ) : (
            <span id={`${sectionId}-summary`}>Seen is not resolved</span>
          )}
          <AcknowledgeVisibleButton
            ids={visibleUnacknowledged.map((item) => item.id)}
            onAcknowledge={acknowledgeAllFacts}
            classes={styles}
          />
        </div>
      </aside>
    </>
  );
}
