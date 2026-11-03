import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/session/route";

function request(body: string) {
  return new NextRequest("https://ward.example.test/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("session request JSON shape", () => {
  beforeEach(() => {
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", "synthetic-private-fixture-signing-secret-only");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("Invalid requests must not contact a provider");
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each(["null", "[]", '[{"token":"synthetic"}]', '"synthetic"', "false", "42", "{", "{}"])(
    "refuses invalid request %s without credentials or a provider call",
    async (body) => {
      const response = await POST(request(body));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Sign in again." });
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("preserves the disabled front door's no-op response for null", async () => {
    vi.stubEnv("WARD_FRONT_DOOR", "off");
    const response = await POST(request("null"));
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
