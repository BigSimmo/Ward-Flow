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

export function createRepeatTapGuard(clock: () => number = Date.now) {
  let last: { key: string; at: number; outcome: Outcome; refused: boolean } | undefined;
  return (event: WardFlowEvent, run: (event: WardFlowEvent) => Outcome): Outcome => {
    const key = repeatTapKey(event);
    const now = clock();
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
      if (result && result.status !== "accepted") entry.refused = true;
    };
    if (outcome instanceof Promise) void outcome.then(note, () => (entry.refused = true));
    else note(outcome);
    return outcome;
  };
}
