"use client";

import type { SignOffCheck } from "@/components/ward-management/handover/handover-panels";
import { Button, StatusGlyph, type SinceItem } from "@/components/wf";

import styles from "./handover-redesign.module.css";

/**
 * Since previous handover as one line of figures, not four tiles that mostly read 0. A figure of
 * 0 is still said, once, so nothing reads as missing. The hero's Changed since chip still hides it.
 */
export function SinceLine({ since, items }: { since: string; items: SinceItem[] }) {
  return (
    <section className={styles.sinceLine} data-testid="ward-handover-since" aria-labelledby="handover-since-title">
      <h2 id="handover-since-title" className={styles.sinceTitle}>
        Since previous handover <span className={styles.mono}>{since}</span>
      </h2>
      <ul className={styles.sinceItems}>
        {items.map((item) => (
          <li key={item.id} title={typeof item.detail === "string" ? item.detail : undefined}>
            <StatusGlyph tone={item.value === 0 ? "neutral" : (item.tone ?? "neutral")} size={8} />
            <b className={styles.mono}>{item.value}</b> {item.word}
            {item.value > 0 && typeof item.detail === "string" && item.detail !== "None" ? (
              <span className={styles.sinceDetail}> · {item.detail}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The sign-off bar: stays at the foot of the screen while the 70-row table scrolls, so the checks
 * are never 70 rows away. It shows how many are clear, names the ones still open, and either signs
 * off (the same command the panel sends) or opens the panel when a check needs a look first.
 */
export function SignOffBar({
  checks,
  title,
  signedLine,
  cannotSignReason,
  onSignOff,
  onOpenPanel,
}: {
  checks: SignOffCheck[];
  title: string;
  signedLine: string | null;
  /** Why Sign off is unavailable now, as the panel says it; undefined when it can be pressed. */
  cannotSignReason?: string;
  onSignOff: () => void;
  onOpenPanel: () => void;
}) {
  const done = checks.filter((check) => check.done).length;
  const open = checks.filter((check) => !check.done);
  return (
    <div className={styles.signBar} role="region" aria-label="Sign off" data-testid="redesign-handover-sign-bar">
      <div className={styles.signLead}>
        <b>{title}</b>
        <span className={styles.signCount}>
          <StatusGlyph tone={open.length === 0 ? "success" : "warning"} size={9} /> {done} of {checks.length} checks
          clear
        </span>
      </div>
      {signedLine ? (
        <span className={styles.signOpen}>{signedLine}</span>
      ) : open.length > 0 ? (
        <ul className={styles.signOpen} aria-label="Still open">
          {open.map((check) => (
            <li key={check.id}>{check.text}</li>
          ))}
        </ul>
      ) : (
        <span className={styles.signOpen}>Every check is clear</span>
      )}
      <div className={styles.signActions}>
        <Button variant="ghost" size="sm" onClick={onOpenPanel}>
          Open checklist
        </Button>
        {signedLine ? null : (
          <Button variant="pri" size="sm" onClick={onSignOff} disabledReason={cannotSignReason}>
            Sign off
          </Button>
        )}
      </div>
    </div>
  );
}

/** The row under a long group that shows the rest of it. Nothing when nothing is hidden. */
export function ShowMoreRow({
  hidden,
  span,
  open,
  what,
  onToggle,
}: {
  hidden: number;
  span: number;
  open: boolean;
  what: string;
  onToggle: () => void;
}) {
  if (hidden <= 0) return null;
  return (
    <tr className={styles.moreRow}>
      <td colSpan={span}>
        <button type="button" aria-expanded={open} onClick={onToggle}>
          {open ? "Show fewer" : `Show ${hidden} more ${what}`}
        </button>
      </td>
    </tr>
  );
}

/** Why sign-off waits, in the panel's own words: a passed handover, or one not next in line. */
export function signOffWaitReason(passed: boolean, nextShift: boolean): string | undefined {
  if (passed) return "This handover has passed. Choose the next one.";
  if (!nextShift) return "Sign-off opens after the preceding handover. Choose the next handover to sign off now.";
  return undefined;
}
