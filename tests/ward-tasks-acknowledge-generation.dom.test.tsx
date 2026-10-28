import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/wf";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardTasksDrawer } from "@/components/ward-management/ward-tasks-drawer";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { UNDO_TOAST_MS } from "@/components/ward-management/ward-operational-defaults";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardSharedConnection } from "@/components/ward-management/ward-shared-access";

const fake = vi.hoisted(() => ({ connection: null as WardSharedConnection | null }));
vi.mock("@/components/ward-management/ward-shared-access", async (original) => {
  const actual = await original<typeof import("@/components/ward-management/ward-shared-access")>();
  return {
    ...actual,
    useWardShared: (enabled: boolean) =>
      fake.connection ? { ...fake.connection, enabled } : actual.useWardShared(enabled),
  };
});

function Host() {
  const world = useWardFlow();
  const [drawer, setDrawer] = useState(true);
  const items = buildActionInbox(world.movements.filter(isOpen), NOW_ANCHOR, world.units);
  return (
    <>
      <output data-testid="generation">{world.worldGeneration}</output>
      <output data-testid="acknowledgements">{Object.values(world.inboxAcknowledgements).flat().length}</output>
      <button
        onClick={() => {
          setDrawer(false);
          world.dispatch({ type: "RESET_SCENARIO", role: "demo", now: NOW_ANCHOR });
        }}
      >
        Reset synthetic world
      </button>
      <button onClick={() => setDrawer(true)}>Open tasks</button>
      <button onClick={() => world.dispatch({ type: "RESET_SCENARIO", role: "demo", now: NOW_ANCHOR })}>
        Reset with drawer open
      </button>
      {drawer ? (
        <WardTasksDrawer
          alertsScreenOpen={false}
          items={items}
          acknowledgements={world.inboxAcknowledgements}
          completions={world.inboxCompletions}
          role="coordinator"
          now={NOW_ANCHOR}
          dispatch={world.dispatch}
          onClose={() => setDrawer(false)}
          onSelectMovement={() => {}}
        />
      ) : null}
    </>
  );
}

describe("deferred acknowledgements stay in their original world", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    fake.connection = null;
  });

  it("does not revive held rows after access changes away and back to the same desk", () => {
    vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "true");
    fake.connection = {
      enabled: true,
      signedIn: true,
      actorId: "synthetic-shared-account",
      access: { role: "coordinator", scope: { kind: "statewide" } },
      status: "ready",
      error: null,
      eventLog: [],
      receivedAt: Date.now(),
      snapshot: {
        accessContext: "a".repeat(64),
        dataMode: "prototype",
        revision: 1,
        now: NOW_ANCHOR,
        payload: {
          version: 1,
          state: seedWardFlowState(),
          dayZero: "2026-10-07T00:00:00Z",
          startedAt: "2026-10-07T10:00:00Z",
        },
      },
      dispatch: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      retry: vi.fn(),
      pushApi: { pushKey: vi.fn(), pushStatus: vi.fn(), pushSubscribe: vi.fn(), pushUnsubscribe: vi.fn() },
    };
    const tree = () => (
      <WardFlowProvider>
        <ToastProvider>
          <Host />
        </ToastProvider>
      </WardFlowProvider>
    );
    const { rerender } = render(tree());
    const offered = screen.getByRole("button", { name: /^Acknowledge visible/ });
    const count = Number(offered.textContent?.match(/(\d+)\s*$/)?.[1]);
    fireEvent.click(offered);
    fireEvent.click(screen.getByRole("button", { name: `Acknowledge ${count}` }));
    expect(screen.queryByRole("button", { name: /^Acknowledge visible/ })).toBeNull();
    for (const context of ["b", "a"]) {
      fake.connection = {
        ...fake.connection,
        snapshot: { ...fake.connection.snapshot!, accessContext: context.repeat(64) },
      };
      rerender(tree());
      expect(screen.getByRole("button", { name: /^Acknowledge visible/ })).toBeTruthy();
    }
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS + 1000));
    expect(fake.connection.dispatch).not.toHaveBeenCalled();
  });

  it("does not confirm a dialog opened in a previous world", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Host />
        </ToastProvider>
      </WardFlowProvider>,
    );
    const offered = screen.getByRole("button", { name: /^Acknowledge visible/ });
    const count = Number(offered.textContent?.match(/(\d+)\s*$/)?.[1]);
    fireEvent.click(offered);
    fireEvent.click(screen.getByRole("button", { name: "Reset with drawer open" }));
    fireEvent.click(screen.getByRole("button", { name: `Acknowledge ${count}` }));
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS + 1000));
    expect(screen.getByTestId("acknowledgements")).toHaveTextContent("0");
  });

  it("keeps a replacement world's batch held when an older timer expires", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Host />
        </ToastProvider>
      </WardFlowProvider>,
    );
    function confirmVisible() {
      const offered = screen.getByRole("button", { name: /^Acknowledge visible/ });
      const count = Number(offered.textContent?.match(/(\d+)\s*$/)?.[1]);
      fireEvent.click(offered);
      fireEvent.click(screen.getByRole("button", { name: `Acknowledge ${count}` }));
      return count;
    }
    confirmVisible();
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS / 2));
    fireEvent.click(screen.getByRole("button", { name: "Reset with drawer open" }));
    const count = confirmVisible();
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS / 2 + 10));
    expect(screen.getByTestId("acknowledgements")).toHaveTextContent("0");
    expect(screen.queryByRole("button", { name: /^Acknowledge visible/ })).toBeNull();
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS / 2));
    expect(screen.getByTestId("acknowledgements")).toHaveTextContent(String(count));
  });

  it("does not apply an old batch after closing the drawer and resetting the world", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Host />
        </ToastProvider>
      </WardFlowProvider>,
    );
    const offered = screen.getByRole("button", { name: /^Acknowledge visible/ });
    const count = Number(offered.textContent?.match(/(\d+)\s*$/)?.[1]);
    expect(count).toBeGreaterThan(0);
    fireEvent.click(offered);
    fireEvent.click(screen.getByRole("button", { name: `Acknowledge ${count}` }));
    const originalGeneration = screen.getByTestId("generation").textContent;
    fireEvent.click(screen.getByRole("button", { name: "Reset synthetic world" }));
    expect(screen.getByTestId("generation").textContent).not.toBe(originalGeneration);
    expect(screen.getByTestId("acknowledgements")).toHaveTextContent("0");
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS + 1000));
    expect(screen.getByTestId("acknowledgements")).toHaveTextContent("0");
    fireEvent.click(screen.getByRole("button", { name: "Open tasks" }));
    expect(screen.getByRole("button", { name: /^Acknowledge visible/ })).toBeTruthy();
  });
});
