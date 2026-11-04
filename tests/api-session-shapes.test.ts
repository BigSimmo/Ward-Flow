import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/session/route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it.each([{ demoCode: "invalid", extra: true }, { token: "synthetic", demoCode: "invalid" }, { token: 1 }, [], null])(
  "refuses invalid session input before any provider request: %#",
  async (body) => {
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", "synthetic-private-pass-secret-at-least-32-characters");
    const fetcher = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Offline test guard"));
    const response = await POST(
      new NextRequest("https://synthetic.invalid/api/session", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  },
);
