import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  stripHistoricalSections,
  extractScriptRefs,
  findStaleRefs,
  collectInstructionDocs,
} from "../scripts/check-docs-script-refs.mjs";
const historical = [
  "npm run missing-current",
  "<!-- docs-script-refs:historical-start -->",
  "npm run missing-old",
  "<!-- docs-script-refs:historical-end -->",
  "npm run build",
]
  .map((s) => (s.startsWith("npm") ? `\`${s}\`` : s))
  .join("\n");
test("history exclusion leaves current stale commands blocking", () => {
  assert.deepEqual(findStaleRefs(extractScriptRefs(stripHistoricalSections(historical)), new Set(["build"])), [
    "missing-current",
  ]);
  assert.deepEqual(findStaleRefs(extractScriptRefs(stripHistoricalSections(historical, true)), new Set(["build"])), [
    "missing-current",
    "missing-old",
  ]);
});
for (const [label, body] of [
  ["unclosed", "<!-- docs-script-refs:historical-start -->"],
  ["reversed", "<!-- docs-script-refs:historical-end -->"],
  ["nested", "<!-- docs-script-refs:historical-start -->\n<!-- docs-script-refs:historical-start -->"],
  ["unknown", "<!-- docs-script-refs:historical-other -->"],
  ["inline", "text <!-- docs-script-refs:historical-start -->"],
  ["spacing", "<!--docs-script-refs:historical-start -->"],
  ["trailing", "<!-- docs-script-refs:historical-start --> text"],
])
  test(`${label} markers fail in normal and all modes`, () => {
    assert.throws(() => stripHistoricalSections(body));
    assert.throws(() => stripHistoricalSections(body, true));
  });
test("nested native instructions included, dependencies excluded", () => {
  const root = mkdtempSync(join(tmpdir(), "ward-doc-instructions-"));
  try {
    mkdirSync(join(root, "src"));
    mkdirSync(join(root, "node_modules"));
    writeFileSync(join(root, "src", "CLAUDE.md"), "current");
    writeFileSync(join(root, "GEMINI.md"), "current");
    writeFileSync(join(root, "node_modules", "AGENTS.md"), "vendor");
    assert.deepEqual(collectInstructionDocs(root).sort(), ["GEMINI.md", "src/CLAUDE.md"]);
  } finally {
    assert.equal(root.startsWith(join(tmpdir(), "ward-doc-instructions-")), true);
    rmSync(root, { recursive: true });
  }
});

test("ownership parser recognises exact root dotfiles and rejects malformed claims", () => {
  const source = readFileSync(new URL("../scripts/pre-commit-checks.mjs", import.meta.url), "utf8");
  const body = source.slice(
    source.indexOf("function signOutEntries("),
    source.indexOf("function signOutEntriesForCheckout("),
  );
  const parse = vm.runInNewContext(body + "; signOutEntries");
  const claim = (file) => `- 2026-10-02 | fixture | codex/fixture | D:/fixture | ${file}, repo=BigSimmo/Ward-Flow`;
  for (const file of [".prettierignore", "package.json", "docs/current.md", ".env.example"])
    assert.equal(parse(claim(file))[0].paths.includes(file), true, file);
  for (const file of ["..", ".", "bad space.md", "C:/outside/file.md"])
    assert.equal(parse(claim(file))[0].paths.includes(file), false, file);
});

test("retired lesson importer refuses ordinary and check runs without file access", () => {
  const importer = fileURLToPath(new URL("../scripts/ward-flow/sync-lessons.mjs", import.meta.url));
  // With no imports or require, the retirement stub cannot load a private store.
  assert.doesNotMatch(readFileSync(importer, "utf8"), /^\s*import\b|\brequire\s*\(|\bimport\s*\(/m);
  const root = mkdtempSync(join(tmpdir(), "ward-retired-importer-"));
  try {
    const store = join(root, ".claude", "projects", "D--Repos-Database", "memory");
    mkdirSync(store, { recursive: true });
    const sentinel = join(store, "fixture.md");
    writeFileSync(sentinel, "synthetic sentinel");
    for (const args of [[], ["--check"]]) {
      const result = spawnSync(process.execPath, [importer, ...args], {
        cwd: root,
        env: { ...process.env, HOME: root, USERPROFILE: root },
        encoding: "utf8",
        timeout: 5000,
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /import is retired/);
      assert.equal(readFileSync(sentinel, "utf8"), "synthetic sentinel");
      assert.equal(existsSync(join(root, "docs")), false);
    }
  } finally {
    assert.equal(root.startsWith(join(tmpdir(), "ward-retired-importer-")), true);
    rmSync(root, { recursive: true });
  }
});
