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
import { ClosedBedsPastReview } from "@/components/ward-management/capacity/capacity-closed-beds-review";
import { networkNamedHolds, totalReadyBedsNow } from "@/components/ward-management/ward-bed-states";
import { shiftEndInstant } from "@/components/ward-management/ward-board-time-features";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { releasesExpectedToFree } from "@/components/ward-management/ward-shared-figures";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardIndex } from "@/components/ward-management/wards/ward-index";

/** Fix package B (A16-05): All wards' header reads the shared figures, so it agrees with the meeting sheet. */
const figure = (testId: string) => Number.parseInt(screen.getByTestId(testId).textContent ?? "", 10);

describe("All wards header (A16-05)", () => {
  it("adds only beds still to free by the shift's end to Ready, and its Ready is the meeting sheet's", () => {
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
    const freeing = releasesExpectedToFree(seed.bedReleases, NOW_ANCHOR, shiftEndInstant(NOW_ANCHOR)).length;
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
    expect(figure("ward-index-figure-ready-by")).toBe(ready + freeing);
    // The shift ends today, so "ready by" is never more than ready now plus the sheet's freeing today.
    expect(figure("ward-index-figure-ready-by")).toBeLessThanOrEqual(
      sheet.capacity.ready + sheet.discharges.freeingToday,
    );
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
