import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StatusGlyph, type WfTone } from "@/components/wf";
import { COLOUR_LEGEND } from "@/components/ward-management/help/ward-help-legend";

/** Every WfTone, checked by the compiler: a new tone fails typecheck here until the legend covers it. */
const EVERY_TONE: Record<WfTone, true> = {
  danger: true,
  warning: true,
  success: true,
  info: true,
  neutral: true,
  closed: true,
};

describe("Help colour code legend", () => {
  it("covers every WfTone exactly once", () => {
    expect(COLOUR_LEGEND.map((entry) => entry.tone).toSorted()).toEqual(Object.keys(EVERY_TONE).toSorted());
  });

  it("keeps the six approved meanings and shapes (v6 rule 7)", () => {
    expect(COLOUR_LEGEND.map((entry) => [entry.meaning, entry.shape])).toEqual([
      ["Act now", "Triangle"],
      ["At risk", "Filled amber circle"],
      ["Done", "Tick"],
      ["Moving", "Capsule"],
      ["Waiting", "Ring"],
      ["Declined or closed", "Cross"],
    ]);
  });

  it("draws a hidden glyph with a shape for each tone", () => {
    for (const entry of COLOUR_LEGEND) {
      const html = renderToStaticMarkup(createElement(StatusGlyph, { tone: entry.tone }));
      expect(html).toMatch(/^<svg[^>]*aria-hidden="true"[^>]*><(path|circle|rect)\b/);
    }
  });
});
