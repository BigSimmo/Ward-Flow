"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useIsPhone } from "./use-is-phone";
import styles from "./v10-parts.module.css";

/**
 * Phone fold for `SinceYouLooked` (v10, 11 Oct 2026): on a phone the digest starts as one summary
 * row with a chevron, and opens to the full digest on tap. Desktop and tablet render the digest as
 * before. A client part so `v10-parts.tsx` stays usable from server components.
 */
export function SinceYouLookedFold({
  summary,
  label,
  id,
  className,
  children,
}: {
  /** The summary line; null when nothing changed (the digest's own empty line shows instead). */
  summary: ReactNode;
  label: string;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);
  if (!isPhone || open || summary === null) return <>{children}</>;
  return (
    <section id={id} className={className} aria-label={label}>
      <button
        type="button"
        className={styles.sinceRow}
        aria-expanded={false}
        onClick={() => setOpen(true)}
        data-testid="wf-since-summary"
      >
        <span className={styles.sinceRowText}>{summary}</span>
        <ChevronDown className={styles.sinceRowChevron} size={16} aria-hidden="true" />
      </button>
    </section>
  );
}
