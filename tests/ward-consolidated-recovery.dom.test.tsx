import React from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useReferralCommandCompletion } from "@/components/ward-management/referrals/use-referral-command-completion";
import {
  clearReferralDraftSession,
  referralDraftSessionVersion,
} from "@/components/ward-management/referrals/referral-draft-cache";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { Referral } from "@/components/ward-management/ward-model";
import type { ReferralIntakeDetails } from "@/components/ward-management/referrals/referral-submission";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
const recoveryId = "12345678-1234-4234-8234-123456789abc";
const intake = { referrer: { name: "Synthetic sender" } } as ReferralIntakeDetails;
const event = { type: "RECEIVE_REFERRAL", role: "ed", now: NOW_ANCHOR, intake } as Extract<
  WardFlowEvent,
  { type: "RECEIVE_REFERRAL" }
> & { intake: ReferralIntakeDetails };
function deferred() {
  let resolve!: (value: WardCommandOutcome) => void;
  const promise = new Promise<WardCommandOutcome>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
afterEach(() => {
  cleanup();
  clearReferralDraftSession();
});
it.each(["before result", "after uncertainty"])("retains the original task across close/reopen %s", async (when) => {
  const original = deferred();
  const confirmation = deferred();
  const dispatch = vi.fn(() => original.promise);
  const onCommitted = vi.fn();
  const onAccepted = vi.fn();
  const onError = vi.fn();
  const owner = referralDraftSessionVersion();
  const open = () =>
    renderHook(
      ({ referrals }: { referrals: Referral[] }) => {
        const [pending, setPending] = React.useState(false);
        return {
          pending,
          ...useReferralCommandCompletion({
            dispatch,
            referrals,
            generation: 1,
            draftOwnerVersion: owner,
            recoveryId,
            setPending,
            onCommitted,
            onAccepted,
            onError,
          }),
        };
      },
      { initialProps: { referrals: [] as Referral[] } },
    );
  const first = open();
  act(() => first.result.current.submitReferral(event));
  if (when === "after uncertainty")
    await act(async () =>
      original.resolve({ commandId: "original", status: "failed", confirmation: confirmation.promise }),
    );
  first.unmount();
  const second = open();
  expect(second.result.current.pending).toBe(true);
  act(() => second.result.current.submitReferral(event));
  expect(dispatch).toHaveBeenCalledTimes(1);
  await act(async () =>
    (when === "before result" ? original : confirmation).resolve({ commandId: "original", status: "accepted" }),
  );
  expect(onCommitted).toHaveBeenCalledTimes(1);
  expect(second.result.current.submissionAwaitingRecord).toBe(true);
  const record = { id: "RF-SYNTHETIC", submissionId: recoveryId, intake } as Referral;
  second.rerender({ referrals: [record] });
  expect(onAccepted).toHaveBeenCalledExactlyOnceWith(record, intake);
});
it("reconciles a restored identity from the authoritative snapshot without another Send", () => {
  const dispatch = vi.fn();
  const onCommitted = vi.fn();
  const onAccepted = vi.fn();
  const record = { id: "RF-SYNTHETIC", submissionId: recoveryId, intake } as Referral;
  renderHook(() =>
    useReferralCommandCompletion({
      dispatch,
      referrals: [record],
      generation: 1,
      draftOwnerVersion: referralDraftSessionVersion(),
      recoveryId,
      setPending: vi.fn(),
      onCommitted,
      onAccepted,
      onError: vi.fn(),
    }),
  );
  expect(dispatch).not.toHaveBeenCalled();
  expect(onCommitted).toHaveBeenCalledTimes(1);
  expect(onAccepted).toHaveBeenCalledTimes(1);
});

it("defers UI retirement after unmount and cannot clear a newer, separate draft", async () => {
  const original = deferred();
  const dispatch = vi.fn(() => original.promise);
  const committed = vi.fn();
  const accepted = vi.fn();
  const owner = referralDraftSessionVersion();
  const open = (id: string, onCommitted = committed) =>
    renderHook(() =>
      useReferralCommandCompletion({
        dispatch,
        referrals: [],
        generation: 1,
        draftOwnerVersion: owner,
        recoveryId: id,
        setPending: vi.fn(),
        onError: vi.fn(),
        onCommitted,
        onAccepted: accepted,
      }),
    );
  const first = open(recoveryId);
  act(() => first.result.current.submitReferral(event));
  first.unmount();
  const newerCommitted = vi.fn();
  const newer = open("22345678-1234-4234-8234-123456789abc", newerCommitted);
  await act(async () => original.resolve({ commandId: "original", status: "accepted" }));
  expect(committed).not.toHaveBeenCalled();
  expect(newerCommitted).not.toHaveBeenCalled();
  newer.unmount();
  const restored = open(recoveryId);
  expect(restored.result.current.submissionAwaitingRecord).toBe(true);
  expect(committed).toHaveBeenCalledTimes(1);
  expect(dispatch).toHaveBeenCalledTimes(1);
});

it("opens the sent referral itself from the summary rail", async () => {
  const { render, screen } = await import("@testing-library/react");
  const { ReferralSummaryRail } = await import("@/components/ward-management/referrals/ward-referral-drawer-rail");
  const { referralBoardHref } = await import("@/components/ward-management/ed/ed-bed-search-step");
  type Drawer = import("@/components/ward-management/referrals/use-ward-referral-drawer-state").WardReferralDrawerState;
  const s = { sentReferralId: "RF-999", sectionIds: [], needed: {}, onClose: vi.fn() } as unknown as Drawer;
  render(<ReferralSummaryRail s={s} alreadyOpen={undefined} />);
  expect(screen.getByRole("link", { name: "Open Referrals board" })).toHaveAttribute(
    "href",
    referralBoardHref("RF-999"),
  );
});
