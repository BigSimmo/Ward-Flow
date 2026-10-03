"use client";

import { useEffect, useCallback } from "react";

export interface DirtyStateGuardOptions {
  key?: string;
  isDirty: boolean;
  value?: string;
  onRestore?: (cachedValue: string) => void;
  confirmMessage?: string;
}

/**
 * Guards against accidental loss of clinical text, form input, or active draft sessions.
 * 1. Attaches window 'beforeunload' listener when isDirty is true (browser reload, tab close).
 * 2. Caches draft responses in sessionStorage keyed by `key`, restoring content if the tab reloads.
 * 3. Clears cached draft when isDirty becomes false (form submitted or discarded).
 */
export function useDirtyStateGuard({
  key,
  isDirty,
  value,
  onRestore,
  confirmMessage = "You have unsaved clinical text. Are you sure you want to leave?",
}: DirtyStateGuardOptions) {
  // 1. Restore cached draft on initial mount
  useEffect(() => {
    if (!key || typeof window === "undefined" || !onRestore) return;
    try {
      const cached = window.sessionStorage.getItem(`wf-draft:${key}`);
      if (cached !== null && cached.length > 0) {
        onRestore(cached);
      }
    } catch {
      // Storage unavailable or disabled
    }
  }, [key, onRestore]);

  // 2. Cache draft when value changes and isDirty is true
  useEffect(() => {
    if (!key || typeof window === "undefined") return;
    try {
      if (isDirty && value !== undefined && value.length > 0) {
        window.sessionStorage.setItem(`wf-draft:${key}`, value);
      } else if (!isDirty) {
        window.sessionStorage.removeItem(`wf-draft:${key}`);
      }
    } catch {
      // Storage quota or unavailable
    }
  }, [key, isDirty, value]);

  // 3. Clear storage helper
  const clearDraft = useCallback(() => {
    if (!key || typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(`wf-draft:${key}`);
    } catch {
      // ignore
    }
  }, [key]);

  // 4. Window beforeunload event listener
  useEffect(() => {
    if (!isDirty || typeof window === "undefined") return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  return { clearDraft };
}
