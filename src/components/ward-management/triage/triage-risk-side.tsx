"use client";

/**
 * Triage and risk: the sign-off rail (redesign, 13 Nov 2026). On a desktop it is the left column
 * (Josh, 13 Nov 2026: the nav reads more naturally on the left) and stays in view while the form
 * scrolls; on a tablet it sits after the form.
 * One card holds what used to be four places: the section list, the progress bar, "N left before
 * signing" with Show what's left, and Sign and send. Each section is one row (a tinted number chip,
 * the title over one quiet line of what is still open, the count on the right edge) and goes to its
 * first open item. Nothing here is new information: every word comes from the form's own checks.
 * Synthetic data only.
 */
import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { Button, Card, CardHead, Icon, Meter, SrOnly } from "@/components/wf";

import { SECTIONS, type SectionId } from "./triage-risk-data";
import type { Requirement, SectionStatus, Target } from "./triage-risk-state";
import styles from "./triage-risk-side.module.css";

/** The names of a section's open items: the first three, then "+N". Items to check read quieter. */
function OpenNames({ items }: { items: readonly Requirement[] }) {
  const shown = items.slice(0, 3);
  return (
    <>
      {shown.map((r, index) => (
        <span key={`${index}-${r.label}`} className={r.blocks ? undefined : styles.soft}>
          {index ? ", " : ""}
          {r.label}
        </span>
      ))}
      {items.length > shown.length ? <span className={styles.soft}> +{items.length - shown.length}</span> : null}
    </>
  );
}

const PARTS = [
  { part: "triage", title: "Triage", code: "SMHMR900" },
  { part: "risk", title: "Risk", code: "SMHMR905" },
] as const;

export function SignRail({
  reqs,
  status,
  active,
  left,
  percent,
  signed,
  signedLine,
  doneLine,
  onJump,
  onSummary,
  signButton,
}: {
  reqs: readonly Requirement[];
  status: Readonly<Record<SectionId, SectionStatus>>;
  /** The section in view. */
  active: SectionId;
  /** Needed answers still missing. */
  left: number;
  /** Whole percent of the needed answers that are in. */
  percent: number;
  signed: boolean;
  /** "13/11/2026 10:42 by Dr S. Chen", once signed. */
  signedLine?: string;
  /** A finished section's facts in one line, where the form has one. */
  doneLine: (section: SectionId) => string;
  onJump: (section: SectionId, target?: Target) => void;
  onSummary: () => void;
  /** Sign and send, with its own reasons when it cannot be pressed. Left out once signed. */
  signButton: ReactNode;
}) {
  const sectionsDone = SECTIONS.filter((s) => status[s.id].done).length;
  return (
    <aside className={styles.rail} aria-label="Before you sign" data-testid="triage-sign-rail">
      <Card as="div" className={styles.card}>
        <CardHead
          title={signed ? "Signed" : left ? "Before you sign" : "Ready to sign"}
          meta={
            signed ? (
              signedLine
            ) : left ? (
              <>
                <b className={styles.mono}>{left}</b> left
              </>
            ) : (
              "Everything needed is in"
            )
          }
        />
        <div className={styles.progress}>
          <Meter value={percent} max={100} fill={left ? "data-1" : "success"} label="Needed answers in" />
          <span>
            <b className={styles.mono}>{sectionsDone}</b> of {SECTIONS.length} sections done
          </span>
        </div>
        {PARTS.map(({ part, title, code }) => (
          <div key={part} className={styles.group} role="group" aria-label={`${title}, ${code}`}>
            <p className={styles.groupHead}>
              <span>{title}</span>
              <span className={styles.mono}>{code}</span>
            </p>
            <ul className={styles.rows}>
              {SECTIONS.filter((s) => s.part === part).map((s) => {
                const state = status[s.id];
                const open = reqs.filter((r) => r.section === s.id && !r.ok);
                // Needed items first, then the ones to check, each in the form's order.
                const ordered = [...open.filter((r) => r.blocks), ...open.filter((r) => !r.blocks)];
                const first = ordered[0];
                const line = state.done && !ordered.length ? doneLine(s.id) : "";
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={styles.row}
                      data-done={state.done ? "" : undefined}
                      data-rail-section={s.id}
                      aria-current={active === s.id ? "location" : undefined}
                      onClick={() => onJump(s.id, first?.target)}
                    >
                      <span className={styles.chip} aria-hidden="true">
                        {state.done ? <Icon icon={Check} size={16} /> : s.n}
                      </span>
                      <span className={styles.text}>
                        <span className={styles.title}>{s.label}</span>
                        <span className={styles.line}>
                          {ordered.length ? <OpenNames items={ordered} /> : line || "Done"}
                        </span>
                      </span>
                      {state.needed ? (
                        <span className={styles.count}>
                          {state.needed}
                          <SrOnly> needed</SrOnly>
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div className={styles.foot} data-testid={signed ? undefined : "triage-sign-foot"}>
          <Button className={styles.summary} onClick={onSummary} aria-haspopup="dialog">
            Summary
          </Button>
          {signButton}
        </div>
      </Card>
    </aside>
  );
}
