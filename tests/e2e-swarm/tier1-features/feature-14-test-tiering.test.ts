import { describe, it, expect } from "vitest";
import {
  NODE_UNIT_TEST_GLOBS,
  DOM_UNIT_TEST_GLOBS,
  LIVE_UNIT_TEST_GLOBS,
  offlineUnitTestProject,
  isOfflineUnitTestFile,
} from "../../../scripts/unit-test-population.mjs";
import { vitestLeaseMode } from "../../../scripts/test-run-selection.mjs";

describe("Feature 14: Test Suite Runtime Tiering (Tier A/B/C)", () => {
  it("defines distinct globs for Tier A (node), Tier B (DOM/contract), and Tier C (live)", () => {
    expect(NODE_UNIT_TEST_GLOBS).toEqual(["tests/**/*.test.ts"]);
    expect(DOM_UNIT_TEST_GLOBS).toEqual([
      "tests/**/*.dom.test.tsx",
      "tests/**/*.contract.test.tsx",
    ]);
    expect(LIVE_UNIT_TEST_GLOBS).toEqual(["tests/**/*.live.test.ts"]);
  });

  it("classifies pure node unit tests into Tier A ('node')", () => {
    expect(offlineUnitTestProject("tests/unit/ward-model.test.ts")).toBe("node");
    expect(offlineUnitTestProject("tests/e2e-swarm/tier1-features/feature-01-lock-deadlock.test.ts")).toBe("node");
    expect(isOfflineUnitTestFile("tests/unit/ward-model.test.ts")).toBe(true);
  });

  it("classifies component rendering and contract tests into Tier B ('jsdom')", () => {
    expect(offlineUnitTestProject("tests/components/ward-drawer.dom.test.tsx")).toBe("jsdom");
    expect(offlineUnitTestProject("tests/contracts/ward-api.contract.test.tsx")).toBe("jsdom");
    expect(isOfflineUnitTestFile("tests/components/ward-drawer.dom.test.tsx")).toBe(true);
  });

  it("excludes live provider tests (Tier C) and non-test files from offline populations", () => {
    expect(offlineUnitTestProject("tests/integration/supabase-sync.live.test.ts")).toBe(null);
    expect(offlineUnitTestProject("src/components/ward-flow.tsx")).toBe(null);
    expect(offlineUnitTestProject("tests/helpers/test-harness.ts")).toBe(null);
    expect(isOfflineUnitTestFile("tests/integration/supabase-sync.live.test.ts")).toBe(false);
  });

  it("resolves execution lease modes correctly based on command args", () => {
    // "related" triggers exclusive mode because import fan-out is unbounded
    expect(vitestLeaseMode(["related"])).toBe("exclusive");

    // Empty run args without files defaults to exclusive
    expect(vitestLeaseMode([])).toBe("exclusive");
  });
});
