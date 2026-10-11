"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { PhoneSheet } from "./phone";
import { useIsPhone } from "./use-is-phone";
import styles from "./v10-parts.module.css";

/**
 * Phone fold for `SinceYouLooked` (v10, 11 Oct 2026): on a phone the digest starts as one row, the
 * title "Since you looked" over a summary line with a chevron. A tap opens the digest in a phone
 * sheet, with Copy as handover text pinned in its foot. Desktop and tablet render the digest as
 * before. A client part so `v10-parts.tsx` stays usable from server components.
 */
export function SinceYouLookedFold({
  summary,
  label,
  id,
  className,
  sheetDescription,
  sheetBody,
  onCopy,
  children,
}: {
  /** The summary line under the row's title. */
  summary: ReactNode;
  label: string;
  id?: string;
  className?: string;
  /** The sheet's quiet line under its title ("At 07:00"). */
  sheetDescription?: ReactNode;
  /** The digest as phone rows, shown in the sheet. */
  sheetBody?: ReactNode;
  /** Copies the digest as handover text; pinned in the sheet's foot. */
  onCopy?: () => void;
  children: ReactNode;
}) {
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);
  if (!isPhone || summary === null) return <>{children}</>;
  return (
    <section id={id} className={className} aria-label={label}>
      <button
        type="button"
        className={styles.sinceRow}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        data-testid="wf-since-summary"
      >
        <span className={styles.sinceRowLines}>
          <span className={styles.sinceRowTitle}>Since you looked</span>
          <span className={styles.sinceRowText}>{summary}</span>
        </span>
        <ChevronDown className={styles.sinceRowChevron} size={16} aria-hidden="true" />
      </button>
      <PhoneSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Since you looked"
        description={sheetDescription}
        primary={onCopy ? { label: "Copy as handover text", onAction: onCopy } : undefined}
        data-testid="wf-since-sheet"
      >
        {sheetBody ?? children}
      </PhoneSheet>
    </section>
  );
}
