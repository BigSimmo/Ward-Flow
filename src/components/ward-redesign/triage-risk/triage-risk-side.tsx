"use client";

/**
 * Triage and risk mock-up: the left column's live blocks under the section index (7 Nov 2026). A
 * Now box (urgency, legal status as typed, current risk flags and alerts) and the Summary button,
 * which replaces the floating one so nothing on the form is covered. Josh (7 Nov) dropped the
 * Before you sign checklist here: it repeated the index's own status. On a phone the Now box sits in the summary sheet instead. No
 * computed legal times and no scores. Synthetic data only.
 */
import { useId } from "react";

import { Badge, Button } from "@/components/wf";

import { LEGAL, TIER_LONG } from "./triage-risk-data";
import { allFactors, type TriageState } from "./triage-risk-state";
import styles from "./triage-risk-side.module.css";

const LEGAL_NAME: Readonly<Record<string, string>> = Object.fromEntries(LEGAL);

export function NowBox({ state }: { state: TriageState }) {
  const person = state.person;
  const flags = allFactors(state).filter((f) => f.kind === "now" && f.mark === "y");
  const legal = state.legal ? LEGAL_NAME[state.legal] : person.legal ? `${person.legal} (on record)` : "Not recorded";
  const headId = useId();
  return (
    <section className={styles.block} aria-labelledby={headId} data-testid="triage-now-box">
      <h2 className={styles.head} id={headId}>
        Now
      </h2>
      <dl className={styles.facts}>
        <div>
          <dt>Urgency</dt>
          <dd>{state.urgency ? `${state.urgency} · ${TIER_LONG[state.urgency]}` : "Not chosen"}</dd>
        </div>
        <div>
          <dt>Legal</dt>
          <dd>
            {legal}
            <span className={styles.quiet}> As typed. Not legally checked.</span>
          </dd>
        </div>
        <div>
          <dt>Current risk</dt>
          <dd>
            {flags.length ? (
              <span className={styles.chips}>
                {flags.map((f) => (
                  <Badge key={f.key} size="sm">
                    {f.name}
                  </Badge>
                ))}
              </span>
            ) : (
              "None flagged"
            )}
          </dd>
        </div>
        <div>
          <dt>Alerts</dt>
          <dd>
            {person.alert
              ? `${person.alert}${person.alertCount > 1 ? `, +${person.alertCount - 1} more` : ""}`
              : "None on record"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

/** The Summary button, at the foot of the left column. */
export function SideSummary({ left, signed, onOpen }: { left: number; signed: boolean; onOpen: () => void }) {
  return (
    <div className={styles.summary}>
      <Button className={styles.summaryButton} onClick={onOpen} aria-haspopup="dialog">
        Summary · {signed ? "signed" : left ? `${left} left` : "ready"}
      </Button>
    </div>
  );
}
