"use client";

import { useEffect, type ReactNode } from "react";
import { enterStatisticsDisplayPrefScope } from "./ward-statistics-display-pref-session";

/**
 * WF-31: wrap statistics routes so theme / rail / glare changes while here stay route-scoped and
 * restore the prior persisted prefs on leave. No prefs are written to storage by this component.
 */
export function WardStatisticsDisplayPrefs({ children }: { children: ReactNode }) {
  useEffect(() => enterStatisticsDisplayPrefScope(), []);
  return children;
}
