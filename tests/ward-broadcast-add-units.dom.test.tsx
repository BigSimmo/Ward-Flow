// Alerts redesign (Q149, 1 Nov 2026): the Add units dialog offers only desks the alert has not asked.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AddUnitsDialog } from "@/components/ward-management/alerts/broadcast-add-units";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(cleanup);

const seed = seedWardFlowState();
const [first, second] = seed.units;

const sent = (kind: "directive" | "bed_call") =>
  wardFlowReducer(seed, {
    type: "DISPATCH_BROADCAST_ALERT",
    role: "coordinator",
    now: NOW_ANCHOR,
    title: "Synthetic alert",
    message: "Synthetic message for the add units dialog.",
    severity: "warning",
    category: "capacity_gridlock",
    targetScope: "all",
    targetScopeLabel: "Chosen units",
    durationMinutes: 60,
    dispatchedByName: "Synthetic desk",
    kind,
    targetUnitIds: [first.id],
  } as WardFlowEvent).broadcastAlerts.at(-1)!;

describe("Add units dialog", () => {
  it("leaves out the desks already asked and sends the ones ticked", () => {
    const onAdd = vi.fn();
    render(<AddUnitsDialog alert={sent("directive")} units={seed.units} onClose={() => {}} onAdd={onAdd} />);
    expect(screen.queryByRole("checkbox", { name: first.name })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add 0 units" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getAllByRole("checkbox", { name: second.name })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Add 1 unit" }));
    expect(onAdd).toHaveBeenCalledWith([second.id]);
  });

  it("offers wards only on a bed call", () => {
    render(<AddUnitsDialog alert={sent("bed_call")} units={seed.units} onClose={() => {}} onAdd={() => {}} />);
    expect(screen.queryByText("ED desks")).not.toBeInTheDocument();
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);
  });
});
