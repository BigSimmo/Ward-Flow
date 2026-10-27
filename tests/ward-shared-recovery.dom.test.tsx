import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhoneSheet } from "@/components/wf/phone";
import { popSheet, pushSheet, updateSheetRoot } from "@/components/wf/sheet-focus";
import { WardSharedAccess, type WardSharedConnection } from "@/components/ward-management/ward-shared-access";
import { useWardSharedSave } from "@/components/ward-management/shell/ward-shared-save-context";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";

const seed = seedWardFlowStateAt(0);
function connection(status: WardSharedConnection["status"] = "unavailable", unconfirmedSave = true) {
  return {
    enabled: true,
    signedIn: true,
    status,
    unconfirmedSave,
    error: status === "unavailable" ? "Save is not confirmed." : null,
    receivedAt: Date.now(),
    snapshot: {
      dataMode: "prototype",
      revision: 1,
      now: 642,
      payload: { version: 1, state: seed, dayZero: "2026-10-23T00:00:00Z", startedAt: "2026-10-23T10:00:00Z" },
    },
    dispatch: vi.fn(),
    retry: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    pushApi: { pushKey: vi.fn(), pushStatus: vi.fn(), pushSubscribe: vi.fn(), pushUnsubscribe: vi.fn() },
  } satisfies WardSharedConnection;
}

function Draft() {
  const save = useWardSharedSave();
  return (
    <>
      <label>
        Synthetic choice
        <input defaultValue="retained choice" />
      </label>
      <button type="button" disabled={save?.unconfirmedSave}>
        Confirm draft
      </button>
    </>
  );
}

function Harness({ shared }: { shared: WardSharedConnection }) {
  const [open, setOpen] = useState(true);
  const [nested, setNested] = useState(false);
  return (
    <WardSharedAccess connection={shared}>
      <button type="button" onClick={() => setOpen(true)}>
        Open record
      </button>
      <PhoneSheet open={open} onClose={() => setOpen(false)} title="Synthetic record">
        <Draft />
        <button type="button" onClick={() => setNested(true)}>
          Open nested sheet
        </button>
        <PhoneSheet open={nested} onClose={() => setNested(false)} title="Synthetic detail">
          <p>Details</p>
        </PhoneSheet>
      </PhoneSheet>
    </WardSharedAccess>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("shared recovery within an open sheet", () => {
  it("keeps Retry and the existing draft in the phone sheet, with one announced status", async () => {
    const shared = connection();
    render(<Harness shared={shared} />);
    const dialog = await screen.findByRole("dialog", { name: "Synthetic record" });
    const recovery = await within(dialog).findByTestId("ward-shared-recovery");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(within(recovery).getByText(/Reloading now will lose/)).toBeVisible();
    expect(within(dialog).getByRole("textbox", { name: "Synthetic choice" })).toHaveValue("retained choice");
    expect(within(dialog).getByRole("button", { name: "Confirm draft" })).toBeDisabled();
    fireEvent.click(within(recovery).getByRole("button", { name: "Retry" }));
    expect(shared.retry).toHaveBeenCalledOnce();
    const backgroundStatus = screen.getAllByRole("status", { hidden: true }).find((node) => node !== recovery)!;
    expect(backgroundStatus).toHaveAttribute("inert");
    expect(backgroundStatus).toHaveAttribute("aria-hidden", "true");
  });

  it("retains fields through retry and gives focus back to the same record after recovery", async () => {
    const shared = connection();
    const view = render(<Harness shared={shared} />);
    const dialog = await screen.findByRole("dialog", { name: "Synthetic record" });
    const retry = await within(dialog).findByRole("button", { name: "Retry" });
    retry.focus();
    expect(retry).toHaveFocus();
    view.rerender(<Harness shared={{ ...shared, status: "saving", error: null }} />);
    expect(within(dialog).getByText("Saving shared changes…")).toBeVisible();
    expect(within(dialog).queryByRole("button", { name: "Retry" })).toBeNull();
    view.rerender(<Harness shared={{ ...shared, status: "ready", error: null, unconfirmedSave: false }} />);
    await waitFor(() => expect(within(dialog).queryByTestId("ward-shared-recovery")).toBeNull());
    expect(within(dialog).getByRole("textbox", { name: "Synthetic choice" })).toHaveValue("retained choice");
    expect(within(dialog).getByRole("button", { name: "Confirm draft" })).toBeEnabled();
    expect(dialog).toHaveFocus();
  });

  it("keeps keyboard focus inside the sheet when Retry is replaced by the saving status", async () => {
    const shared = connection();
    const view = render(<Harness shared={shared} />);
    const dialog = await screen.findByRole("dialog", { name: "Synthetic record" });
    const recovery = await within(dialog).findByTestId("ward-shared-recovery");
    const retry = within(recovery).getByRole("button", { name: "Retry" });
    retry.focus();
    fireEvent.click(retry);
    expect(shared.retry).toHaveBeenCalledOnce();
    view.rerender(<Harness shared={{ ...shared, status: "saving", error: null }} />);
    expect(within(dialog).queryByRole("button", { name: "Retry" })).toBeNull();
    expect(within(dialog).getByTestId("ward-shared-recovery")).toHaveFocus();
  });

  it("moves recovery to the top nested sheet and back without dropping the outer draft", async () => {
    render(<Harness shared={connection()} />);
    const outer = await screen.findByRole("dialog", { name: "Synthetic record" });
    await within(outer).findByTestId("ward-shared-recovery");
    fireEvent.click(within(outer).getByRole("button", { name: "Open nested sheet" }));
    const inner = await screen.findByRole("dialog", { name: "Synthetic detail" });
    await within(inner).findByTestId("ward-shared-recovery");
    expect(screen.getAllByTestId("ward-shared-recovery")).toHaveLength(1);
    expect(outer.querySelector("[data-ward-shared-recovery-host]")).toBeNull();
    fireEvent.click(within(inner).getByRole("button", { name: "Close" }));
    await within(outer).findByTestId("ward-shared-recovery");
    expect(within(outer).getByRole("textbox", { name: "Synthetic choice" })).toHaveValue("retained choice");
  });

  it("keeps Retry available for failed reads without calling them unconfirmed saves", async () => {
    render(<Harness shared={{ ...connection("unavailable", false), error: "The board could not be refreshed." }} />);
    const dialog = await screen.findByRole("dialog", { name: "Synthetic record" });
    const recovery = await within(dialog).findByTestId("ward-shared-recovery");
    expect(within(recovery).getByRole("button", { name: "Retry" })).toBeVisible();
    expect(within(recovery).queryByText(/Reloading now will lose/)).toBeNull();
  });

  it("returns recovery to the page when a sheet closes and removes owned hosts on unmount", async () => {
    const view = render(<Harness shared={connection()} />);
    const dialog = await screen.findByRole("dialog", { name: "Synthetic record" });
    await within(dialog).findByTestId("ward-shared-recovery");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByTestId("ward-shared-recovery")).toBeNull());
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
    view.unmount();
    expect(document.querySelector("[data-ward-shared-recovery-host]")).toBeNull();
  });

  it("removes sheet recovery when the shared session ends", async () => {
    const shared = connection();
    const view = render(<Harness shared={shared} />);
    await screen.findByTestId("ward-shared-recovery");
    view.rerender(
      <Harness
        shared={{ ...shared, signedIn: false, snapshot: null, status: "not-authorised", unconfirmedSave: false }}
      />,
    );
    await waitFor(() => expect(document.querySelector("[data-ward-shared-recovery-host]")).toBeNull());
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  it("says it is still connecting, not failing, while a signed-in desk loads", () => {
    const shared = { ...connection("loading", false), signedIn: true, snapshot: null, error: null };
    const view = render(
      <WardSharedAccess connection={shared}>
        <p>Synthetic screen</p>
      </WardSharedAccess>,
    );
    expect(screen.getByRole("status").textContent).toBe(
      "Signed in. Connecting to the shared workspace. This can take up to 15 seconds.",
    );
    expect(screen.getByRole("main", { name: "Opening Ward Flow" }).getAttribute("aria-busy")).toBe("true");
    // #805: nothing has failed yet, so no Reconnect and no sign-in screen; Sign out stays.
    expect(screen.queryByRole("button", { name: "Reconnect" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
    view.rerender(
      <WardSharedAccess connection={{ ...shared, status: "unavailable", error: "Shared access is unavailable." }}>
        <p>Synthetic screen</p>
      </WardSharedAccess>,
    );
    expect(screen.queryByTestId("ward-shared-connecting")).toBeNull();
    expect(screen.getByRole("button", { name: "Reconnect" })).toBeVisible();
  });

  it("checks a saved sign-in neutrally, and offers Reconnect only once the wait passes the request limit", () => {
    vi.useFakeTimers();
    try {
      const shared = { ...connection("loading", false), signedIn: false, snapshot: null, error: null };
      const view = render(
        <WardSharedAccess connection={shared}>
          <p>Synthetic screen</p>
        </WardSharedAccess>,
      );
      expect(screen.getByRole("status").textContent).toBe("Checking your sign-in.");
      expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
      view.rerender(
        <WardSharedAccess connection={{ ...shared, signedIn: true }}>
          <p>Synthetic screen</p>
        </WardSharedAccess>,
      );
      act(() => vi.advanceTimersByTime(14_999));
      expect(screen.queryByRole("button", { name: "Reconnect" })).toBeNull();
      act(() => vi.advanceTimersByTime(1));
      fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
      expect(shared.retry).toHaveBeenCalledTimes(1);
      // A settled answer ends the wait; the next connection starts without Reconnect again.
      view.rerender(
        <WardSharedAccess connection={{ ...shared, status: "ready" }}>
          <p>Synthetic screen</p>
        </WardSharedAccess>,
      );
      expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
      view.rerender(
        <WardSharedAccess connection={{ ...shared, signedIn: true }}>
          <p>Synthetic screen</p>
        </WardSharedAccess>,
      );
      expect(screen.queryByRole("button", { name: "Reconnect" })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not hide the global fallback when an inline overlay inherits workspace inert", async () => {
    const root = document.createElement("div");
    root.setAttribute("inert", "");
    root.innerHTML = '<div role="dialog" aria-modal="true" tabindex="-1"></div>';
    document.body.append(root);
    try {
      act(() => pushSheet("inert-recovery-test", root));
      render(
        <WardSharedAccess connection={connection()}>
          <p>Synthetic screen</p>
        </WardSharedAccess>,
      );
      expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
      expect(root.querySelector("[data-ward-shared-recovery-host]")).toBeNull();
    } finally {
      act(() => popSheet("inert-recovery-test"));
      root.remove();
    }
  });

  it("places recovery after a late portal ref arrives", async () => {
    const root = document.createElement("div");
    root.innerHTML = '<div role="dialog" aria-modal="true" tabindex="-1"></div>';
    document.body.append(root);
    try {
      act(() => pushSheet("late-recovery-test"));
      render(
        <WardSharedAccess connection={connection()}>
          <p>Synthetic screen</p>
        </WardSharedAccess>,
      );
      expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
      act(() => updateSheetRoot("late-recovery-test", root));
      const recovery = await within(root).findByTestId("ward-shared-recovery");
      expect(within(recovery).getByRole("button", { name: "Retry" })).toBeVisible();
    } finally {
      act(() => popSheet("late-recovery-test"));
      root.remove();
    }
  });
});
