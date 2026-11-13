"use client";

import { useState } from "react";
import { Button, Segmented, StatusGlyph } from "@/components/wf";
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
import { useKeepLayoutDraft, useKeptLayoutDraft } from "@/components/ward-management/use-layout-draft";
import { ChoiceChips } from "./ward-bed-dossier-bits";

const LEVEL_CHOICES = OBSERVATION_LEVELS.map((level) => ({ id: level, label: levelOptionLabel(level) }));
const INTERVAL_CHOICES = INTERMITTENT_INTERVAL_MINUTES.map((minutes) => ({
  id: String(minutes),
  label: `${minutes} minutes`,
}));
const REVIEW_DAYS = [
  { id: "today" as const, label: "Today" },
  { id: "tomorrow" as const, label: "Tomorrow" },
];

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

/** C19: an open observation form's unsaved entries, kept across the phone and wide layouts. */
type ObservationDraft = {
  level: ObservationLevel;
  interval: number;
  reviewTime: string;
  reviewDay: "today" | "tomorrow";
  reviewEdited: boolean;
  openedToken: string | undefined;
};

/** True when the recorded review time has passed (time audit T7): shown as "was due", in warning tone. */
export function observationReviewPassed(observation: Observation, now: Instant): boolean {
  return observation.reviewAt !== null && observation.reviewAt < now;
}

/** The level as the drawer row reads it: "Intermittent, every 15 minutes. Review 14:00", or
 *  "... Review was due 14:00" once that time has passed, so a missed review never reads as ahead. */
export function observationWithReview(observation: Observation, now: Instant): string {
  const summary = observationSummary(observation);
  if (observation.reviewAt === null) return summary;
  const lead = observationReviewPassed(observation, now) ? "Review was due" : "Review";
  return `${summary}. ${lead} ${formatInstantWithDay(observation.reviewAt, now)}`;
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
  draftKey,
}: {
  observation: Observation;
  now: Instant;
  /** The record's `observationEditingToken` now; the one seen on opening goes with the save. */
  editingToken?: string;
  /** Absent for a desk that may not change it: the level is shown and nothing more. */
  onSave?: (next: Observation, expected?: string) => ReturnType<WardCommandDispatch>;
  /** False where a row above already states the level, as in the bed drawer. */
  showCurrent?: boolean;
  /** C19: names this stay's form so its unsaved entries survive the phone and wide layouts swapping. */
  draftKey?: string;
}) {
  // C19: the twin form in the other layout, open at the moment the screen crossed the phone width.
  const kept = useKeptLayoutDraft<ObservationDraft>(draftKey);
  const [open, setOpen] = useState(kept !== undefined);
  // Audit CS3-01: an open observation form is checked against the board it opened on.
  useHoldOpenForm(open);
  const [level, setLevel] = useState<ObservationLevel>(kept?.level ?? observation.level);
  const [interval, setIntervalMinutes] = useState<number>(
    kept?.interval ?? observation.intervalMinutes ?? INTERMITTENT_INTERVAL_MINUTES[0],
  );
  const [reviewTime, setReviewTime] = useState(kept?.reviewTime ?? "");
  const [reviewDay, setReviewDay] = useState<"today" | "tomorrow">(kept?.reviewDay ?? "today");
  const [reviewEdited, setReviewEdited] = useState(kept?.reviewEdited ?? false);
  const [error, setError] = useState<string | null>(null);
  // A colleague's change made while this is open is refused by the server, not overwritten.
  const [openedToken, setOpenedToken] = useState<string | undefined>(kept?.openedToken);
  useKeepLayoutDraft<ObservationDraft>(
    draftKey,
    open ? { level, interval, reviewTime, reviewDay, reviewEdited, openedToken } : undefined,
  );
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
          {observationReviewPassed(observation, now) ? <StatusGlyph tone="warning" /> : null}{" "}
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
          <fieldset
            disabled={recording.pending}
            style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
            aria-label="Observation settings"
          >
            {/* WH1 (Josh, 3 Nov 2026): kit chips and segments in place of browser drop-downs. */}
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Observation level</span>
              <ChoiceChips
                label="Observation level"
                items={LEVEL_CHOICES}
                value={level}
                onChange={(value) => {
                  if (!recording.pending) setLevel(value);
                }}
                testId="ward-observation-level"
              />
            </div>
            {level === "intermittent" ? (
              <div className={styles.field} data-testid="ward-observation-interval" data-value={String(interval)}>
                <span className={styles.fieldLabel}>Check every</span>
                <Segmented
                  label="Check every"
                  items={INTERVAL_CHOICES}
                  value={String(interval)}
                  onChange={(minutes) => {
                    if (!recording.pending) setIntervalMinutes(Number(minutes));
                  }}
                />
              </div>
            ) : null}
            <div className={styles.fieldRow}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Next review (optional)</span>
                <input
                  className={styles.select}
                  data-testid="ward-observation-review-time"
                  inputMode="numeric"
                  disabled={recording.pending}
                  placeholder="For example 14:30"
                  value={reviewTime}
                  onChange={(event) => {
                    setReviewTime(event.target.value);
                    setReviewEdited(true);
                  }}
                />
              </label>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Day</span>
                <Segmented
                  label="Review day"
                  items={REVIEW_DAYS}
                  value={reviewDay}
                  onChange={(day) => {
                    if (recording.pending) return;
                    setReviewDay(day);
                    setReviewEdited(true);
                  }}
                />
              </div>
            </div>
          </fieldset>
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
