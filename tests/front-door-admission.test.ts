import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFrontDoorVerifier } from "@/lib/front-door-admission";

const origin = "https://synthetic.supabase.co";
const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = (alg = "HS256") =>
  `${part({ alg, typ: "JWT" })}.${part({ sub: "synthetic-account", amr: [] })}.${Buffer.from("synthetic-signature").toString("base64url")}`;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_URL", origin);
  vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("front-door token shape", () => {
  it.each([
    "",
    "garbage",
    "a".repeat(8193),
    "e30.e30.",
    "e30.e30.c2ln.extra",
    "e30.e30.c2ln=",
    " e30.e30.c2ln",
    "e30.e30.x",
    "e30.W10.c2ln",
    `${part(null)}.e30.c2ln`,
    `${part("header")}.e30.c2ln`,
    `e30.${Buffer.from("{").toString("base64url")}.c2ln`,
  ])("rejects malformed input locally: %#", async (malformed) => {
    const send = vi.fn(async () => new Response(null, { status: 401 }));
    expect(await createFrontDoorVerifier({ fetch: send })(malformed)).toBe("malformed");
    expect(send).not.toHaveBeenCalled();
  });

  it.each(["HS256", "ES256", "RS256"])("lets the provider decide a plausible %s token without a kid", async (alg) => {
    const send = vi.fn(async () => Response.json({ id: "account-without-workspace-membership" }));
    expect(await createFrontDoorVerifier({ fetch: send })(token(alg))).toEqual({
      id: "account-without-workspace-membership",
    });
    expect(send).toHaveBeenCalledExactlyOnceWith(`${origin}/auth/v1/user`, {
      headers: { apikey: "sb_publishable_synthetic", authorization: `Bearer ${token(alg)}` },
      cache: "no-store",
      redirect: "error",
      signal: expect.any(AbortSignal),
    });
  });

  it("keeps configuration failures local", async () => {
    vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_URL", "https://unapproved.example.invalid");
    const send = vi.fn(async () => Response.json({ id: "synthetic" }));
    expect(await createFrontDoorVerifier({ fetch: send })(token())).toBe("unavailable");
    expect(send).not.toHaveBeenCalled();
  });
});

describe("front-door admission", () => {
  it("charges refused and unavailable checks to the client budget and recovers at the minute boundary", async () => {
    let now = 10_000;
    const send = vi.fn(async () => new Response(null, { status: 401 }));
    const verify = createFrontDoorVerifier({ fetch: send, now: () => now });
    for (let index = 0; index < 29; index += 1) expect(await verify(token())).toBe("refused");
    send.mockRejectedValueOnce(new Error("synthetic offline"));
    expect(await verify(token())).toBe("unavailable");
    expect(await verify(token())).toBe("rate-limited");
    expect(send).toHaveBeenCalledTimes(30);
    now += 59_999;
    expect(await verify(token())).toBe("rate-limited");
    now += 1;
    expect(await verify(token())).toBe("refused");
    expect(send).toHaveBeenCalledTimes(31);
  });

  it("caps all explicitly verified client identities together and discards only expired windows", async () => {
    let now = 10_000;
    const send = vi.fn(async () => new Response(null, { status: 401 }));
    const verify = createFrontDoorVerifier({ fetch: send, now: () => now });
    for (let client = 0; client < 10; client += 1)
      for (let attempt = 0; attempt < 30; attempt += 1)
        expect(await verify(token(), `server-verified-client-${client}`)).toBe("refused");
    expect(await verify(token(), "server-verified-new-client")).toBe("rate-limited");
    expect(await verify(token(), "server-verified-client-0")).toBe("rate-limited");
    expect(send).toHaveBeenCalledTimes(300);
    now += 60_000;
    expect(await verify(token(), "server-verified-new-client")).toBe("refused");
    expect(send).toHaveBeenCalledTimes(301);
  });

  it("refuses concurrency pressure immediately, without queuing, and releases settled permits", async () => {
    const finish: Array<(response: Response) => void> = [];
    const send = vi.fn(() => new Promise<Response>((resolve) => finish.push(resolve)));
    const verify = createFrontDoorVerifier({ fetch: send });
    const pending = Array.from({ length: 8 }, () => verify(token()));
    expect(send).toHaveBeenCalledTimes(8);
    expect(await verify(token())).toBe("rate-limited");
    expect(send).toHaveBeenCalledTimes(8);
    finish.forEach((resolve, index) => resolve(new Response(null, { status: index % 2 ? 401 : 503 })));
    expect(await Promise.all(pending)).toEqual([
      "unavailable",
      "refused",
      "unavailable",
      "refused",
      "unavailable",
      "refused",
      "unavailable",
      "refused",
    ]);
    send.mockResolvedValueOnce(Response.json({ id: "synthetic-recovered" }));
    expect(await verify(token())).toEqual({ id: "synthetic-recovered" });
    expect(send).toHaveBeenCalledTimes(9);
  });

  it("documents independent process budgets rather than promising a distributed limit", async () => {
    const send = vi.fn(async () => new Response(null, { status: 401 }));
    const first = createFrontDoorVerifier({ fetch: send });
    const second = createFrontDoorVerifier({ fetch: send });
    for (let attempt = 0; attempt < 30; attempt += 1) await first(token());
    expect(await first(token())).toBe("rate-limited");
    expect(await second(token())).toBe("refused");
    expect(send).toHaveBeenCalledTimes(31);
  });
});

describe("front-door verifier deadline", () => {
  it.each(["headers", "body"])(
    "aborts stalled %s, releases native-contract operations and admits a later check",
    async (stage) => {
      vi.useFakeTimers();
      const signals: AbortSignal[] = [];
      const send = vi.fn((_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const signal = init!.signal!;
        signals.push(signal);
        if (stage === "headers")
          return new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), { once: true });
          });
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"id":'));
            signal.addEventListener("abort", () => controller.error(signal.reason), { once: true });
          },
        });
        return Promise.resolve(new Response(body, { status: 200 }));
      });
      const verify = createFrontDoorVerifier({ fetch: send });
      const pending = Array.from({ length: 8 }, () => verify(token()));
      await vi.advanceTimersByTimeAsync(7999);
      expect(signals.every((signal) => !signal.aborted)).toBe(true);
      expect(await verify(token())).toBe("rate-limited");
      await vi.advanceTimersByTimeAsync(1);
      expect(await Promise.all(pending)).toEqual(Array(8).fill("unavailable"));
      expect(signals.every((signal) => signal.aborted)).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
      send.mockResolvedValueOnce(Response.json({ id: "synthetic-after-timeout" }));
      expect(await verify(token())).toEqual({ id: "synthetic-after-timeout" });
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("bounds non-cooperative transport work after its caller deadline instead of accumulating abandoned checks", async () => {
    vi.useFakeTimers();
    const finish: Array<(response: Response) => void> = [];
    const send = vi.fn(() => new Promise<Response>((resolve) => finish.push(resolve)));
    const verify = createFrontDoorVerifier({ fetch: send });
    const pending = Array.from({ length: 8 }, () => verify(token()));
    await vi.advanceTimersByTimeAsync(8000);
    expect(await Promise.all(pending)).toEqual(Array(8).fill("unavailable"));
    expect(await verify(token())).toBe("rate-limited");
    expect(send).toHaveBeenCalledTimes(8);
    finish.forEach((resolve) => resolve(new Response(null, { status: 401 })));
    await vi.advanceTimersByTimeAsync(0);
    send.mockResolvedValueOnce(Response.json({ id: "synthetic-after-settlement" }));
    expect(await verify(token())).toEqual({ id: "synthetic-after-settlement" });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("front-door admission under a fake-token flood (review 8 Nov 2026)", () => {
  const forSubject = (sub: string) =>
    `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub })}.${Buffer.from("synthetic-signature").toString("base64url")}`;

  it("gives each claimed subject its own budget, so one caller cannot spend everyone's", async () => {
    const send = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      String((init?.headers as Record<string, string>).authorization).includes(part({ sub: "synthetic-staff" }))
        ? Response.json({ id: "synthetic-staff" })
        : new Response(null, { status: 401 }),
    );
    const verify = createFrontDoorVerifier({ fetch: send, now: () => 10_000 });
    for (let attempt = 0; attempt < 30; attempt += 1)
      expect(await verify(forSubject("synthetic-fake"))).toBe("refused");
    expect(await verify(forSubject("synthetic-fake"))).toBe("rate-limited");
    expect(await verify(forSubject("synthetic-staff"))).toEqual({ id: "synthetic-staff" });
  });

  it("lets an account the provider accepted recently through when rotating fake subjects fill the shared cap", async () => {
    let now = 10_000;
    const send = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      String((init?.headers as Record<string, string>).authorization).includes(part({ sub: "synthetic-staff" }))
        ? Response.json({ id: "synthetic-staff" })
        : new Response(null, { status: 401 }),
    );
    const verify = createFrontDoorVerifier({ fetch: send, now: () => now });
    expect(await verify(forSubject("synthetic-staff"))).toEqual({ id: "synthetic-staff" });
    now += 60_000;
    for (let attempt = 0; attempt < 300; attempt += 1)
      expect(await verify(forSubject(`synthetic-fake-${attempt}`))).toBe("refused");
    expect(await verify(forSubject("synthetic-new-fake"))).toBe("rate-limited");
    expect(await verify(forSubject("synthetic-staff"))).toEqual({ id: "synthetic-staff" });
    now += 12 * 60 * 60_000;
    for (let attempt = 0; attempt < 300; attempt += 1) await verify(forSubject(`synthetic-later-fake-${attempt}`));
    expect(await verify(forSubject("synthetic-staff"))).toBe("rate-limited");
  });
  it("refuses an anonymous account and never remembers it as a known account", async () => {
    let now = 10_000;
    const send = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const authorization = String((init?.headers as Record<string, string>).authorization);
      if (authorization.includes(part({ sub: "synthetic-guest" })))
        return Response.json({ id: "synthetic-guest", is_anonymous: true });
      if (authorization.includes(part({ sub: "synthetic-staff" })))
        return Response.json({ id: "synthetic-staff", is_anonymous: false });
      return new Response(null, { status: 401 });
    });
    const verify = createFrontDoorVerifier({ fetch: send, now: () => now });
    expect(await verify(forSubject("synthetic-guest"))).toBe("refused");
    expect(await verify(forSubject("synthetic-staff"))).toEqual({ id: "synthetic-staff" });
    now += 60_000;
    for (let attempt = 0; attempt < 300; attempt += 1)
      expect(await verify(forSubject(`synthetic-fake-${attempt}`))).toBe("refused");
    expect(await verify(forSubject("synthetic-guest"))).toBe("rate-limited");
    expect(await verify(forSubject("synthetic-staff"))).toEqual({ id: "synthetic-staff" });
  });
});
