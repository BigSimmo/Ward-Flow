"use client";

import { createContext, useContext } from "react";

/**
 * The device time (epoch ms) of the shared workspace's last good read, 0 before one; null outside a
 * provider or in local mode. Kept out of the app context on purpose: a read moves it every few
 * seconds, and only the few readers that report freshness (the downtime pack's last sync) should
 * wake for that.
 */
export const WardSharedReceivedAtContext = createContext<number | null>(null);

export function useWardSharedReceivedAt(): number | null {
  return useContext(WardSharedReceivedAtContext);
}
