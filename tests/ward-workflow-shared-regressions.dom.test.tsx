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

import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { WardFlowProvider, WardFlowOverride, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { useWardReferralDrawerState } from "@/components/ward-management/referrals/use-ward-referral-drawer-state";
import {
  clearReferralDraftSession,
  keepReferralDraft,
  readKeptReferralDraft,
  discardReferralDraft,
} from "@/components/ward-management/referrals/referral-draft-store";

afterEach(() => discardReferralDraft());

describe("referral submission completion", () => {
  it.each(["accepted", "refused", "failed", "stale", "rejected", "missing-id"] as const)(
    "settles own %s result and preserves unconfirmed drafts",
    async (status) => {
      let finish!: (outcome: WardCommandOutcome) => void;
      let fail!: () => void;
      const completion = new Promise<WardCommandOutcome>((resolve, reject) => {
        finish = resolve;
        fail = () => reject(new Error("Mock connection lost"));
      });
      const dispatch = vi.fn(() => completion);
      function Override({ children }: { children: ReactNode }) {
        const flow = useWardFlow();
        return <WardFlowOverride value={{ ...flow, dispatch }}>{children}</WardFlowOverride>;
      }
      function Wrapper({ children }: { children: ReactNode }) {
        return (
          <WardFlowProvider initialNow={642}>
            <Override>{children}</Override>
          </WardFlowProvider>
        );
      }
      const { result } = renderHook(
        () =>
          useWardReferralDrawerState({
            onClose: () => {},
            initialCategory: "ed",
            initialDestination: "community",
            view: "new",
            onViewChange: () => {},
            onRestart: () => {},
          }),
        { wrapper: Wrapper },
      );
      act(() => {
        const s = result.current;
        s.setUnidentified("Synthetic unregistered adult");
        s.setAgeBand("Adult");
        s.setCatchmentConfirmed(true);
        s.setCatchmentTeam("Inner City Clinic");
        s.setCatchmentService("East Metro");
        s.setHomeRegion("Perth Metropolitan");
        s.setOriginSiteCode("RPH");
        s.setUrgency("2");
        s.setSelectedRecipient("Inner City Clinic");
        s.setDocumentation({
          medical: "yes",
          triage: "yes",
          additional: "no",
          expectedAt: "",
          contactName: "",
          contactPhone: "",
          charts: ["medication", "observation"].map((kind) => ({
            kind: kind as "medication" | "observation",
            name: `${kind}.pdf`,
            mimeType: "application/pdf",
            sizeBytes: 4,
            base64: "JVBERg==",
          })),
        });
        s.setContact({
          name: "Demo Sender",
          phone: "0412345678",
          email: "demo@example.com",
          role: "Nurse",
          location: "Demo ED",
        });
      });
      const draft = result.current.draftNow;
      keepReferralDraft(draft);
      act(() => {
        result.current.confirmAndSend({ preventDefault() {} } as React.FormEvent);
        result.current.confirmAndSend({ preventDefault() {} } as React.FormEvent);
      });
      expect(result.current.flowError).toBeNull();
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(result.current.sendPending).toBe(true);
      expect(result.current.sentReferralId).toBeNull();
      expect(readKeptReferralDraft()).toBe(draft);
      const replacement = { newAccountDraft: true };
      if (status === "stale") {
        clearReferralDraftSession();
        keepReferralDraft(replacement);
      }
      await act(async () => {
        if (status === "rejected") fail();
        else
          finish({
            commandId: "own-referral",
            status: status === "stale" || status === "missing-id" ? "accepted" : status,
            ...(status === "missing-id" ? {} : { createdReferralId: "RF-own-created" }),
            message: status === "accepted" || status === "missing-id" ? undefined : "Review this referral",
            isCurrent: () => status !== "stale",
          });
        await completion.catch(() => {});
      });
      expect(result.current.sendPending).toBe(false);
      if (status === "accepted") {
        expect(result.current.sentReferralId).toBe("RF-own-created");
        expect(readKeptReferralDraft()).toBeNull();
      } else {
        expect(result.current.sentReferralId).toBeNull();
        expect(readKeptReferralDraft()).toBe(status === "stale" ? replacement : draft);
        if (status === "rejected" || status === "missing-id")
          expect(result.current.flowError).toMatch(/save is not confirmed/i);
        else if (status !== "stale") expect(result.current.flowError).toBe("Review this referral");
      }
    },
  );
});
