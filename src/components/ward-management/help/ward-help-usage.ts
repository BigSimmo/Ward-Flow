/**
 * HELP USAGE (Josh, 26 Oct 2026): which Ask help answers are used on this device, so the team can
 * see what staff look up before the pilot. An answer counts as used when someone opens it, or
 * presses its Show me or Go there. Only how-to ids and whole counts are stored, each id checked
 * against the known answers on read, so typed words never reach storage (D-11, D-18). The key carries
 * the `ward_flow_choice_` prefix that `ward-browser-data.ts` keeps at sign-out: it holds nothing about
 * a person, and counts that reset at every sign-in would show nothing.
 */
import { createBrowserStore } from "@/lib/client-store-factory";

export const HELP_USED_STORAGE_KEY = "ward_flow_choice_help_used";
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

function readRaw(): string {
  try {
    return window.localStorage.getItem(HELP_USED_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeRaw(next: string): void {
  try {
    if (next) window.localStorage.setItem(HELP_USED_STORAGE_KEY, next);
    else window.localStorage.removeItem(HELP_USED_STORAGE_KEY);
  } catch {
    // Without storage nothing is counted.
  }
  window.dispatchEvent(new Event(helpUsedChangeEvent));
}

/** Adds one use of the answer `id`, when it is one of `known`. */
export function recordHowToUsed(id: string, known: ReadonlySet<string>): void {
  if (!known.has(id)) return;
  const used = new Map(parseHelpUsed(readRaw(), known));
  used.set(id, Math.min((used.get(id) ?? 0) + 1, MAX_COUNT));
  writeRaw([...used].map(([key, count]) => `${key}:${count}`).join(","));
}

/** Forgets every count on this device. */
export function clearHelpUsed(): void {
  writeRaw("");
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

/** This device's counts, most used first. */
export function useHelpUsed(known: ReadonlySet<string>): readonly { id: string; count: number }[] {
  const raw = useHelpUsedRaw();
  return [...parseHelpUsed(raw, known)]
    .map(([id, count]) => ({ id, count }))
    .sort((left, right) => right.count - left.count);
}
