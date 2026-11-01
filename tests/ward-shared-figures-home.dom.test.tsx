import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * P002 and P003 (Josh, 27 Oct 2026, "Go ahead with all recommendations"): Home and Movements print
 * one Tier 1 count (every open journey at tier 1, in transit included) and each label says what it
 * counts. Choosing an ED card narrows Home's chips and the labels say so ("Tier 1 open journeys · RPH", spoken; "Tier 1 · RPH" shown); Clear
 * also resets the ED card.
 */
function chip(name: RegExp): HTMLElement {
  return screen.getByRole("button", { name });
}

function chipValue(button: HTMLElement): number {
  return Number(/^\s*(\d+)/.exec(button.textContent ?? "")?.[1]);
}

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("Home and Movements print one Tier 1 count (P002)", () => {
  it("Home's Tier 1 chip names its noun and matches Movements' Tier 1 now", () => {
    const home = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    const homeTierOne = chipValue(chip(/^\s*\d+\s*Tier 1 open journeys$/));
    expect(homeTierOne).toBeGreaterThan(0);
    home.unmount();

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MovementsScreen />
      </WardFlowProvider>,
    );
    // Movements redesign (1 Nov 2026, Q102): the Tier 1 figure sits in the hero, a number over its label.
    const figure = within(screen.getByRole("group", { name: "Highlight movements" })).getByRole("button", {
      name: /Tier 1$/u,
    });
    expect(Number(/^(\d+)/.exec(figure.textContent ?? "")?.[1])).toBe(homeTierOne);
  });
});

describe("an ED card narrows Home's chips and says so (P003)", () => {
  it("labels the chips with the chosen site, and Clear also resets the ED card", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    expect(chip(/^\s*\d+\s*Past target waits$/)).toBeInTheDocument();
    const edCard = screen.getByTestId("ward-ed-rph-ed");
    fireEvent.click(edCard);
    expect(edCard).toHaveAttribute("aria-pressed", "true");
    expect(chip(/^\s*\d+\s*Past target waits · RPH$/)).toBeInTheDocument();
    const tierOne = chip(/^\s*\d+\s*Tier 1 open journeys · RPH$/);
    expect(screen.queryByRole("button", { name: /Tier 1 open journeys$/ })).not.toBeInTheDocument();

    fireEvent.click(tierOne);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.getByTestId("ward-ed-rph-ed")).toHaveAttribute("aria-pressed", "false");
    expect(chip(/^\s*\d+\s*Past target waits$/)).toBeInTheDocument();
    expect(chip(/^\s*\d+\s*Tier 1 open journeys$/)).toHaveAttribute("aria-pressed", "false");
    expect(window.sessionStorage.length).toBe(0);
  });
});
