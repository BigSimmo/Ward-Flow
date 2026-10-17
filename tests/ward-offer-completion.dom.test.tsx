import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { useEdInboxDecline } from "@/components/ward-management/ed/use-ed-screen-decline";
import { wardRaise } from "@/components/ward-management/ward-flow-raise";
import { REFERRAL_DECLINE_REASONS } from "@/components/ward-management/ward-model";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import type { ToastInput } from "@/components/wf";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";

describe("already-recorded command completions", () => {
  it("forwards its accepted completion even when an unrelated refusal arrives in the same render", () => {
    const unrelated = wardFlowReducer(seedWardFlowState(), {
      type: "ADVANCE_CLOCK",
      role: "ward",
      now: 642,
      minutes: 1,
    }).rejections;
    expect(unrelated).toHaveLength(1);
    expect(unrelated[0]!.attempted).toBe("ADVANCE_CLOCK");
    const completion: WardCommandOutcome = { commandId: "own-decline", status: "accepted" };
    const offer = vi.fn<ReturnType<typeof useUndoableStep>["offer"]>();
    function BatchedDecline() {
      const [rejections, setRejections] = useState<typeof unrelated>([]);
      const decline = useEdInboxDecline({
        rejections,
        raise: wardRaise(() => completion, "ed", 642),
        offerStep: offer,
      });
      return (
        <>
          <button onClick={() => decline.setDeclineDraft(REFERRAL_DECLINE_REASONS[0])}>Choose batched reason</button>
          <button
            onClick={() => {
              decline.submitDecline("RF-TEST");
              setRejections(unrelated);
            }}
          >
            Decline alongside another refusal
          </button>
        </>
      );
    }
    render(<BatchedDecline />);
    fireEvent.click(screen.getByText("Choose batched reason"));
    fireEvent.click(screen.getByText("Decline alongside another refusal"));
    expect(offer).toHaveBeenCalledWith(expect.objectContaining({ success: "Referral declined" }), { completion });
  });
  it.each(["accepted", "refused", "failed"] as const)(
    "waits for this ED decline's %s outcome before offering feedback",
    async (status) => {
      let finish!: (value: WardCommandOutcome) => void;
      const promise = new Promise<WardCommandOutcome>((resolve) => {
        finish = resolve;
      });
      const dispatch = vi.fn(() => promise);
      const push = vi.fn<(input: ToastInput) => string>(() => "toast");
      function Decline() {
        const { offer } = useUndoableStep({ dispatch, rejections: [], now: 642, routeRole: "ed", toast: { push } });
        const decline = useEdInboxDecline({ rejections: [], raise: wardRaise(dispatch, "ed", 642), offerStep: offer });
        return (
          <>
            <button onClick={() => decline.setDeclineDraft(REFERRAL_DECLINE_REASONS[0])}>Reason</button>
            <button onClick={() => decline.submitDecline("RF-TEST")}>Decline</button>
          </>
        );
      }
      render(<Decline />);
      fireEvent.click(screen.getByText("Reason"));
      fireEvent.click(screen.getByText("Decline"));
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(push).not.toHaveBeenCalled();
      await act(async () => {
        finish({ commandId: "decline", status, message: "Review the referral." });
        await promise;
      });
      expect(push).toHaveBeenCalledTimes(1);
      expect(push.mock.calls[0]![0].tone).toBe(status === "accepted" ? "success" : "warning");
      if (status !== "accepted") expect(push.mock.calls[0]![0]).not.toHaveProperty("undo");
    },
  );
});
