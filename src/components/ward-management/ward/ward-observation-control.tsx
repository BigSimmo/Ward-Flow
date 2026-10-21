"use client";

import { useState } from "react";
import { Button } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { instantFromEstimatedTimeInputs } from "@/components/ward-management/ward-transport-checks";
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

/** "Constant within sight (1:1)" for the picker; General and Intermittent show their name alone. */
function levelOptionLabel(level: ObservationLevel): string {
  const ratio = observationRatio(level);
  return ratio ? `${observationLevelName(level)} (${ratio})` : observationLevelName(level);
}

/** The level as the drawer reads it: "Intermittent, every 15 minutes. Review 14:00". */
export function observationWithReview(observation: Observation, now: Instant): string {
  const summary = observationSummary(observation);
  return observation.reviewAt === null
    ? `${summary}. No review time recorded`
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
  onSave,
}: {
  observation: Observation;
  now: Instant;
  /** Absent for a desk that may not change it: the level is shown and nothing more. */
  onSave?: (next: Observation) => void;
}) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<ObservationLevel>(observation.level);
  const [interval, setIntervalMinutes] = useState<number>(
    observation.intervalMinutes ?? INTERMITTENT_INTERVAL_MINUTES[0],
  );
  const [reviewTime, setReviewTime] = useState("");
  const [reviewDay, setReviewDay] = useState<"today" | "tomorrow">("today");
  const [error, setError] = useState<string | null>(null);

  function save() {
    let reviewAt: Instant | null = null;
    if (reviewTime.trim() !== "") {
      const typed = instantFromEstimatedTimeInputs(reviewTime, reviewDay, now);
      if (typed === undefined) {
        setError("Type the review time as a clock time, for example 14:30.");
        return;
      }
      reviewAt = typed;
    }
    setError(null);
    onSave?.({ level, intervalMinutes: level === "intermittent" ? interval : null, reviewAt });
    setOpen(false);
  }

  return (
    <div className={styles.cardInner} data-testid="ward-observation-control">
      <p className={styles.meta} data-testid="ward-observation-current">
        {observationWithReview(observation, now)}
      </p>
      {onSave && !open ? (
        <Button
          variant="sec"
          className={styles.pill}
          data-testid="ward-observation-change"
          onClick={() => {
            setLevel(observation.level);
            setReviewTime("");
            setOpen(true);
          }}
        >
          Change observation level
        </Button>
      ) : null}
      {onSave && open ? (
        <>
          <select
            className={styles.select}
            aria-label="Observation level"
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
          {level === "intermittent" ? (
            <select
              className={styles.select}
              aria-label="Check every"
              data-testid="ward-observation-interval"
              value={interval}
              onChange={(event) => setIntervalMinutes(Number(event.target.value))}
            >
              {INTERMITTENT_INTERVAL_MINUTES.map((minutes) => (
                <option key={minutes} value={minutes}>
                  Every {minutes} minutes
                </option>
              ))}
            </select>
          ) : null}
          <div className={styles.editor}>
            <input
              className={styles.select}
              aria-label="Next review time, for example 14:30"
              data-testid="ward-observation-review-time"
              inputMode="numeric"
              placeholder="Review time, for example 14:30"
              value={reviewTime}
              onChange={(event) => setReviewTime(event.target.value)}
            />
            <select
              className={styles.select}
              aria-label="Review day"
              value={reviewDay}
              onChange={(event) => setReviewDay(event.target.value as "today" | "tomorrow")}
            >
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
            </select>
          </div>
          {error ? (
            <p className={styles.meta} role="alert">
              {error}
            </p>
          ) : null}
          <div className={styles.editor}>
            <Button variant="pri" className={styles.pill} data-testid="ward-observation-save" onClick={save}>
              Record level
            </Button>
            <Button variant="sec" className={styles.pill} onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
