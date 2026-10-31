"use client";

/**
 * TIME BUTTONS BESIDE A TYPED TIME (D-91, from draft PR #1123): a row of quiet buttons, Now, +15m,
 * +30m and +1h, that fill an HH:MM text field. Forms get them one by one, starting with the ED
 * expected arrival and the discharge care dates.
 *
 * - The time comes from the board clock (`useWardFlowClock`), never the device's clock, so the demo
 *   clock and the board agree.
 * - A button only writes "HH:MM" into the caller's field. The person can still type over it, and
 *   nothing is saved until the form is.
 * - `legal`: a legal-form time (D5, D-70) offers Now only, for "when it was written". This part
 *   never computes, shows or suggests an expiry, a countdown or a time remaining; a legal time is
 *   only ever shown as typed.
 *
 * Example (the caller owns the field):
 *
 *     const [arrival, setArrival] = useState("");
 *     <Field label="Expected arrival">
 *       <TextInput inputMode="numeric" placeholder="HH:MM" value={arrival} onChange={(e) => setArrival(e.target.value)} />
 *     </Field>
 *     <TimePresets label="Expected arrival" onPick={setArrival} />
 *
 *     // A legal form's "time written": Now only.
 *     <TimePresets label="Form 1A written" onPick={setWritten} legal />
 */
import { minuteOfDay } from "@/components/ward-management/ward-clock";
import { useWardFlowClock } from "@/components/ward-management/ward-flow-provider";

import styles from "./time-presets.module.css";

/** Minutes after now for each button; 0 is "Now". */
const OFFSETS = [0, 15, 30, 60] as const;

/** A minute of the day as "HH:MM", wrapping past midnight. */
function clockText(minute: number): string {
  const day = ((minute % 1440) + 1440) % 1440;
  return `${String(Math.floor(day / 60)).padStart(2, "0")}:${String(day % 60).padStart(2, "0")}`;
}

function buttonText(offset: number): string {
  if (offset === 0) return "Now";
  return offset >= 60 ? `+${offset / 60}h` : `+${offset}m`;
}

export function TimePresets({
  label,
  onPick,
  legal = false,
  className,
}: {
  /** The field's own label; the row is announced as "<label>: quick times". */
  label: string;
  /** Receives "HH:MM" from the board clock. */
  onPick: (hhmm: string) => void;
  /** A legal-form time: Now only (D5, D-70). */
  legal?: boolean;
  className?: string;
}) {
  const now = useWardFlowClock();
  const offsets = legal ? OFFSETS.slice(0, 1) : OFFSETS;
  return (
    <div
      className={[styles.row, className ?? ""].filter(Boolean).join(" ")}
      role="group"
      aria-label={`${label}: quick times`}
    >
      {offsets.map((offset) => {
        const time = clockText(minuteOfDay(now) + offset);
        return (
          <button key={offset} type="button" className={styles.preset} onClick={() => onPick(time)}>
            {buttonText(offset)}
            <span className="sr-only">, sets {time}</span>
          </button>
        );
      })}
    </div>
  );
}
