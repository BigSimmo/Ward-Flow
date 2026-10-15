import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/local-project-id/route";

describe("/api/local-project-id", () => {
  it("answers a local dev caller with the project identity", async () => {
    const response = await GET(
      new Request("http://localhost:4215/api/local-project-id", { headers: { host: "localhost:4215" } }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).identityPath).toBe("/api/local-project-id");
  });

  it("is a plain 404 on the hosted site, with no project hash or port range", async () => {
    const response = await GET(
      new Request("https://ward-flow-production.up.railway.app/api/local-project-id", {
        headers: { host: "ward-flow-production.up.railway.app" },
      }),
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ error: "Not found" });
  });

  it("is a 404 when a local server is reached through a foreign Host header", async () => {
    const response = await GET(
      new Request("http://127.0.0.1:4215/api/local-project-id", { headers: { host: "rebind.example" } }),
    );
    expect(response.status).toBe(404);
  });
});
