import "@testing-library/jest-dom/vitest";
import { act, cleanup, configure, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/wf/toast-provider";
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

configure({
  getElementError: () => new Error("Capacity refresh query failed; record-bearing diagnostics suppressed."),
});
let requestRefresh: WardCommandDispatch;

function ReceiptBoundary({ children }: { children: ReactNode }) {
  const value = useWardFlow();
  const dispatch: WardCommandDispatch = (event) =>
    event.type === "REQUEST_CAPACITY_REFRESH" ? requestRefresh(event) : value.dispatch(event);
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

describe("Capacity This shift request confirmation", () => {
  it("announces no successful request before its receipt and reports a refusal", async () => {
    let resolve!: (outcome: WardCommandOutcome) => void;
    const completion = new Promise<WardCommandOutcome>((answer) => {
      resolve = answer;
    });
    requestRefresh = vi.fn<WardCommandDispatch>(() => completion);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReceiptBoundary>
          <ToastProvider>
            <CapacityScreen />
          </ToastProvider>
        </ReceiptBoundary>
      </WardFlowProvider>,
    );
    // This is the screen's ShiftChecks consumer, not the ward drawer's separate request handler.
    fireEvent.click(screen.getByRole("button", { name: /^Ask .+ to confirm its beds$/u }));
    expect(requestRefresh).toHaveBeenCalledWith(expect.objectContaining({ type: "REQUEST_CAPACITY_REFRESH" }));
    expect(/Asked .+ to confirm its beds/u.test(screen.getByTestId("toast-region").textContent ?? "")).toBe(false);
    await act(async () => {
      resolve({ commandId: "synthetic-capacity-refresh", status: "refused", message: "Synthetic refusal." });
    });
    expect(/Asked .+ to confirm its beds/u.test(screen.getByTestId("toast-region").textContent ?? "")).toBe(false);
    expect(screen.getByTestId("toast-region").textContent?.includes("Synthetic refusal.")).toBe(true);
    let confirm!: (outcome: WardCommandOutcome) => void;
    const confirmation = new Promise<WardCommandOutcome>((answer) => {
      confirm = answer;
    });
    vi.mocked(requestRefresh).mockReturnValue({
      commandId: "synthetic-capacity-retry",
      status: "failed",
      confirmation,
    });
    const ask = screen.getByRole("button", { name: /^Ask .+ to confirm its beds$/u });
    fireEvent.click(ask);
    fireEvent.click(ask);
    expect(requestRefresh).toHaveBeenCalledTimes(2);
    await act(async () => {
      confirm({ commandId: "synthetic-capacity-retry", status: "accepted" });
    });
    expect(/Asked .+ to confirm its beds/u.test(screen.getByTestId("toast-region").textContent ?? "")).toBe(true);
  });
});
