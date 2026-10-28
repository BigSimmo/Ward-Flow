import { describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  cheatSheetHtml,
  cheatSheetMarkdown,
  guideList,
  guideSection,
  readDraftCheatSheets,
  writeDraftCheatSheets,
} from "../scripts/build-help-cheat-sheets.mjs";

describe("docs-side preparation of printable Help guides", () => {
  it("keeps wrapped instructions intact without absorbing the following section", () => {
    const source =
      "## Jobs\n\n1. Press **Open**\n   then choose the ward.\n2. Read the result.\n\n## Limits\n\n- Do not record here.";
    expect(guideList(guideSection(source, "Jobs"))).toEqual(["Press Open then choose the ward.", "Read the result."]);
  });

  it("prepares nine deterministic guides, including the agreed Bed manager name", () => {
    const sheets = readDraftCheatSheets();
    expect(sheets).toHaveLength(9);
    expect(sheets.find((sheet) => sheet.id === "bed_manager")?.title).toBe("Bed manager");
    expect(new Set(sheets.map((sheet) => sheet.id)).size).toBe(9);
    for (const sheet of sheets) {
      expect(sheet.jobs.length).toBeGreaterThan(0);
      expect(sheet.jobs.length).toBeLessThanOrEqual(3);
      expect(sheet.limits.length).toBeGreaterThan(0);
      expect(sheet.homeName.length).toBeGreaterThan(0);
      expect(sheet.legend).toHaveLength(6);
      expect(sheet.shortcuts).toHaveLength(8);
      expect(cheatSheetMarkdown(sheet)).toContain(sheet.homeName);
    }
  });

  it("regenerates all Markdown and print documents without changing any output", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "ward-help-print-test-"));
    try {
      expect(writeDraftCheatSheets(directory)).toBe(9);
      const names = readdirSync(directory).sort();
      expect(names).toHaveLength(19);
      const before = names.map((name) => readFileSync(path.join(directory, name), "utf8"));
      writeDraftCheatSheets(directory);
      expect(readdirSync(directory).sort()).toEqual(names);
      expect(names.map((name) => readFileSync(path.join(directory, name), "utf8"))).toEqual(before);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("preserves existing documents and edits to previously generated drafts", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "ward-help-print-preserve-"));
    try {
      writeFileSync(path.join(directory, "ward.md"), "An existing guide");
      expect(() => writeDraftCheatSheets(directory)).toThrow(/not owned/);
      expect(readFileSync(path.join(directory, "ward.md"), "utf8")).toBe("An existing guide");
      const generated = path.join(directory, "generated");
      writeDraftCheatSheets(generated);
      writeFileSync(path.join(generated, "ward.md"), "A human correction");
      expect(() => writeDraftCheatSheets(generated)).toThrow(/Preserving/);
      expect(readFileSync(path.join(generated, "ward.md"), "utf8")).toBe("A human correction");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("escapes printable content and loads no remote resources or scripts", () => {
    const sheet = readDraftCheatSheets()[0];
    const html = cheatSheetHtml({ ...sheet, title: '<script>alert("fixture")</script>' });
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toMatch(/<script|https?:|<iframe|<img/iu);
    expect(html).toContain("@page{size:A4");
  });
});
