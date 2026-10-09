import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * R2-12 — pin Ward Operational Tabs to the perfected drawing order (ward-perfected ≡ ward-third).
 * Looking still owns visual fidelity; this stops the tab strip drifting without a drawing change.
 */
describe("Ward screen — perfected tab order (R2-12)", () => {
  // Ward Hub (Josh, 9 Oct 2026, approved Bed board mockup): Arrivals, Discharges and Beds moved
  // onto Home as the Ward flow panel and the bed board, so two tabs remain.
  it("keeps the two operational tabs in drawing order with drawing labels", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/ward-management/ward/ward-screen.tsx"), "utf8");
    const tabIds = [...source.matchAll(/id="tabBtn-([^"]+)"/g)].map((m) => m[1]);
    expect(tabIds).toEqual(["attn", "return"]);

    const labels = [...source.matchAll(/id="tabBtn-[^"]+"[\s\S]*?<span>([^<]+)<\/span>/g)].map((m) =>
      m[1].replace(/&rsquo;/g, "\u2019").replace(/&amp;/g, "&"),
    );
    expect(labels).toEqual(["Home", "Decisions"]);
  });

  it("keeps Today’s return panel flex basis at 20rem", () => {
    const css = readFileSync(resolve(process.cwd(), "src/components/ward-management/ward/ward.module.css"), "utf8");
    expect(css).toMatch(/\.returnQuestionText\s*\{[^}]*flex:\s*1\s+1\s+20rem/s);
  });
});

// Refined Handover A (Josh, 9 Oct 2026) replaced the seven drawing tabs with Patients, Beds and
// History over one grouped table, so the R2-12 handover tab pin no longer applies.
describe("Handover screen — refined tabs", () => {
  it("keeps Patients, Beds and History in that order", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/ward-management/handover/handover-page.tsx"),
      "utf8",
    );
    const tabIds = [...source.matchAll(/\{ id: "(pts|beds|hist)", label: "([^"]+)"/g)].map((m) => m[2]);
    expect(tabIds).toEqual(["Patients", "Beds", "History"]);
    expect(source).not.toMatch(/Statutory Breaches/);
  });
});
