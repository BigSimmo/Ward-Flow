import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Policy files exist (D-121 item 5, 10 Nov 2026).
 *
 * AGENTS.md and the topic files in docs/agents/ send every agent to other governing pages: "read
 * the named file before that action". If one of those pages is moved or deleted, the rule quietly
 * stops applying. This check reads every Markdown link and every backtick-quoted `.md` path in
 * those files and fails when the file it names is missing. Anchors are ignored here; the docs
 * link checker owns them.
 */
const root = join(__dirname, "..");

function policyFiles(): string[] {
  const agents = join(root, "docs", "agents");
  return [
    join(root, "AGENTS.md"),
    ...readdirSync(agents)
      .filter((name) => name.endsWith(".md"))
      .map((name) => join(agents, name)),
  ];
}

/** Repository paths a policy file names: Markdown link targets (relative to the file) and backtick paths. */
function namedPaths(file: string, text: string): string[] {
  const out = new Set<string>();
  const prose = text.replace(/```[\s\S]*?```/gu, "");
  for (const match of prose.matchAll(/\]\(([^)\s]+)\)/gu)) {
    const target = match[1].split("#")[0];
    if (!target || /^[a-z][a-z0-9+.-]*:/iu.test(target)) continue;
    out.add(
      relative(root, resolve(dirname(file), decodeURI(target)))
        .split("\\")
        .join("/"),
    );
  }
  for (const match of prose.matchAll(/`((?:docs|scripts|tests|\.github)\/[^`\s*<>]+\.md)(?:#[^`]*)?`/gu))
    out.add(match[1]);
  return [...out];
}

describe("policy files exist (D-121 item 5)", () => {
  it("reads link targets and quoted paths, without anchors or web links", () => {
    const file = join(root, "docs", "agents", "example.md");
    expect(
      namedPaths(file, "[a](../ward-flow/HOW-WE-WORK.md#2-x) [b](https://example.com) `docs/DOCS-SYSTEM.md#where`"),
    ).toEqual(["docs/ward-flow/HOW-WE-WORK.md", "docs/DOCS-SYSTEM.md"]);
  });

  it("names only files that exist, from AGENTS.md and docs/agents", () => {
    const files = policyFiles();
    expect(files.length).toBeGreaterThan(5);
    const named = files.map((file) => ({ file, paths: namedPaths(file, readFileSync(file, "utf8")) }));
    expect(named.flatMap(({ paths }) => paths).length, "the scan found too few paths to trust").toBeGreaterThan(30);
    const missing = named.flatMap(({ file, paths }) =>
      paths
        .filter((path) => !existsSync(join(root, path)))
        .map((path) => `${relative(root, file).split("\\").join("/")} names ${path}`),
    );
    expect(missing).toEqual([]);
  });
});
