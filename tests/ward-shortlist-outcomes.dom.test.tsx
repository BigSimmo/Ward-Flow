import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { ESCALATION_CONTACTS, CANCEL_TRANSPORT_REASONS } from "@/components/ward-management/ward-change-reasons";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Movement } from "@/components/ward-management/ward-model";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
const state = seedWardFlowState();
function activeBooking() {
  const job = state.movements.find(
    (row) =>
      row.transport &&
      row.transport.cancelledAt === undefined &&
      row.transport.collectedAt === undefined &&
      row.transport.arrivedAt === undefined,
  )?.transport;
  if (!job) throw new Error("The seed must contain a transport booking before collection.");
  return job;
}
function panel(movement: Movement, dispatch: () => Promise<WardCommandOutcome>) {
  return render(
    <ShortlistPanel
      movement={movement}
      now={NOW_ANCHOR}
      units={state.units}
      bedReleases={state.bedReleases}
      leaveBeds={state.leaveBeds}
      admissions={state.admissions}
      referrals={state.referrals}
      selectedUnitId={undefined}
      onSelectUnit={() => {}}
      dispatch={dispatch}
      parallelReferralCap={state.configuration.parallelReferralCap}
    />,
  );
}
function pending() {
  let finish!: (value: WardCommandOutcome) => void;
  const promise = new Promise<WardCommandOutcome>((resolve) => {
    finish = resolve;
  });
  return { promise, finish };
}
describe("shortlist confirmed outcomes", () => {
  it("explains why Release is disabled while the transport booking is active", () => {
    const base = state.movements.find((row) => row.stage === "pulled")!;
    panel({ ...base, transport: { ...activeBooking() } }, vi.fn());
    expect((screen.getByTestId("ward-release-pull-toggle") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Cancel the active transport booking before releasing the pulled bed.")).toBeTruthy();
  });
  it.each(["accepted", "refused"] as const)("reports only the confirmed escalation %s", async (status) => {
    const result = pending();
    const dispatch = vi.fn(() => result.promise);
    panel(
      state.movements.find((row) => row.id === "WF-308")!,
      dispatch,
    );
    fireEvent.click(screen.getByTestId("ward-shortlist-escalation-toggle"));
    fireEvent.change(screen.getByTestId("ward-shortlist-escalation-contact"), {
      target: { value: ESCALATION_CONTACTS[0] },
    });
    fireEvent.click(screen.getByTestId("ward-shortlist-escalation-submit"));
    expect(screen.queryByText("Escalation recorded.")).toBeNull();
    await act(async () => {
      result.finish({ commandId: "mine", status, message: "This escalation was refused." });
      await result.promise;
    });
    expect(screen.getByRole("status").textContent).toContain(
      status === "accepted" ? "Escalation recorded." : "This escalation was refused.",
    );
  });
  it("reports a refused cancellation at the form's own surface", async () => {
    const result = pending();
    const base = state.movements.find((row) => row.stage === "pulled")!;
    panel(
      {
        ...base,
        transport: {
          ...activeBooking(),
        },
      },
      () => result.promise,
    );
    fireEvent.click(screen.getByTestId("ward-cancel-transport-toggle"));
    fireEvent.change(screen.getByLabelText(/Reason for cancelling transport/), {
      target: { value: CANCEL_TRANSPORT_REASONS[0] },
    });
    fireEvent.submit(screen.getByTestId("ward-cancel-transport"));
    await act(async () => {
      result.finish({ commandId: "mine", status: "refused", message: "Transport changed. Review the booking." });
      await result.promise;
    });
    expect(screen.getByRole("status").textContent).toContain("Transport changed. Review the booking.");
  });
});
