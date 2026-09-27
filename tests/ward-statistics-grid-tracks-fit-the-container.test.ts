import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blankCssComments } from "./helpers/strip-source-comments";

/**
 * ═══ A GRID TRACK WHOSE MINIMUM IS AN ABSOLUTE LENGTH GROWS WITH THE READER AND THE PHONE DOES NOT ═
 *
 * `repeat(auto-fill, minmax(16rem, 1fr))` reads like a responsive grid and is not one at the size
 * that matters. `auto-fill` decides HOW MANY tracks fit; it never shrinks a track below the stated
 * minimum. That minimum is in `rem`, so it scales with the reader's text-size setting — while the
 * phone's 375 px does not. Past roughly 130% the single remaining track is wider than its container.
 *
 * 🔴 **On these screens the overflow is CLIPPED, not scrolled.** `statistics.module.css` `.main`
 * declares `overflow-x: hidden`, and both grids are inside it. So the words past the edge are not
 * merely off-screen — there is no gesture, no scrollbar and no keyboard route that reaches them. A
 * bed coordinator raising the text size to read the screen is exactly the person who loses the end
 * of every ward name.
 *
 * `min(<length>, 100%)` fixes it and costs nothing: it is a no-op whenever the track already fits.
 * `board.module.css:1580` has shipped the identical form since before this file existed.
 *
 * ## Why the assertion is about the CLIP as well as the track
 *
 * Someone will eventually delete `overflow-x: hidden`. **That does not retire this rule**, and the
 * test says so rather than silently passing: without the clip the same overflow becomes a sideways
 * scroll of the page body, which `docs/search-chrome-behaviour.md` forbids in its own words. The two
 * failure modes differ only in which forbidden thing happens. So the clip assertion here is a
 * TRIPWIRE that makes the rationale re-checkable, not the reason the cap is required.
 *
 * ## Why this is not repo-wide
 *
 * Six other ward stylesheets carry unguarded `auto-fill` minimums — `bed-map`, `community`,
 * `community-index`, `ward-management-network`, `ward-index`, `board:569`. (Re-counted 2026-09-07
 * with `grep -rn "auto-fill" src/components/ward-management/ --include=*.css`; an earlier pass
 * missed `community-index.module.css:441`'s `minmax(var(--cti-family-column), 1fr)`.) **They are
 * other chats' files, and a guard that reddens work nobody asked to change gets widened until it
 * means nothing.** The clipping ancestor is also established HERE and not there; the same track
 * under a scrolling parent is a different (still unwanted) defect. Widening this is a deliberate
 * decision for whoever owns those files, not a side effect of running the suite.
 *
 * ⚠️ **The population is globbed from disk, never listed.** A new statistics stylesheet is covered
 * the moment it exists; a renamed directory fails the floor below rather than passing on an empty
 * set — which is the shape that lets a guard report clean after it has stopped looking at anything.
 */

const STATISTICS_CSS = "src/components/ward-management/statistics/*.module.css";

/**
 * A `minmax(` whose first argument is a bare length or a bare `var()` — i.e. not `0`, not wrapped
 * in `min(...)`, and not one of the other forms that are already intrinsically shrinkable:
 * `min-content`, `max-content`, `auto`, `fit-content(...)`, `clamp(...)`.
 *
 * ⚠️ **AN EARLIER VERSION OF THIS REGEX FLAGGED `min-content`, `auto`, AND `clamp(...)` — ALL
 * SAFE — AND ITS OWN FAILURE MESSAGE TOLD THE AUTHOR TO WRAP THEM IN `min(<length>, 100%)`, WHICH
 * IS NOT VALID CSS FOR A KEYWORD.** A guard that reddens correct work and then gives advice that
 * cannot be followed is the shape that gets switched off rather than obeyed. Found by adversarial
 * review 2026-09-07; fixed by widening the negative lookahead rather than the population.
 *
 * The lookahead is what makes this safe against `fit-content(...)` and `clamp(...)` containing
 * their own commas: when the first argument starts with one of those, the whole match fails right
 * after `minmax(`, so this regex never captures into their interior and the extra commas inside
 * never confuse it — there is nothing else in the source for `matchAll` to latch onto until the
 * next literal `minmax(`.
 */
const TRACK =
  /minmax\(\s*(?!0[,\s)])(?!min\()(?!min-content\b)(?!max-content\b)(?!auto\b)(?!fit-content\()(?!clamp\()([^,]+),/gu;

/*
 * ⚠️ **USES THE CANONICAL `blankCssComments`, AND DID NOT UNTIL 2026-09-07.** This file hand-rolled
 * its own block-comment stripper, as did a sibling ward guard and a third in
 * `design-token-contract.test.ts` — three independent re-implementations beside a purpose-built
 * helper that already blanks CSS comments in place, preserving every newline AND column.
 *
 * ⚠️ **THE HELPER IS NOT SMARTER THAN THE REGEX, AND AN EARLIER DRAFT OF THIS NOTE SAID IT WAS.**
 * That file's "Round 1, finding M-4" records the not-literal-aware hole — a comment opener inside an
 * ordinary string blanks real code to the next terminator, a silent false negative inside a safety
 * guard — but the fix for it landed in `stripSourceComments`, which DELETES comments and therefore
 * cannot be used anywhere a line number is reported. `blankCssComments` has the same hole.
 *
 * **So the reason to use it is not correctness, it is arity: ONE implementation with ~20 callers
 * instead of five.** The hole is in every copy; concentrating it makes it closable at all, and makes
 * the next fix arrive everywhere instead of in whichever copy its author happened to find.
 *
 * ⚠️ **NOBODY WAS CARELESS. THE HELPER IS UNREACHABLE BY THE NAMES ANYONE SEARCHED.** It is
 * `blankCssComments` in `tests/helpers/strip-source-comments.ts`; the searches were for
 * `withoutComments` and for `style-contracts.ts`. A solution whose name you cannot guess gets
 * re-derived by everyone who needs it, and each copy is worse than the original — because the
 * original's mistakes are the ones already paid for.
 */
function stylesheets() {
  return globSync(STATISTICS_CSS)
    .map((path) => ({ path, text: readFileSync(path, "utf8") }))
    .map(({ path, text }) => ({
      path,
      // Comments quote the very syntax under test — this file's own rationale contains
      // `minmax(16rem, 1fr)` — so they are blanked before matching, preserving line numbers.
      text: blankCssComments(text),
    }));
}

describe("statistics grid tracks can always shrink to their container", () => {
  it("examined a real population, or every assertion below is about nothing", () => {
    const files = stylesheets();
    expect(files.length, "the statistics stylesheets moved; this glob now matches nothing").toBeGreaterThanOrEqual(3);
    const declarations = files.flatMap(({ text }) => [...text.matchAll(/minmax\(/gu)]);
    expect(declarations.length, "no minmax track found at all — the guard would pass vacuously").toBeGreaterThan(3);
  });

  it("no track states a minimum it cannot shrink below", () => {
    const offenders: string[] = [];
    for (const { path, text } of stylesheets()) {
      for (const match of text.matchAll(TRACK)) {
        const line = text.slice(0, match.index).split("\n").length;
        offenders.push(`${path}:${line}  minmax(${match[1].trim()}, …)`);
      }
    }
    expect(
      offenders,
      "a grid track whose minimum is an absolute length or a bare var() cannot shrink below it, so " +
        "at raised text size it exceeds `.main` — which clips horizontally, losing the text with no " +
        "way to reach it. Wrap the minimum: `minmax(min(<length>, 100%), 1fr)`, as " +
        "`board.module.css:1580` does. `minmax(0, …)` is already safe and is not reported, and " +
        "nor are `min-content`, `max-content`, `auto`, `fit-content(...)` or `clamp(...)` — all " +
        "already intrinsically shrinkable, and none of them can be wrapped in `min()` at all.",
    ).toEqual([]);
  });

  it("accepts every intrinsically-shrinkable minimum, and still rejects a bare length or var()", () => {
    // Proves the fix both ways. A regex that only widens acceptance can silently stop catching the
    // real defect, so this asserts ACCEPT and REJECT against the same TRACK the file above runs —
    // not a re-implementation that could drift from it — including the two forms
    // (`fit-content(...)`, `clamp(...)`) whose own arguments contain commas, to prove those inner
    // commas cannot confuse the first-comma split.
    const track = (css: string) => [...css.matchAll(TRACK)].map((match) => match[1].trim());

    const accepted = [
      "minmax(0, 1fr)",
      "minmax(min(16rem, 100%), 1fr)",
      "minmax(min-content, 1fr)",
      "minmax(max-content, 1fr)",
      "minmax(auto, 1fr)",
      "minmax(fit-content(20ch), 1fr)",
      "minmax(clamp(1rem, 2vw, 3rem), 1fr)",
    ];
    for (const css of accepted) {
      expect(track(css), `should NOT flag ${css} — its minimum is already shrinkable`).toEqual([]);
    }

    const rejected = [
      "minmax(16rem, 1fr)",
      "minmax(18rem, 1fr)",
      "minmax(200px, 1fr)",
      "minmax(var(--wb-tile-min), 1fr)",
    ];
    for (const css of rejected) {
      expect(track(css), `should still flag ${css} — a bare length or var() cannot shrink`).not.toEqual([]);
    }

    // And a multi-argument safe function followed by a real offender on the SAME line must still
    // report the offender — proving the lookahead's skip of `clamp(...)`/`fit-content(...)` does not
    // also swallow a genuine defect that happens to sit near one.
    const mixed = "minmax(clamp(1rem, 2vw, 3rem), 1fr); minmax(16rem, 1fr);";
    expect(track(mixed)).toEqual(["16rem"]);
  });

  it("the clipping ancestor is still there, so the rationale above is still the right one", () => {
    const main = readFileSync("src/components/ward-management/statistics/statistics.module.css", "utf8");
    // WIDENED 2026-09-09, `hidden` -> `hidden|clip`, and the reason matters more than the edit.
    // The origin/main fold (1d85db58e7) changed `.main` to `overflow-x: clip`, and this guard went
    // red on a change that STRENGTHENS what it protects: `clip` clips without creating a scroll
    // container, so unlike `hidden` it does not force the neighbouring `overflow-y: visible` into
    // `auto`. The rule pinned one MECHANISM where its own rationale is about the PROPERTY — the
    // shape that reddens correct work and then gets widened until it means nothing.
    //
    // ⚠️ This widening does NOT do that: it still fails closed on `visible`, `auto`, `scroll`, or
    // the declaration being deleted, which are the only ways the clipping is actually lost.
    expect(
      /\.main\s*\{[^}]*overflow-x:\s*(?:hidden|clip)/u.test(main),
      "`.main` no longer clips horizontally — it declares neither `hidden` nor `clip`. The cap is " +
        "STILL required — the overflow now becomes a sideways scroll of the page body, which the " +
        "phone-chrome contract forbids — but this file's stated reason ('the text cannot be " +
        "reached') has become the wrong one. Rewrite the rationale rather than deleting the rule.",
    ).toBe(true);
  });
});
