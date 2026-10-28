import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useWardShared, WardSharedAccess } from "../src/components/ward-management/ward-shared-access";
import { WARD_AUTH_STORAGE_KEY } from "../src/components/ward-management/ward-supabase-auth";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";

// P191 (Josh, 27 Oct 2026, 11:36 PM AWST): "retry 3 times quietly, keep the same sentence, make Try
// again work without a reload". A blocked saved sign-in is retried after 2, 5 and 10 seconds behind
// the existing connecting screen; only then does the same sentence show, and Try again retries in place.
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
function Probe() {
  const connection = useWardShared(true);
  return (
    <WardSharedAccess connection={connection}>
      <p>Workspace contents</p>
    </WardSharedAccess>
  );
}
let authUp = false;
let authCalls = 0;
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  vi.stubEnv("NEXT_PUBLIC_WARD_AUTH_PROVIDER", "supabase");
  vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_URL", "https://zakzoemeedfepxcstsou.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("NEXT_PUBLIC_WARD_API_BASE_URL", "https://api.example.test");
  sessionStorage.clear();
  sessionStorage.setItem(WARD_AUTH_STORAGE_KEY, JSON.stringify({ refresh_token: "refresh", recovery: false, user }));
  window.history.replaceState({}, "", "/ward-flow");
  authUp = false;
  authCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => {
      const href = String(url);
      if (href.includes("/v1/workspace"))
        return Response.json({
          snapshot,
          actorId: user.id,
          access: { role: "coordinator", scope: { kind: "statewide" } },
        });
      authCalls += 1;
      if (!authUp) throw new TypeError("network down");
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
// Advance the fake clock, then give the real event loop a few turns so the promise chain that follows
// (auth, then the workspace read) can finish. Microtask passes alone left this suite passing or failing
// from run to run, because part of that chain waits on real (not faked) timers.
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
// The existing banner for a blocked sign-in; P191 adds no wording.
const sentence = () => screen.queryByText("The sign-in service is busy.");

it("retries a blocked saved sign-in three times quietly, then shows the same sentence", async () => {
  render(<Probe />);
  await settle();
  expect(authCalls).toBe(1);
  expect(sentence()).toBeNull();
  await settle(2_000);
  expect(authCalls).toBe(2);
  expect(sentence()).toBeNull();
  await settle(5_000);
  expect(authCalls).toBe(3);
  expect(sentence()).toBeNull();
  await settle(10_000);
  expect(authCalls).toBe(4);
  expect(sentence()).not.toBeNull();
});

it("connects on the first quiet retry that gets through", async () => {
  render(<Probe />);
  await settle();
  authUp = true;
  await settle(2_000);
  expect(sentence()).toBeNull();
  expect(screen.getByText("Workspace contents")).toBeInTheDocument();
});

it("Try again retries at once, in place, without a reload", async () => {
  render(<Probe />);
  await settle(17_000);
  expect(sentence()).not.toBeNull();
  const calls = authCalls;
  authUp = true;
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
  });
  await settle();
  expect(authCalls).toBeGreaterThan(calls);
  expect(screen.getByText("Workspace contents")).toBeInTheDocument();
});

it("a Try again that works before the quiet retries finish stops them, so the open connection is kept", async () => {
  render(<Probe />);
  // The connecting screen offers Try again after 15 seconds, while the last quiet retry (17 s) is still waiting.
  await settle(15_000);
  const button = screen.getByRole("button", { name: /Try again/ });
  authUp = true;
  await act(async () => {
    fireEvent.click(button);
  });
  await settle();
  expect(screen.getByText("Workspace contents")).toBeInTheDocument();
  const calls = authCalls;
  await settle(10_000);
  // No quiet retry restored again after the manual one connected.
  expect(authCalls).toBe(calls);
  expect(screen.getByText("Workspace contents")).toBeInTheDocument();
});
