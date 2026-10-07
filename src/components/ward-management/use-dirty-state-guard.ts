"use client";

import { useEffect, useCallback } from "react";

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
 * 2. In strict compliance with Decision D-18 ("typed text stays off the device"), clinical
 *    free-text is never cached in browser storage (sessionStorage/localStorage). The beforeunload
 *    listener warns the clinician before closing or navigating away, preventing accidental data loss
 *    while maintaining strict patient privacy boundaries.
 */
export function useDirtyStateGuard({ key, isDirty }: DirtyStateGuardOptions) {
  // 1. Storage helper: cleans up any legacy draft key from storage without writing new data
  const clearDraft = useCallback(() => {
    if (!key || typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(`wf-draft:${key}`);
    } catch {
      // ignore
    }
  }, [key]);

  // Clean up any legacy persisted draft on mount to sanitize device storage
  useEffect(() => {
    clearDraft();
  }, [clearDraft]);

  // 2. Window beforeunload event listener
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
