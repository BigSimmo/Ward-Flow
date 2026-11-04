"use client";

// The kit choices on the ED "Ask for a bed" form and the inbox decline (L31, Josh 3 Nov 2026):
// a few answers are a segmented control, a longer list is the kit list picker, and a written time
// is the kit's typed HH:MM box. None of them chooses anything for the person.
import { useState, type ReactNode } from "react";

import {
  ListPicker,
  parseTypedTime,
  Segmented,
  TextInput,
  type ChoiceItem,
  type ListPickerOption,
} from "@/components/wf";

import missingStyles from "./ed-raise-missing.module.css";
import styles from "./ed.module.css";

/**
 * A question with a few answers, as the kit segmented control in a labelled group. Nothing is on
 * until the person picks. The group carries the test id and the chosen value (`data-value`), a
 * blocked send focuses its tab stop, and an unanswered group is described as "Not answered", as
 * the high-acuity radio pair is.
 */
export function EdSegmentedField<T extends string>({
  label,
  testId,
  items,
  value,
  onChange,
  missing = false,
}: {
  label: string;
  testId: string;
  items: ChoiceItem<T>[];
  value: T | "";
  onChange: (value: T) => void;
  missing?: boolean;
}) {
  const noteId = `${testId}-missing`;
  return (
    <fieldset
      className={`${styles.referralField} ${missingStyles.choice} ${missing ? missingStyles.missingChoice : ""}`}
      data-testid={testId}
      data-value={value}
      aria-describedby={missing ? noteId : undefined}
    >
      <legend className={missingStyles.choiceLegend}>{label}</legend>
      <Segmented<T | "">
        label={label}
        size="md"
        items={items}
        value={value}
        onChange={(next) => {
          if (next !== "") onChange(next);
        }}
      />
      {missing ? (
        <span className={missingStyles.note} id={noteId}>
          Not answered
        </span>
      ) : null}
    </fieldset>
  );
}

/** A question with a longer list of answers, as the kit list picker, with its "Not answered" note. */
export function EdPickerField({
  label,
  testId,
  options,
  value,
  onChange,
  placeholder,
  name,
  missing = false,
  required = false,
  note,
}: {
  label: string;
  testId: string;
  options: ListPickerOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder: string;
  /** The hidden input that carries the value, so a reader can see what is chosen. */
  name: string;
  missing?: boolean;
  required?: boolean;
  note?: ReactNode;
}) {
  return (
    <div className={`${styles.referralField} ${missingStyles.choice}`}>
      <ListPicker
        label={label}
        testId={testId}
        name={name}
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        invalid={missing}
      />
      {note}
    </div>
  );
}

/**
 * The kit's typed 24-hour time box (as in `DateTimeField`), in place of the browser's time picker,
 * which showed AM and PM on many phones. It sends "HH:MM" once the typing is a real time, and the
 * typing itself otherwise, so a half-typed time is never read as no time at all.
 */
export function EdTimeBox({
  label,
  testId,
  value,
  onChange,
  invalid = false,
}: {
  label: string;
  testId: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }
  const wrong = text.trim().length >= 4 && parseTypedTime(text) === null;
  return (
    <TextInput
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={5}
      placeholder="HH:MM"
      value={text}
      invalid={invalid || wrong}
      aria-label={`${label}, HH:MM, for example 14:30`}
      data-testid={testId}
      onChange={({ target: { value: typed } }) => {
        setText(typed);
        const next = typed.trim() === "" ? "" : (parseTypedTime(typed) ?? typed);
        setLastValue(next);
        onChange(next);
      }}
    />
  );
}
