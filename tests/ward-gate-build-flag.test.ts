import { describe, expect, it } from "vitest";
import { touchesRouteFiles, touchesTooling } from "../scripts/ward-flow/gate-build-flag.mjs";
import { TOOLING_TESTS } from "../scripts/check-ward-expected-reds.mjs";

describe("touchesTooling (WARD_GATE_SKIP_TOOLING decision, R32)", () => {
  it("runs the tooling tests when scripts, hooks, package, test setup or tool config change", () => {
    for (const file of [
      "scripts/ward-flow/run-slot.mjs",
      ".githooks/pre-commit",
      "package.json",
      "package-lock.json",
      "tests/setup/jsdom.setup.ts",
      "vitest.config.mjs",
      "playwright.config.ts",
      "next.config.ts",
      "tsconfig.typecheck.json",
    ]) {
      expect(touchesTooling([file]), file).toBe(true);
    }
  });

  it("skips them for product, test and doc changes", () => {
    expect(
      touchesTooling([
        "src/components/ward-management/alerts/alerts-screen.tsx",
        "tests/ward-flow-reducer.test.ts",
        "docs/ward-flow/decisions.md",
      ]),
    ).toBe(false);
  });

  it("lists only tests whose subject is tooling, never a product guard that runs a script", () => {
    expect(TOOLING_TESTS).not.toContain("tests/ward-text-size-ratchet.test.ts");
    expect(TOOLING_TESTS).not.toContain("tests/ward-absence-wording-is-one-per-fact.test.ts");
    expect(TOOLING_TESTS).toContain("tests/pre-commit-checks.test.ts");
  });
});

describe("touchesRouteFiles (WARD_GATE_BUILD decision)", () => {
  it("keeps the build's own type check when a page, layout or route file changes", () => {
    for (const file of [
      "src/app/mockups/ward-flow/capacity/page.tsx",
      "src/app/mockups/ward-flow/layout.tsx",
      "src/app/mockups/ward-flow/ward/[unitId]/page.tsx",
      "src/app/api/ward/route.ts",
      "src/app/layout.tsx",
      "src/app/mockups/ward-flow/error.tsx",
      "src/proxy.ts",
      "next.config.ts",
      "tsconfig.json",
      "src\\app\\mockups\\ward-flow\\alerts\\page.tsx",
    ]) {
      expect(touchesRouteFiles([file]), file).toBe(true);
    }
  });

  it("lets the build skip it when no route-shaped file changes", () => {
    expect(
      touchesRouteFiles([
        "src/components/ward-management/alerts/alerts-screen.tsx",
        "src/lib/ward-flow-reducer.ts",
        "tests/ward-flow-reducer.test.ts",
        "docs/ward-flow/decisions.md",
        "src/app/mockups/ward-flow/capacity/capacity-helpers.ts",
      ]),
    ).toBe(false);
    expect(touchesRouteFiles([])).toBe(false);
  });
});
