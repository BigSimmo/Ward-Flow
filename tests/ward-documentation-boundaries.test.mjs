import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
