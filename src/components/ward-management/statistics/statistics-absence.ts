/**
 * 🔴 **A FIGURE CARRIES ITS OWN STATE, AND AN UNMEASURED ONE HAS NO NUMBER TO RENDER.**
 *
 * Seven states were measured across this family and they are genuinely different facts. Three of
 * them were nearly collapsed into one on the strength of a shared phrase — a sweep found
 * *"not a measurement"* rendered exactly once, while two sentences containing those same words
 * turned out to be a provenance disclaimer over charts that do render values, and a caveat about a
 * displayed average. **Three sentences sharing three words and not a meaning.**
 *
 * ⚠️ **So the distinction cannot live in the prose.** Two screens may word the same state
 * differently and be right, and two screens may word different states identically and be wrong, and
 * a reader cannot tell which. **It lives in the type instead: only `measured` carries a `value`, so
 * a caller cannot render an unmeasured state as a number.**
 *
 * **The defect this exists to make unspellable**, measured on `statistics-community-screen.tsx`: the
 * cell renders `{lists.currentlyAdmitted.length}` with no gate on the resolution state, while the
 * paragraph four lines below calls a zero there *"a confident answer over a question that was never
 * asked"*. The zero is provable — `communityMembershipResolution` returns `members` early when the
 * team has any, and `currentlyAdmitted` filters that same set. **The refusal names the figure it
 * distrusts and the figure renders anyway, above it in reading order and attached to nothing.**
 *
 * **Generalises `cannotBeFormed()` in `statistics-compare-screen.tsx`**, which had the right shape
 * for one state; this carries all seven.
 */
export type StatisticsFigure =
  /** The answer is a number and the number is right. **A nought here is a true answer, not an absence.** */
  | { readonly kind: "measured"; readonly value: number }
  /** A population was checked and nothing satisfied it. */
  | { readonly kind: "empty"; readonly words: string }
  /** Nothing to divide by. **0 of 0 is undefined, not zero.** */
  | { readonly kind: "cannot-be-formed"; readonly words: string }
  /** The prototype keeps current state only, so no history was ever kept. */
  | { readonly kind: "never-recorded"; readonly words: string }
  /** Recorded, then overwritten — one shared field, several acts, so a start and an end cannot both survive. */
  | { readonly kind: "destroyed"; readonly words: string }
  /** The records exist and the join that would relate them cannot run. */
  | { readonly kind: "unlinkable"; readonly words: string }
  /** Computable, and deliberately suppressed because the population is small enough to identify somebody. */
  | { readonly kind: "below-minimum"; readonly words: string; readonly denominator: string };

export function measured(value: number): StatisticsFigure {
  return { kind: "measured", value };
}

export function empty(words: string): StatisticsFigure {
  return { kind: "empty", words };
}

export function cannotBeFormed(words: string): StatisticsFigure {
  return { kind: "cannot-be-formed", words };
}

export function neverRecorded(words: string): StatisticsFigure {
  return { kind: "never-recorded", words };
}

export function destroyed(words: string): StatisticsFigure {
  return { kind: "destroyed", words };
}

export function unlinkable(words: string): StatisticsFigure {
  return { kind: "unlinkable", words };
}

/**
 * ⚠️ **`denominator` IS REQUIRED, NOT OPTIONAL, AND THAT IS THE WHOLE POINT OF THIS ARM.**
 *
 * `ward-management-modes.tsx:235` renders *"from 1 of 27"* beside its suppression — *"which is what
 * makes the absence informative rather than merely blank"*. 🔴 **On a community team's page it does
 * more than that: without the denominator a team cannot tell a WITHHELD figure from a BROKEN one**,
 * and those are two different states that must never look alike.
 *
 * Making it optional would let a caller produce the blank this arm exists to prevent.
 */
export function belowMinimum(words: string, denominator: string): StatisticsFigure {
  return { kind: "below-minimum", words, denominator };
}

/** Everything except a measured figure. Callers use it to mark a cell, never to decide its text. */
export function isUnmeasured(figure: StatisticsFigure): boolean {
  return figure.kind !== "measured";
}

/**
 * The rendered text. **A measured figure renders its number and nothing else** — wording a true
 * nought would break the state this module exists to protect just as surely as printing an
 * unmeasured one would.
 */
export function figureText(figure: StatisticsFigure): string {
  if (figure.kind === "measured") return String(figure.value);
  if (figure.kind === "below-minimum") return `${figure.words} ${figure.denominator}`;
  return figure.words;
}
