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
  /**
   * A link this guard's owner already confirms for itself (an in-app dialog). Only this guard skips it, so
   * any other mounted guard still prompts. Pass a stable function.
   */
  skipAnchor?: (anchor: HTMLAnchorElement) => boolean;
}

const DEFAULT_LEAVE_MESSAGE = "You have unsaved changes. Are you sure you want to leave?";

type NavigationGuardEntry = { isDirty: boolean; message: string };
const navigationGuards = new Set<NavigationGuardEntry>();
let suppressNextPopState = false;
let lastHistoryIndex: number | null = null;

function readHistoryIndex(state: unknown): number | null {
  if (!state || typeof state !== "object") return null;
  const record = state as Record<string, unknown>;
  for (const key of ["__wfHistoryIndex", "idx", "index", "page"]) {
    const val = record[key];
    if (typeof val === "number" && Number.isFinite(val)) return val;
  }
  return null;
}

function hasAnyDirtyGuard(): boolean {
  for (const entry of navigationGuards) {
    if (entry.isDirty) return true;
  }
  return false;
}

/** One confirmation for the shell's task navigation: it asks once if ANY mounted guard is dirty. */
function confirmNavigationAcrossGuards(): boolean {
  for (const entry of navigationGuards) {
    if (entry.isDirty) return window.confirm(entry.message);
  }
  return true;
}

function handleGuardedPopState(event: PopStateEvent): void {
  if (suppressNextPopState) {
    suppressNextPopState = false;
    return;
  }
  const targetIndex = readHistoryIndex(event.state);
  if (!hasAnyDirtyGuard()) {
    lastHistoryIndex = targetIndex ?? lastHistoryIndex;
    return;
  }
  if (confirmNavigationAcrossGuards()) {
    lastHistoryIndex = targetIndex ?? lastHistoryIndex;
    return;
  }
  // Undo the browser traversal in the opposite direction (Back -> go(1), Forward -> go(-1))
  // and ignore the compensating popstate event fired by `history.go(...)`.
  const reverseDelta = lastHistoryIndex !== null && targetIndex !== null && targetIndex > lastHistoryIndex ? -1 : 1;
  suppressNextPopState = true;
  window.history.go(reverseDelta);
  event.stopImmediatePropagation();
}

function syncNavigationConfirm(): void {
  if (typeof window === "undefined") return;
  const globalWindow = window as typeof window & { __wardFlowConfirmNavigation?: () => boolean };
  if (navigationGuards.size > 0) {
    globalWindow.__wardFlowConfirmNavigation = confirmNavigationAcrossGuards;
    if (lastHistoryIndex === null) {
      lastHistoryIndex = readHistoryIndex(window.history.state);
    }
    if (!hasAnyDirtyGuard()) {
      suppressNextPopState = false;
    }
    if (navigationGuards.size === 1) window.addEventListener("popstate", handleGuardedPopState);
  } else {
    delete globalWindow.__wardFlowConfirmNavigation;
    suppressNextPopState = false;
    lastHistoryIndex = null;
    window.removeEventListener("popstate", handleGuardedPopState);
  }
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
  const { key, isDirty, confirmMessage, skipAnchor } = normalized;

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
    // Every mounted guard registers itself, so a clean guard (the referral drawer over a half-filled page)
    // cannot replace a dirty one, and removing one leaves the others in place.
    const entry: NavigationGuardEntry = { isDirty, message: confirmMessage ?? DEFAULT_LEAVE_MESSAGE };
    navigationGuards.add(entry);
    syncNavigationConfirm();
    return () => {
      navigationGuards.delete(entry);
      syncNavigationConfirm();
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
    const message = confirmMessage ?? DEFAULT_LEAVE_MESSAGE;

    const handleClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (event.defaultPrevented) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (skipAnchor?.(anchor)) return;
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
    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [isDirty, confirmMessage, skipAnchor]);

  return { clearDraft };
}
