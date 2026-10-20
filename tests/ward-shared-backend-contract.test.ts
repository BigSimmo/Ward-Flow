import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import {
  applyCommand,
  seedWorld,
  validCommand,
  validWorld,
  worldNow,
  PERSISTED_AUDIT_EVENTS,
  type SharedWorld,
} from "../backend/ward-flow/engine";
import { wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { COHORTS } from "../src/components/ward-management/ward-model";
const sharedHttpModulePath = "../backend/ward-flow/shared-http.mjs";
const { createSharedHandler } = (await import(sharedHttpModulePath)) as {
  createSharedHandler: (
    opts: Record<string, unknown>,
  ) => (req: Request, meta?: Record<string, unknown>) => Promise<Response>;
};
const viewerTestSupportPath = "../backend/ward-flow/viewer.test-support.mjs";
const { bootstrapViewer } = (await import(viewerTestSupportPath)) as {
  bootstrapViewer: (actorId: string, config: Record<string, unknown>) => Promise<unknown>;
};

const COORDINATOR_A = "11111111-1111-4111-8111-111111111111";
const COORDINATOR_B = "22222222-2222-4222-8222-222222222222";
const NON_COORDINATOR = "33333333-3333-4333-8333-333333333333";
const WORKSPACE_ID = "44444444-4444-4444-8444-444444444444";
const FIXED_CLOCK = new Date("2026-10-15T10:00:00.000Z");

class VerifierUnavailableError extends Error {}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

function createMemoryStore(clock = () => FIXED_CLOCK, initialWorld = seedWorld(clock())) {
  let revision = 1;
  let payload: SharedWorld = initialWorld;
  const receipts = new Map<
    string,
    { fingerprint: string; status: number; result: { outcome: string; commandRevision: number; error?: string } }
  >();
  const auditRows: Array<Record<string, unknown>> = [];

  const toSnapshot = (at: Date): SharedSnapshot => ({
    dataMode: "prototype",
    revision,
    payload,
    now: worldNow(payload, at),
  });

  return {
    // Accounts named in the handler's coordinator list work as the statewide coordinator; nobody else holds a role.
    viewer: bootstrapViewer,
    async read() {
      return toSnapshot(clock());
    },
    async audit() {
      return [...auditRows].reverse();
    },
    async command(actorId: string, commandId: string, expectedRevision: number, event: unknown) {
      if (!validCommand(event)) throw new Error("invalid-command");
      const at = clock();
      const receiptKey = `${actorId}:${commandId}`;
      const fingerprint = createHash("sha256")
        .update(JSON.stringify(canonical({ expectedRevision, event })))
        .digest("hex");

      const previous = receipts.get(receiptKey);
      if (previous) {
        if (previous.fingerprint !== fingerprint) {
          return {
            status: 422,
            body: {
              error: "Command ID was already used for a different request",
              snapshot: toSnapshot(at),
            },
          };
        }
        return {
          status: previous.status,
          body: { ...previous.result, replayed: true, snapshot: toSnapshot(at) },
        };
      }

      let outcome: "accepted" | "denied" | "stale" = "stale";
      let status = 409;
      let changes: Record<string, unknown> = {};
      let reason: string | null = "The workspace changed. Review the latest board before trying again.";
      const priorRevision = revision;

      if (priorRevision === expectedRevision) {
        const applied = applyCommand(payload, event, at);
        outcome = applied.outcome;
        changes = applied.changes;
        reason = applied.reason;
        status = outcome === "accepted" ? 200 : 422;
        if (outcome === "accepted") {
          revision = priorRevision + 1;
          payload = applied.world;
        }
      }

      const result = {
        outcome,
        commandRevision: revision,
        ...(reason ? { error: reason } : {}),
      };
      auditRows.push({
        sequence: auditRows.length + 1,
        actor_id: actorId,
        actor_role: "coordinator",
        data_mode: "prototype",
        action: event.type,
        outcome,
        prior_revision: priorRevision,
        revision,
        changes,
        committed_at: at.toISOString(),
      });
      receipts.set(receiptKey, { fingerprint, status, result });
      return { status, body: { ...result, snapshot: toSnapshot(at) } };
    },
  };
}

function createInProcessFetch(store = createMemoryStore()) {
  const tokenMap = new Map<string, string>([
    ["Bearer token-coordinator-a", COORDINATOR_A],
    ["Bearer token-coordinator-b", COORDINATOR_B],
    ["Bearer token-non-coordinator", NON_COORDINATOR],
  ]);

  const handler = createSharedHandler({
    config: {
      workspaceId: WORKSPACE_ID,
      coordinatorIds: [COORDINATOR_A, COORDINATOR_B],
      origin: "https://ward-flow.example.test",
      dataMode: "prototype",
    },
    store,
    authenticate: async (authHeader: string | null) => {
      const actorId = authHeader ? tokenMap.get(authHeader) : undefined;
      if (!actorId) throw new Error("Unauthenticated");
      return actorId;
    },
    readBody: async (request: Request) => JSON.parse(await request.text()),
    verifierUnavailable: VerifierUnavailableError,
  });

  const inProcessFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const request = new Request(url, init);
    return handler(request);
  };

  return { store, handler, fetch: inProcessFetch };
}

const REFERRAL_TARGETS = ["rph-adult-secure", "fsh-adult-secure"];

/** Same valid suitability fixture as ward-audit.test: mismatch one or both ward cohorts. */
function referralWorld(outcome: "accepted" | "partial" | "denied") {
  const world = seedWorld(FIXED_CLOCK);
  const movement = world.state.movements.find((row) => row.id === "WF-009")!;
  movement.gender = "Male";
  const differentCohort = COHORTS.find((cohort) => cohort !== movement.cohort)!;
  if (outcome !== "accepted")
    world.state.units.find((unit) => unit.id === REFERRAL_TARGETS[1])!.cohort = differentCohort;
  if (outcome === "denied") world.state.units.find((unit) => unit.id === REFERRAL_TARGETS[0])!.cohort = differentCohort;
  expect(validWorld(world)).toBe(true);
  return world;
}

function referralCommand(): Extract<WardFlowEvent, { type: "REFER_TO_UNITS" }> {
  return {
    type: "REFER_TO_UNITS",
    role: "coordinator",
    now: 0, // The server supplies its own clock.
    movementId: "WF-009",
    unitIds: REFERRAL_TARGETS,
  };
}

describe("shared referral suitability decisions", () => {
  it.each(["accepted", "partial", "denied"] as const)("preserves the reducer's %s target decision", (outcome) => {
    const world = referralWorld(outcome);
    const event = referralCommand();
    expect(validCommand(event)).toBe(true);
    const local = wardFlowReducer(world.state, { ...event, now: worldNow(world, FIXED_CLOCK) });
    expect(local.auditEvents.at(-1)?.outcome).toBe(outcome);
    const result = applyCommand(world, event, FIXED_CLOCK);
    expect(result.outcome).toBe(outcome === "denied" ? "denied" : "accepted");
    if (result.outcome === "denied") {
      expect(outcome).toBe("denied");
      expect(result.world).toBe(world);
      expect(result.changes).toEqual({});
      return;
    }
    expect(validWorld(result.world)).toBe(true);
    expect(result.world.state.movements).toEqual(local.movements);
    // D-18 keeps transient refusal prose out of shared storage; coded target denials survive in audit.
    expect(local.rejections).toHaveLength(outcome === "partial" ? 1 : 0);
    expect(result.world.state.rejections).toEqual([]);
    expect(result.world.state.auditEvents).toEqual(local.auditEvents);
    expect(result.changes.domainAudit).toEqual(local.auditEvents);
    const audit = result.world.state.auditEvents.at(-1)!;
    expect(audit).toMatchObject({
      action: "REFER_TO_UNITS",
      outcome,
      details: {
        targets: [
          { unitId: REFERRAL_TARGETS[0], outcome: "accepted" },
          { unitId: REFERRAL_TARGETS[1], outcome: outcome === "partial" ? "denied" : "accepted" },
        ],
      },
    });
    expect(result.world.state.movements.find((row) => row.id === event.movementId)!.referredUnitIds).toEqual(
      outcome === "partial" ? [REFERRAL_TARGETS[0]] : REFERRAL_TARGETS,
    );
  });

  it("does not reuse a previous partial decision to admit a later refused or malformed command", () => {
    const partial = applyCommand(referralWorld("partial"), referralCommand(), FIXED_CLOCK);
    expect(partial.outcome).toBe("accepted");
    const event = { ...referralCommand(), unitIds: [REFERRAL_TARGETS[1]] };
    const denied = applyCommand(partial.world, event, FIXED_CLOCK);
    expect(denied.outcome).toBe("denied");
    expect(denied.world).toBe(partial.world);
    expect(applyCommand(partial.world, { ...event, unitIds: ["unknown-ward"] }, FIXED_CLOCK).outcome).toBe("denied");
    expect(() => applyCommand(partial.world, { ...event, role: "ward" }, FIXED_CLOCK)).toThrow("invalid-command");
    expect(applyCommand(partial.world, { ...event, unitIds: "invalid" }, FIXED_CLOCK).outcome).toBe("denied");
    expect(() => applyCommand(partial.world, { ...event, unitIds: 42 }, FIXED_CLOCK)).toThrow("invalid-command");
  });

  it("captures only this command's partial decision when the saved audit copy is already bounded", () => {
    const world = referralWorld("partial");
    const template = wardFlowReducer(world.state, {
      ...referralCommand(),
      now: worldNow(world, FIXED_CLOCK),
    }).auditEvents.at(-1)!;
    world.state.auditEvents = Array.from({ length: PERSISTED_AUDIT_EVENTS }, (_, index) => ({
      ...JSON.parse(JSON.stringify(template)),
      id: `audit-fixture-${index}`,
      sequence: index + 1,
    }));
    world.state.auditSequence = PERSISTED_AUDIT_EVENTS;
    expect(validWorld(world)).toBe(true);
    const result = applyCommand(world, referralCommand(), FIXED_CLOCK);
    expect(result.outcome).toBe("accepted");
    if (result.outcome !== "accepted") throw new Error("Partial referral was refused");
    expect(result.changes.domainAudit).toHaveLength(1);
    expect(result.changes.domainAudit[0]).toMatchObject({ outcome: "partial", sequence: PERSISTED_AUDIT_EVENTS + 1 });
    expect(result.world.state.auditEvents).toHaveLength(PERSISTED_AUDIT_EVENTS);
    expect(validWorld(result.world)).toBe(true);
    const denied = applyCommand(result.world, { ...referralCommand(), unitIds: [REFERRAL_TARGETS[1]] }, FIXED_CLOCK);
    expect(denied.outcome).toBe("denied");
    expect(denied.world).toBe(result.world);
  });

  it("commits the allowed subset once through mocked HTTP and preserves replay, revision and refusal guards", async () => {
    const store = createMemoryStore(() => FIXED_CLOCK, referralWorld("partial"));
    const { fetch: request } = createInProcessFetch(store);
    const event = referralCommand();
    const commandId = randomUUID();
    const post = (id: string, revision: number, command = event, token = "token-coordinator-a") =>
      request("https://ward-flow.example.test/v1/workspace/commands", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          classification: "synthetic",
          dataMode: "prototype",
          commandId: id,
          expectedRevision: revision,
          event: command,
        }),
      });
    const response = await post(commandId, 1);
    expect(response.status).toBe(200);
    const accepted = await response.json();
    expect(accepted.outcome).toBe("accepted");
    expect(accepted.snapshot.revision).toBe(2);
    expect(
      accepted.snapshot.payload.state.movements.find((row: { id: string }) => row.id === event.movementId)
        .referredUnitIds,
    ).toEqual([REFERRAL_TARGETS[0]]);
    expect(accepted.snapshot.payload.state.auditEvents.at(-1).outcome).toBe("partial");
    const replay = await post(commandId, 1);
    expect(replay.status).toBe(200);
    const replayed = await replay.json();
    expect(replayed.replayed).toBe(true);
    expect(replayed.snapshot).toEqual(accepted.snapshot);
    expect(await store.audit()).toHaveLength(1);
    const stale = await post(randomUUID(), 1);
    expect(stale.status).toBe(409);
    expect((await stale.json()).snapshot.revision).toBe(2);
    const denied = await post(randomUUID(), 2, { ...event, unitIds: [REFERRAL_TARGETS[1]] });
    expect(denied.status).toBe(422);
    expect((await denied.json()).snapshot).toEqual(accepted.snapshot);
    const reusedId = await post(commandId, 2);
    expect(reusedId.status).toBe(422);
    const unauthorised = await post(randomUUID(), 2, event, "token-non-coordinator");
    expect(unauthorised.status).toBe(403);
    expect((await store.read()).revision).toBe(2);
  });
});

describe("Frontend-to-backend shared workspace contract", () => {
  it("hydrates the initial shared workspace snapshot via GET /v1/workspace", async () => {
    const { fetch: inProcessFetch } = createInProcessFetch();
    let latestView: SharedView | undefined;

    const client = new SharedWorkspaceClient({
      baseUrl: "https://ward-flow.example.test",
      token: async () => "token-coordinator-a",
      changed: (view) => {
        latestView = view;
      },
      fetch: inProcessFetch,
    });

    await client.refresh();

    expect(latestView?.status).toBe("ready");
    expect(latestView?.error).toBeNull();
    expect(latestView?.snapshot).not.toBeNull();
    expect(latestView?.snapshot?.dataMode).toBe("prototype");
    expect(latestView?.snapshot?.revision).toBe(1);
    expect(latestView?.snapshot?.payload.version).toBe(1);
    expect(latestView?.snapshot?.payload.state.units.length).toBeGreaterThan(0);

    client.dispose();
  });

  it("dispatches a command via POST /v1/workspace/commands, increments revision, and transitions state", async () => {
    const { fetch: inProcessFetch } = createInProcessFetch();
    let latestView: SharedView | undefined;

    const client = new SharedWorkspaceClient({
      baseUrl: "https://ward-flow.example.test",
      token: async () => "token-coordinator-a",
      changed: (view) => {
        latestView = view;
      },
      fetch: inProcessFetch,
      commandId: () => randomUUID(),
    });

    await client.refresh();
    const initialUnit = latestView?.snapshot?.payload.state.units[0];
    expect(initialUnit).toBeDefined();

    const event: WardFlowEvent = {
      type: "DISPATCH_BROADCAST_ALERT",
      role: "coordinator",
      now: latestView!.snapshot!.now,
      title: "Synthetic network capacity check",
      message: "Confirm bed state before 11:00 handover.",
      severity: "warning",
      category: "capacity_gridlock",
      targetScope: "all",
      targetScopeLabel: "All mental health units",
      durationMinutes: 120,
      dispatchedByName: "Synthetic Coordinator",
    };

    client.dispatch(event);

    await vi.waitFor(() => {
      expect(latestView?.status).toBe("ready");
      expect(latestView?.snapshot?.revision).toBe(2);
    });

    expect(latestView?.error).toBeNull();
    expect(latestView?.eventLog).toEqual([
      {
        type: "DISPATCH_BROADCAST_ALERT",
        role: "coordinator",
        now: latestView!.snapshot!.now,
        accepted: true,
        sequence: 0,
      },
    ]);
    expect(
      latestView?.snapshot?.payload.state.broadcastAlerts.some(
        (alert) => alert.title === "Synthetic network capacity check",
      ),
    ).toBe(true);

    client.dispose();
  });

  it("handles concurrent 409 Conflict responses and resynchronizes to the winning coordinator snapshot", async () => {
    const { store, fetch: inProcessFetch } = createInProcessFetch();
    let viewA: SharedView | undefined;

    const clientA = new SharedWorkspaceClient({
      baseUrl: "https://ward-flow.example.test",
      token: async () => "token-coordinator-a",
      changed: (view) => {
        viewA = view;
      },
      fetch: inProcessFetch,
      commandId: () => randomUUID(),
    });

    await clientA.refresh();
    expect(viewA?.snapshot?.revision).toBe(1);

    // Coordinator B commits a change first, advancing backend revision from 1 -> 2
    // while clientA still holds expectedRevision = 1.
    const winningCommandResult = await store.command(COORDINATOR_B, randomUUID(), 1, {
      type: "ADVANCE_CLOCK",
      role: "demo",
      minutes: 15,
    });
    expect(winningCommandResult.status).toBe(200);
    expect(winningCommandResult.body.snapshot.revision).toBe(2);

    // Client A now dispatches against stale revision 1.
    clientA.dispatch({
      type: "ADVANCE_CLOCK",
      role: "demo",
      now: viewA!.snapshot!.now,
      minutes: 30,
    });

    await vi.waitFor(() => {
      expect(viewA?.status).toBe("ready");
      expect(viewA?.snapshot?.revision).toBe(2);
      expect(viewA?.error).toContain("This record changed while you were looking");
    });

    // Client A adopted Coordinator B's committed +15 min state rather than its own +30 min state.
    expect(viewA?.snapshot?.payload.state.clockOffsetMinutes).toBe(15);
    expect(viewA?.eventLog).toHaveLength(1);
    expect(viewA?.eventLog?.[0]?.accepted).toBe(false);

    clientA.dispose();
  });

  it("rejects unauthenticated (401), unauthorized (403), and invalid/workflow-denied (422) requests cleanly", async () => {
    const { handler, fetch: inProcessFetch } = createInProcessFetch();

    // 1. 401 Unauthenticated request transitions client to not-authorised
    let unauthView: SharedView | undefined;
    const unauthClient = new SharedWorkspaceClient({
      baseUrl: "https://ward-flow.example.test",
      token: async () => "invalid-token",
      changed: (view) => {
        unauthView = view;
      },
      fetch: inProcessFetch,
    });
    await unauthClient.refresh();
    expect(unauthView?.status).toBe("not-authorised");
    expect(unauthView?.snapshot).toBeNull();
    unauthClient.dispose();

    // 2. 403 An account with no role reaches the no-role state, where it may ask for access
    //    (role access later pass).
    let forbiddenView: SharedView | undefined;
    const forbiddenClient = new SharedWorkspaceClient({
      baseUrl: "https://ward-flow.example.test",
      token: async () => "token-non-coordinator",
      changed: (view) => {
        forbiddenView = view;
      },
      fetch: inProcessFetch,
    });
    await forbiddenClient.refresh();
    expect(forbiddenView?.status).toBe("no-role");
    expect(forbiddenView?.snapshot).toBeNull();
    forbiddenClient.dispose();

    // 3. 422 Workflow rejection (e.g. pulling a non-existent movement) keeps revision unchanged and surfaces workflow error
    let validView: SharedView | undefined;
    const validClient = new SharedWorkspaceClient({
      baseUrl: "https://ward-flow.example.test",
      token: async () => "token-coordinator-a",
      changed: (view) => {
        validView = view;
      },
      fetch: inProcessFetch,
      commandId: () => randomUUID(),
    });
    await validClient.refresh();
    expect(validView?.snapshot?.revision).toBe(1);

    validClient.dispatch({
      type: "PULL_PATIENT",
      role: "coordinator",
      now: validView!.snapshot!.now,
      movementId: "WF-NON-EXISTENT",
      unitId: "rph-adult-secure",
    });

    await vi.waitFor(() => {
      expect(validView?.status).toBe("ready");
      // Audit F-08: the engine's own reason reaches the screen, not a fixed sentence.
      expect(validView?.error).toBe("No movement found for id UMRN not recorded. Nothing was changed.");
    });
    expect(validView?.snapshot?.revision).toBe(1);
    expect(validView?.eventLog?.[0]?.accepted).toBe(false);

    // 4. Direct HTTP 422 check when reusing a commandId with a different payload
    const reusedCommandId = randomUUID();
    const firstReq = new Request("https://ward-flow.example.test/v1/workspace/commands", {
      method: "POST",
      headers: {
        authorization: "Bearer token-coordinator-a",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        classification: "synthetic",
        dataMode: "prototype",
        commandId: reusedCommandId,
        expectedRevision: 1,
        event: { type: "ADVANCE_CLOCK", role: "demo", minutes: 5 },
      }),
    });
    const firstRes = await handler(firstReq);
    expect(firstRes.status).toBe(200);

    const conflictingReuseReq = new Request("https://ward-flow.example.test/v1/workspace/commands", {
      method: "POST",
      headers: {
        authorization: "Bearer token-coordinator-a",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        classification: "synthetic",
        dataMode: "prototype",
        commandId: reusedCommandId,
        expectedRevision: 1,
        event: { type: "ADVANCE_CLOCK", role: "demo", minutes: 45 },
      }),
    });
    const conflictingReuseRes = await handler(conflictingReuseReq);
    expect(conflictingReuseRes.status).toBe(422);

    validClient.dispose();
  });

  it("refuses a command that carries a real-looking Australian identifier", () => {
    for (const note of ["Medicare: 2123 45678 1", "UMRN 12345678", "call 0412 345 678"]) {
      expect(validCommand({ type: "ADVANCE_CLOCK", role: "demo", minutes: 5, note })).toBe(false);
    }
    expect(validCommand({ type: "ADVANCE_CLOCK", role: "demo", minutes: 5 })).toBe(true);
  });
});
