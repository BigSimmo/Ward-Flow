"use client";

// The list behind a figure (feature plan item 5), fetched on first use by `count-breakdown.tsx`.
import Link from "next/link";
import { useLayoutEffect, useMemo, type RefObject } from "react";
import { ChevronRight } from "lucide-react";

import { Sheet } from "@/components/wf";
import type { Instant } from "@/components/ward-management/ward-clock";

import {
  breakdownSentence,
  breakdownView,
  type BreakdownKind,
  type BreakdownRow,
  type BreakdownScope,
} from "./count-breakdown-model";
import styles from "./count-breakdown.module.css";

type PanelProps = {
  value: number;
  noun: string;
  kind: BreakdownKind;
  scope: BreakdownScope;
  countedAt: Instant;
  rows: () => readonly BreakdownRow[];
};

export function CountBreakdownPanel({ value, noun, kind, scope, countedAt, rows }: PanelProps) {
  const view = useMemo(() => breakdownView({ value, kind, scope, rows: rows() }), [value, kind, scope, rows]);
  // The popover measured its short loading line when it opened; it refits on a window resize, so
  // ask it to refit now that the full list is in (a long list then gets its height cap and scroll).
  useLayoutEffect(() => {
    window.dispatchEvent(new Event("resize"));
  }, []);
  return (
    <div className={styles.body} data-testid="count-breakdown-panel">
      <p className={styles.sentence}>{breakdownSentence(value, noun, countedAt)}</p>
      {view.state === "list" ? (
        <ul className={styles.list} data-testid="count-breakdown-rows">
          {view.rows.map((row) => {
            const inner = (
              <>
                <span className={styles.main}>
                  <span className={styles.label}>{row.label}</span>
                  {row.detail ? <span className={styles.detail}>{row.detail}</span> : null}
                </span>
                {row.count !== undefined ? (
                  <span className={styles.count}>
                    <b>{row.count}</b>
                    {kind === "beds" ? " ready" : null}
                  </span>
                ) : null}
                {row.href ? <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" /> : null}
              </>
            );
            return (
              <li key={row.id} data-testid="count-breakdown-row">
                {row.href ? (
                  <Link href={row.href} className={styles.row}>
                    {inner}
                  </Link>
                ) : (
                  <span className={styles.row}>{inner}</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.note} data-testid={`count-breakdown-${view.state}`}>
          {view.state === "withheld"
            ? view.words
            : view.state === "none"
              ? kind === "beds"
                ? "No ward has one now."
                : "Nobody is counted in this figure now."
              : "This list does not add up to the figure, so it is not shown. Open the page the figure comes from."}
        </p>
      )}
    </div>
  );
}

/** Phone: the same list in a bottom sheet. */
export function CountBreakdownSheet({
  title,
  onClose,
  returnFocusRef,
  ...props
}: PanelProps & { title: string; onClose: () => void; returnFocusRef: RefObject<HTMLElement | null> }) {
  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      mobilePlacement="bottom"
      mobileSize="content"
      returnFocusRef={returnFocusRef}
      testId="count-breakdown-sheet"
    >
      <CountBreakdownPanel {...props} />
    </Sheet>
  );
}
