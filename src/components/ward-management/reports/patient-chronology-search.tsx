"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Check } from "lucide-react";

import { SearchField } from "@/components/wf";
import type { Patient } from "@/components/ward-management/ward-patients";

import start from "./patient-chronology-start.module.css";

/** Search suggestions shown at once; the rest are reached by typing more. */
const MATCH_LIMIT = 8;

/**
 * Patient chronology (Josh, 31 Oct 2026): the one way to choose a patient. A search box (combobox) that suggests people with
 * records by surname, first name or UMRN; arrow keys move, Enter chooses, Escape clears. The typed
 * text stays in this box only: never in the address, the print or the CSV.
 */
export function PatientChronologySearch({
  people,
  chosenId,
  onChoose,
  nameOf,
  size,
  label,
}: {
  people: readonly Patient[];
  chosenId: string;
  onChoose: (id: string) => void;
  nameOf: (patient: Patient) => string;
  size: "hero" | "phone";
  label: string;
}) {
  const listId = useId();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const needle = text.trim().toLowerCase();
  const matches = needle
    ? people.filter((patient) =>
        `${patient.familyName}, ${patient.givenName} ${patient.givenName} ${patient.familyName} ${patient.umrn}`
          .toLowerCase()
          .includes(needle),
      )
    : [];
  const shown = matches.slice(0, MATCH_LIMIT);
  const open = focused && needle !== "";
  const activeIndex = Math.min(active, Math.max(shown.length - 1, 0));

  const choose = (patient: Patient) => {
    onChoose(patient.id);
    setText("");
    setActive(0);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && shown.length) {
      event.preventDefault();
      setActive((activeIndex + 1) % shown.length);
    } else if (event.key === "ArrowUp" && shown.length) {
      event.preventDefault();
      setActive((activeIndex - 1 + shown.length) % shown.length);
    } else if (event.key === "Enter" && open && shown[activeIndex]) {
      event.preventDefault();
      choose(shown[activeIndex]);
    } else if (event.key === "Escape") {
      setText("");
    }
  };

  return (
    <div className={start.search}>
      {/* D-91: the one page search field, here the combobox that picks the patient. */}
      <SearchField
        role="combobox"
        label={label}
        placeholder={size === "phone" ? "Surname, first name or UMRN" : `${label} by surname or UMRN`}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && shown.length ? `${listId}-${activeIndex}` : undefined}
        spellCheck={false}
        value={text}
        onValueChange={(next) => {
          setText(next);
          setActive(0);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        data-testid="ward-chronology-patient"
      />
      <div className={start.results} hidden={!open}>
        <ul id={listId} role="listbox" aria-label="Matching patients" className={start.resultList}>
          {shown.map((patient, index) => (
            <li
              key={patient.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={start.result}
              // Chosen on mouse down, before the input's blur closes the list.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(patient);
              }}
            >
              <span className={start.personName}>{nameOf(patient)}</span>
              <span className={start.personUmrn}>{patient.umrn || "UMRN not recorded"}</span>
              {patient.id === chosenId ? <Check size={16} aria-label="Open now" /> : null}
            </li>
          ))}
        </ul>
        <p className={start.resultNote} role="status">
          {matches.length === 0
            ? "No patient with records matches"
            : matches.length > shown.length
              ? `${shown.length} of ${matches.length} shown · keep typing to narrow`
              : `${matches.length} ${matches.length === 1 ? "match" : "matches"}`}
        </p>
      </div>
    </div>
  );
}
