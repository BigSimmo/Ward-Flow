/**
 * THE SEARCH HUB'S RECONCILIATION LINE, COPIED FROM ITS OWN DRAWING RATHER THAN COMPOSED.
 *
 * `docs/ward-flow/mockups/search-hub-third-edition.html` builds this sentence in its own engine,
 * and the two branches below are that construction transcribed. It is a module rather than an
 * inline template because the sentence has THREE forms that must each be exercised, and a template
 * literal inside a 900-line component can only ever be tested through whichever branch the
 * rendered fixture happens to take.
 *
 * ⚠️ **COPY, DO NOT COMPOSE — AND THE TRAILING CLAUSE IS WHY.** The instruction that reached this
 * lane described the sentence as carrying "the clock and the last event". **This screen has no
 * event feed**, and its own drawing says so in the sentence: `no event feed on this screen`. A
 * builder composing from the description would put a last event on a screen that has none — a false
 * sentence, on the one line whose entire job is to be true read alone. Every screen's trailing
 * clause comes from that screen's own drawing and none of them may be assumed from another's.
 *
 * ⚠️ **THE DISAGREEING BRANCH IS THE HALF THAT DOES THE WORK.** Without it the line reads
 * *"reconciled with each other"* whatever the figures actually do, which is a green light wired to
 * nothing — the exact defect the third edition exists to close. It is written and tested here even
 * though the app cannot yet reach it; see `hubReconciliationLine`'s own note.
 */

/**
 * The line, in whichever of its two forms the figures call for.
 *
 * `problems` is the number of checks that did not reconcile. The drawing reads them from one shared
 * check array that the shell owns and each screen appends to (standard §8.7: *"There is one check
 * array on the page, and the shell appends to it and never creates it."*).
 *
 * 🔴 **THE SHELL DOES NOT EXIST YET, so today's caller can only ever pass zero** — Phase 1 builds
 * the check array, and wiring this to it is a named follow-up, not something this function can do
 * for itself. **That is exactly why the disagreeing branch is proved here, by unit test, rather
 * than through the screen.** A branch reachable only from a fixture nobody renders is a branch
 * nobody has checked, and it would sit wrong and green until the day the shell landed.
 *
 * The plural is a function of the count: *"1 figure does not reconcile"*, *"2 figures do not
 * reconcile"*. A test written against a two-problem fixture alone passes while the commoner
 * one-problem case reads wrong.
 *
 * 🔴 **`asAt` IS OPTIONAL, AND OMITTING IT IS THE NORMAL CASE ON THIS SCREEN.** Ward Lead's rule,
 * 2026-09-10, after this screen printed the clock twice on consecutive lines:
 *
 *     where a screen already carries an app-side freshness line with the clock, THAT line wins
 *     and the drawing's sentence renders WITHOUT its clock; where no such line exists, the
 *     sentence carries the clock.
 *
 * The Search hub renders `As at <clock>, Perth` immediately above this, and **that line carries a
 * fact this sentence does not — the timezone.** Two clocks on consecutive lines is worse than one,
 * because it invites the reader to work out which is right. The sentence is **true read alone**
 * without a time; the rule is about truth, not completeness.
 *
 * ⚠️ **BOTH FORMS ARE TESTED, and that is deliberate.** An optional parameter is only ever wrong
 * when it is omitted, so a suite that always passes one proves nothing about the shape the screen
 * actually renders — and here the omitted form is the one in production.
 */
import { NO_RECONCILIATION_CLAUSE } from "@/components/ward-management/shell/ward-reconciliation-line";

export function hubReconciliationLine(problems: number | null, asAt?: string): string {
  /*
   * 🔴 `null` IS "NOTHING WAS RECONCILED", AND IT EXISTS BECAUSE A NUMBER COULD NOT SAY IT.
   * The note above called the caller's `0` a placeholder for the shell's check array. The shell
   * landed on 2026-09-11 and the check array still does not exist — nothing under `src/` builds a
   * `WardReconciliationCheck[]`, and `layout.tsx` passes `[]` on every ward route. So `0` was not
   * a placeholder standing in for a count; it was ZERO PROBLEMS asserted over ZERO CHECKS, and it
   * printed "reconciled with each other" on a screen where nothing had been compared.
   *
   * ⚠️ THE SIGNATURE ITSELF CARRIED THE DEFECT. `problems: number` cannot distinguish "every
   * check passed" from "no check ran" — one word, two states, in a parameter type. Widening it is
   * the fix; a caller passing a sentinel number would have hidden the same collision one level up.
   *
   * The disagreeing branch is KEPT, as the note instructs — this adds a third state rather than
   * replacing either of the two that existed.
   */
  /*
   * ⚠️ ONE SOURCE FOR THE CLAUSE — O-9, 2026-09-12. This sentence was hard-coded THREE times
   * independently: the rail's composer, the bar's Activity drawer, and here with its own extra
   * clause. Two of the three would have looked finished while the third still said the old thing.
   * The clause carries no terminal stop precisely so this caller can continue it.
   */
  if (problems === null) return `${NO_RECONCILIATION_CLAUSE}, no event feed on this screen`;
  const state =
    problems > 0
      ? `${problems} ${problems === 1 ? "figure does" : "figures do"} not reconcile`
      : "reconciled with each other";
  const clock = asAt === undefined ? "" : `, as at ${asAt}`;
  return `Invented figures, ${state}${clock}, no event feed on this screen`;
}
