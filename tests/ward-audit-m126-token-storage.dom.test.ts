// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { tabStorage } from "@/components/ward-management/ward-auth-session";
import { WARD_AUTH_STORAGE_KEY } from "@/components/ward-management/ward-auth-link";
import { buildContentSecurityPolicy } from "@/lib/security-headers";

/*
 * Audit M126, GNG row C5: the Supabase refresh token sits in page-readable storage (H-0044). The
 * row closes when the token moves to an HttpOnly cookie on a same-site backend, or the PIA accepts
 * the risk with a session time limit and the strict content security policy kept. That choice is
 * Josh's. Until then this pins the conditions the "accept the risk" option relies on, so neither
 * can slip quietly: the token lives in this tab's sessionStorage only (gone when the tab closes,
 * never in localStorage), the access token is never saved (tests/ward-supabase-auth.test.ts,
 * H-0044), and production scripts run only with a nonce.
 */
const ROOT = path.resolve(__dirname, "..");

afterEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("M126 C5: sign-in token storage", () => {
  it("the sign-in's storage writes to this tab's sessionStorage, never localStorage", () => {
    tabStorage.setItem(WARD_AUTH_STORAGE_KEY, JSON.stringify({ refresh_token: "synthetic-refresh" }));
    expect(window.sessionStorage.getItem(WARD_AUTH_STORAGE_KEY)).toContain("synthetic-refresh");
    expect(window.localStorage.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
    tabStorage.removeItem(WARD_AUTH_STORAGE_KEY);
    expect(window.sessionStorage.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
  });

  it("the one Supabase sign-in is built with tab storage for its session", () => {
    const source = readFileSync(path.join(ROOT, "src/components/ward-management/ward-auth-session.ts"), "utf8");
    expect(source).toMatch(/storage:\s*tabStorage,/);
    // The device-wide store is for the recovery link's PKCE verifier only, never the session.
    expect(source).not.toMatch(/storage:\s*deviceStorage,\s*\n\s*linkStorage/);
  });

  it("production scripts need a nonce: no unsafe-inline or unsafe-eval in script-src", () => {
    const csp = buildContentSecurityPolicy({
      nonce: "c3ludGhldGljLW5vbmNl",
      isDevelopment: false,
      isLocalHttpRuntime: false,
    } as Parameters<typeof buildContentSecurityPolicy>[0]);
    const scriptSrc = /script-src[^;]*/.exec(csp)?.[0] ?? "";
    expect(scriptSrc).toContain("'nonce-c3ludGhldGljLW5vbmNl'");
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toMatch(/unsafe-inline|unsafe-eval/);
  });
});
