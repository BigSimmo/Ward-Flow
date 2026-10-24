import { describe, expect, it, vi } from "vitest";
import { SupabaseWardAuth } from "../src/components/ward-management/ward-supabase-auth";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";

// Audit 24-3 (saves and shared mode): SM-2, SM-4 and SV-6.
const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
const snapshot = (revision: number): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
});
const event = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "ward-test" } as WardFlowEvent;
const user = { id: "12345678-1234-1234-1234-123456789abc" };

function client(answer: (body: string | null, token: string) => Response) {
  let view: SharedView | undefined;
  const token = vi.fn(async (options?: { refresh?: boolean }) => (options?.refresh ? "fresh" : "held"));
  const shared = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token,
    changed: (next) => {
      view = next;
    },
    fetch: async (_url, options) =>
      answer(
        options?.body ? String(options.body) : null,
        String((options?.headers as Record<string, string>).authorization),
      ),
  });
  return { shared, token, view: () => view };
}

describe("audit 24-3 session fixes", () => {
  it("SM-2: the auth adapter refreshes on request, even when the token looks valid", async () => {
    let issued = 0;
    const fetcher = vi.fn(async (u: RequestInfo | URL) =>
      Response.json(
        String(u).endsWith("/user")
          ? user
          : { access_token: `access-${++issued}`, refresh_token: `refresh-${issued}`, expires_in: 3600, user },
      ),
    );
    const auth = new SupabaseWardAuth({
      url: "https://zakzoemeedfepxcstsou.supabase.co",
      publishableKey: "sb_publishable_test",
      fetch: fetcher,
    });
    await auth.signIn("synthetic@example.invalid", "private-test-password");
    expect(await auth.token()).toBe("access-1");
    expect(await auth.token({ refresh: true })).toBe("access-2");
    expect(fetcher.mock.calls.filter(([u]) => String(u).includes("grant_type=refresh_token"))).toHaveLength(1);
  });

  it("SM-2: the retry after a server 401 forces one refresh and keeps the command id", async () => {
    const posts: { token: string; commandId: string }[] = [];
    const { shared, token, view } = client((body, bearer) => {
      if (!body) return Response.json({ snapshot: snapshot(1) });
      posts.push({ token: bearer, commandId: JSON.parse(body).commandId });
      if (bearer === "Bearer held")
        return Response.json({ error: "Sign in with the authorised account" }, { status: 401 });
      return Response.json({ outcome: "accepted", commandRevision: 2, snapshot: snapshot(2) });
    });
    await shared.refresh();
    expect((await shared.dispatch(event)).status).toBe("accepted");
    expect(posts.map((post) => post.token)).toEqual(["Bearer held", "Bearer fresh"]);
    expect(posts[0].commandId).toBe(posts[1].commandId);
    expect(token).toHaveBeenLastCalledWith({ refresh: true });
    expect(view()?.status).toBe("ready");
    shared.dispose();
  });

  it("SM-2: two 401s after a real refresh still sign out", async () => {
    const { shared, view } = client((body) =>
      body
        ? Response.json({ error: "Sign in with the authorised account" }, { status: 401 })
        : Response.json({ snapshot: snapshot(1) }),
    );
    await shared.refresh();
    expect((await shared.dispatch(event)).status).not.toBe("accepted");
    expect(view()?.status).toBe("not-authorised");
    shared.dispose();
  });

  it("SV-6: a plain server 403 shows the server's own reason", async () => {
    const { shared, view } = client((body) =>
      body
        ? Response.json({ error: "This desk's access was withdrawn." }, { status: 403 })
        : Response.json({ snapshot: snapshot(1) }),
    );
    await shared.refresh();
    await shared.dispatch(event);
    expect(view()?.status).toBe("not-authorised");
    expect(view()?.error).toBe("This desk's access was withdrawn.");
    shared.dispose();
  });

  it("SM-4: after a server error, a good read says the board is current and only the save waits", async () => {
    let fail = true;
    const { shared, view } = client((body) =>
      body && fail ? new Response("busy", { status: 500 }) : Response.json({ snapshot: snapshot(1) }),
    );
    await shared.refresh();
    expect((await shared.dispatch(event)).status).toBe("failed");
    expect(view()?.boardCurrent).toBe(false);
    fail = false;
    await shared.refresh();
    expect(view()).toMatchObject({ status: "unavailable", boardCurrent: true });
    shared.dispose();
  });

  it("SM-1: a this-tab-only sign-out removes this tab's saved session, so a reload restores nothing", async () => {
    const saved = new Map<string, string>();
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
      removeItem: (key: string) => void saved.delete(key),
    };
    const fetcher = vi.fn(async (u: RequestInfo | URL) =>
      Response.json(
        String(u).endsWith("/user")
          ? user
          : { access_token: "access-1", refresh_token: "refresh-1", expires_in: 3600, user },
      ),
    );
    const ended = vi.fn();
    const options = {
      url: "https://zakzoemeedfepxcstsou.supabase.co",
      publishableKey: "sb_publishable_test",
      fetch: fetcher,
      storage,
      onSessionEnded: ended,
    };
    const auth = new SupabaseWardAuth(options);
    await auth.signIn("synthetic@example.invalid", "private-test-password");
    expect(saved.size).toBe(1);
    ended.mockClear();
    await auth.signOut(true);
    expect(auth.userId).toBeNull();
    expect(saved.size).toBe(0);
    // No server sign-out and no device-wide sweep: the other tab's session stays.
    expect(fetcher.mock.calls.some(([u]) => String(u).includes("/logout"))).toBe(false);
    expect(ended).not.toHaveBeenCalled();
    // Reloading this tab builds a new adapter over the same per-tab storage.
    const reloaded = new SupabaseWardAuth(options);
    await reloaded.restore();
    expect(reloaded.userId).toBeNull();
  });
});
