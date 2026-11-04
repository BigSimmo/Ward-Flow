import { afterEach, describe, expect, it, vi } from "vitest";

const schemaPath = "../src/components/ward-management/ward-shared-state-validation";
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
// The client starts these three imports together, and a test can finish while some are still loading
// (an auth failure settles refresh first). Vitest resolves a queued doMock or doUnmock on whichever
// import runs next, and two imports resolving the queue at once can apply this file's unmock after
// the next test's mock. The next test's schema factory then never runs and its wait hangs until the
// 30 s timeout (CI flake, 4 Nov 2026). Settling every startup import before unmocking leaves no
// stray import to resolve the queue.
const startupImports = [
  schemaPath,
  "../src/components/ward-management/ward-partial-view-contract",
  "../src/components/ward-management/ward-scenario-networks",
];
afterEach(async () => {
  await Promise.allSettled(startupImports.map((path) => import(/* @vite-ignore */ path)));
  vi.doUnmock(schemaPath);
  vi.resetModules();
  // A fresh import applies the queued unmock here, while nothing else is importing.
  await import("../src/components/ward-management/ward-scenario-networks");
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

it("observes a late schema rejection after a synchronous expired-token failure", async () => {
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
    token: () => {
      throw new WardAuthError("session", "Synthetic expired session");
    },
    fetch: send,
    changed,
  });
  try {
    await client.refresh();
    await started.promise;
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ status: "not-authorised", snapshot: null }));
    schema.reject(new Error("synthetic late schema failure"));
    await expect(import("../src/components/ward-management/ward-shared-state-validation")).rejects.toThrow();
    // Let a detached rejection reach the process if the parallel operation was not observed.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(send).not.toHaveBeenCalled();
    expect(changed).toHaveBeenCalledTimes(1);
  } finally {
    schema.resolve();
    client.dispose();
  }
});

it("observes simultaneous schema and token failures without sending a workspace request", async () => {
  vi.doMock(schemaPath, async () => {
    throw new Error("synthetic schema failure");
  });
  const { SharedWorkspaceClient } = await import("../src/components/ward-management/ward-shared-client");
  const token = vi.fn(async () => {
    throw new Error("synthetic auth failure");
  });
  const send = vi.fn(async () => Response.json({}));
  const changed = vi.fn();
  const client = new SharedWorkspaceClient({ baseUrl: "https://example.test", token, fetch: send, changed });
  try {
    await client.refresh();
    await expect(import("../src/components/ward-management/ward-shared-state-validation")).rejects.toThrow();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(token).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ status: "unavailable", snapshot: null }));
  } finally {
    client.dispose();
  }
});

it("retries a single server 401 with a freshly requested token and adopts only its successful reply", async () => {
  const { SharedWorkspaceClient } = await import("../src/components/ward-management/ward-shared-client");
  const { seedWardFlowStateAt } = await import("../src/components/ward-management/ward-flow-reducer");
  const token = vi.fn(async (options?: { refresh?: boolean }) =>
    options?.refresh ? "synthetic-fresh" : "synthetic-old",
  );
  const snapshot = {
    dataMode: "prototype",
    revision: 1,
    now: 642,
    payload: {
      version: 1,
      state: JSON.parse(JSON.stringify(seedWardFlowStateAt(0))),
      dayZero: "2026-10-07T00:00:00Z",
      startedAt: "2026-10-07T10:00:00Z",
    },
  };
  const send = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ error: "Synthetic token expired" }, { status: 401 }))
    .mockResolvedValueOnce(Response.json({ snapshot }));
  const changed = vi.fn();
  const client = new SharedWorkspaceClient({ baseUrl: "https://example.test", token, fetch: send, changed });
  try {
    await client.refresh();
    expect(token.mock.calls).toEqual([[], [{ refresh: true }]]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(new Headers(send.mock.calls[0][1].headers).get("authorization")).toBe("Bearer synthetic-old");
    expect(new Headers(send.mock.calls[1][1].headers).get("authorization")).toBe("Bearer synthetic-fresh");
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "ready", snapshot: expect.objectContaining({ revision: 1 }) }),
    );
  } finally {
    client.dispose();
  }
});
