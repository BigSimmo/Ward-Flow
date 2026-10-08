import { describe, expect, it } from "vitest";
import { coverageGaps, schemaTableGaps, trackedRootDirectoryNames } from "../scripts/check-codebase-index-coverage.mjs";

const index = `
## Ward repository layout

Roots: \`src/\`, \`docs/\`, \`.agents/\`.

## Ward route groups

Routes: \`/documents\`, \`/reference/colour-coding\`.

## Ward API routes

Routes: \`/api/answer\`.

## Ward library modules

Modules: \`observability/\`, \`validation/\`, \`extractors/document.ts\`.

## Historical provenance

### Schema tables

\`documents\`, \`document_chunks\`

### Migration themes
`;

describe("coverageGaps", () => {
  it("reports a module whose name is absent from the index", () => {
    const gaps = coverageGaps(index, [{ kind: "lib", dir: "src/lib", name: "ingestion" }]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].full).toBe("src/lib/ingestion");
  });

  it("treats section-scoped path code spans as covered", () => {
    const gaps = coverageGaps(index, [
      { kind: "lib", dir: "src/lib", name: "observability" },
      { kind: "lib", dir: "src/lib", name: "validation" },
      { kind: "route", dir: "src/app", name: "documents" },
      { kind: "route", dir: "src/app", name: "reference" },
      { kind: "lib", dir: "src/lib", name: "extractors" },
    ]);
    expect(gaps).toEqual([]);
  });

  it("does not count a bare name that appears only in prose", () => {
    const withProse = index.replace("## Ward library modules", "## Ward library modules\n\nIngestion is important.");
    const gaps = coverageGaps(withProse, [{ kind: "lib", dir: "src/lib", name: "ingestion" }]);
    expect(gaps.map((gap) => gap.full)).toEqual(["src/lib/ingestion"]);
  });

  it("does not let a product route satisfy an API route", () => {
    const withProductRoute = index.replace("`/documents`", "`/documents`, `/medications`");
    const gaps = coverageGaps(withProductRoute, [{ kind: "api", dir: "src/app/api", name: "medications" }]);
    expect(gaps.map((gap) => gap.full)).toEqual(["src/app/api/medications"]);
  });

  it("fails coverage when a maintained section boundary is missing or reversed", () => {
    const group = [{ kind: "root", dir: ".", name: "src" }];
    const missing = index.replace("## Ward route groups", "## Renamed route groups");
    const reversed = "## Ward route groups\n" + missing;
    for (const text of [missing, reversed]) {
      expect(coverageGaps(text, group).map((gap) => gap.full)).toEqual(["./src"]);
    }
  });

  it("honours the allowlist", () => {
    const gaps = coverageGaps(index, [{ kind: "route", dir: "src/app", name: "icons" }], new Set(["src/app/icons"]));
    expect(gaps).toEqual([]);
  });

  it("does not count historical-only paths or fall back to a historical section", () => {
    const history = [
      "<!-- docs-script-refs:historical-start -->",
      "## Ward library modules",
      "`src/lib/ingestion/`",
      "## Historical provenance",
      "<!-- docs-script-refs:historical-end -->",
    ].join("\n");
    const group = [{ kind: "lib", dir: "src/lib", name: "ingestion" }];
    expect(coverageGaps(index + history, group).map((gap) => gap.full)).toEqual(["src/lib/ingestion"]);
    expect(coverageGaps(history, group).map((gap) => gap.full)).toEqual(["src/lib/ingestion"]);
  });

  it("rejects malformed history instead of treating it as current coverage", () => {
    expect(() => coverageGaps(index + "<!-- docs-script-refs:historical-start -->", [])).toThrow(/Unclosed/);
  });

  it("checks tracked repository-root directories in the top-level layout section", () => {
    expect(
      coverageGaps(index, [
        { kind: "root", dir: ".", name: "src" },
        { kind: "root", dir: ".", name: ".agents" },
      ]),
    ).toEqual([]);
    expect(coverageGaps(index, [{ kind: "root", dir: ".", name: "plugins" }])).toEqual([
      { full: "./plugins", kind: "root", tried: ["plugins/"] },
    ]);
  });

  it("derives unique root directories from tracked paths only", () => {
    expect(
      trackedRootDirectoryNames([
        "src/app/page.tsx",
        "src/lib/env.ts",
        "docs/codebase-index.md",
        ".agents/skills/task/SKILL.md",
        "README.md",
      ]),
    ).toEqual([".agents", "docs", "src"]);
  });

  it("reports missing and stale schema-table entries", () => {
    const schema = `
      create table public.documents (id uuid primary key);
      create table if not exists public.rag_queries (id uuid primary key);
    `;
    expect(schemaTableGaps(index, schema)).toEqual({
      missing: ["rag_queries"],
      stale: ["document_chunks"],
    });
  });
});
