import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { WardAccountActions } from "@/components/ward-management/shell/ward-account-actions";
import { WardSharedSaveContext } from "@/components/ward-management/shell/ward-shared-save-context";
import { SharedSessionContext } from "@/components/ward-management/shell/ward-shared-session-context";
import { WardSharedSaveStatus } from "@/components/ward-management/ward-shared-save-status";
import type { WardSharedConnection } from "@/components/ward-management/ward-shared-access";

// Josh, 27 Oct 2026: the strip above the shared board was "pointless". It shows only when a lost
// connection or an unconfirmed save needs action; Sign out moved to the rail and phone menu.
const connection = (status: string) =>
  ({ status, retry: () => {}, signOut: () => {} }) as unknown as WardSharedConnection;

it("keeps the strip off screen while all is well, and still reads its status out", () => {
  const root = document.documentElement;
  render(<WardSharedSaveStatus deskLabel="Coordinator" connection={connection("ready")} />);
  const status = screen.getByTestId("ward-shared-status-bar");
  expect(status).toHaveTextContent("Coordinator · shared synthetic workspace");
  expect(screen.queryByRole("button")).toBeNull();
  expect(root.style.getPropertyValue("--wf-data-bar-height")).toBe("");
});

it("shows the strip with Retry when the connection is lost, and gives the shell its height", () => {
  const root = document.documentElement;
  const { unmount } = render(<WardSharedSaveStatus deskLabel="Coordinator" connection={connection("unavailable")} />);
  expect(screen.getByTestId("ward-shared-status-bar")).toHaveAttribute("data-state", "unavailable");
  expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
  expect(root.style.getPropertyValue("--wf-data-bar-height")).toMatch(/^\d+px$/u);
  unmount();
  expect(root.style.getPropertyValue("--wf-data-bar-height")).toBe("");
});

it("shows the reload warning when a save is unconfirmed", () => {
  render(
    <WardSharedSaveContext.Provider value={{ unconfirmedSave: true, status: "ready", error: null, retry: () => {} }}>
      <WardSharedSaveStatus deskLabel="Coordinator" connection={connection("ready")} />
    </WardSharedSaveContext.Provider>,
  );
  expect(screen.getByTestId("ward-shared-status-bar")).toHaveTextContent(/Reloading now will lose/u);
  expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
});

it("puts Sign out and Switch role beside the rail's links on the shared board only", () => {
  const signOut = vi.fn();
  const switchRole = vi.fn();
  const { unmount } = render(
    <SharedSessionContext.Provider
      value={{ signOut, logRecordView: () => {}, accountEmail: "synthetic.nurse@example.test", switchRole }}
    >
      <WardAccountActions className="link" />
    </SharedSessionContext.Provider>,
  );
  screen.getByRole("button", { name: "Sign out synthetic.nurse@example.test" }).click();
  expect(signOut).toHaveBeenCalledWith();
  screen.getByRole("button", { name: "Switch role" }).click();
  expect(switchRole).toHaveBeenCalled();
  unmount();
  render(<WardAccountActions className="link" />);
  expect(screen.queryByRole("button")).toBeNull();
});
