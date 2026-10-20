import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { edOpenSummaries } from "@/components/ward-management/ed/ed-home-derivations";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { activeActNowItems } from "@/components/ward-management/ward-act-now-items";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { openJourneySplit } from "@/components/ward-management/ward-shared-figures";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Overall review, 20 Oct 2026, "fix before the next demonstration" item 1: every count label has one
 * meaning. These read the rendered words against the shared selectors on the seeded day, so a screen
 * that drifts back to its own count, or its old words, fails here.
 */
const state = seedWardFlowState();
const split = openJourneySplit(state.movements);

function inProvider(node: React.ReactNode) {
  return render(<WardFlowProvider initialNow={NOW_ANCHOR}>{node}</WardFlowProvider>);
}

describe("count labels say what they count", () => {
  it("Waiting leads with the one waiting figure and names the people in transit on its list", () => {
    inProvider(<DelaysScreen />);
    const hero = screen.getByTestId("delays-hero");
    const title = within(hero).getByRole("heading", { level: 1 });
    expect(split.notWaiting.in_transit, "the seed has people in transit").toBeGreaterThan(0);
    expect(title.textContent).toBe(`${split.waiting} waiting in ED, ${split.notWaiting.in_transit} in transit`);
    // The list itself still holds everybody, and says so.
    expect(screen.getByTestId("delays-shown-count")).toHaveTextContent(`${split.listed} of ${split.listed}`);
  });

  it("Waiting keeps its views and drops the chips that repeated them", () => {
    inProvider(<DelaysScreen />);
    const waiting = screen.getByRole("region", { name: "Waiting" });
    expect(within(waiting).getByTestId("delays-view-needs-me")).toBeInTheDocument();
    expect(within(waiting).queryByRole("button", { name: /^12h\+/u })).toBeNull();
    expect(within(waiting).queryByRole("button", { name: /^No update 2h\+/u })).toBeNull();
    // "Yours" read as the Needs me now view; the tile is whose move it is, in different words.
    expect(screen.getByTestId("delays-owner-yours")).toHaveTextContent("Waiting on you");
    expect(screen.getByTestId("delays-owner-yours")).not.toHaveTextContent(/Yours/u);
  });

  it("an ED's title says how its board splits, and the waiting part is its own tile", () => {
    inProvider(<EdScreen edId="rph-ed" />);
    const rph = edOpenSummaries(state.movements, NOW_ANCHOR).find((summary) => summary.ed.id === "rph-ed")!;
    const splitLine = screen.getByTestId("ward-ed-board-split");
    expect(splitLine.textContent).toMatch(new RegExp(`^${rph.waiting} waiting, \\d+ in transit$`, "u"));
    const tile = screen.getByRole("navigation", { name: "Emergency departments" });
    const rphTile = within(tile)
      .getAllByRole("link")
      .find((link) => link.getAttribute("data-ed") === "rph-ed")!;
    expect(rphTile).toHaveTextContent(`${rph.waiting}waiting`);
  });

  it("Alerts leads with the Act now figure the menu's act-now row shows", () => {
    inProvider(<AlertsScreen />);
    const actNow = activeActNowItems(state, NOW_ANCHOR).length;
    expect(actNow).toBeGreaterThan(0);
    const title = screen.getByRole("heading", { level: 1 });
    expect(title.textContent).toMatch(new RegExp(`^${actNow} act now(, \\d+ new to you)?$`, "u"));
  });
});
