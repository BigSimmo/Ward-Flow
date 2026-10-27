import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { BedsReady, bedsReadySummary } from "@/components/ward-management/referrals/referral-board-parts";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * P028 (audit 27 Oct 2026): the beds-ready eyebrow says the figure is netted against the desk's own
 * admissions, so a role-scoped desk does not read it as the raw statewide count.
 */
describe("beds ready eyebrow names the desk's admissions", () => {
  it("reads 'Beds ready statewide (your desk's admissions): N' with the summary total", () => {
    const seed = seedWardFlowState();
    const summary = bedsReadySummary(seed.units, seed.admissions, seed.bedReleases, NOW_ANCHOR);
    render(<BedsReady summary={summary} />);
    expect(screen.getByText(`Beds ready statewide (your desk's admissions): ${summary.total}`)).toBeInTheDocument();
    expect(screen.queryByText(`Beds ready statewide: ${summary.total}`)).toBeNull();
  });
});
