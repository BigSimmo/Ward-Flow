// Audit CS3-12 (Josh, 26 Oct 2026, Part A 3): on the Bed board, moving a person who needs a locked
// bed to an open bed is refused until a reason is recorded, and the board offers the reasons.
// Synthetic seed data only.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { openSheetHandles } from "@/components/wf/sheet-focus";
import { bedIsOccupied } from "@/components/ward-management/ward-admissions";
import { OVERRIDE_REASONS } from "@/components/ward-management/ward-change-reasons";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { getBedStep } from "./helpers/ward-bed-steps";

afterEach(() => cleanup());

const UNIT = "fsh-adult-secure";

/** A mixed ward whose current stays have recorded beds: locked beds first, then open ones. */
function world(): { state: WardFlowState; lockedStayBed: number; freeOpenBed: number } {
  const state = seedWardFlowState();
  const unit = state.units.find((row) => row.id === UNIT)!;
  const occupiedLocked = unit.lockedBeds - unit.allocatableLocked;
  const current = state.admissions.filter((row) => row.unitId === UNIT && bedIsOccupied(row));
  current.forEach((row, index) => {
    row.bedKind = index < occupiedLocked ? "locked" : "open";
    row.bedNumber = index < occupiedLocked ? index + 1 : unit.lockedBeds + 1 + index - occupiedLocked;
  });
  const lockedStay = current.find((row) => row.bedKind === "locked" && row.state === "occupied")!;
  return {
    state,
    lockedStayBed: lockedStay.bedNumber!,
    freeOpenBed: Math.max(...current.map((row) => row.bedNumber!)) + 1,
  };
}

function Harness({ initial }: { initial: WardFlowState }) {
  const context = useWardFlow();
  const [state, setState] = useState(initial);
  const dispatch = (event: WardFlowEvent) => {
    setState((current) => wardFlowReducer(current, event));
    return undefined;
  };
  return (
    <WardFlowOverride value={{ ...context, ...state, dispatch } as typeof context}>
      <WardScreen unitId={UNIT} />
    </WardFlowOverride>
  );
}

describe("Bed board move to an open bed (audit CS3-12)", () => {
  it("asks for a reason, holds the form while open, then moves the person with it", () => {
    const { state, lockedStayBed, freeOpenBed } = world();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Harness initial={state} />
        </ToastProvider>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-open-bed-board"));
    fireEvent.click(screen.getByTestId(`ward-board-bed-${lockedStayBed}`));
    fireEvent.click(getBedStep("Move to another bed"));
    fireEvent.click(screen.getByTestId(`ward-board-bed-${freeOpenBed}`));

    expect(screen.getByTestId("ward-board-say")).toHaveTextContent(/Not recorded: .*is an open bed/);
    const form = screen.getByTestId("ward-bed-move-reason");
    expect(openSheetHandles().length).toBeGreaterThan(0);
    const submit = within(form).getByRole("button", { name: "Record reason and move" });
    expect(submit).toBeDisabled();
    fireEvent.click(within(form).getByRole("radio", { name: OVERRIDE_REASONS[1] }));
    fireEvent.click(submit);

    expect(screen.queryByTestId("ward-bed-move-reason")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-board-say")).toHaveTextContent(/^Moved .* to bed/);
    expect(openSheetHandles()).toHaveLength(0);
  });

  it("Cancel closes the form and moves nobody", () => {
    const { state, lockedStayBed, freeOpenBed } = world();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Harness initial={state} />
        </ToastProvider>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-open-bed-board"));
    const before = screen.getByTestId(`ward-board-bed-${lockedStayBed}`).getAttribute("aria-label");
    fireEvent.click(screen.getByTestId(`ward-board-bed-${lockedStayBed}`));
    fireEvent.click(getBedStep("Move to another bed"));
    fireEvent.click(screen.getByTestId(`ward-board-bed-${freeOpenBed}`));
    fireEvent.click(within(screen.getByTestId("ward-bed-move-reason")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("ward-bed-move-reason")).not.toBeInTheDocument();
    expect(screen.getByTestId(`ward-board-bed-${lockedStayBed}`).getAttribute("aria-label")).toBe(before);
  });
});
