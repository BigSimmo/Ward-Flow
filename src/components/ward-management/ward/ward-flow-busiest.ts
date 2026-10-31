"use client";

// My ward's Ward flow panel opens on its busiest list (approved 31 Oct 2026). Split out of
// `ward-home-tab.tsx` to keep that file under its line cap.

import { useEffect, useRef } from "react";

import type { WardFlowTab } from "./ward-home-tab-model";

const FLOW_TABS: readonly WardFlowTab[] = ["referrals", "admissions", "discharges"];

/** The list with the most rows; on a tie, the first in panel order (Referrals, Admissions, Discharges). */
function busiestFlowTab(counts: Readonly<Record<WardFlowTab, number>>): WardFlowTab {
  return FLOW_TABS.reduce((best, tab) => (counts[tab] > counts[best] ? tab : best));
}

/**
 * Once, when the ward first has any list, an empty chosen list gives way to the busiest one, instead
 * of opening on an empty Referrals list. A list that already has rows (picked by the person or named
 * in the address) is kept, and later changes in the counts never move the person's choice. The
 * caller shows the busiest list without writing it to the address, so arriving changes no URL.
 */
export function useBusiestFlowTabDefault(
  counts: Readonly<Record<WardFlowTab, number>>,
  flowTab: WardFlowTab,
  showBusiest: (next: WardFlowTab) => void,
): void {
  const picked = useRef(false);
  const busiest = busiestFlowTab(counts);
  const busiestCount = counts[busiest];
  const chosenCount = counts[flowTab];
  useEffect(() => {
    if (picked.current || busiestCount === 0) return;
    picked.current = true;
    if (chosenCount === 0 && busiest !== flowTab) showBusiest(busiest);
  }, [busiest, busiestCount, chosenCount, flowTab, showBusiest]);
}
