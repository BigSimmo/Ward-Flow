import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * A live page must not cite a fully replaced decision as if it still applied (rules audit, D-107,
 * 9 Nov 2026). Before this check, pages kept citing D-29, D-36 and D-37 as current long after D-70
 * and D-87 replaced them, and agents followed the old rule.
 *
 * Source of truth: the "Status of every entry" table at the top of docs/ward-flow/decisions.md.
 * Only rows marked exactly "Replaced by D-n" count; "Partly replaced" entries still apply in part.
 * A citation is fine when the same line, or the next (prose wraps), says it is history (replaced, removed, withdrawn, once,
 * overruled, superseded, archive) or names the replacing decision, or is a range such as
 * "D-1 to D-81".
 */
const root = join(__dirname, "..");
const decisionsPath = join(root, "docs/ward-flow/decisions.md");

/** Generated indexes, the log itself, archives and dated review records quote old IDs on purpose. */
const SKIP = [
  "docs/history/",
  "docs/design/reviews/",
  "docs/ward-flow/decisions.md",
  "docs/ward-flow/OWNER-RULINGS.md",
  "docs/ward-flow/RULES.md",
];
const HISTORY_WORDS =
  /\b(replac\w*|removed|withdr[ae]wn?|once|overruled|supersed\w*|archive|retired|former(ly)?|old)\b/iu;

function fullyReplaced(markdown: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const line of markdown.split("\n")) {
    const row = line.match(/^\|\s*\[(D-\d+)\][^|]*\|[^|]*\|\s*([^|]*)\|/u);
    if (!row) continue;
    const status = row[2].trim();
    const whole = status.match(/^Replaced by ((?:D-\d+(?:,\s*)?)+)/u);
    if (whole) out.set(row[1], whole[1].split(/,\s*/u));
  }
  return out;
}

function staleCitations(text: string, replaced: Map<string, string[]>): string[] {
  const hits: string[] = [];
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    const context = `${line} ${lines[index + 1] ?? ""}`;
    if (HISTORY_WORDS.test(context)) return;
    const withoutRanges = line.replace(/\bD-\d+\s+to\s+D-\d+\b/gu, "");
    for (const [id, by] of replaced) {
      if (!new RegExp(`\\b${id}\\b(?!\\.\\d|-)`, "u").test(withoutRanges)) continue;
      if (by.some((newer) => new RegExp(`\\b${newer}\\b`, "u").test(context))) continue;
      hits.push(`${index + 1}: cites ${id} (replaced by ${by.join(", ")})`);
    }
  });
  return hits;
}

function liveDocs(): string[] {
  const files: string[] = [join(root, "AGENTS.md")];
  const walk = (directory: string) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      const rel = relative(root, path).split("\\").join("/");
      if (SKIP.some((skip) => rel === skip || rel.startsWith(skip))) continue;
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith(".md")) files.push(path);
    }
  };
  walk(join(root, "docs"));
  return files;
}

describe("live docs do not cite a replaced decision as current", () => {
  const replaced = fullyReplaced(readFileSync(decisionsPath, "utf8"));

  it("reads the replaced decisions from the status table", () => {
    expect(replaced.get("D-29")).toEqual(["D-70"]);
    expect(replaced.size).toBeGreaterThan(0);
  });

  it("flags a bare citation and allows a historical one", () => {
    const map = new Map([["D-29", ["D-70"]]]);
    expect(staleCitations("The Act period demo follows D-29.", map)).toHaveLength(1);
    expect(staleCitations("D-70 removed the D-29 demo.", map)).toHaveLength(0);
    expect(staleCitations("Rows D-1 to D-81 were checked.", new Map([["D-1", ["D-27"]]]))).toHaveLength(0);
  });

  it("finds no stale citation in a live page", () => {
    const problems = liveDocs().flatMap((file) =>
      staleCitations(readFileSync(file, "utf8"), replaced).map((hit) => `${relative(root, file)}:${hit}`),
    );
    expect(problems).toEqual([]);
  });
});
