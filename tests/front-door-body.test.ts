import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/session/route";
import { resetWrongTriesForTests } from "@/lib/demo-code-tries";

const secret = "synthetic-body-read-secret-0123456789abcdef"; // gitleaks:allow
const valid = JSON.stringify({ demoCode: "SYNTHETIC-CODE" });
const encoder = new TextEncoder();
function request(
  body: string | ReadableStream<Uint8Array>,
  headers: Record<string, string> = {},
  signal?: AbortSignal,
) {
  return new NextRequest("https://ward.example.test/api/session", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
    signal,
    // Node's Web Request stream contract; NextRequest supports streamed bodies.
    ...{ duplex: "half" as const },
  });
}
function incomplete(signal?: AbortSignal) {
  let close!: () => void;
  let cancelled = false;
  let closed = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('{"demoCode":"'));
      close = () => {
        if (!cancelled && !closed) {
          closed = true;
          controller.close();
        }
      };
    },
    cancel() {
      cancelled = true;
    },
  });
  return { request: request(body, {}, signal), close, cancelled: () => cancelled };
}

beforeEach(() => {
  vi.stubEnv("WARD_FRONT_DOOR", "required");
  vi.stubEnv("WARD_PASS_SECRET", secret);
  vi.stubEnv("WARD_DEMO_CODE", "SYNTHETIC-CODE");
  vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "false");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Body failures must never reach a provider");
    }),
  );
});
afterEach(() => {
  resetWrongTriesForTests();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function refusal(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
}

describe("front-door raw body bounds", () => {
  it("rejects an oversized declared length before reading the body", async () => {
    const input = request(valid, { "content-length": "20000" });
    const reader = vi.spyOn(input.body!, "getReader");
    await refusal(await POST(input), 413);
    expect(reader).not.toHaveBeenCalled();
  });

  it.each([undefined, "1"])("counts actual bytes even with missing or understated length: %s", async (length) => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(valid + " ".repeat(16_384)));
        controller.close();
      },
    });
    await refusal(await POST(request(body, length === undefined ? {} : { "content-length": length })), 413);
  });

  it("accepts the16KiB boundary but refuses the next byte", async () => {
    expect((await POST(request(valid + " ".repeat(16_384 - encoder.encode(valid).byteLength)))).status).toBe(204);
    await refusal(await POST(request(valid + " ".repeat(16_385 - encoder.encode(valid).byteLength))), 413);
  });

  it("uses UTF8 byte size rather than JavaScript character count", async () => {
    const body = JSON.stringify({ demoCode: "界".repeat(200) }) + " ".repeat(15_800);
    expect(body.length).toBeLessThan(16_384);
    expect(encoder.encode(body).byteLength).toBeGreaterThan(16_384);
    await refusal(await POST(request(body)), 413);
  });

  it("parses valid Unicode split inside a multibyte character", async () => {
    const bytes = encoder.encode(JSON.stringify({ demoCode: "界" }));
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
        controller.close();
      },
    });
    // The JSON is valid; the supplied code is simply incorrect.
    await refusal(await POST(request(body)), 401);
  });

  it("accepts a canonical8192-character token without truncating its body", async () => {
    const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const claims = { sub: "synthetic-account", amr: [], padding: "" };
    //6114ASCII payload bytes produce8152base64url characters;36header+2dots+2signature=8192.
    claims.padding = "x".repeat(6114 - Buffer.byteLength(JSON.stringify(claims)));
    const token = `${part({ alg: "HS256", typ: "JWT" })}.${part(claims)}.cw`;
    expect(token.length).toBe(8192);
    vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_URL", "https://synthetic.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ id: "synthetic-account" })),
    );
    const response = await POST(request(JSON.stringify({ token })));
    expect(response.status).toBe(204);
    expect(response.headers.getSetCookie().some((cookie) => cookie.startsWith("wf_pass="))).toBe(true);
  });

  it.each(["null", "{", "[]", '{"token":"x","extra":true}'])(
    "keeps malformed or unsupported JSON refused: %s",
    async (body) => {
      await refusal(await POST(request(body)), 400);
    },
  );

  it("cancels an oversized stream without waiting for its cancellation callback", async () => {
    vi.useFakeTimers();
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    let wasCancelled = false;
    const cancelled = vi.fn(() => {
      wasCancelled = true;
      return new Promise<void>(() => {});
    });
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        stream = controller;
        controller.enqueue(encoder.encode(valid + " ".repeat(16_384)));
      },
      cancel: cancelled,
    });
    const pending = POST(request(body));
    let response: Response | undefined;
    void pending.then((value) => {
      response = value;
    });
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(response?.status).toBe(413);
      expect(cancelled).toHaveBeenCalledOnce();
      await refusal(await pending, 413);
    } finally {
      // The baseline had no size bound, so end its stream before awaiting that old read.
      if (!wasCancelled) stream.close();
      await pending;
    }
  });
});

describe("front-door body read lifetime", () => {
  it("returns408 after5seconds, cancels the read and permits a later sign-in", async () => {
    vi.useFakeTimers();
    const held = incomplete();
    const pending = POST(held.request);
    let response: Response | undefined;
    void pending.then((value) => {
      response = value;
    });
    try {
      await vi.advanceTimersByTimeAsync(4999);
      expect(response).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      expect(response?.status).toBe(408);
      expect(held.cancelled()).toBe(true);
      await refusal(await pending, 408);
      expect((await POST(request(valid))).status).toBe(204);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      held.close();
      await pending;
    }
  });

  it("refuses a ninth pending body without a queue and releases actual completed reads", async () => {
    vi.useFakeTimers();
    const held = Array.from({ length: 9 }, () => incomplete());
    const pending = held.map((value) => POST(value.request));
    let ninth: Response | undefined;
    void pending[8].then((response) => {
      ninth = response;
    });
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(ninth?.status).toBe(429);
      expect(ninth?.headers.get("retry-after")).toBe("5");
      held.slice(0, 8).forEach((value) => value.close());
      expect((await Promise.all(pending.slice(0, 8))).every((response) => response.status === 400)).toBe(true);
      expect((await POST(request(valid))).status).toBe(204);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      held.forEach((value) => value.close());
      await Promise.all(pending);
    }
  });

  it.each(["before", "during"])("refuses an aborted request %s reading", async (when) => {
    vi.useFakeTimers();
    const abort = new AbortController();
    if (when === "before") abort.abort();
    const held = incomplete(abort.signal);
    const pending = POST(held.request);
    let response: Response | undefined;
    void pending.then((value) => {
      response = value;
    });
    try {
      if (when === "during") {
        await vi.advanceTimersByTimeAsync(0);
        abort.abort();
      }
      await vi.advanceTimersByTimeAsync(0);
      expect(response?.status).toBe(400);
      await refusal(await pending, 400);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      held.close();
      await pending;
    }
  });

  it("retains read permits after timeout until a noncooperative reader actually settles", async () => {
    vi.useFakeTimers();
    const finish: Array<(value: ReadableStreamReadResult<Uint8Array<ArrayBuffer>>) => void> = [];
    const releases: Array<ReturnType<typeof vi.fn>> = [];
    const inputs = Array.from({ length: 8 }, () => {
      const input = request("{");
      const release = vi.fn();
      releases.push(release);
      const reader = {
        read: () =>
          new Promise<ReadableStreamReadResult<Uint8Array<ArrayBuffer>>>((resolve) => {
            finish.push(resolve);
          }),
        cancel: () => new Promise<void>(() => {}),
        releaseLock: release,
        closed: new Promise<void>(() => {}),
      } as ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>;
      vi.spyOn(input.body!, "getReader").mockReturnValue(reader);
      return input;
    });
    const pending = inputs.map((input) => POST(input));
    const completed: Response[] = [];
    pending.forEach((read) => {
      void read.then((response) => {
        completed.push(response);
      });
    });
    const waiting = incomplete();
    const extra = POST(waiting.request);
    let extraResponse: Response | undefined;
    void extra.then((response) => {
      extraResponse = response;
    });
    try {
      await vi.advanceTimersByTimeAsync(5000);
      expect(completed.map((response) => response.status)).toEqual(Array(8).fill(408));
      expect(releases.every((release) => release.mock.calls.length === 0)).toBe(true);
      expect(extraResponse?.status).toBe(429);
      await refusal(await POST(request(valid)), 429);
      finish.forEach((resolve) => resolve({ done: true, value: undefined }));
      await vi.advanceTimersByTimeAsync(0);
      expect(releases.every((release) => release.mock.calls.length === 1)).toBe(true);
      expect((await POST(request(valid))).status).toBe(204);
    } finally {
      finish.forEach((resolve) => resolve({ done: true, value: undefined }));
      waiting.close();
      await Promise.all([...pending, extra]);
    }
  });

  it.each([
    { event: "timeout", empty: false, status: 408 },
    { event: "timeout", empty: true, status: 408 },
    { event: "abort", empty: false, status: 400 },
    { event: "abort", empty: true, status: 400 },
  ])(
    "stops after the pending noncooperative read settles following interruption: %j",
    async ({ event, empty, status }) => {
      vi.useFakeTimers();
      const abort = new AbortController();
      const finish: Array<(value: ReadableStreamReadResult<Uint8Array<ArrayBuffer>>) => void> = [];
      const reads: Array<ReturnType<typeof vi.fn>> = [];
      const inputs = Array.from({ length: 8 }, () => {
        const input = request("{", {}, abort.signal);
        const read = vi.fn(
          () =>
            new Promise<ReadableStreamReadResult<Uint8Array<ArrayBuffer>>>((resolve) => {
              finish.push(resolve);
            }),
        );
        reads.push(read);
        vi.spyOn(input.body!, "getReader").mockReturnValue({
          read,
          cancel: () => new Promise<void>(() => {}),
          releaseLock() {},
          closed: new Promise<void>(() => {}),
        } as ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>);
        return input;
      });
      const pending = inputs.map((input) => POST(input));
      try {
        if (event === "abort") abort.abort();
        await vi.advanceTimersByTimeAsync(event === "timeout" ? 5000 : 0);
        expect((await Promise.all(pending)).map((response) => response.status)).toEqual(Array(8).fill(status));
        await refusal(await POST(request(valid)), 429);
        finish[0]({ done: false, value: empty ? new Uint8Array() : Uint8Array.of(123) });
        await vi.advanceTimersByTimeAsync(0);
        expect(reads[0]).toHaveBeenCalledTimes(1);
        expect((await POST(request(valid))).status).toBe(204);
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        finish.forEach((resolve) => resolve({ done: true, value: undefined }));
        await vi.advanceTimersByTimeAsync(0);
        await Promise.all(pending);
      }
    },
  );

  it("does not start reading while the front door is off or its secret is missing", async () => {
    const off = incomplete();
    const missing = incomplete();
    const offReader = vi.spyOn(off.request.body!, "getReader");
    const missingReader = vi.spyOn(missing.request.body!, "getReader");
    vi.stubEnv("WARD_FRONT_DOOR", "off");
    expect((await POST(off.request)).status).toBe(204);
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", "");
    await refusal(await POST(missing.request), 503);
    expect(offReader).not.toHaveBeenCalled();
    expect(missingReader).not.toHaveBeenCalled();
    off.close();
    missing.close();
  });
});
