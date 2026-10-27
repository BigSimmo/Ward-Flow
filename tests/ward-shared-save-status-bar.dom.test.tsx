import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { WardSharedSaveContext } from "@/components/ward-management/shell/ward-shared-save-context";
import { WardSharedSaveStatus } from "@/components/ward-management/ward-shared-save-status";
import type { WardSharedConnection } from "@/components/ward-management/ward-shared-access";

// Josh, 27 Oct 2026: the account strip above the shared board showed as bare text with no gap
// before Sign out, and pushed the shell's bottom edge off the window.
const connection = (status: string) =>
  ({ status, retry: () => {}, signOut: () => {} }) as unknown as WardSharedConnection;

it("draws the account strip as a styled row that says its state", () => {
  const { rerender } = render(<WardSharedSaveStatus deskLabel="Coordinator" connection={connection("ready")} />);
  const bar = screen.getByTestId("ward-shared-status-bar");
  expect(bar.className).not.toBe("");
  expect(bar).toHaveAttribute("data-state", "ready");
  // The desk line and Sign out are separate pieces, not one run of text.
  expect(screen.getByText("Coordinator · shared synthetic workspace")).not.toBe(bar);
  expect(screen.getByRole("button", { name: "Sign out" }).className).not.toBe("");
  rerender(<WardSharedSaveStatus deskLabel="Coordinator" connection={connection("saving")} />);
  expect(bar).toHaveAttribute("data-state", "saving");
});

it("gives its height to the shell while shown and takes it back when gone", () => {
  const root = document.documentElement;
  const { unmount } = render(<WardSharedSaveStatus deskLabel="Coordinator" connection={connection("ready")} />);
  expect(root.style.getPropertyValue("--wf-data-bar-height")).toMatch(/^\d+px$/u);
  unmount();
  expect(root.style.getPropertyValue("--wf-data-bar-height")).toBe("");
});

it("keeps the reload warning in the strip when a save is unconfirmed", () => {
  render(
    <WardSharedSaveContext.Provider
      value={{ unconfirmedSave: true, status: "unavailable", error: null, retry: () => {} }}
    >
      <WardSharedSaveStatus deskLabel="Coordinator" connection={connection("unavailable")} />
    </WardSharedSaveContext.Provider>,
  );
  expect(screen.getByTestId("ward-shared-status-bar")).toHaveTextContent(/Reloading now will lose/u);
});
