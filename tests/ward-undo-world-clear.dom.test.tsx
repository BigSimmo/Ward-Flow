import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WardUndoWorldClear } from "@/components/ward-management/demo-reset/ward-undo-world-clear";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider, useToast } from "@/components/wf/toast-provider";

/* Live walk 16 Nov 2026: Reset demo clears any Undo offer still waiting. Synthetic demo data only. */
function Controls({ onUndo }: { onUndo: () => void }) {
  const { dispatch, now, worldGeneration } = useWardFlow();
  const toast = useToast();
  return (
    <>
      <output data-testid="generation">{worldGeneration}</output>
      <button
        type="button"
        onClick={() =>
          toast.push({ tone: "success", title: "Synthetic step done", undo: { durationMs: 60_000, onUndo } })
        }
      >
        push undo
      </button>
      <button type="button" onClick={() => toast.push({ tone: "info", title: "Plain note", duration: 0 })}>
        push plain
      </button>
      <button type="button" onClick={() => dispatch({ type: "RESET_SCENARIO", role: "demo", now })}>
        reset
      </button>
    </>
  );
}

describe("WardUndoWorldClear", () => {
  it("closes a waiting Undo toast when the demo is reset, and leaves other toasts", () => {
    const onUndo = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <WardUndoWorldClear />
          <Controls onUndo={onUndo} />
        </ToastProvider>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "push undo" }));
    fireEvent.click(screen.getByRole("button", { name: "push plain" }));
    expect(screen.getByText("Synthetic step done")).toBeInTheDocument();
    const before = screen.getByTestId("generation").textContent;
    fireEvent.click(screen.getByRole("button", { name: "reset" }));
    expect(screen.getByTestId("generation").textContent).not.toBe(before);
    expect(screen.queryByText("Synthetic step done")).not.toBeInTheDocument();
    expect(screen.getByText("Plain note")).toBeInTheDocument();
    expect(onUndo).not.toHaveBeenCalled();
  });
});
