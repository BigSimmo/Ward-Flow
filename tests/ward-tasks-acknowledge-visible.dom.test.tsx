import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/wf";
import { WardTasksDrawer } from "@/components/ward-management/ward-tasks-drawer";
import { AcknowledgeVisibleButton } from "@/components/ward-management/tasks-acknowledge-visible";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { heldActionsWaiting, sendHeldActions } from "@/components/ward-management/ward-held-actions";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client-types";
import { UNDO_TOAST_MS } from "@/components/ward-management/ward-operational-defaults";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * P017 (Josh approved the wording 27 Oct 2026, 8:35 PM AWST): bulk "Acknowledge visible" in the
 * Tasks drawer asks "Acknowledge {n} alerts?" first, then says "{n} alerts acknowledged." with Undo,
 * and records nothing until the Undo window ends.
 */
const seed = seedWardFlowState();
const items = buildActionInbox(seed.movements.filter(isOpen), NOW_ANCHOR, seed.units);

function renderDrawer(dispatch: ReturnType<typeof vi.fn> = vi.fn()) {
  render(
    <ToastProvider>
      <WardTasksDrawer
        alertsScreenOpen={false}
        items={items}
        acknowledgements={{}}
        completions={{}}
        role="coordinator"
        now={NOW_ANCHOR}
        dispatch={dispatch as WardCommandDispatch}
        onClose={vi.fn()}
        onSelectMovement={vi.fn()}
      />
    </ToastProvider>,
  );
  const button = screen.getByRole("button", { name: /^Acknowledge visible/ });
  const n = Number(button.textContent?.match(/(\d+)\s*$/)?.[1]);
  return { dispatch, button, n };
}

const acks = (dispatch: ReturnType<typeof vi.fn>) =>
  dispatch.mock.calls.filter(([event]) => event.type === "ACKNOWLEDGE_INBOX_ITEM");

describe("Tasks drawer: Acknowledge visible asks first and offers Undo (P017)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("asks before acknowledging and Cancel records nothing", () => {
    const { dispatch, button, n } = renderDrawer();
    expect(n).toBeGreaterThan(1);
    fireEvent.click(button);
    expect(acks(dispatch)).toHaveLength(0);
    const dialog = screen.getByRole("dialog", { name: `Acknowledge ${n} alerts?` });
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(dialog.textContent).toContain("Includes alerts below the screen");
    expect(dialog.textContent).toContain("Act now alerts are excluded");
    expect(dialog.textContent).toContain("does not resolve the underlying condition");
    expect(within(dialog).getByRole("button", { name: `Acknowledge ${n}` })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: `Acknowledge ${n} alerts?` })).toBeNull();
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS * 2));
    expect(acks(dispatch)).toHaveLength(0);
  });

  it("says the count with Undo, and Undo records nothing", () => {
    const { dispatch, button, n } = renderDrawer();
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: `Acknowledge ${n}` }));
    expect(screen.getByText(`${n} alerts acknowledged.`)).toBeTruthy();
    expect(acks(dispatch)).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /^Undo/ }));
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS * 2));
    expect(acks(dispatch)).toHaveLength(0);
    expect(screen.getByRole("button", { name: /^Acknowledge visible/ })).toBeTruthy();
  });

  it("records every confirmed row once the Undo window ends", () => {
    const { dispatch, button, n } = renderDrawer();
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: `Acknowledge ${n}` }));
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS + 1000));
    expect(acks(dispatch)).toHaveLength(n);
  });

  it("keeps a confirmed batch pending when the drawer is closed and reopened inside the Undo window", () => {
    const dispatch = vi.fn();
    const drawer = (
      <WardTasksDrawer
        alertsScreenOpen={false}
        items={items}
        acknowledgements={{}}
        completions={{}}
        role="coordinator"
        now={NOW_ANCHOR}
        dispatch={dispatch}
        onClose={vi.fn()}
        onSelectMovement={vi.fn()}
      />
    );
    const { rerender } = render(<ToastProvider>{drawer}</ToastProvider>);
    const n = Number(screen.getByRole("button", { name: /^Acknowledge visible/ }).textContent?.match(/(\d+)\s*$/)?.[1]);
    fireEvent.click(screen.getByRole("button", { name: /^Acknowledge visible/ }));
    fireEvent.click(screen.getByRole("button", { name: `Acknowledge ${n}` }));
    rerender(<ToastProvider>{null}</ToastProvider>);
    rerender(<ToastProvider>{drawer}</ToastProvider>);
    expect(screen.queryByRole("button", { name: /^Acknowledge visible/ })).toBeNull();
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS + 1000));
    expect(acks(dispatch)).toHaveLength(n);
  });
});

describe("Acknowledge visible says one alert in the singular (CL-7, 5 Nov 2026)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("asks 'Acknowledge 1 alert?' and confirms '1 alert acknowledged.'", () => {
    render(
      <ToastProvider>
        <AcknowledgeVisibleButton ids={["synthetic-alert-1"]} onAcknowledge={vi.fn()} classes={{}} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Acknowledge visible/ }));
    const dialog = screen.getByRole("dialog", { name: "Acknowledge 1 alert?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Acknowledge 1" }));
    expect(screen.getByText("1 alert acknowledged.")).toBeTruthy();
  });
});

/**
 * Audit M8, silent data loss: the batch waits in this tab for its Undo window, so leaving the page
 * inside the window used to lose it. Leaving now records it at once, and a close or reload also
 * asks the browser to warn while that save goes. Undo is unchanged while the page stays open.
 */
describe("Acknowledge visible records a held batch when the page is left inside the Undo window (audit M8)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function confirmBatch(dispatch?: ReturnType<typeof vi.fn>) {
    const { dispatch: sent, button, n } = renderDrawer(dispatch);
    const dispatchUsed = sent;
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: `Acknowledge ${n}` }));
    expect(acks(dispatchUsed)).toHaveLength(0);
    return { dispatch: dispatchUsed, n };
  }

  it("a tab close or reload records the batch at once and asks the browser to warn", () => {
    const { dispatch, n } = confirmBatch();
    const unload = new Event("beforeunload", { cancelable: true });
    act(() => {
      window.dispatchEvent(unload);
    });
    expect(acks(dispatch)).toHaveLength(n);
    expect(unload.defaultPrevented).toBe(true);
    expect(screen.queryByText(`${n} alerts acknowledged.`)).toBeNull();
    // The window ending later records nothing twice, and a second leave has nothing to warn about.
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS * 2));
    expect(acks(dispatch)).toHaveLength(n);
    const again = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(again);
    expect(again.defaultPrevented).toBe(false);
  });

  it("pagehide (a phone closing the tab, or navigating away) records the batch at once", () => {
    const { dispatch, n } = confirmBatch();
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(acks(dispatch)).toHaveLength(n);
  });

  it("Undo before leaving still records nothing, and leaving then does not warn", () => {
    const { dispatch } = confirmBatch();
    fireEvent.click(screen.getByRole("button", { name: /^Undo/ }));
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    window.dispatchEvent(new Event("pagehide"));
    expect(acks(dispatch)).toHaveLength(0);
    expect(unload.defaultPrevented).toBe(false);
  });

  /*
   * D-125 (Josh, 10 Nov 2026; gap B): Sign out and Switch role inside the window send the batch first
   * and wait for it to be confirmed (`sendHeldActions`, which `use-ward-supabase-shared.ts` awaits).
   * A refused or failed acknowledgement keeps the person signed in, or on the same desk, and says so.
   */
  it("sign-out inside the Undo window sends the held batch at once and waits for it to be confirmed", async () => {
    let answer: (outcome: { commandId: string; status: "accepted" }) => void = () => {};
    const answered = new Promise<{ commandId: string; status: "accepted" }>((resolve) => (answer = resolve));
    const { dispatch, n } = confirmBatch(vi.fn(() => answered));
    expect(heldActionsWaiting()).toBe(true);
    let sent: boolean | undefined;
    act(() => {
      void sendHeldActions("sign-out").then((ok) => (sent = ok));
    });
    expect(acks(dispatch)).toHaveLength(n);
    expect(screen.queryByText(`${n} alerts acknowledged.`)).toBeNull();
    expect(heldActionsWaiting()).toBe(false);
    await act(async () => {
      await Promise.resolve();
    });
    // Not confirmed yet: the sign-out still waits.
    expect(sent).toBeUndefined();
    await act(async () => {
      answer({ commandId: "synthetic", status: "accepted" });
      await answered;
    });
    await vi.waitFor(() => expect(sent).toBe(true));
    // The window ending later records nothing twice.
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS * 2));
    expect(acks(dispatch)).toHaveLength(n);
  });

  it.each([
    ["sign-out", "You are still signed in.", "sign out again"],
    ["switch-role", "Your role was not switched.", "switch role again"],
  ] as const)("a refused acknowledgement stops %s and says why", async (purpose, title, next) => {
    const refused = vi.fn(async () => ({ commandId: "synthetic", status: "refused", message: "Refused." }));
    const { n } = confirmBatch(refused);
    let sent: boolean | undefined;
    await act(async () => {
      sent = await sendHeldActions(purpose);
    });
    expect(sent).toBe(false);
    expect(refused).toHaveBeenCalledTimes(n);
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(new RegExp(`${n} alerts could not be confirmed as acknowledged.*${next}`))).toBeTruthy();
  });

  it("a failed (uncertain) acknowledgement also stops sign-out", async () => {
    confirmBatch(vi.fn(() => ({ commandId: "synthetic", status: "failed", message: "Not confirmed." })));
    let sent: boolean | undefined;
    await act(async () => {
      sent = await sendHeldActions("sign-out");
    });
    expect(sent).toBe(false);
    expect(screen.getByText("You are still signed in.")).toBeTruthy();
  });

  it("after Undo nothing is held, so sign-out sends nothing and does not wait", async () => {
    const { dispatch } = confirmBatch();
    fireEvent.click(screen.getByRole("button", { name: /^Undo/ }));
    expect(heldActionsWaiting()).toBe(false);
    let sent: boolean | undefined;
    await act(async () => {
      sent = await sendHeldActions("sign-out");
    });
    expect(sent).toBe(true);
    expect(acks(dispatch)).toHaveLength(0);
  });
});
