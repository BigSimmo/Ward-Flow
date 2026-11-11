// Audit M67 and M52 (10 November 2026): the post-release check, run offline against local stand-ins
// for the two sites, the backend and Supabase sign-in. The run against live needs Josh's yes.
import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, buildSecurityHeaders } from "@/lib/security-headers";
import {
  CSP_PARTS,
  EXPECTED_HEADERS,
  SERVICES,
  postReleaseCheck,
  waitForDeployments,
} from "../scripts/ward-flow/post-release-check.mjs";

const live = "a".repeat(40);
const older = "b".repeat(40);
const hosted = { isDevelopment: false, isLocalHttpRuntime: false };
const csp = buildContentSecurityPolicy({ ...hosted, nonce: "c3ludGhldGlj" });
const goodHeaders = () =>
  new Headers([
    ...buildSecurityHeaders(hosted).map(({ key, value }) => [key, value] as [string, string]),
    ["content-security-policy", csp],
  ]);
const urls = {
  demoUrl: "http://demo.test",
  sharedUrl: "http://shared.test",
  backendUrl: "http://backend.test",
  supabaseUrl: "http://auth.test",
};
const monitor = {
  email: "monitor@example.test",
  password: "synthetic-password",
  publishableKey: "sb_publishable_synthetic",
};

type Plan = { headers?: Headers; workspace?: number; signIn?: number; backend?: number; calls: string[] };
function stand_in(plan: Plan) {
  return async (input: URL | string, init: RequestInit = {}) => {
    const url = new URL(String(input));
    plan.calls.push(`${init.method ?? "GET"} ${url.host}${url.pathname}`);
    const json = (status: number, body: unknown, headers?: Headers) =>
      new Response(JSON.stringify(body), { status, headers: headers ?? { "content-type": "application/json" } });
    if (url.pathname === "/api/health") return json(200, { status: "ok" });
    if (url.pathname === "/healthz") return json(plan.backend ?? 200, { service: "ward-flow-backend", status: "ok" });
    if (url.host === "shared.test" && url.pathname === "/") return json(200, {}, plan.headers ?? goodHeaders());
    if (url.pathname === "/auth/v1/token")
      return json(plan.signIn ?? 200, plan.signIn && plan.signIn !== 200 ? {} : { access_token: "synthetic-token" });
    if (url.pathname === "/auth/v1/logout") return new Response(null, { status: 204 });
    if (url.pathname === "/v1/workspace")
      return json(plan.workspace ?? 200, { data: { source: "synthetic" }, snapshot: { revision: 1 } });
    return json(404, {});
  };
}
const onLive = async () => Object.fromEntries(SERVICES.map((service) => [service, live]));

describe("M67: post-release check", () => {
  it("passes every check when each service runs live's commit and every answer is right", async () => {
    const plan: Plan = { calls: [] };
    const record = await postReleaseCheck({
      fetcher: stand_in(plan),
      readDeployments: onLive,
      liveSha: live,
      urls,
      monitor,
      now: new Date("2026-11-10T22:30:00Z"),
    });
    expect(record.pass).toBe(true);
    expect(record.checks.map((check: { name: string }) => check.name)).toEqual([
      "railway-runs-live-commit",
      "demo-health",
      "shared-health",
      "backend-health",
      "security-headers",
      "synthetic-sign-in-read",
    ]);
    // Read-only: the only POSTs are the monitor's sign-in and sign-out, never a save.
    expect(plan.calls.filter((call) => call.startsWith("POST"))).toEqual([
      "POST auth.test/auth/v1/token",
      "POST auth.test/auth/v1/logout",
    ]);
    expect(JSON.stringify(record)).not.toMatch(/synthetic-password|synthetic-token/u);
  });

  it("waits for Railway, then names the service still on an older commit", async () => {
    const answers = [
      { "ward-flow": older, "ward-flow-shared": older, "ward-flow-backend": older },
      { "ward-flow": live, "ward-flow-shared": older, "ward-flow-backend": live },
    ];
    const sleeps: number[] = [];
    const behind = await waitForDeployments(async () => (answers.length > 1 ? answers.shift() : answers[0]), live, {
      attempts: 3,
      delayMs: 5,
      sleep: async (ms: number) => void sleeps.push(ms),
    });
    expect(behind).toEqual({
      name: "railway-runs-live-commit",
      pass: false,
      detail: "not on aaaaaaa: ward-flow-shared",
    });
    expect(sleeps).toEqual([5, 5]);
    const caughtUp = await waitForDeployments(onLive, live, { attempts: 1 });
    expect(caughtUp.pass).toBe(true);
  });

  it("counts a Railway read that fails as not deployed, never as a pass", async () => {
    const record = await waitForDeployments(
      async () => {
        throw new Error("synthetic");
      },
      live,
      { attempts: 1 },
    );
    expect(record.pass).toBe(false);
  });

  it("fails the header check when a header the code builds is missing or the policy lost a part (M52)", async () => {
    const headers = goodHeaders();
    headers.delete("x-frame-options");
    headers.set("content-security-policy", csp.replace("frame-ancestors 'none'; ", ""));
    const record = await postReleaseCheck({
      fetcher: stand_in({ headers, calls: [] }),
      readDeployments: onLive,
      liveSha: live,
      urls,
      monitor,
    });
    const check = record.checks.find((item: { name: string }) => item.name === "security-headers");
    expect(record.pass).toBe(false);
    expect(check?.detail).toBe(
      "missing or different: x-frame-options, content-security-policy (frame-ancestors 'none')",
    );
  });

  it("fails the sign-in and read check when the workspace does not load, and still signs out", async () => {
    const plan: Plan = { workspace: 503, calls: [] };
    const record = await postReleaseCheck({
      fetcher: stand_in(plan),
      readDeployments: onLive,
      liveSha: live,
      urls,
      monitor,
    });
    expect(record.checks.at(-1)).toEqual({ name: "synthetic-sign-in-read", pass: false, detail: "workspace HTTP 503" });
    expect(plan.calls).toContain("POST auth.test/auth/v1/logout");
  });

  it("fails rather than skips when the monitor account is not set", async () => {
    const record = await postReleaseCheck({
      fetcher: stand_in({ calls: [] }),
      readDeployments: onLive,
      liveSha: live,
      urls,
      monitor: { email: "", password: "", publishableKey: "" },
    });
    expect(record.checks.at(-1)?.detail).toBe("monitor account not set");
    expect(record.pass).toBe(false);
  });

  it("keeps its header list equal to what the code builds for a hosted runtime", () => {
    expect(EXPECTED_HEADERS).toEqual(
      Object.fromEntries(buildSecurityHeaders(hosted).map(({ key, value }) => [key.toLowerCase(), value])),
    );
    for (const part of CSP_PARTS) expect(csp).toContain(part);
  });

  it("refuses hosted addresses without --yes-live, before any request", () => {
    const script = path.resolve(import.meta.dirname, "../scripts/ward-flow/post-release-check.mjs");
    const run = spawnSync(
      process.execPath,
      [
        script,
        ...["--live-sha", live, "--deployments", "missing.json"],
        ...["--demo-url", "https://example.invalid", "--shared-url", "https://example.invalid"],
        ...["--backend-url", "https://example.invalid", "--supabase-url", "https://example.invalid"],
      ],
      { encoding: "utf8" },
    );
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("needs Josh's yes");
  });
});
