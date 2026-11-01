"use client";

import { useState } from "react";

import { TextInput, type TextInputProps } from "./form";
import styles from "./form.module.css";

/**
 * THE KIT'S TYPED DATE BOX (bug list row 25, Josh 31 October 2026): one DD/MM/YYYY text box in place
 * of the browser's date picker, which showed mm/dd/yyyy in some browsers.
 *
 * - The person types the day as written on the form: "31/10/2026", "31-10-2026", "31.10.2026" or
 *   "31102026". One-digit days and months are fine with separators ("1/9/2026").
 * - The caller's value stays YYYY-MM-DD (or "" while incomplete or not a real day), so existing
 *   readers such as `instantFromDateAndTimeInputs` keep working unchanged.
 * - Nothing is filled in for the person, and nothing is worked out from the date: a legal-form
 *   date is shown as typed (D5, D-70).
 * - A finished entry that is not a real day (31/02/2026) is marked invalid; the caller's Field shows
 *   its own error words.
 *
 * Example:
 *
 *     const [admitted, setAdmitted] = useState("");
 *     <Field label="Date written" hint="DD/MM/YYYY">
 *       <DateField value={admitted} onValueChange={setAdmitted} />
 *     </Field>
 */

/** "31/10/2026" (or 31-10-2026, 31.10.2026, 31102026) as "2026-10-31"; null when not a real day. */
export function parseTypedDate(text: string): string | null {
  const trimmed = text.trim();
  const match =
    /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{4})$/u.exec(trimmed) ?? /^(\d{2})(\d{2})(\d{4})$/u.exec(trimmed);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || year < 1900 || year > 2999) return null;
  // A day past the month's end (31/02) would roll over; refuse it rather than move it.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > lastDay) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "2026-10-31" as "31/10/2026"; anything else as "". */
export function isoDateAsTyped(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

/** Looks finished (enough digits for a whole date), so a failed parse is an error, not typing. */
function looksFinished(text: string): boolean {
  return (text.match(/\d/gu)?.length ?? 0) >= 8;
}

export type DateFieldProps = Omit<TextInputProps, "value" | "defaultValue" | "onChange" | "type"> & {
  /** YYYY-MM-DD, or "" for none. */
  value: string;
  /** Called with YYYY-MM-DD when the typed text is a real day, otherwise with "". */
  onValueChange: (iso: string) => void;
};

export function DateField({
  value,
  onValueChange,
  invalid,
  placeholder = "DD/MM/YYYY",
  ...inputProps
}: DateFieldProps) {
  const [typed, setTyped] = useState(() => isoDateAsTyped(value));
  // A new value from the caller (a reset, or a record loaded) replaces the typed text; the person's
  // own unfinished typing (value "") is left alone.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (value !== (parseTypedDate(typed) ?? "")) setTyped(isoDateAsTyped(value));
  }
  const wrong = looksFinished(typed) && parseTypedDate(typed) === null;
  return (
    <TextInput
      {...inputProps}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={10}
      placeholder={placeholder}
      value={typed}
      invalid={invalid || wrong}
      onChange={(event) => {
        const text = event.target.value;
        setTyped(text);
        onValueChange(parseTypedDate(text) ?? "");
      }}
    />
  );
}

/** "14:30" (or 1430, 14.30, 9:05) as "14:30"; null when not a real 24-hour time. */
export function parseTypedTime(text: string): string | null {
  const match = /^(\d{1,2})[:.\s]?(\d{2})$/u.exec(text.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** "2026-10-31T14:30" split into its date and time parts; "" parts when it is not one. */
function splitDateTime(value: string): { date: string; time: string } {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/u.exec(value);
  return match ? { date: match[1], time: match[2] } : { date: "", time: "" };
}

export type DateTimeFieldProps = {
  /** The date box's id, so a `<label htmlFor>` or kit Field points at it. */
  id?: string;
  /** "YYYY-MM-DDTHH:MM" (the old datetime-local shape), or "" for none. Leave out for a form read by name. */
  value?: string;
  /** Starting value when `value` is left out. */
  defaultValue?: string;
  /** Called with "YYYY-MM-DDTHH:MM" once both boxes hold a real date and time, otherwise with "". */
  onValueChange?: (value: string) => void;
  /** A hidden input of this name carries the joined value, for forms read with FormData. */
  name?: string;
  required?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  /** Spoken before each box: "<label> date" and "<label> time". */
  label?: string;
  "data-testid"?: string;
};

/**
 * THE KIT'S TYPED DATE AND TIME (phone audit, 1 Nov 2026): a DD/MM/YYYY box and an HH:MM (24-hour)
 * box in place of `<input type="datetime-local">`, whose picker showed mm/dd/yyyy and AM/PM on many
 * phones. The value stays "YYYY-MM-DDTHH:MM", so readers such as `perthDateTimeLocal` are unchanged.
 * Nothing is filled in for the person, and nothing is worked out from what they type (D5, D-70).
 *
 *     <label htmlFor="written">Date and time written</label>
 *     <DateTimeField id="written" value={written} onValueChange={setWritten} label="Written" />
 */
export function DateTimeField({
  id,
  value,
  defaultValue = "",
  onValueChange,
  name,
  required,
  invalid,
  disabled,
  label,
  "data-testid": testId,
}: DateTimeFieldProps) {
  const [own, setOwn] = useState(defaultValue);
  const current = value ?? own;
  const parts = splitDateTime(current);
  const [date, setDate] = useState(parts.date);
  const [timeText, setTimeText] = useState(parts.time);
  // A new value from the caller (a reset, or a record loaded) replaces both parts. `lastValue` is
  // also what this box last sent, so the caller echoing it back leaves the typing alone.
  const [lastValue, setLastValue] = useState(current);
  if (current !== lastValue) {
    setLastValue(current);
    setDate(parts.date);
    setTimeText(parts.time);
  }
  const emit = (nextDate: string, nextTime: string) => {
    const time = parseTypedTime(nextTime);
    const joined = nextDate !== "" && time !== null ? `${nextDate}T${time}` : "";
    setLastValue(joined);
    if (value === undefined) setOwn(joined);
    onValueChange?.(joined);
  };
  const timeWrong = timeText.trim().length >= 4 && parseTypedTime(timeText) === null;
  return (
    <div className={styles.dateTime} data-wf-date-time="" data-testid={testId}>
      <DateField
        id={id}
        value={date}
        required={required}
        disabled={disabled}
        invalid={invalid}
        aria-label={label ? `${label} date, DD/MM/YYYY` : undefined}
        data-testid={testId ? `${testId}-date` : undefined}
        onValueChange={(nextDate) => {
          setDate(nextDate);
          emit(nextDate, timeText);
        }}
      />
      <TextInput
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={5}
        placeholder="HH:MM"
        value={timeText}
        required={required}
        disabled={disabled}
        invalid={invalid || timeWrong}
        aria-label={label ? `${label} time, HH:MM 24-hour` : "Time, HH:MM 24-hour"}
        data-testid={testId ? `${testId}-time` : undefined}
        onChange={(event) => {
          setTimeText(event.target.value);
          emit(date, event.target.value);
        }}
      />
      {name ? <input type="hidden" name={name} value={current} /> : null}
    </div>
  );
}
