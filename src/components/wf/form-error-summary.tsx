"use client";

import { useEffect, useId, useRef } from "react";
import { cx } from "./cx";
import { StatusGlyph } from "./status-glyph";
import styles from "./form.module.css";

export type ErrorSummaryItem = {
  /** The id of the control to move to. */
  id: string;
  /** What to do, in plain words ("Choose a movement"). */
  text: string;
};

export type ErrorSummaryProps = {
  /** Every problem, in the order the fields appear. Nothing shows when the list is empty. */
  items: readonly ErrorSummaryItem[];
  /** The end of the heading: "before saving" gives "2 things to fix before saving". */
  action: string;
  /** Change it on each refused submit (a counter) to move focus to the heading. 0 never moves focus. */
  focusKey?: number;
  headingLevel?: 2 | 3 | 4;
  className?: string;
};

/**
 * One short list at the top of a form after a refused submit: a counted heading and a link to
 * each field that needs an answer. Focus moves to the heading (tabindex -1) so a screen reader
 * reads the count first; each link moves focus to its field. It adds nothing to the URL.
 */
export function ErrorSummary({ items, action, focusKey = 0, headingLevel = 3, className }: ErrorSummaryProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const headingId = useId();
  const shown = items.length > 0;
  useEffect(() => {
    if (!focusKey || !shown) return;
    const heading = headingRef.current;
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView?.({ block: "nearest" });
  }, [focusKey, shown]);
  if (!shown) return null;
  const Heading = `h${headingLevel}` as const;
  return (
    <div className={cx(styles.summary, className)} role="group" aria-labelledby={headingId} data-error-summary="">
      <Heading ref={headingRef} id={headingId} tabIndex={-1} className={styles.summaryHead}>
        <StatusGlyph tone="danger" size={9} />
        {items.length} {items.length === 1 ? "thing" : "things"} to fix {action}
      </Heading>
      <ul className={styles.summaryList}>
        {items.map((item) => (
          <li key={`${item.id}:${item.text}`}>
            <a
              href={`#${item.id}`}
              className={styles.summaryLink}
              onClick={(event) => {
                event.preventDefault();
                const field = document.getElementById(item.id);
                if (!field) return;
                field.focus({ preventScroll: true });
                field.scrollIntoView?.({ block: "center" });
              }}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
