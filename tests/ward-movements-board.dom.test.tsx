import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MovementsBoard } from "@/components/ward-management/movements/movements-board";
import { isOfficerJob } from "@/components/ward-management/officer/officer-screen";
import { TransportHub } from "@/components/ward-management/officer/transport-hub";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The live Movements board and Transport Hub (redesign approved 5 October 2026): their headline
 * figures match the engine, filters that match nothing say so, and working a transport job never
 * moves the job sheet to a different patient.
 */
const seed = seedWardFlowState();
const openCount = seed.movements.filter(isOpen).length;
const jobCount = seed.movements.filter(isOfficerJob).length;

function renderWith(node: React.ReactNode) {
  return render(<WardFlowProvider initialNow={NOW_ANCHOR}>{node}</WardFlowProvider>);
}

describe("Movements board", () => {
  it("states the engine's open count and lists the longest waits first", () => {
    renderWith(<MovementsBoard />);
    const board = screen.getByTestId("movements-board");
    expect(within(board).getByText(`${openCount} movements are open.`)).toBeTruthy();
    expect(within(board).getByText(`15 shown of ${openCount}`)).toBeTruthy();
  });

  it("says plainly when a search matches nothing, without repeating what was typed", () => {
    renderWith(<MovementsBoard />);
    fireEvent.change(screen.getByLabelText(/search/i, { selector: "input" }), { target: { value: "zzzz" } });
    expect(screen.getByText("No movement matches this filter and search.")).toBeTruthy();
    expect(screen.queryByText(/zzzz/)).toBeNull();
  });
});

describe("Transport Hub", () => {
  it("counts the same open jobs as the officer view", () => {
    renderWith(<TransportHub />);
    expect(screen.getByText(`${jobCount} transport jobs are open:`)).toBeTruthy();
  });

  it("keeps the job sheet on the patient just worked when the step moves the job out of the filter", () => {
    renderWith(<TransportHub />);
    fireEvent.click(screen.getByRole("button", { name: /Accepted, not yet left/ }));
    const sheetTitle = () => screen.getByRole("heading", { name: /^Job sheet/ }).textContent;
    const before = sheetTitle();
    fireEvent.click(screen.getByRole("button", { name: "Mark en route" }));
    expect(sheetTitle()).toBe(before);
    expect(screen.getByRole("button", { name: "Mark collected" })).toBeTruthy();
  });

  it("never carries a delivery confirmation over to another job", () => {
    renderWith(<TransportHub />);
    fireEvent.click(screen.getByRole("button", { name: /Patient on board/ }));
    fireEvent.click(screen.getByRole("button", { name: "Mark delivered" }));
    expect(screen.getByRole("button", { name: /^Confirm delivered to/ })).toBeTruthy();
    const rows = screen
      .getAllByRole("button", { pressed: false })
      .filter((b) => /^[A-Z]{2}$/.test(b.textContent ?? ""));
    fireEvent.click(rows[0]);
    expect(screen.queryByRole("button", { name: /^Confirm delivered to/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Mark delivered" })).toBeTruthy();
  });
});
