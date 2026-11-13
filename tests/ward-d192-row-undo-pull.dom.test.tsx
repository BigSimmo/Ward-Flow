import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/people/WF-005",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { PatientTransitOperations } from "@/components/ward-management/patients/patient-transit-operations";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { UNDO_WINDOW_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { undoWindowUntil, untilToastTitle } from "@/components/ward-management/ward-undo-until";
import { ToastProvider } from "@/components/wf";

/*
 * D-192 (shared design parts item 4, Josh 13 Nov 2026): an Undo message names one clock time, and
 * after it has gone the card the step changed keeps a quiet "Undo pull · until 14:47" for the rest of
 * the Undo window. The window stays `UNDO_WINDOW_MINUTES`. Synthetic seed data only.
 */
afterEach(() => cleanup());

describe("the Undo window as one clock time", () => {
  it("ends the board's Undo window minutes after the step, as HH:MM", () => {
    expect(undoWindowUntil(10 * 60 + 42)).toBe(formatInstant(10 * 60 + 42 + UNDO_WINDOW_MINUTES));
    expect(undoWindowUntil(10 * 60 + 42)).toBe(`10:4${2 + UNDO_WINDOW_MINUTES}`);
  });

  it("drops a closing full stop so the kit can add ' · Undo until …'", () => {
    expect(untilToastTitle("Bed pulled for Pellingworth, Keira.")).toBe("Bed pulled for Pellingworth, Keira");
    expect(untilToastTitle("Bed pulled")).toBe("Bed pulled");
  });
});

/** The first movement waiting for its bed to be pulled, kept as the one this card shows. */
function Deck() {
  const { movements } = useWardFlow();
  const [id] = useState(
    () => movements.find((row) => row.stage === "accepted_awaiting_bed" && row.acceptedUnitId && !row.closure)?.id,
  );
  const movement = movements.find((row) => row.id === id);
  return movement ? (
    <>
      <p data-testid="stage">{movement.stage}</p>
      <PatientTransitOperations movement={movement} showMetrics={false} bare />
    </>
  ) : (
    <p>No movement to pull</p>
  );
}

/** Moves the board clock on, as the Demo panel's clock buttons do. */
function Clock() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: UNDO_WINDOW_MINUTES })}
    >
      Move the clock on
    </button>
  );
}

describe("Undo pull stays on the card for the whole window", () => {
  it("offers 'Undo pull · until HH:MM' after a pull, and it releases that pull", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Clock />
          <Deck />
        </ToastProvider>
      </WardFlowProvider>,
    );
    expect(screen.queryByText("No movement to pull")).toBeNull();
    expect(document.querySelector("[data-wf-row-undo]")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pull the bed" }));
    });
    expect(screen.getByTestId("stage")).toHaveTextContent("pulled");
    const rowUndo = document.querySelector<HTMLElement>("[data-wf-row-undo]");
    expect(rowUndo).not.toBeNull();
    expect(rowUndo).toHaveTextContent(/^Undo pull · until \d{2}:\d{2}$/u);
    // The toast names the same clock time.
    const time = rowUndo!.textContent!.slice(-5);
    const toast = screen.getAllByTestId("toast").find((candidate) => candidate.textContent?.startsWith("Bed pulled"));
    expect(toast).toHaveTextContent(`Bed pulled · Undo until ${time}`);
    expect(toast).not.toHaveTextContent("Undo within");
    await act(async () => {
      fireEvent.click(rowUndo!);
    });
    expect(screen.getByTestId("stage")).not.toHaveTextContent("pulled");
    expect(document.querySelector("[data-wf-row-undo]")).toBeNull();
  });

  it("goes once the Undo window has passed", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Clock />
          <Deck />
        </ToastProvider>
      </WardFlowProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pull the bed" }));
    });
    expect(document.querySelector("[data-wf-row-undo]")).not.toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Move the clock on" }));
    });
    expect(document.querySelector("[data-wf-row-undo]")).toBeNull();
  });
});
