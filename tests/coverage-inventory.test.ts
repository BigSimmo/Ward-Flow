import { describe, expect, it } from "vitest";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { checkCoverageInventory, lcovSourceFiles, missingCoverageRoots } from "../scripts/check-coverage-inventory.mjs";
import { COVERAGE_INCLUDE_GLOBS, COVERAGE_INVENTORY_ROOTS } from "../scripts/coverage-contract.mjs";

const completeLcov = ["TN:", "SF:src/lib/example.ts", "end_of_record", "SF:scripts/example.mjs", "end_of_record"].join(
  "\n",
);

describe("coverage inventory", () => {
  it("requires every real file in the declared population and rejects invented paths", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "ward-coverage-"));
    try {
      mkdirSync(path.join(root, "src"));
      mkdirSync(path.join(root, "scripts"));
      for (const file of ["src/one.ts", "src/two.tsx", "scripts/check.mjs"])
        writeFileSync(path.join(root, file), "export {};\n");
      writeFileSync(path.join(root, "src/types.d.ts"), "declare const x: string;\n");
      const complete = "SF:src/one.ts\nSF:src/two.tsx\nSF:scripts/check.mjs\n";
      expect(checkCoverageInventory(complete, { root }).missing).toEqual([]);
      expect(checkCoverageInventory(complete.replace("SF:src/two.tsx\n", ""), { root }).missing).toEqual([
        "src/two.tsx",
      ]);
      expect(checkCoverageInventory("SF:src/fake.ts\nSF:scripts/fake.mjs\n", { root }).invalid).toEqual([
        "src/fake.ts",
        "scripts/fake.mjs",
      ]);
      expect(checkCoverageInventory("SF:../outside.ts\n", { root }).invalid).toEqual(["../outside.ts"]);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  // The diagnostic root summary complements the enforcing file-by-file comparison.
  it("fails closed when a declared root disappears", () => {
    const files = lcovSourceFiles(completeLcov).filter((file: string) => !file.startsWith("scripts/"));
    expect(missingCoverageRoots(files)).toEqual(["scripts/"]);
  });

  it("normalizes Windows LCOV paths", () => {
    expect(lcovSourceFiles("SF:src\\lib\\example.ts\nend_of_record\n")).toEqual(["src/lib/example.ts"]);
  });

  it("keeps every inventory root represented by a shared include glob", () => {
    for (const root of COVERAGE_INVENTORY_ROOTS) {
      expect(COVERAGE_INCLUDE_GLOBS.some((glob) => glob.startsWith(root))).toBe(true);
    }
  });

  it("keeps conservative whole-repository floors alongside scoped ratchets", () => {
    const config = readFileSync(new URL("../vitest.config.mts", import.meta.url), "utf8");
    expect(config).toMatch(/thresholds:\s*\{\s*\/\/[\s\S]*?statements: 80,[\s\S]*?branches: 77,/);
    expect(config).toMatch(/functions: 81,[\s\S]*?lines: 81,/);
    expect(config).toContain('"src/{lib/**/*.ts,app/**/route.ts,components/**/*.{ts,tsx}}"');
    // H-0911: the engine the backend bundles keeps a floor of its own.
    expect(config).toContain('"src/components/ward-management/ward-flow-*.ts"');
  });
});
