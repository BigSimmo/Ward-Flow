"use client";

import type { ReactNode } from "react";
import { Button } from "./button";
import { cx } from "./cx";
import { SrOnly } from "./primitives";
import { StatusGlyph, type WfTone } from "./status-glyph";
import styles from "./state.module.css";

export type StateKind = "empty" | "stale" | "error" | "clear";

/** One action at most: Retry, Refresh or Show all. Rendered as a small secondary button. */
export type StateAction = { label: string; onAction: () => void };

type StateLineBase = {
  /** Why, kept short: "No delays over target", "Updated 12m ago", "Check the connection". */
  reason?: ReactNode;
  action?: StateAction;
  /** Inside a card body: no edge or fill of its own, a shorter line. */
  compact?: boolean;
  className?: string;
  "data-testid"?: string;
};

export type StateLineProps = StateLineBase &
  (
    | {
        kind: "clear";
        /** Defaults to "All clear". */
        title?: ReactNode;
      }
    | {
        kind: Exclude<StateKind, "clear">;
        /** What is true now: "No one waiting", "Transport did not load". */
        title: ReactNode;
      }
  );

/** Each state has one glyph shape (v9 section 9). The glyph carries the tone; the words stay neutral. */
const KIND_TONE: Record<StateKind, WfTone> = {
  empty: "neutral",
  stale: "warning",
  error: "danger",
  clear: "success",
};

/**
 * v9 shared state line for Empty, Stale, Error and All clear. One line: glyph, title, reason and at
 * most one action. No tinted fill and no coloured words. An error is an `alert`; the other kinds are
 * a polite `status`, so a page that swaps one in for its content tells assistive technology once.
 */
export function StateLine({ kind, title, reason, action, compact = false, className, ...data }: StateLineProps) {
  const resolvedTitle = title ?? (kind === "clear" ? "All clear" : null);
  return (
    <div
      className={cx(styles.state, compact && styles.compact, className)}
      role={kind === "error" ? "alert" : "status"}
      data-kind={kind}
      {...data}
    >
      <StatusGlyph tone={KIND_TONE[kind]} />
      <span className={styles.text}>
        <span className={cx(styles.title, (kind === "empty" || kind === "clear") && styles.calm)}>{resolvedTitle}</span>
        {reason ? (
          <>
            <SrOnly>. </SrOnly>
            <span className={styles.reason}>{reason}</span>
          </>
        ) : null}
      </span>
      {action ? (
        <Button variant="sec" size="sm" className={styles.action} onClick={action.onAction}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
