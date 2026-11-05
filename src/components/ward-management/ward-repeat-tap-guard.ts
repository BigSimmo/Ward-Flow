import type { WardFlowEvent } from "./ward-flow-events";
import type { WardCommandOutcome } from "./ward-shared-client";

/**
 * Tier 1 item 2 (Josh, 4 Nov 2026): a double tap on Book transport, Log a delay or any other action
 * records it once. The same action asked for again within this window, while the first is still
 * saving or was accepted, gets the first one's answer instead of a second record. A retry after a
 * network drop resends the same command ID, which the server already answers once.
 */
export const REPEAT_TAP_WINDOW_MS = 1500;
/** Actions meant to be pressed again in quick succession (the demo clock's step forward). */
const REPEATABLE = new Set<WardFlowEvent["type"]>(["ADVANCE_CLOCK"]);

type Outcome = void | WardCommandOutcome | Promise<WardCommandOutcome>;

/** The action without its clock reading, so two taps a moment apart compare equal; null if repeatable. */
export function repeatTapKey(event: WardFlowEvent): string | null {
  if (REPEATABLE.has(event.type)) return null;
  try {
    return JSON.stringify(event, (key, value: unknown) => (key === "now" ? undefined : value));
  } catch {
    return null;
  }
}

export function createRepeatTapGuard(clock: () => number = () => Date.now()) {
  let last: { key: string; at: number; outcome: Outcome; refused: boolean } | undefined;
  // Post-merge audit (4 Nov 2026): a save that failed but may still land (offline, it sends itself
  // when the connection returns; or it waits on Retry) has a pending confirmation. Pressing the
  // same action again before that settles gets the waiting save's answer, so the two cannot both
  // reach the server as separate records.
  const waiting = new Map<string, WardCommandOutcome>();
  return (event: WardFlowEvent, run: (event: WardFlowEvent) => Outcome): Outcome => {
    const key = repeatTapKey(event);
    const now = clock();
    const held = key === null ? undefined : waiting.get(key);
    if (key !== null && held) {
      if (held.isCurrent?.() !== false) return Promise.resolve(held);
      waiting.delete(key);
    }
    if (key !== null && last && last.key === key && now - last.at < REPEAT_TAP_WINDOW_MS && !last.refused)
      return last.outcome;
    const outcome = run(event);
    if (key === null) {
      last = undefined;
      return outcome;
    }
    const entry = { key, at: now, outcome, refused: false };
    last = entry;
    // A refused, cancelled or failed first tap does not block trying again.
    const note = (result: void | WardCommandOutcome) => {
      if (!result || result.status === "accepted") return;
      entry.refused = true;
      const confirmation = result.status === "failed" ? result.confirmation : undefined;
      if (!confirmation) return;
      waiting.set(key, result);
      const settled = () => {
        if (waiting.get(key) === result) waiting.delete(key);
      };
      void confirmation.then(settled, settled);
    };
    if (outcome instanceof Promise) void outcome.then(note, () => (entry.refused = true));
    else note(outcome);
    return outcome;
  };
}
