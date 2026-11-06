// PR #1474 review (5 Nov 2026): a confirm whose dialog code fails to load (offline) keeps editing
// and says in a toast that the question could not open. Synthetic values only.
import "@testing-library/jest-dom/vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The confirm's dialog code is fetched after the page starts; here that fetch fails.
vi.mock("@/components/wf/dialog", () => {
  throw new Error("Synthetic chunk load failure");
});

import { requestConfirm } from "@/components/wf/confirm-dialog";
import { ToastProvider } from "@/components/wf/toast-provider";

describe("a confirm whose dialog code failed to load", () => {
  it("keeps editing and says in a toast that the question could not open", async () => {
    render(
      <ToastProvider>
        <p>Synthetic page</p>
      </ToastProvider>,
    );
    // The fetch made as the page starts has failed before the question is asked.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    const confirm = vi.spyOn(window, "confirm");
    let answer: Promise<boolean> | undefined;
    act(() => {
      answer = requestConfirm({
        title: "Leave this page?",
        message: "Your synthetic note is not saved.",
        confirmLabel: "Leave without saving",
      });
    });
    await expect(answer).resolves.toBe(false);
    await waitFor(() => expect(screen.getByText("That question could not open")).toBeInTheDocument());
    expect(screen.getByText("Nothing was changed. Check the connection and try again.")).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
  });
});
