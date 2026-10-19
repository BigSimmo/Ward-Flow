import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removePathSync } from "../scripts/retryable-fs.mjs";
import {
  addedLines,
  applyMarkers,
  backendEnvNames,
  defaultProvider,
  diffLines,
  findRetiredTerms,
  isHistoricalPath,
  loadRetiredConfig,
  renderFactsDoc,
  run,
  unclosedMarkers,
} from "../scripts/doc-facts.mjs";

const fenceStart = "<!-- docs-script-refs:historical-start -->";
const fenceEnd = "<!-- docs-script-refs:historical-end -->";
const config = {
  terms: [
    {
      id: "azure",
      regex: /\bazure|\bentra\b/gi,
      allowRegex: /\b(retired|removed)\b/iu,
      why: "retired",
      instead: "Supabase",
    },
  ],
  historicalFiles: new Set(["docs/log.md"]),
  historicalPatterns: [/(^|\/)archive\//u, /\d{4}-\d{2}-\d{2}/u],
};

describe("doc facts extractors", () => {
  it("prefers an exported default constant over the env fallback line", () => {
    const source = `export const DEFAULT_DATABASE_PROVIDER = "postgres";\nconst x = env.WARD_DATABASE_PROVIDER || "supabase";`;
    expect(defaultProvider(source, "DEFAULT_DATABASE_PROVIDER", "WARD_DATABASE_PROVIDER")).toBe("postgres");
  });

  it("reads the last quoted default from the env fallback line", () => {
    const source = `const d = env.WARD_DATABASE_PROVIDER || (legacy ? "azure" : "supabase");`;
    expect(defaultProvider(source, "DEFAULT_DATABASE_PROVIDER", "WARD_DATABASE_PROVIDER")).toBe("supabase");
  });

  it("fails loudly when the default can no longer be read", () => {
    expect(() => defaultProvider("const d = 1;", "DEFAULT_DATABASE_PROVIDER", "WARD_DATABASE_PROVIDER")).toThrow(
      /cannot read the default/,
    );
  });

  it("lists backend env names once, sorted, ignoring operating-system variables", () => {
    expect(
      backendEnvNames([
        "env.WARD_B; env?.WARD_A; env.ComSpec; env.WARD_A",
        "env.SUPABASE_URL; env.PORT; env.HOST; env.HOME",
      ]),
    ).toEqual(["HOST", "PORT", "SUPABASE_URL", "WARD_A", "WARD_B"]);
  });

  it("builds the facts page example from the current provider", () => {
    const page = renderFactsDoc([{ name: "database-provider", value: "PostgreSQL", about: "x", source: "y" }], []);
    expect(page).toContain("<!-- fact:database-provider -->PostgreSQL<!-- /fact -->");
    expect(page).not.toContain("Supabase");
  });
});

describe("fact markers", () => {
  const facts = new Map([["database-provider", "Supabase"]]);

  it("rewrites a stale marker and reports it", () => {
    const result = applyMarkers("Uses <!-- fact:database-provider -->Azure<!-- /fact -->.", facts);
    expect(result.updated).toBe("Uses <!-- fact:database-provider -->Supabase<!-- /fact -->.");
    expect(result.stale).toEqual([{ name: "database-provider", current: "Azure", value: "Supabase" }]);
  });

  it("never matches across lines, so a lone opening tag cannot swallow text", () => {
    const text =
      "Quote <!-- fact:database-provider --> like this.\nKeep me.\n<!-- fact:database-provider -->Azure<!-- /fact -->";
    const result = applyMarkers(text, facts);
    expect(result.updated).toBe(
      "Quote <!-- fact:database-provider --> like this.\nKeep me.\n<!-- fact:database-provider -->Supabase<!-- /fact -->",
    );
  });

  it("reports an opening tag with no closing tag on its line", () => {
    expect(unclosedMarkers("ok <!-- fact:a -->1<!-- /fact -->\n<!-- fact:database-provider -->Azure\nmore")).toEqual([
      2,
    ]);
  });

  it("reports a stray closing tag", () => {
    expect(unclosedMarkers("ok\nSupabase<!-- /fact -->")).toEqual([2]);
  });

  it("leaves an unknown fact untouched and reports its name", () => {
    const text = "<!-- fact:made-up -->1<!-- /fact -->";
    const result = applyMarkers(text, facts);
    expect(result.updated).toBe(text);
    expect(result.unknown).toEqual(["made-up"]);
  });
});

describe("retired terms", () => {
  it("finds current mentions with line numbers, case-insensitively", () => {
    expect(findRetiredTerms("a.md", "ok\nUses Azure Storage\nAZURE_TENANT_ID and Entra ID", config)).toEqual([
      { file: "a.md", line: 2, term: "azure", text: "Azure" },
      { file: "a.md", line: 3, term: "azure", text: "AZURE" },
      { file: "a.md", line: 3, term: "azure", text: "Entra" },
    ]);
  });

  it("lets a line that says the term is retired pass", () => {
    expect(findRetiredTerms("a.md", "Azure was retired on 15 October.\nAzure Storage removed.", config)).toEqual([]);
  });

  it("judges each clause on its own, so a retirement note cannot excuse live advice", () => {
    expect(findRetiredTerms("a.md", "Azure was retired; configure Azure Storage here.", config)).toEqual([
      { file: "a.md", line: 1, term: "azure", text: "Azure" },
    ]);
    expect(findRetiredTerms("a.md", "See config.mjs: Azure support was removed.", config)).toEqual([]);
  });

  it("does not match words that merely start with entra", () => {
    expect(findRetiredTerms("a.md", "the entrance and entrants", config)).toEqual([]);
  });

  it("skips fenced history and generated fact values", () => {
    const text = [fenceStart, "Azure was used until October.", fenceEnd, "<!-- fact:x -->AZURE_X<!-- /fact -->"].join(
      "\n",
    );
    expect(findRetiredTerms("a.md", text, config)).toEqual([]);
  });

  it("treats archives, dated records and listed logs as history", () => {
    expect(isHistoricalPath("docs/archive/old.md", config)).toBe(true);
    expect(isHistoricalPath("docs/ward-flow/reports/review-2026-10-08.md", config)).toBe(true);
    expect(isHistoricalPath("docs/log.md", config)).toBe(true);
    expect(isHistoricalPath("docs/hosting.md", config)).toBe(false);
  });

  it("accepts a term whose flags already include g", () => {
    const root = mkdtempSync(join(tmpdir(), "doc-facts-flags-"));
    try {
      mkdirSync(join(root, "docs"));
      writeFileSync(
        join(root, "docs/retired-terms.json"),
        JSON.stringify({ terms: [{ id: "x", pattern: "old", flags: "gi", why: "w", instead: "i" }] }),
      );
      expect(findRetiredTerms("a.md", "OLD thing", loadRetiredConfig(root))).toHaveLength(1);
    } finally {
      removePathSync(root, { recursive: true });
    }
  });

  it("covers Azure in the shipped retired-terms list", () => {
    const shipped = loadRetiredConfig();
    expect(shipped.terms.map((t: { id: string }) => t.id)).toContain("azure");
    expect(isHistoricalPath("docs/ward-flow-task-ledger.md", shipped)).toBe(true);
    expect(
      findRetiredTerms("a.md", "Azure is retired (D-55).\nDeploy to Azure.", shipped).map(
        (h: { line: number }) => h.line,
      ),
    ).toEqual([2]);
  });
});

describe("added lines from a zero-context diff", () => {
  it("collects added line numbers per file, including single-line hunks", () => {
    const diff = [
      "diff --git a/a.md b/a.md",
      "--- a/a.md",
      "+++ b/a.md",
      "@@ -1,0 +2,2 @@",
      "+x",
      "+y",
      "@@ -9 +11 @@",
      "-old",
      "+new",
      "@@ -20,3 +22,0 @@",
      "+++ /dev/null",
    ].join("\n");
    expect([...(addedLines(diff).get("a.md") ?? [])]).toEqual([2, 3, 11]);
    expect(diffLines(diff).removed.get("a.md")).toEqual(["old"]);
  });
});

describe("doc facts run", () => {
  let root = "";
  afterEach(() => {
    if (root) removePathSync(root, { recursive: true });
    root = "";
  });

  function fixture() {
    root = mkdtempSync(join(tmpdir(), "doc-facts-"));
    const put = (rel: string, body: string) => {
      mkdirSync(join(root, rel, ".."), { recursive: true });
      writeFileSync(join(root, rel), body);
    };
    put(
      "backend/ward-flow/config.mjs",
      'const d = env.WARD_DATABASE_PROVIDER || "supabase";\nenv.WARD_AUTH_PROVIDER || "supabase";',
    );
    put("backend/ward-flow/migrations/001-a.sql", "");
    put("src/app/ward-flow/page.tsx", "");
    put("src/app/page.tsx", "");
    put("docs/ward-flow/decisions.md", "## D-1. First\n## D-2. Second\n");
    put("package.json", JSON.stringify({ engines: { node: ">=24" } }));
    put("docs/retired-terms.json", readFileSync(new URL("../docs/retired-terms.json", import.meta.url), "utf8"));
    put(
      "docs/guide.md",
      "Database: <!-- fact:database-provider -->Azure<!-- /fact -->. Next: <!-- fact:next-decision -->D-1<!-- /fact -->\n",
    );
    put("docs/hosting.md", "Old Azure note\n");
    const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
    git("init", "-q", "-b", "main");
    git("-c", "user.email=t@example.invalid", "-c", "user.name=t", "add", ".");
    git("-c", "user.email=t@example.invalid", "-c", "user.name=t", "commit", "-qm", "base");
    return { put, git };
  }

  it("fails on stale facts, then --write fixes the facts page and every marker", () => {
    fixture();
    const before = run({ root });
    expect(before.errors).toContain("docs/FACTS.md is out of date with the source.");
    expect(before.errors).toContain('docs/guide.md: fact "database-provider" says "Azure", source says "Supabase".');
    expect(before.warnings.map((w: { file: string }) => w.file)).toEqual(["docs/hosting.md"]);

    run({ root, write: true });
    expect(readFileSync(join(root, "docs/guide.md"), "utf8")).toContain(
      "<!-- fact:database-provider -->Supabase<!-- /fact -->. Next: <!-- fact:next-decision -->D-3<!-- /fact -->",
    );
    expect(readFileSync(join(root, "docs/FACTS.md"), "utf8")).toMatch(/`latest-decision`\s*\|\s*D-2/u);
    expect(run({ root }).errors).toEqual([]);
  });

  it("fails a retired term only on a line added since the base", () => {
    const { put, git } = fixture();
    run({ root, write: true });
    git("-c", "user.email=t@example.invalid", "-c", "user.name=t", "commit", "-qam", "facts");
    const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    put("docs/hosting.md", "Old Azure note\nNew Azure Function note\n");
    git("-c", "user.email=t@example.invalid", "-c", "user.name=t", "commit", "-qam", "new");

    const result = run({ root, base });
    expect(result.errors).toEqual([{ file: "docs/hosting.md", line: 2, term: "azure", text: "Azure", isNew: true }]);
    expect(result.warnings).toEqual([{ file: "docs/hosting.md", line: 1, term: "azure", text: "Azure", isNew: false }]);
  });

  it("only warns when a branch rewords a line that already named the term", () => {
    const { put, git } = fixture();
    run({ root, write: true });
    git("-c", "user.email=t@example.invalid", "-c", "user.name=t", "commit", "-qam", "facts");
    const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    put("docs/hosting.md", "Old Azure note, reworded\n");
    git("-c", "user.email=t@example.invalid", "-c", "user.name=t", "commit", "-qam", "reword");

    const result = run({ root, base });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  it("still fails a new mention when an old one is deleted elsewhere in the file", () => {
    const { put, git } = fixture();
    put("docs/hosting.md", "Old Azure note\nkeep\nkeep\nkeep\nend\n");
    run({ root, write: true });
    git("-c", "user.email=t@example.invalid", "-c", "user.name=t", "commit", "-qam", "facts");
    const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    put("docs/hosting.md", "keep\nkeep\nkeep\nend\nDeploy to Azure Functions\n");
    git("-c", "user.email=t@example.invalid", "-c", "user.name=t", "commit", "-qam", "swap");

    expect(run({ root, base }).errors).toEqual([
      { file: "docs/hosting.md", line: 5, term: "azure", text: "Azure", isNew: true },
    ]);
  });

  it("fails a second mention added to a line that already named the term", () => {
    const { put, git } = fixture();
    run({ root, write: true });
    git("-c", "user.email=t@example.invalid", "-c", "user.name=t", "commit", "-qam", "facts");
    const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    put("docs/hosting.md", "Old Azure note, now also Azure Functions\n");
    git("-c", "user.email=t@example.invalid", "-c", "user.name=t", "commit", "-qam", "more");

    expect(run({ root, base }).errors).toHaveLength(2);
  });

  it("passes on this repository's current tree", () => {
    expect(run({}).errors).toEqual([]);
  });
});
