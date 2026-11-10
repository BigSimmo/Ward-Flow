/**
 * HELP USAGE (Josh, 26 Oct 2026): which Ask help answers are used on this device, so the team can
 * see what staff look up before the pilot. An answer counts as used when someone opens it, or
 * presses its Show me or Go there. Only how-to ids and whole counts are stored, each id checked
 * against the known answers on read, so typed words never reach storage (archived D-11; D-18). The key carries
 * the `ward_flow_choice_` prefix that `ward-browser-data.ts` keeps at sign-out: it holds nothing about
 * a person, and counts that reset at every sign-in would show nothing.
 *
 * "Recently opened" (9 Nov 2026) keeps its own list of ids, newest last, under
 * `HELP_RECENT_STORAGE_KEY`. The counts record cannot carry it: before 9 Nov its pairs were kept in
 * the order first used, and a saved record has no mark saying which order it is in, so reading an
 * old record as last-used put the wrong answers first (audit F-52). An old record now only gives
 * counts, and Recently opened fills from the next answer opened.
 */
import { createBrowserStore } from "@/lib/client-store-factory";

export const HELP_USED_STORAGE_KEY = "ward_flow_choice_help_used";
export const HELP_RECENT_STORAGE_KEY = "ward_flow_choice_help_recent";
const helpUsedChangeEvent = "ward-flow-help-used-change";
const MAX_COUNT = 9999;

/** "id:count" pairs, known ids and whole positive counts only; anything else is dropped. */
export function parseHelpUsed(raw: string, known: ReadonlySet<string>): ReadonlyMap<string, number> {
  const used = new Map<string, number>();
  for (const pair of raw.split(",")) {
    const [id, value] = pair.split(":");
    const count = Number(value);
    if (id && known.has(id) && Number.isInteger(count) && count > 0) used.set(id, Math.min(count, MAX_COUNT));
  }
  return used;
}

/** Comma-separated ids, oldest first: known ids only, each once (its latest place wins). */
export function parseHelpRecent(raw: string, known: ReadonlySet<string>): readonly string[] {
  const recent: string[] = [];
  for (const id of raw.split(",")) {
    if (!id || !known.has(id)) continue;
    const at = recent.indexOf(id);
    if (at !== -1) recent.splice(at, 1);
    recent.push(id);
  }
  return recent;
}

function readKey(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeKey(key: string, next: string): void {
  try {
    if (next) window.localStorage.setItem(key, next);
    else window.localStorage.removeItem(key);
  } catch {
    // Without storage nothing is counted.
  }
}

const readRaw = () => readKey(HELP_USED_STORAGE_KEY);
const readRecentRaw = () => readKey(HELP_RECENT_STORAGE_KEY);

function announce(): void {
  window.dispatchEvent(new Event(helpUsedChangeEvent));
}

/** Adds one use of the answer `id`, when it is one of `known`. */
export function recordHowToUsed(id: string, known: ReadonlySet<string>): void {
  if (!known.has(id)) return;
  const used = new Map(parseHelpUsed(readRaw(), known));
  used.set(id, Math.min((used.get(id) ?? 0) + 1, MAX_COUNT));
  writeKey(HELP_USED_STORAGE_KEY, [...used].map(([key, count]) => `${key}:${count}`).join(","));
  // Recently opened: the same id moved to the end, with no time or typed words stored (9 Nov 2026).
  const recent = parseHelpRecent(readRecentRaw(), known).filter((each) => each !== id);
  writeKey(HELP_RECENT_STORAGE_KEY, [...recent, id].join(","));
  announce();
}

/** Forgets every count, and the recently opened list, on this device. */
export function clearHelpUsed(): void {
  writeKey(HELP_USED_STORAGE_KEY, "");
  writeKey(HELP_RECENT_STORAGE_KEY, "");
  announce();
}

function subscribeHelpUsed(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(helpUsedChangeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(helpUsedChangeEvent, onChange);
  };
}

// The raw string is the snapshot, so it keeps its identity between reads; the server reads "".
const useHelpUsedRaw = createBrowserStore(subscribeHelpUsed, readRaw, "");
const useHelpRecentRaw = createBrowserStore(subscribeHelpUsed, readRecentRaw, "");

/** This device's counts, most used first. */
export function useHelpUsed(known: ReadonlySet<string>): readonly { id: string; count: number }[] {
  const raw = useHelpUsedRaw();
  return [...parseHelpUsed(raw, known)]
    .map(([id, count]) => ({ id, count }))
    .sort((left, right) => right.count - left.count);
}

/** The answers this device opened most recently, newest first: ids only. */
export function useRecentHowTos(known: ReadonlySet<string>, limit?: number): readonly string[] {
  const raw = useHelpRecentRaw();
  const newestFirst = [...parseHelpRecent(raw, known)].reverse();
  return limit === undefined ? newestFirst : newestFirst.slice(0, limit);
}
