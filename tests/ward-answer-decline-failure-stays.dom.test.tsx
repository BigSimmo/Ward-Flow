import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { WardAnswerView } from "@/components/ward-management/ward/ward-answer-view";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Audit A-2 (26 Oct 2026): a decline that did not save was said only in a toast that closed after
 * 3.5 seconds. The words now stay beside the request until the next try. Synthetic records only.
 */
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function WithDispatch({ dispatch, children }: { dispatch: WardCommandDispatch; children: ReactNode }) {
  const state = useWardFlow();
  return <WardFlowOverride value={{ ...state, dispatch }}>{children}</WardFlowOverride>;
}

describe("Ward answer decline failure (A-2)", () => {
  it("keeps the failure beside the request after the toast has gone, and clears it on the next try", async () => {
    const dispatch = vi
      .fn<WardCommandDispatch>()
      .mockReturnValueOnce({ commandId: "first", status: "failed" })
      .mockReturnValue({ commandId: "retry", status: "accepted" });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WithDispatch dispatch={dispatch}>
          <WardAnswerView unitId="fsh-older-adult" />
        </WithDispatch>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-decline-toggle-WF-002"));
    const form = screen.getByTestId("ward-decline-form-WF-002");
    fireEvent.click(within(form).getByRole("radio", { name: "Capability mismatch" }));
    vi.useFakeTimers();
    await act(async () => fireEvent.submit(form));
    const failure = screen.getByTestId("ward-decline-failure-WF-002");
    expect(failure).toHaveTextContent("Decline was not confirmed");
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.queryByTestId("ward-answer-toast")).toBeNull();
    expect(screen.getByTestId("ward-decline-failure-WF-002")).toHaveTextContent("Decline was not confirmed");
    await act(async () => fireEvent.submit(screen.getByTestId("ward-decline-form-WF-002")));
    expect(screen.queryByTestId("ward-decline-failure-WF-002")).toBeNull();
  });
});
