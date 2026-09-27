import {
  declinesByReason,
  type DeclinesByReason,
} from "@/components/ward-management/statistics/statistics-derivations";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * ═══ REPORT A MALFORMED DECLINE REASON IN PLACE, RATHER THAN LOSING THE SCREEN ════════════════
 *
 * `declinesByReason` throws when a movement carries a decline reason that is not a member of
 * `DECLINE_REASONS`. **That throw is right and is not being softened here.** A categorical breakdown
 * whose vocabulary has drifted must not quietly shrink its own total — the alternative is a screen
 * that reads as authoritative while under-counting, which is the failure mode this whole area
 * exists to prevent.
 *
 * What is wrong is only WHERE it lands. All three screens call it during render, so one malformed
 * datum takes down the entire page — including the stage distribution, the capacity figures and the
 * prose about what the model cannot support, none of which depend on the decline vocabulary at all.
 * **A bed coordinator loses the whole screen because one field is wrong.**
 *
 * Ward Lead's ruling, 2026-09-07: report in place, consistently, at all three call sites. This
 * module is that one decision; each call site carries its own sentence saying why it reports.
 *
 * ⚠️ **BOUNDED TO THIS CLASS.** A malformed value in a categorical breakdown, where the rest of the
 * screen is independent of it. This is NOT a licence to wrap every throw — most of them are load-
 * bearing, and a screen that renders through a broken derivation is worse than one that does not
 * render at all.
 *
 * ⚠️ **AND IT CATCHES ONLY THIS ERROR.** A blanket `catch` would swallow a genuine defect elsewhere
 * in the derivation and render a reassuring sentence over it. Anything that is not the vocabulary
 * error is rethrown untouched.
 */

/** The exact prefix `declinesByReason` puts on its vocabulary error, and nothing else. */
const VOCABULARY_ERROR_PREFIX = "declinesByReason:";

export type DeclineReadout =
  | { readonly ok: true; readonly value: DeclinesByReason }
  | {
      readonly ok: false;
      /**
       * What to render where the breakdown would have gone. A sentence, never a nought and never a
       * dash — a nought here would be a false figure, because the true count is unknown rather
       * than zero.
       */
      readonly statement: string;
      /** The underlying message, for the disclosure a reader can open. */
      readonly detail: string;
    };

export function readDeclinesByReason(movements: Movement[]): DeclineReadout {
  try {
    return { ok: true, value: declinesByReason(movements) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Anything that is not the vocabulary error is a defect this module has no business hiding.
    if (!message.startsWith(VOCABULARY_ERROR_PREFIX)) throw error;

    return {
      ok: false,
      statement:
        "Declines cannot be broken down by reason: at least one movement carries a reason this " +
        "prototype does not recognise. The total is not shown, because a total computed without " +
        "that reason would be lower than the truth rather than uncertain.",
      detail: message,
    };
  }
}
