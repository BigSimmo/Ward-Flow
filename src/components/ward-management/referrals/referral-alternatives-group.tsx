"use client";

import { useState } from "react";
import { Signpost } from "lucide-react";
import { Button } from "@/components/wf";
import { CardHead } from "./ward-referral-drawer-fields";
import drawer from "./ward-referral-drawer.module.css";
import styles from "./referral-alternatives.module.css";
import {
  ADMISSION_ALTERNATIVE_LABELS,
  ADMISSION_ALTERNATIVE_OPTIONS,
  ADMISSION_ALTERNATIVE_OUTCOME_LABELS,
  ADMISSION_ALTERNATIVE_OUTCOMES,
  ALTERNATIVES_LOCAL_NOTE,
  alternativesLines,
  alternativesSummary,
} from "./referral-alternatives";
import type { ReferralAlternativesState } from "./use-referral-alternatives";

/**
 * Feature 26: "Alternatives considered", optional, on an ED or community request for a ward bed.
 * Five options in a fixed order, each marked Not suitable, Tried or Declined by patient, or left
 * unmarked (press the chosen mark again to clear it). Never ranked, never required, never advice.
 */
export function ReferralAlternativesGroup({ sectionId, a }: { sectionId: string; a: ReferralAlternativesState }) {
  const [editing, setEditing] = useState(true);
  if (!a.applies) return null;
  const marked = a.list.length;
  const open = editing || marked === 0;
  const titleId = `${sectionId}-alternatives-title`;
  return (
    <section
      className={drawer.refCard}
      id={`${sectionId}-alternatives`}
      aria-labelledby={titleId}
      data-testid="referral-alternatives"
    >
      <CardHead icon={Signpost} title="Alternatives considered" titleId={titleId}>
        <span className={drawer.asideText} data-testid="referral-alternatives-summary">
          {marked === 0 ? "Optional" : alternativesSummary(a.list)}
        </span>
      </CardHead>
      <div className={drawer.cardBody}>
        {open ? (
          <>
            <p className={styles.lede}>
              Listed in a fixed order, not ranked. Marking is optional and never blocks Send.
            </p>
            <ul className={styles.rows}>
              {ADMISSION_ALTERNATIVE_OPTIONS.map((option) => {
                const labelId = `${sectionId}-alt-${option}`;
                const current = a.marks[option];
                return (
                  <li key={option} className={styles.row}>
                    <span id={labelId} className={styles.label}>
                      {ADMISSION_ALTERNATIVE_LABELS[option]}
                    </span>
                    <div className={styles.chips} role="group" aria-labelledby={labelId}>
                      {ADMISSION_ALTERNATIVE_OUTCOMES.map((outcome) => (
                        <button
                          key={outcome}
                          type="button"
                          className={styles.chip}
                          aria-pressed={current === outcome}
                          onClick={() => a.setMark(option, current === outcome ? undefined : outcome)}
                        >
                          {ADMISSION_ALTERNATIVE_OUTCOME_LABELS[outcome]}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <ul className={styles.summary} data-testid="referral-alternatives-lines">
            {alternativesLines(a.list).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        <div className={styles.foot}>
          <p className={styles.note}>{ALTERNATIVES_LOCAL_NOTE}</p>
          {marked > 0 ? (
            <Button size="sm" variant="ghost" onClick={() => setEditing(!open)} aria-expanded={open}>
              {open ? "Done" : "Change"}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
