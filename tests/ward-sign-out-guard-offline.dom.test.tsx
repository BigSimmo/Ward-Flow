import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useWardShared } from "../src/components/ward-management/ward-shared-access";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { SIGNED_OUT_UNCONFIRMED_NOTICE } from "../src/components/ward-management/front-door/front-door-notice";

/*
 * TE-03 (audit, 5 Nov 2026): Sign out with an unconfirmed save first loads a question. Offline that
 * code may not load. The person must never be left signed in without being told: the sign-out goes
 * ahead and the front door says what happened to the unconfirmed changes.
 */
vi.mock("../src/components/ward-management/ward-sign-out-guard", () => {
  throw new Error("Failed to fetch dynamically imported module");
});
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

it("signs out and says so when the unconfirmed-changes question cannot load", async () => {
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
  const fetcher = vi.fn(async (url: string | URL | Request) => {
    const path = String(url);
    // The save never gets an answer, so it stays unconfirmed.
    if (path.endsWith("/commands")) return new Promise<Response>(() => {});
    if (path.includes("/v1/workspace"))
      return Response.json({
        snapshot,
        actorId: user.id,
        access: { role: "coordinator", scope: { kind: "statewide" } },
      });
    if (path.endsWith("/user")) return Response.json(user);
    if (path.includes("/logout")) return new Response(null, { status: 204 });
    return Response.json({ access_token: "access", refresh_token: "refresh", expires_in: 3600, user });
  });
  vi.stubGlobal("fetch", fetcher);
  const { result, unmount } = renderHook(() => useWardShared(true));
  await waitFor(() => expect(result.current.status).toBe("ready"));
  await act(async () => {
    await result.current.credentials!.signIn("synthetic@example.invalid", "private-password");
  });
  await waitFor(() => expect(result.current.signedIn).toBe(true));
  await waitFor(() => expect(result.current.snapshot).toBeTruthy());
  const event = {
    type: "REQUEST_CAPACITY_REFRESH",
    role: "coordinator",
    now: 642,
    unitId: "ward-test",
  } as WardFlowEvent;
  act(() => {
    void result.current.client.current!.dispatch(event);
  });
  await waitFor(() => expect(result.current.unconfirmedSave).toBe(true));

  act(() => result.current.signOut());
  await waitFor(() => expect(result.current.signedIn).toBe(false));
  expect(result.current.farewell).toBe(SIGNED_OUT_UNCONFIRMED_NOTICE);
  unmount();
});
