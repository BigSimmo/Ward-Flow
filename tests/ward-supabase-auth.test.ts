import { describe, expect, it, vi } from "vitest";
import {
  SupabaseWardAuth,
  WARD_AUTH_STORAGE_KEY,
  consumeRecoveryFragment,
} from "../src/components/ward-management/ward-supabase-auth";
const url = "https://zakzoemeedfepxcstsou.supabase.co";
const user = { id: "12345678-1234-1234-1234-123456789abc" };
const session = (access_token = "access") => ({ access_token, refresh_token: "refresh", expires_in: 3600, user });
const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
    values,
  };
};
describe("scoped browser auth", () => {
  it("refuses another project and privileged keys", () => {
    expect(
      () => new SupabaseWardAuth({ url: "https://other.supabase.co", publishableKey: "sb_publishable_test" }),
    ).toThrow();
    expect(() => new SupabaseWardAuth({ url, publishableKey: "sb_secret_test" })).toThrow();
  });
  it("stores only a verified auth session, never the password", async () => {
    const store = storage();
    const fetcher = vi.fn(async (u: RequestInfo | URL) =>
      Response.json(String(u).endsWith("/user") ? user : session()),
    );
    const auth = new SupabaseWardAuth({ url, publishableKey: "sb_publishable_test", storage: store, fetch: fetcher });
    await auth.signIn("synthetic@example.invalid", "private-test-password");
    expect(await auth.token()).toBe("access");
    expect([...store.values.keys()]).toEqual([WARD_AUTH_STORAGE_KEY]);
    expect(store.getItem(WARD_AUTH_STORAGE_KEY)).not.toContain("private-test-password");
    expect(fetcher).toHaveBeenCalledTimes(2);
    auth.dispose();
  });
  it("coalesces refresh and preserves recovery through reload", async () => {
    const store = storage();
    store.setItem(WARD_AUTH_STORAGE_KEY, JSON.stringify({ ...session(), expiresAt: 0, recovery: true }));
    const fetcher = vi.fn(async (u: RequestInfo | URL) =>
      Response.json(String(u).endsWith("/user") ? user : session("renewed")),
    );
    const auth = new SupabaseWardAuth({ url, publishableKey: "sb_publishable_test", storage: store, fetch: fetcher });
    await auth.restore();
    expect(auth.isRecovery).toBe(true);
    await expect(auth.token()).rejects.toMatchObject({ kind: "session" });
    await auth.updatePassword("new-private-password");
    const results = await Promise.all([auth.token(), auth.token()]);
    expect(results).toEqual(["renewed", "renewed"]);
    expect(fetcher.mock.calls.filter(([u]) => String(u).includes("grant_type=refresh_token"))).toHaveLength(1);
    auth.dispose();
  });
  it("signs the same account in again for a step-up, and refuses a different account", async () => {
    const store = storage();
    let next = user;
    let tokens = 0;
    const fetcher = vi.fn(async (u: RequestInfo | URL, init?: RequestInit) => {
      if (String(u).endsWith("/user")) return Response.json({ ...next, email: "synthetic@example.invalid" });
      if (String(init?.body).includes("wrong-password")) return Response.json({ error: "invalid" }, { status: 400 });
      tokens++;
      return Response.json(session(`access-${tokens}`));
    });
    const auth = new SupabaseWardAuth({ url, publishableKey: "sb_publishable_test", storage: store, fetch: fetcher });
    await expect(auth.reauthenticate("private-test-password")).rejects.toMatchObject({ kind: "session" });
    await auth.signIn("synthetic@example.invalid", "private-test-password");
    await auth.reauthenticate("private-test-password");
    expect(await auth.token()).toBe("access-2");
    const body = JSON.parse(String(fetcher.mock.calls.at(-2)?.[1]?.body));
    expect(body).toEqual({ email: "synthetic@example.invalid", password: "private-test-password" });
    // A wrong password is a form answer: the session is kept.
    await expect(auth.reauthenticate("wrong-password")).rejects.toMatchObject({ kind: "credentials" });
    expect(await auth.token()).toBe("access-2");
    expect(store.getItem(WARD_AUTH_STORAGE_KEY)).not.toContain("private-test-password");
    // The email is used for the step-up but is never written to browser storage.
    expect(store.getItem(WARD_AUTH_STORAGE_KEY)).not.toContain("synthetic@example.invalid");
    next = { id: "87654321-4321-4321-4321-cba987654321" };
    await expect(auth.reauthenticate("private-test-password")).rejects.toMatchObject({ kind: "session" });
    expect(store.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
    auth.dispose();
  });
  it("suppresses and aborts a late login after disposal", async () => {
    let finish!: (v: Response) => void;
    let signal: AbortSignal | null | undefined;
    const store = storage();
    const auth = new SupabaseWardAuth({
      url,
      publishableKey: "sb_publishable_test",
      storage: store,
      fetch: async (_u, init) => {
        signal = init?.signal;
        return new Promise((r) => {
          finish = r;
        });
      },
    });
    const pending = auth.signIn("a@example.invalid", "password");
    auth.dispose();
    expect(signal?.aborted).toBe(true);
    finish(Response.json(session()));
    await expect(pending).rejects.toMatchObject({ kind: "cancelled" });
    expect(store.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
  });
  it.each([401, 503])("distinguishes user rejection from outage %i", async (status) => {
    const store = storage();
    store.setItem(
      WARD_AUTH_STORAGE_KEY,
      JSON.stringify({ ...session(), expiresAt: Date.now() + 3600000, recovery: false }),
    );
    const auth = new SupabaseWardAuth({
      url,
      publishableKey: "sb_publishable_test",
      storage: store,
      fetch: async () => Response.json({}, { status }),
    });
    await expect(auth.restore()).rejects.toMatchObject({ kind: status === 401 ? "session" : "unavailable" });
    expect(store.getItem(WARD_AUTH_STORAGE_KEY) === null).toBe(status === 401);
    auth.dispose();
  });
  it("removes sensitive fragments synchronously before handing recovery to auth", () => {
    const replace = vi.fn();
    const result = consumeRecoveryFragment(
      {
        hash: "#access_token=secret&refresh_token=refresh&expires_in=3600&type=recovery",
        pathname: "/mockups/ward-flow",
        search: "?view=test",
      },
      replace,
    );
    expect(replace).toHaveBeenCalledWith("/mockups/ward-flow?view=test");
    expect(result?.recovery).toBe(true);
    expect(result?.access_token).toBe("secret");
  });
  it("refuses an error fragment even when it also includes token fields", () => {
    const replace = vi.fn();
    expect(() =>
      consumeRecoveryFragment(
        {
          hash: "#type=recovery&error=access_denied&access_token=synthetic&refresh_token=synthetic&expires_in=3600",
          pathname: "/mockups/ward-flow",
          search: "",
        },
        replace,
      ),
    ).toThrow(/invalid or expired/);
    expect(replace).toHaveBeenCalledWith("/mockups/ward-flow");
  });
});

it("coalesces concurrent expiring token refresh requests", async () => {
  let refreshCalls = 0;
  const fetcher: typeof fetch = async (url) => {
    if (String(url).endsWith("/user")) return Response.json(user);
    if (String(url).includes("refresh_token")) {
      refreshCalls++;
      await new Promise((r) => setTimeout(r, 5));
      return Response.json(session("fresh"));
    }
    return Response.json({ ...session(), expires_in: 1 });
  };
  const auth = new SupabaseWardAuth({ url, publishableKey: "sb_publishable_test", fetch: fetcher });
  await auth.signIn("synthetic@example.invalid", "password");
  expect(await Promise.all([auth.token(), auth.token()])).toEqual(["fresh", "fresh"]);
  expect(refreshCalls).toBe(1);
  auth.dispose();
});
it("times out Auth requests without retaining passwords", async () => {
  const auth = new SupabaseWardAuth({
    url,
    publishableKey: "sb_publishable_test",
    timeoutMs: 10,
    fetch: async (_url, init) =>
      new Promise((_resolve, reject) => {
        init!.signal!.addEventListener("abort", () => reject(new Error("aborted")));
      }),
  });
  await expect(auth.signIn("synthetic@example.invalid", "password")).rejects.toMatchObject({ kind: "unavailable" });
  auth.dispose();
});
it("clears local session before a logout outage", async () => {
  const store = storage();
  const auth = new SupabaseWardAuth({
    url,
    publishableKey: "sb_publishable_test",
    storage: store,
    fetch: async (url) =>
      String(url).includes("/logout")
        ? Response.json({}, { status: 503 })
        : Response.json(String(url).endsWith("/user") ? user : session()),
  });
  await auth.signIn("synthetic@example.invalid", "password");
  const logout = auth.signOut();
  expect(store.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
  await expect(logout).rejects.toMatchObject({ kind: "unavailable" });
  await expect(auth.token()).rejects.toMatchObject({ kind: "session" });
  auth.dispose();
});

it("refuses refreshed tokens for a different account and removes the old session", async () => {
  const store = storage();
  let verified = 0;
  const auth = new SupabaseWardAuth({
    url,
    publishableKey: "sb_publishable_test",
    storage: store,
    fetch: async (url) =>
      String(url).endsWith("/user")
        ? Response.json(++verified === 1 ? user : { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" })
        : Response.json({ ...session(), expires_in: 1 }),
  });
  await auth.signIn("synthetic@example.invalid", "synthetic-password");
  await expect(auth.token()).rejects.toMatchObject({ kind: "session" });
  expect(auth.userId).toBeNull();
  expect(store.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
  auth.dispose();
});
