import { describe, expect, it } from "vitest";
import { GET } from "../src/app/api/health/route";

describe("GET /api/health", () => {
  it("returns HTTP 200 with status ok and synthetic indicator", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe("ok");
    expect(data.appName).toBe("Ward Flow");
    expect(data.synthetic).toBe(true);
    expect(typeof data.timestamp).toBe("string");
  });
});
