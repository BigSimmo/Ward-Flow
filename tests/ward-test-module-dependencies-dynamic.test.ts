import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { referencedTestChanges } from "../scripts/ward-flow/test-module-dependencies.mjs";

describe("test module dependency uncertainty", () => {
  it("does not treat new Function or createRequire with literal loads as unresolved module loads", () => {
    const root = mkdtempSync(path.join(tmpdir(), "ward-deps-"));
    try {
      mkdirSync(path.join(root, "tests"));
      writeFileSync(path.join(root, "tsconfig.json"), "{}");
      writeFileSync(path.join(root, "tests/a.test.ts"), 'const run = new Function("return 1");\nrun();\n');
      writeFileSync(
        path.join(root, "tests/b.test.ts"),
        'import { createRequire } from "node:module";\nconst r = createRequire(import.meta.url);\nr("node:fs");\n',
      );
      expect(
        referencedTestChanges({
          root,
          population: ["tests/a.test.ts", "tests/b.test.ts"],
          changed: ["tests/a.test.ts"],
        }),
      ).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });
  it("keeps the full gate for an unresolvable dynamic require", () => {
    const root = mkdtempSync(path.join(tmpdir(), "ward-deps-"));
    try {
      mkdirSync(path.join(root, "tests"));
      writeFileSync(path.join(root, "tsconfig.json"), "{}");
      writeFileSync(path.join(root, "tests/a.test.ts"), "export const a = 1;\n");
      writeFileSync(path.join(root, "tests/b.test.ts"), "declare const n: string;\nrequire(n);\n");
      expect(
        referencedTestChanges({
          root,
          population: ["tests/a.test.ts", "tests/b.test.ts"],
          changed: ["tests/a.test.ts"],
        }),
      ).toEqual(["tests/a.test.ts"]);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });
});
