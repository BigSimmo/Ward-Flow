"use client";

import { ChevronDown } from "lucide-react";
import { createContext, useContext, useId, type ComponentProps, type ReactNode } from "react";

import { ReferralHistoryAndCorrections } from "@/components/ward-management/referrals/referral-history-corrections";
import { buttonClass } from "@/components/wf";

import styles from "./referrals-redesign.module.css";

type Fold = { open: boolean; onToggle: () => void };

/** Present only where the decision pane folds the history; without it the history shows in full. */
const HistoryFoldContext = createContext<Fold | null>(null);

export function HistoryFoldProvider({ value, children }: { value: Fold; children: ReactNode }) {
  return <HistoryFoldContext.Provider value={value}>{children}</HistoryFoldContext.Provider>;
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
        className={buttonClass({ variant: "ghost", size: "sm", className: styles.historyToggle })}
        aria-expanded={fold.open}
        aria-controls={fold.open ? panelId : undefined}
        aria-label={`${fold.open ? "Hide" : "Show"} written history and corrections`}
        onClick={fold.onToggle}
      >
        Written history and corrections
        <ChevronDown size={14} aria-hidden="true" className={styles.historyChevron} data-open={fold.open} />
      </button>
      {fold.open ? (
        <div id={panelId}>
          <ReferralHistoryAndCorrections {...props} />
        </div>
      ) : null}
    </>
  );
}
