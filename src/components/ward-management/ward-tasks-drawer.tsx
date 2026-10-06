"use client";

import {
  CheckCircle2,
  CheckSquare,
  ListChecks,
  RotateCcw,
  ShieldAlert,
  UserCheck,
  Search,
  X,
  ArrowUpRight,
  Phone,
  Send,
  ChevronDown,
  CircleAlert,
  Clock,
  BedDouble,
  FileClock,
  Hospital,
} from "lucide-react";
import { useRef, useState, type Dispatch } from "react";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
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
  onSelectMovement: (movementId: string, action?: "refer" | "contact") => void;
  records?: {
    movements: readonly Movement[];
    patients: readonly Patient[];
    referrals: readonly Referral[];
    units: readonly Unit[];
  };
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
  records,
  withBackdrop = false,
}: WardTasksDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);
  useWardModalFocus(true, drawerRef, onClose);

  const [escalating, setEscalating] = useState<string | null>(null);
  const [contact, setContact] = useState("");
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

  const acknowledgedFactsCount = facts.filter((item) => acknowledgements[item.id]?.length).length;
  const unacknowledged = facts.filter((item) => !acknowledgements[item.id]?.length);
  const filteredItems = items.filter((item) => {
    if (taskFilter === "critical" && item.tone !== "danger") return false;
    if (taskFilter === "review" && item.tone === "danger") return false;
    const acknowledged = Boolean(acknowledgements[item.id]?.length);
    if (ackFilter === "unacknowledged" && (item.kind !== "fact" || acknowledged)) return false;
    if (ackFilter === "acknowledged" && (item.kind !== "fact" || !acknowledged)) return false;
    const completed = item.kind === "commitment" && inboxItemCompletionState(completions[item.id]) === "complete";
    if (ackFilter === "completed" && !completed) return false;
    if (ackFilter === "open" && completed) return false;
    return true;
  });
  const filteredFacts = filteredItems.filter((item) => item.kind === "fact");
  const filteredCommitments = filteredItems.filter((item) => item.kind === "commitment");
  const visibleUnacknowledged = filteredFacts.filter((item) => !acknowledgements[item.id]?.length);

  function renderMovementActions(item: InboxItem, movement?: Movement) {
    return (
      <>
        {movement && !movement.closure && movement.stage !== "arrived" ? (
          <>
            {!movement.acceptedUnitId ? (
              <button
                type="button"
                className={styles.btnMovement}
                onClick={() => onSelectMovement(item.movementId, "refer")}
              >
                <Send aria-hidden="true" />
                Refer
              </button>
            ) : null}
            <button
              type="button"
              className={styles.btnMovement}
              onClick={() => onSelectMovement(item.movementId, "contact")}
            >
              <Phone aria-hidden="true" />
              Contact
            </button>
            {role === "coordinator" ? (
              <button
                type="button"
                className={styles.btnMovement}
                aria-expanded={escalating === item.id}
                onClick={() => {
                  setEscalating(escalating === item.id ? null : item.id);
                  setContact(movement.escalation?.contact ?? "");
                }}
              >
                <CircleAlert aria-hidden="true" />
                Escalate
              </button>
            ) : null}
          </>
        ) : null}
        {escalating === item.id && movement ? (
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
              event.currentTarget.closest("li")?.querySelector<HTMLButtonElement>("button[aria-expanded]")?.focus();
              setEscalating(null);
              setContact("");
            }}
          >
            <label>
              Who did you escalate to?
              <input
                autoFocus
                required
                maxLength={160}
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder="Contact name or service"
              />
            </label>
            <p>Record an escalation you have made. This does not send a message.</p>
            <button type="submit" className={styles.btnAckFact} disabled={!contact.trim()}>
              Record escalation
            </button>
            <button
              type="button"
              className={styles.btnMovement}
              onClick={(event) => {
                event.currentTarget.closest("li")?.querySelector<HTMLButtonElement>("button[aria-expanded]")?.focus();
                setEscalating(null);
              }}
            >
              Cancel
            </button>
          </form>
        ) : null}
      </>
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
              <strong>{acknowledgedFactsCount}</strong>
              <span>Acknowledged</span>
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
            <div className={styles.selectWrap}>
              <select
                aria-label="Filter task state"
                value={ackFilter}
                onChange={(event) => setAckFilter(event.target.value)}
              >
                <option value="all">All task states</option>
                <option value="open">Open tasks</option>
                <option value="unacknowledged">Not yet acknowledged</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="completed">Completed</option>
              </select>
              <ChevronDown aria-hidden="true" />
            </div>
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
              <h3>{ackFilter === "completed" ? "No completed tasks" : "No matching tasks"}</h3>
              <p>
                {ackFilter === "completed"
                  ? "Completed commitments appear here. Standing facts remain open until the underlying issue is resolved."
                  : "Choose another status or clear the filters."}
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
              {/* SECTION 1: STATUTORY FACTS */}
              {filteredFacts.length > 0 ? (
                <div className={styles.taskSectionGroup} id="groupFacts">
                  <div className={styles.taskSectionHeader}>
                    <h3 className={styles.taskSectionTitle}>
                      <ShieldAlert aria-hidden="true" style={{ width: 13, height: 13 }} />
                      <span>Tasks requiring attention</span>
                    </h3>
                    <span className={styles.taskStripBadge} style={{ color: "var(--danger)", fontWeight: 700 }}>
                      {filteredFacts.length} recorded
                    </span>
                  </div>

                  <ul className={styles.taskStripList}>
                    {filteredFacts.map((item) => {
                      const ackHistory = acknowledgements[item.id] ?? [];
                      const latestAck = ackHistory.length > 0 ? ackHistory[ackHistory.length - 1] : undefined;
                      const movement = records?.movements.find((row) => row.id === item.movementId);
                      const patient = records ? resolveSubjectPatient(movement, records) : undefined;
                      const overdue = /due time passed|expired/i.test(item.title);
                      const Icon = /transport/i.test(item.title)
                        ? item.icon
                        : /legal/i.test(item.title)
                          ? FileClock
                          : /bed pull/i.test(item.title)
                            ? BedDouble
                            : /destination/i.test(item.title)
                              ? Hospital
                              : item.icon;

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
                                  <span className={styles.taskStripPatient}>
                                    {patient?.displayName ?? "Patient not linked"}
                                  </span>
                                </button>
                                <span
                                  className={`${styles.taskStripBadge} ${
                                    item.tone === "danger" ? styles.taskStripBadgeUrgent : styles.taskStripBadgeWarn
                                  }`}
                                >
                                  <CircleAlert aria-hidden="true" />
                                  {item.tone === "danger" ? (overdue ? "Past due" : "Critical") : "Review"}
                                </span>
                              </div>
                              <p className={styles.patientMeta}>
                                {patient?.patient ? `UMRN ${patient.umrn}` : "UMRN not recorded"}
                                {movement ? ` · ${edById(movement.originEdId)?.name ?? "Origin not recorded"}` : ""}
                              </p>
                              <p className={styles.taskTitle}>{item.title}</p>
                              <div className={styles.taskStripRow2}>
                                <span className={styles.taskStripSub}>
                                  {item.detail.replace(`${item.movementId} · `, "")}
                                </span>
                              </div>
                              {movement ? (
                                <p className={styles.patientMeta}>
                                  <Clock aria-hidden="true" />
                                  {stageCopy[movement.stage].label}
                                  {movement.escalation ? ` · Escalated to ${movement.escalation.contact}` : ""}
                                </p>
                              ) : null}
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
                              <ArrowUpRight aria-hidden="true" />
                              <span>Open patient</span>
                            </button>
                            {renderMovementActions(item, movement)}

                            {latestAck ? (
                              <span className={styles.ackStatus} data-testid={`ward-task-ack-${item.id}`}>
                                <UserCheck aria-hidden="true" style={{ width: 13, height: 13 }} />
                                Acknowledged · {formatInstantWithDay(latestAck.at, now)}
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
                      <span>Operational commitments</span>
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
                      const movement = records?.movements.find((row) => row.id === item.movementId);
                      const patient = records ? resolveSubjectPatient(movement, records) : undefined;

                      const Icon = /transport/i.test(item.title)
                        ? item.icon
                        : /legal/i.test(item.title)
                          ? FileClock
                          : /bed pull/i.test(item.title)
                            ? BedDouble
                            : /destination/i.test(item.title)
                              ? Hospital
                              : item.icon;

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
                                  <span className={styles.taskStripPatient}>
                                    {patient?.displayName ?? "Patient not linked"}
                                  </span>
                                </button>
                                <span className={styles.taskStripBadge}>
                                  {isComplete ? "Completed" : "Open commitment"}
                                </span>
                              </div>
                              <p className={styles.patientMeta}>
                                {patient?.patient ? `UMRN ${patient.umrn}` : "UMRN not recorded"}
                                {movement ? ` · ${edById(movement.originEdId)?.name ?? "Origin not recorded"}` : ""}
                              </p>
                              <p className={styles.taskTitle}>{item.title}</p>
                              <div className={styles.taskStripRow2}>
                                <span className={styles.taskStripSub}>
                                  {item.detail.replace(`${item.movementId} · `, "")}
                                </span>
                              </div>
                              {movement ? (
                                <p className={styles.patientMeta}>
                                  <Clock aria-hidden="true" />
                                  {stageCopy[movement.stage].label}
                                  {movement.escalation ? ` · Escalated to ${movement.escalation.contact}` : ""}
                                </p>
                              ) : null}
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
                              <ArrowUpRight aria-hidden="true" />
                              <span>Open patient</span>
                            </button>
                            {renderMovementActions(item, movement)}

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
