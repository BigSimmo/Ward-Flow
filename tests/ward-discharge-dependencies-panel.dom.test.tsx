import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DischargeDependenciesPanel } from "@/components/ward-management/discharges/discharge-dependencies-panel";
import { DischargeWeekendPrep } from "@/components/ward-management/discharges/discharge-weekend-prep";
import { perthMidnight } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Closing-the-loop package B (24 Oct 2026): the arrangements panel and the weekend list. */
afterEach(cleanup);

const seed = seedWardFlowState();
const release = (id: string) => seed.bedReleases.find((candidate) => candidate.id === id)!;
// Day 0 is Friday 23 October 2026 in Perth.
const FRIDAY = perthMidnight(2026, 9, 23);

describe("discharge arrangements panel", () => {
  it("shows each item, its age and owner, and what changed since a confirmation", () => {
    render(
      <DischargeDependenciesPanel
        release={release("derived-expected-AD-RGHS-07")}
        now={NOW_ANCHOR}
        dayZero={FRIDAY}
        role="coordinator"
        dispatch={() => {}}
      />,
    );
    const pharmacy = screen.getByTestId("ward-discharge-dependency-pharmacy");
    expect(within(pharmacy).getByText("Done")).toBeTruthy();
    expect(within(pharmacy).getByText("Needs checking again")).toBeTruthy();
    expect(pharmacy.textContent).toContain("Pharmacy · confirmed 4 h ago by Ward manager");
    expect(pharmacy.textContent).toContain("Expected out moved from");
    expect(pharmacy.textContent).toContain("changed 1 h ago by Bed coordinator");
    const transport = screen.getByTestId("ward-discharge-dependency-transport");
    expect(within(transport).getByText("Outstanding")).toBeTruthy();
    expect(within(transport).queryByText("Needs checking again")).toBeNull();
    expect(screen.getByTestId("ward-discharge-dependency-summary").textContent).toBe(
      "2 outstanding · 1 done · 0 not needed · 1 to check again",
    );
    expect(screen.getByText(/^Destination: Discharged to the community · recorded/)).toBeTruthy();
    expect(screen.getByText(/^Bed release expected: reported/)).toBeTruthy();
  });

  it("reconfirms through a recorded event and never offers a control to a read-only role", () => {
    const dispatch = vi.fn<(event: WardFlowEvent) => void>();
    const target = release("derived-expected-AD-RGHS-07");
    const { unmount } = render(
      <DischargeDependenciesPanel release={target} now={NOW_ANCHOR} dayZero={FRIDAY} role="ward" dispatch={dispatch} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reconfirm Discharge medicines" }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RECORD_DISCHARGE_DEPENDENCY",
        releaseId: target.id,
        actingUnitId: target.unitId,
        kind: "pharmacy",
        state: "done",
      }),
    );
    unmount();
    render(
      <DischargeDependenciesPanel
        release={target}
        now={NOW_ANCHOR}
        dayZero={FRIDAY}
        role="executive"
        dispatch={dispatch}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps the single recorded blocker beside the list", () => {
    render(
      <DischargeDependenciesPanel
        release={release("derived-expected-AD-BTYS-05")}
        now={NOW_ANCHOR}
        dayZero={FRIDAY}
        role="coordinator"
        dispatch={() => {}}
      />,
    );
    expect(screen.getByText("Recorded blocker: Awaiting transport")).toBeTruthy();
  });
});

describe("weekend and holiday preparation", () => {
  it("groups outstanding items by a service closing over the weekend, in recorded order", () => {
    const onOpen = vi.fn();
    render(
      <DischargeWeekendPrep
        releases={seed.bedReleases}
        units={seed.units}
        nameFor={() => null}
        now={NOW_ANCHOR}
        dayZero={FRIDAY}
        onOpen={onOpen}
      />,
    );
    const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Pharmacy closes Sat 12:00, reopens Mon 08:30 (Weekend)",
      "Patient transport closes Sat 14:00, reopens Mon 07:00 (Weekend)",
      "Community mental health team closes Fri 17:00, reopens Mon 08:30 (Weekend)",
    ]);
    const transport = screen.getByRole("region", { name: headings[1]! });
    const rows = within(transport).getAllByRole("button");
    // Recorded (seed) order: SCGA-03, then RGHS-07, then BTYS-05 in the release list.
    expect(rows).toHaveLength(3);
    fireEvent.click(rows[0]!);
    expect(onOpen).toHaveBeenCalledWith("derived-expected-AD-SCGA-03", rows[0]);
  });
});
