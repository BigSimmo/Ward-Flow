"use client";

import { useEffect, useCallback } from "react";

export interface DirtyStateGuardOptions {
  key?: string;
  isDirty: boolean;
  value?: string;
  /** Retained for call-site compatibility. Typed drafts are never restored from browser storage. */
  onRestore?: (cachedValue: string) => void;
  /** Browsers show their own beforeunload wording. */
  confirmMessage?: string;
}

/** Removes legacy typed drafts without reading their contents. */
export function clearWardFlowDraftCaches(): void {
  if (typeof window === "undefined") return;
  try {
    const storage = window.sessionStorage;
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
    for (const storedKey of keys) {
      if (storedKey?.startsWith("wf-draft:")) storage.removeItem(storedKey);
    }
  } catch {
    // Browser storage may be disabled.
  }
}

/** D18: typed text stays in memory. Warn on unload and purge caches from older versions. */
export function useDirtyStateGuard({ key, isDirty }: DirtyStateGuardOptions) {
  useEffect(() => {
    clearWardFlowDraftCaches();
  }, [key]);

  const clearDraft = useCallback(() => {
    if (!key) return;
    try {
      window.sessionStorage.removeItem(`wf-draft:${key}`);
    } catch {
      // Browser storage may be disabled.
    }
  }, [key]);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  return { clearDraft };
}
