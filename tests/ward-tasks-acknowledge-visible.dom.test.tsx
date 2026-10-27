import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/wf";
import { WardTasksDrawer } from "@/components/ward-management/ward-tasks-drawer";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { UNDO_TOAST_MS } from "@/components/ward-management/ward-operational-defaults";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * P017 (Josh approved the wording 27 Oct 2026, 8:35 PM AWST): bulk "Acknowledge visible" in the
 * Tasks drawer asks "Acknowledge {n} alerts?" first, then says "{n} alerts acknowledged." with Undo,
 * and records nothing until the Undo window ends.
 */
const seed = seedWardFlowState();
const items = buildActionInbox(seed.movements.filter(isOpen), NOW_ANCHOR, seed.units);

function renderDrawer() {
  const dispatch = vi.fn();
  render(
    <ToastProvider>
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
