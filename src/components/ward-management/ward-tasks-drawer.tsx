"use client";

import {
  ArrowUpRight,
  CheckCircle2,
  CheckSquare,
  ListChecks,
  Phone,
  RotateCcw,
  Share2,
  ShieldAlert,
  Siren,
  UserCheck,
  X,
} from "lucide-react";
import { useRef, useState, type Dispatch, type ReactNode } from "react";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import type { WardFlowEvent, WardFlowRole } from "@/components/ward-management/ward-flow-events";
import {
  inboxItemCompletionState,
  type InboxAcknowledgement,
  type InboxCompletionEntry,
} from "@/components/ward-management/ward-flow-reducer";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import {
  visibleTaskDetail,
  type TaskCardContext,
  type TaskFocus,
} from "@/components/ward-management/ward-task-card-context";

import styles from "./ward-tasks-drawer.module.css";

type WardTasksDrawerProps = {
  items: InboxItem[];
  acknowledgements: Record<string, InboxAcknowledgement[]>;
  completions: Record<string, InboxCompletionEntry[]>;
  role: WardFlowRole;
  now: Instant;
  dispatch: Dispatch<WardFlowEvent>;
  onClose: () => void;
  onSelectMovement: (movementId: string, focus?: TaskFocus) => void;
  /** Patient and movement facts keyed by movement id. Absent in a bare render, which then shows the task title only. */
  contexts?: Record<string, TaskCardContext>;
  withBackdrop?: boolean;
};

type AckFilter = "all" | "unacknowledged" | "acknowledged" | "completed";

export function WardTasksDrawer({
  items,
  acknowledgements,
  completions,
  role,
  now,
  dispatch,
  onClose,
  onSelectMovement,
  contexts,
  withBackdrop = false,
}: WardTasksDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);
  useWardModalFocus(true, drawerRef, onClose);

  const [ackFilter, setAckFilter] = useState<AckFilter>("all");
  const [taskFilter, setTaskFilter] = useState<"all" | "critical" | "review">("all");

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

  const facts = items.filter((item) => item.kind === "fact");
  const criticalFactsCount = facts.filter((item) => item.tone === "danger").length;

  const commitments = items.filter((item) => item.kind === "commitment");
  const openCommitments = commitments.filter((item) => inboxItemCompletionState(completions[item.id]) !== "complete");
  const unacknowledged = facts.filter((item) => !acknowledgements[item.id]?.length);
  const filteredItems = items.filter((item) => {
    if (taskFilter === "critical" && item.tone !== "danger") return false;
    if (taskFilter === "review" && item.tone === "danger") return false;
    const acknowledged = Boolean(acknowledgements[item.id]?.length);
    const completed = item.kind === "commitment" && inboxItemCompletionState(completions[item.id]) === "complete";
    if (ackFilter === "unacknowledged" && (item.kind !== "fact" || acknowledged)) return false;
    if (ackFilter === "acknowledged" && (item.kind !== "fact" || !acknowledged)) return false;
    if (ackFilter === "completed" && !completed) return false;
    return true;
  });
  const filteredFacts = filteredItems.filter((item) => item.kind === "fact");
  const filteredCommitments = filteredItems.filter((item) => item.kind === "commitment");
  const visibleUnacknowledged = filteredFacts.filter((item) => !acknowledgements[item.id]?.length);

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
      <aside ref={drawerRef} className={styles.drawer} role="complementary" aria-label="Tasks">
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Task inbox</p>
            <h2 className={styles.heading}>
              <span>Outstanding work</span>
              <span className={styles.headingCount} data-testid="ward-tasks-drawer-count">
                {items.length}
              </span>
            </h2>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close tasks panel"
            title="Close tasks panel"
          >
            <span>Esc</span>
            <X aria-hidden="true" />
          </button>
        </div>

        <div className={styles.controls}>
          <div className={styles.summary}>
            <div>
              <strong>{criticalFactsCount}</strong>
              <span>Critical facts</span>
            </div>
            <div>
              <strong>{unacknowledged.length}</strong>
              <span>To acknowledge</span>
            </div>
            <div>
              <strong>{openCommitments.length}</strong>
              <span>Open commitments</span>
            </div>
          </div>
          <div className={styles.taskFilterTrack} role="group" aria-label="Filter tasks by status">
            <button
              type="button"
              className={`${styles.taskFilterTab} ${taskFilter === "all" ? styles.taskFilterTabActive : ""}`}
              aria-pressed={taskFilter === "all"}
              onClick={() => setTaskFilter("all")}
            >
              All <span>{items.length}</span>
            </button>
            <button
              type="button"
              className={`${styles.taskFilterTab} ${taskFilter === "critical" ? styles.taskFilterTabActive : ""}`}
              aria-pressed={taskFilter === "critical"}
              onClick={() => setTaskFilter("critical")}
            >
              Critical <span>{items.filter((item) => item.tone === "danger").length}</span>
            </button>
            <button
              type="button"
              className={`${styles.taskFilterTab} ${taskFilter === "review" ? styles.taskFilterTabActive : ""}`}
              aria-pressed={taskFilter === "review"}
              onClick={() => setTaskFilter("review")}
            >
              Review <span>{items.filter((item) => item.tone !== "danger").length}</span>
            </button>
          </div>

          <div className={styles.filterMeta}>
            <span role="status">
              {filteredItems.length} of {items.length} tasks
            </span>
            <select
              aria-label="Filter acknowledgement state"
              value={ackFilter}
              onChange={(event) => setAckFilter(event.target.value as AckFilter)}
            >
              <option value="all">All tasks</option>
              <option value="unacknowledged">Not acknowledged</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
        <div className={styles.drawerBody}>
          {items.length === 0 ? (
            <p className={styles.placeholder}>
              {role === "coordinator" ? "No outstanding work right now." : "Tasks is the bed coordinator's list."}
            </p>
          ) : filteredItems.length === 0 ? (
            <div className={styles.empty}>
              <ListChecks aria-hidden="true" />
              <h3>No tasks in this view</h3>
              <p>
                {ackFilter === "completed"
                  ? "No completed tasks. A recorded fact stays here until the situation changes."
                  : "Nothing matches this filter."}
              </p>
              <button
                type="button"
                className={styles.btnMovement}
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
                <div className={styles.taskSectionGroup} id="groupFacts">
                  <div className={styles.taskSectionHeader}>
                    <h3 className={styles.taskSectionTitle}>
                      <ShieldAlert aria-hidden="true" />
                      <span>Recorded forms</span>
                    </h3>
                    <span className={styles.sectionCount}>{filteredFacts.length} recorded</span>
                  </div>

                  <ul className={styles.taskStripList}>
                    {filteredFacts.map((item) => {
                      const ackHistory = acknowledgements[item.id] ?? [];
                      const latestAck = ackHistory.length > 0 ? ackHistory[ackHistory.length - 1] : undefined;

                      return (
                        <TaskRow
                          key={item.id}
                          item={item}
                          context={contexts?.[item.movementId]}
                          badge={item.tone === "danger" ? "Past due" : "Review"}
                          onSelectMovement={onSelectMovement}
                          status={
                            latestAck ? (
                              <span className={styles.ackStatus} data-testid={`ward-task-ack-${item.id}`}>
                                <UserCheck aria-hidden="true" />
                                Acknowledged by {latestAck.by} · {formatInstantWithDay(latestAck.at, now)}
                                {ackHistory.length > 1 ? ` (${ackHistory.length})` : ""}
                              </span>
                            ) : null
                          }
                        >
                          <button type="button" className={styles.btnAckFact} onClick={() => acknowledge(item.id)}>
                            <UserCheck aria-hidden="true" />
                            <span>Acknowledge</span>
                          </button>
                        </TaskRow>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {filteredCommitments.length > 0 ? (
                <div className={styles.taskSectionGroup} id="groupTasks">
                  <div className={styles.taskSectionHeader}>
                    <h3 className={styles.taskSectionTitle}>
                      <ListChecks aria-hidden="true" />
                      <span>Operational commitments</span>
                    </h3>
                    <span className={styles.sectionCount}>{filteredCommitments.length} commitments</span>
                  </div>

                  <ul className={styles.taskStripList}>
                    {filteredCommitments.map((item) => {
                      const completionHistory = completions[item.id];
                      const isComplete = inboxItemCompletionState(completionHistory) === "complete";
                      const latestCompletion =
                        isComplete && completionHistory ? completionHistory[completionHistory.length - 1] : undefined;

                      return (
                        <TaskRow
                          key={item.id}
                          item={item}
                          context={contexts?.[item.movementId]}
                          badge={isComplete ? "Completed" : "Open"}
                          onSelectMovement={onSelectMovement}
                          status={
                            latestCompletion ? (
                              <span className={styles.doneStatus} data-testid={`ward-task-done-${item.id}`}>
                                <CheckSquare aria-hidden="true" />
                                Done by {latestCompletion.by} · {formatInstantWithDay(latestCompletion.at, now)}
                              </span>
                            ) : null
                          }
                        >
                          {/* One control, not two: the reducer refuses COMPLETE on a row that is
                              already complete and REOPEN on one that is not, so rendering both
                              would always leave one of them dead. Which one shows is decided by
                              the same `isComplete` the "Done by …" status below reads, so the
                              button and the status can never disagree. */}
                          {isComplete ? (
                            <button
                              type="button"
                              data-testid={`ward-task-reopen-${item.id}`}
                              className={styles.btnCompleteTask}
                              onClick={() => reopen(item.id)}
                            >
                              <RotateCcw aria-hidden="true" />
                              <span>Reopen</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              data-testid={`ward-task-complete-${item.id}`}
                              className={styles.btnCompleteTask}
                              onClick={() => complete(item.id)}
                            >
                              <CheckCircle2 aria-hidden="true" />
                              <span>Mark done</span>
                            </button>
                          )}
                        </TaskRow>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className={styles.drawerFoot}>
          <span id="taskDrawerSummary">Acknowledgement records that you have seen a fact. It does not resolve it.</span>
          {visibleUnacknowledged.length > 0 ? (
            <button type="button" className={styles.btnAckAll} onClick={acknowledgeAllFacts}>
              <UserCheck aria-hidden="true" />
              <span>Acknowledge visible ({visibleUnacknowledged.length})</span>
            </button>
          ) : null}
        </div>
      </aside>
    </>
  );
}

function taskFacts(item: InboxItem, context: TaskCardContext | undefined): string[] {
  const detail = visibleTaskDetail(item.detail);
  if (!context) return detail ? [detail] : [];
  const destination = context.destination && !detail.includes(context.destination) ? context.destination : undefined;
  const facts = [context.location, destination, context.stageLabel, context.legalStatus, detail];
  return [...new Set(facts.filter((fact): fact is string => Boolean(fact)))];
}

function TaskRow({
  item,
  context,
  badge,
  onSelectMovement,
  status,
  children,
}: {
  item: InboxItem;
  context: TaskCardContext | undefined;
  badge: string;
  onSelectMovement: (movementId: string, focus?: TaskFocus) => void;
  status: ReactNode;
  children: ReactNode;
}) {
  const Icon = item.icon;
  const facts = taskFacts(item, context);
  const declined = item.id.startsWith("declines-");

  return (
    <li className={styles.taskStrip} data-tone={item.tone} data-testid={`ward-task-row-${item.id}`}>
      <div className={styles.taskStripMain}>
        <div className={`${styles.taskStripAvatar} ${item.tone === "warning" ? styles.taskStripAvatarWarn : ""}`}>
          <Icon aria-hidden="true" />
        </div>
        <div className={styles.taskStripContent}>
          <div className={styles.taskStripRow1}>
            <button
              type="button"
              data-testid={`ward-task-${item.id}`}
              className={styles.rowSelect}
              onClick={() => onSelectMovement(item.movementId, "record")}
            >
              <span className={styles.taskStripPatient}>{context?.displayName ?? item.title}</span>
            </button>
            {context ? (
              <span className={styles.umrn} data-testid={`ward-task-umrn-${item.id}`}>
                {context.umrn}
              </span>
            ) : null}
            <span
              className={`${styles.taskStripBadge} ${
                item.tone === "danger"
                  ? styles.taskStripBadgeUrgent
                  : item.tone === "warning"
                    ? styles.taskStripBadgeWarn
                    : ""
              }`}
            >
              {badge}
            </span>
          </div>
          {context ? <p className={styles.taskKind}>{item.title}</p> : null}
          {facts.length > 0 ? (
            <ul className={styles.metaList}>
              {facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className={styles.taskStripActions}>
        {children}
        <button
          type="button"
          className={styles.btnMovement}
          onClick={() => onSelectMovement(item.movementId, "record")}
        >
          <ArrowUpRight aria-hidden="true" />
          <span>Open</span>
        </button>
        {context?.canRefer ? (
          <button type="button" className={styles.btnRefer} onClick={() => onSelectMovement(item.movementId, "refer")}>
            <Share2 aria-hidden="true" />
            <span>Refer</span>
          </button>
        ) : null}
        <button
          type="button"
          className={styles.btnContact}
          onClick={() => onSelectMovement(item.movementId, "contact")}
        >
          <Phone aria-hidden="true" />
          <span>Contact</span>
        </button>
        {declined && context && !context.alreadyEscalated ? (
          <button
            type="button"
            className={styles.btnEscalate}
            onClick={() => onSelectMovement(item.movementId, "escalate")}
          >
            <Siren aria-hidden="true" />
            <span>Escalate</span>
          </button>
        ) : null}
        {declined && context?.alreadyEscalated ? <span className={styles.escalatedNote}>Escalated</span> : null}
        {status}
      </div>
    </li>
  );
}
