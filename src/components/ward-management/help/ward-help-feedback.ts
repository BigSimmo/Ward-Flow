/**
 * WAS THIS HELPFUL? (Josh, 2 Nov 2026). A yes or no on a Help answer, counted on this device only,
 * so the team can see which answers need rewriting before the pilot. Only how-to ids and whole
 * counts are stored, each id checked against the known answers on read: nothing typed and nothing
 * about a person (archive D-11, D-18). The key carries the `ward_flow_choice_` prefix kept at sign-out, as the
 * usage counts do (`ward-help-usage.ts`), and the Settings usage card shows and clears both.
 */
import { createBrowserStore } from "@/lib/client-store-factory";

export const HELP_FEEDBACK_STORAGE_KEY = "ward_flow_choice_help_helpful";
const changeEvent = "ward-flow-help-helpful-change";
const MAX_COUNT = 9999;

export type HelpFeedback = { readonly yes: number; readonly no: number };

/** "id:yes:no" triples, known ids and whole counts only; anything else is dropped. */
export function parseHelpFeedback(raw: string, known: ReadonlySet<string>): ReadonlyMap<string, HelpFeedback> {
  const out = new Map<string, HelpFeedback>();
  for (const entry of raw.split(",")) {
    const [id, yesText, noText] = entry.split(":");
    const yes = Number(yesText);
    const no = Number(noText);
    if (!id || !known.has(id) || !Number.isInteger(yes) || !Number.isInteger(no) || yes < 0 || no < 0) continue;
    if (yes + no === 0) continue;
    out.set(id, { yes: Math.min(yes, MAX_COUNT), no: Math.min(no, MAX_COUNT) });
  }
  return out;
}

function readRaw(): string {
  try {
    return window.localStorage.getItem(HELP_FEEDBACK_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeRaw(next: string): void {
  try {
    if (next) window.localStorage.setItem(HELP_FEEDBACK_STORAGE_KEY, next);
    else window.localStorage.removeItem(HELP_FEEDBACK_STORAGE_KEY);
  } catch {
    // Without storage nothing is counted.
  }
  window.dispatchEvent(new Event(changeEvent));
}

/** Counts one yes or no for the answer `id`, when it is one of `known`. */
export function recordHelpFeedback(id: string, helpful: boolean, known: ReadonlySet<string>): void {
  if (!known.has(id)) return;
  const all = new Map(parseHelpFeedback(readRaw(), known));
  const now = all.get(id) ?? { yes: 0, no: 0 };
  all.set(
    id,
    helpful ? { ...now, yes: Math.min(now.yes + 1, MAX_COUNT) } : { ...now, no: Math.min(now.no + 1, MAX_COUNT) },
  );
  writeRaw([...all].map(([key, { yes, no }]) => `${key}:${yes}:${no}`).join(","));
}

/** Forgets every yes and no on this device. */
export function clearHelpFeedback(): void {
  writeRaw("");
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}

const useRaw = createBrowserStore(subscribe, readRaw, "");

/** This device's yes and no counts by answer id. */
export function useHelpFeedback(known: ReadonlySet<string>): ReadonlyMap<string, HelpFeedback> {
  return parseHelpFeedback(useRaw(), known);
}
