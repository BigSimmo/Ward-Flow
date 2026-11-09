"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { Button, buttonClass, Card, CardBody, CardHead } from "@/components/wf";

import type { Admission } from "../ward-admissions";
import { onWardSessionEnd } from "../ward-browser-data";
import { formatInstantWithDay, type Instant } from "../ward-clock";
import type { Movement, Unit } from "../ward-model";
import { HEALTH_SERVICES, type HealthService } from "../ward-model-vocabulary";
import { healthServiceAcronym, movementBelongsToService, unitHealthService } from "../ward-service-scope";
import { bedMeetingActionLabel, type BedMeetingAction } from "./bed-meeting-actions";
import styles from "./bed-meeting-run.module.css";

/**
 * RUN MEETING (six features build, Josh 9 Nov 2026). Builds on the agenda, it does not replace it:
 * the chair steps through the health services one at a time with the agenda's own lists and its own
 * Action control, then ends on one summary of what this meeting recorded, ready to print.
 *
 * Nothing new is stored. The meeting's start time and step are a view choice kept for this browser
 * tab only (never typed text); the summary reads the actions already kept on each record.
 */
const RUN_KEY = "ward-flow:bed-meeting-run";

export type MeetingRun = { startedAt: Instant; step: number; finished: boolean; finishedAt?: Instant };

// The tab's copy of the run. Session storage keeps it across a reload; this copy covers a blocked store.
let memoryRun: string | null = null;
const runListeners = new Set<() => void>();

// Signing out ends the meeting, so the next person in this tab never inherits it.
onWardSessionEnd(() => {
  memoryRun = null;
  try {
    window.sessionStorage.removeItem(RUN_KEY);
  } catch {
    // Nothing stored to clear.
  }
  runListeners.forEach((listener) => listener());
});

function readRun(): string | null {
  try {
    return window.sessionStorage.getItem(RUN_KEY) ?? memoryRun;
  } catch {
    return memoryRun;
  }
}

function subscribeRun(listener: () => void) {
  runListeners.add(listener);
  return () => runListeners.delete(listener);
}

function parseRun(raw: string | null): MeetingRun | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<MeetingRun>;
    return typeof value.startedAt === "number" && typeof value.step === "number"
      ? {
          startedAt: value.startedAt,
          step: value.step,
          finished: value.finished === true,
          ...(typeof value.finishedAt === "number" ? { finishedAt: value.finishedAt } : {}),
        }
      : null;
  } catch {
    return null;
  }
}

export function useMeetingRun(): [MeetingRun | null, (next: MeetingRun | null) => void] {
  const raw = useSyncExternalStore(subscribeRun, readRun, () => null);
  const run = useMemo(() => parseRun(raw), [raw]);
  const update = useCallback((next: MeetingRun | null) => {
    memoryRun = next ? JSON.stringify(next) : null;
    try {
      if (memoryRun) window.sessionStorage.setItem(RUN_KEY, memoryRun);
      else window.sessionStorage.removeItem(RUN_KEY);
    } catch {
      // A blocked store keeps the run for this page view only.
    }
    runListeners.forEach((listener) => listener());
  }, []);
  return [run, update];
}

export const MEETING_STEPS: readonly HealthService[] = HEALTH_SERVICES;

/** Put on the page while the summary is open, so print carries the summary alone. */
export const MEETING_SUMMARY_PAGE_CLASS = styles.summaryPage;

export type RecordedInMeeting = {
  id: string;
  name: string;
  service: string;
  action: string;
  owner: string;
  due: string;
  done: boolean;
};

/** Every action recorded between the meeting's start and its finish (when finished), in service order, then by time recorded. */
export function actionsRecordedSince(input: {
  startedAt: Instant;
  /** The meeting's finish time: actions recorded after it belong to later work, not this meeting. */
  until?: Instant;
  now: Instant;
  movements: readonly Movement[];
  admissions: readonly Admission[];
  units: readonly Unit[];
  nameOf: (record: Movement | Admission) => string;
  ownerText: (action: BedMeetingAction) => string;
}): RecordedInMeeting[] {
  const { startedAt, until, now, movements, admissions, units, nameOf, ownerText } = input;
  const serviceOfUnit = new Map(units.map((unit) => [unit.id, unitHealthService(unit)]));
  const serviceOfMovement = (movement: Movement) =>
    HEALTH_SERVICES.find((service) => movementBelongsToService(movement, service, [...units]));
  const rows: (RecordedInMeeting & { order: number; at: Instant })[] = [];
  const add = (record: Movement | Admission, service: string | undefined) => {
    for (const action of record.meetingActions ?? []) {
      if (action.recordedAt < startedAt || (until !== undefined && action.recordedAt > until)) continue;
      const known = service ?? "Service not recorded";
      rows.push({
        id: `${record.id}-${action.kind}-${action.recordedAt}`,
        name: nameOf(record),
        service: known,
        action: bedMeetingActionLabel(action.kind),
        owner: ownerText(action),
        due: formatInstantWithDay(action.dueAt, now),
        done: action.doneAt !== undefined,
        order: service ? HEALTH_SERVICES.indexOf(service as HealthService) : HEALTH_SERVICES.length,
        at: action.recordedAt,
      });
    }
  };
  for (const movement of movements) add(movement, serviceOfMovement(movement));
  for (const admission of admissions) add(admission, serviceOfUnit.get(admission.unitId));
  return rows
    .sort((a, b) => a.order - b.order || a.at - b.at || a.id.localeCompare(b.id))
    .map((row) => ({
      id: row.id,
      name: row.name,
      service: row.service,
      action: row.action,
      owner: row.owner,
      due: row.due,
      done: row.done,
    }));
}

/** The meeting's controls in the hero, where the agenda's own buttons sit: Previous, Next or Finish, and Stop. */
export function MeetingRunControls({
  step,
  pillClassName,
  onStep,
  onFinish,
  onStop,
}: {
  step: number;
  pillClassName?: string;
  onStep: (step: number) => void;
  onFinish: () => void;
  onStop: () => void;
}) {
  const last = MEETING_STEPS.length - 1;
  const pill = (variant: "onHero" | "light") =>
    [buttonClass({ variant, size: "sm" }), pillClassName].filter(Boolean).join(" ");
  return (
    <>
      <button type="button" className={pill("onHero")} onClick={onStop} data-testid="bed-meeting-run-stop">
        Stop
      </button>
      {step > 0 ? (
        <button type="button" className={pill("onHero")} onClick={() => onStep(step - 1)}>
          Previous
        </button>
      ) : null}
      {step < last ? (
        <button
          type="button"
          className={pill("light")}
          onClick={() => onStep(step + 1)}
          data-testid="bed-meeting-run-next"
          data-primary="true"
        >
          Next: {healthServiceAcronym(MEETING_STEPS[step + 1])}
        </button>
      ) : (
        <button
          type="button"
          className={pill("light")}
          onClick={onFinish}
          data-testid="bed-meeting-run-finish"
          data-primary="true"
        >
          Finish meeting
        </button>
      )}
    </>
  );
}

/** The end of the meeting: what it recorded, by service, with Print. */
export function MeetingSummary({
  run,
  now,
  rows,
  onBack,
  onClose,
}: {
  run: MeetingRun;
  now: Instant;
  rows: readonly RecordedInMeeting[];
  onBack: () => void;
  onClose: () => void;
}) {
  const services = [...new Set(rows.map((row) => row.service))];
  return (
    <Card className={styles.summary} data-testid="bed-meeting-run-summary">
      <CardHead
        title="Meeting summary"
        meta={`Started ${formatInstantWithDay(run.startedAt, now)} · ${rows.length} ${rows.length === 1 ? "action" : "actions"}`}
        level={2}
      />
      <CardBody>
        {rows.length === 0 ? (
          <p className={styles.empty}>No actions were recorded in this meeting.</p>
        ) : (
          services.map((service) => (
            <div key={service} className={styles.group}>
              <h3 className={styles.groupTitle}>{service}</h3>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Person</th>
                    <th scope="col">Action</th>
                    <th scope="col">Owner</th>
                    <th scope="col" className={styles.right}>
                      Due
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .filter((row) => row.service === service)
                    .map((row) => (
                      <tr key={row.id}>
                        <td className={styles.person}>{row.name}</td>
                        <td>
                          {row.action}
                          {row.done ? <span className={styles.doneTag}>Done</span> : null}
                        </td>
                        <td>{row.owner}</td>
                        <td className={`${styles.right} ${styles.figure}`}>{row.due}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))
        )}
        <p className={styles.printMark}>Synthetic prototype, not for clinical use</p>
        <div className={styles.summaryActions}>
          <Button size="sm" variant="ghost" onClick={onBack}>
            Back to the meeting
          </Button>
          <span className={styles.spacer} />
          <Button size="sm" variant="sec" onClick={onClose}>
            Close meeting
          </Button>
          <Button size="sm" variant="pri" onClick={() => window.print()} data-testid="bed-meeting-run-print">
            Print summary
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
