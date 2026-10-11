import { describe, expect, it, vi } from "vitest";
import { SupabaseWardAuth, WARD_AUTH_STORAGE_KEY } from "../src/components/ward-management/ward-supabase-auth";
const url = "https://zakzoemeedfepxcstsou.supabase.co";
describe("confirmation-only nominated signup", () => {
  it("rejects other emails without any request", async () => {
    const fetcher = vi.fn();
    const auth = new SupabaseWardAuth({
      url,
      publishableKey: "sb_publishable_test",
      coordinatorEmail: "nominated@example.invalid",
      fetch: fetcher,
    });
    await expect(auth.signUp("other@example.invalid", "password")).rejects.toMatchObject({ kind: "credentials" });
    expect(fetcher).not.toHaveBeenCalled();
    auth.dispose();
  });
  it("submits normalized nominated email and never adopts signup tokens", async () => {
    const setItem = vi.fn();
    const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ id: "12345678-1234-1234-1234-123456789abc" }),
    );
    const auth = new SupabaseWardAuth({
      url,
      publishableKey: "sb_publishable_test",
      coordinatorEmail: "Nominated@example.invalid",
      storage: { getItem: () => null, setItem, removeItem: vi.fn() },
      fetch: fetcher,
    });
    await auth.signUp(" nominated@EXAMPLE.invalid ", "private-password");
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toEqual({
      email: "nominated@example.invalid",
      password: "private-password",
    });
    expect(String(fetcher.mock.calls[0][0])).toContain("/signup");
    await expect(auth.token()).rejects.toMatchObject({ kind: "session" });
    expect(setItem).not.toHaveBeenCalled();
    auth.dispose();
  });
  it("refuses unexpected auto-login from confirmation-disabled configuration", async () => {
    const store = new Map<string, string>();
    const auth = new SupabaseWardAuth({
      url,
      publishableKey: "sb_publishable_test",
      coordinatorEmail: "nominated@example.invalid",
      storage: {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => store.set(k, v),
        removeItem: (k) => {
          store.delete(k);
        },
      },
      fetch: async () => Response.json({ access_token: "unexpected", refresh_token: "unexpected" }),
    });
    await expect(auth.signUp("nominated@example.invalid", "password")).rejects.toMatchObject({ kind: "credentials" });
    expect(store.get(WARD_AUTH_STORAGE_KEY)).toBeUndefined();
    await expect(auth.token()).rejects.toMatchObject({ kind: "session" });
    auth.dispose();
  });
});
