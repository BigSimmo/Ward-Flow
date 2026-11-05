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
import { edgeAddress, resetWrongTriesForTests } from "@/lib/demo-code-tries";
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
    ])
      expect(isFrontDoorOpenPath(path)).toBe(true);
    for (const path of ["/", "/ward-flow", "/api/workspace", "/sign-in/extra", "/ward-flow-sign-in/extra", "/mockups"])
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
    expect(await demoCodeMatches("ward 7q4k", { WARD_DEMO_CODE: "WARD-7Q4K" })).toBe(true);
    expect(await demoCodeMatches("WARD-7Q4J", { WARD_DEMO_CODE: "WARD-7Q4K" })).toBe(false);
    expect(await demoCodeMatches("", {})).toBe(false);
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
    vi.stubEnv("WARD_DEMO_CODE", "WARD-7Q4K");
    vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "false");
    const right = await POST(post({ demoCode: "ward 7q4k" }, "192.0.2.20"));
    expect(right.status).toBe(204);
    expect(right.headers.getSetCookie().find((line) => line.startsWith(FRONT_DOOR_PASS_COOKIE))).toContain(
      `Max-Age=${8 * 3600}`,
    );
    for (let attempt = 0; attempt < 10; attempt += 1)
      expect((await POST(post({ demoCode: "WRONG" }, "192.0.2.30"))).status).toBe(401);
    expect((await POST(post({ demoCode: "ward 7q4k" }, "192.0.2.30"))).status).toBe(429);
  });

  it("counts wrong tries by the edge's address, not a caller-written forwarded-for", async () => {
    expect(edgeAddress(new Headers({ "x-real-ip": "192.0.2.40", "x-forwarded-for": "198.51.100.1" }))).toBe(
      "192.0.2.40",
    );
    expect(edgeAddress(new Headers({ "x-forwarded-for": "198.51.100.1, 192.0.2.41" }))).toBe("192.0.2.41");
    expect(edgeAddress(new Headers())).toBe("unknown");
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", SECRET);
    vi.stubEnv("WARD_DEMO_CODE", "WARD-7Q4K");
    vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "false");
    for (let attempt = 0; attempt < 10; attempt += 1)
      expect((await POST(post({ demoCode: "WRONG" }, "192.0.2.50", `198.51.100.${attempt}`))).status).toBe(401);
    expect((await POST(post({ demoCode: "WRONG" }, "192.0.2.50", "198.51.100.99"))).status).toBe(429);
  });

  it("pauses every address once wrong tries across all addresses reach the cap", async () => {
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", SECRET);
    vi.stubEnv("WARD_DEMO_CODE", "WARD-7Q4K");
    vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "false");
    for (let attempt = 0; attempt < 200; attempt += 1)
      expect((await POST(post({ demoCode: "WRONG" }, `10.0.${attempt >> 8}.${attempt & 255}`))).status).toBe(401);
    expect((await POST(post({ demoCode: "ward 7q4k" }, "192.0.2.60"))).status).toBe(429);
  });

  it("never opens the signed-in site with a demo code", async () => {
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", SECRET);
    vi.stubEnv("WARD_DEMO_CODE", "WARD-7Q4K");
    vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "true");
    expect((await POST(post({ demoCode: "WARD-7Q4K" }))).status).toBe(400);
  });
});

describe("DELETE /api/session", () => {
  it("clears the pass", () => {
    const response = DELETE(new NextRequest(new URL("https://ward.example.test/api/session"), { method: "DELETE" }));
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toMatch(/^wf_pass=; Path=\/; Max-Age=0;.*HttpOnly; Secure$/);
  });

  it("marks the cookie Secure in production even when the app sees plain http behind the edge", () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = DELETE(new NextRequest(new URL("http://ward.example.test/api/session"), { method: "DELETE" }));
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly; Secure$/);
  });
});
