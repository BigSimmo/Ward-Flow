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

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { edOpenSummaries } from "@/components/ward-management/ed/ed-home-derivations";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { heroHighlights } from "@/components/ward-management/movements/movements-screen-helpers";
import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { activeActNowItems } from "@/components/ward-management/ward-act-now-items";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import {
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
  LONG_WAIT_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { openEdJourneys, openJourneySplit } from "@/components/ward-management/ward-shared-figures";
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

  // Audit 6 (Josh, 20 Oct 2026): the figures the audit found still counting for themselves.
  it("Statistics names open ED journeys and retains them through transit", () => {
    const expected = state.movements.filter(
      (movement) => isOpen(movement) && movement.sourceAdmissionId === undefined && movement.originEdId !== undefined,
    ).length;
    inProvider(<StatisticsScreen />);
    const chips = screen.getByRole("group", { name: "Network at a glance" });
    const journeys = within(chips).getByText("Open ED journeys", { exact: true }).closest("button")!;
    expect(openEdJourneys(state.movements, NOW_ANCHOR).total).toBe(expected);
    expect(journeys.textContent).toBe(`${expected}Open ED journeys`);
  });

  it("Handover's Act now is Alerts' act-now list, with flagged urgent on its own line", () => {
    inProvider(<HandoverPage />);
    const strip = screen.getByTestId("ward-handover-kpi-strip");
    // Audit 24-4 decision 5 (Josh): the pill names people and alerts separately.
    const act = within(strip).getByRole("button", { name: /Act now \(\d+ (?:person|people), \d+ alerts?\)$/u });
    expect(act.textContent).toMatch(new RegExp(`^${activeActNowItems(state, NOW_ANCHOR).length}Act now$`, "u"));
    expect(within(strip).getByRole("button", { name: /Flagged urgent$/u })).toBeInTheDocument();
  });

  // NA3-03 (audit 26 Oct 2026): and only people still in an ED, as Waiting counts them.
  it("Over 8h counts 8 hours or more in an ED, past 24 hours included", () => {
    const at = NOW_ANCHOR + 13 * 60 + 15;
    const over = heroHighlights(at, LONG_WAIT_MINUTES).find((highlight) => highlight.id === "over")!;
    const open = state.movements.filter(isOpen);
    const expected = open.filter(
      (movement) => isWaitingInEd(movement) && at - movement.openedAt >= ED_SEVERE_PRESSURE_WAIT_MINUTES,
    ).length;
    expect(open.some((movement) => at - movement.openedAt >= LONG_WAIT_MINUTES)).toBe(true);
    expect(open.filter(over.test).length).toBe(expected);
  });

  it("the TV's over 24 hours is everyone in an ED for 24 hours or more", () => {
    const at = NOW_ANCHOR + 13 * 60 + 15;
    const sheet = bedMeetingSheet({
      units: state.units,
      movements: state.movements,
      bedReleases: state.bedReleases,
      admissions: state.admissions,
      leaveBeds: state.leaveBeds,
      now: at,
      thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
      service: null,
      nameOf: (movement) => movement.id,
    });
    const expected = state.movements.filter(
      (movement) => isWaitingInEd(movement) && at - movement.openedAt >= LONG_WAIT_MINUTES,
    ).length;
    expect(expected).toBeGreaterThan(0);
    expect(sheet.ed.overLongWait).toBe(expected);
  });
});
