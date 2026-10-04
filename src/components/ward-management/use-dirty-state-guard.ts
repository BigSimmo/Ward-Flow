"use client";

import { useEffect, useCallback, useRef } from "react";

export interface DirtyStateGuardOptions {
  key?: string;
  isDirty: boolean;
  value?: string;
  onRestore?: (cachedValue: string) => void;
  /** Describes the unsaved text at the call site. Not rendered: browsers show their own fixed
   *  beforeunload wording and ignore page-supplied text, and the hook never read it. */
  confirmMessage?: string;
}

/**
 * Guards against accidental loss of clinical text, form input, or active draft sessions.
 * 1. Attaches window 'beforeunload' listener when isDirty is true (browser reload, tab close).
 * 2. Caches draft responses in sessionStorage keyed by `key`, restoring content if the tab reloads.
 * 3. Clears cached draft when isDirty becomes false or when text is erased.
 */
export function useDirtyStateGuard({ key, isDirty, value, onRestore }: DirtyStateGuardOptions) {
  const isRestoringRef = useRef(true);
  const onRestoreRef = useRef(onRestore);

  useEffect(() => {
    onRestoreRef.current = onRestore;
  }, [onRestore]);

  // 1. Restore cached draft on initial mount
  useEffect(() => {
    if (!key || typeof window === "undefined" || !onRestoreRef.current) {
      isRestoringRef.current = false;
      return;
    }
    try {
      const cached = window.sessionStorage.getItem(`wf-draft:${key}`);
      if (cached !== null && cached.length > 0) {
        onRestoreRef.current(cached);
      }
    } catch {
      // Storage unavailable or disabled
    } finally {
      isRestoringRef.current = false;
    }
  }, [key]);

  // 2. Cache draft when value changes and isDirty is true; clear when clean or text erased
  useEffect(() => {
    if (!key || typeof window === "undefined" || isRestoringRef.current) return;
    try {
      if (isDirty && value !== undefined && value.length > 0) {
        window.sessionStorage.setItem(`wf-draft:${key}`, value);
      } else if (!isDirty || (value !== undefined && value.length === 0)) {
        window.sessionStorage.removeItem(`wf-draft:${key}`);
      }
    } catch {
      // Storage quota exceeded or disabled
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
