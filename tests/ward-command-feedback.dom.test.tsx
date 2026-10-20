import { WardFlowProvider, WardFlowOverride, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { SupportNotificationChecklist } from "@/components/ward-management/movements/support-notification-checklist";
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider, type ToastInput } from "@/components/wf";
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
  push?: (toast: ToastInput) => string;
}) {
  const { run } = useUndoableStep({
    dispatch,
    now: 642,
    routeRole: "coordinator",
    rejections: [],
    toast: push ? { push } : undefined,
  });
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

it.each(["retry", "expire"] as const)(
  "keeps the real blocked Undo button and its original window (%s)",
  async (next) => {
    vi.useFakeTimers();
    let ready = true;
    const dispatch = vi.fn<(event: WardFlowEvent) => Promise<WardCommandOutcome>>(async () => ({
      commandId: "accepted",
      status: "accepted",
      undoRecords: [acceptedRecord],
      isCurrent: () => true,
      canUndo: () => ready,
    }));
    const mounted = render(
      <ToastProvider>
        <Harness dispatch={dispatch} />
      </ToastProvider>,
    );
    try {
      await act(async () => {
        fireEvent.click(screen.getByText("Record"));
      });
      const undo = screen.getByRole("button", { name: "Undo" });
      const original = undo.closest('[data-testid="toast"]')!;
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      ready = false;
      await act(async () => {
        fireEvent.click(undo);
      });
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Undo" })).toBe(undo);
      expect(undo).not.toHaveAttribute("aria-disabled", "true");
      expect(original).toHaveAttribute("data-undo", "running");
      if (next === "retry") {
        ready = true;
        await act(async () => {
          fireEvent.click(undo);
        });
        expect(dispatch).toHaveBeenCalledTimes(2);
        expect(dispatch.mock.calls[1]![0]).toMatchObject({
          type: "UNDO_REFER_TO_UNITS",
          recordSeq: acceptedRecord.seq,
        });
        expect(original).not.toBeInTheDocument();
      } else {
        act(() => {
          vi.advanceTimersByTime(5999);
        });
        expect(screen.getByRole("button", { name: "Undo" })).toBe(undo);
        act(() => {
          vi.advanceTimersByTime(1);
        });
        ready = true;
        expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
        expect(original).not.toBeInTheDocument();
        expect(dispatch).toHaveBeenCalledTimes(1);
      }
    } finally {
      mounted.unmount();
      vi.useRealTimers();
    }
  },
);

it("consumes the real Undo button when the command lifetime has permanently ended", async () => {
  let current = true;
  const dispatch = vi.fn<(event: WardFlowEvent) => Promise<WardCommandOutcome>>(async () => ({
    commandId: "accepted",
    status: "accepted",
    undoRecords: [acceptedRecord],
    isCurrent: () => current,
    canUndo: () => false,
  }));
  render(
    <ToastProvider>
      <Harness dispatch={dispatch} />
    </ToastProvider>,
  );
  await act(async () => {
    fireEvent.click(screen.getByText("Record"));
  });
  current = false;
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  });
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/workspace or working role changed/)).toBeInTheDocument();
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

it("does not borrow a later provider record when this accepted command omits its own Undo records", async () => {
  let finish!: (outcome: WardCommandOutcome) => void;
  const completion = new Promise<WardCommandOutcome>((resolve) => {
    finish = resolve;
  });
  const push = vi.fn<(input: ToastInput) => string>(() => "toast");
  function LatestRecords({ records }: { records: (typeof acceptedRecord)[] }) {
    const flow = useWardFlow();
    return (
      <WardFlowOverride value={{ ...flow, undoRecords: records }}>
        <Harness dispatch={() => completion} push={push} />
      </WardFlowOverride>
    );
  }
  const view = (records: (typeof acceptedRecord)[]) => (
    <WardFlowProvider initialNow={642}>
      <LatestRecords records={records} />
    </WardFlowProvider>
  );
  const { rerender } = render(view([]));
  fireEvent.click(screen.getByText("Record"));
  rerender(view([acceptedRecord]));
  await act(async () => {
    finish({ commandId: "no-command-record", status: "accepted" });
    await completion;
  });
  expect(push.mock.calls[0]![0]).toMatchObject({
    title: "Confirmed step",
    body: "No Undo record is available for this step.",
  });
  expect(push.mock.calls[0]![0]).not.toHaveProperty("undo");
});

function ChecklistCompletionHarness({ dispatch }: { dispatch: (event: WardFlowEvent) => Promise<WardCommandOutcome> }) {
  const flow = useWardFlow();
  return (
    <WardFlowOverride value={{ ...flow, dispatch }}>
      <SupportNotificationChecklist admissionId="AD-LEFT-01" role="coordinator" />
    </WardFlowOverride>
  );
}
function pendingChecklistSave() {
  let finish!: (value: WardCommandOutcome) => void;
  const completion = new Promise<WardCommandOutcome>((resolve) => {
    finish = resolve;
  });
  const dispatch = vi.fn<(event: WardFlowEvent) => Promise<WardCommandOutcome>>(() => completion);
  render(
    <WardFlowProvider initialNow={642}>
      <ChecklistCompletionHarness dispatch={dispatch} />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Record Carer" }));
  const form = screen.getByRole("form", { name: "Record Carer" });
  fireEvent.change(within(form).getByLabelText("Who was told"), { target: { value: "Synthetic first draft" } });
  fireEvent.click(within(form).getByRole("button", { name: "Save" }));
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(dispatch.mock.calls[0]?.[0].type).toBe("RECORD_SUPPORT_NOTIFICATION");
  return {
    form,
    async settle(status: WardCommandOutcome["status"]) {
      await act(async () => {
        finish({ commandId: "mine", status, message: "Review this save" });
        await completion;
      });
    },
  };
}

describe("support notification editing lifetime", () => {
  it.each(["another party", "same party", "edited current draft"] as const)(
    "keeps the %s when an earlier save is accepted",
    async (replacement) => {
      const pending = pendingChecklistSave();
      const party = replacement === "another party" ? "Personal support person" : "Carer";
      if (replacement !== "edited current draft") {
        fireEvent.click(within(pending.form).getByRole("button", { name: "Cancel" }));
        fireEvent.click(screen.getByRole("button", { name: `Record ${party}` }));
      }
      const current = screen.getByRole("form", { name: `Record ${party}` });
      fireEvent.change(within(current).getByLabelText("Who was told"), {
        target: { value: "Synthetic current draft" },
      });
      await pending.settle("accepted");
      expect(screen.getByRole("form", { name: `Record ${party}` })).toBeInTheDocument();
      expect(within(current).getByLabelText("Who was told")).toHaveValue("Synthetic current draft");
    },
  );
  it.each(["accepted", "refused", "failed"] as const)(
    "closes the unchanged submitting form only when %s",
    async (status) => {
      const pending = pendingChecklistSave();
      await pending.settle(status);
      if (status === "accepted") expect(screen.queryByRole("form", { name: "Record Carer" })).not.toBeInTheDocument();
      else expect(screen.getByRole("form", { name: "Record Carer" })).toBeInTheDocument();
    },
  );
});
