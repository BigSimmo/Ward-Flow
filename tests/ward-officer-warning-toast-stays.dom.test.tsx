import "@testing-library/jest-dom/vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTransportCommandFeedback } from "@/components/ward-management/officer/use-transport-command-feedback";

/**
 * Audit A-3 (26 Oct 2026): the transport officer's "was not confirmed, record it again" warning
 * closed itself after 3.5 seconds. A warning now stays until it is closed or replaced (the H-0230
 * rule); a recorded step still clears itself. Synthetic records only.
 */
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("officer toast timing (A-3)", () => {
  it("keeps an unconfirmed step's warning on screen", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTransportCommandFeedback());
    await act(async () => {
      await result.current.reportOutcome(
        "WF-SYN",
        async () => ({ commandId: "c1", status: "failed" }),
        "Done.",
        "Collect",
      );
    });
    expect(result.current.toastMessage).toMatchObject({ warning: true });
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.toastMessage?.message).toContain("Collect was not confirmed");
    act(() => result.current.setToastMessage(null));
    expect(result.current.toastMessage).toBeNull();
  });

  it("clears a recorded step without Undo by itself", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTransportCommandFeedback());
    await act(async () => {
      await result.current.reportOutcome(
        "WF-SYN",
        async () => ({ commandId: "c2", status: "accepted" }),
        "Collected.",
        "Collect",
        false,
      );
    });
    expect(result.current.toastMessage?.message).toBe("Collected.");
    act(() => vi.advanceTimersByTime(4_000));
    expect(result.current.toastMessage).toBeNull();
  });
});
