import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("shortlist eligibility rows honour the open-gates filter", () => {
  it("restates display: none for a hidden row, because the row sets display: grid", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/components/ward-management/coordinator/coordinator.module.css"),
      "utf8",
    );
    expect(css).toMatch(/\.shortlistGateRow\s*\{[^}]*display:\s*grid/);
    expect(css).toMatch(/\.shortlistGateRow\[hidden\]\s*\{[^}]*display:\s*none/);
  });
});
