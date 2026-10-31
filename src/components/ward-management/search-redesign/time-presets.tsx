"use client";

/**
 * MOCK-UP for Josh's approval (D-74): one row of time buttons beside a typed time. Today six
 * screens each have their own (the arrival time, transport, leave on a phone, snooze, commitment
 * times and "told 15 minutes ago"), and most typed time fields have none.
 *
 * "Now" reads the board's clock, never the device's. It is for a time someone writes down (when a
 * form was written, when the person arrived), never a computed legal expiry (D5, D-70).
 */
import { useState } from "react";

import { TextInput } from "@/components/wf";
import { minuteOfDay, minuteOfDayFromClockText } from "@/components/ward-management/ward-clock";
import { useWardFlowClock } from "@/components/ward-management/ward-flow-provider";

import styles from "./search-redesign.module.css";

const hhmm = (minute: number) => {
  const day = ((minute % 1440) + 1440) % 1440;
  return `${String(Math.floor(day / 60)).padStart(2, "0")}:${String(day % 60).padStart(2, "0")}`;
};

export function TimePresetsField({ label, offsets = [0, 15, 30, 60] }: { label: string; offsets?: readonly number[] }) {
  const now = useWardFlowClock();
  const [value, setValue] = useState("");
  const typed = minuteOfDayFromClockText(value);
  return (
    <div className={styles.timeField}>
      <label className={styles.timeLabel}>
        {label}
        <TextInput
          inputMode="numeric"
          placeholder="HH:MM or 1430"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-describedby="mock-time-hint"
        />
      </label>
      <div className={styles.timePresets} role="group" aria-label={`${label}: quick times`}>
        {offsets.map((offset) => (
          <button
            key={offset}
            type="button"
            className={styles.chip}
            onClick={() => setValue(hhmm(minuteOfDay(now) + offset))}
          >
            {offset === 0 ? "Now" : `+${offset >= 60 ? `${offset / 60}h` : `${offset}m`}`}
          </button>
        ))}
      </div>
      <p id="mock-time-hint" className={styles.note}>
        {value === ""
          ? "Type it, or tap a time."
          : typed === undefined
            ? "Not a time yet."
            : `Reads as ${hhmm(typed)}.`}
      </p>
    </div>
  );
}
