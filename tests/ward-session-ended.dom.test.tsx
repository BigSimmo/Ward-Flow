import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useWardShared } from "../src/components/ward-management/ward-shared-access";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import { WARD_AUTH_STORAGE_KEY } from "../src/components/ward-management/ward-supabase-auth";
vi.mock("../src/components/ward-management/shell/ward-phone-push", async (original) => {
  const actual = await original<typeof import("../src/components/ward-management/shell/ward-phone-push")>();
  return { ...actual, releasePhonePush: vi.fn(async () => {}) };
});

const user = { id: "12345678-1234-1234-1234-123456789abc" };

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_WARD_AUTH_PROVIDER", "supabase");
  vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_URL", "https://zakzoemeedfepxcstsou.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("NEXT_PUBLIC_WARD_API_BASE_URL", "https://api.example.test");
  sessionStorage.clear();
  window.history.replaceState({}, "", "/ward-flow");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

it("ends the session when this tab's stored sign-in is cleared, instead of still looking signed in", async () => {
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
  const fetcher = vi.fn(async (url: string | URL | Request) =>
    String(url).includes("/v1/workspace")
      ? Response.json({ snapshot, actorId: user.id, access: { role: "coordinator", scope: { kind: "statewide" } } })
      : String(url).endsWith("/user")
        ? Response.json(user)
        : Response.json({ access_token: "access", refresh_token: "refresh", expires_in: 3600, user }),
  );
  vi.stubGlobal("fetch", fetcher);
  const realSetInterval = globalThis.setInterval;
  let pollTick: (() => void) | undefined;
  vi.spyOn(globalThis, "setInterval").mockImplementation(((fn: TimerHandler, ms?: number) => {
    if (ms === 3000 && typeof fn === "function") {
      pollTick = fn as () => void;
      return 0 as unknown as ReturnType<typeof setInterval>;
    }
    return realSetInterval(fn, ms);
  }) as typeof setInterval);
  const { result, unmount } = renderHook(() => useWardShared(true));
  await waitFor(() => expect(result.current.status).toBe("ready"));
  await act(async () => {
    await result.current.credentials!.signIn("synthetic@example.invalid", "private-password");
  });
  await waitFor(() => expect(result.current.signedIn).toBe(true));
  expect(sessionStorage.getItem(WARD_AUTH_STORAGE_KEY)).not.toBeNull();
  const reads = () => fetcher.mock.calls.filter(([url]) => String(url).includes("/v1/workspace")).length;
  const before = reads();

  sessionStorage.removeItem(WARD_AUTH_STORAGE_KEY);
  await act(async () => {
    pollTick!();
  });
  expect(result.current.signedIn).toBe(false);
  expect(result.current.error).toBe("Your session ended. Sign in again to carry on.");
  expect(reads()).toBe(before);
  unmount();
});

it("ends the session when the stored sign-in is cleared while the first workspace read is pending", async () => {
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
  let clearOnRead = false;
  const fetcher = vi.fn(async (url: string | URL | Request) => {
    if (String(url).includes("/v1/workspace")) {
      // Another tool clears this tab's sign-in while the first read is still on its way.
      if (clearOnRead) sessionStorage.removeItem(WARD_AUTH_STORAGE_KEY);
      return Response.json({
        snapshot,
        actorId: user.id,
        access: { role: "coordinator", scope: { kind: "statewide" } },
      });
    }
    return String(url).endsWith("/user")
      ? Response.json(user)
      : Response.json({ access_token: "access", refresh_token: "refresh", expires_in: 3600, user });
  });
  vi.stubGlobal("fetch", fetcher);
  const { result, unmount } = renderHook(() => useWardShared(true));
  await waitFor(() => expect(result.current.status).toBe("ready"));
  clearOnRead = true;
  await act(async () => {
    await result.current.credentials!.signIn("synthetic@example.invalid", "private-password");
  });
  await waitFor(() => expect(result.current.error).toBe("Your session ended. Sign in again to carry on."));
  expect(result.current.signedIn).toBe(false);
  unmount();
});

it("drops the in-memory sign-in too, so a token refresh still on its way cannot store it again", async () => {
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
  // A short-lived token, so every token read refreshes. The second refresh is held open.
  const session = { access_token: "access", refresh_token: "refresh", expires_in: 30, user };
  let refreshes = 0;
  let releaseRefresh: (() => void) | undefined;
  const fetcher = vi.fn(async (url: string | URL | Request) => {
    const path = String(url);
    if (path.includes("/v1/workspace"))
      return Response.json({
        snapshot,
        actorId: user.id,
        access: { role: "coordinator", scope: { kind: "statewide" } },
      });
    if (path.endsWith("/user")) return Response.json(user);
    if (path.includes("grant_type=refresh_token") && ++refreshes === 2)
      await new Promise<void>((resolve) => (releaseRefresh = resolve));
    return Response.json(session);
  });
  vi.stubGlobal("fetch", fetcher);
  const realSetInterval = globalThis.setInterval;
  let pollTick: (() => void) | undefined;
  vi.spyOn(globalThis, "setInterval").mockImplementation(((fn: TimerHandler, ms?: number) => {
    if (ms === 3000 && typeof fn === "function") {
      pollTick = fn as () => void;
      return 0 as unknown as ReturnType<typeof setInterval>;
    }
    return realSetInterval(fn, ms);
  }) as typeof setInterval);
  const { result, unmount } = renderHook(() => useWardShared(true));
  await waitFor(() => expect(result.current.status).toBe("ready"));
  await act(async () => {
    await result.current.credentials!.signIn("synthetic@example.invalid", "private-password");
  });
  await waitFor(() => expect(releaseRefresh).toBeDefined());
  sessionStorage.setItem("ward-synthetic-tab-note", "x");

  sessionStorage.removeItem(WARD_AUTH_STORAGE_KEY);
  await act(async () => {
    pollTick!();
  });
  expect(result.current.signedIn).toBe(false);
  // This tab's Ward Flow data goes with the session, as a sign-out here would clear it.
  expect(sessionStorage.getItem("ward-synthetic-tab-note")).toBeNull();
  await act(async () => {
    releaseRefresh!();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(sessionStorage.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
  unmount();
});
