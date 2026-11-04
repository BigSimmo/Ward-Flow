import { afterEach, describe, expect, it, vi } from "vitest";
import { withRequestLog } from "../src/lib/api-request-log";
import { logger } from "../src/lib/logger";

afterEach(() => vi.restoreAllMocks());
describe("API request identity", () => {
  it("keeps response contracts while rejecting a spoofed request id and private context", async () => {
    const log = vi.spyOn(logger, "info").mockImplementation(() => {});
    const handler = withRequestLog(() => Response.json({ status: "ok" }));
    const response = await handler(
      new Request("https://synthetic.invalid/api/health?note=SYNTHETIC_PRIVATE_SENTINEL", {
        headers: { "x-request-id": "SYNTHETIC_PRIVATE_SENTINEL", authorization: "SYNTHETIC_PRIVATE_SENTINEL" },
      }),
    );
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/i);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("SYNTHETIC_PRIVATE_SENTINEL");
  });
  it("returns a correlated generic failure without leaking the thrown message", async () => {
    vi.spyOn(logger, "error").mockImplementation(() => {});
    const response = await withRequestLog(() => {
      throw new Error("SYNTHETIC_PRIVATE_SENTINEL");
    })(new Request("https://synthetic.invalid/api/health"));
    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(await response.text()).not.toContain("SYNTHETIC_PRIVATE_SENTINEL");
  });
});
