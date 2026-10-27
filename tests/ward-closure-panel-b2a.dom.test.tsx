import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardClosurePanel } from "@/components/ward-management/capacity/ward-closure-panel";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** B2a (27 Oct 2026): P001 a refused close keeps the inputs, P021 reopen asks, P086 the draft survives. */
const refusal = vi.hoisted(() => ({ on: false }));
vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return {
    ...real,
    useWardFlowSelect: ((...keys: string[]) => {
      const select = real.useWardFlowSelect as unknown as (...k: string[]) => Record<string, unknown>;
      const selected = select(...keys);
      if (!refusal.on || !("dispatch" in selected)) return selected;
      return { ...selected, dispatch: () => ({ status: "refused", message: "Someone else changed this ward first." }) };
    }) as unknown as typeof real.useWardFlowSelect,
  };
});

const UNIT = seedWardFlowState().units[0]!;

function Panel() {
  const { units, now } = useWardFlow();
  const unit = units.find((candidate) => candidate.id === UNIT.id)!;
  return <WardClosurePanel unit={unit} now={now} actor={{ role: "coordinator" }} />;
}

const renderPanel = () =>
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Panel />
    </WardFlowProvider>,
  );

function chooseAndConfirmClose() {
  fireEvent.change(screen.getByTestId("ward-closure-reason"), { target: { value: "staffing" } });
  fireEvent.change(screen.getByTestId("ward-closure-reopen-after"), { target: { value: "8" } });
  fireEvent.click(screen.getByTestId("ward-closure-close"));
  fireEvent.click(screen.getByRole("button", { name: `Close ${UNIT.name}` }));
}

afterEach(() => {
  refusal.on = false;
  window.sessionStorage.clear();
});

describe("ward closure panel B2a", () => {
  it("keeps the reason and reopening time when the close is refused (P001)", () => {
    refusal.on = true;
    renderPanel();
    chooseAndConfirmClose();
    expect(screen.getByRole("heading", { name: `Close ${UNIT.name} to admissions` })).toBeInTheDocument();
    expect(screen.getByTestId("ward-closure-reason")).toHaveValue("staffing");
    expect(screen.getByTestId("ward-closure-reopen-after")).toHaveValue("8");
  });

  it("clears the inputs once the ward has closed (P001)", () => {
    renderPanel();
    chooseAndConfirmClose();
    fireEvent.click(screen.getByTestId("ward-closure-reopen"));
    fireEvent.click(screen.getByRole("button", { name: `Reopen ${UNIT.name}` }));
    expect(screen.getByTestId("ward-closure-reason")).toHaveValue("");
    expect(screen.getByTestId("ward-closure-reopen-after")).toHaveValue("");
  });

  it("asks before reopening, and Cancel leaves the ward closed (P021)", () => {
    renderPanel();
    chooseAndConfirmClose();
    fireEvent.click(screen.getByTestId("ward-closure-reopen"));
    expect(screen.getByRole("dialog", { name: `Reopen ${UNIT.name} to admissions?` })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("heading", { name: `${UNIT.name} closed to admissions` })).toBeInTheDocument();
  });

  it("keeps the chosen reason after the panel is left and opened again (P086)", async () => {
    const first = renderPanel();
    fireEvent.change(screen.getByTestId("ward-closure-reason"), { target: { value: "staffing" } });
    fireEvent.change(screen.getByTestId("ward-closure-reopen-after"), { target: { value: "12" } });
    // The draft store saves after 500 ms of no change.
    await act(() => new Promise((resolve) => setTimeout(resolve, 600)));
    first.unmount();
    renderPanel();
    expect(screen.getByTestId("ward-closure-reason")).toHaveValue("staffing");
    expect(screen.getByTestId("ward-closure-reopen-after")).toHaveValue("12");
  });

  it("forgets the saved draft when both choices are put back (P086)", async () => {
    const first = renderPanel();
    fireEvent.change(screen.getByTestId("ward-closure-reason"), { target: { value: "staffing" } });
    await act(() => new Promise((resolve) => setTimeout(resolve, 600)));
    fireEvent.change(screen.getByTestId("ward-closure-reason"), { target: { value: "" } });
    await act(() => new Promise((resolve) => setTimeout(resolve, 600)));
    first.unmount();
    renderPanel();
    expect(screen.getByTestId("ward-closure-reason")).toHaveValue("");
    expect(screen.getByTestId("ward-closure-reopen-after")).toHaveValue("");
  });

  it("saves the same choices again after a close and a reopen (P086)", async () => {
    const first = renderPanel();
    chooseAndConfirmClose();
    fireEvent.click(screen.getByTestId("ward-closure-reopen"));
    fireEvent.click(screen.getByRole("button", { name: `Reopen ${UNIT.name}` }));
    fireEvent.change(screen.getByTestId("ward-closure-reason"), { target: { value: "staffing" } });
    fireEvent.change(screen.getByTestId("ward-closure-reopen-after"), { target: { value: "8" } });
    await act(() => new Promise((resolve) => setTimeout(resolve, 600)));
    first.unmount();
    renderPanel();
    expect(screen.getByTestId("ward-closure-reason")).toHaveValue("staffing");
    expect(screen.getByTestId("ward-closure-reopen-after")).toHaveValue("8");
  });
});
