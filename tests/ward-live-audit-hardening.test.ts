import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { ROLE_SCREENS, WARD_ACCESS_ROLES } from "@/components/ward-management/ward-role-access";
import { untilAborted } from "@/components/ward-management/ward-shared-client-helpers";
import { THEME_BOOTSTRAP_SCRIPT, LEGACY_WARD_APPEARANCE_KEY, THEME_COOKIE_NAME } from "@/lib/theme";

const root = join(__dirname, "..");

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("live audit item 14: the sign-in token wait has its own deadline", () => {
  it("rejects with a plain error once the wait passes, so the normal retry shows", async () => {
    vi.useFakeTimers();
    const stuck = untilAborted(new Promise<string>(() => {}), undefined);
    const settled = expect(stuck).rejects.toThrow("Sign-in check timed out");
    await vi.advanceTimersByTimeAsync(15_000);
    await settled;
  });

  it("passes an answer or a failure straight through, and still stops with the poll", async () => {
    await expect(untilAborted(Promise.resolve("token"), undefined, 50)).resolves.toBe("token");
    await expect(untilAborted(Promise.reject(new Error("refused")), undefined, 50)).rejects.toThrow("refused");
    const poll = new AbortController();
    const stopped = untilAborted(new Promise<string>(() => {}), poll.signal, 50);
    poll.abort();
    await expect(stopped).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("live audit item 21: the access log says TV board only for a desk that opens it", () => {
  it("keeps the server's TV roles in step with the roles that open the bed meeting screen", () => {
    const source = readFileSync(join(root, "backend/ward-flow/shared-http.mjs"), "utf8");
    const match = /const TV_BOARD_ROLES = new Set\(\[([^\]]*)\]\)/u.exec(source);
    expect(match).not.toBeNull();
    const server = [...match![1].matchAll(/"([a-z_]+)"/gu)].map((entry) => entry[1]).sort();
    const opens = WARD_ACCESS_ROLES.filter((role) => ROLE_SCREENS[role]["bed-meeting"] !== undefined).sort();
    expect(server).toEqual(opens);
  });
});

describe("live audit item 15: security.txt", () => {
  it("names a contact and a future expiry (RFC 9116)", () => {
    const text = readFileSync(join(root, "public/.well-known/security.txt"), "utf8");
    expect(text).toMatch(/^Contact: https:\/\/github\.com\/BigSimmo\/Ward-Flow\/security\/advisories\/new$/mu);
    const expires = /^Expires: (\S+)$/mu.exec(text)?.[1];
    expect(Number.isFinite(Date.parse(expires ?? ""))).toBe(true);
  });
});

describe("live audit item 18: the theme start-up script's cookie is Secure over https", () => {
  function migrate(protocol: string) {
    vi.stubGlobal("location", { protocol });
    const store: Record<string, string> = { [LEGACY_WARD_APPEARANCE_KEY]: "dark" };
    const page = {
      cookie: "",
      documentElement: {
        classList: { toggle() {} },
        setAttribute() {},
        removeAttribute() {},
        getAttribute: () => null,
      },
      querySelectorAll: () => [],
    };
    new Function("localStorage", "window", "document", THEME_BOOTSTRAP_SCRIPT)(
      {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => (store[key] = value),
        removeItem: (key: string) => delete store[key],
      },
      { matchMedia: () => ({ matches: false, addEventListener() {} }) },
      page,
    );
    return page.cookie;
  }

  it("adds Secure on https and leaves it off on plain http", () => {
    expect(migrate("https:")).toBe(`${THEME_COOKIE_NAME}=dark; path=/; max-age=31536000; SameSite=Lax; Secure`);
    expect(migrate("http:")).toBe(`${THEME_COOKIE_NAME}=dark; path=/; max-age=31536000; SameSite=Lax`);
  });
});

describe("live audit item 19: sign-out leaves no readable Ward Flow cookie", () => {
  it("clears the desk cookie, Secure over https", async () => {
    const writes: string[] = [];
    vi.stubGlobal("location", { protocol: "https:" });
    vi.stubGlobal("document", {
      set cookie(value: string) {
        writes.push(value);
      },
      get cookie() {
        return "";
      },
    });
    const { syncWardDeskHeldCookie } = await import("@/components/ward-management/shell/ward-desk-early");
    syncWardDeskHeldCookie(false);
    syncWardDeskHeldCookie(null);
    expect(writes).toEqual([
      "wardflow-desk-held=1;path=/ward-flow;SameSite=Strict;Secure",
      "wardflow-desk-held=;path=/ward-flow;SameSite=Strict;max-age=0;Secure",
    ]);
  });

  it("the sign-out sweep clears the desk cookie", async () => {
    vi.resetModules();
    const sync = vi.fn();
    vi.doMock("@/components/ward-management/shell/ward-desk-early", () => ({ syncWardDeskHeldCookie: sync }));
    try {
      const { endWardFlowBrowserSession } = await import("@/components/ward-management/ward-browser-data");
      endWardFlowBrowserSession();
      expect(sync).toHaveBeenCalledWith(null);
    } finally {
      vi.doUnmock("@/components/ward-management/shell/ward-desk-early");
    }
  });
});

describe("live audit item 23: zod builds no code in the browser", () => {
  it("the executive statistics contract turns zod's jitless mode on as it loads", async () => {
    const { z } = await import("zod");
    z.config({ jitless: false });
    vi.resetModules();
    await import("@/components/ward-management/statistics/executive-statistics-contract");
    expect(z.config().jitless).toBe(true);
  });
});
