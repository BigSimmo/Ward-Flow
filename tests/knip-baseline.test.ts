import { describe, expect, it } from "vitest";

import { baselineGrowth, compareToBaseline, entriesFromReport } from "../scripts/check-knip-baseline.mjs";

describe("knip baseline ratchet", () => {
  const report = {
    issues: [
      { file: "src/a.ts", files: [], exports: [{ name: "unusedA" }], types: [{ name: "UnusedType" }] },
      { file: "src/old.tsx", files: [{ name: "src/old.tsx" }], exports: [] },
      { file: "package.json", devDependencies: [{ name: "left-pad" }] },
      { file: "src/b.ts", duplicates: [[{ name: "one" }, { name: "two" }]] },
    ],
  };

  it("names each unused item by category, file and symbol", () => {
    expect(entriesFromReport(report)).toEqual([
      "devDependencies:package.json:left-pad",
      "duplicates:src/b.ts:one|two",
      "exports:src/a.ts:unusedA",
      "files:src/old.tsx",
      "types:src/a.ts:UnusedType",
    ]);
  });

  it("flags a new unused item and a fixed one", () => {
    const current = ["exports:src/a.ts:unusedA", "exports:src/c.ts:brandNew"];
    const baseline = ["exports:src/a.ts:unusedA", "files:src/old.tsx"];
    expect(compareToBaseline(current, baseline)).toEqual({
      added: ["exports:src/c.ts:brandNew"],
      fixed: ["files:src/old.tsx"],
    });
  });

  it("passes when nothing changed", () => {
    expect(compareToBaseline(["exports:src/a.ts:unusedA"], ["exports:src/a.ts:unusedA"])).toEqual({
      added: [],
      fixed: [],
    });
  });

  it("names baseline entries the base commit did not have", () => {
    expect(baselineGrowth(["a", "b", "c"], ["a", "c", "z"])).toEqual(["b"]);
    expect(baselineGrowth(["a"], ["a", "b"])).toEqual([]);
  });

  it("counts catalog findings", () => {
    const report = { issues: [{ file: "package.json", catalog: [{ name: "react" }] }] };
    expect(entriesFromReport(report)).toEqual(["catalog:package.json:react"]);
  });
});
