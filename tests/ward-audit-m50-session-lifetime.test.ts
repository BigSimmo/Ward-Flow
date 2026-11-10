import { describe, expect, it } from "vitest";

import { SupabaseWardAuth, WARD_AUTH_STORAGE_KEY } from "../src/components/ward-management/ward-supabase-auth";
import { CLINICAL_VALUES } from "../src/components/ward-management/ward-clinical-values";
import { ACCOUNT_PASS_HOURS, DEMO_PASS_HOURS, issuePass, verifyPass } from "../src/lib/front-door-pass";

/**
 * Master audit M50 (10 Nov 2026): session lifetime on shared computers. The inventory of every
 * setting is `docs/ward-flow/governance/session-lifetime.md`; this file pins the values it quotes and
 * adds the two races it found untested. Synthetic account; no provider is contacted.
 */
const url = "https://zakzoemeedfepxcstsou.supabase.co";
const user = { id: "12345678-1234-1234-1234-123456789abc" };
const tabStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => void values.set(k, v),
    removeItem: (k: string) => void values.delete(k),
  };
};

/**
 * A fake sign-in provider with Supabase's refresh rules: each refresh token is used once and
 * replaced; a second use inside the reuse interval gets the same new pair, and a later one is
 * refused. `clock` stands for the provider's own time.
 */
function provider(reuseSeconds: number) {
  let clock = 0;
  let issued = 0;
  const spent = new Map<string, { at: number; answer: { access_token: string; refresh_token: string } }>();
  const live = new Set(["refresh-0"]);
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const address = String(input);
    if (address.endsWith("/user")) return Response.json(user);
    const token = (JSON.parse(String(init?.body ?? "{}")) as { refresh_token?: string }).refresh_token ?? "";
    const before = spent.get(token);
    if (before && clock - before.at <= reuseSeconds) return Response.json({ ...before.answer, expires_in: 3600, user });
    if (!live.has(token))
      return Response.json(
        { error: "invalid_grant", error_description: "Invalid Refresh Token: Already Used" },
        { status: 400 },
      );
    live.delete(token);
    issued++;
    const answer = { access_token: `access-${issued}`, refresh_token: `refresh-${issued}` };
    live.add(answer.refresh_token);
    spent.set(token, { at: clock, answer });
    return Response.json({ ...answer, expires_in: 3600, user });
  };
  return { fetch, advance: (seconds: number) => (clock += seconds) };
}

/** A tab duplicated from a signed-in one starts with a copy of its session storage. */
function duplicatedTabs() {
  const saved = JSON.stringify({ refresh_token: "refresh-0", recovery: false, user });
  const first = tabStorage();
  const second = tabStorage();
  first.setItem(WARD_AUTH_STORAGE_KEY, saved);
  second.setItem(WARD_AUTH_STORAGE_KEY, saved);
  return { first, second };
}

describe("M50: the values the inventory quotes", () => {
  it("pins the sign-in limit, its warning, the idle lock, the step-up window and both front door passes", () => {
    expect(CLINICAL_VALUES.sessionLimit).toMatchObject({ value: 12, unit: "hours" });
    expect(CLINICAL_VALUES.sessionWarning).toMatchObject({ value: 10, unit: "minutes" });
    expect(CLINICAL_VALUES.idleLock).toMatchObject({ value: 15, unit: "minutes" });
    expect(CLINICAL_VALUES.stepUpWindow).toMatchObject({ value: 10, unit: "minutes" });
    expect(ACCOUNT_PASS_HOURS).toBe(CLINICAL_VALUES.sessionLimit.value);
    expect(DEMO_PASS_HOURS).toBe(8);
  });

  it("ends a demo pass at 8 hours, not the account's 12", async () => {
    const secret = "m50-synthetic-signing-secret-0123456789abcdef"; // gitleaks:allow (synthetic test value)
    const now = Date.parse("2026-11-10T00:00:00Z");
    const { value: pass, maxAge } = await issuePass(secret, { kind: "demo", hours: DEMO_PASS_HOURS }, now);
    expect(maxAge).toBe(8 * 3600);
    expect(await verifyPass(secret, pass, now + 8 * 3_600_000 - 1_000)).not.toBeNull();
    expect(await verifyPass(secret, pass, now + 8 * 3_600_000 + 1_000)).toBeNull();
  });
});

describe("M50: refresh races between two tabs holding one sign-in", () => {
  it("keeps both duplicated tabs signed in when they refresh inside the provider's reuse interval", async () => {
    const { fetch } = provider(10);
    const { first, second } = duplicatedTabs();
    const a = new SupabaseWardAuth({ url, publishableKey: "sb_publishable_test", storage: first, fetch });
    const b = new SupabaseWardAuth({ url, publishableKey: "sb_publishable_test", storage: second, fetch });
    await Promise.all([a.restore(), b.restore()]);
    expect(a.userId).toBe(user.id);
    expect(b.userId).toBe(user.id);
    expect(await a.token()).toBe("access-1");
    expect(await b.token()).toBe("access-1");
    a.dispose();
    b.dispose();
  });

  it("signs the late duplicated tab out cleanly, keeping nothing, when its copy was already spent", async () => {
    const { fetch, advance } = provider(10);
    const { first, second } = duplicatedTabs();
    const a = new SupabaseWardAuth({ url, publishableKey: "sb_publishable_test", storage: first, fetch });
    await a.restore();
    advance(60);
    const b = new SupabaseWardAuth({ url, publishableKey: "sb_publishable_test", storage: second, fetch });
    await expect(b.restore()).rejects.toBeDefined();
    expect(b.userId).toBeNull();
    expect(second.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
    // The first tab is untouched: it still holds its own rotated sign-in.
    expect(a.userId).toBe(user.id);
    expect(JSON.parse(first.getItem(WARD_AUTH_STORAGE_KEY)!).refresh_token).toBe("refresh-1");
    a.dispose();
    b.dispose();
  });
});
