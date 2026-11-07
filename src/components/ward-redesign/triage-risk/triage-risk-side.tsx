"use client";

/**
 * Triage and risk mock-up: the left column's blocks under the section index (7 Nov 2026). The last
 * triage at a glance and the Summary button, which replaces the floating one so nothing on the form
 * is covered. Josh (7 Nov) dropped the Before you sign checklist and the Now box here: both
 * repeated what the index and the banner already show. On a phone the Now box sits in the summary sheet instead. No
 * computed legal times and no scores. Synthetic data only.
 */
import { useId } from "react";

import { Button } from "@/components/wf";

import { FACTOR_NAME, LAST_TRIAGE } from "./triage-risk-data";
import { sinceLastText, type TriageState } from "./triage-risk-state";
import styles from "./triage-risk-side.module.css";

/**
 * The last triage at a glance (Josh, 7 Nov 2026), in place of the Now box, which repeated the
 * banner: what was decided last time, the flags carried, and what differs today, so today's
 * triage can be compared without opening a tab. Recorded facts only; nothing is computed.
 */
export function LastTriageGlance({ state, onOpen }: { state: TriageState; onOpen: () => void }) {
  const headId = useId();
  if (!state.person.lastTriage) {
    return (
      <section className={styles.block} aria-labelledby={headId} data-testid="triage-last-glance">
        <h2 className={styles.head} id={headId}>
          Last triage
        </h2>
        <p className={styles.quiet}>No previous triage on record. Past risk is answered fresh today.</p>
      </section>
    );
  }
  const since = sinceLastText(state);
  const urgencyToday = state.urgency && state.urgency !== LAST_TRIAGE.urgency ? `Today: ${state.urgency}` : null;
  return (
    <section className={styles.block} aria-labelledby={headId} data-testid="triage-last-glance">
      <h2 className={styles.head} id={headId}>
        Last triage · {LAST_TRIAGE.when}
      </h2>
      <dl className={styles.facts}>
        <div>
          <dt>Urgency then</dt>
          <dd>
            {LAST_TRIAGE.urgencyText}
            {urgencyToday ? <span className={styles.quiet}> · {urgencyToday}</span> : null}
          </dd>
        </div>
        <div>
          <dt>Outcome</dt>
          <dd>{LAST_TRIAGE.outcome}</dd>
        </div>
        <div>
          <dt>Flags then</dt>
          {/* Plain text, not tags: names wrap in full in the narrow column. */}
          <dd>{LAST_TRIAGE.pastFlags.map((k) => FACTOR_NAME[k]).join(" · ")}</dd>
        </div>
        {since ? (
          <div>
            <dt>Changed today</dt>
            <dd>{since}</dd>
          </div>
        ) : null}
      </dl>
      <Button variant="ghost" size="sm" className={styles.open} onClick={onOpen} aria-haspopup="dialog">
        Open last triage
      </Button>
    </section>
  );
}

export function SideSummary({ left, signed, onOpen }: { left: number; signed: boolean; onOpen: () => void }) {
  return (
    <div className={styles.summary}>
      <Button className={styles.summaryButton} onClick={onOpen} aria-haspopup="dialog">
        Summary · {signed ? "signed" : left ? `${left} left` : "ready"}
      </Button>
    </div>
  );
}
