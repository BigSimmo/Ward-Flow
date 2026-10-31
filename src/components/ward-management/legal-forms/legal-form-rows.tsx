"use client";

import { DataRow, PhoneListRow, StatusGlyph, cx, tableClasses } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useDueSoonThresholds } from "@/components/ward-management/ward-flow-provider";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { Movement } from "@/components/ward-management/ward-model";

import { currentLegalDueAt, legalDeadlineText, legalFormRowClassification } from "./legal-forms-derivations";
import { formProgression } from "./legal-form-progression";
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
/** The short word for a fact still to record, as the To record column names it. */
const TO_RECORD_WORD: Record<RecordGap, string> = {
  written: "Time written",
  received: "Received",
  examination: "Examined",
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
  const legalForm = movement.legalForm;
  if (!legalForm) {
    throw new Error(`FormRow rendered for movement ${movement.id}, which carries no legal form`);
  }
  const classification = legalFormRowClassification(movement, now, thresholds);
  const standing = clockStanding(movement, now, thresholds);
  // The spoken line carries the colour's words too ("… ends 15:42 as typed · within 1h"), never a count.
  const reason = `${legalDeadlineText(movement, now)}${standingSuffix(typedTimeStanding(movement, now, thresholds))}`;
  const facts = recordedFacts(movement);
  const done = facts.filter((fact) => fact.at !== undefined).length;
  const missing = facts.filter((fact) => fact.at === undefined).map((fact) => TO_RECORD_WORD[fact.gap]);
  const canAddTime = movement.formedAt === undefined && isOwnedLegalFormCode(legalForm.code);
  // Audit S-6: an ended form's typed expiry is history, so the row shows it ended, not a countdown.
  const progression = formProgression(movement);
  const dueAt = currentLegalDueAt(movement);
  const hasDue = dueAt !== undefined;

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
            <span className={styles.leftLine}>
              <StatusGlyph tone="closed" size={9} />
              <span className={styles.sub}>Ended {progression.endedWhen}</span>
            </span>
            <span className={styles.sub}>Form {progression.nextCode} to record</span>
          </>
        ) : hasDue ? (
          <>
            <span className={styles.leftLine}>
              <StatusGlyph tone={STANDING_TONE[standing]} size={9} />
              <strong className={styles.leftValue}>{typedClock(dueAt!, now)}</strong>
              <span className={styles.sub}>{standingWord(standing, thresholds)}</span>
            </span>
            <span className={styles.sub}>{standing === "passed" ? "Ended" : "Ends"}, as typed</span>
          </>
        ) : (
          <>
            <span className={styles.leftLine}>
              <StatusGlyph tone="closed" size={9} />
              <span className={styles.sub}>
                {movement.formedAt === undefined ? "No time written" : "No expiry typed"}
              </span>
            </span>
            {canAddTime ? (
              <button
                type="button"
                className={styles.rowLink}
                aria-label={`Add the time for ${name}`}
                onClick={() => onAddTime(movement)}
              >
                Add the time
              </button>
            ) : (
              <span className={cx(styles.sub, styles.mono)}>In ED {durText(now - movement.openedAt)}</span>
            )}
          </>
        )}
        <span className={styles.srOnly}>{reason}</span>
      </span>
      <span className={styles.recorded}>
        {facts.length === 0 ? (
          <span className={styles.sub} aria-hidden="true">
            –
          </span>
        ) : missing.length === 0 ? (
          <>
            <StatusGlyph tone="success" size={9} />
            <span className={styles.recordedText}>All recorded</span>
          </>
        ) : (
          <>
            <StatusGlyph tone="neutral" size={9} />
            {/* One fact names itself; more show as a count so the cell never cuts a word. */}
            <span className={styles.recordedText} title={missing.join(", ")}>
              {missing.length === 1 ? missing[0] : `${missing.length} to record`}
            </span>
          </>
        )}
        <span className={styles.srOnly}>
          {facts.length === 0 ? "Nothing to record for this form" : `${done} of ${facts.length} recorded`}
        </span>
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
  const legalForm = movement.legalForm!;
  const standing = clockStanding(movement, now, thresholds);
  const facts = recordedFacts(movement);
  const missing = facts.filter((fact) => fact.at === undefined).length;
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
          <span className={styles.phoneMetaLine}>{formTitle(legalForm.code)}</span>
          <span className={styles.phoneMetaLine}>
            {where}
            {missing > 0 ? ` · ${missing} to record` : ""}
          </span>
        </>
      }
      // Josh's no-wrap rule: the typed time and its word on one line ("15:42 as typed"), never a count.
      value={
        hasDue ? (
          <span className={styles.leftLine}>
            <StatusGlyph tone={STANDING_TONE[standing]} size={9} />
            {typedClock(dueAt!, now)}
            <span className={styles.phoneTimeWord}>{standing === "passed" ? "ended, as typed" : "as typed"}</span>
          </span>
        ) : (
          <span className={styles.leftLine}>
            {durText(now - movement.openedAt)}
            <span className={styles.phoneTimeWord}>in ED</span>
          </span>
        )
      }
      // The colour's words sit under the typed time ("within 1h"), never colour alone.
      time={typed.word}
      aria-label={`${name}, ${umrn}, ${legalFormName(legalForm)}, ${legalDeadlineText(movement, now)}${standingSuffix(typed)}`}
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
                      {fact.at !== undefined ? formatInstantWithDay(fact.at, now) : "To record"}
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
