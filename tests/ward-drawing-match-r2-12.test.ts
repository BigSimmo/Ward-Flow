import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * R2-12 — pin Ward Operational Tabs to the perfected drawing order (ward-perfected ≡ ward-third).
 * Looking still owns visual fidelity; this stops the tab strip drifting without a drawing change.
 */
describe("Ward screen — perfected tab order (R2-12)", () => {
  it("keeps the five operational tabs in drawing order with drawing labels", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/ward-management/ward/ward-screen.tsx"), "utf8");
    const tabIds = [...source.matchAll(/id="tabBtn-([^"]+)"/g)].map((m) => m[1]);
    expect(tabIds).toEqual(["attn", "coming", "out", "beds", "return"]);

    const labels = [...source.matchAll(/id="tabBtn-[^"]+"[\s\S]*?<span>([^<]+)<\/span>/g)].map((m) =>
      m[1].replace(/&rsquo;/g, "\u2019").replace(/&amp;/g, "&"),
    );
    expect(labels).toEqual(["Home", "Arrivals", "Discharges", "Beds", "Decisions"]);
  });

  it("keeps Today’s return panel flex basis at 20rem", () => {
    const css = readFileSync(resolve(process.cwd(), "src/components/ward-management/ward/ward.module.css"), "utf8");
    expect(css).toMatch(/\.returnQuestionText\s*\{[^}]*flex:\s*1\s+1\s+20rem/s);
  });
});

describe("Handover screen — perfected tab order (R2-12)", () => {
  it("keeps the detail tabs in drawing order", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/ward-management/handover/handover-page.tsx"),
      "utf8",
    );
    const tabIds = [...source.matchAll(/id="tabBtn-([^"]+)"/g)].map((m) => m[1]);
    expect(tabIds).toEqual(["snapshot", "referrals", "inbound", "discharges", "breaches", "briefing", "rollup1630"]);
  });

  it("names the breaches tab without banned Statutory Breaches wording", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/ward-management/handover/handover-page.tsx"),
      "utf8",
    );
    expect(source).toContain("<span>Form expiries passed</span>");
    expect(source).not.toMatch(/<span>Statutory Breaches<\/span>/);
  });

  it("exposes the drawing filter toolbar landmark and Reset to Statewide", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/ward-management/handover/handover-page.tsx"),
      "utf8",
    );
    expect(source).toContain('aria-label="Handover Scope and Filters"');
    expect(source).toContain("Reset to Statewide");
    expect(source).toContain("Caseload in Scope");
    expect(source).toContain("Allocatable Vacancies");
    expect(source).toContain("1:1 Specialling Roster");
  });
});
