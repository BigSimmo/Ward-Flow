import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractScriptRefs,
  findStaleRefs,
  parsePackageScripts,
  MAINTAINED_ROOT_DOCS,
  stripHistoricalSections,
} from "../scripts/check-docs-script-refs.mjs";

describe("maintained root guidance", () => {
  it("includes the original-source boundary while excluding its preserved incident commands", () => {
    expect(MAINTAINED_ROOT_DOCS).toContain("README.local-source.md");
    const document = [
      "Current `npm run ensure`.",
      "<!-- docs-script-refs:historical-start -->",
      "Old `npm run removed-worker`.",
      "<!-- docs-script-refs:historical-end -->",
      "Current `npm run absent-current`.",
    ].join("\n");
    const refs = extractScriptRefs(stripHistoricalSections(document));
    expect(findStaleRefs(refs, new Set(["ensure"]))).toEqual(["absent-current"]);
  });
});

describe("instruction continuation coverage", () => {
  it("scans the root continuation so moved commands stay checked", async () => {
    expect(MAINTAINED_ROOT_DOCS).toContain("PROJECT-INSTRUCTIONS-CONTINUATION.md");
    const { readFileSync } = await import("node:fs");
    const text = readFileSync("PROJECT-INSTRUCTIONS-CONTINUATION.md", "utf8");
    const pkg = parsePackageScripts(readFileSync("package.json", "utf8"));
    const refs = extractScriptRefs(stripHistoricalSections(text));
    expect(refs).toContain("sync:pr-branches");
    expect(findStaleRefs(refs, pkg)).toEqual([]);
  });
});

describe("missing maintained documents", () => {
  it("fails instead of passing when a maintained root document is absent", () => {
    const root = mkdtempSync(path.join(tmpdir(), "docs-script-refs-"));
    try {
      mkdirSync(path.join(root, "scripts"));
      mkdirSync(path.join(root, "docs"));
      copyFileSync("scripts/check-docs-script-refs.mjs", path.join(root, "scripts/check-docs-script-refs.mjs"));
      writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: { build: "x" } }));
      for (const doc of MAINTAINED_ROOT_DOCS.filter((name) => name !== "PROJECT-INSTRUCTIONS-CONTINUATION.md"))
        writeFileSync(path.join(root, doc), "Run `npm run build`.\n");
      const result = spawnSync(process.execPath, [path.join(root, "scripts/check-docs-script-refs.mjs")], {
        encoding: "utf8",
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("PROJECT-INSTRUCTIONS-CONTINUATION.md: maintained document could not be read");
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});

describe("parsePackageScripts", () => {
  it("returns the set of script names", () => {
    const set = parsePackageScripts(JSON.stringify({ scripts: { build: "x", "verify:cheap": "y" } }));
    expect(set.has("build")).toBe(true);
    expect(set.has("verify:cheap")).toBe(true);
    expect(set.size).toBe(2);
  });
});

describe("extractScriptRefs", () => {
  it("extracts npm run tokens from inline code spans and fenced blocks", () => {
    const md = ["Run `npm run verify:cheap` first.", "```bash", "npm run build", "pnpm run lint", "```"].join("\n");
    const refs = extractScriptRefs(md);
    expect(refs).toEqual(expect.arrayContaining(["verify:cheap", "build", "lint"]));
  });

  it("ignores npm run mentions in prose (outside code)", () => {
    expect(extractScriptRefs("just npm run the thing normally")).toEqual([]);
  });

  it("captures the script name with flags following it", () => {
    expect(extractScriptRefs("`npm run eval:quality -- --rag-only`")).toEqual(["eval:quality"]);
  });
});

describe("findStaleRefs", () => {
  const valid = new Set(["build", "verify:cheap"]);
  it("flags references with no matching script", () => {
    expect(findStaleRefs(["build", "verify:gone"], valid)).toEqual(["verify:gone"]);
  });
  it("skips allowlisted and placeholder tokens", () => {
    expect(findStaleRefs(["<script>", "your-script"], valid)).toEqual([]);
  });
  it("returns empty when everything resolves", () => {
    expect(findStaleRefs(["build", "verify:cheap"], valid)).toEqual([]);
  });
});
