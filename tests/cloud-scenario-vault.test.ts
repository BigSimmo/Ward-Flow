import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkCloudReadiness,
  deleteCloudScenario,
  loadCloudScenario,
  saveCloudScenario,
} from "@/lib/cloud-scenario-vault";

describe("cloud-scenario-vault", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("blocks save when real healthcare identifiers are detected without calling network", async () => {
    const unsafePayload = {
      notes: "Medicare number: 3123 45678 1 recorded",
    };

    const result = await saveCloudScenario(
      "https://example.com/api",
      "token123",
      "11111111-1111-4111-8111-111111111111",
      0,
      unsafePayload,
    );

    expect(result.status).toBe("unsafe_payload");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("saves synthetic scenario cleanly when backend returns 200", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ revision: 2 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await saveCloudScenario(
      "https://example.com/api",
      "token123",
      "11111111-1111-4111-8111-111111111111",
      1,
      { scenario: "synthetic-demo-ward" },
    );

    expect(result.status).toBe("saved");
    if (result.status === "saved") {
      expect(result.revision).toBe(2);
    }
  });

  it("handles 409 conflict gracefully without throwing", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Session changed" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await saveCloudScenario(
      "https://example.com/api",
      "token123",
      "11111111-1111-4111-8111-111111111111",
      1,
      { scenario: "synthetic-demo-ward" },
    );

    expect(result.status).toBe("conflict");
  });

  it("loads scenario and returns payload when found", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          revision: 5,
          payload: { ward: "Ward 2K", beds: 12 },
          updated_at: "2026-10-03T12:00:00Z",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await loadCloudScenario(
      "https://example.com/api",
      "token123",
      "11111111-1111-4111-8111-111111111111",
    );

    expect(result.status).toBe("loaded");
    if (result.status === "loaded") {
      expect(result.revision).toBe(5);
      expect(result.payload).toEqual({ ward: "Ward 2K", beds: 12 });
    }
  });

  it("returns offline status when network call fails", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const result = await loadCloudScenario(
      "https://example.com/api",
      "token123",
      "11111111-1111-4111-8111-111111111111",
    );

    expect(result.status).toBe("offline");
  });

  it("checks readiness against the authenticated readyz endpoint, never healthz", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ storage: "ready" }), { status: 200 }));

    const result = await checkCloudReadiness("https://example.com/api/", " token123 ");

    expect(result.status).toBe("ready");
    const [url, init] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(String(url)).toBe("https://example.com/api/readyz");
    expect(String(url)).not.toContain("healthz");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer token123");
  });

  it("does not report ready when storage is unavailable behind a healthy host", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Storage unavailable" }), { status: 503 }));

    expect(await checkCloudReadiness("https://example.com/api", "token123")).toEqual({
      status: "unavailable",
      message: "HTTP 503",
    });
  });

  it("reports unauthorised for a rejected token and makes no call for a blank token", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));
    expect((await checkCloudReadiness("https://example.com/api", "bad")).status).toBe("unauthorised");

    const callsBefore = mockFetch.mock.calls.length;
    expect((await checkCloudReadiness("https://example.com/api", "   ")).status).toBe("unauthorised");
    expect(mockFetch.mock.calls.length).toBe(callsBefore);
  });

  it("reports offline when the readiness call cannot reach the endpoint", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await checkCloudReadiness("https://example.com/api", "token123")).toEqual({ status: "offline" });
  });

  it.each([0, -1, 1.5, 2, 2_147_483_647])("rejects malformed or unexpected saved revision %s", async (revision) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ revision })));
    expect((await saveCloudScenario("https://example.com", "token", "demo", 0, {})).status).toBe("unavailable");
  });

  it.each([
    { revision: 1, payload: {} },
    { revision: 1.5, payload: {}, updated_at: "2026-10-08T12:00:00Z" },
    { revision: 1, payload: [], updated_at: "2026-10-08T12:00:00Z" },
    { revision: 1, payload: {}, updated_at: "2026-02-31T12:00:00Z" },
    { revision: 1, payload: {}, updated_at: "tomorrow" },
  ])("rejects incomplete or invalid restore envelopes", async (data) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(data)));
    expect((await loadCloudScenario("https://example.com", "token", "demo")).status).toBe("unavailable");
  });

  it("does not classify a non-JSON success body as an offline connection", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("invalid-json"));
    expect((await loadCloudScenario("https://example.com", "token", "demo")).status).toBe("unavailable");
  });

  it("forwards the caller's stable request ID for an unconfirmed save retry", async () => {
    const requestId = "11111111-1111-4111-8111-111111111111";
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ revision: 1 })));
    await saveCloudScenario("https://example.com", "token", "demo", 0, {}, { requestId });
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({
      requestId,
      expectedRevision: 0,
    });
    expect(vi.mocked(fetch).mock.calls[0][1]?.redirect).toBe("error");
  });

  it("bounds a stalled transport and clears its deadline", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>(() => {}));
    const result = saveCloudScenario("https://example.com", "token", "demo", 0, {}, { timeoutMs: 50 });
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    await vi.advanceTimersByTimeAsync(50);
    expect((await result).status).toBe("timeout");
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds response-body parsing as part of the same operation", async () => {
    vi.useFakeTimers();
    const response = new Response("{}");
    vi.spyOn(response, "json").mockImplementation(() => new Promise(() => {}));
    vi.mocked(fetch).mockResolvedValueOnce(response);
    const result = loadCloudScenario("https://example.com", "token", "demo", { timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(50);
    expect((await result).status).toBe("timeout");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("supports caller cancellation without treating it as a confirmed failed write", async () => {
    const controller = new AbortController();
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>(() => {}));
    const result = saveCloudScenario("https://example.com", "token", "demo", 0, {}, { signal: controller.signal });
    controller.abort();
    expect(await result).toMatchObject({ status: "cancelled", message: expect.stringContaining("not confirmed") });
  });

  it("makes no network request if already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(
      (await loadCloudScenario("https://example.com", "token", "demo", { signal: controller.signal })).status,
    ).toBe("cancelled");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    "http://untrusted.example",
    "https://user:password@example.com",
    "https://example.com?token=private",
    "not-a-url",
  ])("rejects unsafe endpoint shape %s before sending a bearer token", async (endpoint) => {
    expect((await loadCloudScenario(endpoint, "token", "demo")).status).toBe("unavailable");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("accepts loopback HTTP for local testing and hides transport exception details", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("private diagnostic including a token"));
    const result = await loadCloudScenario("http://127.0.0.1:8787", "token", "demo");
    expect(result.status).toBe("offline");
    expect(JSON.stringify(result)).not.toContain("private diagnostic");
  });

  it("requires an actual readiness response, not just HTTP 200", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ status: "ok" })));
    expect((await checkCloudReadiness("https://example.com", "token")).status).toBe("unavailable");
  });

  it.each([
    [204, "deleted"],
    [404, "not_found"],
    [409, "conflict"],
    [401, "unauthorised"],
    [503, "unavailable"],
  ] as const)("maps conditional delete HTTP %s to %s", async (status, outcome) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status }));
    expect((await deleteCloudScenario("https://example.com", "token", "demo", 3)).status).toBe(outcome);
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({
      method: "DELETE",
      body: JSON.stringify({ expectedRevision: 3 }),
    });
  });
});
