// Audit M124: every print, CSV, clipboard copy, TV view, weekly report, bed meeting summary and
// Report-a-problem output carries the synthetic, not-for-clinical-decisions marker. This file adds
// direct checks for the download channels and a register of the existing per-output marker tests,
// so a new download without the marker, or a lost marker test, fails here. The word read-through
// ("cleared", "safe to", "should") is a person's job; the reviewed hits are listed at the end.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { SYNTHETIC_COPY_LINE, copiedText } from "@/components/ward-management/ward-clipboard";

const ROOT = path.resolve(__dirname, "..");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry)) out.push(full);
  }
  return out;
}
const PICTURE_SOURCE = readFileSync(
  path.join(ROOT, "src/components/ward-management/help/ward-help-report-picture.ts"),
  "utf8",
);
const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join("/");

/** The text of each call to `name(` in a file, up to its matching close bracket. */
function calls(text: string, name: string): string[] {
  const found: string[] = [];
  const pattern = new RegExp(`(?<![\\w.])${name}\\(`, "g");
  for (const match of text.matchAll(pattern)) {
    let depth = 0;
    let end = match.index!;
    for (let i = match.index! + name.length; i < text.length; i++) {
      if (text[i] === "(") depth++;
      else if (text[i] === ")" && --depth === 0) {
        end = i;
        break;
      }
    }
    const call = text.slice(match.index!, end + 1);
    if (!/^\w+\([^)]*\)\s*\{/.test(text.slice(match.index!, end + 3))) found.push(call); // skip declarations
  }
  return found;
}

const SOURCES = sourceFiles(path.join(ROOT, "src"));

describe("M124 downloads carry the marker", () => {
  it("every CSV download passes its provenance block, which opens with the synthetic line", () => {
    const csv = readFileSync(path.join(ROOT, "src/components/ward-management/statistics/statistics-csv.ts"), "utf8");
    expect(csv).toContain('["Data", "Synthetic, not clinical records"]');
    const missing: string[] = [];
    let seen = 0;
    for (const file of SOURCES) {
      const text = readFileSync(file, "utf8");
      if (!text.includes("downloadCsv(")) continue;
      for (const call of calls(text, "downloadCsv")) {
        if (call.startsWith("downloadCsv()")) continue; // a local handler named downloadCsv
        if (/^downloadCsv\(\s*filename: string/.test(call)) continue; // the helper's own declaration
        seen++;
        const marked =
          /provenance\s*\)?$|\{\s*asAt|asAt[,\s]|statisticsExportLines|Synthetic, not clinical records/.test(
            call.replace(/\s+/g, " "),
          );
        if (!marked) missing.push(`${rel(file)}: ${call.slice(0, 80)}`);
      }
    }
    expect(seen).toBeGreaterThan(10);
    expect(missing).toEqual([]);
  });

  it("every downloaded file is named synthetic, apart from the reviewed few", () => {
    const reviewed = new Map([
      [
        "src/components/ward-management/settings/settings-screen.tsx",
        "the saved rules file: settings only, no records",
      ],
      ["src/components/ward-management/tools/ward-demo-panel.tsx", "scenario file: its JSON carries the notice"],
      ["src/components/ward-redesign/pop-demo/demo-panel.tsx", "scenario file: its JSON carries the notice"],
      // The CSV helper itself: its callers name every file (checked above).
      ["src/components/ward-management/statistics/statistics-csv.ts", "the CSV helper"],
    ]);
    const unmarked: string[] = [];
    for (const file of SOURCES) {
      const text = readFileSync(file, "utf8");
      for (const call of calls(text, "downloadBlob")) {
        if (/^downloadBlob\(blob: Blob/.test(call)) continue;
        if (/ward-flow-synthetic-/.test(call)) continue;
        // The Report-a-problem picture's name is a constant, itself named synthetic (checked below).
        if (/\bPICTURE_FILENAME\b/.test(call) && /PICTURE_FILENAME = "ward-flow-synthetic-/.test(PICTURE_SOURCE))
          continue;
        if (!reviewed.has(rel(file))) unmarked.push(`${rel(file)}: ${call.slice(0, 80)}`);
      }
    }
    expect(unmarked).toEqual([]);
  });

  it("the scenario file carries its own synthetic notice", () => {
    const builder = readFileSync(path.join(ROOT, "src/components/ward-management/ward-flow-scenario-file.ts"), "utf8");
    expect(builder).toContain('notice: "Synthetic demonstration data only. Not a clinical record."');
  });
});

describe("M124 clipboard copies carry the marker", () => {
  it("puts the synthetic line first on any copied text", () => {
    expect(copiedText("Bed 4, Ward 3B").split("\n")[0]).toBe(SYNTHETIC_COPY_LINE);
    expect(SYNTHETIC_COPY_LINE).toMatch(/Synthetic prototype/);
  });
});

describe("M124 each other outbound item keeps its marker test", () => {
  const register: Array<{ item: string; file: string; mustContain: RegExp }> = [
    {
      item: "clipboard: no direct write outside the helper",
      file: "tests/ward-copied-text.test.ts",
      mustContain: /has no direct clipboard write outside the helper/,
    },
    {
      item: "print: shift brief and catchment counts",
      file: "tests/ward-additional-print-provenance.dom.test.tsx",
      mustContain: /synthetic figures/,
    },
    {
      item: "print: handover sheet",
      file: "tests/ward-handover-print-attribution.dom.test.tsx",
      mustContain: /Synthetic data\./,
    },
    {
      item: "TV view",
      file: "tests/ward-bed-meeting-tv.dom.test.tsx",
      mustContain: /toHaveTextContent\("Synthetic prototype"\)/,
    },
    {
      item: "bed meeting summary and its copy",
      file: "tests/ward-bed-meeting-sheet.dom.test.tsx",
      mustContain: /Synthetic prototype/,
    },
    {
      item: "weekly report",
      file: "tests/ward-weekly-executive-aggregate.dom.test.tsx",
      mustContain: /synthetic demo data/,
    },
    {
      item: "Report-a-problem text",
      file: "tests/ward-help-report.dom.test.tsx",
      mustContain: /toBe\("Synthetic prototype\."\)/,
    },
    {
      item: "every routed screen, shown on screen",
      file: "tests/ward-prototype-disclosure.test.ts",
      mustContain: /synthetic-data disclosure on every routed screen/,
    },
  ];
  it.each(register)("$item", ({ file, mustContain }) => {
    const full = path.join(ROOT, file);
    expect(existsSync(full), file).toBe(true);
    expect(readFileSync(full, "utf8")).toMatch(mustContain);
  });

  // Fixed 10 Nov 2026 (D-129): the picture is drawn with "Synthetic prototype" and named synthetic.
  it("Report-a-problem picture carries the synthetic marker in its pixels and its name", () => {
    const pictureTest = readFileSync(path.join(ROOT, "tests/ward-help-report-picture.test.ts"), "utf8");
    expect(pictureTest).toMatch(/fillText\)\.toHaveBeenCalledWith\("Synthetic prototype"/);
    const picture = readFileSync(
      path.join(ROOT, "src/components/ward-management/help/ward-help-report-picture.ts"),
      "utf8",
    );
    expect(picture).toMatch(/PICTURE_FILENAME = "ward-flow-synthetic-/);
  });
});

describe("M124 word read-through on outbound builders (Manual, reviewed hits only)", () => {
  // A new "cleared", "safe to", "should", "approved", "endorsed" or "recommended" in a quoted
  // string in these files fails until a person reads it and adds it here with a reason.
  const files = [
    "src/components/ward-management/statistics/statistics-csv.ts",
    "src/components/ward-management/ed/ed-export.ts",
    "src/components/ward-management/discharges/discharge-export.ts",
    "src/components/ward-management/referrals/referral-export.ts",
    "src/components/ward-management/search/census-export.ts",
    "src/components/ward-management/delays/delays-export.ts",
    "src/components/ward-management/legal-forms/legal-forms-export.ts",
    "src/components/ward-management/movements/movements-export.ts",
    "src/components/ward-management/reports/patient-chronology.ts",
    "src/components/ward-management/reports/weekly-report.ts",
    "src/components/ward-management/ward-clipboard.ts",
    "src/components/ward-management/help/ward-help-report.ts",
    "src/components/ward-management/bed-meeting/bed-meeting-tv.tsx",
    "src/components/ward-management/bed-meeting/tv-clinical-views.tsx",
    "src/components/ward-management/bed-meeting/tv-function-views.tsx",
    "src/components/ward-management/handover/handover-print-sheet.tsx",
    "src/components/ward-management/board/ward-daily-sheet.tsx",
  ];
  const reviewed = new Set([
    // A recorded urgent flag being removed: says what a person did, not an endorsement.
    'src/components/ward-management/reports/patient-chronology.ts: "Urgent mark cleared"',
    // The medical clearance a person recorded, quoted back.
    'src/components/ward-management/reports/patient-chronology.ts: "Cleared"',
    'src/components/ward-management/reports/patient-chronology.ts: "Not cleared"',
  ]);
  it("finds no unreviewed endorsing word", () => {
    const hits = new Set<string>();
    for (const file of files) {
      const text = readFileSync(path.join(ROOT, file), "utf8");
      for (const match of text.matchAll(
        /"[^"\n]*\b(?:cleared|safe to|should|approved|endorsed|recommended)\b[^"\n]*"/gi,
      ))
        hits.add(`${file}: ${match[0]}`);
    }
    expect([...hits].filter((hit) => !reviewed.has(hit))).toEqual([]);
  });
});
