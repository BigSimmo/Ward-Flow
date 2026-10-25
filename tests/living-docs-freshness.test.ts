import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assess, readLastChecked, run } from "../scripts/check-living-docs-freshness.mjs";

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

  it("checks listed pages and every page in a living folder", () => {
    const root = mkdtempSync(join(tmpdir(), "living-docs-"));
    mkdirSync(join(root, "docs/ward-flow/desk-guides"), { recursive: true });
    writeFileSync(join(root, "README.md"), "<!-- last-checked: 2026-10-24 -->\n");
    writeFileSync(join(root, "docs/ward-flow/desk-guides/ward.md"), "# Ward\n");
    const report = run({ root, days: 14, reference: "2026-10-24" });
    expect(report.results.map((r) => r.path)).toEqual(["README.md", "docs/ward-flow/desk-guides/ward.md"]);
    expect(report.problems).toEqual([
      expect.objectContaining({ path: "docs/ward-flow/desk-guides/ward.md", status: "missing" }),
    ]);
  });
});
