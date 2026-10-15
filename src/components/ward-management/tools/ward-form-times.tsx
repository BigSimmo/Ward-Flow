"use client";

import { useId, useMemo, useState } from "react";

import { formTitleForCode } from "@/lib/form-register";
import { useWardFlowClock } from "../ward-flow-provider";
import { LEGAL_CLOCK_FORM_CODES, LEGAL_LIMITS_NOT_CHECKED_NOTICE } from "../ward-legal-clock";
import {
  formatStatutoryDateTime,
  parseDateTimeInput,
  toDateInputValue,
  toTimeInputValue,
} from "./ward-form-time-input";
import styles from "./ward-tools-sheet.module.css";

function formLabel(code: string) {
  const title = formTitleForCode(code);
  return title === null ? `Form ${code}` : `Form ${code} (${title})`;
}

function gapText(minutes: number) {
  const whole = Math.abs(Math.round(minutes));
  const text = `${Math.floor(whole / 60)}h ${String(whole % 60).padStart(2, "0")}m`;
  return minutes >= 0 ? `${text} from now` : `${text} ago`;
}

/**
 * Form times (Tools review items 10 and 12, 15 Oct 2026). Replaces the "MHA Deadline Calculator":
 * the person types the time written on the form and sees it back, with how far that typed time is
 * from the demo clock. Nothing is computed from the Act. No hour caps, no reference presets and no
 * cover instructions (rule D5: typed times only). Lives on the Legal forms page, with a Tools link.
 */
export function WardFormTimes() {
  const demoNow = useWardFlowClock();
  // The demo clock counts minutes from the start of the scenario day, anchored to today's date,
  // the same anchoring the form tool used, so a typed date reads naturally.
  // The anchor is fixed once, so the comparison does not jump a day if the page stays open past
  // Perth midnight.
  const [dayZero] = useState(() => parseDateTimeInput(toDateInputValue(new Date()), "00:00") ?? new Date());
  const now = useMemo(() => new Date(dayZero.getTime() + demoNow * 60_000), [dayZero, demoNow]);
  const [code, setCode] = useState<string>("1A");
  const [date, setDate] = useState(() => toDateInputValue(now));
  const [time, setTime] = useState(() => toTimeInputValue(now));
  const dateId = useId();
  const timeId = useId();
  // An empty time field is not a typed time, so it never reads as midnight (rule D5).
  const typed = time ? parseDateTimeInput(date, time) : null;

  return (
    <div className={styles.toolBody} data-testid="ward-form-times">
      <div className={styles.choiceRow}>
        <label className={styles.choiceLabel} htmlFor={`${dateId}-form`}>
          Form
        </label>
        <select
          id={`${dateId}-form`}
          className={styles.select}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        >
          {LEGAL_CLOCK_FORM_CODES.map((candidate) => (
            <option key={candidate} value={candidate}>
              {formLabel(candidate)}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.fieldRow}>
        <label htmlFor={dateId}>
          <span className={styles.choiceLabel}>Date written on form</span>
          <input
            id={dateId}
            type="date"
            className={styles.input}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label htmlFor={timeId}>
          <span className={styles.choiceLabel}>Time written on form</span>
          <input
            id={timeId}
            type="time"
            className={styles.input}
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
      </div>
      <p className={styles.result} role="status">
        {typed ? (
          <>
            {formLabel(code)}: <strong>{formatStatutoryDateTime(typed)}</strong>,{" "}
            {gapText((typed.getTime() - now.getTime()) / 60_000)} on the demo clock.
          </>
        ) : (
          "Not recorded"
        )}
      </p>
      <p className={styles.note}>{LEGAL_LIMITS_NOT_CHECKED_NOTICE}</p>
    </div>
  );
}
