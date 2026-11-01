import { afterEach, describe, expect, it, vi } from "vitest";

const schemaPath = "../src/components/ward-management/ward-shared-state-validation";
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
afterEach(() => {
  vi.doUnmock(schemaPath);
  vi.resetModules();
});

describe("shared-workspace startup waits", () => {
  it("starts auth while the schema loads but sends nothing until both are ready", async () => {
    const started = deferred<void>();
    const schema = deferred<void>();
    const auth = deferred<string>();
    vi.doMock(schemaPath, async () => {
      started.resolve();
      await schema.promise;
      return vi.importActual(schemaPath);
    });
    const { SharedWorkspaceClient } = await import("../src/components/ward-management/ward-shared-client");
    const token = vi.fn(() => auth.promise);
    const send = vi.fn(async () => Response.json({}, { status: 503 }));
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token,
      fetch: send,
      changed: () => {},
    });
    const refreshing = client.refresh();
    try {
      await started.promise;
      await vi.waitFor(() => expect(token).toHaveBeenCalledOnce());
      expect(send).not.toHaveBeenCalled();
      auth.resolve("synthetic-token");
      await Promise.resolve();
      expect(send).not.toHaveBeenCalled();
      schema.resolve();
      await refreshing;
      expect(send).toHaveBeenCalledOnce();
    } finally {
      auth.resolve("synthetic-token");
      schema.resolve();
      await refreshing;
      client.dispose();
    }
  });

  it("never sends a request when the schema import fails even if auth is ready", async () => {
    vi.doMock(schemaPath, async () => {
      throw new Error("synthetic schema unavailable");
    });
    const { SharedWorkspaceClient } = await import("../src/components/ward-management/ward-shared-client");
    const send = vi.fn(async () => Response.json({}, { status: 503 }));
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "synthetic-token",
      fetch: send,
      changed: () => {},
    });
    try {
      await client.refresh();
      expect(send).not.toHaveBeenCalled();
    } finally {
      client.dispose();
    }
  });
});

it("handles an expired session promptly while the schema is still loading", async () => {
  const started = deferred<void>();
  const schema = deferred<void>();
  vi.doMock(schemaPath, async () => {
    started.resolve();
    await schema.promise;
    return vi.importActual(schemaPath);
  });
  const { SharedWorkspaceClient } = await import("../src/components/ward-management/ward-shared-client");
  const { WardAuthError } = await import("../src/components/ward-management/ward-supabase-auth");
  const send = vi.fn(async () => Response.json({}));
  const changed = vi.fn();
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => {
      throw new WardAuthError("session", "Synthetic expired session");
    },
    fetch: send,
    changed,
  });
  const refreshing = client.refresh();
  try {
    await started.promise;
    await vi.waitFor(() =>
      expect(changed).toHaveBeenCalledWith(expect.objectContaining({ status: "not-authorised", snapshot: null })),
    );
    expect(send).not.toHaveBeenCalled();
    schema.resolve();
    // Auth failure settles refresh before its parallel import; drain that import before resetModules.
    await import("../src/components/ward-management/ward-shared-state-validation");
    await refreshing;
    expect(send).not.toHaveBeenCalled();
  } finally {
    schema.resolve();
    await refreshing;
    client.dispose();
  }
});

it("does not send or revive a client disposed while startup imports are pending", async () => {
  const started = deferred<void>();
  const schema = deferred<void>();
  vi.doMock(schemaPath, async () => {
    started.resolve();
    await schema.promise;
    return vi.importActual(schemaPath);
  });
  const { SharedWorkspaceClient } = await import("../src/components/ward-management/ward-shared-client");
  const send = vi.fn(async () => Response.json({}));
  const changed = vi.fn();
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "synthetic-token",
    fetch: send,
    changed,
  });
  const refreshing = client.refresh();
  try {
    await started.promise;
    client.dispose();
    const changesAtDisposal = changed.mock.calls.length;
    schema.resolve();
    await refreshing;
    expect(send).not.toHaveBeenCalled();
    expect(changed).toHaveBeenCalledTimes(changesAtDisposal);
  } finally {
    schema.resolve();
    await refreshing;
    client.dispose();
  }
});
