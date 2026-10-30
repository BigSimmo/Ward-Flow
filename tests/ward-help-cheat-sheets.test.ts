import { describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  cheatSheetHtml,
  cheatSheetMarkdown,
  readCheatSheets,
  writeCheatSheets,
} from "../scripts/build-help-cheat-sheets.mjs";
import { printHelpGuides } from "@/components/ward-management/help-content/ward-help-print";
import { DESK_GUIDES } from "@/components/ward-management/help/ward-help-guide";

const sheets = printHelpGuides();
describe("printable Help guides from the app's content", () => {
  it("keeps every printed job and limit tied to the in-app desk guide", () => {
    for (const sheet of sheets) {
      if (sheet.id === "tv") continue;
      const source = DESK_GUIDES[sheet.id];
      expect(sheet.jobs).toEqual(source.jobs.slice(0, 3).map((job) => `${job.job}. ${job.how}`));
      expect(sheet.limits).toEqual(source.limits);
      expect(sheet.homeName).toBe(source.homeName);
    }
  });
  it("prepares nine guides including Bed manager and omits unavailable referral shortcuts", async () => {
    expect(sheets).toHaveLength(9);
    expect(await readCheatSheets()).toEqual(sheets);
    expect(sheets.find((sheet) => sheet.id === "bed_manager")?.title).toBe("Bed manager");
    expect(new Set(sheets.map((sheet) => sheet.id)).size).toBe(9);
    for (const sheet of sheets) {
      expect(sheet.jobs.length).toBeGreaterThan(0);
      expect(sheet.jobs.length).toBeLessThanOrEqual(3);
      expect(sheet.limits.length).toBeGreaterThan(0);
      expect(sheet.legend).toHaveLength(6);
      expect(cheatSheetMarkdown(sheet)).toContain(sheet.homeName);
    }
    for (const id of ["executive", "admin", "tv"])
      expect(sheets.find((sheet) => sheet.id === id)?.shortcuts.join()).not.toContain("Shift+R");
  });
  it("regenerates every committed printable document without a diff", async () => {
    expect(await writeCheatSheets(path.resolve("public/help"), sheets, true)).toBe(9);
  });
  it("regenerates all Markdown and print documents identically", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "ward-help-print-test-"));
    try {
      expect(await writeCheatSheets(directory, sheets)).toBe(9);
      const names = readdirSync(directory).sort();
      expect(names).toHaveLength(19);
      const before = names.map((name) => readFileSync(path.join(directory, name), "utf8"));
      await writeCheatSheets(directory, sheets);
      expect(names.map((name) => readFileSync(path.join(directory, name), "utf8"))).toEqual(before);
    } finally {
      rmSync(directory, { recursive: true, force: true, maxRetries: 5 });
    }
  });
  it("preserves existing documents and human edits", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "ward-help-print-preserve-"));
    try {
      writeFileSync(path.join(directory, "ward.md"), "An existing guide");
      await expect(writeCheatSheets(directory, sheets)).rejects.toThrow(/not owned/);
      expect(readFileSync(path.join(directory, "ward.md"), "utf8")).toBe("An existing guide");
      const generated = path.join(directory, "generated");
      await writeCheatSheets(generated, sheets);
      writeFileSync(path.join(generated, "ward.md"), "A human correction");
      await expect(writeCheatSheets(generated, sheets)).rejects.toThrow(/Preserving/);
      expect(readFileSync(path.join(generated, "ward.md"), "utf8")).toBe("A human correction");
    } finally {
      rmSync(directory, { recursive: true, force: true, maxRetries: 5 });
    }
  });
  it("escapes content and needs no scripts or remote resources to read or print", () => {
    const html = cheatSheetHtml({ ...sheets[0], title: '<script>alert("fixture")</script>' });
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toMatch(/<script|https?:|<iframe|<img/iu);
    expect(html).toContain("@page{size:A4");
  });
});
