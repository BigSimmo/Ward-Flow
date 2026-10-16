import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { useEdInboxDecline } from "@/components/ward-management/ed/use-ed-screen-decline";
import { wardRaise } from "@/components/ward-management/ward-flow-raise";
import { REFERRAL_DECLINE_REASONS } from "@/components/ward-management/ward-model";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import type { ToastInput } from "@/components/wf";

describe("already-recorded command completions", () => {
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
