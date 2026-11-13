"use client";

import { History, ListChecks } from "lucide-react";
import { Button, Card, CardHead, Meter, StatusGlyph } from "@/components/wf";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import type { NextStep, StayProgress } from "./patient-now-ward";
import { dischargeReadiness, recentStayEvents } from "./patient-now-ward-recent";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Patient } from "@/components/ward-management/ward-patients";
import styles from "./patient-now-ward-cards.module.css";
import { PatientNextStepButton } from "./patient-now-ward-button";
import type { RoleLimit } from "@/components/ward-management/ward-role-gate";

/**
 * Next step first (Josh, 3 Nov 2026): one card leading Now with the single thing due and one button.
 * On a phone the pinned bar already carries the same action as the page's one filled button, so the
 * card's button is the quiet secondary there (`quiet`).
 */
export function PatientNextStepCard({
  step,
  quiet = false,
  roleLimit,
}: {
  step: NextStep;
  quiet?: boolean;
  roleLimit?: RoleLimit;
}) {
  return (
    <Card
      className={styles.next}
      data-testid="ward-patient-next-step"
      data-in-bar={quiet || undefined}
      aria-labelledby="pn-next-step"
    >
      <div className={styles.nextBody}>
        <span className={styles.eyebrow}>Next step</span>
        <h2 id="pn-next-step" className={styles.nextTitle}>
          <StatusGlyph tone={step.tone} size={12} />
          <span>{step.title}</span>
        </h2>
        <p className={styles.nextDetail}>{step.detail}</p>
      </div>
      {/* F-54 (A9-35): no empty button slot when this desk can never take the step. */}
      {step.action && !(step.action.event && roleLimit?.(step.action.event) === null) ? (
        <div className={styles.nextAction}>
          <PatientNextStepButton
            action={step.action}
            primary={!quiet}
            roleLimit={roleLimit}
            testId="ward-patient-next-step-action"
          />
        </div>
      ) : null}
    </Card>
  );
}

/** Stay progress: "Day 7 of a planned 10" with a slim bar, and past the date said in words. */
export function PatientStayProgress({ progress }: { progress: StayProgress }) {
  return (
    <div className={styles.progress} data-testid="ward-patient-stay-progress">
      <div className={styles.progressLine}>
        <strong className={styles.progressHead}>{progress.headline}</strong>
        <span className={styles.progressNote} data-past={progress.past || undefined}>
          {progress.note}
        </span>
      </div>
      {progress.planned !== null ? (
        <Meter
          value={Math.min(progress.day, progress.planned)}
          max={progress.planned}
          fill={progress.past ? "warning" : "info"}
          label={`${progress.headline}. ${progress.note}`}
          valueText={null}
        />
      ) : null}
    </div>
  );
}

/** Discharge readiness: recorded facts as ticks, never a score. */
export function PatientDischargeReadiness({
  admission,
  patient,
  dayZero,
}: {
  admission: Admission;
  patient: Patient | undefined;
  dayZero: Date;
}) {
  const rows = dischargeReadiness(admission, patient, dayZero);
  return (
    <Card data-testid="ward-patient-discharge-readiness">
      <CardHead level={2} icon={ListChecks} title="Discharge readiness" meta="As recorded" />
      <ul className={styles.list} aria-label="Discharge readiness">
        {rows.map((row) => (
          <li key={row.key} className={styles.item} data-testid={`ward-patient-ready-${row.key}`} data-done={row.done}>
            <StatusGlyph tone={row.done ? "success" : "neutral"} size={12} />
            <span className={styles.itemText}>
              <strong>{row.label}</strong>
              <span>{row.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Recent changes since this time yesterday: the newest recorded events for this stay, newest first, with Full history. */
export function PatientLastDay({
  input,
  onOpenHistory,
}: {
  input: Parameters<typeof recentStayEvents>[0];
  onOpenHistory: () => void;
}) {
  const events = recentStayEvents(input);
  return (
    <Card data-testid="ward-patient-last-day">
      <CardHead
        level={2}
        icon={History}
        title="Recent changes"
        action={
          <Button size="sm" variant="ghost" onClick={onOpenHistory} data-testid="ward-patient-last-day-history">
            Full history
          </Button>
        }
      />
      {events.length > 0 ? (
        <ol className={styles.list} aria-label="Recorded since this time yesterday">
          {events.map((event) => (
            <li key={event.key} className={styles.event}>
              <time className={styles.time}>{formatInstantWithDay(event.at, input.now)}</time>
              <span>{event.text}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.empty}>Nothing recorded since this time yesterday</p>
      )}
    </Card>
  );
}
