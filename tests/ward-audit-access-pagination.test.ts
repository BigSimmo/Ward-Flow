import { expect, it } from "vitest";
import { SharedWorkspaceClient } from "@/components/ward-management/ward-shared-client";

it("reads all directory pages, including an empty scoped page, before publishing the list", async () => {
  const paths: string[] = [];
  const client = new SharedWorkspaceClient({
    baseUrl: "https://ward.example.test",
    token: async () => "synthetic",
    changed: () => {},
    fetch: async (url) => {
      paths.push(String(url));
      return Response.json(
        paths.length === 1
          ? { memberships: [{ id: "first" }], requests: [], complete: false, nextCursor: "page2" }
          : paths.length === 2
            ? { memberships: [], complete: false, nextCursor: "page3" }
            : { memberships: [{ id: "last" }], complete: true, nextCursor: null },
      );
    },
  });
  try {
    const result = await client.listAccess();
    expect(result.memberships.map((m) => m.id)).toEqual(["first", "last"]);
    expect(paths).toEqual([
      "https://ward.example.test/v1/workspace/access",
      "https://ward.example.test/v1/workspace/access?cursor=page2",
      "https://ward.example.test/v1/workspace/access?cursor=page3",
    ]);
  } finally {
    client.dispose();
  }
});
it("rejects looping continuation instead of showing a partial directory", async () => {
  const client = new SharedWorkspaceClient({
    baseUrl: "https://ward.example.test",
    token: async () => "synthetic",
    changed: () => {},
    fetch: async () => Response.json({ memberships: [], complete: false, nextCursor: "same" }),
  });
  try {
    await expect(client.listAccess()).rejects.toThrow("completely");
  } finally {
    client.dispose();
  }
});

it("rejects a failed later page instead of returning the grants already read", async () => {
  let calls = 0;
  const client = new SharedWorkspaceClient({
    baseUrl: "https://ward.example.test",
    token: async () => "synthetic",
    changed: () => {},
    fetch: async () => {
      calls++;
      return calls === 1
        ? Response.json({ memberships: [{ id: "first" }], complete: false, nextCursor: "page2" })
        : Response.json({ error: "Synthetic unavailable page" }, { status: 503 });
    },
  });
  try {
    await expect(client.listAccess()).rejects.toThrow("Synthetic unavailable page");
    expect(calls).toBe(2);
  } finally {
    client.dispose();
  }
});
