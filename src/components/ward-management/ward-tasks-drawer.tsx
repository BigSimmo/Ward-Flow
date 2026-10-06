"use client";

import { CheckCircle2, CheckSquare, ListChecks, RotateCcw, ShieldAlert, UserCheck, Search, X } from "lucide-react";
import { useRef, useState, type Dispatch } from "react";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
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
  onSelectMovement: (movementId: string) => void;
  withBackdrop?: boolean;
};

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
  const drawerRef = useRef<HTMLElement>(null);
  useWardModalFocus(true, drawerRef, onClose);

  const [query, setQuery] = useState("");
  const [ackFilter, setAckFilter] = useState("all");
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
    if (ackFilter === "unacknowledged" && (item.kind !== "fact" || acknowledged)) return false;
    if (ackFilter === "acknowledged" && (item.kind !== "fact" || !acknowledged)) return false;
    return `${item.title} ${item.detail} ${item.owner}`.toLowerCase().includes(query.trim().toLowerCase());
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
            <p className={styles.headerNote}>Current work from synthetic movement records.</p>
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
          <label className={styles.search}>
            <Search aria-hidden="true" />
            <input
              aria-label="Search tasks"
              placeholder="Search task, movement or owner…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
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
              {filteredItems.length} of {items.length} invented tasks
            </span>
            <select
              aria-label="Filter acknowledgement state"
              value={ackFilter}
              onChange={(event) => setAckFilter(event.target.value)}
            >
              <option value="all">All acknowledgement states</option>
              <option value="unacknowledged">Not yet acknowledged</option>
              <option value="acknowledged">Acknowledged</option>
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
              <Search aria-hidden="true" />
              <h3>No matching tasks</h3>
              <p>Try another name, owner or filter.</p>
              <button
                type="button"
                className={styles.btnMovement}
                onClick={() => {
                  setQuery("");
                  setTaskFilter("all");
                  setAckFilter("all");
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              {/* SECTION 1: STATUTORY FACTS */}
              {filteredFacts.length > 0 ? (
                <div className={styles.taskSectionGroup} id="groupFacts">
                  <div className={styles.taskSectionHeader}>
                    <h3 className={styles.taskSectionTitle}>
                      <ShieldAlert aria-hidden="true" style={{ width: 13, height: 13 }} />
                      <span>Recorded forms</span>
                    </h3>
                    <span className={styles.taskStripBadge} style={{ color: "var(--danger)", fontWeight: 700 }}>
                      {filteredFacts.length} recorded
                    </span>
                  </div>

                  <ul className={styles.taskStripList}>
                    {filteredFacts.map((item) => {
                      const ackHistory = acknowledgements[item.id] ?? [];
                      const latestAck = ackHistory.length > 0 ? ackHistory[ackHistory.length - 1] : undefined;
                      const Icon = item.icon;

                      return (
                        <li key={item.id} className={styles.taskStrip} data-tone={item.tone}>
                          <div className={styles.taskStripMain}>
                            <div
                              className={`${styles.taskStripAvatar} ${
                                item.tone === "warning" ? styles.taskStripAvatarWarn : ""
                              }`}
                            >
                              <Icon aria-hidden="true" />
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
                                  {item.tone === "danger" ? "Past Due / Critical" : "Review Due"}
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
              {filteredCommitments.length > 0 ? (
                <div className={styles.taskSectionGroup} id="groupTasks">
                  <div className={styles.taskSectionHeader}>
                    <h3 className={styles.taskSectionTitle}>
                      <ListChecks aria-hidden="true" style={{ width: 14, height: 14 }} />
                      <span>Operational Commitments</span>
                    </h3>
                    <span className={styles.taskStripBadge} style={{ color: "var(--accent)", fontWeight: 700 }}>
                      {filteredCommitments.length} commitments
                    </span>
                  </div>

                  <ul className={styles.taskStripList}>
                    {filteredCommitments.map((item) => {
                      const completionHistory = completions[item.id];
                      const isComplete = inboxItemCompletionState(completionHistory) === "complete";
                      const latestCompletion =
                        isComplete && completionHistory ? completionHistory[completionHistory.length - 1] : undefined;
                      const Icon = item.icon;

                      return (
                        <li key={item.id} className={styles.taskStrip} data-tone={item.tone}>
                          <div className={styles.taskStripMain}>
                            <div className={styles.taskStripAvatar}>
                              <Icon aria-hidden="true" />
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
                                <span className={styles.taskStripBadge}>
                                  {isComplete ? "Completed" : "Open commitment"}
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
          <span id="taskDrawerSummary">Acknowledgement records that you have seen a fact. It does not resolve it.</span>
          {visibleUnacknowledged.length > 0 ? (
            <button type="button" className={styles.btnAckAll} onClick={acknowledgeAllFacts}>
              <UserCheck aria-hidden="true" style={{ width: 13, height: 13 }} />
              <span>Acknowledge visible ({visibleUnacknowledged.length})</span>
            </button>
          ) : null}
        </div>
      </aside>
    </>
  );
}
