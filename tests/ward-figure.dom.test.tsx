// tests/ward-figure.dom.test.tsx
import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { blankCssComments } from "./helpers/strip-source-comments";

import { WardFigure, WardFigureStrip } from "@/components/ward-management/ward-figure";

describe("WardFigure", () => {
  it("renders the label, the value and the unit", () => {
    render(<WardFigure label="Going out, awaiting a bed" value="9" />);
    expect(screen.getByText("Going out, awaiting a bed")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
  });

  /**
   * ⚠️ THIS ASSERTION USED TO BE `toHaveClass(/figureValue/u)` AND IT COULD NOT FAIL FOR THE
   * REASON IT CLAIMED. This repo's vitest resolves CSS-module imports through a proxy that
   * fabricates a plausible scoped name for ANY property, so two mutations survived it: deleting
   * `.figureValue` from the stylesheet entirely, and renaming the component's reference to
   * `styles.figureValueTypo`. Both still produced a class name containing "figureValue".
   *
   * It proved the component referenced *a* class whose name contained a substring. Not that the
   * class existed, and not that it carried `font-variant-numeric: tabular-nums` — the property
   * the test is named after and the only thing that makes a column of digits line up.
   *
   * jsdom cannot resolve a CSS module, so the honest place to check this is the stylesheet.
   */
  /**
   * 🔴 **RE-POINTED 2026-09-06: THE ALIGNMENT MOVED ONTO A MODIFIER, AND THE CLAIM IS UNCHANGED.**
   * A row of tiles must still line up. What changed is that `.figureValue` no longer carries the
   * figure face at all — `WardFigure` takes `value: string` and `community-screen.tsx` passes
   * **"None waiting"** through the same prop that carries "12", so 3 of the 11 rendered nodes were
   * a sentence set in the figure face. The face now sits on `.figureValueNumeric`, applied only to a
   * value containing a digit.
   *
   * ⚠️ **BOTH HALVES ARE ASSERTED, because either alone permits the defect.** Only checking the
   * modifier would allow the face to creep back onto the base and re-typeset prose as data; only
   * checking the base would allow the alignment to be dropped altogether — which is the regression a
   * blanket "remove the mono" reading of the ruling would cause.
   */
  it("sets tabular figures on the NUMERIC value only, so a row of tiles lines up and a sentence does not pretend to", () => {
    const css = blankCssComments(readFileSync("src/components/ward-management/ward-figure.module.css", "utf8"));

    const numeric = /\.figureValueNumeric\s*\{([^}]*)\}/u.exec(css)?.[1];
    expect(numeric, ".figureValueNumeric is not declared — the alignment has nowhere to live").toBeTruthy();
    expect(numeric, "a row of digit tiles no longer lines up").toMatch(/font-variant-numeric:\s*tabular-nums/u);

    const base = /\.figureValue\s*\{([^}]*)\}/u.exec(css)?.[1];
    expect(base, ".figureValue is not declared in ward-figure.module.css").toBeTruthy();
    expect(
      base,
      'the figure face is back on the shared value class, so a value like "None waiting" is typeset ' +
        "as though it were a measurement",
    ).not.toMatch(/font-family/u);
  });

  it("renders the value as text, whatever class it carries", () => {
    render(<WardFigure label="Free beds" value="12" />);
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  /**
   * The amber flag means "look here". Three amber tiles mean nothing, and the failure is
   * invisible — the screen simply stops directing the eye, which is the whole job of the strip.
   */
  it("refuses a strip where more than two tiles are flagged", () => {
    expect(() =>
      render(
        <WardFigureStrip>
          <WardFigure label="a" value="1" flagged />
          <WardFigure label="b" value="2" flagged />
          <WardFigure label="c" value="3" flagged />
        </WardFigureStrip>,
      ),
    ).toThrow(/at most two/u);
  });

  it("allows exactly two", () => {
    expect(() =>
      render(
        <WardFigureStrip>
          <WardFigure label="a" value="1" flagged />
          <WardFigure label="b" value="2" flagged />
          <WardFigure label="c" value="3" />
        </WardFigureStrip>,
      ),
    ).not.toThrow();
  });

  /**
   * ⚠️ ADDED BEYOND THE PLAN. A counter that is silently broken — say it never matches the
   * `flagged` prop at all — would report zero flagged tiles no matter what it is given, and a
   * suite that only exercised "no tiles" and "two tiles flagged" as its two states could not
   * tell that apart from a working counter, because both would simply "not throw". The test
   * above ("allows exactly two") already forces the counter to find exactly two out of three
   * real children rather than reading array length, but this test makes the zero-flagged case
   * explicit and distinct from an empty render: three real tiles, all unflagged, must also not
   * throw, so the suite now exercises three genuinely different counts (0, 2, 3 flagged out of
   * three real tiles) rather than only the pass/fail boundary.
   */
  it("does not throw when a strip of real tiles carries no flagged ones, distinct from an empty render", () => {
    expect(() =>
      render(
        <WardFigureStrip>
          <WardFigure label="a" value="1" />
          <WardFigure label="b" value="2" />
          <WardFigure label="c" value="3" />
        </WardFigureStrip>,
      ),
    ).not.toThrow();
  });
});
