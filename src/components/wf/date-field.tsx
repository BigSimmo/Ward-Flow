"use client";

import { useState } from "react";

import { TextInput, type TextInputProps } from "./form";

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
