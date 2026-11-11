import { act, render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clk } from "@/components/wf/format";
import { publishLiveRefresh } from "@/components/wf/live";
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
  // P061: the warning names the risk plainly and is styled apart from the status line.
  const warning = screen.getByText(
    "Not confirmed yet. Do not reload: reloading now would lose this action. Press Retry first.",
  );
  expect(warning.className).toMatch(/warning/u);
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

// Tier 1 item 4 (Josh, 4 Nov 2026): a late refresh shows on every screen, not only beside a Live chip.
it("says when the board last updated once the shared refresh is late, with Retry", () => {
  const receivedAt = Date.now() - 60_000;
  publishLiveRefresh({ unavailable: false, receivedAt, staleAfterMs: 6_000 });
  try {
    render(
      <WardSharedSaveStatus
        deskLabel="Coordinator"
        connection={{ ...connection("ready"), enabled: true, receivedAt } as unknown as WardSharedConnection}
      />,
    );
    const status = screen.getByTestId("ward-shared-status-bar");
    expect(status).toHaveTextContent(`Not updated since ${clk(receivedAt)}. Still checking every few seconds.`);
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  } finally {
    publishLiveRefresh(undefined);
  }
});

it("stays quiet while the shared refresh is on time", () => {
  const receivedAt = Date.now();
  publishLiveRefresh({ unavailable: false, receivedAt, staleAfterMs: 60_000 });
  try {
    render(
      <WardSharedSaveStatus
        deskLabel="Coordinator"
        connection={{ ...connection("ready"), enabled: true, receivedAt } as unknown as WardSharedConnection}
      />,
    );
    expect(screen.getByTestId("ward-shared-status-bar")).toHaveTextContent("Coordinator · shared synthetic workspace");
    expect(screen.queryByRole("button")).toBeNull();
  } finally {
    publishLiveRefresh(undefined);
  }
});

// Live audit item 8 (11 Nov 2026): a normal save shows a calm "Saving…" first. The full reload
// warning comes only after 8 s, while offline, or once the save has failed.
describe("a save in flight", () => {
  const saving = (overrides: Partial<WardSharedConnection> = {}) =>
    ({ ...connection("saving"), error: null, ...overrides }) as unknown as WardSharedConnection;
  const withSave = (node: React.ReactNode) => (
    <WardSharedSaveContext.Provider value={{ unconfirmedSave: true, status: "saving", error: null, retry: () => {} }}>
      {node}
    </WardSharedSaveContext.Provider>
  );

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows a calm Saving… pill, then the full warning after 8 s", () => {
    vi.useFakeTimers();
    render(withSave(<WardSharedSaveStatus deskLabel="Coordinator" connection={saving()} />));
    const status = screen.getByTestId("ward-shared-status-bar");
    expect(status).toHaveTextContent(/^Saving…$/u);
    expect(status.className).toMatch(/pill/u);
    expect(screen.queryByTestId("ward-shared-reload-warning")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(7_999);
    });
    expect(screen.queryByTestId("ward-shared-reload-warning")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("ward-shared-reload-warning")).toBeVisible();
    expect(status).toHaveTextContent("Saving shared changes… Keep this page open until the save is confirmed.");
  });

  it("warns at once while the browser is offline", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(withSave(<WardSharedSaveStatus deskLabel="Coordinator" connection={saving()} />));
    expect(screen.getByTestId("ward-shared-reload-warning")).toBeVisible();
  });

  it("warns at once when the save carries an error", () => {
    render(withSave(<WardSharedSaveStatus deskLabel="Coordinator" connection={saving({ error: "Not saved." })} />));
    expect(screen.getByTestId("ward-shared-reload-warning")).toBeVisible();
  });
});
