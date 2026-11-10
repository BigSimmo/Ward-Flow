// M103 (master audit list, 10 Nov 2026): print fidelity.
//
// Each printed sheet shows when it was printed, "Page x of y", a second identifier beside a name
// (D-113), and never cuts a row across a page break. Existing tests already prove parts of this for
// some sheets (ward-handover-print-pagination, ward-handover-print-attribution, ward-bed-list-print,
// ward-additional-print-provenance, ward-downtime-pack-bed-units-and-page). This file adds:
//
// 1. Page x of y for every sheet: the margin counter lives on the shared `@page` rules in
//    ward-flow-print.css, which the root layout loads. No other `@page` rule may put its own content
//    in the bottom margin boxes and so drop the counter.
// 2. A per-sheet matrix of the other three properties, read from each sheet's own source and
//    stylesheet. It is a static lead, not a printed page: GAPS lists what is still missing, exactly,
//    so a new gap fails and a fixed one must come off the list.
//
// Reads files with `readFileSync`; run it by name.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import postcss from "postcss";
import { describe, expect, it } from "vitest";

const PRINT_CSS = "src/app/ward-flow-print.css";
const COUNTER = /"Page "\s*counter\(page\)\s*" of "\s*counter\(pages\)/;

const CSS_WITH_PAGE_RULES = [
  PRINT_CSS,
  "src/app/globals.css",
  "src/components/ward-management/discharges/discharges.module.css",
  "src/components/ward-management/reports/reports.module.css",
  "src/components/ward-management/capacity/bed-meeting-sheet.module.css",
];

describe("M103: every printed page says Page x of y", () => {
  it("is loaded on every page through the root layout", () => {
    expect(readFileSync("src/app/layout.tsx", "utf8")).toContain('import "./ward-flow-print.css";');
  });

  it("puts the counter on the default page and on the shared clinical output page", () => {
    const pages: Record<string, string> = {};
    postcss.parse(readFileSync(PRINT_CSS, "utf8")).walkAtRules("page", (rule) => {
      pages[rule.params || "(default)"] = rule.toString();
    });
    expect(pages["(default)"]).toMatch(COUNTER);
    expect(pages["shared-clinical-output"]).toMatch(COUNTER);
  });

  it.each(CSS_WITH_PAGE_RULES)("%s never overrides the bottom margin boxes without the counter", (file) => {
    postcss.parse(readFileSync(file, "utf8")).walkAtRules(/^(?:bottom|top)-/, (box) => {
      const content = box.nodes?.find((node) => node.type === "decl" && node.prop === "content");
      if (!content || content.type !== "decl") return;
      if (box.name === "bottom-right") expect(content.value, `${file} @${box.name}`).toMatch(COUNTER);
    });
  });
});

type Sheet = { name: string; file: string };

/** Every screen that calls the browser's print, plus the two print-only components. */
const SHEETS: readonly Sheet[] = [
  { name: "Call sheet", file: "coordinator/call-sheet.tsx" },
  { name: "Community referral letter", file: "community/community-screen-modals.tsx" },
  { name: "Ward daily sheet", file: "board/ward-daily-sheet.tsx" },
  { name: "Patient handover pack", file: "patients/patient-handover-pack-button.tsx" },
  { name: "Referral letter", file: "referrals/ward-referral-drawer-letter.tsx" },
  { name: "Bed meeting run", file: "bed-meeting/bed-meeting-run.tsx" },
  { name: "Handover print sheet", file: "handover/handover-print-sheet.tsx" },
  { name: "Discharge board", file: "discharges/discharge-board.tsx" },
  { name: "Downtime pack", file: "reports/downtime-pack-screen.tsx" },
  { name: "Patient chronology", file: "reports/patient-chronology-screen.tsx" },
  { name: "Weekly report", file: "reports/weekly-report-screen.tsx" },
  { name: "Capacity meeting sheet", file: "capacity/capacity-meeting-sheet-dialog.tsx" },
  { name: "Bed meeting sheet", file: "capacity/bed-meeting-sheet.tsx" },
  { name: "Triage sheet", file: "triage/triage-risk-sheets.tsx" },
  { name: "Ward bed list", file: "ward/ward-bed-list-print.tsx" },
];

const ROOT = "src/components/ward-management";

/** The sheet's file and the same-folder modules it imports, so a sheet built from parts is read whole. */
function sheetSources(file: string): { code: string; css: string } {
  const path = join(ROOT, file);
  const folder = dirname(path);
  const code = readFileSync(path, "utf8");
  const parts = [...code.matchAll(/from "\.\/([\w-]+)"/g)]
    .flatMap((match) => [`${match[1]}.tsx`, `${match[1]}.ts`].map((name) => join(folder, name)))
    .filter((candidate) => existsSync(candidate))
    .map((candidate) => readFileSync(candidate, "utf8"));
  const allCode = [code, ...parts].join("\n");
  const css = [...allCode.matchAll(/from "\.\/([\w-]+\.module\.css)"/g)]
    .map((match) => join(folder, match[1]!))
    .filter((candidate) => existsSync(candidate))
    .map((candidate) => readFileSync(candidate, "utf8"))
    .join("\n");
  return { code: allCode, css };
}

const PRINT_TIME = /asAtStamp|[Pp]rinted|printedAt|[Aa]s at\b|printTime|PrintStamp/;
const SECOND_ID = /umrn/i;
/** `break-inside: avoid` inside a print block of the sheet's own stylesheet. */
function keepsRowsWhole(css: string): boolean {
  let found = false;
  postcss.parse(css).walkAtRules("media", (rule) => {
    if (!/print/.test(rule.params)) return;
    rule.walkDecls(/^(?:break-inside|page-break-inside)$/, (decl) => {
      if (/avoid/.test(decl.value)) found = true;
    });
  });
  // A sheet module's top-level rule that only applies to the printed component counts too.
  postcss.parse(css).walkDecls(/^(?:break-inside|page-break-inside)$/, (decl) => {
    if (/avoid/.test(decl.value)) found = true;
  });
  return found;
}

type Property = "print time" | "second identifier" | "rows kept whole";

/**
 * Gaps the static read reports that the rendered pages prove are NOT gaps, with the reason. Each is
 * checked on the rendered page in ward-audit-m103-print-fidelity.dom.test.tsx (10 Nov 2026).
 */
const FALSE_LEADS: Readonly<Record<string, readonly Property[]>> = {
  // "Prepared 10:42" is on the page; the words are not in the static read's list of print words.
  "Call sheet": ["print time"],
  // The shift brief names nobody, so needs no second identifier.
  "Ward daily sheet": ["second identifier"],
  // "Draft 10:42 AWST" is on the letter.
  "Referral letter": ["print time"],
  // "As of Tue 10 Nov 2026, 10:42 AWST" is on the list.
  "Discharge board": ["print time"],
  // "Generated Tue 10 Nov 2026, 10:42 AWST" is on the page.
  "Patient chronology": ["print time"],
  // "Generated ... AWST" is on the page and the report names nobody.
  "Weekly report": ["print time", "second identifier"],
};

/**
 * What is still open after that (10 Nov 2026). "rows kept whole" is a page-break rule in CSS, which a
 * DOM render cannot prove, so those stay as leads for a person or a browser print test. The Capacity and
 * Bed meeting sheets are real gaps (names with no UMRN, shown by the rendered page). The Bed meeting run
 * summary has not been rendered. A real gap the static read cannot see (the call sheet prints no UMRN)
 * is pinned as a DEFECT in the DOM file. Exact: take a line off when it is fixed or confirmed not needed.
 */
const GAPS: Readonly<Record<string, readonly Property[]>> = {
  "Community referral letter": ["rows kept whole"],
  "Patient handover pack": ["rows kept whole"],
  "Referral letter": ["rows kept whole"],
  "Bed meeting run": ["print time", "second identifier", "rows kept whole"],
  "Handover print sheet": ["rows kept whole"],
  "Capacity meeting sheet": ["second identifier"],
  "Bed meeting sheet": ["second identifier"],
};

describe("M103: each printed sheet's time, second identifier and whole rows (static lead)", () => {
  const found = Object.fromEntries(
    SHEETS.map((sheet) => {
      const { code, css } = sheetSources(sheet.file);
      const missing: Property[] = [];
      if (!PRINT_TIME.test(code)) missing.push("print time");
      if (!SECOND_ID.test(code)) missing.push("second identifier");
      if (!keepsRowsWhole(css)) missing.push("rows kept whole");
      return [sheet.name, missing] as const;
    }),
  );

  it("reads every sheet it names", () => {
    for (const sheet of SHEETS) expect(existsSync(join(ROOT, sheet.file)), sheet.file).toBe(true);
    // Positive control: the handover sheet's UMRN and the bed list's print time are seen.
    expect(found["Handover print sheet"]).not.toContain("second identifier");
    expect(found["Ward bed list"]).toEqual([]);
  });

  it("lists only false leads the static read really reports", () => {
    for (const [name, properties] of Object.entries(FALSE_LEADS))
      for (const property of properties) expect(found[name], `${name}: ${property}`).toContain(property);
  });

  it("matches the recorded gaps exactly", () => {
    const actual = Object.fromEntries(
      Object.entries(found)
        .map(([name, missing]) => [name, missing.filter((property) => !FALSE_LEADS[name]?.includes(property))] as const)
        .filter(([, missing]) => missing.length > 0),
    );
    expect(actual, "a sheet lost or gained a print property: fix it, or update GAPS after checking").toEqual(GAPS);
  });
});
