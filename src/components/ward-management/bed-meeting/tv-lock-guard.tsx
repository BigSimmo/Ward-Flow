"use client";

/**
 * TV LOCK, the part every page loads (A11): the browser's lock and the guard that sends a locked
 * browser back to its TV view. The TV's own Lock and Unlock control is in `tv-lock.tsx`, so the
 * layout carries no dialog code. See `tv-lock.tsx` for what the lock does.
 */
import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Lock } from "lucide-react";

import { WARD_BED_MEETING_TV_HREF } from "@/components/ward-management/ward-nav";

import styles from "./tv-lock.module.css";

export const TV_LOCK_STORAGE_KEY = "ward-flow:tv-lock:v1";
const CHANGED = "ward-flow:tv-lock-changed";

export function readLock(): string | null {
  try {
    const href = window.localStorage.getItem(TV_LOCK_STORAGE_KEY);
    // Only ever a TV address, so a tampered value cannot send the browser anywhere else.
    return href !== null && isTvPath(href.split("?")[0] ?? "") ? href : null;
  } catch {
    return null;
  }
}

export function writeLock(href: string | null): boolean {
  try {
    if (href === null) window.localStorage.removeItem(TV_LOCK_STORAGE_KEY);
    else window.localStorage.setItem(TV_LOCK_STORAGE_KEY, href);
    if (window.localStorage.getItem(TV_LOCK_STORAGE_KEY) !== href) return false;
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(CHANGED));
  return true;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

/** Whether a pathname is the TV view (any of its screens: they differ by query only). */
export function isTvPath(pathname: string): boolean {
  return pathname === WARD_BED_MEETING_TV_HREF;
}

/** The TV address this browser is locked to, or `null` when it is not locked. */
export function useTvLock(): string | null {
  return useSyncExternalStore(subscribe, readLock, () => null);
}

/** Lock this browser to the TV view now showing. */
export function lockTv(href: string): boolean {
  return writeLock(href);
}

/*
 * F-65 (K8, RC 5.3, A14-24): the lock could trap a browser. The guard sends every page back to the TV
 * view, and the only Unlock is on the TV view, so a TV view that drew no Unlock (closed to the desk,
 * failed to load, or the TV views switched off) left no way out. Each TV control notes itself here, so
 * the layout's stand-in Unlock (`tv-lock-fallback-host.tsx`) shows only when none is on the page.
 */
let controlsShown = 0;
const controlListeners = new Set<() => void>();

function notifyControls() {
  for (const listener of controlListeners) listener();
}

/** A TV view's Lock or Unlock control is on the page; call the returned function when it leaves. */
export function noteTvLockControl(): () => void {
  controlsShown += 1;
  notifyControls();
  return () => {
    controlsShown -= 1;
    notifyControls();
  };
}

function subscribeControls(onChange: () => void): () => void {
  controlListeners.add(onChange);
  return () => {
    controlListeners.delete(onChange);
  };
}

/** Whether a TV view's own Lock or Unlock control is on the page now. */
export function useTvLockControlShown(): boolean {
  return useSyncExternalStore(
    subscribeControls,
    () => controlsShown > 0,
    () => true,
  );
}

/** Mounted once in the layout: a locked browser goes back to its TV view from any other page. */
export function TvLockGuard() {
  const locked = useTvLock();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const away = locked !== null && !isTvPath(pathname);
  useEffect(() => {
    if (away) router.replace(locked);
  }, [away, locked, router]);
  if (!away) return null;
  // Covers the page until the TV view is back, so nothing else shows in between.
  return (
    <div className={styles.cover} role="status" data-testid="tv-lock-cover">
      <Lock aria-hidden="true" />
      This screen is locked to the TV view.
    </div>
  );
}
