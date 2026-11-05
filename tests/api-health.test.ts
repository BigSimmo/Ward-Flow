import { describe, expect, it } from "vitest";
import { GET } from "../src/app/api/health/route";

describe("GET /api/health", () => {
  it("answers the Railway healthcheck with an uncached 200 ok", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const data = await response.json();
    expect(data.status).toBe("ok");
  });
});
