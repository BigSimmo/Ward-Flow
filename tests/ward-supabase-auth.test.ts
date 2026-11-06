import { describe, expect, it, vi } from "vitest";
import {
  SupabaseWardAuth,
  WARD_AUTH_STORAGE_KEY,
  consumeRecoveryLink,
  createPkceVerifier,
  pkceChallenge,
} from "../src/components/ward-management/ward-supabase-auth";
import {
  WARD_RECOVERY_VERIFIER_KEY,
  WARD_RECOVERY_VERIFIER_LIFETIME_MS,
} from "../src/components/ward-management/ward-auth-link";
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
  it("refuses the old implicit recovery fragment and still erases it (SEC-2)", () => {
    const replace = vi.fn();
    const store = storage();
    store.setItem(WARD_RECOVERY_VERIFIER_KEY, JSON.stringify({ verifier: "v".repeat(64), createdAt: Date.now() }));
    expect(() =>
      consumeRecoveryLink(
        {
          hash: "#access_token=synthetic-access&refresh_token=synthetic-refresh&expires_in=3600&type=recovery",
          pathname: "/ward-flow",
          search: "?view=test",
        },
        replace,
        store,
      ),
    ).toThrow("The recovery link is invalid or expired. Request a new link.");
    expect(replace).toHaveBeenCalledWith("/ward-flow?view=test");
    // A refused fragment never spends this browser's own pending request.
    expect(store.getItem(WARD_RECOVERY_VERIFIER_KEY)).not.toBeNull();
  });
  it("refuses an error fragment even when it also includes token fields", () => {
    const replace = vi.fn();
    expect(() =>
      consumeRecoveryLink(
        {
          hash: "#type=recovery&error=access_denied&access_token=synthetic&refresh_token=synthetic&expires_in=3600",
          pathname: "/ward-flow",
          search: "",
        },
        replace,
        storage(),
      ),
    ).toThrow(/invalid or expired/);
    expect(replace).toHaveBeenCalledWith("/ward-flow");
  });
  it("erases a signup confirmation fragment quietly", () => {
    const replace = vi.fn();
    expect(
      consumeRecoveryLink(
        { hash: "#type=signup&access_token=synthetic", pathname: "/ward-flow", search: "" },
        replace,
        null,
      ),
    ).toBeNull();
    expect(replace).toHaveBeenCalledWith("/ward-flow");
  });
  it("leaves an address without a link alone", () => {
    const replace = vi.fn();
    expect(
      consumeRecoveryLink({ hash: "#beds", pathname: "/ward-flow", search: "?view=test" }, replace, null),
    ).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("PKCE password recovery (SEC-2)", () => {
  const verifier = "A".repeat(43) + "-_~.";
  const saved = (createdAt = Date.now(), value = verifier) => {
    const store = storage();
    store.setItem(WARD_RECOVERY_VERIFIER_KEY, JSON.stringify({ verifier: value, createdAt }));
    return store;
  };
  it("makes a 64-character base64url verifier, different each time", () => {
    const first = createPkceVerifier();
    expect(first).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(createPkceVerifier()).not.toBe(first);
  });
  it("derives the RFC 7636 worked example SHA-256 challenge", async () => {
    expect(await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });
  it("sends the SHA-256 challenge with the recover request and keeps the verifier in this browser", async () => {
    const link = storage();
    const fetcher = vi.fn(async () => Response.json({}));
    const auth = new SupabaseWardAuth({
      url,
      publishableKey: "sb_publishable_test",
      linkStorage: link,
      fetch: fetcher,
    });
    await auth.recover("synthetic@example.invalid", "https://ward.example.test/ward-flow");
    const [endpoint, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(endpoint).toBe(
      url + "/auth/v1/recover?redirect_to=" + encodeURIComponent("https://ward.example.test/ward-flow"),
    );
    const body = JSON.parse(String(init.body));
    const kept = JSON.parse(link.getItem(WARD_RECOVERY_VERIFIER_KEY)!);
    expect(kept.verifier).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(Math.abs(kept.createdAt - Date.now())).toBeLessThan(5000);
    expect(body).toEqual({
      email: "synthetic@example.invalid",
      code_challenge: await pkceChallenge(kept.verifier),
      code_challenge_method: "s256",
    });
    // The verifier itself never leaves the browser.
    expect(String(init.body)).not.toContain(kept.verifier);
    auth.dispose();
  });
  it("keeps the earlier link's verifier when a resend is refused or the browser is offline", async () => {
    const link = storage();
    let reply = () => Response.json({});
    const fetcher = vi.fn(async () => reply());
    const auth = new SupabaseWardAuth({
      url,
      publishableKey: "sb_publishable_test",
      linkStorage: link,
      fetch: fetcher,
    });
    await auth.recover("synthetic@example.invalid", "https://ward.example.test/ward-flow");
    const first = link.getItem(WARD_RECOVERY_VERIFIER_KEY);
    reply = () => Response.json({}, { status: 422 });
    await expect(
      auth.recover("synthetic@example.invalid", "https://ward.example.test/ward-flow"),
    ).rejects.toMatchObject({ kind: "credentials" });
    expect(link.getItem(WARD_RECOVERY_VERIFIER_KEY)).toBe(first);
    vi.stubGlobal("navigator", { onLine: false });
    await expect(
      auth.recover("synthetic@example.invalid", "https://ward.example.test/ward-flow"),
    ).rejects.toMatchObject({ kind: "unavailable" });
    expect(link.getItem(WARD_RECOVERY_VERIFIER_KEY)).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
    // A timeout may still have sent the email, so its new verifier stays.
    reply = () => {
      throw new TypeError("network");
    };
    await expect(
      auth.recover("synthetic@example.invalid", "https://ward.example.test/ward-flow"),
    ).rejects.toMatchObject({ kind: "unavailable" });
    expect(link.getItem(WARD_RECOVERY_VERIFIER_KEY)).not.toBe(first);
    auth.dispose();
  });
  it("asks for no link when this browser cannot keep the verifier", async () => {
    const fetcher = vi.fn(async () => Response.json({}));
    const auth = new SupabaseWardAuth({ url, publishableKey: "sb_publishable_test", fetch: fetcher });
    await expect(
      auth.recover("synthetic@example.invalid", "https://ward.example.test/ward-flow"),
    ).rejects.toMatchObject({
      kind: "unavailable",
    });
    const blocked = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      removeItem: () => {},
    };
    const refused = new SupabaseWardAuth({
      url,
      publishableKey: "sb_publishable_test",
      linkStorage: blocked,
      fetch: fetcher,
    });
    await expect(
      refused.recover("synthetic@example.invalid", "https://ward.example.test/ward-flow"),
    ).rejects.toMatchObject({ kind: "unavailable" });
    expect(fetcher).not.toHaveBeenCalled();
    auth.dispose();
    refused.dispose();
  });
  it("takes the code off the address and the verifier out of storage, once", () => {
    const store = saved();
    const replace = vi.fn();
    const where = { hash: "", pathname: "/ward-flow", search: "?code=synthetic-code&view=test" };
    expect(consumeRecoveryLink(where, replace, store)).toEqual({ code: "synthetic-code", verifier });
    expect(replace).toHaveBeenCalledWith("/ward-flow?view=test");
    expect(store.getItem(WARD_RECOVERY_VERIFIER_KEY)).toBeNull();
    // The same link opened again finds no verifier.
    expect(() => consumeRecoveryLink(where, vi.fn(), store)).toThrow(
      "Open this link on the device and browser where you asked for it, or ask for a new link here.",
    );
  });
  it("keeps the front door's own address when it carries the code", () => {
    const replace = vi.fn();
    consumeRecoveryLink(
      { hash: "", pathname: "/sign-in", search: "?code=synthetic-code&next=%2Fward-flow" },
      replace,
      saved(),
    );
    expect(replace).toHaveBeenCalledWith("/sign-in?next=%2Fward-flow");
  });
  it("refuses a code opened in another browser or device, with a plain message and no exchange", async () => {
    const replace = vi.fn();
    let error: unknown;
    try {
      consumeRecoveryLink({ hash: "", pathname: "/ward-flow", search: "?code=synthetic-code" }, replace, storage());
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({
      kind: "session",
      message: "Open this link on the device and browser where you asked for it, or ask for a new link here.",
    });
    expect(replace).toHaveBeenCalledWith("/ward-flow");
    expect(() =>
      consumeRecoveryLink({ hash: "", pathname: "/ward-flow", search: "?code=synthetic-code" }, vi.fn(), null),
    ).toThrow(/device and browser where you asked/);
  });
  it("refuses and clears a verifier older than the link's hour", () => {
    const store = saved(Date.now() - WARD_RECOVERY_VERIFIER_LIFETIME_MS - 1);
    expect(() =>
      consumeRecoveryLink({ hash: "", pathname: "/ward-flow", search: "?code=synthetic-code" }, vi.fn(), store),
    ).toThrow("The recovery link is invalid or expired. Request a new link.");
    expect(store.getItem(WARD_RECOVERY_VERIFIER_KEY)).toBeNull();
    // Just inside the hour still works.
    const fresh = saved(Date.now() - WARD_RECOVERY_VERIFIER_LIFETIME_MS + 60000);
    expect(
      consumeRecoveryLink({ hash: "", pathname: "/ward-flow", search: "?code=synthetic-code" }, vi.fn(), fresh),
    ).toEqual({ code: "synthetic-code", verifier });
  });
  it("refuses a malformed stored verifier", () => {
    expect(() =>
      consumeRecoveryLink(
        { hash: "", pathname: "/ward-flow", search: "?code=synthetic-code" },
        vi.fn(),
        saved(Date.now(), "short"),
      ),
    ).toThrow(/device and browser where you asked/);
  });
  it("erases a PKCE error return and reports the link as invalid", () => {
    const replace = vi.fn();
    const store = saved();
    expect(() =>
      consumeRecoveryLink(
        {
          hash: "",
          pathname: "/ward-flow",
          search: "?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid",
        },
        replace,
        store,
      ),
    ).toThrow(/invalid or expired/);
    expect(replace).toHaveBeenCalledWith("/ward-flow");
  });
  it("exchanges the code with the verifier and holds a recovery-only session", async () => {
    const tab = storage();
    const fetcher = vi.fn(async (endpoint: RequestInfo | URL) =>
      String(endpoint).includes("grant_type=pkce")
        ? Response.json({ ...session("recovery-access"), user: { ...user, email: "synthetic@example.invalid" } })
        : Response.json({}, { status: 500 }),
    );
    const auth = new SupabaseWardAuth({ url, publishableKey: "sb_publishable_test", storage: tab, fetch: fetcher });
    await auth.restore({ code: "synthetic-code", verifier });
    const [endpoint, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(endpoint).toBe(url + "/auth/v1/token?grant_type=pkce");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ auth_code: "synthetic-code", code_verifier: verifier });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(auth.isRecovery).toBe(true);
    expect(auth.userId).toBe(user.id);
    expect(auth.accountEmail).toBe("synthetic@example.invalid");
    expect(JSON.parse(tab.getItem(WARD_AUTH_STORAGE_KEY)!).recovery).toBe(true);
    // A recovery session never opens the workspace.
    await expect(auth.token()).rejects.toMatchObject({ kind: "session" });
    auth.dispose();
  });
  it("checks the account with /user when the exchange reply does not name it", async () => {
    const fetcher = vi.fn(async (endpoint: RequestInfo | URL) =>
      Response.json(String(endpoint).endsWith("/user") ? user : session("recovery-access")),
    );
    const auth = new SupabaseWardAuth({ url, publishableKey: "sb_publishable_test", fetch: fetcher });
    await auth.restore({ code: "synthetic-code", verifier });
    expect(fetcher.mock.calls.map(([endpoint]) => String(endpoint))).toEqual([
      url + "/auth/v1/token?grant_type=pkce",
      url + "/auth/v1/user",
    ]);
    expect(auth.isRecovery).toBe(true);
    auth.dispose();
  });
  it("finishes a failed account check before a password change and never spends the code again", async () => {
    const tab = storage();
    let userUp = false;
    const fetcher = vi.fn<(endpoint: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async (endpoint) => {
      if (String(endpoint).includes("grant_type=pkce")) return Response.json(session("recovery-access"));
      return userUp ? Response.json(user) : Response.json({}, { status: 503 });
    });
    const auth = new SupabaseWardAuth({ url, publishableKey: "sb_publishable_test", storage: tab, fetch: fetcher });
    await expect(auth.restore({ code: "synthetic-code", verifier })).rejects.toMatchObject({ kind: "unavailable" });
    expect(auth.isRecovery).toBe(true);
    expect(auth.userId).toBeNull();
    // Still unchecked: no password is sent.
    await expect(auth.updatePassword("new-private-password")).rejects.toMatchObject({ kind: "unavailable" });
    expect(fetcher.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "PUT")).toBe(false);
    userUp = true;
    await auth.updatePassword("new-private-password");
    const calls = fetcher.mock.calls.map(
      ([endpoint, init]) =>
        `${(init as RequestInit | undefined)?.method ?? "GET"} ${String(endpoint).replace(url, "")}`,
    );
    expect(calls.filter((call) => call.includes("grant_type=pkce"))).toHaveLength(1);
    expect(calls.slice(-2)).toEqual(["GET /auth/v1/user", "PUT /auth/v1/user"]);
    auth.dispose();
  });
  it.each([400, 403, 404, 422])("reports a refused code (%i) as an invalid link", async (status) => {
    const tab = storage();
    const auth = new SupabaseWardAuth({
      url,
      publishableKey: "sb_publishable_test",
      storage: tab,
      fetch: async () => Response.json({}, { status }),
    });
    await expect(auth.restore({ code: "synthetic-code", verifier })).rejects.toMatchObject({
      kind: "session",
      message: "The recovery link is invalid or expired. Request a new link.",
    });
    expect(auth.isRecovery).toBe(false);
    expect(tab.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
    auth.dispose();
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

// TE-09 (audit, 5 Nov 2026): the this-tab-only sign-out (another tab still in use, or the stored
// sign-in already gone) still drops the in-memory session when removing the stored copy throws,
// and says the browser could not remove it rather than failing silently.
it("drops the in-memory session on a this-tab-only sign-out even when removing the stored copy throws", async () => {
  const store = storage();
  const fetcher = vi.fn(async (endpoint: RequestInfo | URL) =>
    Response.json(String(endpoint).endsWith("/user") ? user : session()),
  );
  const auth = new SupabaseWardAuth({ url, publishableKey: "sb_publishable_test", storage: store, fetch: fetcher });
  await auth.signIn("synthetic@example.invalid", "synthetic-password");
  store.removeItem = () => {
    throw new Error("storage blocked");
  };
  await expect(auth.signOut(true)).rejects.toMatchObject({
    kind: "unavailable",
    message: expect.stringContaining("could not remove saved sign-in details"),
  });
  expect(auth.userId).toBeNull();
  await expect(auth.token()).rejects.toMatchObject({ kind: "session" });
  // No server sign-out: another tab may still be using this sign-in.
  expect(fetcher.mock.calls.some(([endpoint]) => String(endpoint).includes("/logout"))).toBe(false);
  auth.dispose();
});

// TE-09: a refresh does not write back a stored sign-in that was removed from this tab since.
it("does not store a refreshed sign-in again once the saved copy was removed", async () => {
  const store = storage();
  const auth = new SupabaseWardAuth({
    url,
    publishableKey: "sb_publishable_test",
    storage: store,
    fetch: async (endpoint) =>
      Response.json(String(endpoint).endsWith("/user") ? user : { ...session("rotated"), expires_in: 1 }),
  });
  await auth.signIn("synthetic@example.invalid", "synthetic-password");
  expect(store.getItem(WARD_AUTH_STORAGE_KEY)).not.toBeNull();
  store.removeItem(WARD_AUTH_STORAGE_KEY);
  expect(await auth.token()).toBe("rotated");
  expect(store.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
  auth.dispose();
});

// SD-05: a removal the adapter made itself, after the browser refused a rotated sign-in, is flagged,
// so the app does not read it as a sign-out elsewhere. A later successful write clears the flag.
it("flags a stored sign-in it removed itself after a refused write", async () => {
  const store = storage();
  const auth = new SupabaseWardAuth({
    url,
    publishableKey: "sb_publishable_test",
    storage: store,
    fetch: async (endpoint) =>
      Response.json(String(endpoint).endsWith("/user") ? user : { ...session(), expires_in: 1 }),
  });
  await auth.signIn("synthetic@example.invalid", "synthetic-password");
  expect(auth.storageLost).toBe(false);
  const setItem = store.setItem;
  store.setItem = () => {
    throw new Error("storage full");
  };
  await auth.token();
  expect(store.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
  expect(auth.storageLost).toBe(true);
  expect(auth.userId).toBe(user.id);
  store.setItem = setItem;
  await auth.token();
  expect(auth.storageLost).toBe(false);
  expect(store.getItem(WARD_AUTH_STORAGE_KEY)).not.toBeNull();
  auth.dispose();
});
