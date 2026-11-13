import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/alerts",
  useRouter: () => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

import { ToastProvider, useToast } from "@/components/wf";
import { AlertArrivedAtWard } from "@/components/ward-management/alerts/alert-arrived-at-ward";
import { bedPulledToast } from "@/components/ward-management/ward/ward-undo-toast";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { UNDO_WINDOW_MINUTES } from "@/components/ward-management/ward-operational-defaults";

/*
 * Merge checklist C item 6 (F-49, D-187, Josh 13 Nov 2026): a toast that says "Undo within 5 min"
 * keeps its Undo on screen for the whole 5 minutes, not the old 8 or 10 seconds, then closes.
 * `ward-fix-Z-undo-window` proves this for the shared undo step and the archive panel; this file
 * proves it for the two toasts with their own windows: "Arrived at ward" and the Ward page's bed
 * pull. Synthetic seed data only.
 */
const WINDOW_MS = UNDO_WINDOW_MINUTES * 60_000;
const NOW = NOW_ANCHOR;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function theToast() {
  return screen.getByTestId("toast");
}

function undoButton() {
  return within(theToast()).getByRole("button", { name: "Undo" });
}

/** Runs the clock, letting the toast's own timers and React's updates settle. */
async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

/** Still open with a live Undo just before the window ends, then gone just after it. */
async function expectOpenForTheWholeWindow() {
  // D-192 ruling 3: one clock time ("Undo until 10:47") in place of "Undo within 5 min".
  expect(theToast()).toHaveTextContent(/Undo until \d{2}:\d{2}/u);
  // Well past the old 8 s and 10 s toasts.
  await advance(10_000);
  expect(undoButton()).not.toHaveAttribute("aria-disabled");
  await advance(WINDOW_MS - 10_000 - 1000);
  expect(theToast()).toBeInTheDocument();
  expect(undoButton()).not.toHaveAttribute("aria-disabled");
  await advance(2000);
  expect(screen.queryByTestId("toast")).toBeNull();
}

function pulledNoTransportSteps() {
  const seed = seedWardFlowState();
  const open = seed.movements.find(
    (candidate) =>
      candidate.referredUnitIds.length > 0 &&
      !candidate.acceptedUnitId &&
      !candidate.closure &&
      !candidate.transport &&
      (seed.units.find((unit) => unit.id === candidate.referredUnitIds[0])?.allocatable.value ?? 0) > 0,
  )!;
  const movementId = open.id;
  const unitId = open.referredUnitIds[0]!;
  const steps = [
    {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      movementId,
      unitId,
      actingUnitId: unitId,
      overrideReason: "The bed information is known to be out of date",
    },
    { type: "PULL_PATIENT", role: "ward", movementId, unitId, actingUnitId: unitId },
    { type: "RECORD_TRANSPORT_NEED", role: "ed", movementId, needed: false },
  ].map((step, index) => ({ ...step, now: NOW + index + 1 }) as unknown as WardFlowEvent);
  return { movementId, steps };
}

function ArrivedHarness({ movementId, steps }: { movementId: string; steps: WardFlowEvent[] }) {
  const { dispatch, movements } = useWardFlow();
  useEffect(() => {
    for (const step of steps) dispatch(step);
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const movement = movements.find((candidate) => candidate.id === movementId)!;
  return <AlertArrivedAtWard movement={movement} displayName="Synthetic patient" />;
}

function BedPullHarness({ onUndo }: { onUndo: () => void }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.push(bedPulledToast("Synthetic patient", undefined, onUndo, NOW))}>
      Pull bed
    </button>
  );
}

describe("F-49 (D-187): an Undo toast stays open for the 5 minutes it promises", () => {
  it("Arrived at ward keeps its toast and Undo for the whole window, then closes", async () => {
    vi.useFakeTimers();
    const { movementId, steps } = pulledNoTransportSteps();
    render(
      <WardFlowProvider initialNow={NOW + 10}>
        <ToastProvider>
          <ArrivedHarness movementId={movementId} steps={steps} />
        </ToastProvider>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Arrived at ward" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mark arrived" }));
    });
    expect(theToast()).toHaveTextContent("Synthetic patient arrived at");
    await expectOpenForTheWholeWindow();
  });

  it("the Ward page's bed pull keeps its toast and Undo for the whole window, then closes", async () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    render(
      <ToastProvider>
        <BedPullHarness onUndo={onUndo} />
      </ToastProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pull bed" }));
    });
    expect(theToast()).toHaveTextContent("Bed pulled for Synthetic patient · Undo until");
    await expectOpenForTheWholeWindow();
    expect(onUndo).not.toHaveBeenCalled();
  });

  it("the bed pull's Undo still works in the window's last seconds", async () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    render(
      <ToastProvider>
        <BedPullHarness onUndo={onUndo} />
      </ToastProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pull bed" }));
    });
    await advance(WINDOW_MS - 1000);
    fireEvent.click(undoButton());
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
