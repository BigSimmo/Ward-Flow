import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { blankCssComments } from "./helpers/strip-source-comments";

/**
 * 🔴 **THE RAISE TRADED ONE DEFECT FOR THE RISK OF ANOTHER, AND THIS IS WHAT STOPS THE SECOND.**
 *
 * Owner ruling **O-16.2, 2026-09-11**: the four Delays waiting columns go to the 12px floor. He
 * ruled that having been told what it costs — the row had **three type ranks** and size was one of
 * the three channels carrying them, recorded in `delays.module.css`'s own Task 3 comment:
 *
 *     "The audit measured 402 of ~610 text nodes on this screen at one size and one weight —
 *      meta, cause and figures were all indistinguishable. Three ranks now exist on a row."
 *
 * ⚠️ **After the raise every element on the row is one size.** The ranks survive on **colour** and
 * on **family + weight**, and nothing else. **So the two remaining channels stopped being
 * decoration and became the whole hierarchy** — and a later tidy-up that "harmonises" a colour
 * would re-create the 2026 defect from the other direction, with no size difference left to soften
 * it and no test anywhere to notice.
 *
 * 🔴 **WHAT THIS ASSERTS IS THE PROPERTY, NOT THE VALUES.** It does not pin `--ward-text` or
 * `--ward-muted` by name — a future palette change may rename both and should not redden this. It
 * asserts that the blocker and the demographics beside it are **still distinguishable on some
 * declared channel**, which is the thing the owner was promised when he accepted one size.
 *
 * ⚠️ **AND ITS HONEST LIMIT, stated because this file will be read as more than it is:** this is a
 * STYLESHEET check. It proves the declarations differ; it cannot prove the rendered pixels do, and
 * it cannot see an ancestor rule that overrides either. **The rendered-pixel half belongs to the
 * browser enumeration, which is in a loop nobody currently schedules.** A green run here means the
 * ranks are still declared apart — not that a coordinator can see them.
 */

const DELAYS_CSS = "src/components/ward-management/delays/delays-data-views.module.css";

/** The declarations of one class, comments blanked so a commented-out rule cannot satisfy this. */
function ruleBody(css: string, className: string): string {
  const match = new RegExp(String.raw`(^|\n)\.${className}\s*\{([^}]*)\}`, "u").exec(css);
  expect(match, `.${className} has no rule in ${DELAYS_CSS} — the row's shape changed`).not.toBeNull();
  return (match as RegExpExecArray)[2];
}

function declaration(body: string, property: string): string | undefined {
  return new RegExp(String.raw`${property}:\s*([^;]+);`, "u").exec(body)?.[1]?.trim();
}

describe("the Delays waiting table keeps its type ranks after the table redesign", () => {
  const css = blankCssComments(readFileSync(DELAYS_CSS, "utf8"));

  /**
   * The floor itself. Pinned as EQUALS a single shared value rather than "not the old one":
   * an unresolvable token would also not be the old one, and would paint the inherited size.
   */
  it("puts all four waiting columns on one declared size, and it is not the retired 10px step", () => {
    const sizes = ["cause", "profile", "wait", "update"].map((name) => ({
      name,
      size: declaration(ruleBody(css, name), "font-size"),
    }));

    for (const { name, size } of sizes) {
      expect(size, `.${name} declares no font-size — it would inherit, which is not a decision`).toBeDefined();
      expect(size, `.${name} is still on the retired 10px step`).not.toBe("var(--text-3xs)");
      expect(size, `.${name} carries a hard-coded size rather than a scale step`).toMatch(/^var\(--[a-z0-9-]+\)$/u);
    }

    expect(new Set(sizes.map((entry) => entry.size)).size, "the four columns no longer share one size").toBe(1);
  });

  /**
   * 🔴 THE RANK ITSELF. `.personCause` is the blocker — the reason the row exists — and
   * `.personMeta` is the demographics line beneath it. They were one size and two colours before
   * the raise; they are one size and two colours after it, and the colour is now the only thing
   * left. If these two ever declare the same colour, the blocker and the demographics become one
   * rank and nothing else on this row separates them.
   */
  it("keeps the blocker distinguishable from the demographics beside it", () => {
    const cause = ruleBody(css, "cause");
    const meta = ruleBody(css, "profile");

    const channels = ["color", "font-weight", "font-family", "text-transform"] as const;
    const differing = channels.filter((channel) => declaration(cause, channel) !== declaration(meta, channel));

    expect(
      differing,
      "the blocker and the demographics beneath it now declare the same colour, weight, family and " +
        "case — and since O-16.2 they are the same size too, so nothing separates them. That is the " +
        "2026 audit defect reached from the other direction: 'meta, cause and figures were all " +
        "indistinguishable'. Restore a channel rather than deleting this assertion.",
    ).not.toEqual([]);
  });

  /**
   * The scan rail. `.personId` is what a coordinator runs their eye down, and it was the one
   * element already at 12px — so the raise brought everything else UP TO it, leaving it with no
   * size advantage at all. Its rank is now entirely mono + weight + ink.
   */
  it("keeps the scan rail distinguishable now that the raise removed its size advantage", () => {
    const id = ruleBody(css, "patientButton");
    const meta = ruleBody(css, "profile");

    const channels = ["color", "font-weight", "font-family"] as const;
    const differing = channels.filter((channel) => declaration(id, channel) !== declaration(meta, channel));

    expect(
      differing.length,
      ".personId no longer differs from the supporting facts on enough channels — it was the row's " +
        "scan rail and the raise took away the size that distinguished it",
    ).toBeGreaterThanOrEqual(2);
  });

  /**
   * ⚠️ The anti-vacuity floor. Every assertion above reads rules out of one stylesheet by name; if
   * that file is ever restructured so the names no longer match, `ruleBody` fails loudly rather
   * than returning an empty body that satisfies everything. This proves the reader works at all.
   */
  it("actually read the stylesheet, rather than passing over an empty parse", () => {
    expect(css.length, "the stylesheet read as empty").toBeGreaterThan(1000);
    expect(declaration(ruleBody(css, "wait"), "font-family"), "the wait column lost its mono family").toContain("mono");
  });
});
