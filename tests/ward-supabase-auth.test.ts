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
  it("keeps the access token in memory only and stays signed in across a reload (H-0044)", async () => {
    const store = storage();
    let issued = 0;
    const fetcher = vi.fn(async (u: RequestInfo | URL) => {
      if (String(u).endsWith("/user")) return Response.json(user);
      issued++;
      return Response.json({ ...session(`access-${issued}`), refresh_token: `refresh-${issued}` });
    });
    const auth = new SupabaseWardAuth({ url, publishableKey: "sb_publishable_test", storage: store, fetch: fetcher });
    await auth.signIn("synthetic@example.invalid", "private-test-password");
    expect(await auth.token()).toBe("access-1");
    const saved = store.getItem(WARD_AUTH_STORAGE_KEY)!;
    expect(saved).not.toContain("access-1");
    expect(JSON.parse(saved)).toEqual({ refresh_token: "refresh-1", recovery: false, user });
    auth.dispose();

    // The reload: a new adapter on the same tab storage refreshes once and is signed in again.
    const reloaded = new SupabaseWardAuth({
      url,
      publishableKey: "sb_publishable_test",
      storage: store,
      fetch: fetcher,
    });
    await reloaded.restore();
    expect(reloaded.userId).toBe(user.id);
    expect(await reloaded.token()).toBe("access-2");
    expect(JSON.parse(store.getItem(WARD_AUTH_STORAGE_KEY)!)).toEqual({
      refresh_token: "refresh-2",
      recovery: false,
      user,
    });
    const calls = fetcher.mock.calls.map(([u]) => new URL(String(u)).pathname + new URL(String(u)).search);
    expect(calls.slice(2)).toEqual(["/auth/v1/token?grant_type=refresh_token", "/auth/v1/user"]);
    reloaded.dispose();
  });
  it("restores a session saved before H-0044 and rewrites it without the access token", async () => {
    const store = storage();
    store.setItem(
      WARD_AUTH_STORAGE_KEY,
      JSON.stringify({ ...session("old-access"), expiresAt: Date.now() + 3600000, recovery: false }),
    );
    const fetcher = vi.fn(async (u: RequestInfo | URL) =>
      Response.json(String(u).endsWith("/user") ? user : session("renewed")),
    );
    const auth = new SupabaseWardAuth({ url, publishableKey: "sb_publishable_test", storage: store, fetch: fetcher });
    await auth.restore();
    expect(await auth.token()).toBe("renewed");
    expect(store.getItem(WARD_AUTH_STORAGE_KEY)).not.toContain("access");
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
        pathname: "/ward-flow",
        search: "?view=test",
      },
      replace,
    );
    expect(replace).toHaveBeenCalledWith("/ward-flow?view=test");
    expect(result?.recovery).toBe(true);
    expect(result?.access_token).toBe("secret");
  });
  it("refuses an error fragment even when it also includes token fields", () => {
    const replace = vi.fn();
    expect(() =>
      consumeRecoveryFragment(
        {
          hash: "#type=recovery&error=access_denied&access_token=synthetic&refresh_token=synthetic&expires_in=3600",
          pathname: "/ward-flow",
          search: "",
        },
        replace,
      ),
    ).toThrow(/invalid or expired/);
    expect(replace).toHaveBeenCalledWith("/ward-flow");
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

it.each([204, 503])("attempts provider logout (%i) even when removing browser credentials throws", async (status) => {
  const store = storage();
  const fetcher = vi.fn(async (endpoint: RequestInfo | URL) =>
    String(endpoint).includes("/logout")
      ? new Response(null, { status })
      : Response.json(String(endpoint).endsWith("/user") ? user : session()),
  );
  const auth = new SupabaseWardAuth({ url, publishableKey: "sb_publishable_test", storage: store, fetch: fetcher });
  await auth.signIn("synthetic@example.invalid", "synthetic-password");
  store.removeItem = () => {
    throw new Error("storage blocked");
  };
  await expect(auth.signOut()).rejects.toMatchObject({
    kind: "unavailable",
    message: expect.stringContaining("could not remove saved sign-in details"),
  });
  expect(fetcher.mock.calls.some(([endpoint]) => String(endpoint).includes("/logout"))).toBe(true);
  expect(auth.userId).toBeNull();
  await expect(auth.token()).rejects.toMatchObject({ kind: "session" });
  auth.dispose();
});

it("keeps a verified sign-in usable in memory when browser writes fail", async () => {
  const store = storage();
  store.setItem = () => {
    throw new Error("storage full");
  };
  const auth = new SupabaseWardAuth({
    url,
    publishableKey: "sb_publishable_test",
    storage: store,
    fetch: async (endpoint) => Response.json(String(endpoint).endsWith("/user") ? user : session()),
  });
  await expect(auth.signIn("synthetic@example.invalid", "synthetic-password")).resolves.toBeUndefined();
  expect(auth.userId).toBe(user.id);
  expect(await auth.token()).toBe("access");
  auth.dispose();
});

it("treats unavailable browser storage as an empty session on restore", async () => {
  const auth = new SupabaseWardAuth({
    url,
    publishableKey: "sb_publishable_test",
    storage: {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
      removeItem: () => {},
    },
    fetch: async () => {
      throw new Error("must not fetch");
    },
  });
  await expect(auth.restore()).resolves.toBeUndefined();
  expect(auth.userId).toBeNull();
  auth.dispose();
});

it("keeps rotated refresh credentials in memory when browser writes fail", async () => {
  const store = storage();
  let first = true;
  const auth = new SupabaseWardAuth({
    url,
    publishableKey: "sb_publishable_test",
    storage: store,
    fetch: async (endpoint) => {
      if (String(endpoint).endsWith("/user")) return Response.json(user);
      if (first) {
        first = false;
        return Response.json({ ...session(), expires_in: 1 });
      }
      return Response.json(session("rotated"));
    },
  });
  await auth.signIn("synthetic@example.invalid", "synthetic-password");
  store.setItem = () => {
    throw new Error("storage full");
  };
  expect(await auth.token()).toBe("rotated");
  expect(auth.userId).toBe(user.id);
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

it("refuses a bearer value that is not a signed token without asking Supabase about it", async () => {
  // Verified tokens are cached by the authenticator itself (see backend/ward-flow/supabase-auth.test.mjs);
  // a value that is not even shaped like a token must never reach the remote user check.
  const supabaseAuthModulePath = "../backend/ward-flow/supabase-auth.mjs";
  const { createSupabaseAuthenticator } = (await import(supabaseAuthModulePath)) as {
    createSupabaseAuthenticator: (
      config: Record<string, unknown>,
      deps?: Record<string, unknown>,
    ) => (authorization: string) => Promise<string>;
  };
  let fetchCount = 0;
  const coordinatorId = "12345678-1234-1234-1234-123456789abc";
  const authenticator = createSupabaseAuthenticator(
    {
      coordinatorIds: [coordinatorId],
      supabase: { projectRef: "zakzoemeedfepxcstsou", url, publishableKey: "sb_publishable_test" },
    },
    {
      fetch: async () => {
        fetchCount++;
        return Response.json({ id: coordinatorId });
      },
    },
  );

  await expect(authenticator("Bearer test-token-1")).rejects.toThrow("Unauthorised");
  expect(fetchCount).toBe(0);
});

it("trusts the account a refresh reply names, so a reload skips the separate account check (#839)", async () => {
  const store = storage();
  const named = { ...user, email: "synthetic@example.invalid" };
  let issued = 0;
  const fetcher = vi.fn(async (u: RequestInfo | URL) => {
    if (String(u).endsWith("/user")) return Response.json(named);
    issued++;
    return Response.json({ ...session(`access-${issued}`), refresh_token: `refresh-${issued}`, user: named });
  });
  const auth = new SupabaseWardAuth({ url, publishableKey: "sb_publishable_test", storage: store, fetch: fetcher });
  await auth.signIn("synthetic@example.invalid", "private-test-password");
  auth.dispose();
  const reloaded = new SupabaseWardAuth({ url, publishableKey: "sb_publishable_test", storage: store, fetch: fetcher });
  await reloaded.restore();
  expect(await reloaded.token()).toBe("access-2");
  expect(reloaded.userId).toBe(user.id);
  const calls = fetcher.mock.calls.map(([u]) => new URL(String(u)).pathname + new URL(String(u)).search);
  expect(calls.slice(2)).toEqual(["/auth/v1/token?grant_type=refresh_token"]);
  // The email stays in memory for the step-up and is never written to browser storage.
  expect(store.getItem(WARD_AUTH_STORAGE_KEY)).not.toContain("synthetic@example.invalid");
  await reloaded.reauthenticate("private-test-password");
  expect(await reloaded.token()).toBe("access-3");
  reloaded.dispose();
});

it("refuses a refresh reply that names a different account and removes the session (#839)", async () => {
  const store = storage();
  let refreshed = false;
  const fetcher = vi.fn(async (u: RequestInfo | URL) => {
    if (String(u).endsWith("/user")) return Response.json(user);
    if (String(u).includes("grant_type=refresh_token")) refreshed = true;
    return Response.json({
      ...session(),
      expires_in: refreshed ? 3600 : 1,
      user: refreshed ? { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", email: "other@example.invalid" } : user,
    });
  });
  const auth = new SupabaseWardAuth({ url, publishableKey: "sb_publishable_test", storage: store, fetch: fetcher });
  await auth.signIn("synthetic@example.invalid", "synthetic-password");
  await expect(auth.token()).rejects.toMatchObject({ kind: "session" });
  expect(auth.userId).toBeNull();
  expect(store.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
  expect(fetcher.mock.calls.filter(([u]) => String(u).endsWith("/user"))).toHaveLength(1);
  auth.dispose();
});
