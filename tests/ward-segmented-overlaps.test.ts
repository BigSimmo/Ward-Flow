import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** One CSS rule block, from its selector to its closing brace (the first, unindented one). */
function block(file: string, selector: string): string {
  const css = readFileSync(resolve(process.cwd(), file), "utf8");
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `${selector} in ${file}`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

describe("registration choices keep their labels (DA-24 follow-up, 20 Oct 2026)", () => {
  /**
   * At 1024px "1 now" lost its first digit to the clipped edge, because this form's own rule set
   * the floor back to 0. Measured in Chromium at 1440, 1280, 1024, 900, 800 and 390px, with and
   * without wider letter and word spacing: every label now fits, in one row at normal spacing.
   */
  const file = "src/components/ward-management/patients/add-patient.module.css";

  it("never shrinks a Triage or Legal status choice below its label", () => {
    const item = block(file, ".segmented.segmented > button");
    expect(item).toMatch(/min-width: 0;\s*min-width: calc-size\(max-content, size - 8px\);/);
    expect(item).toContain("flex: 1 1 0;");
  });

  it("wraps the choices onto a second row when the labels do not fit", () => {
    expect(block(file, ".segmented.segmented")).toContain("flex-wrap: wrap");
  });
});
