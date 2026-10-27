import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { COLOUR_LEGEND } from "@/components/ward-management/help/ward-help-legend";

const root = process.cwd();
const glyphSource = readFileSync(path.join(root, "src/components/wf/status-glyph.tsx"), "utf8");
const tokens = readFileSync(path.join(root, "src/app/ward-flow-v9-tokens.css"), "utf8");

/** The tones `WfTone` declares, read from the type itself so a new tone fails here. */
const declaredTones = [...(/export type WfTone =([^;]+);/.exec(glyphSource)?.[1] ?? "").matchAll(/"([a-z]+)"/g)].map(
  (match) => match[1],
);

describe("Help colour code legend", () => {
  it("covers every WfTone exactly once", () => {
    expect(declaredTones.length).toBeGreaterThan(0);
    expect(COLOUR_LEGEND.map((entry) => entry.tone).toSorted()).toEqual(declaredTones.toSorted());
  });

  it("keeps the six approved meanings", () => {
    expect(COLOUR_LEGEND.map((entry) => entry.meaning)).toEqual([
      "Act now",
      "At risk",
      "Done",
      "Moving",
      "Waiting",
      "Declined or closed",
    ]);
  });

  it("pairs each shape with its meaning as the glyph comment does (v6 rule 7)", () => {
    const comment = glyphSource
      .toLowerCase()
      .replaceAll(/\s*\*\s*/g, " ")
      .replaceAll(/\s+/g, " ");
    for (const entry of COLOUR_LEGEND) {
      expect(comment).toContain(`${entry.shape} ${entry.meaning}`.toLowerCase());
    }
  });

  it("every coloured tone has a token in the v9 tokens", () => {
    for (const tone of ["danger", "warning", "success", "info", "neutral"]) {
      expect(tokens).toMatch(new RegExp(`--wf-${tone}:`));
    }
  });
});
