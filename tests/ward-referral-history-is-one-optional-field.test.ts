/** @vitest-environment node */
import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * THE REFERRAL'S HISTORY — ONE FIELD, OPTIONAL, AND NOTHING THAT DECIDES MAY READ IT.
 *
 * Lane C task 16. **This does not build the ruling; the ruling is already built. It builds the
 * guard that keeps it**, and the thing it is defending against is a helpful builder reading a stale
 * drawing.
 *
 * **The ruling.** Owner, 2026-08-30, upheld as `Q-13` on 2026-09-10 and recorded in
 * `docs/ward-flow/owner-rulings-2026-09-05.md` §1 (FD-13), verbatim: *"one story box, optional, and
 * keep the two-pane layout."*
 *
 * 🔴 **THE DRAWING STILL SHOWS THREE, AND THAT IS WHY THIS FILE EXISTS.**
 * `docs/ward-flow/mockups/raise-a-referral-third-edition.html` still draws `data-story="why"`,
 * `data-story="background"` and `data-story="risk"`. Q-13's answer was *"the ruling — one field;
 * Ward Mockups redraws"*, and **the redraw has not happened.** A mockup sits outside every gate, so
 * until it is corrected the drawing is a standing invitation to re-add two fields — and before this
 * file, **nothing in the repository would have gone red when somebody accepted it.**
 *
 * ⚠️ **The third drawn box is "Risk and safety", captioned "Never scored".** `UNSAVED_HISTORY_WARNING`
 * on that same screen says the prose written there *"is never saved anywhere"*. A referrer typing
 * risk information into a box that discards it, on a screen that never says so beside that box, is
 * a clinical hazard rather than a layout preference — which is the strongest reading of why FD-13
 * went the way it did.
 */

/**
 * The modules that DECIDE — eligibility, referral state and the ward-facing projection. The ruling
 * is that the story never feeds any of them.
 *
 * ⚠️ Named explicitly rather than swept, because "a module that decides" is not a property a file
 * path carries. The existence assertion below is what stops this list rotting into a guard over
 * three files that no longer exist.
 */
const DECIDING_MODULES = [
  "src/components/ward-management/ward-eligibility.ts",
  "src/components/ward-management/ward-referrals.ts",
  "src/components/ward-management/ward-referral-visibility.ts",
];

/**
 * 🔴 COMMENTS ARE STRIPPED, AND THE FIRST DRAFT OF THIS GUARD WOULD HAVE FAILED WITHOUT IT.
 *
 * A plain search for `.history` across the ward tree returns
 * `referrals/referral-destination-options.ts:280` and `ward-board-derivations.ts:128`. **Both are
 * comments, and both say the opposite of a violation** — each reads, in substance, *history is prose
 * about a person and no gate may ever read it.*
 *
 * **So the better the rule is documented, the more violations a naive scan reports** — the same
 * shape that put this repository's text-size ratchet in the red on 2026-09-11, where two comments
 * recording that the 12px floor had been honoured were counted as breaking it. A guard over source
 * text must read what the file DOES, never what it says about itself.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments, including JSDoc
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const READS_HISTORY = /\.history\b|\["history"\]|\['history'\]/;

describe("the referral's history — one field, optional, last", () => {
  /*
   * "Is exactly one field, and it is not required" read `HISTORY_FIELDS` from the full-page intake
   * form, retired on 8 Oct 2026 (the referral slide-out is the one place a referral is written). The
   * slide-out's own tests own its fields; the guard below, that nothing deciding reads the history,
   * stands unchanged.
   */
  /**
   * The anti-vacuity floor, and it guards two different ways of proving nothing: a module list that
   * has rotted into paths nothing reads, and a comment-stripper so aggressive it returns an empty
   * string for every file.
   */
  it("the modules it guards exist and still contain code after stripping", () => {
    expect(DECIDING_MODULES.length).toBeGreaterThan(0);
    for (const path of DECIDING_MODULES) {
      expect(existsSync(path), `${path} no longer exists — this guard is watching nothing`).toBe(true);
      expect(code(readFileSync(path, "utf8")).trim().length, `${path} stripped to nothing`).toBeGreaterThan(200);
    }
  });

  it("the predicate can actually fire, and is not fooled by a comment", () => {
    // Without these two, a typo in READS_HISTORY or an over-eager stripper passes everything.
    expect(READS_HISTORY.test(code("const x = referral.history;"))).toBe(true);
    expect(READS_HISTORY.test(code("// no gate may ever read referral.history"))).toBe(false);
    expect(READS_HISTORY.test(code("/* history is prose: referral.history is never read */"))).toBe(false);
  });

  it("is never read by anything that decides", () => {
    const offenders = DECIDING_MODULES.filter((path) => READS_HISTORY.test(code(readFileSync(path, "utf8"))));
    expect(
      offenders,
      "a module that decides reads the referral's written history. The owner's ruling is that the " +
        "story is sent word for word to a human and never scored — nothing checks it, and a gate " +
        "reading it would be the system forming a judgement from free text nobody validated.",
    ).toEqual([]);
  });
});
