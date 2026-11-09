import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LiveChip } from "../src/components/wf";
import { clk } from "../src/components/wf/format";
import { useWardShared, WardSharedAccess } from "../src/components/ward-management/ward-shared-access";
import { SHARED_REFRESH_MS } from "../src/components/ward-management/ward-operational-defaults";
import { WARD_AUTH_STORAGE_KEY } from "../src/components/ward-management/ward-supabase-auth";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";

// Audit 5 (#1568): a frozen board must not look like a quiet one. Here the connection stays open:
// the first workspace read lands, then every later read is sent and simply never answered (no error,
// no close, no offline event). The board must still turn visibly stale within its own limit, two
// refreshes (`2 * SHARED_REFRESH_MS`, published by `WardSharedAccess`). Synthetic data only.
const user = { id: "12345678-1234-1234-1234-123456789abc" };
const snapshot = {
  dataMode: "prototype",
  revision: 1,
  now: 642,
  payload: {
    version: 1,
    state: seedWardFlowStateAt(0),
    dayZero: "2026-10-07T00:00:00Z",
    startedAt: "2026-10-07T10:00:00Z",
  },
};
const STALE_LIMIT_MS = 2 * SHARED_REFRESH_MS;

function Probe() {
  const connection = useWardShared(true);
  return (
    <WardSharedAccess connection={connection}>
      <p>Workspace contents</p>
      <LiveChip state="live" />
    </WardSharedAccess>
  );
}

let workspaceReads = 0;
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  vi.setSystemTime(new Date("2026-10-07T10:26:00+08:00"));
  vi.stubEnv("NEXT_PUBLIC_WARD_AUTH_PROVIDER", "supabase");
  vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_URL", "https://zakzoemeedfepxcstsou.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("NEXT_PUBLIC_WARD_API_BASE_URL", "https://api.example.test");
  sessionStorage.clear();
  sessionStorage.setItem(WARD_AUTH_STORAGE_KEY, JSON.stringify({ refresh_token: "refresh", recovery: false, user }));
  window.history.replaceState({}, "", "/ward-flow");
  workspaceReads = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const href = String(url);
      if (href.includes("/v1/workspace")) {
        workspaceReads += 1;
        if (workspaceReads === 1)
          return Response.json({
            snapshot,
            actorId: user.id,
            access: { role: "coordinator", scope: { kind: "statewide" } },
          });
        // Open but silent: the request is accepted and never answered. It settles only if aborted.
        return new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener("abort", () => reject(init.signal!.reason), { once: true }),
        );
      }
      return href.endsWith("/user")
        ? Response.json(user)
        : Response.json({ access_token: "access", refresh_token: "refresh", expires_in: 3600, user });
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

// Same settling as ward-supabase-retry.dom.test.tsx: part of the auth chain waits on real timers.
const realSetTimeout = globalThis.setTimeout;
const realTurn = () => new Promise<void>((resolve) => realSetTimeout(resolve, 5));
const settle = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    for (let pass = 0; pass < 6; pass += 1) {
      await realTurn();
      await vi.advanceTimersByTimeAsync(0);
    }
  });
};

it("turns the board visibly stale within two refreshes when the open connection goes silent", async () => {
  render(<Probe />);
  // The saved sign-in and the first read go through real-timer steps: let them land without moving the clock.
  for (let turn = 0; turn < 20 && !screen.queryByText("Workspace contents"); turn += 1) await settle();
  expect(screen.getByText("Workspace contents")).toBeInTheDocument();
  expect(workspaceReads).toBe(1);
  const lastGood = Date.now();
  const strip = screen.getByTestId("ward-shared-status-bar");
  expect(strip).not.toHaveTextContent(/Not updated since/u);
  expect(screen.queryByText(/Not updating since/u)).toBeNull();

  // The next poll goes out and hangs. Nothing has failed, so just under the limit the board still
  // reads as current.
  await settle(STALE_LIMIT_MS - 100);
  expect(workspaceReads).toBeGreaterThan(1);
  expect(strip).toHaveAttribute("data-state", "ready");
  expect(strip).not.toHaveTextContent(/Not updated since/u);
  expect(screen.queryByText(/Not updating since/u)).toBeNull();

  // Past the limit with no answer: the strip and the Live chip both say when the board last updated.
  await settle(200);
  expect(strip).toHaveAttribute("data-state", "ready");
  expect(strip).toHaveTextContent(`Not updated since ${clk(lastGood)}. Still checking every few seconds.`);
  expect(screen.getAllByText(`Not updating since ${clk(lastGood)}`).length).toBeGreaterThan(0);
});
