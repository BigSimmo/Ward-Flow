import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { referencedTestChanges } from "../scripts/ward-flow/test-module-dependencies.mjs";

function referencedChanges(consumer: string) {
  const root = mkdtempSync(path.join(tmpdir(), "ward-deps-"));
  try {
    mkdirSync(path.join(root, "tests"));
    writeFileSync(path.join(root, "tsconfig.json"), "{}");
    writeFileSync(path.join(root, "tests/consumer.test.ts"), consumer);
    // Neither changed file exports helpers: only a dependency or uncertainty can block reuse.
    writeFileSync(path.join(root, "tests/dependency.test.ts"), "const dependency = 1;\n");
    writeFileSync(path.join(root, "tests/unrelated.test.ts"), "const unrelated = 1;\n");
    writeFileSync(path.join(root, "tests/bridge.ts"), 'import "./dependency.test";\n');
    return referencedTestChanges({
      root,
      population: ["tests/consumer.test.ts", "tests/dependency.test.ts", "tests/unrelated.test.ts"],
      changed: ["tests/dependency.test.ts", "tests/unrelated.test.ts"],
    });
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

describe("test module dependency uncertainty", () => {
  it.each([
    'const modulePath = "./dependency.test"; const loaded = await import(modulePath);',
    "const modulePath = `./dependency.test`; const loaded = await import(modulePath);",
    'const modulePath = "./dependency.test"; const loaded = require(modulePath);',
    'const sharedHttpModulePath = "./dependency.test"; const { handler } = (await import(sharedHttpModulePath)) as { handler: unknown };',
    'const modulePath = "./bridge"; const loaded = await import(modulePath);',
    'const modulePath = "./dependency.test"; await import(modulePath); await import(modulePath);',
    'async function load() { const modulePath = "./dependency.test"; await import(modulePath); }',
  ])("resolves immutable literal module references without blocking unrelated changes: %s", (consumer) => {
    expect(referencedChanges(consumer)).toEqual(["tests/dependency.test.ts"]);
  });

  it("does not mark a constant built-in module load as uncertain", () => {
    expect(referencedChanges('const modulePath = "node:fs"; await import(modulePath);')).toEqual([]);
  });

  it.each([
    'let modulePath = "./dependency.test"; await import(modulePath);',
    "const modulePath = getModulePath(); await import(modulePath);",
    "const modulePath = `./${name}.test`; await import(modulePath);",
    'const modulePath = "./missing"; await import(modulePath);',
    "declare const modulePath: string; await import(modulePath);",
    'const modulePath = "./dependency.test"; modulePath = "./unrelated.test"; await import(modulePath);',
    'const modulePath = "./dependency.test"; [modulePath] = ["./unrelated.test"]; await import(modulePath);',
    'const modulePath = "./dependency.test"; function load(modulePath: string) { return import(modulePath); } await import(modulePath);',
    'const modulePath = "./dependency.test"; function load({ modulePath }: { modulePath: string }) { return import(modulePath); } await import(modulePath);',
    'const modulePath = "./dependency.test"; { let modulePath = getModulePath(); import(modulePath); } await import(modulePath);',
    'const modulePath = "./dependency.test"; await import(modulePath); function mutate() { modulePath = "./unrelated.test"; }',
    'const modulePath = "./dependency.test"; async function load() { const modulePath = "./unrelated.test"; await import(modulePath); } await import(modulePath);',
    'globalThis["modulePath"] = "./unrelated.test"; async function load() { const modulePath = "./dependency.test"; await import(modulePath); } await import(modulePath);',
  ])("keeps the full gate for unsafe, shadowed or unresolved references: %s", (consumer) => {
    expect(referencedChanges(consumer)).toEqual(["tests/dependency.test.ts", "tests/unrelated.test.ts"]);
  });

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
      writeFileSync(path.join(root, "tests/a.test.ts"), "const a = 1;\n");
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
