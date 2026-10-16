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
let historyTrackingInstalled = false;
let lastNavigationIndex: number | null = null;
let historyIndicesTrusted = true;
let sourceEntry: { state: unknown; url: string } | null = null;
let replaceHistoryEntry: History["replaceState"] | null = null;

function stateAt(data: unknown, index: number) {
  return {
    ...(data && typeof data === "object" ? data : {}),
    __wfHistoryIndex: index,
    ...(!historyIndicesTrusted ? { __wfHistoryUncertain: true } : {}),
  };
}

function rememberEntry(): void {
  sourceEntry = { state: window.history.state, url: window.location.href };
}

function restoreSourceEntry(uncertain: boolean): void {
  if (!sourceEntry || !replaceHistoryEntry) return;
  if (uncertain) historyIndicesTrusted = false;
  const state = historyIndicesTrusted
    ? sourceEntry.state
    : {
        ...(sourceEntry.state && typeof sourceEntry.state === "object" ? sourceEntry.state : {}),
        __wfHistoryUncertain: true,
      };
  replaceHistoryEntry(state, "", sourceEntry.url);
  lastNavigationIndex = navigationIndex();
  rememberEntry();
}

function navigationIndex(): number | null {
  const index = window.navigation?.currentEntry?.index;
  return typeof index === "number" && index >= 0 ? index : null;
}

/**
 * Keep our own position alongside Next's opaque tree, from the first client import onwards.
 * The App Router does not supply numeric indices. Tracking survives clean/hidden routes so a
 * later dirty form can reverse either traversal without inventing an index for its destination.
 */
function installHistoryTracking(): void {
  if (historyTrackingInstalled || typeof window === "undefined") return;
  historyTrackingInstalled = true;
  lastHistoryIndex = readHistoryIndex(window.history.state) ?? 0;
  lastNavigationIndex = navigationIndex();
  historyIndicesTrusted = window.history.state?.__wfHistoryUncertain !== true;
  const push = window.history.pushState.bind(window.history);
  const replace = window.history.replaceState.bind(window.history);
  replaceHistoryEntry = replace;
  replace(stateAt(window.history.state, lastHistoryIndex), "");
  rememberEntry();
  window.history.pushState = (data: unknown, title: string, url?: string | URL | null) => {
    const index = (lastHistoryIndex ?? 0) + 1;
    push(stateAt(data, index), title, url);
    lastHistoryIndex = index;
    lastNavigationIndex = navigationIndex();
    rememberEntry();
  };
  window.history.replaceState = (data: unknown, title: string, url?: string | URL | null) => {
    replace(stateAt(data, lastHistoryIndex ?? 0), title, url);
    rememberEntry();
  };
  // Capture runs before Next's bubble listener: otherwise the router can hide the form and
  // clean up its dirty guard before our confirmation listener is reached.
  window.addEventListener("popstate", handleGuardedPopState, true);
}

function readHistoryIndex(state: unknown): number | null {
  if (!state || typeof state !== "object") return null;
  const index = (state as Record<string, unknown>).__wfHistoryIndex;
  return typeof index === "number" && Number.isFinite(index) ? index : null;
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
    // A legacy/hash entry may make an index ambiguous. Never leave the retained form under
    // a different URL or router state, even if the compensating cursor was inexact.
    restoreSourceEntry(window.location.href !== sourceEntry?.url);
    event.stopImmediatePropagation();
    return;
  }
  const targetIndex = readHistoryIndex(event.state);
  const targetNavigationIndex = navigationIndex();
  if (event.state?.__wfHistoryUncertain === true) historyIndicesTrusted = false;
  const targetUrl = new URL(window.location.href);
  const previousUrl = sourceEntry ? new URL(sourceEntry.url) : null;
  const hashOnly =
    previousUrl &&
    targetUrl.pathname === previousUrl.pathname &&
    targetUrl.search === previousUrl.search &&
    targetUrl.hash !== previousUrl.hash;
  if (hashOnly) {
    // Native fragment entries can have null state, or copy the preceding marker. Give a new
    // unmarked entry a marker. Without Navigation API, a legacy fragment cannot be distinguished
    // from a new one, so further cancellation uses the conservative source-entry fallback.
    if (targetIndex === null || (targetIndex === lastHistoryIndex && targetNavigationIndex === null)) {
      if (targetNavigationIndex === null) historyIndicesTrusted = false;
      lastHistoryIndex = targetIndex ?? (lastHistoryIndex ?? 0) + 1;
      replaceHistoryEntry?.(stateAt(event.state ?? sourceEntry?.state, lastHistoryIndex), "", targetUrl.href);
    } else lastHistoryIndex = targetIndex;
    lastNavigationIndex = targetNavigationIndex;
    rememberEntry();
    return;
  }
  if (!hasAnyDirtyGuard()) {
    lastHistoryIndex = targetIndex ?? lastHistoryIndex;
    lastNavigationIndex = targetNavigationIndex;
    rememberEntry();
    return;
  }
  if (confirmNavigationAcrossGuards()) {
    lastHistoryIndex = targetIndex ?? lastHistoryIndex;
    lastNavigationIndex = targetNavigationIndex;
    rememberEntry();
    return;
  }
  // Undo the browser traversal in the opposite direction (Back -> go(1), Forward -> go(-1))
  // and ignore the compensating popstate event fired by `history.go(...)`.
  // Navigation API indices also cover old entries made before this code was loaded. Otherwise
  // use our position on Next's history entries; both are numeric metadata, never draft text.
  const reverseDelta =
    lastNavigationIndex !== null && targetNavigationIndex !== null
      ? lastNavigationIndex - targetNavigationIndex
      : historyIndicesTrusted && lastHistoryIndex !== null && targetIndex !== null
        ? lastHistoryIndex - targetIndex
        : null;
  if (reverseDelta !== null && reverseDelta !== 0) {
    suppressNextPopState = true;
    window.history.go(reverseDelta);
  } else {
    // There is no safe way to infer a legacy cursor. Keep the form and restore the source URL
    // and opaque router state by replacing this target entry. The exact history slot is lost.
    restoreSourceEntry(true);
  }
  event.stopImmediatePropagation();
}

function syncNavigationConfirm(): void {
  if (typeof window === "undefined") return;
  const globalWindow = window as typeof window & { __wardFlowConfirmNavigation?: () => boolean };
  if (navigationGuards.size > 0) {
    globalWindow.__wardFlowConfirmNavigation = confirmNavigationAcrossGuards;
  } else {
    delete globalWindow.__wardFlowConfirmNavigation;
    suppressNextPopState = false;
  }
}

installHistoryTracking();

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
