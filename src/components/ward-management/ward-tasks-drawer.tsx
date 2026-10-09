"use client";

import {
  ArrowUpRight,
  BedDouble,
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
  X,
} from "lucide-react";
import { useRef, useState, type Dispatch } from "react";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { StatusGlyph, durMinutes, type WfTone } from "@/components/wf";
import { resolveSubjectPatient } from "./ward-patient-resolver";
import { edById } from "./ward-sites";
import { stageCopy } from "./ward-derivations";
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

import styles from "./ward-tasks-drawer.module.css";

type WardTasksDrawerProps = {
  items: InboxItem[];
  acknowledgements: Record<string, InboxAcknowledgement[]>;
  completions: Record<string, InboxCompletionEntry[]>;
  role: WardFlowRole;
  now: Instant;
  dispatch: Dispatch<WardFlowEvent>;
  onClose: () => void;
  /** `href` is a row's own destination when it is not about a movement (a planned admission). */
  onSelectMovement: (movementId: string, action?: "refer" | "contact", href?: string) => void;
  records?: {
    movements: readonly Movement[];
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
  return item.tone === "danger"
    ? { state: "Act now", tone: "danger", stateTone: "danger" }
    : { state: "Review", tone: "warning" };
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
  items,
  acknowledgements,
  completions,
  role,
  now,
  dispatch,
  onClose,
  onSelectMovement,
  records,
  withBackdrop = false,
}: WardTasksDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);
  useWardModalFocus(true, drawerRef, onClose);

  const [escalating, setEscalating] = useState<string | null>(null);
  const [contact, setContact] = useState("");
  const [ackFilter, setAckFilter] = useState<AckFilter>("all");
  const [taskFilter, setTaskFilter] = useState<"all" | "critical" | "review">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function acknowledge(inboxItemId: string) {
    dispatch({ type: "ACKNOWLEDGE_INBOX_ITEM", role, now, inboxItemId });
  }

  function complete(inboxItemId: string) {
    dispatch({ type: "COMPLETE_INBOX_ITEM", role, now, inboxItemId });
  }

  function reopen(inboxItemId: string) {
    dispatch({ type: "REOPEN_INBOX_ITEM", role, now, inboxItemId });
  }

  function acknowledgeAllFacts() {
    visibleUnacknowledged.forEach((item) => {
      dispatch({ type: "ACKNOWLEDGE_INBOX_ITEM", role, now, inboxItemId: item.id });
    });
  }

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
  const visibleUnacknowledged = filteredFacts.filter((item) => !acknowledgements[item.id]?.length);
  // One row at a time shows its full detail; the first visible row until someone picks another.
  const expanded = filteredItems.some((item) => item.id === expandedId) ? expandedId : (filteredItems[0]?.id ?? null);

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
            onClick={() => onSelectMovement(item.movementId, "refer")}
          >
            <Send aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="button"
          className={`${styles.btn} ${styles.btnIcon}`}
          aria-label="Contact"
          title="Contact"
          onClick={() => onSelectMovement(item.movementId, "contact")}
        >
          <Phone aria-hidden="true" />
        </button>
        {role === "coordinator" ? (
          <button
            type="button"
            className={styles.btn}
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

  function renderEscalation(item: InboxItem, movement?: Movement) {
    if (escalating !== item.id || !movement) return null;
    const focusTrigger = (from: HTMLElement) =>
      from.closest("li")?.querySelector<HTMLButtonElement>("button[aria-expanded]")?.focus();
    return (
      <form
        className={styles.escalationForm}
        onSubmit={(event) => {
          event.preventDefault();
          if (!contact.trim()) return;
          dispatch({
            type: "RECORD_ESCALATION",
            role,
            now,
            movementId: movement.id,
            triedUnitIds: [...new Set(movement.declines.map((decline) => decline.unitId))],
            contact: contact.trim(),
          });
          focusTrigger(event.currentTarget);
          setEscalating(null);
          setContact("");
        }}
      >
        <label className={styles.escalationLabel}>
          Who did you escalate to?
          <span className={styles.escalationInput}>
            <input
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
              onClick={() => setContact(pick)}
            >
              {pick}
            </button>
          ))}
        </div>
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
    // A planned admission row has no movement: the booking itself names the person.
    const patient = records ? resolveSubjectPatient(movement ?? item.plannedAdmission, records) : undefined;
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

    return (
      <li
        key={item.id}
        className={styles.row}
        data-tone={item.tone}
        data-expanded={isExpanded}
        data-done={done}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button, input, form, a")) return;
          setExpandedId(item.id);
        }}
      >
        <div className={styles.rowHead}>
          <span className={styles.rowIcon} aria-hidden="true">
            <Icon aria-hidden="true" />
          </span>
          <div className={styles.rowText}>
            <button
              type="button"
              data-testid={`ward-task-${item.id}`}
              className={styles.rowTitle}
              onClick={() => onSelectMovement(item.movementId, undefined, item.href)}
            >
              {item.title}
            </button>
            <p className={styles.rowMeta}>
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
          <div className={styles.rowWhen}>
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

        {latestAck ? (
          <p className={styles.ackStatus} data-testid={`ward-task-ack-${item.id}`}>
            <StatusGlyph tone="info" size={8} />
            Acknowledged at {formatInstantWithDay(latestAck.at, now)}
            {ackHistory.length > 1 ? ` · ${ackHistory.length} times` : ""}, still open
          </p>
        ) : null}
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
              onClick={() => acknowledge(item.id)}
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
              onClick={() => reopen(item.id)}
            >
              <RotateCcw aria-hidden="true" />
              Reopen
            </button>
          ) : (
            <button
              type="button"
              data-testid={`ward-task-complete-${item.id}`}
              className={`${styles.btn} ${isExpanded ? styles.btnPrimary : ""}`}
              onClick={() => complete(item.id)}
            >
              <CheckCircle2 aria-hidden="true" />
              Mark done
            </button>
          )}
          <button
            type="button"
            className={`${styles.btn} ${isExpanded && isFact && latestAck && escalating !== item.id ? styles.btnPrimary : ""}`}
            aria-label={item.plannedAdmission ? "Open planned admission in Capacity" : "Open patient"}
            onClick={() => onSelectMovement(item.movementId, undefined, item.href)}
          >
            <ArrowUpRight aria-hidden="true" />
            Open
          </button>
          {renderMovementActions(item, movement)}
        </div>
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
      >
        <div className={styles.header}>
          <span className={styles.headerIcon} aria-hidden="true">
            <ListChecks aria-hidden="true" />
          </span>
          <div className={styles.headerText}>
            <h2 className={styles.heading}>Tasks</h2>
            <p className={styles.headerNote}>{ROLE_LABELS[role] ?? "Tasks"} · synthetic movements</p>
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
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className={styles.controls}>
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
                  onClick={() => setTaskFilter(value)}
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
              <span className={styles.count} aria-hidden="true">
                {filteredItems.length}
              </span>
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
              <h3>{role === "coordinator" ? "No outstanding work" : "Bed coordinator's list"}</h3>
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
                <section className={styles.section} aria-labelledby="ward-tasks-facts">
                  <div className={styles.sectionHead}>
                    <ShieldCheck aria-hidden="true" />
                    <h3 id="ward-tasks-facts" className={styles.sectionTitle}>
                      Needs attention
                    </h3>
                    <span className={styles.count}>{filteredFacts.length}</span>
                    <span className={styles.sectionNote}>Leaves when no longer true</span>
                  </div>
                  <ul className={styles.list}>{filteredFacts.map(renderRow)}</ul>
                </section>
              ) : null}

              {filteredCommitments.length > 0 ? (
                <section className={styles.section} aria-labelledby="ward-tasks-commitments">
                  <div className={styles.sectionHead}>
                    <ListChecks aria-hidden="true" />
                    <h3 id="ward-tasks-commitments" className={styles.sectionTitle}>
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
        </div>

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
