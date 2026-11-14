// F-111 (A14-07): every printed page of the bed meeting sheet says "Page N of M".
//
// The count is CSS paged media: the default `@page` rule in src/app/ward-flow-print.css (loaded by
// the root layout) puts "Page " counter(page) " of " counter(pages) in the bottom-right margin box.
// The sheet prints on that default page, so it carries the count as long as its own stylesheet
// (a) keeps its `@page` rule unnamed, (b) never moves the sheet onto a named page, and (c) never
// replaces the bottom-right margin box. This file pins those three for the sheet.
//
// Reads files with `readFileSync`; run it by name.

import { readFileSync } from "node:fs";

import postcss from "postcss";
import { describe, expect, it } from "vitest";

const COUNTER = /"Page "\s*counter\(page\)\s*" of "\s*counter\(pages\)/;
const PRINT_CSS = "src/app/ward-flow-print.css";
const SHEET_CSS = "src/components/ward-management/capacity/bed-meeting-sheet.module.css";

describe("F-111: the printed bed meeting sheet says Page N of M", () => {
  it("has the counter on the default printed page", () => {
    let defaultPage = "";
    postcss.parse(readFileSync(PRINT_CSS, "utf8")).walkAtRules("page", (rule) => {
      if (!rule.params) defaultPage += rule.toString();
    });
    expect(defaultPage).toMatch(COUNTER);
    expect(readFileSync("src/app/layout.tsx", "utf8")).toContain('import "./ward-flow-print.css";');
  });

  it("prints the sheet on that default page, with its margin boxes left in place", () => {
    const sheet = postcss.parse(readFileSync(SHEET_CSS, "utf8"));
    const pageRules: string[] = [];
    sheet.walkAtRules("page", (rule) => {
      pageRules.push(rule.params);
    });
    expect(pageRules.length, "the sheet sets no printed page at all").toBeGreaterThan(0);
    expect(
      pageRules.every((name) => name === ""),
      "the sheet's @page is a named page without the counter",
    ).toBe(true);
    sheet.walkDecls("page", (decl) => {
      throw new Error(`the sheet moves onto the named page "${decl.value}", which drops the page count`);
    });
    sheet.walkAtRules(/^bottom-/, (box) => {
      throw new Error(`the sheet replaces the @${box.name} margin box`);
    });
  });
});
