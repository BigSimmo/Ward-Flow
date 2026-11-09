"use client";

import { useEffect, useState } from "react";

import { Button, Card, CardBody, CardHead } from "@/components/wf";

import type { Admission } from "../ward-admissions";
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

export type MeetingRun = { startedAt: Instant; step: number; finished: boolean };

export function useMeetingRun(): [MeetingRun | null, (next: MeetingRun | null) => void] {
  const [run, setRun] = useState<MeetingRun | null>(null);
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(RUN_KEY);
      if (saved) setRun(JSON.parse(saved) as MeetingRun);
    } catch {
      // A blocked store only means the run starts again after a reload.
    }
  }, []);
  const update = (next: MeetingRun | null) => {
    setRun(next);
    try {
      if (next) window.sessionStorage.setItem(RUN_KEY, JSON.stringify(next));
      else window.sessionStorage.removeItem(RUN_KEY);
    } catch {
      // As above.
    }
  };
  return [run, update];
}

export const MEETING_STEPS: readonly HealthService[] = HEALTH_SERVICES;

export type RecordedInMeeting = {
  id: string;
  name: string;
  service: string;
  action: string;
  owner: string;
  due: string;
  done: boolean;
};

/** Every action recorded since the meeting started, in service order, then by time recorded. */
export function actionsRecordedSince(input: {
  startedAt: Instant;
  now: Instant;
  movements: readonly Movement[];
  admissions: readonly Admission[];
  units: readonly Unit[];
  nameOf: (record: Movement | Admission) => string;
  ownerText: (action: BedMeetingAction) => string;
}): RecordedInMeeting[] {
  const { startedAt, now, movements, admissions, units, nameOf, ownerText } = input;
  const serviceOfUnit = new Map(units.map((unit) => [unit.id, unitHealthService(unit)]));
  const serviceOfMovement = (movement: Movement) =>
    HEALTH_SERVICES.find((service) => movementBelongsToService(movement, service, [...units]));
  const rows: (RecordedInMeeting & { order: number; at: Instant })[] = [];
  const add = (record: Movement | Admission, service: string | undefined) => {
    for (const action of record.meetingActions ?? []) {
      if (action.recordedAt < startedAt) continue;
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
    .map(({ order: _order, at: _at, ...row }) => row);
}

/** The slim bar that steps the meeting through the services, shown under the agenda's filters. */
export function MeetingRunBar({
  run,
  recorded,
  itemsFor,
  onStep,
  onFinish,
  onStop,
}: {
  run: MeetingRun;
  recorded: number;
  /** How many agenda items a service has, so the chair can see what is ahead. */
  itemsFor: (service: HealthService) => number;
  onStep: (step: number) => void;
  onFinish: () => void;
  onStop: () => void;
}) {
  const last = MEETING_STEPS.length - 1;
  const current = MEETING_STEPS[run.step] ?? MEETING_STEPS[0];
  return (
    <section className={styles.bar} aria-label="Meeting in progress" data-testid="bed-meeting-run-bar">
      <div className={styles.barHead}>
        <span className={styles.live} aria-hidden="true" />
        <span className={styles.barTitle}>
          Meeting running · {current}
          <span className={styles.barMeta}>
            {" "}
            · <span className={styles.figure}>{run.step + 1}</span> of{" "}
            <span className={styles.figure}>{MEETING_STEPS.length}</span> ·{" "}
            <span className={styles.figure}>{recorded}</span> {recorded === 1 ? "action" : "actions"} recorded
          </span>
        </span>
        <div className={styles.barActions}>
          <Button size="sm" variant="ghost" onClick={onStop}>
            Stop
          </Button>
          <Button size="sm" variant="sec" disabled={run.step === 0} onClick={() => onStep(run.step - 1)}>
            Previous
          </Button>
          {run.step < last ? (
            <Button size="sm" variant="pri" onClick={() => onStep(run.step + 1)} data-testid="bed-meeting-run-next">
              Next: {healthServiceAcronym(MEETING_STEPS[run.step + 1])}
            </Button>
          ) : (
            <Button size="sm" variant="pri" onClick={onFinish} data-testid="bed-meeting-run-finish">
              Finish meeting
            </Button>
          )}
        </div>
      </div>
      <ol className={styles.steps} aria-label="Services in this meeting">
        {MEETING_STEPS.map((service, index) => {
          const count = itemsFor(service);
          return (
            <li key={service}>
              <button
                type="button"
                className={styles.step}
                aria-current={index === run.step ? "step" : undefined}
                data-done={index < run.step ? "true" : undefined}
                onClick={() => onStep(index)}
              >
                <span>{healthServiceAcronym(service)}</span>
                <span className={styles.stepCount}>{count}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
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
    <Card className={styles.summary} data-testid="bed-meeting-run-summary" data-print-only-summary="true">
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
