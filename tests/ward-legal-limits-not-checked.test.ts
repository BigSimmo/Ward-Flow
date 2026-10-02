import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import { LEGAL_LIMITS_NOT_CHECKED_NOTICE } from "@/components/ward-management/ward-legal-clock";

// Owner decision 2026-09-25: every screen that shows a Mental Health Act time limit says the limits
// are typed in and not legally checked, until the WA legal review has happened.
describe("screens showing statutory time limits carry the not-legally-checked notice", () => {
  it("the notice says plainly that the limits are unchecked and not to be relied on", () => {
    expect(LEGAL_LIMITS_NOT_CHECKED_NOTICE).toMatch(/^Not legally checked/);
    expect(LEGAL_LIMITS_NOT_CHECKED_NOTICE).toContain("Do not rely on them");
  });

  it("the shared full notice renders the exact warning, test marker and note semantics", () => {
    const html = renderToStaticMarkup(createElement(LegalLimitsNotChecked, { variant: "full" }));
    expect(html).toContain(LEGAL_LIMITS_NOT_CHECKED_NOTICE);
    expect(html).toContain('data-testid="legal-limits-not-checked"');
    expect(html).toContain('role="note"');
  });

  it.each([
    "src/components/ward-management/legal-forms/legal-forms-screen.tsx",
    "src/components/ward-management/tools/ward-mha-calculator.tsx",
  ])("%s renders the notice", (path) => {
    const source = readFileSync(path, "utf8");
    const directNotice =
      /\{LEGAL_LIMITS_NOT_CHECKED_NOTICE\}/.test(source) && source.includes('data-testid="legal-limits-not-checked"');
    const sharedFullNotice = /<LegalLimitsNotChecked(?: variant="full")? \/>/.test(source);
    expect(directNotice || sharedFullNotice, `${path} must render the full legal warning`).toBe(true);
  });

  // Every other screen or panel that reads a legal deadline (legalForm.dueAt) or a breach built on one.
  it.each([
    "alerts/alerts-screen.tsx",
    "community/community-screen.tsx",
    "coordinator/pressure-strip.tsx",
    "coordinator/priority-queue.tsx",
    "coordinator/shortlist-panel.tsx",
    "delays/delays-screen.tsx",
    "ed/ed-screen.tsx",
    "handover/handover-page.tsx",
    "movements/movements-screen.tsx",
    "patients/patient-now-screen.tsx",
    "search/patient-search.tsx",
    "statistics/statistics-ed-screen.tsx",
    "movements/movement-workspace-cockpit.tsx",
    "ward-standing-strip.tsx",
    "ward/ward-screen.tsx",
  ])("src/components/ward-management/%s renders the shared label", (path) => {
    const source = readFileSync(`src/components/ward-management/${path}`, "utf8");
    expect(source).toMatch(/<LegalLimitsNotChecked( variant="tag")? \/>/);
  });

  it("no ward screen reads a legal deadline without carrying the label", () => {
    const root = "src/components/ward-management";
    const offenders = readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".tsx"))
      .filter((file) => {
        const source = readFileSync(join(root, file), "utf8");
        const readsDeadline = /legalForm(\?|!)?\.dueAt|isLegalDeadlineBreached/.test(source);
        const labelled = /<LegalLimitsNotChecked|LEGAL_LIMITS_NOT_CHECKED_NOTICE/.test(source);
        return readsDeadline && !labelled;
      });
    expect(offenders).toEqual([]);
  });
});
