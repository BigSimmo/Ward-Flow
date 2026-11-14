"use client";

import { DataRow, PhoneListRow, StatusGlyph, cx, tableClasses } from "@/components/wf";
import type { Instant } from "@/components/ward-management/ward-clock";
import { useDueSoonThresholds, useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { Movement } from "@/components/ward-management/ward-model";

import { currentLegalDueAt, legalDeadlineText, legalFormRowClassification } from "./legal-forms-derivations";
import { formProgression, formProgressionShort } from "./legal-form-progression";
import { nextStep, type NextStepAction } from "./legal-forms-next-step";
import {
  STANDING_TONE,
  clockStanding,
  durText,
  formTitle,
  isActNow,
  isOwnedLegalFormCode,
  recordedFacts,
  standingSuffix,
  standingWord,
  typedTimeStanding,
  type RecordGap,
} from "./legal-forms-view";
import { typedClock } from "./legal-time-as-typed";
import { extensionsOfCurrentForm } from "./legal-form-ledger";
import styles from "./legal-forms.module.css";

/**
 * The Legal forms list rows (split from `legal-forms-screen.tsx` to keep it under the line cap). A
 * typed legal time shows only as typed ("Ends 15:42", "as typed"), never as a countdown or a bar
 * (D5, D-70, D-93). Its colour compares the typed time with the user's own warning settings and
 * always comes with its words ("within 1h", "within 3h", "passed").
 */

export const GAP_LABEL: Record<RecordGap, string> = {
  written: "Time written",
  received: "Form received",
  examination: "Examination",
};

export const ROW_COLUMNS = "minmax(0,1.25fr) minmax(0,1.3fr) minmax(0,1.15fr) minmax(0,1.1fr) minmax(0,0.95fr)";
/**
 * FS1 (Josh, 3 Nov 2026): the last column is the row's one next step, the same step the side panel
 * leads with (`nextStep`). Its short label fits the cell, and the button says it in full.
 */
const STEP_LABEL: Record<Exclude<NextStepAction, "none" | "next-form">, string> = {
  written: "Add the time",
  received: "Mark received",
  examination: "Record examination",
  extend: "Extend or next form",
};
const CHECK_COLUMNS = "minmax(0,1.4fr) 56px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)";

type FormRowProps = {
  movement: Movement;
  now: Instant;
  name: string;
  umrn: string;
  edName: string;
  wardName: string | null;
  selected: boolean;
  highlighted: boolean;
  dimmed: boolean;
  onSelect: (movement: Movement) => void;
  onAddTime: (movement: Movement) => void;
};

/**
 * One row. `legalFormRowClassification` decides the tone; the row keeps the record-row hooks
 * (`data-record-key` for the movement id, `record-id` for the patient's formal name) that the
 * population tests read. A highlight marks the row and never hides it.
 */
export function FormRow({
  movement,
  now,
  name,
  umrn,
  edName,
  wardName,
  selected,
  highlighted,
  dimmed,
  onSelect,
  onAddTime,
}: FormRowProps) {
  const thresholds = useDueSoonThresholds();
  const dayZero = useOptionalWardFlowSelect("dayZero")?.dayZero;
  const legalForm = movement.legalForm;
  if (!legalForm) {
    throw new Error(`FormRow rendered for movement ${movement.id}, which carries no legal form`);
  }
  const classification = legalFormRowClassification(movement, now, thresholds);
  const standing = clockStanding(movement, now, thresholds);
  // The spoken line carries the colour's words too ("… ends 15:42 as typed · within 1h"), never a count.
  const reason = `${legalDeadlineText(movement, now, dayZero)}${standingSuffix(typedTimeStanding(movement, now, thresholds))}`;
  const facts = recordedFacts(movement);
  const done = facts.filter((fact) => fact.at !== undefined).length;
  const step = nextStep(movement, now, dayZero);
  const canAddTime = movement.formedAt === undefined && isOwnedLegalFormCode(legalForm.code);
  // Audit S-6: an ended form's typed expiry is history, so the row shows it ended, not a countdown.
  const progression = formProgression(movement);
  const dueAt = currentLegalDueAt(movement);
  const hasDue = dueAt !== undefined;
  // H13: a typed extension is named in words on the row; the panel says how many and warns.
  const extended = extensionsOfCurrentForm(movement) > 0;

  return (
    <DataRow
      as="li"
      columns={ROW_COLUMNS}
      selected={selected}
      actNow={isActNow(standing)}
      dim={dimmed}
      interactive
      className={styles.row}
      data-highlighted={highlighted ? "true" : undefined}
      data-ward-primitive="record-row"
      data-record-key={movement.id}
      data-tone={classification.tone}
    >
      <button
        type="button"
        className={styles.rowButton}
        aria-pressed={selected}
        aria-label={`${name}, ${legalFormName(legalForm)}, ${reason}`}
        onClick={() => onSelect(movement)}
      />
      <span className={styles.cellStack}>
        <span className={styles.name} data-ward-primitive="record-id">
          {name}
        </span>
        <span className={cx(styles.sub, styles.mono)}>{umrn}</span>
      </span>
      <span className={styles.formCell}>
        <span className={styles.code}>{legalForm.code}</span>
        <span className={styles.formTitle} title={formTitle(legalForm.code)}>
          {formTitle(legalForm.code)}
        </span>
      </span>
      <span className={styles.cellStack}>
        <span className={styles.truncate}>{edName}</span>
        <span className={cx(styles.sub, styles.truncate)}>{wardName ? `to ${wardName}` : "No receiving ward"}</span>
      </span>
      <span className={styles.cellStack}>
        {progression ? (
          <>
            {/* Icon rules (3 Nov 2026): the words already say the state, so no mark beside them. */}
            <span className={styles.leftLine}>
              <span className={styles.sub}>{formProgressionShort(progression)}</span>
            </span>
          </>
        ) : hasDue ? (
          <>
            <span className={styles.leftLine}>
              <StatusGlyph tone={STANDING_TONE[standing]} size={9} />
              <strong className={styles.leftValue}>{typedClock(dueAt!, now, dayZero)}</strong>
              <span className={styles.sub}>{standingWord(standing, thresholds)}</span>
            </span>
            <span className={styles.sub}>
              {standing === "passed" ? "Ended" : "Ends"}
              {extended ? ", extended" : ""}
            </span>
          </>
        ) : (
          <>
            <span className={styles.leftLine}>
              <span className={styles.sub}>
                {movement.formedAt === undefined ? "No time written" : "No expiry typed"}
              </span>
            </span>
            <span className={cx(styles.sub, styles.mono)}>In ED {durText(now - movement.openedAt)}</span>
          </>
        )}
        <span className={styles.srOnly}>{reason}</span>
      </span>
      <span className={styles.cellStack}>
        {step.action === "none" ? (
          <span className={styles.leftLine}>
            {/* A quiet line: nothing to do is not a warning, so it carries no cross or colour. */}
            {facts.length > 0 ? <StatusGlyph tone="success" size={9} /> : null}
            <span className={styles.sub}>{facts.length > 0 ? "All recorded" : "Nothing due"}</span>
          </span>
        ) : (
          <button
            type="button"
            className={styles.rowLink}
            // The name starts with the words shown, so speech and voice control match (axe label-content-name-mismatch).
            aria-label={`${step.action === "next-form" ? step.title : STEP_LABEL[step.action]} for ${name}`}
            title={step.detail}
            onClick={() => (step.action === "written" && canAddTime ? onAddTime(movement) : onSelect(movement))}
          >
            {step.action === "next-form" ? step.title : STEP_LABEL[step.action]}
          </button>
        )}
        {facts.length > 0 && done < facts.length ? (
          <span className={styles.sub}>
            {done} of {facts.length} recorded
          </span>
        ) : null}
      </span>
    </DataRow>
  );
}

/**
 * Phone row (v10): the code chip, the name, the form and where, with the typed time at the end.
 * The whole row opens the form sheet; an act now row takes the thin red edge, a dimmed row recedes
 * by colour only.
 */
export function PhoneFormRow({ movement, now, name, umrn, edName, wardName, dimmed, onSelect }: FormRowProps) {
  const thresholds = useDueSoonThresholds();
  const dayZero = useOptionalWardFlowSelect("dayZero")?.dayZero;
  const legalForm = movement.legalForm!;
  const standing = clockStanding(movement, now, thresholds);
  // FS1: the row names its one next step, the same one the sheet leads with.
  const step = nextStep(movement, now, dayZero);
  const where = wardName ? `${edName} to ${wardName}` : edName;
  const dueAt = currentLegalDueAt(movement);
  const hasDue = dueAt !== undefined;
  const typed = typedTimeStanding(movement, now, thresholds);
  return (
    <PhoneListRow
      as="li"
      className={styles.phoneRow}
      data-testid={`ward-legal-phone-row-${movement.id}`}
      {...(dimmed ? { "data-dim": "true" } : {})}
      actNow={isActNow(standing)}
      leading={<span className={styles.code}>{legalForm.code}</span>}
      name={name}
      meta={
        <>
          <span className={styles.phoneMetaLine}>{formTitle(legalForm.code)}</span>{" "}
          <span className={styles.phoneMetaLine}>{where}</span>
          {step.action === "none" ? null : " "}
          {step.action === "none" ? null : (
            <span className={cx(styles.phoneMetaLine, styles.phoneStep)}>
              {step.action === "next-form" ? step.title : STEP_LABEL[step.action]}
            </span>
          )}
        </>
      }
      // Josh's no-wrap rule: the typed time and its word on one line ("15:42 as typed"), never a count.
      value={
        hasDue ? (
          <span className={styles.leftLine}>
            <StatusGlyph tone={STANDING_TONE[standing]} size={9} />
            {typedClock(dueAt!, now, dayZero)}
            {standing === "passed" ? (
              <>
                {" "}
                <span className={styles.phoneTimeWord}>ended</span>
              </>
            ) : null}
          </span>
        ) : (
          <span className={styles.leftLine}>
            {durText(now - movement.openedAt)} <span className={styles.phoneTimeWord}>in ED</span>
          </span>
        )
      }
      // The colour's words sit under the typed time ("within 1h"), never colour alone.
      // CB-3: no aria-label, so the row is named by the words it shows in order (a row cut by the
      // screen's edge still matches its name), then the record number and full form for a screen reader.
      time={
        <>
          {typed.word}
          <span className="sr-only">{`. ${umrn}, ${legalFormName(legalForm)}, ${legalDeadlineText(movement, now, dayZero)}${standingSuffix(typed)}`}</span>
        </>
      }
      onSelect={() => onSelect(movement)}
    />
  );
}

/** Checklist view: who still needs what recorded, one column per fact. */
export function ChecklistView({
  rows,
  now,
  nameOf,
  umrnOf,
  selectedId,
  isHighlighted,
  highlightOn,
  onSelect,
}: {
  rows: Movement[];
  now: Instant;
  nameOf: (movement: Movement) => string;
  umrnOf: (movement: Movement) => string;
  selectedId: string | null;
  isHighlighted: (movement: Movement) => boolean;
  highlightOn: boolean;
  onSelect: (movement: Movement) => void;
}) {
  const dayZero = useOptionalWardFlowSelect("dayZero")?.dayZero;
  const gaps: RecordGap[] = ["written", "received", "examination"];
  return (
    <div className={styles.table} role="region" aria-label="Checklist">
      <DataRow head columns={CHECK_COLUMNS} aria-hidden="true" className={styles.headRow}>
        <span className={tableClasses.th}>Patient</span>
        <span className={tableClasses.th}>Form</span>
        {gaps.map((gap) => (
          <span key={gap} className={tableClasses.th}>
            {GAP_LABEL[gap]}
          </span>
        ))}
      </DataRow>
      <ul className={styles.rowList}>
        {rows.map((movement) => {
          const facts = recordedFacts(movement);
          const on = isHighlighted(movement);
          return (
            <DataRow
              key={movement.id}
              as="li"
              columns={CHECK_COLUMNS}
              selected={movement.id === selectedId}
              interactive
              dim={highlightOn && !on}
              className={cx(styles.row, styles.checkRow)}
              data-highlighted={on ? "true" : undefined}
            >
              <button
                type="button"
                className={styles.rowButton}
                aria-pressed={movement.id === selectedId}
                aria-label={`${nameOf(movement)}, ${legalFormName(movement.legalForm!)}`}
                onClick={() => onSelect(movement)}
              />
              <span className={styles.cellStack}>
                <span className={styles.name}>{nameOf(movement)}</span>
                <span className={cx(styles.sub, styles.mono)}>{umrnOf(movement)}</span>
              </span>
              <span className={styles.code}>{movement.legalForm?.code}</span>
              {gaps.map((gap) => {
                const fact = facts.find((entry) => entry.gap === gap);
                if (!fact) {
                  return (
                    <span key={gap} className={styles.sub} data-label={GAP_LABEL[gap]}>
                      {gap === "written" ? "Not recorded here" : "Not needed"}
                    </span>
                  );
                }
                return (
                  <span key={gap} className={styles.leftLine} data-label={GAP_LABEL[gap]}>
                    <StatusGlyph tone={fact.at !== undefined ? "success" : "neutral"} size={9} />
                    <span className={cx(styles.sub, fact.at !== undefined && styles.mono)}>
                      {fact.at !== undefined ? typedClock(fact.at, now, dayZero) : "To record"}
                    </span>
                  </span>
                );
              })}
            </DataRow>
          );
        })}
      </ul>
    </div>
  );
}
