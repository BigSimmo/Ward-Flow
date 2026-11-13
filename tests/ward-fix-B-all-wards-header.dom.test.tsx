import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { bedKindGaps, bedKindTotals } from "@/components/ward-management/capacity/capacity-derivations";
import { ClosedBedsPastReview } from "@/components/ward-management/capacity/capacity-closed-beds-review";
import { networkNamedHolds, totalReadyBedsNow } from "@/components/ward-management/ward-bed-states";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardIndex } from "@/components/ward-management/wards/ward-index";

/** Fix package B (A16-05): All wards' header reads the shared figures, so it agrees with the meeting sheet.
 *  Wave 4 (D-191, notes item 11): "ready by" went; Discharges · today and Short are the sheet's and Capacity's. */
const figure = (testId: string) => Number.parseInt(screen.getByTestId(testId).textContent ?? "", 10);

describe("All wards header (A16-05)", () => {
  it("shows the meeting sheet's Ready and Discharges · today, and Capacity's Short", () => {
    const seed = seedWardFlowState();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardIndex />
      </WardFlowProvider>,
    );
    const ready = totalReadyBedsNow(
      seed.units,
      seed.admissions,
      seed.bedReleases,
      networkNamedHolds(seed.movements, seed.referrals),
    );
    const sheet = bedMeetingSheet({
      ...seed,
      now: NOW_ANCHOR,
      thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
      service: null,
      nameOf: (movement) => movement.id,
      namedHolds: networkNamedHolds(seed.movements, seed.referrals),
    });
    expect(figure("ward-index-figure-ready")).toBe(ready);
    expect(figure("ward-index-figure-ready")).toBe(sheet.capacity.ready);
    // Still due later today and not held up: the sheet's own freeing-today count.
    expect(figure("ward-index-figure-discharges")).toBe(sheet.discharges.freeingToday);
    // The same selector as Capacity's hero, so the two pages never disagree.
    const gap = bedKindTotals(bedKindGaps(seed.movements, seed.units, NOW_ANCHOR, seed.admissions, seed.referrals)).gap;
    expect(figure("ward-index-figure-short")).toBe(Math.abs(gap));
    expect(screen.queryByText(/ready by/iu)).toBeNull();
  });
});

describe("Closed beds past review link (nightly accessibility, label in name)", () => {
  it("starts its accessible name with the visible words", () => {
    render(<ClosedBedsPastReview units={seedWardFlowState().units} now={NOW_ANCHOR} />);
    const links = within(screen.getByTestId("capacity-closed-beds-review")).getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveTextContent("Open ward");
      expect(link).toHaveAccessibleName(/^Open ward: .+, to review bed \d+$/u);
    }
  });
});
