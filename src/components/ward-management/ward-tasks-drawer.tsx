"use client";

import { CheckCircle2, CheckSquare, ListChecks, RotateCcw, ShieldAlert, UserCheck, X } from "lucide-react";
import { useEffect, useState, type Dispatch } from "react";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import type { WardFlowEvent, WardFlowRole } from "@/components/ward-management/ward-flow-events";
import {
  inboxItemCompletionState,
  type InboxAcknowledgement,
  type InboxCompletionEntry,
} from "@/components/ward-management/ward-flow-reducer";

import styles from "./ward-tasks-drawer.module.css";

type WardTasksDrawerProps = {
  items: InboxItem[];
  acknowledgements: Record<string, InboxAcknowledgement[]>;
  completions: Record<string, InboxCompletionEntry[]>;
  role: WardFlowRole;
  now: Instant;
  dispatch: Dispatch<WardFlowEvent>;
  onClose: () => void;
  onSelectMovement: (movementId: string) => void;
  withBackdrop?: boolean;
};

function getInitials(name?: string, fallback = "PT"): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
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
  withBackdrop = false,
}: WardTasksDrawerProps) {
  useEffect(() => {
    const trigger = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
    return () => {
      if (trigger && typeof trigger.focus === "function") {
        trigger.focus();
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
    facts.forEach((item) => {
      dispatch({ type: "ACKNOWLEDGE_INBOX_ITEM", role, now, inboxItemId: item.id });
    });
  }

  const facts = items.filter((item) => item.kind === "fact");
  const criticalFactsCount = facts.filter((item) => item.tone === "danger").length;
  const reviewFactsCount = facts.filter((item) => item.tone !== "danger").length;

  const filteredFacts = facts.filter((item) => {
    if (taskFilter === "critical") return item.tone === "danger";
    if (taskFilter === "review") return item.tone !== "danger";
    return true;
  });

  const commitments = items.filter((item) => item.kind === "commitment");

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
      <aside className={styles.drawer} role="complementary" aria-label="Tasks">
      <div className={styles.header}>
        <h2 className={styles.heading}>
          <span>Outstanding work</span>
          <span className={styles.headingCount} data-testid="ward-tasks-drawer-count">
            {items.length}
          </span>
        </h2>
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

      <div className={styles.taskFilterTrack} role="group" aria-label="Filter tasks by status">
        <button
          type="button"
          className={`${styles.taskFilterTab} ${taskFilter === "all" ? styles.taskFilterTabActive : ""}`}
          onClick={() => setTaskFilter("all")}
        >
          All <span>{facts.length}</span>
        </button>
        <button
          type="button"
          className={`${styles.taskFilterTab} ${taskFilter === "critical" ? styles.taskFilterTabActive : ""}`}
          onClick={() => setTaskFilter("critical")}
        >
          Past Due / Critical <span>{criticalFactsCount}</span>
        </button>
        <button
          type="button"
          className={`${styles.taskFilterTab} ${taskFilter === "review" ? styles.taskFilterTabActive : ""}`}
          onClick={() => setTaskFilter("review")}
        >
          Review Due <span>{reviewFactsCount}</span>
        </button>
      </div>

      <div className={styles.drawerBody}>
        {items.length === 0 ? (
          <p className={styles.placeholder}>
            {role === "coordinator" ? "No outstanding work right now." : "Tasks is the bed coordinator's list."}
          </p>
        ) : (
          <>
            {/* SECTION 1: STATUTORY FACTS */}
            {facts.length > 0 ? (
              <div className={styles.taskSectionGroup} id="groupFacts">
                <div className={styles.taskSectionHeader}>
                  <h3 className={styles.taskSectionTitle}>
                    <ShieldAlert aria-hidden="true" style={{ width: 13, height: 13 }} />
                    <span>Recorded forms</span>
                  </h3>
                  <span className={styles.taskStripBadge} style={{ color: "var(--danger)", fontWeight: 700 }}>
                    {facts.length} Pending
                  </span>
                </div>

                <ul className={styles.taskStripList}>
                  {filteredFacts.map((item) => {
                    const ackHistory = acknowledgements[item.id] ?? [];
                    const latestAck = ackHistory.length > 0 ? ackHistory[ackHistory.length - 1] : undefined;
                    const initials = getInitials(item.title);

                    return (
                      <li key={item.id} className={styles.taskStrip}>
                        <div className={styles.taskStripMain}>
                          <div
                            className={`${styles.taskStripAvatar} ${
                              item.tone === "warning" ? styles.taskStripAvatarWarn : ""
                            }`}
                          >
                            {initials}
                          </div>
                          <div className={styles.taskStripContent}>
                            <div className={styles.taskStripRow1}>
                              <button
                                type="button"
                                data-testid={`ward-task-${item.id}`}
                                className={styles.rowSelect}
                                onClick={() => onSelectMovement(item.movementId)}
                              >
                                <span className={styles.taskStripPatient}>{item.title}</span>
                              </button>
                              <span
                                className={`${styles.taskStripBadge} ${
                                  item.tone === "danger" ? styles.taskStripBadgeUrgent : styles.taskStripBadgeWarn
                                }`}
                              >
                                {item.tone === "danger" ? "ED Past Due / Critical" : "Review Due"}
                              </span>
                            </div>
                            <div className={styles.taskStripRow2}>
                              <span className={styles.taskStripSub}>
                                {item.detail} · {item.owner}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className={styles.taskStripActions}>
                          <button type="button" className={styles.btnAckFact} onClick={() => acknowledge(item.id)}>
                            <UserCheck aria-hidden="true" style={{ width: 13, height: 13 }} />
                            <span>Acknowledge</span>
                          </button>

                          <button
                            type="button"
                            className={styles.btnMovement}
                            onClick={() => onSelectMovement(item.movementId)}
                          >
                            <span>Open movement</span>
                          </button>

                          {latestAck ? (
                            <span className={styles.ackStatus} data-testid={`ward-task-ack-${item.id}`}>
                              <UserCheck aria-hidden="true" style={{ width: 13, height: 13 }} />
                              Acknowledged by {latestAck.by} · {formatInstantWithDay(latestAck.at, now)}
                              {ackHistory.length > 1 ? ` (${ackHistory.length})` : ""}
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {/* SECTION 2: OPERATIONAL COMMITMENTS */}
            {commitments.length > 0 ? (
              <div className={styles.taskSectionGroup} id="groupTasks">
                <div className={styles.taskSectionHeader}>
                  <h3 className={styles.taskSectionTitle}>
                    <ListChecks aria-hidden="true" style={{ width: 14, height: 14 }} />
                    <span>Operational Commitments</span>
                  </h3>
                  <span className={styles.taskStripBadge} style={{ color: "var(--accent)", fontWeight: 700 }}>
                    {commitments.length} Open Tasks
                  </span>
                </div>

                <ul className={styles.taskStripList}>
                  {commitments.map((item) => {
                    const completionHistory = completions[item.id];
                    const isComplete = inboxItemCompletionState(completionHistory) === "complete";
                    const latestCompletion =
                      isComplete && completionHistory ? completionHistory[completionHistory.length - 1] : undefined;
                    const initials = getInitials(item.title);

                    return (
                      <li key={item.id} className={styles.taskStrip}>
                        <div className={styles.taskStripMain}>
                          <div className={styles.taskStripAvatar}>{initials}</div>
                          <div className={styles.taskStripContent}>
                            <div className={styles.taskStripRow1}>
                              <button
                                type="button"
                                data-testid={`ward-task-${item.id}`}
                                className={styles.rowSelect}
                                onClick={() => onSelectMovement(item.movementId)}
                              >
                                <span className={styles.taskStripPatient}>{item.title}</span>
                              </button>
                              <span className={styles.taskStripBadge}>Active Task</span>
                            </div>
                            <div className={styles.taskStripRow2}>
                              <span className={styles.taskStripSub}>
                                {item.detail} · {item.owner}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className={styles.taskStripActions}>
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
                              <RotateCcw aria-hidden="true" style={{ width: 13, height: 13 }} />
                              <span>Reopen</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              data-testid={`ward-task-complete-${item.id}`}
                              className={styles.btnCompleteTask}
                              onClick={() => complete(item.id)}
                            >
                              <CheckCircle2 aria-hidden="true" style={{ width: 13, height: 13 }} />
                              <span>Mark done</span>
                            </button>
                          )}

                          <button
                            type="button"
                            className={styles.btnMovement}
                            onClick={() => onSelectMovement(item.movementId)}
                          >
                            <span>Open movement</span>
                          </button>

                          {latestCompletion ? (
                            <span className={styles.doneStatus} data-testid={`ward-task-done-${item.id}`}>
                              <CheckSquare aria-hidden="true" style={{ width: 13, height: 13 }} />
                              Done by {latestCompletion.by} · {formatInstantWithDay(latestCompletion.at, now)}
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className={styles.drawerFoot}>
        <span id="taskDrawerSummary">
          {facts.length} Facts Pending · {commitments.length} Commitments Open
        </span>
        {facts.length > 0 ? (
          <button type="button" className={styles.btnAckAll} onClick={acknowledgeAllFacts}>
            <UserCheck aria-hidden="true" style={{ width: 13, height: 13 }} />
            <span>Acknowledge All Facts</span>
          </button>
        ) : null}
      </div>
    </aside>
  </>
  );
}
