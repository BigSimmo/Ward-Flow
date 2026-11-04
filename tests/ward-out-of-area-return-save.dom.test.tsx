import "@testing-library/jest-dom/vitest";
import { act, cleanup, configure, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OutOfAreaBoard } from "@/components/ward-management/out-of-area/out-of-area-board";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { outOfAreaLedger } from "@/components/ward-management/ward-referrals";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

configure({ getElementError: () => new Error("Return save query failed; record-bearing diagnostics suppressed.") });
let recordReturn: WardCommandDispatch;

function ReceiptBoundary({ children }: { children: ReactNode }) {
  const value = useWardFlow();
  const dispatch: WardCommandDispatch = (event) =>
    event.type === "RECORD_REPATRIATION" ? recordReturn(event) : value.dispatch(event);
  return (
    <WardFlowOverride value={{ ...value, dispatch, shared: { enabled: true, status: "ready", error: null } }}>
      {children}
    </WardFlowOverride>
  );
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
});

describe("Out-of-area return plan confirmation", () => {
  it("retains the return plan and avoids a recorded notice while pending or refused", async () => {
    let resolve!: (outcome: WardCommandOutcome) => void;
    const completion = new Promise<WardCommandOutcome>((answer) => {
      resolve = answer;
    });
    recordReturn = vi.fn<WardCommandDispatch>(() => completion);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReceiptBoundary>
          <OutOfAreaBoard admissions={wardAdmissions} />
        </ReceiptBoundary>
      </WardFlowProvider>,
    );
    const { entries } = outOfAreaLedger(wardAdmissions, allUnits(), NOW_ANCHOR);
    fireEvent.click(screen.getByTestId(`ward-out-of-area-row-${entries[0]!.admission.id}`));
    fireEvent.change(screen.getByTestId("ward-out-of-area-repat-home-hospital"), { target: { value: "RPH" } });
    fireEvent.click(within(screen.getByTestId("ward-out-of-area-repat-mode")).getByLabelText("Road"));
    fireEvent.click(
      within(screen.getByTestId("ward-out-of-area-repat-provider")).getByTestId(
        "ward-officer-contact-Ambulance (St John)",
      ),
    );
    fireEvent.change(screen.getByTestId("ward-out-of-area-repat-cad"), { target: { value: "CAD-7788" } });
    fireEvent.click(screen.getByLabelText("Voluntary"));
    fireEvent.change(screen.getByTestId("ward-out-of-area-repat-estimated-time"), { target: { value: "14:30" } });
    fireEvent.click(screen.getByTestId("ward-out-of-area-repat-send"));
    expect(recordReturn).toHaveBeenCalledWith(
      expect.objectContaining({ type: "RECORD_REPATRIATION", homeHospital: "RPH" }),
    );
    expect(screen.getByTestId("ward-out-of-area-repat-home-hospital")).toHaveValue("RPH");
    expect(screen.getByTestId("ward-out-of-area-repat-cad")).toHaveValue("CAD-7788");
    expect(/Return recorded for/u.test(screen.queryByTestId("ward-out-of-area-repat-notice")?.textContent ?? "")).toBe(
      false,
    );
    await act(async () => {
      resolve({ commandId: "synthetic-return", status: "refused", message: "Synthetic refusal." });
    });
    expect(screen.getByTestId("ward-out-of-area-repat-home-hospital")).toHaveValue("RPH");
    expect(screen.getByTestId("ward-out-of-area-repat-cad")).toHaveValue("CAD-7788");
    expect(/Return recorded for/u.test(screen.queryByTestId("ward-out-of-area-repat-notice")?.textContent ?? "")).toBe(
      false,
    );
    expect(screen.getByTestId("ward-out-of-area-repat-notice").textContent?.includes("Synthetic refusal.")).toBe(true);
    let confirm!: (outcome: WardCommandOutcome) => void;
    const confirmation = new Promise<WardCommandOutcome>((answer) => {
      confirm = answer;
    });
    vi.mocked(recordReturn).mockReturnValue({ commandId: "synthetic-return-retry", status: "failed", confirmation });
    fireEvent.click(screen.getByTestId("ward-out-of-area-repat-send"));
    fireEvent.click(screen.getByTestId("ward-out-of-area-repat-send"));
    expect(recordReturn).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("ward-out-of-area-repat-cad")).toHaveValue("CAD-7788");
    fireEvent.click(screen.getByTestId(`ward-out-of-area-row-${entries[1]!.admission.id}`));
    fireEvent.click(screen.getByTestId(`ward-out-of-area-row-${entries[0]!.admission.id}`));
    fireEvent.click(screen.getByTestId("ward-out-of-area-repat-send"));
    expect(recordReturn).toHaveBeenCalledTimes(2);

    await act(async () => {
      confirm({ commandId: "synthetic-return-retry", status: "accepted" });
    });
    expect(screen.getByTestId("ward-out-of-area-repat-cad")).toHaveValue("CAD-7788");
    vi.mocked(recordReturn).mockReturnValue({ commandId: "synthetic-fresh-return", status: "accepted" });
    fireEvent.click(screen.getByTestId("ward-out-of-area-repat-send"));
    expect(/Return recorded for/u.test(screen.getByTestId("ward-out-of-area-repat-notice").textContent ?? "")).toBe(
      true,
    );
  });
});
