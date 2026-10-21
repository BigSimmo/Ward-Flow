/**
 * Which desks' first-run tours this device has seen, and the event that opens Help.
 *
 * The seen list lives under `TOUR_SEEN_STORAGE_KEY`, which carries the `ward_flow_choice_` prefix
 * that `ward-browser-data.ts` keeps at sign-out: the next person at a ward computer has usually used
 * it before, and a tour that reappeared at every sign-in would be noise. It holds desk role ids only,
 * each checked against the known desks on read, so no typed text reaches storage (D-11, D-18).
 */
import { createBrowserStore } from "@/lib/client-store-factory";
import { CHROME_ROLE_LABELS, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";

export const TOUR_SEEN_STORAGE_KEY = "ward_flow_choice_tour_seen";
const tourSeenChangeEvent = "ward-flow-tour-seen-change";


let inMemoryFallback: string | undefined;

function readRaw(): string {
  if (inMemoryFallback !== undefined) return inMemoryFallback;
  try {
    return window.localStorage.getItem(TOUR_SEEN_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** The desks whose tour was seen or dismissed, from the stored comma-separated list. */
export function parseTourSeen(raw: string): readonly WardChromeRole[] {
  const known = new Set<string>(Object.keys(CHROME_ROLE_LABELS));
  return raw.split(",").filter((id): id is WardChromeRole => known.has(id));
}

function subscribeTourSeen(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(tourSeenChangeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(tourSeenChangeEvent, onChange);
  };
}

// The raw string is the snapshot, so it keeps its identity between reads without a cache. The
// server and hydration read `NOT_READ`, so the first client render matches the server's.
const NOT_READ = "not-read";
const useTourSeenRaw = createBrowserStore(subscribeTourSeen, readRaw, NOT_READ);

/**
 * Whether `role`'s tour has been seen on this device. Reads `true` on the server and before the
 * browser store answers, so nothing flashes a "new" marker during hydration.
 */
export function useTourSeen(role: WardChromeRole): boolean {
  const raw = useTourSeenRaw();
  return raw === NOT_READ || parseTourSeen(raw).includes(role);
}

/** Records that `role`'s tour was seen or dismissed. */
export function markTourSeen(role: WardChromeRole): void {
  const seen = parseTourSeen(readRaw());
  if (seen.includes(role)) return;
  const next = [...seen, role].join(",");
  try {
    window.localStorage.setItem(TOUR_SEEN_STORAGE_KEY, next);
    inMemoryFallback = undefined;
  } catch {
    inMemoryFallback = next;
  }
  window.dispatchEvent(new Event(tourSeenChangeEvent));
}

/** Test-only reset. */
export function resetTourSeenForTests(): void {
  try {
    window.localStorage.removeItem(TOUR_SEEN_STORAGE_KEY);
  } catch {
    // Nothing stored if storage is unreachable.
  }
  inMemoryFallback = undefined;
  window.dispatchEvent(new Event(tourSeenChangeEvent));
}
