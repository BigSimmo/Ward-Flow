import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEME_CHOICES } from "@/components/ward-management/settings/settings-panes";

const guide = readFileSync("docs/ward-flow/desk-guides/accessibility.md", "utf8");

describe("accessibility desk guide (P14)", () => {
  it("gives the six approved shapes and meanings (v6 rule 7)", () => {
    const pairs = [...guide.matchAll(/^- \*\*(.+?)\*\*: (.+)\.$/gm)].map((m) => [m[1], m[2]]);
    expect(pairs.slice(0, 6)).toEqual([
      ["Triangle", "act now"],
      ["Filled amber circle", "at risk"],
      ["Tick", "done"],
      ["Capsule", "moving"],
      ["Ring", "waiting"],
      ["Cross", "declined or closed"],
    ]);
  });

  it("lists the theme choices Settings offers, in order", () => {
    const labels = THEME_CHOICES.map((choice) => choice.label);
    expect(guide).toContain(`${labels.slice(0, -1).join(", ")} or ${labels.at(-1)}.`);
  });
});
