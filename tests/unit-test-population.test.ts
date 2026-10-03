import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DOM_UNIT_TEST_GLOBS,
  NODE_UNIT_TEST_GLOBS,
  isOfflineUnitTestFile,
  offlineUnitTestProject,
} from "../scripts/unit-test-population.mjs";

describe("offline unit population", () => {
  it("matches the actual project glob union without overlap or live providers", () => {
    const normalise = (file: string) => file.replace(/\\/g, "/");
    const node = globSync(NODE_UNIT_TEST_GLOBS).map(normalise).filter(isOfflineUnitTestFile);
    const dom = globSync(DOM_UNIT_TEST_GLOBS).map(normalise).filter(isOfflineUnitTestFile);
    const population = globSync("tests/**/*").map(normalise).filter(isOfflineUnitTestFile);
    expect(new Set([...node, ...dom]).size).toBe(node.length + dom.length);
    expect([...node, ...dom].sort()).toEqual(population.sort());
    expect(population.filter((file) => file === "tests/ward-dynamic-island-rollout.contract.test.tsx")).toHaveLength(1);
    expect(node.every((file) => offlineUnitTestProject(file) === "node")).toBe(true);
    expect(dom.every((file) => offlineUnitTestProject(file) === "jsdom")).toBe(true);
  });

  it("excludes live tests and unsupported suffixes while classifying nested contracts", () => {
    expect(offlineUnitTestProject("tests/nested/example.contract.test.tsx")).toBe("jsdom");
    for (const file of [
      "tests/example.live.test.ts",
      "tests/example.spec.ts",
      "tests/example.test.tsx",
      "other/example.test.ts",
      "tests/../example.test.ts",
    ]) {
      expect(isOfflineUnitTestFile(file), file).toBe(false);
    }
  });
});
