import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/wf/toast-provider";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { wardReferralInboxEntries } from "@/components/ward-management/referrals/referral-inbox";
import type { Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { useWardCommandCompletion } from "@/components/ward-management/ward/use-ward-command-completion";

function deferred() {
  let resolve!: (outcome: WardCommandOutcome) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<WardCommandOutcome>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function PendingWard({
  reply,
  undoReply,
  record,
}: {
  reply: ReturnType<typeof deferred>;
  undoReply?: ReturnType<typeof deferred>;
  record: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;
}) {
  const value = useWardFlow();
  return (
    <WardFlowOverride
      value={{
        ...value,
        dispatch: (event) => {
          if (event.type === "PLACE_IN_BED" || event.type === "UNDO_PLACE_IN_BED" || event.type === "UNDO_DEPARTURE") {
            record(event);
            return (event.type === "UNDO_PLACE_IN_BED" ? (undoReply ?? reply) : reply).promise;
          }
          return value.dispatch(event);
        },
        recordWardDeparture: (...args) => {
          record(...args);
          return reply.promise;
        },
      }}
    >
      <ToastProvider>
        <WardScreen unitId="scgh-adult-open" />
      </ToastProvider>
    </WardFlowOverride>
  );
}
function renderWard(
  reply: ReturnType<typeof deferred>,
  record = vi.fn<(...args: unknown[]) => unknown>(),
  undoReply?: ReturnType<typeof deferred>,
) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PendingWard reply={reply} record={record} undoReply={undoReply} />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByTestId("ward-open-bed-board"));
  const beds = Array.from(document.querySelectorAll<HTMLElement>("[data-testid^='ward-board-bed-']"));
  return {
    record,
    occupied: beds.find((bed) => !/free|closed|pulled/.test(bed.getAttribute("aria-label") ?? ""))!,
    free: beds.find((bed) => /, ready$/.test(bed.getAttribute("aria-label") ?? ""))!,
  };
}

function AcceptedReferralWard({
  reply,
  record,
  previousOutcome,
}: {
  reply: ReturnType<typeof deferred>;
  record: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;
  previousOutcome?: "did_not_proceed" | "arrived";
}) {
  const value = useWardFlow();
  const referral: Referral = {
    ...value.referrals[0],
    id: "WF-SYNTHETIC-CONTINUATION",
    source: "ed_medical",
    originSiteCode: "SCGH",
    intake: undefined,
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId: "scgh-adult-open",
          sex: "Female",
          gender: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "accepted",
        decidedAt: NOW_ANCHOR,
      },
    ],
  };
  return (
    <WardFlowOverride
      value={{
        ...value,
        referrals: [referral],
        movements: previousOutcome
          ? [
              ...value.movements,
              {
                ...value.movements[0],
                id: "WF-SYNTHETIC-PREVIOUS",
                referralId: referral.id,
                closure: { at: NOW_ANCHOR, outcome: previousOutcome, reason: "Synthetic outcome" },
              },
            ]
          : value.movements,
        wardReferralInbox: (unitId) => wardReferralInboxEntries([referral], unitId),
        dispatch: (event) => {
          if (event.type === "RAISE_REFERRAL") {
            record(event);
            return reply.promise;
          }
          return value.dispatch(event);
        },
      }}
    >
      <ToastProvider>
        <WardScreen unitId="scgh-adult-open" />
      </ToastProvider>
    </WardFlowOverride>
  );
}

describe("ward command feedback follows its own completion", () => {
  it.each(["did_not_proceed", "arrived"] as const)(
    "offers continuation after %s only when another journey is permitted",
    (previousOutcome) => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <AcceptedReferralWard
            reply={deferred()}
            record={vi.fn<(...args: unknown[]) => unknown>()}
            previousOutcome={previousOutcome}
          />
        </WardFlowProvider>,
      );
      fireEvent.click(screen.getByTestId("ward-open-bed-board"));
      if (previousOutcome === "did_not_proceed")
        expect(screen.getByRole("button", { name: "Start placement" })).toBeInTheDocument();
      else expect(screen.queryByRole("button", { name: "Start placement" })).not.toBeInTheDocument();
    },
  );

  it.each(["refused", "failed"] as const)(
    "keeps a pending departure open and shows %s without success or Undo",
    async (status) => {
      const reply = deferred();
      const { occupied, record } = renderWard(reply);
      fireEvent.click(occupied);
      const leave = screen.getByRole("button", { name: /^Record that they have left/ });
      // Audit 1 (CS-07): each tap asks once before it records; a second confirm still records once.
      fireEvent.click(leave);
      fireEvent.click(screen.getByRole("button", { name: "Record departure" }));
      fireEvent.click(leave);
      if (screen.queryByRole("button", { name: "Record departure" }))
        fireEvent.click(screen.getByRole("button", { name: "Record departure" }));
      expect(record).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: /^Record that they have left/ })).toBeInTheDocument();
      expect(screen.queryByText(/Recorded: .* has left the ward/)).not.toBeInTheDocument();
      await act(async () => reply.resolve({ commandId: "one", status, message: "Synthetic save refused" }));
      expect(screen.getByRole("button", { name: /^Record that they have left/ })).toBeInTheDocument();
      expect(screen.getByText(/Synthetic save refused/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Undo/ })).not.toBeInTheDocument();
    },
  );

  it("closes an accepted departure and binds its Undo to that command's opaque step", async () => {
    const reply = deferred();
    const { occupied, record } = renderWard(reply);
    fireEvent.click(occupied);
    fireEvent.click(screen.getByRole("button", { name: /^Record that they have left/ }));
    fireEvent.click(screen.getByRole("button", { name: "Record departure" }));
    const admissionId = record.mock.calls[0][0] as string;
    await act(async () =>
      reply.resolve({
        commandId: "departure",
        status: "accepted",
        undoStep: { undoType: "UNDO_DEPARTURE", subjectId: admissionId, seq: 12 },
      }),
    );
    expect(screen.queryByRole("button", { name: /^Record that they have left/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Undo/ }));
    expect(record.mock.calls[1][0]).toMatchObject({ type: "UNDO_DEPARTURE", admissionId, recordSeq: 12 });
  });

  it("offers placement success only after acceptance, suppresses repeat clicks, and waits for Undo completion", async () => {
    const reply = deferred();
    const undoReply = deferred();
    const { occupied, free, record } = renderWard(reply, vi.fn<(...args: unknown[]) => unknown>(), undoReply);
    fireEvent.click(occupied);
    fireEvent.click(screen.getByRole("button", { name: "Move to another bed" }));
    fireEvent.click(free);
    fireEvent.click(free);
    expect(record).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("ward-board-say")).not.toHaveTextContent(/^Moved/);
    expect(screen.queryByRole("button", { name: /^Undo/ })).not.toBeInTheDocument();
    await act(async () => reply.resolve({ commandId: "one", status: "accepted", isCurrent: () => true }));
    expect(screen.getByTestId("ward-board-say")).toHaveTextContent(/^Moved/);
    const toast = screen.getByTestId("toast");
    fireEvent.click(within(toast).getByRole("button", { name: /^Undo/ }));
    expect(record).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("ward-board-say")).toHaveTextContent(/^Moved/);
    await act(async () =>
      undoReply.resolve({ commandId: "undo", status: "refused", message: "Synthetic intervening admission" }),
    );
    expect(screen.getByTestId("ward-board-say")).toHaveTextContent(/Synthetic intervening admission/);
    expect(screen.getByTestId("ward-board-say")).not.toHaveTextContent(/^Undone/);
  });

  it("requires explicit legal choices for accepted direct referral continuation and preserves a refused draft", async () => {
    const reply = deferred();
    const record = vi.fn<(...args: unknown[]) => unknown>();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AcceptedReferralWard reply={reply} record={record} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-open-bed-board"));
    fireEvent.click(screen.getByRole("button", { name: "Start placement" }));
    expect(screen.getByLabelText("Legal status")).toHaveValue("");
    expect(screen.getByLabelText("Legal form")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Confirm and start placement" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Legal status"), { target: { value: "Voluntary" } });
    fireEvent.change(screen.getByLabelText("Legal form"), { target: { value: "none" } });
    fireEvent.change(screen.getByLabelText("Observation level"), { target: { value: "general" } });
    const start = screen.getByRole("button", { name: "Confirm and start placement" });
    fireEvent.click(start);
    fireEvent.click(start);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toMatchObject({
      type: "RAISE_REFERRAL",
      edId: "scgh-ed",
      acceptedUnitId: "scgh-adult-open",
      actingUnitId: "scgh-adult-open",
      referralId: "WF-SYNTHETIC-CONTINUATION",
      draft: { legalStatus: "Voluntary", legalFormCode: null },
    });
    expect(screen.queryByText(/Placement started/)).not.toBeInTheDocument();
    await act(async () =>
      reply.resolve({ commandId: "start", status: "refused", message: "Synthetic referral withdrawn" }),
    );
    expect(screen.getByRole("button", { name: "Confirm and start placement" })).toBeInTheDocument();
    expect(screen.getByText(/Synthetic referral withdrawn/)).toBeInTheDocument();
  });

  it("warns, naming both values, but still starts a placement whose legal status differs from the accepted bed need", async () => {
    // Owner ruling (Josh, 14:17 AWST 20 Oct): warn but allow.
    const reply = deferred();
    const record = vi.fn<(...args: unknown[]) => unknown>();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AcceptedReferralWard reply={reply} record={record} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-open-bed-board"));
    fireEvent.click(screen.getByRole("button", { name: "Start placement" }));
    fireEvent.change(screen.getByLabelText("Legal status"), { target: { value: "Voluntary" } });
    expect(screen.queryByTestId("ward-accepted-placement-legal-mismatch")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Legal status"), { target: { value: "Involuntary inpatient" } });
    const warning = screen.getByTestId("ward-accepted-placement-legal-mismatch");
    expect(warning).toHaveTextContent(/a voluntary bed/);
    expect(warning).toHaveTextContent(/Involuntary inpatient/);
    fireEvent.change(screen.getByLabelText("Legal form"), { target: { value: "none" } });
    fireEvent.change(screen.getByLabelText("Observation level"), { target: { value: "general" } });
    const start = screen.getByRole("button", { name: "Confirm and start placement" });
    expect(start).toBeEnabled();
    fireEvent.click(start);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toMatchObject({
      type: "RAISE_REFERRAL",
      draft: { legalStatus: "Involuntary inpatient" },
    });
    await act(async () => reply.resolve({ commandId: "start", status: "accepted", isCurrent: () => true }));
    expect(screen.getByText(/Placement started.*a voluntary bed.*Involuntary inpatient/)).toBeInTheDocument();
  });

  it("drops stale or unmounted completions and reports interrupted saves", async () => {
    const reply = deferred();
    const settled = vi.fn<(...args: unknown[]) => unknown>();
    const { result, unmount } = renderHook(useWardCommandCompletion);
    result.current("test", () => reply.promise, settled);
    await act(async () => reply.resolve({ commandId: "one", status: "accepted", isCurrent: () => false }));
    expect(settled).not.toHaveBeenCalled();
    const interrupted = deferred();
    result.current("test", () => interrupted.promise, settled);
    await act(async () => interrupted.reject(new Error("Synthetic interruption")));
    expect(settled).toHaveBeenCalledWith({ commandId: "", status: "failed" });
    settled.mockClear();
    const abandoned = deferred();
    result.current("test", () => abandoned.promise, settled);
    unmount();
    await act(async () => abandoned.resolve({ commandId: "two", status: "accepted" }));
    expect(settled).not.toHaveBeenCalled();
  });
});
