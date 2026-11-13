import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ raise: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/components/ward-management/ward-flow-raise", () => ({ useWardRaise: () => mocks.raise }));
vi.mock("@/components/ward-management/ward-flow-provider", () => ({
  useWardFlowSelect: () => ({}),
  useWardFlowClock: () => 0,
  useOptionalWardFlowSelect: () => undefined,
}));
vi.mock("@/components/ward-management/ward-role-gate", () => ({
  useRoleGate: () => () => ({ allowed: true }),
  useRouteRole: () => "coordinator",
}));
vi.mock("@/components/ward-management/ward-patient-archive", async (original) => ({
  ...(await original<object>()),
  patientArchiveProblem: () => undefined,
}));

import { ToastProvider } from "@/components/wf";
import { PatientArchivePanel } from "@/components/ward-management/patients/patient-archive-panel";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import {
  ARRIVED_AT_WARD_UNDO_TOAST_MS,
  BED_PULL_UNDO_TOAST_MS,
  UNDO_WINDOW_MINUTES,
  UNDO_WINDOW_TOAST_MS,
} from "@/components/ward-management/ward-operational-defaults";

/*
 * D-187 (F-49, Q38, Josh 13 Nov 2026): every Undo that says "Undo within 5 min" lasts those
 * 5 minutes. Before this, the message stayed only 8 seconds (10 for "Arrived at ward"). The window
 * itself (`UNDO_WINDOW_MINUTES`) is unchanged. Synthetic records only.
 */
const WINDOW_MS = UNDO_WINDOW_MINUTES * 60_000;
const event = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "ward-test" } as const;
const record = {
  kind: "step" as const,
  undoType: "UNDO_REFER_TO_UNITS" as const,
  action: "REFER_TO_UNITS" as const,
  subjectId: "WF-030",
  at: 642,
  seq: 1,
  role: "coordinator" as const,
  unitId: null,
  changes: [],
};

function Page({ dispatch }: { dispatch: (e: WardFlowEvent) => Promise<WardCommandOutcome> }) {
  const { run } = useUndoableStep({ dispatch, now: 642, routeRole: "coordinator", rejections: [] });
  return (
    <button
      onClick={() =>
        run(event, {
          success: "Referred",
          undo: () => ({ type: "UNDO_REFER_TO_UNITS", role: "coordinator", now: 642, movementId: "WF-030" }),
        })
      }
    >
      Record
    </button>
  );
}

function undoButton() {
  return within(screen.getByTestId("toast")).getByRole("button", { name: "Undo" });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("D-187 (F-49): an Undo lasts the 5 minutes its message promises", () => {
  it("every promised window is the engine's Undo window, not a few seconds", () => {
    expect(UNDO_WINDOW_TOAST_MS).toBe(WINDOW_MS);
    expect(ARRIVED_AT_WARD_UNDO_TOAST_MS).toBe(WINDOW_MS);
    expect(BED_PULL_UNDO_TOAST_MS).toBe(WINDOW_MS);
  });

  it("the shared undo step keeps Undo until the window ends, then closes", async () => {
    vi.useFakeTimers();
    const dispatch = vi
      .fn<(e: WardFlowEvent) => Promise<WardCommandOutcome>>()
      .mockResolvedValue({ commandId: "s", status: "accepted", undoRecords: [record] });
    render(
      <ToastProvider>
        <Page dispatch={dispatch} />
      </ToastProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByText("Record"));
    });
    expect(screen.getByTestId("toast")).toHaveTextContent(`Undo within ${UNDO_WINDOW_MINUTES} min.`);
    await act(async () => {
      vi.advanceTimersByTime(WINDOW_MS - 1000);
    });
    expect(undoButton()).not.toHaveAttribute("aria-disabled");
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByTestId("toast")).toBeNull();
  });

  it("archiving a record keeps its Undo for the whole window", async () => {
    vi.useFakeTimers();
    mocks.raise.mockReturnValue({
      commandId: "archive-z",
      status: "accepted",
      undoStep: { undoType: "UNDO_PATIENT_RECORD", subjectId: "PT-SYNTHETIC", seq: 3 },
    });
    render(
      <ToastProvider>
        <PatientArchivePanel patientId="PT-SYNTHETIC" displayName="Synthetic record" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getAllByRole("radio")[0]);
    fireEvent.click(screen.getByTestId("ward-patient-archive-start"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("ward-patient-archive-confirm"));
    });
    expect(screen.getByTestId("toast")).toHaveTextContent(`Undo within ${UNDO_WINDOW_MINUTES} min.`);
    await act(async () => {
      vi.advanceTimersByTime(WINDOW_MS - 1000);
    });
    expect(undoButton()).not.toHaveAttribute("aria-disabled");
    fireEvent.click(undoButton());
    expect(mocks.raise).toHaveBeenLastCalledWith("UNDO_PATIENT_RECORD", { patientId: "PT-SYNTHETIC", recordSeq: 3 });
  });
});
