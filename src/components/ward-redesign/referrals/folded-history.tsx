"use client";

import { createContext, useContext, useId, type ComponentProps, type ReactNode } from "react";

import { ReferralHistoryAndCorrections } from "@/components/ward-management/referrals/referral-history-corrections";

import styles from "./referrals-redesign.module.css";

type Fold = { open: boolean; onToggle: () => void };

/** Present only where the decision pane folds the history; without it the history shows in full. */
const HistoryFoldContext = createContext<Fold | null>(null);

export function HistoryFoldProvider({ value, children }: { value: Fold; children: ReactNode }) {
  return <HistoryFoldContext.Provider value={value}>{children}</HistoryFoldContext.Provider>;
}

/**
 * The decision pane's other show-more controls ("Submitted documentation", "Referrer cancelled?")
 * are native disclosures from today's files. Wrapped in this, their summary row is drawn as the
 * same chevron row as Written history (Josh, 30 October 2026: one disclosure style in the pane).
 * `display: contents`, so the wrapper adds no box and the layout around them is unchanged.
 */
export function Disclosure({ children }: { children: ReactNode }) {
  if (children === null || children === undefined || children === false) return null;
  return <div className={styles.disclosure}>{children}</div>;
}

/**
 * Written history and Corrections behind one button, drawn exactly where the panel opens, so the
 * button and what it reveals sit together. The Timeline tab still shows them in full.
 */
export function FoldedHistory(props: ComponentProps<typeof ReferralHistoryAndCorrections>) {
  const fold = useContext(HistoryFoldContext);
  const panelId = useId();
  if (fold === null) return <ReferralHistoryAndCorrections {...props} />;
  return (
    <>
      <button
        type="button"
        className={styles.disclosureRow}
        aria-expanded={fold.open}
        aria-controls={fold.open ? panelId : undefined}
        aria-label={`${fold.open ? "Hide" : "Show"} written history and corrections`}
        onClick={fold.onToggle}
      >
        Written history and corrections
      </button>
      {fold.open ? (
        <div id={panelId}>
          <ReferralHistoryAndCorrections {...props} />
        </div>
      ) : null}
    </>
  );
}
