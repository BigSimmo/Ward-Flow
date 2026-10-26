"use client";

import { useState } from "react";
import { Button } from "@/components/wf";
import { dayOf, formatInstantWithDay, minuteOfDay, type Instant } from "@/components/ward-management/ward-clock";
import { instantFromEstimatedTimeInputs } from "@/components/ward-management/ward-transport-checks";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import {
  INTERMITTENT_INTERVAL_MINUTES,
  OBSERVATION_LEVELS,
  observationLevelName,
  observationRatio,
  observationSummary,
  type Observation,
  type ObservationLevel,
} from "@/components/ward-management/ward-observation";
import styles from "./ward-bed-dossier-drawer.module.css";
import { useHoldOpenForm } from "@/components/ward-management/use-hold-open-form";

/** "Constant within sight (1:1)" for the picker; General and Intermittent show their name alone. */
function levelOptionLabel(level: ObservationLevel): string {
  const ratio = observationRatio(level);
  return ratio ? `${observationLevelName(level)} (${ratio})` : observationLevelName(level);
}

/** The recorded review time as the time box shows it, when it falls today or tomorrow; otherwise blank. */
function reviewInputs(reviewAt: Instant | null, now: Instant): { time: string; day: "today" | "tomorrow" } {
  const offset = reviewAt === null ? -1 : dayOf(reviewAt) - dayOf(now);
  if (reviewAt === null || (offset !== 0 && offset !== 1)) return { time: "", day: "today" };
  const minutes = minuteOfDay(reviewAt);
  const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return { time, day: offset === 1 ? "tomorrow" : "today" };
}

/** The level as the drawer row reads it: "Intermittent, every 15 minutes. Review 14:00". */
export function observationWithReview(observation: Observation, now: Instant): string {
  const summary = observationSummary(observation);
  return observation.reviewAt === null
    ? summary
    : `${summary}. Review ${formatInstantWithDay(observation.reviewAt, now)}`;
}

/**
 * Fix plan item 10: the bed drawer's observation level, and the one place a ward changes it. The
 * change is a recorded `RECORD_OBSERVATION_LEVEL` event, never a local edit. The review time is
 * typed as a clock time today or tomorrow, the same rule as every other time box on the site, and
 * left blank means none recorded. Nothing here suggests a level.
 */
export function WardObservationControl({
  observation,
  now,
  editingToken,
  onSave,
  showCurrent = true,
}: {
  observation: Observation;
  now: Instant;
  /** The record's `observationEditingToken` now; the one seen on opening goes with the save. */
  editingToken?: string;
  /** Absent for a desk that may not change it: the level is shown and nothing more. */
  onSave?: (next: Observation, expected?: string) => ReturnType<WardCommandDispatch>;
  /** False where a row above already states the level, as in the bed drawer. */
  showCurrent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Audit CS3-01: an open observation form is checked against the board it opened on.
  useHoldOpenForm(open);
  const [level, setLevel] = useState<ObservationLevel>(observation.level);
  const [interval, setIntervalMinutes] = useState<number>(
    observation.intervalMinutes ?? INTERMITTENT_INTERVAL_MINUTES[0],
  );
  const [reviewTime, setReviewTime] = useState("");
  const [reviewDay, setReviewDay] = useState<"today" | "tomorrow">("today");
  const [reviewEdited, setReviewEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A colleague's change made while this is open is refused by the server, not overwritten.
  const [openedToken, setOpenedToken] = useState<string>();
  // Audit 24-3 SV-4: the control stays open with its choices until the level is accepted.
  const recording = useWardFormSave("observation");

  function save() {
    // An untouched review box keeps the recorded review time exactly, even one outside today or tomorrow.
    let reviewAt: Instant | null = reviewEdited ? null : observation.reviewAt;
    if (reviewEdited && reviewTime.trim() !== "") {
      const typed = instantFromEstimatedTimeInputs(reviewTime, reviewDay, now);
      if (typed === undefined) {
        setError("Type the review time as a clock time, for example 14:30.");
        return;
      }
      reviewAt = typed;
    }
    setError(null);
    const next = { level, intervalMinutes: level === "intermittent" ? interval : null, reviewAt };
    if (onSave)
      recording.submit(
        () => onSave(next, openedToken),
        () => setOpen(false),
      );
  }

  // In the bed drawer the row above already states the level and its review time, so a desk that
  // may not change it sees nothing more here.
  if (!onSave && !showCurrent) return null;

  return (
    <div className={styles.cardInner} data-testid="ward-observation-control">
      {showCurrent ? (
        <p className={styles.meta} data-testid="ward-observation-current">
          {observationWithReview(observation, now)}
        </p>
      ) : null}
      {!onSave ? null : !open ? (
        <Button
          variant="sec"
          className={styles.pill}
          data-testid="ward-observation-change"
          onClick={() => {
            const review = reviewInputs(observation.reviewAt, now);
            setLevel(observation.level);
            setIntervalMinutes(observation.intervalMinutes ?? INTERMITTENT_INTERVAL_MINUTES[0]);
            setReviewTime(review.time);
            setReviewDay(review.day);
            setReviewEdited(false);
            setError(null);
            recording.forget();
            setOpenedToken(editingToken);
            setOpen(true);
          }}
        >
          Change observation level
        </Button>
      ) : (
        <>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Observation level</span>
            <select
              className={styles.select}
              data-testid="ward-observation-level"
              value={level}
              onChange={(event) => setLevel(event.target.value as ObservationLevel)}
            >
              {OBSERVATION_LEVELS.map((option) => (
                <option key={option} value={option}>
                  {levelOptionLabel(option)}
                </option>
              ))}
            </select>
          </label>
          {level === "intermittent" ? (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Check every</span>
              <select
                className={styles.select}
                data-testid="ward-observation-interval"
                value={interval}
                onChange={(event) => setIntervalMinutes(Number(event.target.value))}
              >
                {INTERMITTENT_INTERVAL_MINUTES.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Next review (optional)</span>
              <input
                className={styles.select}
                data-testid="ward-observation-review-time"
                inputMode="numeric"
                placeholder="For example 14:30"
                value={reviewTime}
                onChange={(event) => {
                  setReviewTime(event.target.value);
                  setReviewEdited(true);
                }}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Day</span>
              <select
                className={styles.select}
                value={reviewDay}
                onChange={(event) => {
                  setReviewDay(event.target.value as "today" | "tomorrow");
                  setReviewEdited(true);
                }}
              >
                <option value="today">Today</option>
                <option value="tomorrow">Tomorrow</option>
              </select>
            </label>
          </div>
          {error || recording.error ? (
            <p className={styles.meta} role="alert" data-testid="ward-observation-error">
              {error ?? recording.error}
            </p>
          ) : recording.pending ? (
            <p className={styles.meta} role="status">
              Saving…
            </p>
          ) : null}
          <div className={`${styles.editor} ${styles.editorFlush}`}>
            <Button
              variant="pri"
              className={styles.pill}
              data-testid="ward-observation-save"
              aria-disabled={recording.pending ? "true" : undefined}
              onClick={save}
            >
              Record level
            </Button>
            <Button
              variant="sec"
              className={styles.pill}
              onClick={() => {
                recording.forget();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
