import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/wf";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { bedClosureReasonChoices } from "@/components/ward-management/ward/ward-bed-closure-reason";
import { waitingBedKeys } from "@/components/ward-management/ward-shared-pending-command";

// D-148 (Josh, 11 Nov 2026): closing a bed stays one tap with Undo, and the toast offers an optional
// reason from the ward closure list. Choosing one undoes the close and closes it again with the
// reason. Synthetic records only.
const close = { role: "ward", unitId: "ward-test", actingUnitId: "ward-test", bedNumber: 4 } as const;
const stepRecord = (seq: number) => ({
  undoType: "UNDO_BED_STEP" as const,
  subjectId: "bed:ward-test:4",
  seq,
});

function Page({ dispatch }: { dispatch: (event: WardFlowEvent) => Promise<WardCommandOutcome> }) {
  const { run } = useUndoableStep({ dispatch, now: 642, routeRole: "ward", rejections: [] });
  return (
    <button
      onClick={() =>
        run(
          { ...close, type: "SET_BED_CLOSED", now: 642, closed: true },
          {
            success: "Bed 4 closed.",
            undo: (now) => ({ type: "UNDO_BED_STEP", role: "ward", now, unitId: "ward-test", bedNumber: 4 }),
            undone: "Undone. Bed 4 is open again.",
            choices: bedClosureReasonChoices(close),
          },
        )
      }
    >
      Close this bed
    </button>
  );
}

describe("bed closure reason on the toast (D-148)", () => {
  it("closes on one tap, then a chosen reason undoes and closes again with it", async () => {
    const dispatch = vi
      .fn<(event: WardFlowEvent) => Promise<WardCommandOutcome>>()
      .mockResolvedValueOnce({ commandId: "close", status: "accepted", undoStep: stepRecord(3) })
      .mockResolvedValueOnce({ commandId: "undo", status: "accepted" })
      .mockResolvedValueOnce({ commandId: "again", status: "accepted", undoStep: stepRecord(5) });
    render(
      <ToastProvider>
        <Page dispatch={dispatch} />
      </ToastProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByText("Close this bed"));
    });
    // One tap saved it: no confirm step, and no reason was asked for.
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).not.toHaveProperty("reason");
    const toast = screen.getByTestId("toast");
    expect(within(toast).getByRole("button", { name: "Undo" })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(toast).getByTestId("toast-choices"));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "Staffing" }));
    });
    expect(dispatch.mock.calls[1][0]).toMatchObject({ type: "UNDO_BED_STEP", bedNumber: 4, recordSeq: 3 });
    expect(dispatch.mock.calls[2][0]).toMatchObject({
      type: "SET_BED_CLOSED",
      bedNumber: 4,
      closed: true,
      reason: "staffing",
    });
    const again = screen.getByTestId("toast");
    expect(again).toHaveTextContent("Bed 4 closed: Staffing.");
    // The step with its reason offers Undo as the first did, and no second reason picker.
    expect(within(again).getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(within(again).queryByTestId("toast-choices")).toBeNull();
  });

  it("does not close again when the undo is refused", async () => {
    const dispatch = vi
      .fn<(event: WardFlowEvent) => Promise<WardCommandOutcome>>()
      .mockResolvedValueOnce({ commandId: "close", status: "accepted", undoStep: stepRecord(3) })
      .mockResolvedValueOnce({ commandId: "undo", status: "refused", message: "This has changed since" });
    render(
      <ToastProvider>
        <Page dispatch={dispatch} />
      </ToastProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByText("Close this bed"));
    });
    await act(async () => {
      fireEvent.click(within(screen.getByTestId("toast")).getByTestId("toast-choices"));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "Infection outbreak" }));
    });
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("toast")).toHaveTextContent("Not recorded: This has changed since");
  });
});

// D-151: the beds a waiting save will change, for the tile's "Waiting to save" marker.
describe("waiting bed keys (D-151)", () => {
  it("names each bed a waiting save changes, once, and nothing else", () => {
    const bed = { type: "SET_BED_CLOSED", role: "ward", now: 1, ...close, closed: true } as WardFlowEvent;
    const other = {
      type: "REQUEST_CAPACITY_REFRESH",
      role: "coordinator",
      now: 1,
      unitId: "ward-test",
    } as WardFlowEvent;
    expect(waitingBedKeys([null, { event: bed }, { event: bed }, { event: other }])).toEqual(["ward-test:4"]);
    expect(waitingBedKeys([])).toEqual([]);
  });
});
