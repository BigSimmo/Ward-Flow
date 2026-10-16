import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ToastInput } from "@/components/wf";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
const event = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "ward-test" } as const;
const acceptedRecord = {
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
function Harness({
  dispatch,
  push,
}: {
  dispatch: (event: WardFlowEvent) => Promise<WardCommandOutcome>;
  push: (toast: ToastInput) => string;
}) {
  const { run } = useUndoableStep({ dispatch, now: 642, routeRole: "coordinator", rejections: [], toast: { push } });
  return (
    <button
      onClick={() =>
        run(event, {
          success: "Confirmed step",
          undo: () => ({ type: "UNDO_REFER_TO_UNITS", role: "coordinator", now: 642, movementId: "WF-030" }),
        })
      }
    >
      Record
    </button>
  );
}
describe("confirmed feedback", () => {
  it.each(["accepted", "refused", "failed", "cancelled"] as const)(
    "has no success or Undo before %s",
    async (status) => {
      let finish!: (value: WardCommandOutcome) => void;
      const completion = new Promise<WardCommandOutcome>((resolve) => {
        finish = resolve;
      });
      const push = vi.fn<(input: ToastInput) => string>(() => "toast");
      render(<Harness dispatch={() => completion} push={push} />);
      fireEvent.click(screen.getByText("Record"));
      expect(push).not.toHaveBeenCalled();
      await act(async () => {
        finish({ commandId: "mine", status, message: "Review the board", undoRecords: [acceptedRecord] });
        await completion;
      });
      expect(push).toHaveBeenCalledTimes(1);
      expect(push.mock.calls[0]![0]).toMatchObject(
        status === "accepted"
          ? { tone: "success", title: "Confirmed step", undo: expect.anything() }
          : { tone: "warning" },
      );
      if (status !== "accepted") expect(push.mock.calls[0]![0]).not.toHaveProperty("undo");
    },
  );
});

it("pins each Undo to the sequence in its own accepted command snapshot", async () => {
  let sequence = 10;
  const dispatch = vi.fn<(event: WardFlowEvent) => Promise<WardCommandOutcome>>(async () => ({
    commandId: `command-${sequence}`,
    status: "accepted" as const,
    undoRecords: [
      {
        kind: "step" as const,
        undoType: "UNDO_REFER_TO_UNITS" as const,
        action: "REFER_TO_UNITS" as const,
        subjectId: "WF-030",
        at: 642,
        seq: sequence++,
        role: "coordinator" as const,
        unitId: null,
        changes: [],
      },
    ],
  }));
  const push = vi.fn<(input: ToastInput) => string>(() => "toast");
  render(<Harness dispatch={dispatch} push={push} />);
  await act(async () => {
    fireEvent.click(screen.getByText("Record"));
  });
  await act(async () => {
    fireEvent.click(screen.getByText("Record"));
  });
  const firstUndo = push.mock.calls[0]![0].undo!;
  await act(async () => {
    firstUndo.onUndo();
  });
  expect(dispatch.mock.calls[2]?.[0]).toMatchObject({ type: "UNDO_REFER_TO_UNITS", recordSeq: 10 });
});

it("refuses a stale accepted toast's Undo after the command lifetime ends", async () => {
  let current = true;
  const dispatch = vi.fn<(event: WardFlowEvent) => Promise<WardCommandOutcome>>(async () => ({
    commandId: "accepted",
    status: "accepted" as const,
    undoRecords: [acceptedRecord],
    isCurrent: () => current,
  }));
  const push = vi.fn<(input: ToastInput) => string>(() => "toast");
  render(<Harness dispatch={dispatch} push={push} />);
  await act(async () => {
    fireEvent.click(screen.getByText("Record"));
  });
  const undo = push.mock.calls[0]![0].undo!;
  current = false;
  await act(async () => {
    undo.onUndo();
  });
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(push.mock.calls[1]![0]).toMatchObject({
    tone: "warning",
    title: expect.stringContaining("workspace or working role changed"),
  });
});

it("does not attach a later record to an accepted step that has no fresh Undo record", async () => {
  const dispatch = vi.fn<(event: WardFlowEvent) => Promise<WardCommandOutcome>>(async () => ({
    commandId: "accepted-no-op",
    status: "accepted" as const,
    undoRecords: [],
  }));
  const push = vi.fn<(input: ToastInput) => string>(() => "toast");
  render(<Harness dispatch={dispatch} push={push} />);
  await act(async () => {
    fireEvent.click(screen.getByText("Record"));
  });
  expect(push.mock.calls[0]![0]).toMatchObject({
    title: "Confirmed step",
    body: "No Undo record is available for this step.",
  });
  expect(push.mock.calls[0]![0]).not.toHaveProperty("undo");
});
