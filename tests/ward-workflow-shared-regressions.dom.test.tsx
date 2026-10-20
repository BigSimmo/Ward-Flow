import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { ToastInput } from "@/components/wf";

afterEach(cleanup);

describe("scoped command Undo completion", () => {
  it.each(["own", "other-subject", "no-op", "stale"])("uses only this command's fresh metadata (%s)", async (kind) => {
    const push = vi.fn<(toast: ToastInput) => string>(() => "toast");
    const dispatch = vi.fn<(event: WardFlowEvent) => Promise<WardCommandOutcome>>(async () => ({
      commandId: "own-command",
      status: "accepted",
      undoRecords: [],
      isCurrent: () => kind !== "stale",
      ...(kind === "no-op"
        ? {}
        : {
            undoStep: {
              undoType: "UNDO_ED_STEP",
              subjectId: kind === "other-subject" ? "WF-other" : "WF-own",
              seq: 87,
            },
          }),
    }));
    function Harness() {
      const { run } = useUndoableStep({ dispatch, rejections: [], now: 642, routeRole: "ed", toast: { push } });
      return (
        <button
          onClick={() =>
            run(
              { type: "RECORD_ARRIVED_IN_DEPARTMENT", role: "ed", now: 642, referralId: "WF-own" },
              {
                success: "Arrival recorded",
                undo: () => ({ type: "UNDO_ED_STEP", role: "ed", now: 642, referralId: "WF-own" }),
              },
            )
          }
        >
          Record
        </button>
      );
    }
    render(<Harness />);
    await act(async () => {
      fireEvent.click(screen.getByText("Record"));
    });
    if (kind === "stale") {
      expect(push).not.toHaveBeenCalled();
      return;
    }
    expect(push).toHaveBeenCalledTimes(1);
    const toast = push.mock.calls[0]![0];
    if (kind !== "own") {
      expect(toast.undo).toBeUndefined();
      return;
    }
    expect(toast.undo).toBeDefined();
    await act(async () => {
      toast.undo!.onUndo();
    });
    expect(dispatch.mock.calls[1]![0]).toMatchObject({ type: "UNDO_ED_STEP", referralId: "WF-own", recordSeq: 87 });
  });
});
