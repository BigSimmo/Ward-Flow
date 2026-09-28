import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sourceRoot = resolve(process.cwd(), "src");
// The four PsychSift-only internal arrow controls (calculators/guided-flow.tsx,
// calculators/search-detail.tsx, clinical-dashboard/settings-dialog.tsx,
// formulation/formulation-builder-page.tsx) went with PsychSift on 25 September 2026.
function productionArrowFiles() {
  return globSync("{app,components}/**/*.tsx", { cwd: sourceRoot })
    .map((file) => file.replaceAll("\\", "/"))
    .filter((file) => !file.toLowerCase().includes("mockup"))
    .filter((file) => {
      const source = readFileSync(resolve(sourceRoot, file), "utf8");
      return (
        /<ArrowLeft(?:\s|>)/.test(source) ||
        /<ArrowLeftIcon(?:\s|>)/.test(source) ||
        /icon=\{ArrowLeft\}/.test(source) ||
        /icon:\s*ArrowLeft\b/.test(source)
      );
    });
}

describe("page-level back-arrow contract", () => {
  it("routes every production page-level left arrow through contextual browser history", () => {
    const violations = productionArrowFiles().filter((file) => {
      const source = readFileSync(resolve(sourceRoot, file), "utf8");
      return !/ContextualBackLink|navigateContextuallyBack|behavior:\s*["']history-back["']/.test(source);
    });

    expect(violations).toEqual([]);
  });

  it("keeps the standalone not-found link contextual with an explicit Ward Flow fallback", () => {
    const arrowFiles = new Set(productionArrowFiles());
    const source = readFileSync(resolve(sourceRoot, "app/not-found.tsx"), "utf8");
    expect(arrowFiles.has("app/not-found.tsx")).toBe(true);
    expect(source).toContain("<ContextualBackLink");
    expect(source).toContain('fallbackHref="/mockups/ward-flow"');
    expect(source).toContain("Back to Ward Flow");
  });
});
