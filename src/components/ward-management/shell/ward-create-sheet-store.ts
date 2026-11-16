/**
 * The coordinator's + sheet, as one person arranged it on this device (Josh, 15 Nov 2026): which
 * starts are pinned as full rows, which sit as quick links underneath, and in what order.
 *
 * **`localStorage`, as My wards (`ward-my-wards-store.ts`).** The arrangement survives a reload and
 * a closed tab, and ends with the signed-in session: the key sits under the `ward-` prefix, so
 * `clearWardFlowBrowserData` sweeps it at sign-out, and the in-memory copy below registers its own
 * reset, so the next person at the device starts from the standard sheet.
 *
 * **Item ids only, never typed text.** The stored value is `{ pinned, links, hidden }`, three arrays
 * of ids from the closed list `CREATE_ITEM_IDS`, checked on every read (a value saved before `hidden`
 * existed reads as an empty one). Anything else (free text, a stale build's value, tampering) reads as
 * "not arranged", never as an error.
 *
 * More starts (Josh, 16 Nov 2026): the Tools the coordinator already has can be added too. They start
 * under "Not shown", so the standard sheet is unchanged until someone adds one.
 */
import { createBrowserStore } from "@/lib/client-store-factory";
import { onWardSessionEnd } from "@/components/ward-management/ward-browser-data";

export const CREATE_SHEET_STORAGE_KEY = "ward-flow-create-sheet";
const createSheetChangeEvent = "ward-flow-create-sheet-change";

/** Every start the coordinator's + sheet can show, in the standard order. */
const CREATE_ITEM_IDS = [
  "triage",
  "call-log",
  "ask",
  "transport",
  "delays",
  "remind",
  "wards",
  "add-patient",
  "bed-finder",
  "feed",
  "leave-due",
  "messages",
  "contacts",
  "form-times",
  "catchment",
  "figures",
  "find-patient",
  "broadcast",
] as const;
export type CreateItemId = (typeof CREATE_ITEM_IDS)[number];

export type CreateSheetLayout = {
  pinned: readonly CreateItemId[];
  links: readonly CreateItemId[];
  /** Starts this person took off the sheet; any start not placed anywhere takes its standard place. */
  hidden?: readonly CreateItemId[];
};
export type ResolvedCreateLayout = { pinned: CreateItemId[]; links: CreateItemId[]; hidden: CreateItemId[] };

/** The standard sheet: the day's starts as full rows, the rarer ones as links (Josh, 8 and 15 Nov 2026). */
const STANDARD_CREATE_LAYOUT: CreateSheetLayout = Object.freeze({
  pinned: Object.freeze(["triage", "call-log", "ask", "transport", "delays", "remind"] as const),
  links: Object.freeze(["wards", "add-patient"] as const),
});

const isItemId = (value: unknown): value is CreateItemId =>
  typeof value === "string" && (CREATE_ITEM_IDS as readonly string[]).includes(value);

let inMemoryFallback: CreateSheetLayout | null | undefined;
let lastRaw: string | null | undefined;
let lastParsed: CreateSheetLayout | null = null;

onWardSessionEnd((scope) => {
  inMemoryFallback = undefined;
  lastRaw = undefined;
  lastParsed = null;
  if (typeof window === "undefined" || scope === "tab") return;
  try {
    window.localStorage.removeItem(CREATE_SHEET_STORAGE_KEY);
  } catch {
    // Nothing is stored when storage is unreachable.
  }
  window.dispatchEvent(new Event(createSheetChangeEvent));
});

/** Reads a stored value: known ids only, each once, or `null` (the standard sheet). */
export function parseCreateSheet(raw: string | null): CreateSheetLayout | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { pinned, links, hidden = [] } = value as { pinned?: unknown; links?: unknown; hidden?: unknown };
  if (!Array.isArray(pinned) || !Array.isArray(links) || !Array.isArray(hidden)) return null;
  const seen = new Set<CreateItemId>();
  const take = (list: unknown[]) =>
    list.filter((id): id is CreateItemId => isItemId(id) && !seen.has(id) && Boolean(seen.add(id)));
  const layout = {
    pinned: Object.freeze(take(pinned)),
    links: Object.freeze(take(links)),
    hidden: Object.freeze(take(hidden)),
  };
  return Object.freeze(layout);
}

/**
 * The sheet to draw from what this desk may start (`available`): the stored arrangement, or the
 * standard one. A start the person never placed (new in a later build) keeps its standard place, at
 * the end of its group: pinned, a quick link, or "Not shown" for a start the standard sheet leaves off.
 */
export function resolveCreateLayout(
  stored: CreateSheetLayout | null,
  available: ReadonlySet<CreateItemId>,
): ResolvedCreateLayout {
  const layout = stored ?? STANDARD_CREATE_LAYOUT;
  const hiddenStored = layout.hidden ?? [];
  const placed = new Set<CreateItemId>([...layout.pinned, ...layout.links, ...hiddenStored]);
  const pinned = layout.pinned.filter((id) => available.has(id));
  const links = layout.links.filter((id) => available.has(id));
  const hidden = hiddenStored.filter((id) => available.has(id));
  for (const id of CREATE_ITEM_IDS) {
    if (placed.has(id) || !available.has(id)) continue;
    if (STANDARD_CREATE_LAYOUT.pinned.includes(id)) pinned.push(id);
    else if (STANDARD_CREATE_LAYOUT.links.includes(id)) links.push(id);
    else hidden.push(id);
  }
  return { pinned, links, hidden };
}

function getSnapshot(): CreateSheetLayout | null {
  if (inMemoryFallback !== undefined) return inMemoryFallback;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(CREATE_SHEET_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastParsed = parseCreateSheet(raw);
  }
  return lastParsed;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(createSheetChangeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(createSheetChangeEvent, onChange);
  };
}

/** This device's arrangement of the + sheet, or `null` for the standard sheet. */
export const useCreateSheetLayout = createBrowserStore(subscribe, getSnapshot, null);

/** Saves an arrangement; `null` goes back to the standard sheet. */
export function saveCreateSheetLayout(next: CreateSheetLayout | null): void {
  const value = next === null ? null : parseCreateSheet(JSON.stringify(next));
  try {
    if (value === null) window.localStorage.removeItem(CREATE_SHEET_STORAGE_KEY);
    else window.localStorage.setItem(CREATE_SHEET_STORAGE_KEY, JSON.stringify(value));
    inMemoryFallback = undefined;
  } catch {
    // Private browsing or a full quota: the arrangement still works for this tab, until a reload.
    inMemoryFallback = value;
  }
  window.dispatchEvent(new Event(createSheetChangeEvent));
}

/** Test-only reset, so one test file's arrangement never leaks into the next. */
export function resetCreateSheetForTests(): void {
  try {
    window.localStorage.removeItem(CREATE_SHEET_STORAGE_KEY);
  } catch {
    // Nothing stored if storage is unreachable.
  }
  inMemoryFallback = undefined;
  lastRaw = undefined;
  lastParsed = null;
  window.dispatchEvent(new Event(createSheetChangeEvent));
}
