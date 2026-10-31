"use client";

import { cx } from "./cx";
import { SrOnly } from "./primitives";
import styles from "./time-presets.module.css";

/**
 * TIME BUTTONS BESIDE A TYPED TIME (D-91, from draft PR #1123 and the #1118 mock-ups): a row of quiet
 * buttons, Now, +15m, +30m and +1h, that fill an HH:MM text field.
 *
 * - The time comes from the board clock, never the device's clock, so the demo clock and the board
 *   agree. The kit does not read the clock itself: pass `boardMinuteOfDay`, for example
 *   `minuteOfDay(useWardFlowClock())`.
 * - A button only writes "HH:MM" into the caller's field. The person can still type over it, and
 *   nothing is saved until the form is. Nothing is pre-selected.
 * - `legal`: a legal-form time (D5, D-70) offers Now only, for "when it was written". This part
 *   never computes, shows or suggests an expiry, a countdown or a time remaining; a legal time is
 *   only ever shown as typed.
 *
 * Example (the caller owns the field):
 *
 *     const [arrival, setArrival] = useState("");
 *     <TimePresets label="Expected arrival" boardMinuteOfDay={minuteOfDay(now)} onPick={setArrival} />
 *     // A legal form's "time written": Now only.
 *     <TimePresets label="Form 1A written" boardMinuteOfDay={minuteOfDay(now)} onPick={setWritten} legal />
 */

/** Minutes after now for each button; 0 is "Now". */
const OFFSETS = [0, 15, 30, 60] as const;

/** A minute of the day as "HH:MM", wrapping past midnight. */
export function timePresetClockText(minute: number): string {
  const day = ((Math.floor(minute) % 1440) + 1440) % 1440;
  return `${String(Math.floor(day / 60)).padStart(2, "0")}:${String(day % 60).padStart(2, "0")}`;
}

function buttonText(offset: number): string {
  if (offset === 0) return "Now";
  return offset >= 60 ? `+${offset / 60}h` : `+${offset}m`;
}

export function TimePresets({
  label,
  boardMinuteOfDay,
  onPick,
  legal = false,
  className,
}: {
  /** The field's own label; the row is announced as "<label>: quick times". */
  label: string;
  /** The board clock's minute of the day (0 to 1439). */
  boardMinuteOfDay: number;
  /** Receives "HH:MM". */
  onPick: (hhmm: string) => void;
  /** A legal-form time: Now only (D5, D-70). */
  legal?: boolean;
  className?: string;
}) {
  const offsets = legal ? OFFSETS.slice(0, 1) : OFFSETS;
  return (
    <div className={cx(styles.row, className)} role="group" aria-label={`${label}: quick times`}>
      {offsets.map((offset) => {
        const time = timePresetClockText(boardMinuteOfDay + offset);
        return (
          <button key={offset} type="button" className={styles.preset} onClick={() => onPick(time)}>
            {buttonText(offset)}
            <SrOnly>, sets {time}</SrOnly>
          </button>
        );
      })}
    </div>
  );
}
