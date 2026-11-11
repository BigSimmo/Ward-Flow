import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isTierOneOpen } from "@/components/ward-management/ward-shared-figures";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { showEveryoneWaiting } from "./helpers/ward-home-queue";

/**
 * P002 and P003 (Josh, 27 Oct 2026, "Go ahead with all recommendations"): the screens print one
 * Tier 1 count (every open journey at tier 1, in transit included), and choosing an ED card narrows
 * Home and says so, with Clear also resetting the ED card.
 *
 * Sticky header redesign (Josh, 9 Nov 2026): Home's hero no longer has Tier 1 or Past target chips.
 * Home therefore prints no Tier 1 count to disagree with, Movements' count follows the shared
 * definition, and the ED card narrows Home's Flow list, which says so and clears.
 */
beforeEach(() => {
  window.sessionStorage.clear();
});

describe("Home and Movements print one Tier 1 count (P002)", () => {
  it("Home prints no second Tier 1 count, and Movements' Tier 1 now follows the shared definition", () => {
    const home = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    expect(screen.queryByText(/Tier 1/u)).not.toBeInTheDocument();
    home.unmount();

    const tierOneOpen = seedWardFlowState().movements.filter(isTierOneOpen).length;
    expect(tierOneOpen).toBeGreaterThan(0);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MovementsScreen />
      </WardFlowProvider>,
    );
    // Movements redesign (1 Nov 2026, Q102): the Tier 1 figure sits in the hero, a number over its label.
    const figure = within(screen.getByRole("group", { name: "Highlight movements" })).getByRole("button", {
      name: /Tier 1$/u,
    });
    expect(Number(/^(\d+)/.exec(figure.closest<HTMLElement>("[data-wf-hero-figure]")?.textContent ?? "")?.[1])).toBe(
      tierOneOpen,
    );
  });
});

describe("an ED card narrows Home and says so (P003)", () => {
  it("names the chosen site on Home's Flow list, and Clear also resets the ED card", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    const edCard = screen.getByTestId("ward-ed-rph-ed");
    fireEvent.click(edCard);
    expect(edCard).toHaveAttribute("aria-pressed", "true");
    showEveryoneWaiting();
    expect(screen.getByText("Filtered to RPH")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));

    expect(screen.getByTestId("ward-ed-rph-ed")).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("Filtered to RPH")).not.toBeInTheDocument();
    expect(window.sessionStorage.length).toBe(0);
  });
});
