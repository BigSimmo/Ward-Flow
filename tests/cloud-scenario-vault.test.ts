import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkCloudReadiness, loadCloudScenario, saveCloudScenario } from "@/lib/cloud-scenario-vault";

describe("cloud-scenario-vault", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
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
});
