import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
// The pre-commit hook's staged-file typecheck compiles only this file (plus .d.ts roots), so it
// never sees tests/setup/jsdom.setup.ts's global jest-dom matcher augmentation.
import "@testing-library/jest-dom/vitest";

import { WardIndex } from "@/components/ward-management/wards/ward-index";
import { designationSummary, wardCategory } from "@/components/ward-management/ward-bed-designation";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Live walkthrough, 25 September 2026: All wards called the SCGH Mental Health Unit "Locked Adult
 * HDU" and RPH Older Adult "Locked Psychogeriatric" from a hand-typed table, while Command (and
 * the data) said "All open". The badge is now read from the bed counts with the same
 * `designationSummary` Command uses, so the two screens say the same thing.
 *
 * v6 (7 Oct 2026, approved Wards mockup): the card shows the owner's three categories (Open,
 * Locked, Mixed) from `wardCategory`, read from the same bed counts, with the full
 * `designationSummary` sentence as its tip.
 */
describe("All wards: each ward's lock badge matches its bed counts", () => {
  it("shows designationSummary for every non-forensic ward, and no hand-typed 'HDU' label", () => {
    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardIndex />
      </WardFlowProvider>,
    );
    const badges = [...container.querySelectorAll("[class*=acuityBadge]")].map((el) => el.textContent?.trim());
    expect(badges.length).toBeGreaterThan(0);
    expect(badges.join(" | ")).not.toMatch(/HDU|Psychogeriatric|Acuity Acute|Inpatient Care/);

    const units = seedWardFlowState().units;
    const scgh = units.find((unit) => unit.id === "scgh-adult-open")!;
    const rphOlder = units.find((unit) => unit.id === "rph-older-adult")!;
    const fshSecure = units.find((unit) => unit.id === "fsh-adult-secure")!;
    expect(designationSummary(scgh)).toBe("All open");
    expect(designationSummary(rphOlder)).toBe("All open");
    const tips = [...container.querySelectorAll("[class*=acuityBadge]")].map((el) => el.getAttribute("title"));
    for (const unit of units.filter((candidate) => !candidate.forensic)) {
      expect(badges, `${unit.id} badge`).toContain(wardCategory(unit));
      expect(tips, `${unit.id} badge tip`).toContain(designationSummary(unit));
    }
    expect(tips).toContain(designationSummary(fshSecure));
  });
});
