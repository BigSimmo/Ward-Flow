"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import type { Unit } from "@/components/ward-management/ward-model";
import styles from "./ward-decisions-cockpit.module.css";

export interface DepartureDecision {
  id: string;
  title: string;
  badge: "Ready" | "Blocked" | "Done";
  onConfirm?: () => void;
  onClear?: () => void;
}

export interface LeaveDecision {
  id: string;
  title: string;
}

export interface IntakeDecision {
  id: string;
  title: string;
  onAccept?: () => void;
}

export interface WardDecisionsCockpitProps {
  unit: Unit;
  demonstration?: boolean;
  rollupOverdue?: boolean;
  rollupConfirmed?: boolean;
  rollupTimeLabel?: string;
  plannedDischarges?: number;
  onConfirmRollup?: () => void;
  staffingFact?: string;
  intakes?: IntakeDecision[];
  departures?: DepartureDecision[];
  leaves?: LeaveDecision[];
  children?: ReactNode;
}

type QueueFilter = "all" | "due" | "barriers" | "leave";

function Stroke({ d, size = 14 }: { d: string | readonly string[]; size?: number }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      {paths.map((path) => (
        <path key={path} d={path} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

function Chip({ tone, children }: { tone: "good" | "danger" | "warn" | "accent" | "neutral"; children: ReactNode }) {
  return <span className={`${styles.chip} ${styles[tone]}`}>{children}</span>;
}

function jumpTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function onSummaryKey(event: KeyboardEvent<HTMLButtonElement>, id: string) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    jumpTo(id);
  }
}

export function WardDecisionsCockpit({
  unit,
  demonstration = false,
  rollupOverdue = false,
  rollupConfirmed = false,
  rollupTimeLabel = "09:30",
  plannedDischarges = 0,
  onConfirmRollup,
  staffingFact,
  intakes = [],
  departures = [],
  leaves = [],
  children,
}: WardDecisionsCockpitProps) {
  const live = demonstration || children != null || intakes.length > 0 || departures.length > 0 || leaves.length > 0;
  if (!live) {
    return (
      <section className={styles.container} aria-label="Ward decision controls">
        <h2>Decision cockpit</h2>
        <p>
          Not wired in this prototype. This illustrative cockpit does not record clinical decisions or send messages.
        </p>
        <p>Use the ward overview, arrival and discharge controls for supported record updates.</p>
      </section>
    );
  }

  return (
    <Queue
      unitName={unit.name}
      rollupOverdue={rollupOverdue}
      rollupConfirmed={rollupConfirmed}
      rollupTimeLabel={rollupTimeLabel}
      plannedDischarges={plannedDischarges}
      onConfirmRollup={onConfirmRollup}
      staffingFact={staffingFact}
      intakes={intakes}
      departures={departures}
      leaves={leaves}
      wired={children != null}
    >
      {children}
    </Queue>
  );
}

function Queue({
  unitName,
  rollupOverdue,
  rollupConfirmed,
  rollupTimeLabel,
  plannedDischarges,
  onConfirmRollup,
  staffingFact,
  intakes,
  departures,
  leaves,
  wired,
  children,
}: {
  unitName: string;
  rollupOverdue: boolean;
  rollupConfirmed: boolean;
  rollupTimeLabel: string;
  plannedDischarges: number;
  onConfirmRollup?: () => void;
  staffingFact?: string;
  intakes: IntakeDecision[];
  departures: DepartureDecision[];
  leaves: LeaveDecision[];
  wired: boolean;
  children?: ReactNode;
}) {
  const [filter, setFilter] = useState<QueueFilter>("all");
  const readyCount = departures.filter((row) => row.badge === "Ready").length;
  const blockedCount = departures.filter((row) => row.badge === "Blocked").length;
  const dueCount = intakes.length + readyCount + (rollupOverdue ? 1 : 0);
  const showStaffing = filter === "all" || (filter === "due" && (rollupOverdue || !rollupConfirmed));
  const showIntake = filter === "all" || filter === "due";
  const showDepartures = filter === "all" || filter === "due" || filter === "barriers";
  const visibleDepartures =
    filter === "barriers"
      ? departures.filter((row) => row.badge === "Blocked")
      : filter === "due"
        ? departures.filter((row) => row.badge === "Ready" || row.badge === "Blocked")
        : departures;
  const showLeave = filter === "all" || filter === "leave";
  const staffingBadge = rollupOverdue ? "Due" : "Done";
  const intakeBadge = intakes.length > 0 ? "Due" : "Done";
  const departureBadge = blockedCount > 0 ? "Blocked" : readyCount > 0 ? "Ready" : "Done";
  const leaveBadge = leaves.length > 0 ? String(leaves.length) : "Done";

  return (
    <div className={styles.container}>
      <div className={styles.summaryGrid}>
        <button
          type="button"
          className={styles.summary}
          aria-label="Staffing, 07:00–09:30"
          onClick={() => jumpTo("gate-staffing")}
          onKeyDown={(event) => onSummaryKey(event, "gate-staffing")}
        >
          <span className={styles.summaryTitle}>
            <Stroke d="M3 13V8M8 13V3M13 13V6" />
            Staffing
          </span>
          <span className={styles.summaryWindow}>07:00–09:30</span>
          <Chip tone={rollupOverdue ? "danger" : "good"}>{staffingBadge}</Chip>
          <span className={styles.summaryFact}>{staffingFact ?? `${unitName}`}</span>
        </button>
        <button
          type="button"
          className={styles.summary}
          aria-label="Intake, 09:30–13:00"
          onClick={() => jumpTo("gate-intake")}
          onKeyDown={(event) => onSummaryKey(event, "gate-intake")}
        >
          <span className={styles.summaryTitle}>
            <Stroke d="M3 8h10M9 4l4 4-4 4" />
            Intake
          </span>
          <span className={styles.summaryWindow}>09:30–13:00</span>
          <Chip tone={intakes.length > 0 ? "danger" : "good"}>{intakeBadge}</Chip>
          <span className={styles.summaryFact}>{intakes[0]?.title ?? "None waiting"}</span>
        </button>
        <button
          type="button"
          className={styles.summary}
          aria-label="Departures, 11:00–14:00"
          onClick={() => jumpTo("gate-departures")}
          onKeyDown={(event) => onSummaryKey(event, "gate-departures")}
        >
          <span className={styles.summaryTitle}>
            <Stroke d="M13 8H3M7 4L3 8l4 4" />
            Departures
          </span>
          <span className={styles.summaryWindow}>11:00–14:00</span>
          <Chip tone={blockedCount > 0 ? "warn" : readyCount > 0 ? "good" : "neutral"}>{departureBadge}</Chip>
          <span className={styles.summaryFact}>{departures[0]?.title ?? "None waiting"}</span>
        </button>
        <button
          type="button"
          className={styles.summary}
          aria-label="Leave, 14:00–18:00"
          onClick={() => jumpTo("gate-leave")}
          onKeyDown={(event) => onSummaryKey(event, "gate-leave")}
        >
          <span className={styles.summaryTitle}>
            <Stroke d="M8 2v4M8 14v-4M3 8h10" />
            Leave
          </span>
          <span className={styles.summaryWindow}>14:00–18:00</span>
          <Chip tone={leaves.length > 0 ? "accent" : "good"}>{leaveBadge}</Chip>
          <span className={styles.summaryFact}>{leaves[0]?.title ?? "None out"}</span>
        </button>
      </div>

      <div className={styles.queueBar}>
        <h2 className={styles.queueTitle}>
          Decisions
          {dueCount > 0 ? <Chip tone="danger">{dueCount} due</Chip> : <Chip tone="good">Done</Chip>}
        </h2>
        <div className={styles.filters} role="toolbar" aria-label="Decision filters">
          {(
            [
              ["all", "All", "M3 3h4.2v4.2H3zM8.8 3H13v4.2H8.8zM3 8.8h4.2V13H3zM8.8 8.8H13V13H8.8z"],
              ["due", "Due now", "M8 2.4a5.6 5.6 0 1 0 0 11.2 5.6 5.6 0 0 0 0-11.2zM8 4.6V8l2.3 1.4"],
              ["barriers", "Barriers", "M3.5 4.5h9M3.5 8h9M3.5 11.5h5.5"],
              ["leave", "Leave", "M8 3v10M3 8h10"],
            ] as const
          ).map(([key, label, icon]) => (
            <button
              key={key}
              type="button"
              className={styles.filter}
              data-active={filter === key}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              <Stroke d={icon} size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.board}>
        {showStaffing || showIntake || showLeave ? (
          <div className={styles.stack}>
            {showStaffing ? (
              <section className={styles.panel} id="gate-staffing" aria-label="Staffing">
                <header className={styles.panelHead}>
                  <h3 className={styles.panelTitle}>Staffing</h3>
                  <span className={styles.panelWindow}>07:00–09:30</span>
                  <Chip tone={rollupOverdue ? "danger" : "good"}>{staffingBadge}</Chip>
                </header>
                <div className={styles.panelBody}>
                  {rollupOverdue ? (
                    <div className={styles.row} data-testid="ward-morning-rollup-overdue-banner">
                      <span className={styles.rowTitle}>{rollupTimeLabel} Morning Bed Rollup Overdue</span>
                      <button
                        type="button"
                        className={styles.action}
                        data-testid="ward-confirm-morning-rollup-btn"
                        onClick={onConfirmRollup}
                      >
                        Confirm rollup
                      </button>
                    </div>
                  ) : null}
                  {rollupConfirmed ? (
                    <div className={styles.row} data-testid="ward-morning-rollup-confirmed-banner">
                      <span className={styles.rowTitle}>
                        {rollupTimeLabel} Morning Bed Rollup Confirmed · {plannedDischarges} discharges scheduled today
                      </span>
                      <Chip tone="good">Done</Chip>
                    </div>
                  ) : null}
                  {children}
                  {!wired && !onConfirmRollup ? <p className={styles.empty}>Not wired in this prototype.</p> : null}
                </div>
              </section>
            ) : null}

            {showIntake ? (
              <section className={styles.panel} id="gate-intake" aria-label="Intake">
                <header className={styles.panelHead}>
                  <h3 className={styles.panelTitle}>Intake</h3>
                  <span className={styles.panelWindow}>09:30–13:00</span>
                  <Chip tone={intakes.length > 0 ? "danger" : "good"}>{intakeBadge}</Chip>
                </header>
                <div className={styles.panelBody}>
                  {intakes.length === 0 ? (
                    <p className={styles.empty}>None waiting</p>
                  ) : (
                    intakes.map((row) => (
                      <div className={styles.row} key={row.id}>
                        <span className={styles.rowTitle}>{row.title}</span>
                        <Chip tone="danger">Due</Chip>
                        {row.onAccept ? (
                          <button type="button" className={styles.action} onClick={row.onAccept}>
                            Accept
                          </button>
                        ) : (
                          <span className={styles.empty}>Not wired in this prototype.</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>
            ) : null}

            {showLeave ? (
              <section className={styles.panel} id="gate-leave" aria-label="Leave">
                <header className={styles.panelHead}>
                  <h3 className={styles.panelTitle}>Leave</h3>
                  <span className={styles.panelWindow}>14:00–18:00</span>
                  <Chip tone={leaves.length > 0 ? "accent" : "good"}>{leaveBadge}</Chip>
                </header>
                <div className={styles.panelBody}>
                  {leaves.length === 0 ? (
                    <p className={styles.empty}>None out</p>
                  ) : (
                    leaves.map((row) => (
                      <div className={styles.row} key={row.id}>
                        <span className={styles.rowTitle}>{row.title}</span>
                        <Chip tone="accent">Out</Chip>
                      </div>
                    ))
                  )}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}

        {showDepartures ? (
          <div className={styles.stack}>
            <section className={styles.panel} id="gate-departures" aria-label="Departures">
              <header className={styles.panelHead}>
                <h3 className={styles.panelTitle}>Departures</h3>
                <span className={styles.panelWindow}>11:00–14:00</span>
                <Chip tone={blockedCount > 0 ? "warn" : readyCount > 0 ? "good" : "neutral"}>{departureBadge}</Chip>
              </header>
              <div className={styles.panelBody}>
                {visibleDepartures.length === 0 ? (
                  <p className={styles.empty}>None waiting</p>
                ) : (
                  visibleDepartures.map((row) => (
                    <div className={styles.row} key={row.id}>
                      <span className={styles.rowTitle}>{row.title}</span>
                      <Chip tone={row.badge === "Blocked" ? "warn" : row.badge === "Ready" ? "good" : "neutral"}>
                        {row.badge}
                      </Chip>
                      {row.onConfirm ? (
                        <button type="button" className={styles.action} onClick={row.onConfirm}>
                          Sign off
                        </button>
                      ) : null}
                      {row.onClear ? (
                        <button type="button" className={styles.actionQuiet} onClick={row.onClear}>
                          Clear
                        </button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
