"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Where the Summary's Bed board, Journey and Map switch is drawn (owner polish, 3 Nov 2026): in the
 * head of each view's first card, not on a row of its own. Kept apart from the switch itself so the
 * cards that draw it pull in nothing else.
 */

/** The switch, offered to the Summary's views (`StatisticsViewSwitch`). */
export const ViewSwitchHost = createContext<ReactNode>(null);
/** The switch, handed only to the part of a view that leads it (`LeadsViewSwitch`). */
const ViewSwitchLead = createContext<ReactNode>(null);

/** Marks the part of a view whose first card carries the Bed board, Journey and Map switch. */
export function LeadsViewSwitch({ children }: { children: ReactNode }) {
  return <ViewSwitchLead.Provider value={useContext(ViewSwitchHost)}>{children}</ViewSwitchLead.Provider>;
}

/**
 * For the first card of a Summary view (and its loading or unavailable stand-in): the switch to draw
 * in its head's action slot. Nothing outside the Summary, or in any card after the first.
 */
export function useViewSwitchAction(): ReactNode {
  return useContext(ViewSwitchLead);
}
