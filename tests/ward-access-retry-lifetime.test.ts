import assert from "node:assert/strict";
import { it } from "vitest";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
const firstDesk = "11111111-1111-4111-8111-111111111111";
const nextDesk = "22222222-2222-4222-8222-222222222222";
const actorId = "synthetic-actor";
const access = { role: "coordinator", scope: { kind: "statewide" } };
const state = seedWardFlowStateAt(0);
const snapshot: SharedSnapshot = {
  dataMode: "prototype",
  revision: 1,
  now: 642,
  accessContext: "a".repeat(64),
  payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
};
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
const userTask = (fn: () => void) =>
  new Promise<void>((resolve) =>
    setTimeout(() => {
      fn();
      resolve();
    }, 0),
  );
async function until(predicate: () => boolean) {
  for (let i = 0; i < 200; i++) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 0));
  }
  assert.fail("Schedule did not reach its intended boundary");
}
// H01 remains an unverified audit hypothesis. These schedules exercise the actual client
// methods called by the account menu and WardRolePicker in separate browser-style event tasks.
// They do not inject a desk change inside a promise microtask or fake a response getter.
for (const operation of ["read", "grant"] as const)
  for (const stage of ["http", "body", "token"] as const) {
    it(`does not rebind a ${operation} after a desk switch during ${stage}`, async () => {
      const operationPath = operation === "read" ? "/v1/workspace/audit" : "/v1/workspace/access/grant";
      let stored: string | null = firstDesk;
      let current: SharedView | undefined;
      let staleReadStarted = false;
      let tokenRefreshStarted = false;
      const responseGate = deferred<Response>();
      const bodyGate = deferred<string>();
      const tokenGate = deferred<string>();
      const sent: { path: string; as: string | null; token: string }[] = [];
      const client = new SharedWorkspaceClient({
        baseUrl: "https://example.test",
        authenticatedActorId: () => actorId,
        workingAs: {
          get: () => stored,
          set: (id) => {
            stored = id;
          },
        },
        changed: (view) => {
          current = view;
        },
        token: async (options) => {
          if (options?.refresh && stage === "token") {
            tokenRefreshStarted = true;
            return tokenGate.promise;
          }
          return "synthetic-token";
        },
        fetch: async (url, init) => {
          const path = new URL(String(url)).pathname;
          const as = new Headers(init?.headers).get("x-ward-working-as");
          sent.push({ path, as, token: new Headers(init?.headers).get("authorization")! });
          if (path === operationPath) {
            if (!staleReadStarted) {
              staleReadStarted = true;
              if (stage === "http") return responseGate.promise;
              if (stage === "body")
                return new Response(
                  new ReadableStream({
                    start(controller) {
                      void bodyGate.promise.then((text) => {
                        controller.enqueue(new TextEncoder().encode(text));
                        controller.close();
                      });
                    },
                  }),
                  { status: 401, headers: { "content-type": "application/json" } },
                );
              return Response.json({ error: "Synthetic expired token" }, { status: 401 });
            }
            return Response.json({
              events: [
                { sequence: "1", action: "SYNTHETIC", outcome: "accepted", committed_at: "2026-11-04T00:00:00Z" },
              ],
            });
          }
          if (!as)
            return Response.json(
              {
                code: "choose-role",
                choices: [
                  { workingAs: firstDesk, ...access },
                  { workingAs: nextDesk, ...access },
                ],
              },
              { status: 409 },
            );
          return Response.json({ actorId, access, workingAs: as, snapshot });
        },
      });
      try {
        await client.refresh();
        assert.equal(current?.status, "ready");
        const pending =
          operation === "read"
            ? client.readActivityAudit()
            : client.grantAccess({
                actorId: "synthetic-recipient",
                role: "ward",
                scope: { kind: "ward", unitIds: ["rph-adult-secure"] },
                expiresInMinutes: 60,
              });
        const result = pending.then(
          (value) => ({ value }),
          (error: unknown) => ({ error }),
        );
        await until(() => (stage === "token" ? tokenRefreshStarted : staleReadStarted));
        // The same two callbacks used by the account menu and WardRolePicker; each runs in a new user event task.
        await userTask(() => client.switchRole());
        await until(() => current?.status === "choose-role");
        await userTask(() => client.chooseRole(nextDesk));
        await until(() => current?.status === "ready" && current?.workingAs === nextDesk);
        if (stage === "http")
          responseGate.resolve(Response.json({ error: "Synthetic expired token" }, { status: 401 }));
        if (stage === "body") bodyGate.resolve(JSON.stringify({ error: "Synthetic expired token" }));
        if (stage === "token") tokenGate.resolve("synthetic-refreshed-token");
        const outcome = await result;
        assert.ok("error" in outcome);
        assert.equal(sent.filter((call) => call.path === operationPath).length, 1);
        assert.equal(current?.workingAs, nextDesk);
      } finally {
        client.dispose();
      }
    });
  }
// Positive control: same-desk 401 gets exactly one refreshed token and keeps its membership.
it("preserves a legitimate same-desk token retry exactly once", async () => {
  let current: SharedView | undefined;
  let refreshed = 0;
  const calls: { as: string | null; token: string | null }[] = [];
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    authenticatedActorId: () => actorId,
    workingAs: { get: () => firstDesk, set: () => {} },
    changed: (v) => (current = v),
    token: async (options) => {
      if (options?.refresh) {
        refreshed++;
        return "fresh";
      }
      return "ordinary";
    },
    fetch: async (url, init) => {
      const path = new URL(String(url)).pathname;
      const headers = new Headers(init?.headers);
      if (path === "/v1/workspace/audit") {
        calls.push({ as: headers.get("x-ward-working-as"), token: headers.get("authorization") });
        if (calls.length === 1) return Response.json({ error: "Synthetic expired token" }, { status: 401 });
        return Response.json({ events: [] });
      }
      return Response.json({ actorId, access, workingAs: firstDesk, snapshot });
    },
  });
  try {
    await client.refresh();
    assert.equal(current?.status, "ready");
    assert.deepEqual(await client.readActivityAudit(), []);
    assert.deepEqual(calls, [
      { as: firstDesk, token: "Bearer ordinary" },
      { as: firstDesk, token: "Bearer fresh" },
    ]);
    assert.equal(refreshed, 1);
  } finally {
    client.dispose();
  }
});
// Command path: cancellation owns the outgoing save while the role picker waits for its run to finish.
for (const stage of ["http", "token"] as const) {
  it(`cancels the outgoing command before the picker selects another desk during ${stage}`, async () => {
    let current: SharedView | undefined;
    let stored: string | null = firstDesk;
    let pendingStarted = false;
    let tokenStarted = false;
    const responseGate = deferred<Response>();
    const tokenGate = deferred<string>();
    const commands: { as: string | null; commandId: string }[] = [];
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      authenticatedActorId: () => actorId,
      workingAs: {
        get: () => stored,
        set: (id) => {
          stored = id;
        },
      },
      changed: (v) => {
        current = v;
      },
      commandId: () => "33333333-3333-4333-8333-333333333333",
      token: async (options) => {
        if (options?.refresh && stage === "token") {
          tokenStarted = true;
          return tokenGate.promise;
        }
        return "synthetic-token";
      },
      fetch: async (url, init) => {
        const as = new Headers(init?.headers).get("x-ward-working-as");
        if (new URL(String(url)).pathname === "/v1/workspace/commands") {
          commands.push({ as, commandId: JSON.parse(String(init?.body)).commandId });
          pendingStarted = true;
          if (commands.length === 1) {
            if (stage === "http") return responseGate.promise;
            return Response.json({ error: "Synthetic expired token" }, { status: 401 });
          }
          return Response.json({ actorId, access, workingAs: as, commandRevision: 2, outcome: "accepted" });
        }
        if (!as)
          return Response.json(
            {
              code: "choose-role",
              choices: [
                { workingAs: firstDesk, ...access },
                { workingAs: nextDesk, ...access },
              ],
            },
            { status: 409 },
          );
        return Response.json({ actorId, access, workingAs: as, snapshot });
      },
    });
    try {
      await client.refresh();
      assert.equal(current?.status, "ready");
      const result = client.dispatchConfirmed({
        type: "REQUEST_CAPACITY_REFRESH",
        role: "coordinator",
        now: 642,
        unitId: "rph-adult-secure",
      });
      await until(() => (stage === "token" ? tokenStarted : pendingStarted));
      await userTask(() => client.switchRole());
      if (stage === "http") responseGate.resolve(Response.json({ error: "Synthetic expired token" }, { status: 401 }));
      else tokenGate.resolve("synthetic-refreshed-token");
      await result;
      await until(() => current?.status === "choose-role");
      await userTask(() => client.chooseRole(nextDesk));
      await until(() => current?.status === "ready" && current?.workingAs === nextDesk);
      assert.equal(commands.length, 1);
      assert.equal(commands[0].as, firstDesk);
    } finally {
      client.dispose();
    }
  });
}
