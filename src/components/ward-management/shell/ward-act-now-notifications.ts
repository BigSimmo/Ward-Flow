/**
 * ACT-NOW BROWSER NOTIFICATIONS — stream A, 9 Oct 2026.
 *
 * Opt-in, off by default, set in Settings. Uses the browser Notification API only while this tab
 * is open: no service worker, no server, no push. A notification carries the alert's title and
 * never a patient name, record number or typed text, because the operating system may show it on
 * a lock screen. When the browser has denied permission, nothing is sent and Settings says so.
 */
import { useCallback } from "react";

import { createBrowserStore } from "@/lib/client-store-factory";

import type { InboxItem } from "@/components/ward-management/ward-derivations";

export const ACT_NOW_NOTIFICATIONS_STORAGE_KEY = "ward-flow-act-now-notifications";
const CHANGE_EVENT = "ward-flow-act-now-notifications-change";

export type NotificationSupport = "unsupported" | NotificationPermission;

let inMemoryFallback: boolean | undefined;

/** What this browser allows right now: unsupported, or the Notification API's own permission. */
export function notificationSupport(): NotificationSupport {
  if (typeof window === "undefined" || typeof window.Notification === "undefined") return "unsupported";
  return window.Notification.permission;
}

export function getActNowNotificationPreference(): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return inMemoryFallback ?? false;
    const stored = window.localStorage.getItem(ACT_NOW_NOTIFICATIONS_STORAGE_KEY);
    return stored === null ? (inMemoryFallback ?? false) : stored === "true";
  } catch {
    return inMemoryFallback ?? false;
  }
}

export function setActNowNotificationPreference(enabled: boolean): void {
  inMemoryFallback = enabled;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(ACT_NOW_NOTIFICATIONS_STORAGE_KEY, String(enabled));
    }
  } catch {
    // Storage can be blocked; the in-memory value still applies to this tab.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

const usePreferenceStore = createBrowserStore(subscribe, getActNowNotificationPreference, false);

export function useActNowNotificationPreference(): [boolean, (enabled: boolean) => void] {
  const enabled = usePreferenceStore();
  const setEnabled = useCallback((next: boolean) => {
    setActNowNotificationPreference(next);
  }, []);
  return [enabled, setEnabled];
}

/**
 * Turns notifications on: asks the browser once if it has not been asked, and stores "on" only
 * when permission is granted. Returns what the browser answered so Settings can say it.
 */
export async function enableActNowNotifications(): Promise<NotificationSupport> {
  const support = notificationSupport();
  if (support === "unsupported" || support === "denied") {
    setActNowNotificationPreference(false);
    return support;
  }
  let permission: NotificationPermission = support;
  if (permission === "default") {
    try {
      permission = await window.Notification.requestPermission();
    } catch {
      permission = "denied";
    }
  }
  setActNowNotificationPreference(permission === "granted");
  return permission;
}

/** Act-now rows in `current` that were not on the active list last time. Pure, so it is testable. */
export function newActNowItems(previousIds: ReadonlySet<string>, current: readonly InboxItem[]): InboxItem[] {
  return current.filter((item) => item.tone === "danger" && !previousIds.has(item.id));
}

/** The words a notification shows: the alert title only, never who it is about. */
export function actNowNotificationText(items: readonly InboxItem[]): { title: string; body: string } {
  const [only] = items;
  const body = items.length === 1 && only ? only.title : `${items.length} new act-now alerts`;
  return { title: "Ward Flow: act now", body: `${body}. Synthetic demo data.` };
}

/** Shows one notification for a batch of new act-now rows. Never throws. */
export function showActNowNotification(items: readonly InboxItem[], onOpen: () => void): boolean {
  if (items.length === 0 || notificationSupport() !== "granted") return false;
  try {
    const { title, body } = actNowNotificationText(items);
    const notification = new window.Notification(title, { body, tag: "ward-flow-act-now" });
    notification.onclick = () => {
      window.focus();
      onOpen();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}
