import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * D-number integrity (D-121 item 5, 10 Nov 2026).
 *
 * docs/ward-flow/decisions.md is the one decision log. Each entry is a `## D-n.` heading, and the
 * "Status of every entry" table at the top has one row per entry. Parallel threads each take the
 * next number, so two can collide or leave a hole. This check fails when:
 * - headings are out of order or a number is used twice;
 * - a number is skipped, unless the log itself says that number is claimed or reserved by a PR
 *   (for example "D-120 is claimed by open PR #1583");
 * - the status table and the headings disagree.
 */
const decisionsPath = join(__dirname, "..", "docs/ward-flow/decisions.md");

function headingNumbers(markdown: string): number[] {
  return [...markdown.matchAll(/^## D-(\d+)\. /gmu)].map((match) => Number(match[1]));
}

function tableNumbers(markdown: string): number[] {
  return [...markdown.matchAll(/^\|\s*\[D-(\d+)\]\(#/gmu)].map((match) => Number(match[1]));
}

/** A skipped number is allowed only when the log says a PR has claimed or reserved it. */
function isClaimed(markdown: string, id: number): boolean {
  return new RegExp(`\\bD-${id}\\b[^.\\n]{0,40}?\\b(?:is|was|are)\\s+(?:claimed|reserved)\\b`, "u").test(markdown);
}

function numberingProblems(markdown: string): string[] {
  const problems: string[] = [];
  const headings = headingNumbers(markdown);
  const seen = new Set<number>();
  headings.forEach((id, index) => {
    if (seen.has(id)) problems.push(`D-${id} is used twice`);
    seen.add(id);
    const previous = headings[index - 1];
    if (previous === undefined) return;
    if (id <= previous) problems.push(`D-${id} comes after D-${previous}`);
    for (let gap = previous + 1; gap < id; gap += 1)
      if (!isClaimed(markdown, gap)) problems.push(`D-${gap} is missing and not marked as claimed by a PR`);
  });
  return problems;
}

describe("decision log numbering (D-121 item 5)", () => {
  const markdown = readFileSync(decisionsPath, "utf8");

  it("catches a repeat, a disorder and an unmarked gap, and accepts a claimed gap", () => {
    expect(numberingProblems("## D-1. a\n## D-2. b\n## D-2. c\n")).toEqual([
      "D-2 is used twice",
      "D-2 comes after D-2",
    ]);
    expect(numberingProblems("## D-1. a\n## D-3. b\n")).toEqual(["D-2 is missing and not marked as claimed by a PR"]);
    expect(numberingProblems("## D-1. a\nD-2 is claimed by open PR #9.\n## D-3. b\n")).toEqual([]);
    expect(numberingProblems("## D-1. a\nRecorded as D-3 because D-2 is reserved by PR #9.\n## D-3. b\n")).toEqual([]);
  });

  it("numbers every entry in order, once, with gaps only where a PR has claimed the number", () => {
    expect(headingNumbers(markdown).length).toBeGreaterThan(100);
    expect(numberingProblems(markdown)).toEqual([]);
  });

  it("has one status-table row per entry, in the same order", () => {
    expect(tableNumbers(markdown)).toEqual(headingNumbers(markdown));
  });
});
