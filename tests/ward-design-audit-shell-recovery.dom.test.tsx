import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WardRecoveryNotice } from "@/components/ward-management/shell/ward-recovery-notice";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { STORAGE_UNAVAILABLE } from "@/components/ward-management/ward-flow-demo-storage";

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

/** Renders the shell, then lets the on-demand saved-session read land and be adopted. */
async function mountShellStatus() {
  render(
    <WardFlowProvider>
      <div data-testid="shell-scroller">
        <WardRecoveryNotice />
        <main>Demonstration workspace</main>
      </div>
    </WardFlowProvider>,
  );
  await act(async () => {
    await import("@/components/ward-management/ward-flow-demo-restore");
  });
}

describe("shell recovery feedback", () => {
  it("does not add a recovery banner on a fresh demonstration", async () => {
    await mountShellStatus();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("puts the provider's complete storage warning inside the shell instead of above it", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    await mountShellStatus();
    const shell = screen.getByTestId("shell-scroller");
    expect(within(shell).getByRole("status").textContent).toBe(STORAGE_UNAVAILABLE);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});
