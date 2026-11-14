import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { FIGURE_WINDOWS } from "@/components/ward-management/figures/figure-windows";

/**
 * The "Windows" table in docs/ward-flow/statistics-definitions.md is built from `FIGURE_WINDOWS`
 * (R-FIGS-14, owner ruling item 12; figures spec 3.5, D-220), so the doc and the code cannot say
 * different things about where a window starts. Reads a doc, not app source.
 *
 * Do not edit the table by hand. Rewrite it with:
 * UPDATE_FIGURE_WINDOWS_DOC=1 node scripts/run-vitest.mjs run tests/figure-windows-doc.test.ts
 */

const DOC_PATH = path.join(import.meta.dirname, "..", "docs", "ward-flow", "statistics-definitions.md");
const DOC_START = "<!-- figure-windows:start -->";
const DOC_END = "<!-- figure-windows:end -->";

function figureWindowsMarkdownTable(): string {
  const cell = (text: string) => text.replaceAll("\\", "\\\\").replaceAll("|", "\\|");
  const rows = FIGURE_WINDOWS.map(
    (window) =>
      "| " +
      [window.name, window.start, window.end, window.usedBy, window.source, "`" + window.id + "`"]
        .map(cell)
        .join(" | ") +
      " |",
  );
  return [
    "| Window | Starts | Ends | Used by | Edges set by | Id |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

describe("docs/ward-flow/statistics-definitions.md Windows table", () => {
  it("is the table built from FIGURE_WINDOWS", () => {
    const doc = readFileSync(DOC_PATH, "utf8");
    const start = doc.indexOf(DOC_START);
    const end = doc.indexOf(DOC_END);
    expect(start, "the doc lost its start marker").toBeGreaterThan(-1);
    expect(end, "the doc lost its end marker").toBeGreaterThan(start);
    const expected = `${DOC_START}\n\n${figureWindowsMarkdownTable()}\n\n${DOC_END}`;
    const actual = doc.slice(start, end + DOC_END.length);
    if (process.env.UPDATE_FIGURE_WINDOWS_DOC === "1" && actual !== expected) {
      writeFileSync(DOC_PATH, doc.slice(0, start) + expected + doc.slice(end + DOC_END.length));
      return;
    }
    expect(actual, "Run this test with UPDATE_FIGURE_WINDOWS_DOC=1 to rewrite the table.").toBe(expected);
  });
});
