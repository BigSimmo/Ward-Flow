import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { referencedTestChanges } from "../scripts/ward-flow/test-module-dependencies.mjs";

function fixture(files: Record<string, string>, options = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "ward-module-proof-"));
  writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { allowJs: true, moduleResolution: "bundler", module: "esnext", ...options } }),
  );
  for (const [file, source] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), source);
  }
  return { root, dispose: () => rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }) };
}

describe("resolved test dependencies", () => {
  it("does not confuse a same-named production helper or prose with a test import", () => {
    const f = fixture({
      "tests/a.test.ts": "const a = 1;",
      "tests/b.test.ts": "import '../src/a'; // a",
      "src/a.ts": "export const a=1;",
    });
    try {
      expect(
        referencedTestChanges({
          root: f.root,
          population: ["tests/a.test.ts", "tests/b.test.ts"],
          changed: ["tests/a.test.ts"],
        }),
      ).toEqual([]);
    } finally {
      f.dispose();
    }
  });
  it("finds indirect imports through a shared helper and explicit js extension resolution", () => {
    const f = fixture({
      "tests/a.test.ts": "const a=1;",
      "tests/b.test.ts": "import './helper.js';",
      "tests/helper.ts": "import './a.test';",
    });
    try {
      expect(
        referencedTestChanges({
          root: f.root,
          population: ["tests/a.test.ts", "tests/b.test.ts"],
          changed: ["tests/a.test.ts"],
        }),
      ).toEqual(["tests/a.test.ts"]);
    } finally {
      f.dispose();
    }
  });
  it.each([
    "import('./missing')",
    "const file='x'; import(file)",
    "require(unknown)",
    "export const helper=1",
    "const invalid = ;",
    "eval('import(unknown)')",
    "new Function('return import(unknown)')",
  ])("refuses uncertain or exported modules: %s", (source) => {
    const f = fixture({ "tests/a.test.ts": source });
    try {
      expect(
        referencedTestChanges({ root: f.root, population: ["tests/a.test.ts"], changed: ["tests/a.test.ts"] }),
      ).toEqual(["tests/a.test.ts"]);
    } finally {
      f.dispose();
    }
  });
  it("resolves configured aliases and re-exports", () => {
    const f = fixture(
      { "tests/a.test.ts": "const a=1;", "tests/b.test.ts": "export * from 'tests-alias/a.test';" },
      { baseUrl: ".", paths: { "tests-alias/*": ["tests/*"] } },
    );
    try {
      expect(
        referencedTestChanges({
          root: f.root,
          population: ["tests/a.test.ts", "tests/b.test.ts"],
          changed: ["tests/a.test.ts"],
        }),
      ).toEqual(["tests/a.test.ts"]);
    } finally {
      f.dispose();
    }
  });
});
