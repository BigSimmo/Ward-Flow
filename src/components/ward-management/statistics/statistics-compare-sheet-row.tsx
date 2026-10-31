"use client";

/**
 * Compare's phone "Compare two wards" row: a copy of the shared `PhoneSheetRow` and `PhoneNavRow`
 * (`ward-management/statistics/statistics-phone-parts.tsx`) whose second line wraps in full. The
 * shared row cuts that line with "…", which hid the second ward's name on a 390 phone (a phone has
 * no hover). It goes once the shared row's second line wraps (statistics-phone-parts.tsx is shared by
 * every Statistics page, so that change is left to its own pull request).
 */
import { useState, type ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

import { IconTile, PhoneSheet } from "@/components/wf";
import { phoneBodyStyles as styles } from "./statistics-phone-parts";

import compare from "./statistics-compare.module.css";

/** A nav row whose target is a bottom sheet; its title and its one line wrap rather than cut. */
export function CompareSheetRow({
  icon,
  title,
  sub,
  sheetTitle,
  description,
  children,
  testId,
}: {
  icon: LucideIcon;
  title: string;
  sub?: ReactNode;
  sheetTitle?: string;
  description?: string;
  children: ReactNode;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={styles.navRow}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        data-testid={testId}
      >
        <IconTile icon={icon} />
        <span className={styles.navText}>
          <b>{title}</b>
          {sub ? <span className={compare.navSubWrap}>{sub}</span> : null}
        </span>
        <ChevronRight size={16} aria-hidden="true" className={styles.navGo} />
      </button>
      <PhoneSheet open={open} onClose={() => setOpen(false)} title={sheetTitle ?? title} description={description}>
        <div className={styles.sheetBody}>{children}</div>
      </PhoneSheet>
    </>
  );
}
