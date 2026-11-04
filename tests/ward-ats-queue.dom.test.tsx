import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PriorityQueue } from "@/components/ward-management/coordinator/priority-queue";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Q376: the Flow card is the queue's one layout. Referrals are decided under Needs you, so the Flow
// card's Referral stage counts them and lists no referral rows; only movement rows carry ATS here.
describe("ATS remains independent from operational urgency in the queue", () => {
  it("shows the recorded ATS value without changing a three-tier urgency, and labels absence", () => {
    const state = seedWardFlowState();
    const recorded = { ...state.movements[0], urgency: 2 as const, atsCategory: 5 as const };
    const missing = { ...state.movements[1], atsCategory: undefined };
    render(
      <PriorityQueue
        movements={[recorded, missing]}
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
    // Overall review, 20 Oct 2026: no ATS shows no visible filler; the absence is still read out,
    // in the same screen-reader-only text as the row's tier.
    const missingRow = within(screen.getByTestId(`ward-queue-row-${missing.id}`));
    expect(missingRow.getByText("ATS not recorded").className).toBe(
      missingRow.getByText(`${urgencyTierLabel(missing.urgency)}.`).className,
    );
  });

  it("counts referrals in the Referral stage without listing them as rows", () => {
    const state = seedWardFlowState();
    const referrals = [
      { ...state.referrals[0], atsCategory: 5 as const },
      { ...state.referrals[1], atsCategory: undefined },
    ];
    render(
      <PriorityQueue
        movements={state.movements.slice(0, 2)}
        referralQueue={referrals}
        flowStage="referral"
        now={NOW_ANCHOR}
        selectedId={undefined}
        onSelect={() => {}}
        filterEdId={undefined}
        onClearFilter={() => {}}
      />,
    );
    const stage = screen.getByRole("region", { name: "Referral" });
    expect(stage).toHaveTextContent("2 referrals to decide, listed once under Needs you");
    expect(within(stage).queryAllByTestId(/^ward-(referral|queue)-row-/u)).toHaveLength(0);
    expect(screen.queryByText("ATS 5")).not.toBeInTheDocument();
  });
});
