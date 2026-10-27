import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ActionToast } from "@/components/ward-management/ward-action-toast";
import { useWardPageToast, WardPageActionToast } from "@/components/ward-management/ward/ward-page-action-toast";

/**
 * Audit A-1 (26 Oct 2026): the ward page toast never cleared, so a saved step stayed pinned over
 * the page for the rest of the visit. A success now clears itself, and a warning stays until it is
 * closed. Synthetic text only.
 */
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Page({ say }: { say: ActionToast }) {
  const [toast, setToast] = useWardPageToast();
  return (
    <>
      <button type="button" onClick={() => setToast(say)}>
        Record
      </button>
      <WardPageActionToast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}

function record(say: ActionToast) {
  vi.useFakeTimers();
  render(<Page say={say} />);
  fireEvent.click(screen.getByRole("button", { name: "Record" }));
  return screen.getByTestId("ward-action-toast");
}

describe("ward page action toast (A-1)", () => {
  it("clears a success by itself, with no Close button", () => {
    const toast = record("Synthetic step recorded.");
    expect(toast).toHaveTextContent("Synthetic step recorded.");
    expect(screen.queryByTestId("ward-action-toast-close")).toBeNull();
    act(() => vi.advanceTimersByTime(6_000));
    expect(toast).toHaveTextContent(/^$/);
  });

  it("keeps a warning until it is closed", () => {
    const toast = record({ warning: "Not recorded: synthetic refusal. Nothing was changed." });
    expect(toast).toHaveAttribute("data-tone", "warning");
    act(() => vi.advanceTimersByTime(60_000));
    expect(toast).toHaveTextContent("Not recorded: synthetic refusal.");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(toast).toHaveTextContent(/^$/);
  });
});
