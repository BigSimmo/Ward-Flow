"use client";

import type { ReactNode } from "react";
import { Button } from "./button";
import { cx, present } from "./cx";
import { SrOnly, Spinner } from "./primitives";
import { StatusGlyph, type WfTone } from "./status-glyph";
import styles from "./state.module.css";

export type StateKind = "empty" | "stale" | "error" | "clear" | "loading";

/** One action at most: Retry, Refresh or Show all. Rendered as a small secondary button. */
type StateAction = { label: string; onAction: () => void };

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
        /**
         * Loading (audit two B23): one quiet line while a lazy part loads inside a visible card, in
         * place of bare "Loading…" text. Defaults to "Loading". Takes no action.
         */
        kind: "loading";
        title?: ReactNode;
      }
    | {
        kind: Exclude<StateKind, "clear" | "loading">;
        /** What is true now: "Nobody waiting", "Transport did not load". */
        title: ReactNode;
      }
  );

/** Each state has one glyph shape (v9 section 9). The glyph carries the tone; the words stay neutral. */
const KIND_TONE: Record<Exclude<StateKind, "loading">, WfTone> = {
  empty: "neutral",
  stale: "warning",
  error: "danger",
  clear: "success",
};

/**
 * v9 shared state line for Empty, Stale, Error, All clear and Loading. One line: glyph, title, reason and at
 * most one action. No tinted fill and no coloured words. An error is an `alert`; the other kinds are
 * a polite `status`, so a page that swaps one in for its content tells assistive technology once.
 */
export function StateLine({ kind, title, reason, action, compact = false, className, ...data }: StateLineProps) {
  const loading = kind === "loading";
  const resolvedTitle = title ?? (kind === "clear" ? "All clear" : loading ? "Loading" : null);
  return (
    <div
      className={cx(styles.state, compact && styles.compact, loading && styles.loading, className)}
      role={kind === "error" ? "alert" : "status"}
      aria-busy={loading ? true : undefined}
      data-kind={kind}
      {...data}
    >
      {kind === "loading" ? <Spinner className={styles.loadingGlyph} /> : <StatusGlyph tone={KIND_TONE[kind]} />}
      <span className={styles.text}>
        <span className={cx(styles.title, (kind === "empty" || kind === "clear" || loading) && styles.calm)}>
          {resolvedTitle}
        </span>
        {present(reason) ? (
          <>
            <SrOnly>. </SrOnly>
            <span className={styles.reason}>{reason}</span>
          </>
        ) : null}
      </span>
      {action && !loading ? (
        <Button variant="sec" size="sm" className={styles.action} onClick={action.onAction}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
