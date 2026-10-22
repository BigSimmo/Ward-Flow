"use client";

import { PhoneListRow, StatusGlyph } from "@/components/wf";
import type { Movement } from "@/components/ward-management/ward-model";
import { recordedFacts } from "./legal-forms-view";
import styles from "./legal-forms.module.css";

/**
 * Phone checklist (v10): one row per person, the code chip first, what is still to record under
 * the name and the recorded count at the end. The whole row opens the form sheet.
 */
export function PhoneChecklist({
  rows,
  nameOf,
  umrnOf,
  isHighlighted,
  highlightOn,
  onSelect,
}: {
  rows: Movement[];
  nameOf: (movement: Movement) => string;
  umrnOf: (movement: Movement) => string;
  isHighlighted: (movement: Movement) => boolean;
  highlightOn: boolean;
  onSelect: (movement: Movement) => void;
}) {
  return (
    <ul className={styles.phoneList} aria-label="Checklist">
      {rows.map((movement) => {
        const facts = recordedFacts(movement);
        const missing = facts.filter((fact) => fact.at === undefined);
        const done = facts.length - missing.length;
        const dimmed = highlightOn && !isHighlighted(movement);
        return (
          <PhoneListRow
            key={movement.id}
            as="li"
            className={styles.phoneRow}
            {...(dimmed ? { "data-dim": "true" } : {})}
            leading={<span className={styles.code}>{movement.legalForm?.code}</span>}
            name={nameOf(movement)}
            meta={
              facts.length === 0
                ? "Nothing to record for this form"
                : missing.length === 0
                  ? "Everything recorded"
                  : `To do ${missing.map((fact) => fact.label).join(", ")}`
            }
            value={
              facts.length === 0 ? undefined : (
                <span className={styles.leftLine}>
                  <StatusGlyph tone={missing.length === 0 ? "success" : "neutral"} size={9} />
                  {done}/{facts.length}
                </span>
              )
            }
            time={facts.length === 0 ? undefined : "recorded"}
            aria-label={`${nameOf(movement)}, ${umrnOf(movement)}, ${facts.length === 0 ? "nothing to record for this form" : `${done} of ${facts.length} recorded`}`}
            onSelect={() => onSelect(movement)}
          />
        );
      })}
    </ul>
  );
}
