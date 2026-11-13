import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/wf";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { bedClosureReasonChoices } from "@/components/ward-management/ward-bed-closure-reason";
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
    // The choice menu is loaded on use.
    const choose = await within(toast).findByTestId("toast-choices");
    await act(async () => {
      fireEvent.click(choose);
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

  // PR #1626 review: leaving the page before the Undo's reply must not lose the chosen reason.
  it("still closes again with the reason when the page has gone before the Undo is accepted", async () => {
    let acceptUndo: (outcome: WardCommandOutcome) => void = () => {};
    const dispatch = vi
      .fn<(event: WardFlowEvent) => Promise<WardCommandOutcome>>()
      .mockResolvedValueOnce({ commandId: "close", status: "accepted", undoStep: stepRecord(3) })
      .mockImplementationOnce(() => new Promise((resolve) => (acceptUndo = resolve)))
      .mockResolvedValueOnce({ commandId: "again", status: "accepted", undoStep: stepRecord(5) });
    const view = render(
      <ToastProvider>
        <Page dispatch={dispatch} />
      </ToastProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByText("Close this bed"));
    });
    const choose = await within(screen.getByTestId("toast")).findByTestId("toast-choices");
    await act(async () => {
      fireEvent.click(choose);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "Staffing" }));
    });
    expect(dispatch).toHaveBeenCalledTimes(2);
    view.rerender(<ToastProvider>{null}</ToastProvider>);
    await act(async () => {
      acceptUndo({ commandId: "undo", status: "accepted" });
    });
    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(dispatch.mock.calls[2][0]).toMatchObject({ type: "SET_BED_CLOSED", closed: true, reason: "staffing" });
    expect(await screen.findByText(/^Bed 4 closed: Staffing\./u)).toBeInTheDocument();
  });

  // PR #1626 review: after leaving, an Undo first reported as not confirmed and then confirmed still
  // closes again with the reason.
  it("still closes again with the reason when the Undo is confirmed after an unconfirmed reply", async () => {
    let confirmUndo: (outcome: WardCommandOutcome) => void = () => {};
    let replyUndo: (outcome: WardCommandOutcome) => void = () => {};
    const confirmation = new Promise<WardCommandOutcome>((resolve) => (confirmUndo = resolve));
    const dispatch = vi
      .fn<(event: WardFlowEvent) => Promise<WardCommandOutcome>>()
      .mockResolvedValueOnce({ commandId: "close", status: "accepted", undoStep: stepRecord(3) })
      .mockImplementationOnce(() => new Promise((resolve) => (replyUndo = resolve)))
      .mockResolvedValueOnce({ commandId: "again", status: "accepted", undoStep: stepRecord(5) });
    const view = render(
      <ToastProvider>
        <Page dispatch={dispatch} />
      </ToastProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByText("Close this bed"));
    });
    const choose = await within(screen.getByTestId("toast")).findByTestId("toast-choices");
    await act(async () => {
      fireEvent.click(choose);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "Staffing" }));
    });
    view.rerender(<ToastProvider>{null}</ToastProvider>);
    await act(async () => {
      replyUndo({ commandId: "undo", status: "failed", message: "Not confirmed yet.", confirmation });
    });
    expect(dispatch).toHaveBeenCalledTimes(2);
    await act(async () => {
      confirmUndo({ commandId: "undo", status: "accepted" });
    });
    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(dispatch.mock.calls[2][0]).toMatchObject({ type: "SET_BED_CLOSED", closed: true, reason: "staffing" });
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
    const choose = await within(screen.getByTestId("toast")).findByTestId("toast-choices");
    await act(async () => {
      fireEvent.click(choose);
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
    const bed = { type: "SET_BED_CLOSED", now: 1, ...close, closed: true } as WardFlowEvent;
    const other = {
      type: "REQUEST_CAPACITY_REFRESH",
      role: "coordinator",
      now: 1,
      unitId: "ward-test",
    } as WardFlowEvent;
    expect(waitingBedKeys([null, { event: bed }, { event: bed }, { event: other }])).toEqual(["ward-test:4"]);
    expect(waitingBedKeys([])).toEqual([]);
  });

  // PR #1626 review: a bed move names the stay, not the unit, so both its beds come from the board.
  it("names both beds of a waiting bed move, and the bed an Undo of it returns to", () => {
    const stays = {
      payload: { state: { admissions: [{ id: "adm-synthetic-1", unitId: "ward-test", bedNumber: 2 }] } },
    };
    const move = {
      type: "PLACE_IN_BED",
      role: "ward",
      now: 1,
      admissionId: "adm-synthetic-1",
      bedNumber: 5,
      actingUnitId: "ward-test",
    } as WardFlowEvent;
    expect(waitingBedKeys([{ event: move }], stays).sort()).toEqual(["ward-test:2", "ward-test:5"]);
    const coordinatorMove = { ...move, actingUnitId: undefined } as WardFlowEvent;
    expect(waitingBedKeys([{ event: coordinatorMove }], stays).sort()).toEqual(["ward-test:2", "ward-test:5"]);
    const undo = { type: "UNDO_PLACE_IN_BED", role: "ward", now: 2, admissionId: "adm-synthetic-1" } as WardFlowEvent;
    expect(waitingBedKeys([{ event: undo }], stays)).toEqual(["ward-test:2"]);
    expect(waitingBedKeys([{ event: move }])).toEqual(["ward-test:5"]);
    expect(waitingBedKeys([{ event: undo }], null, stays)).toEqual([]);
    expect(waitingBedKeys([{ event: undo }], undefined, stays)).toEqual(["ward-test:2"]);
  });
});
