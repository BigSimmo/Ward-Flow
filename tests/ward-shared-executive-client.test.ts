import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SharedWorkspaceClient, type SharedView } from "../src/components/ward-management/ward-shared-client";
import {
  bindExecutiveAggregateSnapshot,
  type ExecutiveAggregateSnapshot,
} from "../src/components/ward-management/ward-shared-executive-snapshot";
import { projectExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-projector";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { WARD_COMMAND_RECOVERY_KEY } from "../src/components/ward-management/ward-shared-client";

const actor = "synthetic-executive";
const context = "a".repeat(64);
const access = { role: "executive", scope: { kind: "statewide" } };
const clients: SharedWorkspaceClient[] = [];
let snapshot: ExecutiveAggregateSnapshot;
beforeAll(() => {
  const state = seedWardFlowStateAt(0);
  snapshot = {
    kind: "executive-aggregate",
    dataMode: "prototype",
    actorId: actor,
    revision: 1,
    accessContext: context,
    accessUntil: Date.now() + 120_000,
    now: 642,
    demoControls: false,
    report: projectExecutiveReportingFoundation(
      state,
      { role: "executive", scope: { kind: "statewide" } },
      {
        now: 642,
        dayZero: "2026-10-24T00:00:00Z",
        startedAt: "2026-10-24T00:00:00Z",
        places: wardPlaceLookup(state.units),
      },
    ),
  };
}, 20_000);
afterEach(() => {
  clients.splice(0).forEach((client) => client.dispose());
  vi.useRealTimers();
});
const reply = (value: unknown = snapshot, overrides = {}) => ({
  actorId: actor,
  access,
  accessUntil: snapshot.accessUntil,
  snapshot: value,
  ...overrides,
});
function connection(fetcher: typeof fetch, options = {}) {
  let view: SharedView | undefined;
  const client = new SharedWorkspaceClient({
    baseUrl: "https://synthetic.invalid",
    token: async () => "synthetic",
    authenticatedActorId: () => actor,
    fetch: fetcher,
    changed: (next) => {
      view = next;
    },
    ...options,
  });
  clients.push(client);
  return { client, current: () => view! };
}

describe("strict executive wire binding", () => {
  it("accepts a defensive aggregate only, bounded by the earlier existing deadline", () => {
    const accepted = bindExecutiveAggregateSnapshot(
      snapshot,
      { ...reply(), accessUntil: snapshot.accessUntil - 1 },
      actor,
      Date.now(),
    );
    expect(accepted?.accessUntil).toBe(snapshot.accessUntil - 1);
    expect(accepted?.report).toEqual(snapshot.report);
    expect(accepted?.report).not.toBe(snapshot.report);
    expect(Object.isFrozen(accepted?.report)).toBe(true);
  });
  it.each([
    { payload: { state: { patients: [] } } },
    { partialView: {} },
    { archived: 1 },
    { eventLog: [] },
    { actorId: "another-account" },
    { accessContext: "invalid" },
    { revision: 0 },
    { accessUntil: null },
    { accessUntil: Infinity },
    { accessUntil: NaN },
    { accessUntil: 0 },
    { demoControls: true },
    { now: 643 },
    { report: {} },
  ])("rejects wrong or additional wire data %j", (change) => {
    expect(bindExecutiveAggregateSnapshot({ ...snapshot, ...change }, reply(), actor, Date.now())).toBeNull();
  });
  it.each([
    { actorId: "another-account" },
    { access: { role: "coordinator", scope: { kind: "statewide" } } },
    { access: { role: "executive", scope: { kind: "service", service: "North Metropolitan" } } },
    { accessUntil: null },
    { accessUntil: Infinity },
    { accessUntil: 0 },
  ])("refuses mismatched outer authority %j", (change) => {
    expect(bindExecutiveAggregateSnapshot(snapshot, reply(snapshot, change), actor, Date.now())).toBeNull();
  });
});

describe("authenticated command response binding", () => {
  const desk = { role: "coordinator", scope: { kind: "statewide" } };
  const operational = (revision = 1, accessContext = context) => ({
    dataMode: "prototype",
    revision,
    now: 642,
    accessContext,
    payload: {
      version: 1,
      state: seedWardFlowStateAt(0),
      dayZero: "2026-10-24T00:00:00Z",
      startedAt: "2026-10-24T00:00:00Z",
    },
  });
  const event = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "synthetic" } as const;

  it.each([false, true])("accepts the production metadata-free command/replay envelope (replay=%s)", async (replay) => {
    let posts = 0;
    const { client, current } = connection(async (_url, init) => {
      if (init?.method !== "POST") return Response.json(reply(operational(), { access: desk }));
      posts++;
      return Response.json({
        outcome: "accepted",
        commandRevision: 2,
        snapshot: operational(2),
        ...(replay ? { replayed: true } : {}),
      });
    });
    await client.refresh();
    const result = await client.dispatch(event);
    expect(result.status).toBe("accepted");
    expect(current().snapshot?.revision).toBe(2);
    expect(current().status).toBe("ready");
    expect(posts).toBe(1);
  });

  it.each([
    { actorId: "another-account", access: desk },
    { access: desk },
    { actorId: actor, access },
    { snapshot: "context" },
    { snapshot: "aggregate" },
  ])("preserves a definitive save without retaining a mismatched response %j", async (change) => {
    let posts = 0;
    let gets = 0;
    let finish!: (response: Response) => void;
    const { client, current } = connection(async (_url, init) => {
      if (init?.method !== "POST") {
        if (++gets === 1) return Response.json(reply(operational(), { access: desk }));
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      }
      posts++;
      const changedSnapshot = "snapshot" in change ? change.snapshot : undefined;
      const replacement =
        changedSnapshot === "aggregate"
          ? snapshot
          : operational(2, changedSnapshot === "context" ? "b".repeat(64) : context);
      const metadata = "snapshot" in change ? {} : change;
      return Response.json({
        outcome: "applied",
        commandRevision: 2,
        snapshot: replacement,
        covered: ["opaque-record"],
        undoStep: { id: "stale-undo" },
        ...metadata,
      });
    });
    await client.refresh();
    const result = await client.dispatch(event);
    expect(result.status).toBe("accepted");
    expect(result.undoRecords).toBeUndefined();
    expect(result.undoStep).toBeUndefined();
    await vi.waitFor(() => expect(finish).toBeDefined());
    expect(current().snapshot).toBeNull();
    expect(current().executiveSnapshot ?? null).toBeNull();
    expect(Reflect.get(client, "rawPayload")).toBeNull();
    expect(posts).toBe(1);
    finish(Response.json(reply(operational(2), { access: desk })));
    await vi.waitFor(() => expect(current().status).toBe("ready"));
    expect(current().snapshot?.revision).toBe(2);
    expect(posts).toBe(1);
  });

  it.each([
    { actorId: "another-account", access: desk },
    { access: undefined },
    { access },
    { access, snapshot: "aggregate" },
  ])("rejects recovery reconciliation GET metadata before adoption %j", async (change) => {
    const commandId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const scope = "synthetic-receipt-scope";
    const storage = new Map([
      [WARD_COMMAND_RECOVERY_KEY, JSON.stringify({ commandId, receiptScope: scope, expiresAt: Date.now() + 60_000 })],
    ]);
    let gets = 0;
    const { client, current } = connection(
      async (url) => {
        if (String(url).includes("/receipt?"))
          return Response.json({ receipt: { outcome: "accepted", commandRevision: 2 } });
        ++gets;
        const replacement = "snapshot" in change && change.snapshot === "aggregate" ? { ...change, snapshot } : change;
        return Response.json(
          reply(operational(gets), { access: desk, receiptScope: scope, ...(gets > 1 ? replacement : {}) }),
        );
      },
      {
        recoveryStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: vi.fn(),
          removeItem: (key: string) => storage.delete(key),
        },
      },
    );
    await client.refresh();
    expect(gets).toBe(2);
    expect(current().snapshot).toBeNull();
    expect(current().executiveSnapshot ?? null).toBeNull();
    expect(current().status).toBe("unavailable");
  });

  it.each([false, true])("reconciles metadata-free grants through validated GET (invalid=%s)", async (invalid) => {
    let gets = 0;
    let posts = 0;
    const { client, current } = connection(async (_url, init) => {
      if (init?.method === "POST") {
        posts++;
        return Response.json({ until: "2026-10-27T12:00:00Z", snapshot: operational(1, "b".repeat(64)) });
      }
      ++gets;
      return Response.json(
        reply(operational(1, gets > 1 ? "b".repeat(64) : context), {
          access: desk,
          ...(gets > 1 && invalid ? { actorId: "another-account" } : {}),
        }),
      );
    });
    await client.refresh();
    expect(await client.breakGlass("synthetic-record", "immediate-safety")).toBeNull();
    expect(gets).toBe(2);
    expect(posts).toBe(1);
    expect(current().snapshot?.accessContext ?? null).toBe(invalid ? null : "b".repeat(64));
  });

  it("does not adopt an old command context after a concurrent authenticated grant", async () => {
    let posts = 0;
    let gets = 0;
    let finish!: (response: Response) => void;
    let granted = false;
    const { client, current } = connection(async (url, init) => {
      if (init?.method === "POST" && String(url).endsWith("/commands")) {
        posts++;
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      }
      if (init?.method === "POST") {
        granted = true;
        return Response.json({ snapshot: operational(1, "b".repeat(64)) });
      }
      gets++;
      return Response.json(reply(operational(gets > 2 ? 2 : 1, granted ? "b".repeat(64) : context), { access: desk }));
    });
    await client.refresh();
    const pending = client.dispatch(event);
    await vi.waitFor(() => expect(finish).toBeDefined());
    expect(await client.breakGlass("synthetic-record", "immediate-safety")).toBeNull();
    expect(current().snapshot?.accessContext).toBe("b".repeat(64));
    finish(Response.json({ outcome: "accepted", commandRevision: 2, snapshot: operational(2) }));
    expect((await pending).status).toBe("accepted");
    await vi.waitFor(() => expect(current().snapshot?.revision).toBe(2));
    expect(current().snapshot?.accessContext).toBe("b".repeat(64));
    expect(posts).toBe(1);
  });
});

describe("executive shared client storage", () => {
  it("publishes no operational snapshot and makes no archive, detail, command or recovery request", async () => {
    const paths: string[] = [];
    const storage = new Map([[WARD_COMMAND_RECOVERY_KEY, "retained-opaque-command"]]);
    const port = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: vi.fn(),
      removeItem: (key: string) => {
        storage.delete(key);
      },
    };
    const { client, current } = connection(
      async (url) => {
        paths.push(String(url));
        return Response.json(reply());
      },
      { recoveryStorage: port },
    );
    await client.refresh();
    expect(current().status).toBe("ready");
    expect(current().snapshot).toBeNull();
    expect(current().executiveSnapshot?.report).toEqual(snapshot.report);
    expect(await client.logRecordView("synthetic-record", "patient")).toBe(false);
    expect(
      (await client.dispatch({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "synthetic" }))
        ?.status,
    ).toBe("cancelled");
    expect(paths).toEqual(["https://synthetic.invalid/v1/workspace"]);
    expect(storage.has(WARD_COMMAND_RECOVERY_KEY)).toBe(false);
    expect(port.setItem).not.toHaveBeenCalled();
  });
  it("clears a prior aggregate when the next actual executive response contains an operational payload", async () => {
    let turn = 0;
    const { client, current } = connection(async () =>
      Response.json(
        reply(
          ++turn === 1
            ? snapshot
            : {
                dataMode: "prototype",
                revision: 2,
                now: 642,
                payload: {
                  version: 1,
                  state: seedWardFlowStateAt(0),
                  dayZero: "2026-10-24T00:00:00Z",
                  startedAt: "2026-10-24T00:00:00Z",
                },
              },
        ),
      ),
    );
    await client.refresh();
    await client.refresh();
    expect(current().status).toBe("unavailable");
    expect(current().snapshot).toBeNull();
    expect(current().executiveSnapshot).toBeNull();
  });
  it.each([
    { snapshot: { report: {} } },
    { accessUntil: null },
    { accessUntil: Infinity },
    { actorId: "another-account" },
    { access: undefined },
  ])("clears held display data on a malformed authenticated replacement %j", async (change) => {
    let turn = 0;
    const { client, current } = connection(async () => Response.json(++turn === 1 ? reply() : reply(snapshot, change)));
    await client.refresh();
    expect(Boolean(current().executiveSnapshot)).toBe(true);
    await client.refresh();
    expect(current().status).toBe("unavailable");
    expect(current().snapshot).toBeNull();
    expect(current().executiveSnapshot).toBeNull();
  });
  it("keeps the local lifetime steady for a newer report, and invalidates it when context changes", async () => {
    let turn = 0;
    const { client, current } = connection(async () =>
      Response.json(reply({ ...snapshot, revision: ++turn, accessContext: turn < 3 ? context : "b".repeat(64) })),
    );
    await client.refresh();
    const first = current().viewEpoch;
    await client.refresh();
    expect(current().viewEpoch).toBe(first);
    await client.refresh();
    expect(current().viewEpoch).toBeGreaterThan(first!);
  });
  it("uses server-relative lifetime conversion without changing the report's board clock", async () => {
    vi.useFakeTimers();
    const now = Date.now();
    const { client, current } = connection(async () =>
      Response.json(
        reply({ ...snapshot, accessUntil: now + 61_000 }, { accessUntil: now + 61_000, serverTime: now + 60_000 }),
      ),
    );
    await client.refresh();
    expect(current().executiveSnapshot?.now).toBe(642);
    expect(current().executiveSnapshot?.report.network.asAt.now).toBe(642);
    expect(current().executiveSnapshot!.accessUntil).toBe(now + 1000);
  });
  it("clears old operational references on aggregate adoption and rejects an aggregate for a coordinator", async () => {
    let turn = 0;
    const operational = {
      dataMode: "prototype",
      revision: 1,
      now: 642,
      payload: {
        version: 1,
        state: seedWardFlowStateAt(0),
        dayZero: "2026-10-24T00:00:00Z",
        startedAt: "2026-10-24T00:00:00Z",
      },
    };
    const { client, current } = connection(async () =>
      Response.json(
        ++turn === 1
          ? reply(operational, { access: { role: "coordinator", scope: { kind: "statewide" } } })
          : turn === 2
            ? reply()
            : reply(snapshot, { access: { role: "coordinator", scope: { kind: "statewide" } } }),
      ),
    );
    await client.refresh();
    expect(current().snapshot).not.toBeNull();
    await client.refresh();
    expect(current().snapshot).toBeNull();
    expect(Reflect.get(client, "rawPayload")).toBeNull();
    expect(Reflect.get(client, "archive")).toBeNull();
    await client.refresh();
    expect(current().executiveSnapshot).toBeNull();
    expect(current().snapshot).toBeNull();
  });
  it("rejects stale revisions and clock-only executive replies without rewriting report time", async () => {
    let turn = 0;
    const { client, current } = connection(async () =>
      Response.json(
        ++turn === 1
          ? reply({ ...snapshot, revision: 3 })
          : turn === 2
            ? reply({ ...snapshot, revision: 2 })
            : { ...reply(), notModified: true, revision: 3, now: 643 },
      ),
    );
    await client.refresh();
    await client.refresh();
    expect(current().executiveSnapshot?.revision).toBe(3);
    await client.refresh();
    expect(current().status).toBe("unavailable");
    expect(current().executiveSnapshot).toBeNull();
  });
  it("drops both variants at expiry and does not renew access after a failed poll", async () => {
    vi.useFakeTimers();
    let turn = 0;
    const until = Date.now() + 1000;
    const { client, current } = connection(async () =>
      ++turn === 1
        ? Response.json(reply({ ...snapshot, accessUntil: until }, { accessUntil: until }))
        : new Response(null, { status: 503 }),
    );
    await client.refresh();
    await client.refresh();
    expect(current().executiveSnapshot).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1001);
    expect(current().snapshot).toBeNull();
    expect(current().executiveSnapshot).toBeNull();
  });
  it("does not adopt a delayed report after role selection changed", async () => {
    let finish!: (value: Response) => void;
    let turn = 0;
    const { client, current } = connection(async () =>
      ++turn === 1
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : Response.json({ code: "choose-role", choices: [] }, { status: 409 }),
    );
    const pending = client.refresh();
    await vi.waitFor(() => expect(finish).toBeDefined());
    client.switchRole();
    finish(Response.json(reply()));
    await pending;
    expect(current().snapshot).toBeNull();
    expect(current().executiveSnapshot ?? null).toBeNull();
  });
  it("checks authenticated account again after the request token resolves", async () => {
    let actual = actor;
    const { client, current } = connection(
      async () => {
        actual = "replacement";
        return Response.json(reply());
      },
      { authenticatedActorId: () => actual },
    );
    await client.refresh();
    expect(current().snapshot).toBeNull();
    expect(current().executiveSnapshot ?? null).toBeNull();
  });
});
