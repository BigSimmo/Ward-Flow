import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assess, LIVING_DOCS, readLastChecked, run } from "../scripts/check-living-docs-freshness.mjs";

describe("check-living-docs-freshness", () => {
  it("reads the last-checked marker", () => {
    expect(readLastChecked("# Title\n<!-- last-checked: 2026-10-24 -->\n")).toBe("2026-10-24");
    expect(readLastChecked("# Title\nUpdated 24 October 2026\n")).toBeNull();
  });

  it("classifies pages by age against the reference date", () => {
    expect(assess({ lastChecked: "2026-10-20", reference: "2026-10-24", days: 14 })).toEqual({
      status: "ok",
      ageDays: 4,
    });
    expect(assess({ lastChecked: "2026-10-01", reference: "2026-10-24", days: 14 })).toEqual({
      status: "stale",
      ageDays: 23,
    });
    expect(assess({ lastChecked: null, reference: "2026-10-24", days: 14 })).toEqual({
      status: "missing",
      ageDays: null,
    });
  });

  it("gives the status page its own 7-day limit", () => {
    const root = mkdtempSync(join(tmpdir(), "living-docs-"));
    mkdirSync(join(root, "docs/ward-flow"), { recursive: true });
    writeFileSync(join(root, "README.md"), "<!-- last-checked: 2026-10-24 -->\n");
    writeFileSync(join(root, "docs/ward-flow/STATUS.md"), "<!-- last-checked: 2026-10-24 -->\n");
    const report = run({ root, days: 14, reference: "2026-11-02" });
    const present = (problems: { status: string }[]) => problems.filter((p) => p.status !== "absent");
    expect(present(report.problems)).toEqual([
      expect.objectContaining({ path: "docs/ward-flow/STATUS.md", status: "stale", ageDays: 9, limit: 7 }),
    ]);
    expect(present(run({ root, days: 3, reference: "2026-10-28" }).problems)).toHaveLength(2);
  });

  it("checks listed pages and every page in a living folder", () => {
    const root = mkdtempSync(join(tmpdir(), "living-docs-"));
    mkdirSync(join(root, "docs/ward-flow/desk-guides"), { recursive: true });
    writeFileSync(join(root, "README.md"), "<!-- last-checked: 2026-10-24 -->\n");
    writeFileSync(join(root, "docs/ward-flow/desk-guides/ward.md"), "# Ward\n");
    const report = run({ root, days: 14, reference: "2026-10-24" });
    expect(report.results.map((r) => r.path)).toEqual([...LIVING_DOCS, "docs/ward-flow/desk-guides/ward.md"]);
    expect(report.problems.filter((p) => p.status !== "absent")).toEqual([
      expect.objectContaining({ path: "docs/ward-flow/desk-guides/ward.md", status: "missing" }),
    ]);
  });

  it("reports a listed page that is gone instead of dropping it (F-49)", () => {
    const root = mkdtempSync(join(tmpdir(), "living-docs-"));
    for (const path of LIVING_DOCS) {
      mkdirSync(join(root, path, ".."), { recursive: true });
      writeFileSync(join(root, path), "<!-- last-checked: 2026-10-24 -->\n");
    }
    expect(run({ root, days: 14, reference: "2026-10-24" }).problems).toEqual([]);
    const gone = LIVING_DOCS[LIVING_DOCS.length - 1];
    rmSync(join(root, gone));
    expect(run({ root, days: 14, reference: "2026-10-24" }).problems).toEqual([
      expect.objectContaining({ path: gone, status: "absent", detail: expect.stringContaining("file is gone") }),
    ]);
  });

  it("does not treat an invalid or future date as fresh (F-49)", () => {
    expect(assess({ lastChecked: "2026-02-30", reference: "2026-10-24", days: 14 })).toEqual({
      status: "invalid",
      ageDays: null,
    });
    expect(assess({ lastChecked: "2026-13-01", reference: "2026-10-24", days: 14 }).status).toBe("invalid");
    expect(assess({ lastChecked: "2027-10-24", reference: "2026-10-24", days: 14 }).status).toBe("invalid");
    expect(assess({ lastChecked: "2026-10-24", reference: "2026-10-24", days: 14 })).toEqual({
      status: "ok",
      ageDays: 0,
    });
  });
});
