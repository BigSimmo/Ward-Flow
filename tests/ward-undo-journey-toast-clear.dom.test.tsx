// Screen audit 19 Nov 2026 (item 4a): an Undo toast for an earlier step of a journey closes, as its
// X would, once the journey records a later step or closes. Re-walk 20 Nov 2026 (fault 1): it also
// closes once the board clock passes its window, and a reset closes refused-Undo warnings. Synthetic data only.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({
  current: { worldGeneration: 0, movements: [] as unknown[], now: 0 } as {
    worldGeneration: number;
    movements: unknown[];
    now?: number;
  },
}));
vi.mock("@/components/ward-management/ward-flow-provider", () => ({
  useOptionalWardFlowSelect: () => world.current,
}));

import { WardUndoWorldClear } from "@/components/ward-management/demo-reset/ward-undo-world-clear";
import type { Movement } from "@/components/ward-management/ward-model";
import {
  forgetJourneyUndoToasts,
  noteJourneyUndoToast,
  noteUndoRefusalToast,
  noteUndoToastEnds,
} from "@/components/ward-management/ward-undo-journey-toasts";
import { ToastProvider, useToast } from "@/components/wf";

const pulled = {
  id: "WF-900",
  stage: "pulled",
  acceptedUnitId: "unit-a",
  stageChanges: [{ at: 1, to: "pulled", by: "ward" }],
} as unknown as Movement;

function PushOnce() {
  const toast = useToast();
  useEffect(() => {
    const journey = toast.push({
      tone: "success",
      title: "Bed pulled",
      undo: { durationMs: 600_000, onUndo: () => undefined },
    });
    noteJourneyUndoToast(journey, {
      type: "RELEASE_PULL",
      movementId: "WF-900",
      expectedPull: { unitId: "unit-a", stageIndex: 0 },
    });
    // An Undo for something else, which no journey step should close.
    toast.push({ tone: "success", title: "Bed closed", undo: { durationMs: 600_000, onUndo: () => undefined } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once
  }, []);
  return null;
}

function Page() {
  return (
    <ToastProvider>
      <WardUndoWorldClear />
      <PushOnce />
    </ToastProvider>
  );
}

afterEach(() => {
  cleanup();
  forgetJourneyUndoToasts();
  world.current = { worldGeneration: 0, movements: [], now: 0 };
});

/** An Undo toast whose window ends at board minute 100, a plain Undo toast, and two warnings. */
function PushTimed() {
  const toast = useToast();
  useEffect(() => {
    const pull = toast.push({
      tone: "success",
      title: "Bed pulled",
      undo: { durationMs: 600_000, until: "10:47 am", onUndo: () => undefined },
    });
    noteUndoToastEnds(pull, 100);
    toast.push({ tone: "success", title: "Bed closed", undo: { durationMs: 600_000, onUndo: () => undefined } });
    noteUndoRefusalToast(toast.push({ tone: "warning", title: "Can't undo: the time to undo has passed." }));
    toast.push({ tone: "warning", title: "Storage is full" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once
  }, []);
  return null;
}

function TimedPage() {
  return (
    <ToastProvider>
      <WardUndoWorldClear />
      <PushTimed />
    </ToastProvider>
  );
}

describe("Undo toasts once the board clock passes their window (re-walk 20 Nov 2026, fault 1)", () => {
  it("closes the Undo toast after the time it names, and keeps it until then", () => {
    world.current = { worldGeneration: 0, movements: [], now: 99 };
    const view = render(<TimedPage />);
    expect(screen.getByText(/Bed pulled/)).toBeInTheDocument();

    act(() => {
      world.current = { worldGeneration: 0, movements: [], now: 100 };
      view.rerender(<TimedPage />);
    });
    expect(screen.getByText(/Bed pulled/)).toBeInTheDocument();

    // A demo clock jump of an hour.
    act(() => {
      world.current = { worldGeneration: 0, movements: [], now: 160 };
      view.rerender(<TimedPage />);
    });
    expect(screen.queryByText(/Bed pulled/)).toBeNull();
    expect(screen.getByText(/Bed closed/)).toBeInTheDocument();
  });

  it("a reset closes the refused Undo's warning, and leaves any other warning", () => {
    world.current = { worldGeneration: 0, movements: [], now: 99 };
    const view = render(<TimedPage />);
    expect(screen.getByText(/the time to undo has passed/)).toBeInTheDocument();

    act(() => {
      world.current = { worldGeneration: 1, movements: [], now: 99 };
      view.rerender(<TimedPage />);
    });
    expect(screen.queryByText(/the time to undo has passed/)).toBeNull();
    expect(screen.queryByText(/Bed closed/)).toBeNull();
    expect(screen.getByText("Storage is full")).toBeInTheDocument();
  });
});

describe("Undo toasts of a journey that has moved on (item 4a)", () => {
  it("keeps the Undo while the pull stands, then closes only that journey's Undo once it arrives", () => {
    world.current = { worldGeneration: 0, movements: [pulled] };
    const view = render(<Page />);
    expect(screen.getByText(/Bed pulled/)).toBeInTheDocument();

    // Another journey changes: nothing closes.
    act(() => {
      world.current = { worldGeneration: 0, movements: [pulled, { ...pulled, id: "WF-901" }] };
      view.rerender(<Page />);
    });
    expect(screen.getByText(/Bed pulled/)).toBeInTheDocument();

    act(() => {
      world.current = {
        worldGeneration: 0,
        movements: [
          { ...pulled, closure: { at: 2, outcome: "arrived", reason: "Patient arrived at the accepting unit" } },
        ],
      };
      view.rerender(<Page />);
    });
    expect(screen.queryByText(/Bed pulled/)).toBeNull();
    expect(screen.getByText(/Bed closed/)).toBeInTheDocument();
  });
});
