import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { DELETE, POST } from "@/app/api/session/route";
import {
  FRONT_DOOR_PASS_COOKIE,
  demoCodeMatches,
  frontDoorRequired,
  frontDoorSecret,
  isFrontDoorOpenPath,
  issuePass,
  safeNextPath,
  verifyPass,
} from "@/lib/front-door-pass";
import {
  edgeAddress,
  reserveDemoTry,
  resetWrongTriesForTests,
  trustedProxyAddressesFromEnv,
} from "@/lib/demo-code-tries";
import { frontDoorVerdict } from "../src/proxy";

// Synthetic secrets only: these values exist for this test file.
const SECRET = "synthetic-front-door-secret-0123456789abcdef"; // gitleaks:allow
const ON = { WARD_FRONT_DOOR: "required", WARD_PASS_SECRET: SECRET };
const NOW = Date.UTC(2026, 9, 27, 2, 0, 0);

function page(path: string, pass?: string): NextRequest {
  const request = new NextRequest(new URL(`https://ward.example.test${path}`));
  if (pass) request.cookies.set(FRONT_DOOR_PASS_COOKIE, pass);
  return request;
}

function post(body: unknown, realIp = "192.0.2.10", forwardedFor?: string): NextRequest {
  return new NextRequest(new URL("https://ward.example.test/api/session"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": realIp,
      ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
    },
    body: JSON.stringify(body),
  });
}

/** A token shaped like a Supabase access token, with the sign-in time in `amr`. Not signed: Supabase checks it. */
function token(firstSignInSeconds: number): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: "synthetic", amr: [{ method: "password", timestamp: firstSignInSeconds }] })}.${Buffer.from("synthetic-signature").toString("base64url")}`;
}

afterEach(() => {
  resetWrongTriesForTests();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("front door switch and secret", () => {
  it("stays open unless the switch says required", () => {
    expect(frontDoorRequired({})).toBe(false);
    expect(frontDoorRequired({ WARD_FRONT_DOOR: "true" })).toBe(false);
    expect(frontDoorRequired({ WARD_FRONT_DOOR: " required " })).toBe(true);
  });

  it("fails closed on Railway unless the switch says off", () => {
    expect(frontDoorRequired({ RAILWAY_ENVIRONMENT_NAME: "production" })).toBe(true);
    expect(frontDoorRequired({ RAILWAY_ENVIRONMENT_NAME: "production", WARD_FRONT_DOOR: "requried" })).toBe(true);
    expect(frontDoorRequired({ RAILWAY_ENVIRONMENT: "production" })).toBe(true);
    expect(frontDoorRequired({ RAILWAY_ENVIRONMENT_NAME: "production", WARD_FRONT_DOOR: "off" })).toBe(false);
    expect(frontDoorRequired({ WARD_FRONT_DOOR: "off" })).toBe(false);
  });

  it("refuses a short signing secret", () => {
    expect(frontDoorSecret({ WARD_PASS_SECRET: "short" })).toBeNull();
    expect(frontDoorSecret({ WARD_PASS_SECRET: SECRET })).toBe(SECRET);
  });

  it("opens only the sign-in page, its API and the files a signed-out device still needs", () => {
    for (const path of [
      "/sign-in",
      "/ward-flow-sign-in",
      "/api/session",
      "/api/health",
      "/ward-flow-offline.html",
      "/ward-flow-push-sw.js",
      "/.well-known/security.txt",
    ])
      expect(isFrontDoorOpenPath(path)).toBe(true);
    for (const path of [
      "/",
      "/ward-flow",
      "/api/workspace",
      "/sign-in/extra",
      "/ward-flow-sign-in/extra",
      "/mockups",
      "/.well-known/other.txt",
    ])
      expect(isFrontDoorOpenPath(path)).toBe(false);
  });
});

describe("where sign-in goes next", () => {
  it("keeps a Ward Flow address with its query", () => {
    expect(safeNextPath("/ward-flow/bed-meeting")).toBe("/ward-flow/bed-meeting");
    expect(safeNextPath("/ward-flow/capacity?site=synthetic")).toBe("/ward-flow/capacity?site=synthetic");
  });

  it("sends anything else to Ward Flow's home", () => {
    for (const raw of [
      null,
      "",
      "https://evil.example/ward-flow",
      "//evil.example/ward-flow",
      "/\\evil.example",
      "/ward-flowish",
      "/api/workspace",
      "/ward-flow/../api/workspace",
      `/ward-flow/${"a".repeat(600)}`,
    ])
      expect(safeNextPath(raw)).toBe("/ward-flow");
  });
});

describe("the pass", () => {
  it("verifies a pass it issued until it runs out", async () => {
    const { value, maxAge } = await issuePass(SECRET, { kind: "account", subject: "synthetic-id", hours: 12 }, NOW);
    expect(maxAge).toBe(12 * 3600);
    expect(await verifyPass(SECRET, value, NOW + 1000)).toMatchObject({ kind: "account", subject: "synthetic-id" });
    expect(await verifyPass(SECRET, value, NOW + 12 * 3_600_000)).toBeNull();
  });

  it("imports each signing secret once, and still tells secrets apart", async () => {
    const importKey = vi.spyOn(crypto.subtle, "importKey");
    try {
      const secret = `${SECRET}-memo`;
      const other = `${SECRET}-memo-other`;
      const { value } = await issuePass(secret, { kind: "demo", hours: 8 }, NOW);
      expect(await verifyPass(secret, value, NOW)).toMatchObject({ kind: "demo" });
      expect(await verifyPass(secret, value, NOW + 1000)).toMatchObject({ kind: "demo" });
      expect(importKey).toHaveBeenCalledTimes(1);
      expect(await verifyPass(other, value, NOW)).toBeNull();
      expect(importKey).toHaveBeenCalledTimes(2);
    } finally {
      importKey.mockRestore();
    }
  });

  it("ends with the sign-in's own limit when that comes first", async () => {
    const endsBy = NOW + 3_600_000;
    const { value, maxAge } = await issuePass(SECRET, { kind: "account", hours: 12, endsBy }, NOW);
    expect(maxAge).toBe(3600);
    expect(await verifyPass(SECRET, value, endsBy)).toBeNull();
  });

  it("refuses an altered, foreign or malformed pass", async () => {
    const { value } = await issuePass(SECRET, { kind: "demo", hours: 8 }, NOW);
    const [payload, signature] = value.split(".");
    const forged = Buffer.from(JSON.stringify({ kind: "account", issuedAt: NOW, expiresAt: NOW + 9e9 })).toString(
      "base64url",
    );
    expect(await verifyPass(SECRET, `${forged}.${signature}`, NOW)).toBeNull();
    expect(await verifyPass(`${SECRET}-other`, value, NOW)).toBeNull();
    expect(await verifyPass(null, value, NOW)).toBeNull();
    expect(await verifyPass(SECRET, `${payload}.${signature}.extra`, NOW)).toBeNull();
    expect(await verifyPass(SECRET, "not-a-pass", NOW)).toBeNull();
  });
});

describe("demo code", () => {
  it("matches ignoring case, spaces and dashes, and never when no code is set", async () => {
    expect(await demoCodeMatches("ward 7q4k synth", { WARD_DEMO_CODE: "WARD-7Q4K-SYNTH" })).toBe(true);
    expect(await demoCodeMatches("WARD-7Q4J-SYNTH", { WARD_DEMO_CODE: "WARD-7Q4K-SYNTH" })).toBe(false);
    expect(await demoCodeMatches("", {})).toBe(false);
  });

  it("treats a set code shorter than 12 characters as no code at all", async () => {
    // Eleven characters once spaces and dashes are removed: too guessable to open the site.
    expect(await demoCodeMatches("WARD-7Q4K-SYN", { WARD_DEMO_CODE: "WARD-7Q4K-SYN" })).toBe(false);
    // Exactly twelve opens it.
    expect(await demoCodeMatches("WARD-7Q4K-SYNT", { WARD_DEMO_CODE: "WARD-7Q4K-SYNT" })).toBe(true);
  });
});

describe("proxy front door", () => {
  it("lets everything through while the switch is off", async () => {
    expect(await frontDoorVerdict(page("/ward-flow"), {})).toBeNull();
  });

  it("sends a page without a pass to sign-in, carrying where it was going", async () => {
    const answer = await frontDoorVerdict(page("/ward-flow/bed-meeting?tv=1"), ON);
    expect(answer?.status).toBe(307);
    const to = new URL(answer!.headers.get("location")!);
    expect(to.pathname).toBe("/sign-in");
    expect(to.searchParams.get("next")).toBe("/ward-flow/bed-meeting?tv=1");
  });

  it("carries a recovery link's code onto the sign-in address, never inside next (SEC-2)", async () => {
    const answer = await frontDoorVerdict(page("/ward-flow?code=synthetic-code&view=beds"), ON);
    const to = new URL(answer!.headers.get("location")!);
    expect(to.pathname).toBe("/sign-in");
    expect(to.searchParams.get("code")).toBe("synthetic-code");
    expect(to.searchParams.get("next")).toBe("/ward-flow?view=beds");
    const failed = await frontDoorVerdict(page("/ward-flow?error=access_denied&error_code=otp_expired"), ON);
    const back = new URL(failed!.headers.get("location")!);
    expect(back.searchParams.get("error_code")).toBe("otp_expired");
    expect(back.searchParams.get("next")).toBe("/ward-flow");
    // Only the recovery destination itself carries a link; a deeper page keeps its address whole.
    const deeper = await frontDoorVerdict(page("/ward-flow/capacity?code=synthetic"), ON);
    const kept = new URL(deeper!.headers.get("location")!);
    expect(kept.searchParams.get("code")).toBeNull();
    expect(kept.searchParams.get("next")).toBe("/ward-flow/capacity?code=synthetic");
  });

  it("answers an API call without a pass with 401, not a redirect", async () => {
    const answer = await frontDoorVerdict(page("/api/workspace"), ON);
    expect(answer?.status).toBe(401);
    expect(await answer!.json()).toEqual({ error: "Sign in first.", code: "front_door" });
  });

  it("lets a valid pass and the open paths through", async () => {
    const { value } = await issuePass(SECRET, { kind: "account", hours: 12 });
    expect(await frontDoorVerdict(page("/ward-flow/capacity", value), ON)).toBeNull();
    expect(await frontDoorVerdict(page("/sign-in"), ON)).toBeNull();
    expect(await frontDoorVerdict(page("/ward-flow-sign-in"), ON)).toBeNull();
  });

  it("opens the signed-in (shared) site with an account pass only, never a demo pass", async () => {
    const SHARED = { ...ON, NEXT_PUBLIC_WARD_SHARED_ENABLED: "true" };
    const demo = (await issuePass(SECRET, { kind: "demo", hours: 8 })).value;
    const account = (await issuePass(SECRET, { kind: "account", subject: "synthetic-id", hours: 12 })).value;
    const refused = await frontDoorVerdict(page("/ward-flow/capacity", demo), SHARED);
    expect(refused?.status).toBe(307);
    expect(new URL(refused!.headers.get("location")!).pathname).toBe("/sign-in");
    expect((await frontDoorVerdict(page("/api/workspace", demo), SHARED))?.status).toBe(401);
    expect(await frontDoorVerdict(page("/ward-flow/capacity", account), SHARED)).toBeNull();
    expect(await frontDoorVerdict(page("/sign-in", demo), SHARED)).toBeNull();
    // The public demo still opens with a demo pass.
    expect(await frontDoorVerdict(page("/ward-flow/capacity", demo), ON)).toBeNull();
  });

  it("fails closed without a signing secret", async () => {
    const { value } = await issuePass(SECRET, { kind: "account", hours: 12 });
    const answer = await frontDoorVerdict(page("/ward-flow", value), { WARD_FRONT_DOOR: "required" });
    expect(answer?.status).toBe(307);
  });
});

describe("POST /api/session", () => {
  it("does nothing while the switch is off", async () => {
    const response = await POST(post({ token: "x" }));
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("says sign-in is not set up when the secret is missing", async () => {
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", "");
    expect((await POST(post({ token: "x" }))).status).toBe(503);
  });

  it("refuses malformed tokens before contacting the sign-in provider", async () => {
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", SECRET);
    vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic");
    vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_URL", "https://synthetic.supabase.co");
    const fetcher = vi.fn(async () => new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetcher);
    for (const malformed of ["garbage", "", "e30.e30.", "e30.W10.c2ln", "a".repeat(8193)]) {
      const response = await POST(post({ token: malformed }));
      expect(response.status).toBe(400);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("bounds unverified callers together even when caller-written address headers rotate", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", SECRET);
    vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic");
    vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_URL", "https://synthetic.supabase.co");
    const fetcher = vi.fn(async () => new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetcher);
    const plausible = token(Math.floor(NOW / 1000));
    for (let attempt = 0; attempt < 30; attempt += 1)
      expect((await POST(post({ token: plausible }, `192.0.2.${attempt}`, `198.51.100.${attempt}`))).status).toBe(401);
    const response = await POST(post({ token: plausible }, "203.0.113.1", "203.0.113.2"));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(30);
  });

  it("sets the pass after Supabase accepts the sign-in, ending with its 12-hour limit", async () => {
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", SECRET);
    vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic");
    vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_URL", "https://synthetic.supabase.co");
    const fetcher = vi.fn(async () => Response.json({ id: "synthetic-account" }));
    vi.stubGlobal("fetch", fetcher);
    const signedInSecondsAgo = 2 * 3600;
    const response = await POST(post({ token: token(Math.floor(Date.now() / 1000) - signedInSecondsAgo) }));
    expect(response.status).toBe(204);
    expect(fetcher).toHaveBeenCalledWith("https://synthetic.supabase.co/auth/v1/user", expect.anything());
    const cookies = response.headers.getSetCookie();
    const pass = cookies.find((line) => line.startsWith(`${FRONT_DOOR_PASS_COOKIE}=`))!;
    expect(pass).toContain("HttpOnly");
    expect(pass).toContain("Secure");
    expect(pass).toContain("SameSite=Lax");
    const maxAge = Number(/Max-Age=(\d+)/.exec(pass)![1]);
    expect(maxAge).toBeGreaterThan(10 * 3600 - 60);
    expect(maxAge).toBeLessThanOrEqual(10 * 3600);
    expect(cookies.some((line) => line.startsWith("wf_door=1") && !line.includes("HttpOnly"))).toBe(true);
  });

  it("refuses a sign-in whose12-hour limit passes while provider verification is pending", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", SECRET);
    vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic");
    vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_URL", "https://synthetic.supabase.co");
    let start!: () => void;
    const started = new Promise<void>((resolve) => {
      start = resolve;
    });
    let finish!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        start();
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      }),
    );
    const pending = POST(post({ token: token(NOW / 1000 - 12 * 3600 + 2) }));
    await started;
    vi.setSystemTime(NOW + 5000);
    finish(Response.json({ id: "synthetic-account" }));
    const response = await pending;
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("uses the remaining sign-in lifetime after a successful delayed verification", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", SECRET);
    vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic");
    vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_URL", "https://synthetic.supabase.co");
    let start!: () => void;
    const started = new Promise<void>((resolve) => {
      start = resolve;
    });
    let finish!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        start();
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      }),
    );
    const pending = POST(post({ token: token(NOW / 1000 - 12 * 3600 + 20) }));
    await started;
    vi.setSystemTime(NOW + 5000);
    finish(Response.json({ id: "synthetic-account" }));
    const response = await pending;
    expect(response.status).toBe(204);
    const cookie = response.headers.getSetCookie().find((line) => line.startsWith("wf_pass="))!;
    expect(cookie).toContain("Max-Age=15;");
    const pass = await verifyPass(SECRET, cookie.split(";")[0].slice(8), Date.now());
    expect(pass).toMatchObject({ issuedAt: NOW + 5000, expiresAt: NOW + 20000 });
  });

  it("does not acknowledge a pass with less than one second of cookie lifetime", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW + 500);
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", SECRET);
    vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic");
    vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_URL", "https://synthetic.supabase.co");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ id: "synthetic-account" })),
    );
    const response = await POST(post({ token: token(NOW / 1000 - 12 * 3600 + 1) }));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each([
    { remaining: 2, elapsed: 3000, status: 401, maxAge: null },
    { remaining: 20, elapsed: 5000, status: 204, maxAge: 15 },
  ])("rechecks cookie lifetime after asynchronous signing: %j", async ({ remaining, elapsed, status, maxAge }) => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", SECRET);
    vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic");
    vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_URL", "https://synthetic.supabase.co");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ id: "synthetic-account" })),
    );
    let start!: () => void;
    const started = new Promise<void>((resolve) => {
      start = resolve;
    });
    let finish!: () => void;
    const release = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const nativeSign = crypto.subtle.sign.bind(crypto.subtle);
    const signing = vi.spyOn(crypto.subtle, "sign").mockImplementationOnce(async (...args) => {
      start();
      await release;
      return nativeSign(...args);
    });
    try {
      const pending = POST(post({ token: token(NOW / 1000 - 12 * 3600 + remaining) }));
      await started;
      vi.setSystemTime(NOW + elapsed);
      finish();
      const response = await pending;
      expect(response.status).toBe(status);
      if (maxAge === null) expect(response.headers.get("set-cookie")).toBeNull();
      else {
        const cookie = response.headers.getSetCookie().find((line) => line.startsWith("wf_pass="))!;
        expect(cookie).toContain(`Max-Age=${maxAge};`);
        expect(await verifyPass(SECRET, cookie.split(";")[0].slice(8), Date.now())).not.toBeNull();
      }
    } finally {
      finish();
      signing.mockRestore();
    }
  });

  it("refuses a sign-in Supabase refuses, and says busy when Supabase cannot answer", async () => {
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", SECRET);
    vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic");
    vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_URL", "https://synthetic.supabase.co");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    expect((await POST(post({ token: token(Math.floor(Date.now() / 1000)) }))).status).toBe(401);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect((await POST(post({ token: token(Math.floor(Date.now() / 1000)) }))).status).toBe(503);
  });

  it("opens the public demo with the right code and pauses after too many wrong ones", async () => {
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", SECRET);
    vi.stubEnv("WARD_DEMO_CODE", "WARD-7Q4K-SYNTH");
    vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "false");
    vi.stubEnv("WARD_TRUSTED_PROXY_ADDRESSES", "*");
    const right = await POST(post({ demoCode: "ward 7q4k synth" }, "192.0.2.20"));
    expect(right.status).toBe(204);
    expect(right.headers.getSetCookie().find((line) => line.startsWith(FRONT_DOOR_PASS_COOKIE))).toContain(
      `Max-Age=${8 * 3600}`,
    );
    for (let attempt = 0; attempt < 10; attempt += 1)
      expect((await POST(post({ demoCode: "WRONG" }, "192.0.2.30"))).status).toBe(401);
    expect((await POST(post({ demoCode: "ward 7q4k synth" }, "192.0.2.30"))).status).toBe(429);
  });

  it("counts wrong tries by a trusted hop's address, not a caller-written forwarded-for (A4-02)", async () => {
    const dual = new Headers({ "x-real-ip": "192.0.2.40", "x-forwarded-for": "198.51.100.1" });
    const forwardedOnly = new Headers({ "x-forwarded-for": "198.51.100.1, 192.0.2.41" });
    expect(edgeAddress(dual, ["*"])).toBe("192.0.2.40");
    expect(edgeAddress(forwardedOnly, ["*"])).toBe("192.0.2.41");
    expect(edgeAddress(dual, ["10.0.0.2"], "10.0.0.2")).toBe("192.0.2.40");
    expect(edgeAddress(dual, ["10.0.0.2"], "::ffff:10.0.0.2")).toBe("192.0.2.40");
    expect(edgeAddress(dual, ["10.0.0.2"], "198.51.100.8")).toBe("198.51.100.8");
    expect(edgeAddress(dual, ["10.0.0.2"])).toBe("unknown");
    expect(edgeAddress(new Headers(), ["*"])).toBe("unknown");
    // D-147 fallback: with no trusted proxy configured, keying stays as before A4-02.
    expect(edgeAddress(dual, [])).toBe("192.0.2.40");
    expect(edgeAddress(forwardedOnly, [])).toBe("192.0.2.41");
    expect(edgeAddress(new Headers(), [])).toBe("unknown");
    // #1615: on the Next service only `*` applies; an IP-only list is dropped with one warning.
    const warn = vi.fn();
    expect(trustedProxyAddressesFromEnv({ WARD_TRUSTED_PROXY_ADDRESSES: "10.0.0.2, *, not-an-ip" }, warn)).toEqual([
      "*",
    ]);
    expect(trustedProxyAddressesFromEnv({}, warn)).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
    expect(trustedProxyAddressesFromEnv({ WARD_TRUSTED_PROXY_ADDRESSES: "10.0.0.2, not-an-ip" }, warn)).toEqual([]);
    expect(trustedProxyAddressesFromEnv({ WARD_TRUSTED_PROXY_ADDRESSES: "10.0.0.3" }, warn)).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toBe("ward_front_door_config_warning");
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", SECRET);
    vi.stubEnv("WARD_DEMO_CODE", "WARD-7Q4K-SYNTH");
    vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "false");
    vi.stubEnv("WARD_TRUSTED_PROXY_ADDRESSES", "*");
    for (let attempt = 0; attempt < 10; attempt += 1)
      expect((await POST(post({ demoCode: "WRONG" }, "192.0.2.50", `198.51.100.${attempt}`))).status).toBe(401);
    expect((await POST(post({ demoCode: "WRONG" }, "192.0.2.50", "198.51.100.99"))).status).toBe(429);
  });

  it("keeps per-address keying while no trusted proxy is configured (D-147)", async () => {
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", SECRET);
    vi.stubEnv("WARD_DEMO_CODE", "WARD-7Q4K-SYNTH");
    vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "false");
    vi.stubEnv("WARD_TRUSTED_PROXY_ADDRESSES", "");
    for (let attempt = 0; attempt < 10; attempt += 1)
      expect((await POST(post({ demoCode: "WRONG" }, "192.0.2.70"))).status).toBe(401);
    expect((await POST(post({ demoCode: "WRONG" }, "192.0.2.70"))).status).toBe(429);
    // Another address keeps its own budget, so one guesser cannot refuse every presenter.
    expect((await POST(post({ demoCode: "WRONG" }, "192.0.2.71"))).status).toBe(401);
    expect((await POST(post({ demoCode: "ward 7q4k synth" }, "192.0.2.72"))).status).toBe(204);
  });

  it("ignores an IP-only trusted proxy list on the Next route, so one guesser cannot lock everyone out (#1615)", async () => {
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", SECRET);
    vi.stubEnv("WARD_DEMO_CODE", "WARD-7Q4K-SYNTH");
    vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "false");
    vi.stubEnv("WARD_TRUSTED_PROXY_ADDRESSES", "10.0.0.2");
    for (let attempt = 0; attempt < 10; attempt += 1)
      expect((await POST(post({ demoCode: "WRONG" }, "192.0.2.80"))).status).toBe(401);
    expect((await POST(post({ demoCode: "WRONG" }, "192.0.2.80"))).status).toBe(429);
    // The route has no socket, so the list falls back to D-147 keying: other callers keep their budget.
    expect((await POST(post({ demoCode: "WRONG" }, "192.0.2.81"))).status).toBe(401);
    expect((await POST(post({ demoCode: "ward 7q4k synth" }, "192.0.2.82"))).status).toBe(204);
  });

  it("refuses wrong codes once tries across all addresses reach the cap, but still opens with the right code", async () => {
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", SECRET);
    vi.stubEnv("WARD_DEMO_CODE", "WARD-7Q4K-SYNTH");
    vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "false");
    vi.stubEnv("WARD_TRUSTED_PROXY_ADDRESSES", "*");
    for (let attempt = 0; attempt < 200; attempt += 1)
      expect((await POST(post({ demoCode: "WRONG" }, `10.0.${attempt >> 8}.${attempt & 255}`))).status).toBe(401);
    expect((await POST(post({ demoCode: "WRONG" }, "192.0.2.61"))).status).toBe(429);
    expect((await POST(post({ demoCode: "ward 7q4k synth" }, "192.0.2.60"))).status).toBe(204);
    // The per-address limit still applies at the cap.
    for (let attempt = 0; attempt < 9; attempt += 1)
      expect((await POST(post({ demoCode: "WRONG" }, "192.0.2.61"))).status).toBe(429);
    expect((await POST(post({ demoCode: "ward 7q4k synth" }, "192.0.2.61"))).status).toBe(429);
  });

  it("checks the code before a full address table refuses, so the right code from a new address opens (M53)", async () => {
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", SECRET);
    vi.stubEnv("WARD_DEMO_CODE", "WARD-7Q4K-SYNTH");
    vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "false");
    vi.stubEnv("WARD_TRUSTED_PROXY_ADDRESSES", "*");
    // Fill the 5,000-address table with wrong tries 9.5 minutes ago, so each is still counted while
    // the 200-try window across all addresses (opened by an earlier try) has already passed.
    const opened = Date.now() - 10.5 * 60_000;
    const first = reserveDemoTry("10.9.9.9", opened);
    const address = (index: number) => `10.${index >> 16}.${(index >> 8) & 255}.${index & 255}`;
    for (let index = 0; index < 4_999; index += 1)
      expect(reserveDemoTry(address(index), opened + 60_000)).not.toBeNull();
    first?.release();
    expect(reserveDemoTry(address(4_999), opened + 60_000)).not.toBeNull();
    expect((await POST(post({ demoCode: "ward 7q4k synth" }, "192.0.2.70"))).status).toBe(204);
    // The table being full still pauses a wrong code from a new address, without forgetting anyone.
    expect((await POST(post({ demoCode: "WRONG" }, "192.0.2.71"))).status).toBe(429);
    expect(reserveDemoTry(address(0), Date.now())).toMatchObject({ overCap: false });
  });

  it("never opens the signed-in site with a demo code", async () => {
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", SECRET);
    vi.stubEnv("WARD_DEMO_CODE", "WARD-7Q4K-SYNTH");
    vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "true");
    expect((await POST(post({ demoCode: "WARD-7Q4K" }))).status).toBe(400);
  });
});

describe("DELETE /api/session", () => {
  it("clears the pass", () => {
    const response = DELETE(new NextRequest(new URL("https://ward.example.test/api/session"), { method: "DELETE" }));
    expect(response.status).toBe(204);
    const [pass, marker] = response.headers.getSetCookie();
    expect(pass).toMatch(/^wf_pass=; Path=\/; Max-Age=0;.*HttpOnly; Secure$/);
    // Live audit item 19: the readable marker goes too, so nothing stays after sign-out.
    expect(marker).toBe("wf_door=; Path=/; Max-Age=0; SameSite=Lax; Secure");
  });

  it("marks the cookie Secure in production even when the app sees plain http behind the edge", () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = DELETE(new NextRequest(new URL("http://ward.example.test/api/session"), { method: "DELETE" }));
    const [pass, marker] = response.headers.getSetCookie();
    expect(pass).toMatch(/HttpOnly; Secure$/);
    expect(marker).toMatch(/; Secure$/);
  });
});
