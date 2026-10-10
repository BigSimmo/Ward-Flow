import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

// jsdom has no App Router context for next/link, as in every sibling dom suite.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { journeyStages, StatisticsJourneyView } from "@/components/ward-management/statistics/statistics-journey-view";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

beforeAll(() => {
  // The ED wait field measures its card; jsdom has no ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

function renderView(onShowBoard = vi.fn()) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsJourneyView onShowBoard={onShowBoard} />
    </WardFlowProvider>,
  );
  return onShowBoard;
}

describe("Summary, Journey view", () => {
  it("the four ED stages partition the open movements, so they add up to everyone waiting in ED", () => {
    const state = seedWardFlowStateAt(0);
    const now = NOW_ANCHOR;
    const stages = journeyStages({ ...state, now });
    expect(stages.map((stage) => stage.id)).toEqual([
      "waiting",
      "referred",
      "accepted",
      "moving",
      "ward",
      "planned",
      "discharged",
    ]);
    const edSide = stages.slice(0, 4).reduce((sum, stage) => sum + stage.count, 0);
    expect(edSide).toBe(state.movements.filter(isOpen).length);
    const moving = stages.find((stage) => stage.id === "moving")!;
    expect(moving.breakdown.reduce((sum, item) => sum + Number(item.value), 0)).toBe(moving.count);
  });

  it("renders the ribbon, the stage band and both cards under their anchor ids", () => {
    renderView();
    const view = screen.getByTestId("ward-statistics-journey-view");
    expect(view.id).toBe("journey");
    for (const id of ["journey-ribbon", "journey-stages", "journey-beds", "journey-waiting"]) {
      expect(view.querySelector(`#${id}`)).not.toBeNull();
    }
    expect(within(view).getAllByRole("listitem").length).toBeGreaterThan(7);
  });

  it("choosing a stage on the ribbon highlights its column, and choosing it again clears it", () => {
    renderView();
    const node = screen.getByTestId("ward-statistics-journey-node-ward");
    const column = screen.getByTestId("ward-statistics-journey-stage-ward");
    expect(node).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(node);
    expect(node).toHaveAttribute("aria-pressed", "true");
    expect(column).toHaveAttribute("aria-current", "true");
    fireEvent.click(node);
    expect(node).toHaveAttribute("aria-pressed", "false");
    expect(column).not.toHaveAttribute("aria-current");
  });

  it("every hospital row opens the bed board", () => {
    const onShowBoard = renderView();
    const beds = screen.getByTestId("ward-statistics-journey-beds");
    const rows = within(beds).getAllByRole("button", { name: /Open the bed board\.$/ });
    expect(rows.length).toBeGreaterThan(0);
    fireEvent.click(rows[0]);
    fireEvent.click(within(beds).getByTestId("ward-statistics-journey-open-board"));
    expect(onShowBoard).toHaveBeenCalledTimes(2);
  });

  it("each ED row in Who is waiting links to that ED's statistics page", () => {
    renderView();
    const waiting = screen.getByTestId("ward-statistics-journey-waiting");
    const links = within(waiting).getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/^\/mockups\/ward-flow\/statistics\/ed\/[^/]+$/);
    }
  });
});
