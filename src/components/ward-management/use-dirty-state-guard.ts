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

/** D18: typed text stays in memory. Warn on unload, client navigation, and purge caches from older versions. */
export function useDirtyStateGuard(options: DirtyStateGuardOptions | boolean) {
  const normalized: DirtyStateGuardOptions = typeof options === "boolean" ? { isDirty: options } : options;
  const { key, isDirty, confirmMessage } = normalized;

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
    const navigationConfirm = () =>
      !isDirty || window.confirm(confirmMessage ?? "You have unsaved changes. Are you sure you want to leave?");
    const globalWindow = window as typeof window & { __wardFlowConfirmNavigation?: () => boolean };
    globalWindow.__wardFlowConfirmNavigation = navigationConfirm;
    return () => {
      if (globalWindow.__wardFlowConfirmNavigation === navigationConfirm)
        delete globalWindow.__wardFlowConfirmNavigation;
    };
  }, [isDirty, confirmMessage]);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty || typeof document === "undefined") return;
    const message = confirmMessage ?? "You have unsaved changes. Are you sure you want to leave?";

    const handleClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (event.defaultPrevented) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const rawHref = anchor.getAttribute("href");
      if (
        !rawHref ||
        rawHref.startsWith("#") ||
        rawHref.startsWith("javascript:") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:")
      ) {
        return;
      }

      try {
        const targetUrl = new URL(anchor.href, window.location.href);
        const currentUrl = new URL(window.location.href);
        if (targetUrl.origin !== currentUrl.origin) {
          return;
        }
        if (
          targetUrl.origin === currentUrl.origin &&
          targetUrl.pathname === currentUrl.pathname &&
          targetUrl.search === currentUrl.search
        ) {
          return;
        }
      } catch {
        return;
      }

      const confirmed = window.confirm(message);
      if (!confirmed) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [isDirty, confirmMessage]);

  return { clearDraft };
}
