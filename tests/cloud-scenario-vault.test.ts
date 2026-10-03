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

  it("checks readiness against healthz endpoint when unauthenticated", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ service: "ward-flow-backend" }), {
        status: 200,
      }),
    );

    const result = await checkCloudReadiness("https://example.com/api");
    expect(result.status).toBe("ready");
    expect(mockFetch).toHaveBeenCalledWith("https://example.com/api/healthz", {
      method: "GET",
      headers: {},
    });
  });

  it("probes authenticated readyz endpoint when auth token is provided", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ storage: "ready" }), {
        status: 200,
      }),
    );

    const result = await checkCloudReadiness("https://example.com/api", "secret-token");
    expect(result.status).toBe("ready");
    expect(mockFetch).toHaveBeenCalledWith("https://example.com/api/readyz", {
      method: "GET",
      headers: { Authorization: "Bearer secret-token" },
    });
  });
});
