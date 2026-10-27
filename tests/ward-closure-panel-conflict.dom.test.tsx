import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardClosurePanel } from "@/components/ward-management/capacity/ward-closure-panel";
import { WardSharedSaveContext } from "@/components/ward-management/shell/ward-shared-save-context";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Unit } from "@/components/ward-management/ward-model";

/** P010 (28 Oct 2026): two coordinators close the same ward in two tabs; the second is told, not left guessing. */
const refusal = vi.hoisted(() => ({ message: "", dispatch: undefined as undefined | ((...a: unknown[]) => unknown) }));
vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return {
    ...real,
    useWardFlowSelect: ((...keys: string[]) => {
      const select = real.useWardFlowSelect as unknown as (...k: string[]) => Record<string, unknown>;
      const selected = select(...keys);
      if (!refusal.message || !("dispatch" in selected)) return selected;
      refusal.dispatch ??= vi.fn(() => ({ status: "refused", message: refusal.message }));
      return { ...selected, dispatch: refusal.dispatch };
    }) as unknown as typeof real.useWardFlowSelect,
  };
});

const UNIT = seedWardFlowState().units[0]!;
const CLOSED_BY_OTHER: Unit = {
  ...UNIT,
  isClosed: true,
  admissionsClosure: { reason: "infection_outbreak", at: NOW_ANCHOR - 5, by: "Coordinator" },
};

const retry = vi.fn();
const renderPanel = (unit: Unit) => {
  const tree = (u: Unit) => (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardSharedSaveContext.Provider value={{ unconfirmedSave: false, status: "ready", error: null, retry }}>
        <WardClosurePanel unit={u} now={NOW_ANCHOR} actor={{ role: "coordinator" }} />
      </WardSharedSaveContext.Provider>
    </WardFlowProvider>
  );
  const view = render(tree(unit));
  return { rerender: (u: Unit) => view.rerender(tree(u)) };
};

function chooseStaffingAndClose() {
  fireEvent.change(screen.getByTestId("ward-closure-reason"), { target: { value: "staffing" } });
  fireEvent.click(screen.getByTestId("ward-closure-close"));
  fireEvent.click(screen.getByRole("button", { name: `Close ${UNIT.name}` }));
}

afterEach(() => {
  refusal.message = "";
  refusal.dispatch = undefined;
  retry.mockClear();
  window.sessionStorage.clear();
});

describe("ward closure panel, two-tab conflict (P010)", () => {
  it("says a refused close in an alert, keeps the reason, and Try again re-reads the board", async () => {
    refusal.message = `${UNIT.name} is already closed to admissions`;
    renderPanel(UNIT);
    chooseStaffingAndClose();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(`Not recorded. ${UNIT.name} is already closed to admissions. Nothing was changed.`);
    expect(screen.getByTestId("ward-closure-reason")).toHaveValue("staffing");
    expect(refusal.dispatch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
    // It reads the board again; it does not send the close a second time.
    expect(refusal.dispatch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-closure-reason")).toHaveValue("staffing");
  });

  it("names the reason already recorded when the board shows the other close", () => {
    const view = renderPanel(UNIT);
    fireEvent.change(screen.getByTestId("ward-closure-reason"), { target: { value: "staffing" } });
    act(() => view.rerender(CLOSED_BY_OTHER));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(`Not recorded. ${UNIT.name} was closed first: Infection outbreak, by Coordinator.`);
    expect(alert).toHaveTextContent("You chose Staffing. Nothing was changed.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // Reopened later, the form comes back with the reason they chose.
    act(() => view.rerender(UNIT));
    expect(screen.getByTestId("ward-closure-reason")).toHaveValue("staffing");
  });

  it("stays quiet when the other close used the same reason", () => {
    const view = renderPanel(UNIT);
    fireEvent.change(screen.getByTestId("ward-closure-reason"), { target: { value: "infection_outbreak" } });
    act(() => view.rerender(CLOSED_BY_OTHER));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
