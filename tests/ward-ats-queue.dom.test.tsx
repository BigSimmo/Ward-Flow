import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PriorityQueue } from "@/components/ward-management/coordinator/priority-queue";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("ATS remains independent from operational urgency in both queue tabs", () => {
  it("shows the recorded ATS value without changing a three-tier urgency, and labels absence", () => {
    const state = seedWardFlowState();
    const recorded = { ...state.movements[0], urgency: 2 as const, atsCategory: 5 as const };
    const missing = { ...state.movements[1], atsCategory: undefined };
    const referral = { ...state.referrals[0], urgency: 2 as const, atsCategory: 5 as const };
    render(
      <PriorityQueue
        movements={[recorded, missing]}
        referralQueue={[referral]}
        now={NOW_ANCHOR}
        selectedId={undefined}
        onSelect={() => {}}
        filterEdId={undefined}
        onClearFilter={() => {}}
      />,
    );
    const row = screen.getByTestId(`ward-queue-row-${recorded.id}`);
    expect(within(row).getByText("ATS 5")).toBeInTheDocument();
    expect(row.querySelector('[data-tier="2"]')).not.toBeNull();
    expect(
      within(screen.getByTestId(`ward-queue-row-${missing.id}`)).getByText("ATS not recorded"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Referrals/ }));
    expect(within(screen.getByTestId(`ward-referral-row-${referral.id}`)).getByText("ATS 5")).toBeInTheDocument();
  });
});
