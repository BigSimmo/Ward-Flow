/**
 * SMART ALERTS (Josh, 9 Nov 2026, item 20: "alerts set for each role, with one-tap actions and
 * quiet hours overnight").
 *
 * Which alerts this device shows, kept per desk (role) on this device, and the quiet hours that hold
 * the non-urgent ones overnight. Pure rules here; the notifier and Settings read them.
 *
 * 🔴 **ACT-NOW ALERTS ALWAYS COME THROUGH, QUIET HOURS OR NOT.** Quiet hours hold only the optional
 * extras (due soon, staff requests). An act-now row is something a person must do now, so no
 * preference on one device may silence it. Muting act now would need Josh's explicit ruling.
 *
 * 🔒 Stored: on/off choices and two clock minutes. Never a name, a record or typed text.
 */
import { useCallback } from "react";

import { createBrowserStore } from "@/lib/client-store-factory";

import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import type { InboxItem } from "@/components/ward-management/ward-derivations";

export const ALERT_PREFERENCES_STORAGE_KEY = "ward-flow-alert-preferences";
const CHANGE_EVENT = "ward-flow-alert-preferences-change";

/** Minutes from midnight, Perth time. */
export type QuietHours = { on: boolean; start: number; end: number };

export type AlertPreferences = {
  /** Amber "due soon" rows as well as act now. */
  dueSoon: boolean;
  /** New staff requests from wards (coordinator, bed manager and executive desks only). */
  staffRequests: boolean;
  quiet: QuietHours;
};

/** The quiet-hours windows offered. Overnight only; each wraps past midnight. */
export const QUIET_HOURS_PRESETS: readonly { id: string; start: number; end: number }[] = [
  { id: "21-07", start: 21 * 60, end: 7 * 60 },
  { id: "22-07", start: 22 * 60, end: 7 * 60 },
  { id: "23-06", start: 23 * 60, end: 6 * 60 },
];

const DEFAULT_QUIET: QuietHours = { on: false, start: 22 * 60, end: 7 * 60 };

/** Desks that coordinate staffing across wards, so staff requests are offered to them. */
export function deskSeesStaffRequests(role: WardChromeRole): boolean {
  return role === "coordinator" || role === "bed_manager" || role === "executive";
}

/**
 * Each desk's starting point. Nothing beyond act now is on until the person chooses it, so turning
 * alerts on never brings more than it did before this feature.
 */
export function defaultAlertPreferences(role: WardChromeRole): AlertPreferences {
  void role;
  return { dueSoon: false, staffRequests: false, quiet: { ...DEFAULT_QUIET } };
}

const isMinute = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 24 * 60;

/** Reads a stored value, keeping only well-formed fields and falling back to the desk's defaults. */
export function parseAlertPreferences(raw: string | null, role: WardChromeRole): AlertPreferences {
  const fallback = defaultAlertPreferences(role);
  if (!raw) return fallback;
  try {
    const value = JSON.parse(raw) as Partial<AlertPreferences> | null;
    if (!value || typeof value !== "object") return fallback;
    const quiet = value.quiet;
    return {
      dueSoon: typeof value.dueSoon === "boolean" ? value.dueSoon : fallback.dueSoon,
      staffRequests:
        deskSeesStaffRequests(role) && typeof value.staffRequests === "boolean"
          ? value.staffRequests
          : fallback.staffRequests,
      quiet:
        quiet &&
        typeof quiet === "object" &&
        typeof quiet.on === "boolean" &&
        isMinute(quiet.start) &&
        isMinute(quiet.end)
          ? { on: quiet.on, start: quiet.start, end: quiet.end }
          : fallback.quiet,
    };
  } catch {
    return fallback;
  }
}

/** True when `minute` falls inside the window. A window that wraps past midnight is handled. */
export function inQuietHours(minute: number, quiet: QuietHours): boolean {
  if (!quiet.on || quiet.start === quiet.end) return false;
  return quiet.start < quiet.end
    ? minute >= quiet.start && minute < quiet.end
    : minute >= quiet.start || minute < quiet.end;
}

const clock = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

export const quietHoursText = (quiet: Pick<QuietHours, "start" | "end">) =>
  `${clock(quiet.start)} to ${clock(quiet.end)}`;

/**
 * Splits newly appeared rows into what to show now. Act now always; due soon only when chosen and
 * outside quiet hours. `held` counts what quiet hours kept back, for the Settings line.
 */
export function alertsToShow(
  fresh: readonly InboxItem[],
  preferences: AlertPreferences,
  minute: number,
): { actNow: InboxItem[]; dueSoon: InboxItem[]; held: number } {
  const actNow = fresh.filter((item) => item.tone === "danger");
  const warnings = preferences.dueSoon ? fresh.filter((item) => item.tone === "warning") : [];
  const quiet = inQuietHours(minute, preferences.quiet);
  return { actNow, dueSoon: quiet ? [] : warnings, held: quiet ? warnings.length : 0 };
}

/** Whether an optional extra (such as a staff request) may show at `minute`. Act now never asks. */
export function extraAlertAllowed(minute: number, preferences: AlertPreferences): boolean {
  return !inQuietHours(minute, preferences.quiet);
}

/* Storage, one value per desk on this device ------------------------------------------------- */

const keyFor = (role: WardChromeRole) => `${ALERT_PREFERENCES_STORAGE_KEY}:${role}`;
const memory = new Map<WardChromeRole, string>();

function readRaw(role: WardChromeRole): string | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = window.localStorage.getItem(keyFor(role));
      if (stored !== null) return stored;
    }
  } catch {
    // Storage can be blocked; the in-memory value still applies to this tab.
  }
  return memory.get(role) ?? null;
}

export function getAlertPreferences(role: WardChromeRole): AlertPreferences {
  return parseAlertPreferences(readRaw(role), role);
}

export function setAlertPreferences(role: WardChromeRole, next: AlertPreferences): void {
  const raw = JSON.stringify({
    dueSoon: next.dueSoon,
    staffRequests: deskSeesStaffRequests(role) ? next.staffRequests : false,
    quiet: { on: next.quiet.on, start: next.quiet.start, end: next.quiet.end },
  });
  memory.set(role, raw);
  try {
    if (typeof window !== "undefined" && window.localStorage) window.localStorage.setItem(keyFor(role), raw);
  } catch {
    // Blocked storage: the in-memory value still applies to this tab.
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

// The store holds the raw strings for every desk, so a snapshot is stable between changes.
const ROLES: readonly WardChromeRole[] = [
  "coordinator",
  "ward",
  "ed",
  "officer",
  "community",
  "bed_manager",
  "executive",
];
let lastSnapshot = "";
const snapshot = () => {
  const next = ROLES.map((role) => readRaw(role) ?? "").join("\u0000");
  if (next !== lastSnapshot) lastSnapshot = next;
  return lastSnapshot;
};
const useRawStore = createBrowserStore(subscribe, snapshot, "");

export function useAlertPreferences(role: WardChromeRole): [AlertPreferences, (next: AlertPreferences) => void] {
  const raw = useRawStore();
  const index = ROLES.indexOf(role);
  const stored = raw === "" ? null : (raw.split("\u0000")[index] ?? null);
  const preferences = parseAlertPreferences(stored === "" ? null : stored, role);
  const set = useCallback((next: AlertPreferences) => setAlertPreferences(role, next), [role]);
  return [preferences, set];
}
