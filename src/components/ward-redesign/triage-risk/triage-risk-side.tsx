"use client";

/**
 * Triage and risk mock-up: the left column's live blocks under the section index (7 Nov 2026). A
 * short Before you sign checklist that jumps to each field, a Now box (urgency, legal status as
 * typed, current risk flags and alerts) and the Summary button, which replaces the floating one so
 * nothing on the form is covered. On a phone the Now box sits in the summary sheet instead. No
 * computed legal times and no scores. Synthetic data only.
 */
import { useId } from "react";

import { Badge, Button, StatusGlyph } from "@/components/wf";

import { LEGAL, TIER_LONG } from "./triage-risk-data";
import { allFactors, type Requirement, type Target, type TriageState } from "./triage-risk-state";
import type { SectionId } from "./triage-risk-data";
import styles from "./triage-risk-side.module.css";

const LEGAL_NAME: Readonly<Record<string, string>> = Object.fromEntries(LEGAL);
const CHECKLIST_LIMIT = 5;

/** What is left, needed first: up to five, each going to its field, then "+n more" for the summary. */
export function SignChecklist({
  reqs,
  jump,
  onMore,
}: {
  reqs: readonly Requirement[];
  jump: (section: SectionId, target?: Target) => void;
  onMore: () => void;
}) {
  const left = [...reqs.filter((r) => r.blocks && !r.ok), ...reqs.filter((r) => !r.blocks && !r.ok)];
  const shown = left.slice(0, CHECKLIST_LIMIT);
  const more = left.length - shown.length;
  const headId = useId();
  return (
    <section className={styles.block} aria-labelledby={headId} data-testid="triage-side-checklist">
      <h2 className={styles.head} id={headId}>
        Before you sign
      </h2>
      {shown.length ? (
        <ul className={styles.list}>
          {shown.map((r, index) => (
            <li key={`${index}-${r.label}`}>
              <button type="button" className={styles.item} onClick={() => jump(r.section, r.target)}>
                <StatusGlyph tone={r.blocks ? "neutral" : "warning"} size={8} />
                <span>{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.ready}>
          <StatusGlyph tone="success" size={10} />
          Ready to sign
        </p>
      )}
      {more > 0 ? (
        <button type="button" className={styles.more} onClick={onMore} aria-haspopup="dialog">
          +{more} more
        </button>
      ) : null}
    </section>
  );
}

/** The triage at a glance: the clinician's urgency, legal status as typed, current flags and alerts. */
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
        Summary · {signed ? "signed" : left ? `${left} needed` : "ready"}
      </Button>
    </div>
  );
}
