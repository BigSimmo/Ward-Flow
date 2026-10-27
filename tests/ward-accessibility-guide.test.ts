import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const guide = readFileSync("docs/ward-flow/desk-guides/accessibility.md", "utf8");
const glyph = readFileSync("src/components/wf/status-glyph.tsx", "utf8")
  .replace(/\s*\*\s*/g, " ")
  .toLowerCase();
const panes = readFileSync("src/components/ward-management/settings/settings-panes.tsx", "utf8");

describe("accessibility desk guide (P14)", () => {
  it("gives the six shapes and meanings exactly as the status glyph defines them", () => {
    const pairs = [...guide.matchAll(/^- \*\*(.+?)\*\*: (.+)\.$/gm)].map((m) => [m[1], m[2]]);
    const shapes = pairs.slice(0, 6);
    expect(shapes.map(([, meaning]) => meaning)).toEqual([
      "act now",
      "at risk",
      "done",
      "moving",
      "waiting",
      "declined or closed",
    ]);
    for (const [shape, meaning] of shapes) expect(glyph).toContain(`${shape!.toLowerCase()} ${meaning}`);
  });

  it("names only settings that exist, with their own labels", () => {
    for (const label of [
      'title="Reduce motion"',
      'sub="Stops slides and pulses"',
      'title="High contrast"',
      'sub="Stronger edges and ink"',
      'title="Theme"',
      'title="Display"',
      'label: "Glare"',
    ]) {
      expect(panes).toContain(label);
    }
  });
});
