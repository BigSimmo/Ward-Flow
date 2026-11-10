import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWardShared } from "../src/components/ward-management/ward-shared-access";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import {
  SIGNED_OUT_NOTICE,
  UNSENT_CHANGES_DROPPED_NOTICE,
} from "../src/components/ward-management/front-door/front-door-notice";
import { registerHeldActions } from "../src/components/ward-management/ward-held-actions";

/*
 * D-125 (Josh, 10 Nov 2026; audit M8 gaps A and B). A voluntary sign-out or role switch first sends
 * actions held in an Undo window and waits for them to be confirmed; a refused or failed one keeps
 * the person signed in. Forced expiry at the session limit never waits, and its notice now says that
 * waiting changes were not saved. Synthetic data only.
 */
vi.mock("../src/components/ward-management/shell/ward-phone-push", async (original) => {
  const actual = await original<typeof import("../src/components/ward-management/shell/ward-phone-push")>();
  return { ...actual, releasePhonePush: vi.fn(async () => {}) };
});

const user = { id: "12345678-1234-1234-1234-123456789abc" };
const clientOf = (connection: object) =>
  (
    connection as {
      client: { current: import("../src/components/ward-management/ward-shared-client").SharedWorkspaceClient };
    }
  ).client.current;
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
const event = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "ward-test" } as WardFlowEvent;

let unregister: (() => void) | null = null;
/** A held action whose save the test answers, as an Undo-window batch would register. */
function holdOne() {
  let answer: (confirmed: boolean) => void = () => {};
  const send = vi.fn<(purpose: string) => Promise<boolean>>(
    () => new Promise<boolean>((resolve) => (answer = resolve)),
  );
  let waiting = true;
  unregister = registerHeldActions({
    waiting: () => waiting,
    send: (purpose) => {
      waiting = false;
      return send(purpose);
    },
  });
  return { send, answer: (confirmed: boolean) => answer(confirmed) };
}

async function signedIn(commands: () => Promise<Response> = () => new Promise<Response>(() => {})) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request) => {
      const path = String(url);
      if (path.endsWith("/commands")) return commands();
      if (path.includes("/v1/workspace"))
        return Response.json({
          snapshot,
          actorId: user.id,
          access: { role: "coordinator", scope: { kind: "statewide" } },
        });
      if (path.endsWith("/user")) return Response.json(user);
      if (path.includes("/logout")) return new Response(null, { status: 204 });
      return Response.json({ access_token: "access", refresh_token: "refresh", expires_in: 3600, user });
    }),
  );
  const hook = renderHook(() => useWardShared(true));
  await waitFor(() => expect(hook.result.current.status).toBe("ready"));
  await act(async () => {
    await hook.result.current.credentials!.signIn("synthetic@example.invalid", "private-password");
  });
  await waitFor(() => expect(hook.result.current.snapshot).toBeTruthy());
  return hook;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_WARD_AUTH_PROVIDER", "supabase");
  vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_URL", "https://zakzoemeedfepxcstsou.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("NEXT_PUBLIC_WARD_API_BASE_URL", "https://api.example.test");
  sessionStorage.clear();
  window.history.replaceState({}, "", "/ward-flow");
});
afterEach(() => {
  unregister?.();
  unregister = null;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("sign-out and role switch wait for actions held in an Undo window (D-125, M8 gap B)", () => {
  it("sends the held action first and signs out only once it is confirmed", async () => {
    const { result, unmount } = await signedIn();
    const held = holdOne();
    act(() => result.current.signOut());
    expect(held.send).toHaveBeenCalledWith("sign-out");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(result.current.signedIn).toBe(true);
    await act(async () => {
      held.answer(true);
    });
    await waitFor(() => expect(result.current.signedIn).toBe(false));
    expect(result.current.farewell).toBe(SIGNED_OUT_NOTICE);
    unmount();
  });

  it("keeps the person signed in when the held action is refused or fails", async () => {
    const { result, unmount } = await signedIn();
    const held = holdOne();
    act(() => result.current.signOut());
    await act(async () => {
      held.answer(false);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(result.current.signedIn).toBe(true);
    expect(result.current.farewell).toBeNull();
    unmount();
  });

  it("switches role only once the held action is confirmed, and not when it is refused", async () => {
    const { result, unmount } = await signedIn();
    const switchRole = vi.spyOn(clientOf(result.current), "switchRole").mockImplementation(() => {});
    const refused = holdOne();
    act(() => result.current.switchRole!());
    expect(refused.send).toHaveBeenCalledWith("switch-role");
    await act(async () => {
      refused.answer(false);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(switchRole).not.toHaveBeenCalled();
    unregister?.();
    const confirmed = holdOne();
    act(() => result.current.switchRole!());
    expect(switchRole).not.toHaveBeenCalled();
    await act(async () => {
      confirmed.answer(true);
    });
    await waitFor(() => expect(switchRole).toHaveBeenCalledTimes(1));
    unmount();
  });

  it("with nothing held, sign-out goes at once as before", async () => {
    const { result, unmount } = await signedIn();
    act(() => result.current.signOut());
    await waitFor(() => expect(result.current.signedIn).toBe(false));
    expect(result.current.farewell).toBe(SIGNED_OUT_NOTICE);
    unmount();
  });
});

describe("the session limit never waits, and says waiting changes were not saved (D-125, M8 gap A)", () => {
  it("adds the not-saved notice to the limit's reason when a save was waiting", async () => {
    let refuse: () => void = () => {};
    const { result, unmount } = await signedIn(
      () =>
        new Promise<Response>((resolve) => {
          refuse = () =>
            resolve(Response.json({ code: "session-limit", error: "Signed out after 12 hours." }, { status: 401 }));
        }),
    );
    act(() => {
      void clientOf(result.current).dispatch(event);
      void clientOf(result.current).dispatch(event);
    });
    await waitFor(() => expect(result.current.unconfirmedSave).toBe(true));
    await act(async () => {
      refuse();
    });
    await waitFor(() => expect(result.current.status).toBe("not-authorised"));
    expect(result.current.signedIn).toBe(false);
    expect(result.current.error).toBe(`Signed out after 12 hours. ${UNSENT_CHANGES_DROPPED_NOTICE}`);
    unmount();
  });

  it("says so for an action held in an Undo window too, without waiting for it", async () => {
    const { result, unmount } = await signedIn();
    const held = holdOne();
    // The next read reaches the session limit.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) =>
        String(url).includes("/v1/workspace")
          ? Response.json({ code: "session-limit", error: "Signed out after 12 hours." }, { status: 401 })
          : new Response(null, { status: 204 }),
      ),
    );
    await act(async () => {
      await clientOf(result.current)
        ?.refresh()
        .catch(() => {});
    });
    await waitFor(() => expect(result.current.status).toBe("not-authorised"));
    expect(held.send).not.toHaveBeenCalled();
    expect(result.current.error).toBe(`Signed out after 12 hours. ${UNSENT_CHANGES_DROPPED_NOTICE}`);
    unmount();
  });
});
