import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
import { alertsOrderLine } from "@/components/ward-management/alerts/alerts-model";
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { waitingOrderLine } from "@/components/ward-management/delays/delays-board-model";
import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { dischargeOrderLine } from "@/components/ward-management/discharges/discharge-board-model";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Item 4 (usability, 24 Oct 2026): each main list says in one short line why its rows are in that
 * order. The words follow the sort code, change when the order changes, and never rank anybody.
 */

function inProvider(node: ReactNode) {
  return render(<WardFlowProvider initialNow={NOW_ANCHOR}>{node}</WardFlowProvider>);
}

const ALL_LINES = [
  waitingOrderLine(true),
  waitingOrderLine(false),
  alertsOrderLine("urgency"),
  alertsOrderLine("lanes"),
  alertsOrderLine("owner"),
  ...(["records", "releases"] as const).flatMap((population) =>
    (["list", "barriers"] as const).flatMap((view) =>
      (["default", "due-first"] as const).flatMap((sortMode) =>
        [true, false].flatMap((allStatuses) =>
          [true, false].map((highlighted) =>
            dischargeOrderLine({ population, view, sortMode, allStatuses, highlighted }),
          ),
        ),
      ),
    ),
  ),
];

describe("list order lines", () => {
  it("are plain words: no semicolons, arrows or symbols, and no ranking or recommendation", () => {
    for (const line of ALL_LINES) {
      expect(line, line).toMatch(/^[A-Za-z ,.]+$/u);
      expect(line, line).not.toMatch(/\b(rank|priority|recommend|best|suitab)/iu);
    }
  });

  it("Discharges names the order each view and sort actually builds", () => {
    const line = (overrides: Partial<Parameters<typeof dischargeOrderLine>[0]>) =>
      dischargeOrderLine({
        population: "releases",
        view: "list",
        sortMode: "default",
        allStatuses: true,
        highlighted: false,
        ...overrides,
      });
    expect(line({})).toBe("Blocked first, then by stage. Soonest time band first in each.");
    expect(line({ sortMode: "due-first" })).toBe("Blocked first, then by stage. Earliest expected time first in each.");
    expect(line({ population: "records" })).toBe("Blocked first, then by stage. Soonest expected date first in each.");
    expect(line({ population: "records", sortMode: "due-first" })).toBe(
      "Soonest expected date first. Departed and undated last.",
    );
    // One status shown: there is no stage order left to state.
    expect(line({ allStatuses: false })).toBe("Soonest time band first");
    expect(line({ highlighted: true })).toBe(
      "Highlighted people first in each group. Blocked first, then by stage. Soonest time band first in each.",
    );
    expect(line({ population: "records", highlighted: true, allStatuses: false })).toBe(
      "Highlighted people first. Soonest expected date first",
    );
    expect(line({ view: "barriers" })).toBe("Largest barrier group first");
    expect(line({ view: "barriers", highlighted: true })).toBe(
      "Largest barrier group first. Highlighted people first in each.",
    );
  });

  it("Waiting says its order and follows the order switch", () => {
    inProvider(<DelaysScreen />);
    const note = screen.getByTestId("delays-order-note");
    expect(screen.getByRole("button", { name: "Longest wait" })).toHaveAttribute("aria-pressed", "true");
    expect(note).toHaveTextContent(/^Longest wait first$/u);
    fireEvent.click(screen.getByRole("button", { name: "By blocker" }));
    expect(screen.getByTestId("delays-order-note")).toHaveTextContent(
      "Form times first, then other blockers. Longest wait first in each.",
    );
  });

  it("Discharges says its order and follows the Sort and the Barriers view", () => {
    inProvider(<DischargeBoard />);
    expect(screen.getByTestId("ward-discharge-order-note")).toHaveTextContent(
      "Blocked first, then by stage. Soonest time band first in each.",
    );
    fireEvent.change(screen.getByTestId("ward-discharges-sort"), { target: { value: "due-first" } });
    expect(screen.getByTestId("ward-discharge-order-note")).toHaveTextContent(
      "Blocked first, then by stage. Earliest expected time first in each.",
    );
    fireEvent.click(screen.getByTestId("ward-discharge-view-barriers"));
    expect(screen.getByTestId("ward-discharge-order-note")).toHaveTextContent("Largest barrier group first");
  });

  it("the ED board table is named for the Sort it is in", () => {
    inProvider(<EdScreen edId="rph-ed" />);
    expect(screen.getByRole("table", { name: "Emergency department board, longest in ED first" })).toBeInTheDocument();
    // The sort is the kit's Segmented now (ED board redesign, 31 Oct 2026), not a select.
    const sort = screen.getByRole("radiogroup", { name: "Sort patients" });
    fireEvent.click(within(sort).getByRole("radio", { name: "Patient name" }));
    expect(
      screen.getByRole("table", { name: "Emergency department board, A to Z by patient name" }),
    ).toBeInTheDocument();
    fireEvent.click(within(sort).getByRole("radio", { name: "Current order" }));
    expect(screen.getByRole("table", { name: "Emergency department board, in current order" })).toBeInTheDocument();
  });

  it("Alerts says the desktop Now order for each arrangement", () => {
    inProvider(<AlertsScreen />);
    const arrange = screen.getByRole("radiogroup", { name: "Arrange by" });
    expect(screen.getByTestId("ward-alerts-order-note")).toHaveTextContent(
      "Act now first, then waiting. Oldest first in each.",
    );
    fireEvent.click(within(arrange).getByRole("radio", { name: /Lanes/u }));
    expect(screen.getByTestId("ward-alerts-order-note")).toHaveTextContent(
      "Oldest first in each lane. Running targets after waiting.",
    );
    fireEvent.click(within(arrange).getByRole("radio", { name: /Owner/u }));
    expect(screen.getByTestId("ward-alerts-order-note")).toHaveTextContent(
      "You first, then A to Z by owner. Oldest first in each, snoozed last.",
    );
  });
});
