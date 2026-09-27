import { edHomeSummaries } from "../ed/ed-home-derivations";
import { clockState, splitDuration, type Instant } from "../ward-clock";
import { ED_ACCESS_TARGET_MINUTES, type Movement } from "../ward-model";
import type { WardConfiguration } from "../ward-configuration";

/**
 * 🔴 **EVERY NUMBER IN THIS PROTOTYPE THAT TURNS A SCREEN AMBER WITHOUT SAYING SO ON THE SCREEN
 * ITSELF — owner-ruled 2026-09-12, and the state of each one is MEASURED rather than written down.**
 *
 * **The three decisions he made, each put to him with the measurement behind it:**
 *
 *     the two thresholds the drawing lists and the app does NOT have   🔴 NOT ADDED. A number that
 *         changes a colour with nobody's name against it is exactly what this table exists to
 *         expose; adding two more of that kind would be self-defeating. The drawing's own note on
 *         both read *"No owner recorded. Nobody has approved this figure."*
 *     the one threshold the app HAS and the drawing omits              ✅ PUBLISHED — the legal-form
 *         deadline tint. A table naming two imaginary thresholds while omitting the real one would
 *         be the least accurate thing on the screen.
 *     a state per row                                                  ✅ ADDED.
 *
 * 🔴 **WHY THE STATE IS COMPUTED AND NOT TYPED, WHICH IS THE POINT OF THIS MODULE.** Two states look
 * identical to anybody using the app — nothing is ever amber — and they need opposite responses. **A
 * hand-written state column would be a second source about the first, and its going stale would be
 * invisible for the very same reason:** a row that says *nothing reaches it* and a row that is simply
 * wrong both render as no amber anywhere. ✅ **Each row is measured against the same data the
 * threshold itself is read against, so a seed that gains an overdue form flips that row by itself.**
 *
 * ⚠️ **AND NOTHING HERE RE-DERIVES A THRESHOLD.** `pastAccessTarget` is `edHomeSummaries`' own
 * figure, and the legal-form state is `clockState(...) === "breached"`, the same predicate
 * `ward-pressure.ts` tints on. **A table about where numbers live must not become a second place one
 * lives.**
 */
export type ThresholdState =
  /** Something in today's data reaches it, so the amber is visible somewhere right now. */
  | "fires-now"
  /** It exists and works, and no record currently reaches it. A safeguard nobody can see. */
  | "nothing-reaches-it";

export type PublishedThreshold = {
  readonly id: string;
  readonly figure: string;
  readonly triggers: string;
  readonly livesIn: string;
  readonly setBy: string;
  readonly state: ThresholdState;
  /** How many records reach it right now — the evidence behind `state`, shown rather than trusted. */
  readonly reached: number;
};

function stateFor(reached: number): ThresholdState {
  return reached > 0 ? "fires-now" : "nothing-reaches-it";
}

export function publishedThresholds(
  movements: readonly Movement[],
  now: Instant,
  configuration: WardConfiguration,
): readonly PublishedThreshold[] {
  const accessTarget = configuration.edAccessTargetMinutes;
  // `pastAccessTarget` is the ED home's own count of people past the CONFIGURED target — reused,
  // never recomputed, so this table cannot disagree with the screen it describes. Task 6 of the
  // audit-wiring plan, 2026-09-16: `edHomeSummaries` now requires a target rather than reading the
  // module constant itself.
  const pastAccessTarget = edHomeSummaries(movements, now, accessTarget).reduce(
    (total, summary) => total + summary.pastAccessTarget,
    0,
  );

  // The same predicate `ward-pressure.ts` tints a department's card on. A deadline is per-form, so
  // this threshold has no single constant to quote — which is itself worth saying in the row.
  const breachedForms = movements.filter(
    (movement) => movement.legalForm?.dueAt !== undefined && clockState(movement.legalForm.dueAt, now) === "breached",
  ).length;

  return [
    {
      id: "ed-access-target",
      figure:
        accessTarget === ED_ACCESS_TARGET_MINUTES
          ? `${accessTarget} minutes (${splitDuration(accessTarget)}) in an emergency department, counted from arrival.`
          : `${accessTarget} minutes (${splitDuration(accessTarget)}) in an emergency department, counted from arrival. ` +
            `The product owner's own figure is ${ED_ACCESS_TARGET_MINUTES} minutes (${splitDuration(ED_ACCESS_TARGET_MINUTES)}); a coordinator has since configured the target on this screen away from it.`,
      triggers:
        "The departmental access target line on the Emergency department screen, read against how long the patient has been there.",
      livesIn:
        "Coordinator-configured on this screen; defaults to the named constant ED_ACCESS_TARGET_MINUTES in ward-model.ts.",
      setBy:
        "The product owner, 22 August 2026, replacing an earlier four-hour figure from the spec, in answer to a direct clinical question. A departmental performance measure only, never a Mental Health Act deadline. A coordinator may move it within a bounded range on this screen; every change is recorded.",
      state: stateFor(pastAccessTarget),
      reached: pastAccessTarget,
    },
    {
      id: "legal-form-deadline",
      figure:
        "A legal form's own due time, once it has passed. There is no single number here — each form carries its own deadline.",
      triggers: "The amber tint on a department's pressure card on Command, and the same card's overdue-form count.",
      livesIn:
        "ward-pressure.ts, which counts movements whose legalForm.dueAt has passed; the tint is in coordinator.module.css.",
      setBy:
        "The product owner, 17 September 2026 (owner answer 1): the clinician types the expiry written on whichever legal form they are holding, and this figure tints once that typed expiry is close or passed. Nothing here computes a deadline for any form — a form with no typed expiry simply never reaches this row.",
      state: stateFor(breachedForms),
      reached: breachedForms,
    },
  ];
}
