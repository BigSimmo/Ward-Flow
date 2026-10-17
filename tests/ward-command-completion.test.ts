import { WardAuthError } from "@/components/ward-management/ward-supabase-auth";
import { describe, expect, it, vi } from "vitest";
import { SharedWorkspaceClient, type SharedSnapshot } from "@/components/ward-management/ward-shared-client";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";

const snapshot = (revision = 1): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  payload: {
    version: 1,
    state: JSON.parse(JSON.stringify(seedWardFlowStateAt(0))),
    dayZero: "2026-10-07T00:00:00Z",
    startedAt: "2026-10-07T10:00:00Z",
  },
});
const event = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "ward-test" } as const;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function setup(reply: Promise<Response>) {
  const fetcher = vi.fn(async (_url: string | URL | Request, options?: RequestInit) =>
    options?.body ? reply : Response.json({ snapshot: snapshot() }),
  );
  let sequence = 0;
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "test",
    changed: () => {},
    fetch: fetcher,
    commandId: () => (++sequence === 1 ? "command-one" : "command-" + sequence),
  });
  return { client, fetcher };
}
describe("command-specific terminal completion", () => {
  it.each([200, 409, 422, 401, 503])("waits for HTTP %i and settles only its command", async (status) => {
    const response = deferred<Response>();
    const { client } = setup(response.promise);
    await client.refresh();
    const finished = vi.fn();
    const result = client.dispatch(event);
    Promise.resolve(result).then(finished);
    await Promise.resolve();
    expect(finished).not.toHaveBeenCalled();
    response.resolve(Response.json({ snapshot: snapshot(2) }, { status }));
    await expect(result).resolves.toMatchObject({
      commandId: "command-one",
      status: status === 200 ? "accepted" : status === 503 ? "failed" : "refused",
    });
    client.dispose();
  });
  it("cancels queued and in-flight completions on disposal and ignores late acceptance", async () => {
    const response = deferred<Response>();
    const { client } = setup(response.promise);
    await client.refresh();
    const first = client.dispatch(event);
    const second = client.dispatch(event);
    client.dispose();
    await expect(first).resolves.toMatchObject({ status: "cancelled" });
    await expect(second).resolves.toMatchObject({ status: "cancelled" });
    response.resolve(Response.json({ snapshot: snapshot(2) }));
  });
  it("settles queued work cancelled after a refusal", async () => {
    const response = deferred<Response>();
    const { client } = setup(response.promise);
    await client.refresh();
    const first = client.dispatch(event);
    const second = client.dispatch(event);
    response.resolve(Response.json({ snapshot: snapshot(2) }, { status: 422 }));
    await expect(first).resolves.toMatchObject({ status: "refused" });
    await expect(second).resolves.toMatchObject({ status: "cancelled" });
    client.dispose();
  });
  it("retains the retry ID without emitting a second terminal result", async () => {
    const { client, fetcher } = setup(Promise.resolve(Response.json({}, { status: 503 })));
    await client.refresh();
    const result = client.dispatch(event);
    await expect(result).resolves.toMatchObject({ status: "failed" });
    fetcher.mockResolvedValueOnce(Response.json({ snapshot: snapshot(2) }));
    await client.retry();
    const posts = fetcher.mock.calls
      .filter(([, options]) => options?.body)
      .map(([, options]) => JSON.parse(options!.body as string));
    expect(posts.map((post) => post.commandId)).toEqual(["command-one", "command-one"]);
    await expect(result).resolves.toMatchObject({ status: "failed" });
    client.dispose();
  });
});

it("allows an accepted Undo to queue while another command is saving", async () => {
  const saveReply = deferred<Response>();
  const posts: { event: import("@/components/ward-management/ward-flow-events").WardFlowEvent }[] = [];
  let latest: import("@/components/ward-management/ward-shared-client").SharedView | undefined;
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "test",
    changed: (view) => {
      latest = view;
    },
    fetch: async (_url, options) => {
      if (!options?.body) return Response.json({ snapshot: snapshot(1) });
      posts.push(JSON.parse(options.body as string));
      return posts.length === 2 ? saveReply.promise : Response.json({ snapshot: snapshot(posts.length + 1) });
    },
  });
  try {
    await client.refresh();
    const accepted = await client.dispatchConfirmed(event);
    const saving = client.dispatch(event);
    await vi.waitFor(() => expect(posts).toHaveLength(2));
    expect(latest?.status).toBe("saving");
    expect(accepted.canUndo?.()).toBe(true);
    const undo = client.dispatchConfirmed({
      type: "UNDO_REFER_TO_UNITS",
      role: "coordinator",
      now: 642,
      movementId: "WF-030",
      recordSeq: 42,
    });
    expect(posts).toHaveLength(2);
    saveReply.resolve(Response.json({ snapshot: snapshot(3) }));
    await expect(saving).resolves.toMatchObject({ status: "accepted" });
    await expect(undo).resolves.toMatchObject({ status: "accepted" });
    expect(posts).toHaveLength(3);
    expect(posts[2].event).toMatchObject({ type: "UNDO_REFER_TO_UNITS", recordSeq: 42 });
  } finally {
    client.dispose();
  }
});

describe("working-role changes", () => {
  it.each([401, 403, 409, "session"] as const)(
    "preserves a confirmed acceptance when reconciliation gates the desk (%s)",
    async (status) => {
      const commandReply = deferred<Response>();
      let reads = 0;
      let posted = false;
      let tokenCalls = 0;
      let latest: import("@/components/ward-management/ward-shared-client").SharedView | undefined;
      const client = new SharedWorkspaceClient({
        baseUrl: "https://example.test",
        token: async () => {
          if (++tokenCalls === 4 && status === "session") throw new WardAuthError("session", "Session ended");
          return "test";
        },
        changed: (view) => {
          latest = view;
        },
        fetch: async (url) => {
          if (String(url).endsWith("/commands")) {
            posted = true;
            return commandReply.promise;
          }
          if (String(url).endsWith("/break-glass")) return Response.json({ snapshot: snapshot(1) });
          if (++reads === 1) return Response.json({ snapshot: snapshot(1) });
          if (typeof status !== "number") throw new Error("The sign-in check must stop this read before HTTP");
          return Response.json({ code: status === 409 ? "choose-role" : "no-role", choices: [] }, { status });
        },
      });
      try {
        await client.refresh();
        const completion = client.dispatchConfirmed(event);
        await vi.waitFor(() => expect(posted).toBe(true));
        await expect(client.breakGlass("synthetic-patient", "handover")).resolves.toBeNull();
        const accepted = snapshot(2);
        commandReply.resolve(Response.json({ snapshot: accepted }));
        const result = await completion;
        expect(result).toMatchObject({ status: "accepted", undoRecords: accepted.payload.state.undoRecords });
        await vi.waitFor(() =>
          expect(latest?.status).toBe(
            status === 401 || status === "session" ? "not-authorised" : status === 403 ? "no-role" : "choose-role",
          ),
        );
        expect(latest?.snapshot).toBeNull();
        expect(result.isCurrent?.()).toBe(false);
        expect(reads).toBe(status === "session" ? 1 : 2);
      } finally {
        client.dispose();
      }
    },
  );
  it("expires an accepted command's fence when its working role ends on the server", async () => {
    let role: string | null = "bootstrap";
    let commands = 0;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: () => {},
      workingAs: {
        get: () => role,
        set: (next) => {
          role = next;
        },
      },
      fetch: async (url) => {
        if (String(url).endsWith("/commands")) {
          commands++;
          return commands === 1
            ? Response.json({ snapshot: snapshot(2) })
            : Response.json({ code: "no-role" }, { status: 403 });
        }
        return Response.json({ snapshot: snapshot(commands ? 2 : 1) });
      },
    });
    try {
      await client.refresh();
      const accepted = await client.dispatchConfirmed(event);
      expect(accepted.status).toBe("accepted");
      expect(accepted.isCurrent?.()).toBe(true);
      await expect(client.dispatchConfirmed(event)).resolves.toMatchObject({ status: "cancelled" });
      expect(accepted.isCurrent?.()).toBe(false);
      expect(commands).toBe(2);
      expect(role).toBeNull();
    } finally {
      client.dispose();
    }
  });
  it("keeps a definitive acceptance and its Undo records when the post-grant reconciliation read fails", async () => {
    const commandReply = deferred<Response>();
    const accepted = snapshot(2);
    accepted.payload.state.undoRecords = [
      {
        kind: "bed-placement",
        admissionId: accepted.payload.state.admissions[0].id,
        unitId: accepted.payload.state.admissions[0].unitId,
        at: 642,
        role: "coordinator",
        beforeBed: null,
        afterBed: 1,
      },
    ];
    const opened = snapshot(1);
    opened.payload.state.configuration.pullHoldMinutes = 45;
    const commandPosts: Record<string, unknown>[] = [];
    let reads = 0;
    let latest: import("@/components/ward-management/ward-shared-client").SharedView | undefined;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (view) => {
        latest = view;
      },
      fetch: async (url, options) => {
        if (String(url).endsWith("/commands")) {
          commandPosts.push(JSON.parse(options!.body as string));
          return commandReply.promise;
        }
        if (String(url).endsWith("/break-glass")) return Response.json({ snapshot: opened });
        reads++;
        if (reads === 2) throw new Error("Reconciliation is offline");
        return Response.json({ snapshot: reads === 1 ? snapshot(1) : accepted });
      },
    });
    try {
      await client.refresh();
      const completion = client.dispatchConfirmed(event);
      await vi.waitFor(() => expect(commandPosts).toHaveLength(1));
      await expect(client.breakGlass("synthetic-patient", "handover")).resolves.toBeNull();
      commandReply.resolve(Response.json({ snapshot: accepted }));
      const outcome = await completion;
      expect(outcome).toMatchObject({ status: "accepted", undoRecords: accepted.payload.state.undoRecords });
      await vi.waitFor(() => expect(latest?.status).toBe("unavailable"));
      expect(outcome.canUndo?.()).toBe(false);
      // Reconciliation failure must preserve the granted scope until a fresh read succeeds.
      expect(latest?.snapshot?.payload.state.configuration.pullHoldMinutes).toBe(45);
      await client.retry();
      expect(commandPosts).toHaveLength(1);
      expect(reads).toBe(3);
      await vi.waitFor(() => expect(latest?.status).toBe("ready"));
      expect(outcome.canUndo?.()).toBe(true);
      await expect(completion).resolves.toMatchObject({ status: "accepted" });
    } finally {
      client.dispose();
    }
  });

  it.each(["switch", "choose"] as const)(
    "reports a sent command as uncertain and cancels queued work when roles %s",
    async (change) => {
      const response = deferred<Response>();
      const { client, fetcher } = setup(response.promise);
      await client.refresh();
      const first = client.dispatch(event);
      const queued = client.dispatch(event);
      await vi.waitFor(() => expect(fetcher.mock.calls.some(([, options]) => options?.body)).toBe(true));
      if (change === "switch") client.switchRole();
      else client.chooseRole("bootstrap");
      await expect(first).resolves.toMatchObject({
        status: "failed",
        message: expect.stringContaining("may have been applied"),
      });
      await expect(queued).resolves.toMatchObject({ status: "cancelled" });
      response.resolve(Response.json({ snapshot: snapshot(9) }));
      await vi.waitFor(() => expect(fetcher.mock.calls.filter(([, options]) => !options?.body)).toHaveLength(2));
      expect(fetcher.mock.calls.filter(([, options]) => options?.body)).toHaveLength(1);
      await expect(first).resolves.toMatchObject({ status: "failed" });
      client.dispose();
    },
  );
  it("switches roles after an uncertain save without replaying its retained pending command", async () => {
    const { client, fetcher } = setup(Promise.resolve(Response.json({}, { status: 503 })));
    try {
      await client.refresh();
      const completion = client.dispatchConfirmed(event);
      await expect(completion).resolves.toMatchObject({ status: "failed" });
      client.switchRole();
      await vi.waitFor(() => expect(fetcher.mock.calls.filter(([, options]) => !options?.body)).toHaveLength(2));
      await client.retry();
      expect(fetcher.mock.calls.filter(([, options]) => options?.body)).toHaveLength(1);
      await expect(completion).resolves.toMatchObject({ status: "failed" });
    } finally {
      client.dispose();
    }
  });

  it("does not send an old command under a new role when its token arrives late", async () => {
    const token = deferred<string>();
    let tokenCalls = 0;
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ snapshot: snapshot() }));
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: () => (++tokenCalls === 1 ? Promise.resolve("test") : token.promise),
      changed: () => {},
      fetch: fetcher,
    });
    await client.refresh();
    const result = client.dispatch(event);
    client.chooseRole("bootstrap");
    await expect(result).resolves.toMatchObject({ status: "cancelled" });
    token.resolve("test");
    await vi.waitFor(() => expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(fetcher.mock.calls.every((call) => !call[1]?.body)).toBe(true);
    client.dispose();
  });
  it("requests this confirmed command's snapshot even while other commands are queued", async () => {
    const firstReply = deferred<Response>();
    const posts: Record<string, unknown>[] = [];
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: () => {},
      fetch: async (_url, options) => {
        if (!options?.body) return Response.json({ snapshot: snapshot() });
        posts.push(JSON.parse(options.body as string));
        return posts.length === 1 ? firstReply.promise : Response.json({ snapshot: snapshot(posts.length + 1) });
      },
    });
    await client.refresh();
    const first = client.dispatch(event);
    const confirmed = client.dispatchConfirmed(event);
    const third = client.dispatch(event);
    firstReply.resolve(Response.json({ snapshot: snapshot(2) }));
    await Promise.all([first, confirmed, third]);
    expect(posts[1]).not.toHaveProperty("reply");
    await expect(confirmed).resolves.toHaveProperty("undoRecords");
    client.dispose();
  });
});

describe("refresh and role recovery completion", () => {
  it("settles a command queued behind a failed poll without sending it", async () => {
    let rejectPoll!: (error: Error) => void;
    const poll = new Promise<Response>((_resolve, reject) => {
      rejectPoll = reject;
    });
    let calls = 0;
    const fetcher = vi.fn<typeof fetch>(async () => (++calls === 1 ? Response.json({ snapshot: snapshot() }) : poll));
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: () => {},
      fetch: fetcher,
    });
    await client.refresh();
    const refreshing = client.refresh();
    const queued = client.dispatchConfirmed(event);
    rejectPoll(new Error("offline"));
    await refreshing;
    await expect(queued).resolves.toMatchObject({ status: "cancelled" });
    expect(fetcher.mock.calls.every(([, options]) => !options?.body)).toBe(true);
    client.dispose();
  });
  it("discovers remaining roles with a GET after a command's stored role ends, without replaying it", async () => {
    let role: string | null = "11111111-1111-1111-1111-111111111111";
    let commands = 0;
    let reads = 0;
    let latest: import("@/components/ward-management/ward-shared-client").SharedView | undefined;
    const choices = [{ workingAs: "22222222-2222-2222-2222-222222222222", role: "ward", scope: {} }];
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      workingAs: {
        get: () => role,
        set: (next) => {
          role = next;
        },
      },
      changed: (view) => {
        latest = view;
      },
      fetch: async (_url, options) => {
        if (options?.body) {
          commands++;
          return Response.json({ code: "no-role" }, { status: 403 });
        }
        return ++reads === 1
          ? Response.json({ snapshot: snapshot() })
          : Response.json({ code: "choose-role", choices }, { status: 409 });
      },
    });
    await client.refresh();
    await expect(client.dispatchConfirmed(event)).resolves.toMatchObject({ status: "cancelled" });
    await vi.waitFor(() => expect(latest?.choices).toEqual(choices));
    expect(commands).toBe(1);
    expect(reads).toBe(2);
    expect(role).toBeNull();
    client.dispose();
  });
});

it("ignores an obsolete role's expired token rejection and completes new-role discovery", async () => {
  let rejectOld!: (error: Error) => void;
  const oldToken = new Promise<string>((_resolve, reject) => {
    rejectOld = reject;
  });
  let tokenCalls = 0;
  let reads = 0;
  const statuses: string[] = [];
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: () => (++tokenCalls === 2 ? oldToken : Promise.resolve("test")),
    changed: (view) => {
      statuses.push(view.status);
    },
    fetch: async () =>
      ++reads === 1
        ? Response.json({ snapshot: snapshot() })
        : Response.json(
            { code: "choose-role", choices: [{ workingAs: "bootstrap", role: "coordinator", scope: {} }] },
            { status: 409 },
          ),
  });
  await client.refresh();
  const obsolete = client.refresh();
  client.switchRole();
  rejectOld(new WardAuthError("session", "Session ended"));
  await obsolete;
  await vi.waitFor(() => expect(statuses.at(-1)).toBe("choose-role"));
  expect(statuses).not.toContain("not-authorised");
  expect(reads).toBe(2);
  client.dispose();
});

it("expires an accepted command's lifetime fence on role switch or disposal", async () => {
  const { client } = setup(Promise.resolve(Response.json({ snapshot: snapshot(2) })));
  await client.refresh();
  const outcome = await client.dispatchConfirmed(event);
  expect(outcome.isCurrent?.()).toBe(true);
  client.switchRole();
  expect(outcome.isCurrent?.()).toBe(false);
  client.dispose();
  expect(outcome.isCurrent?.()).toBe(false);
});

it("cancels an old Undo queued behind a reset before any POST can affect the replacement world", async () => {
  const resetReply = deferred<Response>();
  const posts: Record<string, unknown>[] = [];
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "test",
    changed: () => {},
    fetch: async (_url, options) => {
      if (!options?.body) return Response.json({ snapshot: snapshot() });
      const body = JSON.parse(options.body as string);
      posts.push(body);
      return body.event.type === "RESET_SCENARIO" ? resetReply.promise : Response.json({ snapshot: snapshot(2) });
    },
  });
  await client.refresh();
  const accepted = await client.dispatchConfirmed(event);
  expect(accepted.isCurrent?.()).toBe(true);
  const reset = client.dispatch({ type: "RESET_SCENARIO", role: "demo", now: 642 });
  // Click-time fence is still current until reset is confirmed; drain must fence the queued Undo too.
  expect(accepted.isCurrent?.()).toBe(true);
  const undo = client.dispatchConfirmed({
    type: "UNDO_REFER_TO_UNITS",
    role: "coordinator",
    now: 642,
    movementId: "WF-030",
    recordSeq: 1,
  });
  const next = snapshot(3);
  next.payload.state.worldGeneration++;
  resetReply.resolve(Response.json({ snapshot: next }));
  await expect(reset).resolves.toMatchObject({ status: "accepted" });
  await expect(undo).resolves.toMatchObject({ status: "cancelled" });
  expect(accepted.isCurrent?.()).toBe(false);
  expect(posts.map((post) => (post.event as { type: string }).type)).toEqual([
    "REQUEST_CAPACITY_REFRESH",
    "RESET_SCENARIO",
  ]);
  expect(posts[1]).not.toHaveProperty("reply");
  client.dispose();
});
