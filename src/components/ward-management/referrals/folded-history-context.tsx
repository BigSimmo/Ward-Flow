"use client";

/**
 * The history fold context on its own, so the referral board can provide it without loading the
 * history and corrections panel, which only the lazy match view draws (#1467).
 */
import { createContext, type ReactNode } from "react";

type Fold = { open: boolean; onToggle: () => void };

/** Present only where the decision pane folds the history; without it the history shows in full. */
export const HistoryFoldContext = createContext<Fold | null>(null);

export function HistoryFoldProvider({ value, children }: { value: Fold; children: ReactNode }) {
  return <HistoryFoldContext.Provider value={value}>{children}</HistoryFoldContext.Provider>;
}
