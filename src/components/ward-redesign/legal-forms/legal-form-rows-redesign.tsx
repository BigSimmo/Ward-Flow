"use client";

// Preview only: the row components of the Legal forms fork, split out to keep each file under the line cap.

import { DataRow, PhoneListRow, StatusGlyph, cx, tableClasses } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useDueSoonThresholds } from "@/components/ward-management/ward-flow-provider";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { Movement } from "@/components/ward-management/ward-model";

import {
  currentLegalDueAt,
  legalDeadlineText,
  legalFormRowClassification,
} from "@/components/ward-management/legal-forms/legal-forms-derivations";
import { formProgression } from "@/components/ward-management/legal-forms/legal-form-progression";
import {
  clockStanding,
  durText,
  formTitle,
  isActNow,
  isOwnedLegalFormCode,
  recordedFacts,
  type RecordGap,
} from "@/components/ward-management/legal-forms/legal-forms-view";
import styles from "@/components/ward-management/legal-forms/legal-forms.module.css";
import { standingSuffix, typedTimeStanding } from "./typed-time-words";

/**
 * FORMS (renamed from Legal forms, owner 9 Oct 2026; built from the approved v4 mockup). Live work for each
 * patient on a Mental Health Act form. The hero answers and carries the highlight chips; three cards under it
 * count what is still to record on the form and who is still to be told; the table lists everyone on a form in
 * two groups that are never ordered against each other. Desktop shows the hero and the list at full width (D-77
 * change 5): the record-and-tell strip sits behind the phone's sheet only, and a chosen patient's form opens in
 * a drawer over the list. Form times live in Tools. Review,
 * rates, audit, registers and reports live on Governance. Owner rules kept: no invented deadlines or section
 * numbers (D5), an unconnected action says "Not wired in this prototype." (D4), and a highlight never hides a row.
 */

/**
 * Redesign: the form's name as the list shows it. Only names too long for a table cell are
 * shortened, and the number tag beside it always names the form; the full title stays in the record
 * and in the cell's tooltip.
 */
const SHORT_TITLES: Partial<Record<string, string>> = { "1A": "Referral for examination" };
function shortFormTitle(code: string): string {
  return SHORT_TITLES[code] ?? formTitle(code);
}

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
  const typed = typedTimeStanding(movement, now, thresholds);
  const dueAt = currentLegalDueAt(movement);
  // Decision 1 (Josh, 30 Oct): the spoken line says the typed time and its warning too, never a countdown.
  const reason =
    dueAt !== undefined && !formProgression(movement)
      ? `Ends ${formatInstantWithDay(dueAt, now)} as typed${standingSuffix(typed)}`
      : legalDeadlineText(movement, now);
  const facts = recordedFacts(movement);
  const done = facts.filter((fact) => fact.at !== undefined).length;
  const missing = facts.filter((fact) => fact.at === undefined).map((fact) => TO_RECORD_WORD[fact.gap]);
  const canAddTime = movement.formedAt === undefined && isOwnedLegalFormCode(legalForm.code);
  // Audit S-6: an ended form's typed expiry is history, so the row shows it ended, not a countdown.
  const progression = formProgression(movement);
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
          {shortFormTitle(legalForm.code)}
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
            {/* Decision 1 (Josh, 30 Oct; D5, D-70): the typed time, said to be typed, with no countdown.
                Its colour compares the typed time with the user's warning settings and always comes
                with its words ("within 1h", "within 3h", "passed"). */}
            <span className={styles.leftLine}>
              <StatusGlyph tone={typed.tone} size={9} />
              <strong className={styles.leftValue}>Ends {formatInstantWithDay(dueAt!, now)}</strong>
            </span>
            <span className={styles.sub}>as typed{standingSuffix(typed)}</span>
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
 * Phone row (v10): the code chip, the name, the form and where, with the typed end time at the end.
 * The whole row opens the form sheet; an act now row takes the thin red edge, a dimmed row recedes
 * by colour only.
 */
export function PhoneFormRow({ movement, now, name, umrn, edName, wardName, dimmed, onSelect }: FormRowProps) {
  const thresholds = useDueSoonThresholds();
  const legalForm = movement.legalForm!;
  const standing = clockStanding(movement, now, thresholds);
  const typed = typedTimeStanding(movement, now, thresholds);
  const facts = recordedFacts(movement);
  const missing = facts.filter((fact) => fact.at === undefined).length;
  const where = wardName ? `${edName} to ${wardName}` : edName;
  const dueAt = currentLegalDueAt(movement);
  const hasDue = dueAt !== undefined;
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
          <span className={styles.phoneMetaLine}>{shortFormTitle(legalForm.code)}</span>
          <span className={styles.phoneMetaLine}>
            {where}
            {missing > 0 ? ` · ${missing} to record` : ""}
          </span>
        </>
      }
      // Josh's no-wrap rule: the time and "as typed" sit on one line, not stacked.
      value={
        hasDue ? (
          <span className={styles.leftLine}>
            <StatusGlyph tone={typed.tone} size={9} />
            {/* Point 18: the typed time, not a countdown. */}
            {formatInstantWithDay(dueAt!, now)}
            <span className={styles.phoneTimeWord}>as typed</span>
          </span>
        ) : (
          <span className={styles.leftLine}>
            {durText(now - movement.openedAt)}
            <span className={styles.phoneTimeWord}>in ED</span>
          </span>
        )
      }
      // Decision 1: the colour's words sit under the typed time ("within 1h"), never colour alone.
      time={hasDue ? typed.word : undefined}
      aria-label={`${name}, ${umrn}, ${legalFormName(legalForm)}, ${
        hasDue
          ? `ends ${formatInstantWithDay(dueAt!, now)} as typed${standingSuffix(typed)}`
          : legalDeadlineText(movement, now)
      }`}
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
