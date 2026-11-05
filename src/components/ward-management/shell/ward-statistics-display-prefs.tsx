"use client";

import { useEffect, type ReactNode } from "react";

/**
 * WF-31: wrap statistics routes so theme / rail / glare changes while here stay route-scoped and
 * restore the prior persisted prefs on leave. No prefs are written to storage by this component.
 * The session is loaded on demand so the statistics layout does not pull the shell's preference
 * writers into its own chunk (that reshuffled the shared phone bundle by ~1 KB gzipped).
 */
export function WardStatisticsDisplayPrefs({ children }: { children: ReactNode }) {
  useEffect(() => {
    let leave: (() => void) | undefined;
    let left = false;
    void import("./ward-statistics-display-pref-session").then((session) => {
      if (!left) leave = session.enterStatisticsDisplayPrefScope();
    });
    return () => {
      left = true;
      leave?.();
    };
  }, []);
  return children;
}
