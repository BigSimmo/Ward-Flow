import type { WardChecksPublication } from "./ward-checks";
import type { WardReconciliationCheck } from "./ward-shell-types";
import styles from "./ward-reconciliation-line.module.css";

/**
 * Ward Flow's rail reconciliation line — standard §8.7 ("There is one check array on the page,
 * and the shell appends to it and never creates it") and §8.3 ("Every count is derived from the
 * page's own data on every load, and the page says whether its figures reconcile"). Round-3
 * review, Critical A: mounted as a sibling of `.railFoot` in `ward-rail.tsx`, not inside it — see
 * that file's own comment for why the foot's own `display: none` below 1000px must not take this
 * sentence with it.
 *
 * 🔴 **THE SENTENCE.** Owner ruling 2026-09-10 §7 superseded the plan's and the standard's own
 * printed text ("Synthetic snapshot at <time>, figures reconcile") with **"Invented figures,
 * reconciled with each other"** — never "Live", never "reconciled with reality". This file is the
 * one place that sentence is composed; nothing else in the shell repeats it (see
 * `ward-bar.tsx`'s Activity drawer, which reflects the same `checks` array with DIFFERENT wording
 * on purpose, so the exact sentence renders exactly once per page regardless of whether a drawer
 * is open).
 *
 * ⚠️ **This said `checks` is REQUIRED and never defaulted, pointing at `ward-shell-types.ts`.**
 * **The prop is `publication` now and that comment was itself rewritten by the same commit**, so
 * the pointer led to a paragraph that no longer said it. A comment citing another file cannot
 * follow it. See `ward-checks.ts` for why this
 * component never creates the array itself.
 */

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** The checks that failed — pure, so a test can assert against it directly. */
export function reconciliationProblems(checks: readonly WardReconciliationCheck[]): readonly WardReconciliationCheck[] {
  return checks.filter((check) => !check.ok);
}

/**
 * The fixed sentence, derived from the check array on every call — never a stored string. `asAt`
 * is an already-formatted clock reading (never `Date.now()` — the caller's own clock, per the
 * repository-wide rule); omitted, the sentence stands alone.
 */
/**
 * 🔴 **THE ONE SOURCE FOR THE UNPUBLISHED SENTENCE — O-9, 2026-09-12.** It was hard-coded THREE
 * times independently: here, in `ward-bar.tsx`'s Activity drawer, and, reworded, in the hub. **Two
 * of the three would have looked finished while the third still said the old thing.**
 *
 * ⚠️ **No terminal full stop**, because the hub continues the sentence with its own clause. Each
 * caller ends it.
 */
export const NO_RECONCILIATION_CLAUSE = "No reconciliation is available for this page yet";

/**
 * 🔴 **THE THIRD STATE, WHICH DID NOT EXIST BEFORE O-9.** A screen that has LOOKED and has nothing
 * to reconcile is not a screen that has said nothing, and neither of them is agreement. **Three
 * facts, three sentences** — before this, the first two were the same empty array and rendered
 * identically.
 */
export const NOTHING_TO_RECONCILE_SENTENCE = "This screen reports nothing to reconcile.";

export function reconciliationSentence(publication: WardChecksPublication, asAt?: string): string {
  /*
   * ⚠️ **A PRE-O-9 BLOCK STOOD HERE AND EVERY ONE OF ITS CLAIMS IS NOW FALSE.** It said nothing
   * under `src/` built a check array, that `layout.tsx` passed `[]` on every ward route, and that
   * the unpublished branch was therefore the only sentence this component ever produced in the
   * running app. 🔴 **All three were true when written and none survived O-9** — and it sat stacked
   * directly above the new block, duplicating its `asAt` paragraph word for word. **Removed rather
   * than left: two comments about one decision are read as one, and the older is read first.**
   */
  /*
   * 🔴 THREE STATES, AND THE FIRST TWO ARE THE ONES THIS SIGNATURE EXISTS TO KEEP APART.
   *
   * Owner ruling D-40 fixed what an empty array MEANS when rendered — "an empty `checks` array is
   * not the same fact as 'every check passed'". ⚠️ It fixed the rendering and not the plumbing:
   * until O-9 nothing in this codebase could distinguish A SCREEN PUBLISHED ZERO CHECKS from NO
   * SCREEN HAS PUBLISHED ANYTHING. Both were `[]`, and both produced the sentence below.
   *
   * 🔴 `??` AND `|| []` CANNOT FLATTEN A UNION. That is the whole reason this takes one.
   *
   * `asAt` is deliberately DROPPED on both absent branches rather than appended. A clock reading
   * says when figures were compared; nothing was compared, so ", as at 09:42" would attach a
   * timestamp to a measurement that never happened.
   */
  if (!publication.published) return `${NO_RECONCILIATION_CLAUSE}.`;
  if (publication.checks.length === 0) return NOTHING_TO_RECONCILE_SENTENCE;
  const problems = reconciliationProblems(publication.checks);
  const core =
    problems.length === 0
      ? "Invented figures, reconciled with each other"
      : `Invented figures, ${problems.length} ${plural(problems.length, "figure does", "figures do")} not reconcile`;
  return asAt ? `${core}, as at ${asAt}.` : `${core}.`;
}

export type WardReconciliationLineProps = {
  /**
   * ⚠️ **A PUBLICATION, NEVER AN ARRAY — O-9.** The caller must handle "no screen has spoken" by
   * name, which is what stops it being collapsed into "empty".
   */
  publication: WardChecksPublication;
  /** An already-formatted clock reading — see `reconciliationSentence` above. */
  asAt?: string;
  className?: string;
  /**
   * The closed rail strip's shape (round-1 review, Important 6): the drawing keeps `#railCheck`
   * in BOTH the open and the closed rail
   * (`command-third-edition.html:11270-11274` and `:11300-11306`), and only clips its own text to
   * a screen-reader-only span in the closed strip (`.rail.closed .railCheck span`,
   * `command-third-edition.html:4014-4025`) — the dot alone is the closed strip's visible mark.
   * The word is never removed, only visually hidden, so a reader always has it.
   */
  compact?: boolean;
};

export function WardReconciliationLine({ publication, asAt, className, compact }: WardReconciliationLineProps) {
  const checks = publication.published ? publication.checks : [];
  const hasChecks = publication.published && checks.length > 0;
  const problems = reconciliationProblems(checks);
  const ok = hasChecks && problems.length === 0;
  /** `"neutral"` is this app's existing word for "nothing asserted either way" (`WardRecordTone`,
   *  `ward-record-row.tsx`), and is the tone `ward-bar.tsx` already uses for this same state —
   *  reused rather than inventing a second name for one fact across two shell surfaces. */
  const tone: "good" | "danger" | "neutral" = !hasChecks ? "neutral" : ok ? "good" : "danger";
  const sentence = reconciliationSentence(publication, asAt);

  return (
    <p
      className={className ? `${styles.line} ${className}` : styles.line}
      data-testid="ward-reconciliation-line"
      data-tone={tone}
      // Round-2 review, Important 2: the drawing's own closed `#railCheck` carries
      // `title="<the sentence>"` (command-third-edition.html:11300-11306) so a sighted mouse user
      // hovering the compact dot still gets the word — this port had it on neither element, so
      // with `compact` the dot's colour alone carried the state (standard §9: "No colour is the
      // only carrier of any state"; the screen-reader path via `sr-only` below was already
      // correct, only the sighted path was missing it). The open shape needs no `title`: its text
      // is already on screen, matching the drawing's own open branch, which carries none either.
      title={compact ? sentence : undefined}
    >
      <span className={styles.dot} data-tone={tone} aria-hidden="true" />
      {/* Tailwind's built-in `sr-only` utility — the same one `ward-bar.tsx` already reaches for
          (its Service/Activity triggers' hidden labels) rather than a second hand-rolled clip
          rule in this module's own CSS. */}
      <span className={compact ? "sr-only" : undefined}>{sentence}</span>
    </p>
  );
}
