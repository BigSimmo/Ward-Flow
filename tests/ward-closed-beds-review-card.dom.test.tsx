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

import { ClosedBedsPastReview } from "@/components/ward-management/capacity/capacity-closed-beds-review";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Item 6 (10 Nov 2026): Capacity's "Closed beds past review" card. Synthetic seed only. */
describe("Closed beds past review card", () => {
  it("lists the seeded closed bed past review with ward, bed, times and a ward link", () => {
    render(<ClosedBedsPastReview units={seedWardFlowState().units} now={NOW_ANCHOR} />);
    const card = screen.getByTestId("capacity-closed-beds-review");
    expect(within(card).getByText("Closed beds past review")).toBeInTheDocument();
    expect(card).toHaveTextContent(/Bed \d+/);
    expect(card).toHaveTextContent(/Closed since .* · review was /);
  });

  it("is hidden when no closed bed is past its review", () => {
    const units = seedWardFlowState().units.map((unit) => ({ ...unit, closedBeds: [] }));
    render(<ClosedBedsPastReview units={units} now={NOW_ANCHOR} />);
    expect(screen.queryByTestId("capacity-closed-beds-review")).toBeNull();
  });

  it("carries no ward link for the executive desk", () => {
    render(<ClosedBedsPastReview units={seedWardFlowState().units} now={NOW_ANCHOR} executive />);
    expect(within(screen.getByTestId("capacity-closed-beds-review")).queryByRole("link")).toBeNull();
  });
});
