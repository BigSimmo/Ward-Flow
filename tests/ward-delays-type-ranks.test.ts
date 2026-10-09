import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { blankCssComments } from "./helpers/strip-source-comments";

/**
 * 🔴 **THE RAISE TRADED ONE DEFECT FOR THE RISK OF ANOTHER, AND THIS IS WHAT STOPS THE SECOND.**
 *
 * Owner ruling **O-16.2, 2026-09-11**: the Delays waiting columns share one size at or above the
 * 12px floor. He ruled that having been told what it costs: size was one of the three channels
 * that separated the row's ranks ("meta, cause and figures were all indistinguishable" in the
 * 2026 audit). With one size, the ranks survive on **colour** and on **family + weight** alone, so
 * a later tidy-up that "harmonises" a colour would re-create the 2026 defect with no size
 * difference left to soften it.
 *
 * The October 2026 Delays board (`delays-board.module.css`) replaced the earlier workspace
 * stylesheet, and this file now reads the board. It asserts the property, not palette names.
 *
 * ⚠️ **ITS HONEST LIMIT:** this is a STYLESHEET check. It proves the declarations differ; the
 * rendered-pixel half is `tests/ui-ward-table-thresholds.spec.ts`, which measures the same four
 * columns in Chromium.
 */

const BOARD_CSS = "src/components/ward-management/delays/delays-board.module.css";
const TOKENS_CSS = "src/app/ward-flow-v6-tokens.css";

/** The declarations of one exact selector, comments blanked so a commented-out rule cannot count. */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = new RegExp(String.raw`(^|\n)${escaped}\s*\{([^}]*)\}`, "u").exec(css);
  expect(match, `${selector} has no rule in ${BOARD_CSS} — the row's shape changed`).not.toBeNull();
  return (match as RegExpExecArray)[2];
}

function declaration(body: string, property: string): string | undefined {
  return new RegExp(String.raw`(?:^|[\s;])${property}:\s*([^;]+);`, "u").exec(body)?.[1]?.trim();
}

describe("the Delays waiting table keeps its type ranks on the October 2026 board", () => {
  const css = blankCssComments(readFileSync(BOARD_CSS, "utf8"));

  /**
   * The size itself, pinned as EQUALS one shared declared step: an unresolvable token would also
   * "not be 10px", and would paint the inherited size.
   */
  it("puts the four waiting columns on one declared table step that resolves to 13px", () => {
    expect(declaration(ruleBody(css, ".tbl [data-ward-type-floor]"), "font-size")).toBe("var(--t-1)");
    expect(declaration(ruleBody(css, ".tbl"), "--t-1"), "the table step is not declared on the table").toBe(
      "var(--wf-fs-13)",
    );
    const tokens = blankCssComments(readFileSync(TOKENS_CSS, "utf8"));
    expect(declaration(tokens, "--wf-fs-13"), "the 13px token no longer resolves to 13px").toBe("13px");
  });

  /**
   * 🔴 THE RANK ITSELF. The blocker cell is the reason the row exists; the profile line under the
   * name is the demographics. They are one size, so they must differ on another declared channel.
   */
  it("keeps the blocker distinguishable from the profile line", () => {
    const cause = ruleBody(css, ".cWard");
    const profile = ruleBody(css, ".whoBtn span");
    const channels = ["color", "font-weight", "font-family", "text-transform"] as const;
    const differing = channels.filter((channel) => declaration(cause, channel) !== declaration(profile, channel));
    expect(
      differing,
      "the blocker and the profile line declare the same colour, weight, family and case, and since " +
        "O-16.2 they are the same size too, so nothing separates them. Restore a channel rather than " +
        "deleting this assertion.",
    ).not.toEqual([]);
    expect(declaration(profile, "color"), "the profile line lost its muted ink").toBeDefined();
  });

  /** The scan rail: the name a coordinator runs their eye down must outrank the profile line. */
  it("keeps the patient name distinguishable from the profile line on at least two channels", () => {
    const name = ruleBody(css, ".whoBtn b");
    const profile = ruleBody(css, ".whoBtn span");
    const channels = ["color", "font-weight", "font-family"] as const;
    const differing = channels.filter((channel) => declaration(name, channel) !== declaration(profile, channel));
    expect(
      differing.length,
      "the name no longer differs from the profile line on enough channels",
    ).toBeGreaterThanOrEqual(2);
    expect(declaration(name, "font-weight"), "the name lost its weight").toBe("600");
  });

  /** ⚠️ The anti-vacuity floor: prove the reader parsed the stylesheet at all. */
  it("actually read the stylesheet, rather than passing over an empty parse", () => {
    expect(css.length, "the stylesheet read as empty").toBeGreaterThan(1000);
    expect(declaration(ruleBody(css, ".num"), "font-family"), "the figures lost their mono family").toBe(
      "var(--wf-mono)",
    );
  });
});
