import { test } from "vitest";
import { removePathSync } from "../scripts/retryable-fs.mjs";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { execFileSync, spawnSync } from "node:child_process";
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
    removePathSync(root, { recursive: true });
  }
});

test("ownership parser recognises exact root dotfiles and rejects malformed claims", () => {
  const source = readFileSync(new URL("../scripts/pre-commit-checks.mjs", import.meta.url), "utf8");
  const body = source.slice(
    source.indexOf("function signOutEntries("),
    source.indexOf("function signOutEntriesForCheckout("),
  );
  const parse = vm.runInNewContext(body + "; signOutEntries");
  const claim = (file: string) =>
    `- 2026-10-02 | fixture | codex/fixture | D:/fixture | ${file}, repo=BigSimmo/Ward-Flow`;
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
    removePathSync(root, { recursive: true });
  }
});

test("tooling map describes retirement without offering the importer as a generated-file gate", () => {
  const map = readFileSync(new URL("../docs/ward-flow/code-map/scripts-and-tooling.md", import.meta.url), "utf8");
  assert.match(map, /sync-lessons\.mjs.*Retired importer/);
  assert.doesNotMatch(map, /node scripts\/ward-flow\/sync-lessons\.mjs --check/);
  assert.doesNotMatch(map, /\|[^\n]*sync-lessons\.mjs/);
});

test(
  "receipt exporter verifies real Git destinations, ancestry and non-blank completion evidence",
  { timeout: 90_000 },
  () => {
    const root = mkdtempSync(join(tmpdir(), "ward-receipt-boundaries-"));
    const checkout = join(root, "checkout");
    const output = join(root, "receipts");
    const input = join(root, "input.json");
    const exporter = fileURLToPath(new URL("../scripts/export-task-receipt.py", import.meta.url));
    const canonical = "https://github.com/BigSimmo/Ward-Flow.git";
    const anchor = "e735c1f8d34df005becf720b96752626a4f1dcc8";
    const git = (...args: string[]) =>
      execFileSync("git", ["-C", checkout, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    const run = (evidence = ["https://example.invalid/synthetic-evidence"]) => {
      writeFileSync(
        input,
        JSON.stringify({
          task_id: "receipt-fixture",
          title: "Synthetic receipt",
          status: "Completed",
          lifecycle: "complete",
          source_reference: "https://example.invalid/synthetic-task",
          source_revision: git("rev-parse", "HEAD"),
          evidence,
          last_verified: "2026-01-01T00:00:00Z",
          sanitised: true,
        }),
      );
      const result = spawnSync(
        process.platform === "win32" ? "python" : "python3",
        [exporter, "--repo", checkout, "--input", input, "--output-directory", output],
        {
          encoding: "utf8",
          timeout: 10_000,
        },
      );
      assert.equal(result.error, undefined);
      return result;
    };
    const rejected = (evidence?: string[]) => {
      const result = run(evidence);
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /Receipt rejected/);
      assert.equal(existsSync(output), false);
    };
    try {
      // All Git operations are local; the fixture borrows object history, never contacts GitHub.
      execFileSync("git", ["clone", "--quiet", "--shared", "--no-checkout", process.cwd(), checkout], {
        stdio: "pipe",
      });
      git("remote", "set-url", "origin", canonical);
      git("update-ref", "refs/remotes/origin/main", anchor);
      git("config", "remote.origin.pushurl", "https://github.com/BigSimmo/PsychSift.git");
      rejected();
      git("config", "--unset", "remote.origin.pushurl");
      git("remote", "set-url", "origin", "https://github.com/BigSimmo/PsychSift.git");
      rejected();
      git("remote", "set-url", "origin", canonical);
      const original = git("rev-parse", "HEAD");
      git("checkout", "--quiet", "--orphan", "foreign-fixture");
      git(
        "-c",
        "core.hooksPath=.git/hooks",
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "--quiet",
        "--allow-empty",
        "-m",
        "foreign history",
      );
      const foreign = git("rev-parse", "HEAD");
      rejected();
      git("checkout", "--quiet", "--detach", original);
      git("update-ref", "refs/remotes/origin/main", foreign);
      rejected();
      git("update-ref", "refs/remotes/origin/main", anchor);
      rejected(["   "]);
      rejected(["https://example.invalid/evidence", "\t\n"]);
      const accepted = run();
      assert.equal(accepted.status, 0, accepted.stderr);
      const records = readdirSync(join(output, "ward-flow"));
      assert.equal(records.length, 1);
      const record = JSON.parse(readFileSync(join(output, "ward-flow", records[0]!), "utf8"));
      assert.equal(record.repository, "BigSimmo/Ward-Flow");
      assert.equal(record.observed_head, original);
      assert.equal(record.stale_source, false);
      assert.deepEqual(record.task.evidence, ["https://example.invalid/synthetic-evidence"]);
    } finally {
      assert.equal(root.startsWith(join(tmpdir(), "ward-receipt-boundaries-")), true);
      removePathSync(root, { recursive: true });
    }
  },
);
