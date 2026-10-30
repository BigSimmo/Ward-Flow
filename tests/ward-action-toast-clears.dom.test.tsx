import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type ActionToast, useActionToast } from "@/components/ward-management/ward-action-toast";
import { ToastProvider } from "@/components/wf/toast-provider";

/**
 * Audit A-1 (26 Oct 2026): the ward page toast never cleared, so a saved step stayed pinned over
 * the page for the rest of the visit. A success now clears itself, and a warning stays until it is
 * closed. Since the notifications pass (30 Oct 2026) the shared toast region draws it through
 * `useActionToast`. Synthetic text only.
 */
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Page({ say }: { say: ActionToast }) {
  const setToast = useActionToast({ testId: "ward-action-toast" });
  return (
    <button type="button" onClick={() => setToast(say)}>
      Record
    </button>
  );
}

function record(say: ActionToast) {
  vi.useFakeTimers();
  render(
    <ToastProvider>
      <Page say={say} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Record" }));
  return screen.getByTestId("ward-action-toast");
}

describe("ward page action toast (A-1)", () => {
  it("clears a success by itself, marked as closing itself", () => {
    const toast = record("Synthetic step recorded.");
    expect(toast).toHaveTextContent("Synthetic step recorded.");
    expect(toast).toHaveAttribute("data-auto-dismiss", "true");
    act(() => vi.advanceTimersByTime(6_000));
    expect(screen.queryByTestId("ward-action-toast")).toBeNull();
  });

  it("keeps a warning until it is closed", () => {
    const toast = record({ warning: "Not recorded: synthetic refusal. Nothing was changed." });
    expect(toast).toHaveAttribute("data-tone", "warning");
    act(() => vi.advanceTimersByTime(60_000));
    expect(toast).toHaveTextContent("Not recorded: synthetic refusal.");
    expect(toast).not.toHaveAttribute("data-auto-dismiss");
    fireEvent.click(screen.getByRole("button", { name: /^Dismiss: Not recorded/ }));
    expect(screen.queryByTestId("ward-action-toast")).toBeNull();
  });
});
