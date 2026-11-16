/**
 * The phone dock (the bottom bar), as one person chose it on this device (Josh, 16 Nov 2026: "allow
 * for change of option for the main action bar also"). Each desk keeps its own choice, so switching
 * desk in the demo shows that desk's bar; a desk never chosen keeps its standard bar (`DOCK` in
 * `next-phone-menu.tsx`). The + always stays in the middle.
 *
 * **`localStorage`, as the + sheet (`ward-create-sheet-store.ts`).** The key sits under the `ward-`
 * prefix, so `clearWardFlowBrowserData` sweeps it at sign-out, and the in-memory copy below registers
 * its own reset, so the next person at the device starts from the standard bar.
 *
 * **Slot keys only, never typed text.** The stored value is `{ [desk]: string[] }`: a closed set of
 * desks, each an array of slot keys (`alerts`, `queue`, `activity`, `tools`, `bed-finder` or
 * `page:<rail id>`), checked on every read. A key the desk cannot open falls back to that position's
 * standard slot when the bar is drawn, so nothing stored can add a page the desk may not see.
 */
import { createBrowserStore } from "@/lib/client-store-factory";
import { onWardSessionEnd } from "@/components/ward-management/ward-browser-data";

export const DOCK_STORAGE_KEY = "ward-flow-dock";
const dockChangeEvent = "ward-flow-dock-change";

const DOCK_DESKS = ["coordinator", "ward", "ed", "officer", "community", "bed_manager", "executive", "admin"] as const;
export type DockDesk = (typeof DOCK_DESKS)[number];
export type DockChoices = Readonly<Partial<Record<DockDesk, readonly string[]>>>;

/** The most slots a dock carries (two each side of the +). */
const MAX_SLOTS = 4;
const SLOT_KEY = /^(?:alerts|queue|activity|tools|bed-finder|page:[a-z][a-z0-9-]{0,39})$/u;

const isDockSlotKey = (value: unknown): value is string => typeof value === "string" && SLOT_KEY.test(value);

let inMemoryFallback: DockChoices | undefined;
let lastRaw: string | null | undefined;
let lastParsed: DockChoices = Object.freeze({});

onWardSessionEnd((scope) => {
  inMemoryFallback = undefined;
  lastRaw = undefined;
  lastParsed = Object.freeze({});
  if (typeof window === "undefined" || scope === "tab") return;
  try {
    window.localStorage.removeItem(DOCK_STORAGE_KEY);
  } catch {
    // Nothing is stored when storage is unreachable.
  }
  window.dispatchEvent(new Event(dockChangeEvent));
});

/** Reads a stored value: known desks only, each with up to four slot keys. Anything else is dropped. */
export function parseDockChoices(raw: string | null): DockChoices {
  if (raw === null) return Object.freeze({});
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return Object.freeze({});
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return Object.freeze({});
  const out: Partial<Record<DockDesk, readonly string[]>> = {};
  for (const desk of DOCK_DESKS) {
    const slots = (value as Record<string, unknown>)[desk];
    if (!Array.isArray(slots) || slots.length === 0 || slots.length > MAX_SLOTS) continue;
    if (!slots.every(isDockSlotKey)) continue;
    out[desk] = Object.freeze([...slots]);
  }
  return Object.freeze(out);
}

function getSnapshot(): DockChoices {
  if (inMemoryFallback !== undefined) return inMemoryFallback;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(DOCK_STORAGE_KEY);
  } catch {
    return lastParsed;
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastParsed = parseDockChoices(raw);
  }
  return lastParsed;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(dockChangeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(dockChangeEvent, onChange);
  };
}

const EMPTY: DockChoices = Object.freeze({});

/** Every desk's chosen bar on this device; a desk not listed keeps its standard bar. */
export const useDockChoices = createBrowserStore(subscribe, getSnapshot, EMPTY);

/** Saves one desk's bar; `null` puts that desk back on its standard bar. */
export function saveDockChoice(desk: DockDesk, slots: readonly string[] | null): void {
  const next: Record<string, readonly string[]> = { ...getSnapshot() };
  if (slots === null) delete next[desk];
  else next[desk] = slots;
  const value = parseDockChoices(JSON.stringify(next));
  try {
    if (Object.keys(value).length === 0) window.localStorage.removeItem(DOCK_STORAGE_KEY);
    else window.localStorage.setItem(DOCK_STORAGE_KEY, JSON.stringify(value));
    inMemoryFallback = undefined;
  } catch {
    // Private browsing or a full quota: the choice still works for this tab, until a reload.
    inMemoryFallback = value;
  }
  window.dispatchEvent(new Event(dockChangeEvent));
}

/** Test-only reset, so one test file's choice never leaks into the next. */
export function resetDockChoicesForTests(): void {
  try {
    window.localStorage.removeItem(DOCK_STORAGE_KEY);
  } catch {
    // Nothing stored if storage is unreachable.
  }
  inMemoryFallback = undefined;
  lastRaw = undefined;
  lastParsed = Object.freeze({});
  window.dispatchEvent(new Event(dockChangeEvent));
}
