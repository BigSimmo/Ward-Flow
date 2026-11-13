import { formatInstant, type Instant } from "./ward-clock";
import { UNDO_WINDOW_MINUTES } from "./ward-operational-defaults";

/**
 * D-192 (shared design parts item 4, Josh 13 Nov 2026): an Undo message names one clock time, "Undo
 * until 14:47", in place of "Undo within 5 min." and a countdown. The board-clock time the Undo
 * window of a step taken at `stepAt` ends. The window itself stays `UNDO_WINDOW_MINUTES`.
 */
export function undoWindowUntil(stepAt: Instant): string {
  return formatInstant(stepAt + UNDO_WINDOW_MINUTES);
}

/** The board-clock instant the Undo window of a step taken at `stepAt` ends. */
export function undoWindowEnds(stepAt: Instant): Instant {
  return stepAt + UNDO_WINDOW_MINUTES;
}

/**
 * A toast title the kit follows with " · Undo until 14:47": the step's words without a closing full
 * stop, so it reads "Bed pulled for Pellingworth, Keira · Undo until 14:47".
 */
export function untilToastTitle(title: string): string {
  return title.replace(/\.\s*$/u, "");
}
