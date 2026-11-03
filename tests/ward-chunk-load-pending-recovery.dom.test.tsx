import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AppShellErrorBoundary from "@/app/error";
import { WardFlowErrorPanel } from "@/app/ward-flow/ward-flow-error-panel";
import { useReloadWhenOnline as useHostReloadWhenOnline } from "@/lib/chunk-load-error";
import { useReloadWhenOnline as useWardReloadWhenOnline } from "@/components/ward-management/ward-chunk-load-error";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import {
  SharedWorkspaceClient,
  WARD_COMMAND_RECOVERY_KEY,
  type SharedSnapshot,
} from "@/components/ward-management/ward-shared-client";

const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
const snapshot = (revision: number): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
});

let reload: ReturnType<typeof vi.fn>;

beforeEach(() => {
  reload = vi.fn();
  vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload } as Location);
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
  vi.spyOn(console, "error").mockImplementation(() => {});
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

function reconnect() {
  act(() => {
    window.dispatchEvent(new Event("online"));
  });
}

describe.each([
  ["host", useHostReloadWhenOnline],
  ["Ward Flow", useWardReloadWhenOnline],
] as const)("%s chunk recovery", (_name, useReloadWhenOnline) => {
  it("keeps a real shared command pending until its answer, then allows one reconnect reload", async () => {
    let finishCommand: ((response: Response) => void) | undefined;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "synthetic-test-token",
      changed: () => {},
      recoveryStorage: window.sessionStorage,
      fetch: async (url) => {
        if (String(url).endsWith("/commands")) {
          return new Promise<Response>((resolve) => {
            finishCommand = resolve;
          });
        }
        return Response.json({
          snapshot: snapshot(1),
          receiptScope: "synthetic-recovery-desk",
          accessUntil: Date.now() + 60_000,
        });
      },
    });
    try {
      await client.refresh();
      const completion = client.dispatchConfirmed({
        type: "REQUEST_CAPACITY_REFRESH",
        role: "coordinator",
        now: 642,
        unitId: state.units[0]!.id,
      });
      await waitFor(() => expect(finishCommand).toBeDefined());
      expect(window.sessionStorage.getItem(WARD_COMMAND_RECOVERY_KEY)).not.toBeNull();
      renderHook(() => useReloadWhenOnline(true));

      reconnect();
      expect(reload).not.toHaveBeenCalled();
      expect(window.sessionStorage.getItem(WARD_COMMAND_RECOVERY_KEY)).not.toBeNull();

      finishCommand!(Response.json({ outcome: "accepted", snapshot: snapshot(2) }));
      await expect(completion).resolves.toMatchObject({ status: "accepted" });
      expect(window.sessionStorage.getItem(WARD_COMMAND_RECOVERY_KEY)).toBeNull();

      reconnect();
      expect(reload).toHaveBeenCalledTimes(1);
      reconnect();
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      client.dispose();
    }
  });

  it("honours an unfinished form's existing leave guard until it is clean", () => {
    const form = renderHook(({ dirty }) => useDirtyStateGuard({ isDirty: dirty }), {
      initialProps: { dirty: true },
    });
    renderHook(() => useReloadWhenOnline(true));

    reconnect();
    expect(reload).not.toHaveBeenCalled();
    form.rerender({ dirty: false });
    reconnect();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe("chunk-failure recovery messages", () => {
  it.each(["host", "Ward Flow"] as const)("%s announces uncertainty and focuses the recovery heading", (copy) => {
    const error = new Error("Loading chunk 482 failed.");
    error.name = "ChunkLoadError";
    if (copy === "host") render(<AppShellErrorBoundary error={error} retry={vi.fn()} />);
    else
      render(
        <WardFlowErrorPanel
          error={error}
          retry={vi.fn()}
          title="Screen unavailable"
          description="Try again."
          logLabel="Synthetic recovery test"
          testId="ward-recovery-test"
        />,
      );

    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("unless a save or unfinished work still needs attention");
    expect(screen.getByRole("alert")).toHaveTextContent("Check recent saves before repeating an action");
    expect(screen.queryByText(/Nothing was changed/)).toBeNull();
    reconnect();
    expect(screen.getByRole("alert")).toHaveTextContent("Check recent saves and unfinished work before reloading");
  });
});
