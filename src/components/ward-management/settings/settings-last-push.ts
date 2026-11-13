// Audit A8-07 (Josh, Nov 2026): Settings > Alerts says when this device last received a phone alert.
// The service worker (public/ward-flow-push-sw.js) writes the time, and the kind only, to its own
// cache on every push, so it is kept even when no Ward Flow page is open. No payload words, names or
// patient details are ever stored there. These two names must match the worker's.

import { perthClockTime, perthDateText, perthIsoDay } from "@/components/ward-management/ward-clock";

export const LAST_PUSH_CACHE = "ward-flow-last-push";
export const LAST_PUSH_KEY = "/ward-flow/__last-push";

/** The time this device last received a push, or null when none is recorded or it cannot be read. */
export async function readLastPushAt(storage: CacheStorage | undefined = globalThis.caches): Promise<Date | null> {
  try {
    if (!storage) return null;
    const hit = await storage.match(LAST_PUSH_KEY, { cacheName: LAST_PUSH_CACHE });
    if (!hit) return null;
    const record: unknown = await hit.json();
    const at = record && typeof record === "object" ? (record as { at?: unknown }).at : undefined;
    if (typeof at !== "string") return null;
    const when = new Date(at);
    return Number.isNaN(when.getTime()) ? null : when;
  } catch {
    return null;
  }
}

/** "Last alert on this device: 14:05 today", "… 09:30 yesterday" or "… 14:05, 3 Nov". */
export function lastPushLine(at: Date | null, now: Date = new Date()): string {
  if (!at) return "No alert received on this device yet.";
  // The Perth clock and calendar, as every other Ward Flow time, whatever the device's zone (time
  // audit D9, 13 Nov 2026). The moment itself is the device's real one: a push is not a board event.
  const time = perthClockTime(at);
  const day = perthIsoDay(at);
  const yesterday = perthIsoDay(new Date(now.getTime() - 24 * 60 * 60_000));
  const when =
    day === perthIsoDay(now)
      ? `${time} today`
      : day === yesterday
        ? `${time} yesterday`
        : `${time}, ${perthDateText(at, { day: "numeric", month: "short" })}`;
  return `Last alert on this device: ${when}.`;
}
