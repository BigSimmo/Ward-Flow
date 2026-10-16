import { describe, expect, it, vi } from "vitest";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import { eventLogEntryFor } from "../src/components/ward-management/ward-event-log";
import { WardAuthError } from "../src/components/ward-management/ward-supabase-auth";

const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
const snapshot = (revision: number): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
});
const event = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "ward-test" } as WardFlowEvent;

describe("shared workspace connection", () => {
  it.each([200, 409, 422, 400])("records a sanitized definitive command outcome for HTTP %i", async (status) => {
    const typedEvent = {
      type: "DISPATCH_BROADCAST_ALERT",
      role: "coordinator",
      now: 642,
      title: "Invented directive title",
      message: "Invented free text",
      severity: "critical",
      category: "capacity_gridlock",
      targetScope: "all",
      targetScopeLabel: "Invented scope",
      durationMinutes: 240,
      dispatchedByName: "Invented coordinator",
      reason: "Invented reason",
      patientId: "synthetic-patient-link",
    } as WardFlowEvent;
    let view: SharedView | undefined;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async (_url, options) =>
        options?.body
          ? Response.json(status === 400 ? { error: "invalid" } : { snapshot: snapshot(2) }, { status })
          : Response.json({ snapshot: snapshot(1) }),
    });
    await client.refresh();
    client.dispatch(typedEvent);
    await vi.waitFor(() => expect(view?.eventLog).toHaveLength(1));
    expect(view?.eventLog).toEqual([
      { type: "DISPATCH_BROADCAST_ALERT", role: "coordinator", now: 642, accepted: status === 200, sequence: 0 },
    ]);
    expect(view?.snapshot?.revision).toBe(status === 400 ? 1 : 2);
    client.dispose();
  });
  it("says so when the server has the demo controls switched off", async () => {
    let view: SharedView | undefined;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async (_url, options) =>
        options?.body
          ? Response.json({ outcome: "denied", snapshot: { ...snapshot(1), demoControls: false } }, { status: 422 })
          : Response.json({ snapshot: { ...snapshot(1), demoControls: false } }),
    });
    await client.refresh();
    expect(view?.snapshot?.demoControls).toBe(false);
    client.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: 642, minutes: 15 } as WardFlowEvent);
    await vi.waitFor(() => expect(view?.eventLog).toHaveLength(1));
    expect(view?.error).toBe("Demo controls are switched off on the shared workspace. Nothing was changed.");
    client.dispose();
  });
  it("says why when a command names a record outside the desk's place", async () => {
    let view: SharedView | undefined;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async (_url, options) =>
        options?.body
          ? Response.json(
              {
                outcome: "denied",
                code: "scope",
                error: "This change names a record outside your role's place.",
                snapshot: snapshot(1),
              },
              { status: 422 },
            )
          : Response.json({ snapshot: snapshot(1) }),
    });
    await client.refresh();
    client.dispatch(event);
    await vi.waitFor(() => expect(view?.eventLog).toHaveLength(1));
    expect(view?.error).toBe("This change names a record outside your role's place. Nothing was changed.");
    expect(view?.status).toBe("ready");
    client.dispose();
  });
  it("lists the account's roles to choose from, then works as the one chosen", async () => {
    let view: SharedView | undefined;
    let stored: string | null = null;
    const seen: (string | null)[] = [];
    const membership = "3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9d";
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      workingAs: { get: () => stored, set: (id) => (stored = id) },
      fetch: async (_url, options) => {
        const header = new Headers(options?.headers).get("x-ward-working-as");
        seen.push(header);
        return header
          ? Response.json({
              snapshot: snapshot(1),
              access: { role: "ward", scope: { kind: "ward", unitIds: ["ward-test"] } },
              workingAs: header,
              actorId: "9e8d7c6b-5a49-4382-a1b0-c9d8e7f6a5b4",
            })
          : Response.json(
              {
                code: "choose-role",
                choices: [
                  { workingAs: membership, role: "ward", scope: { kind: "ward", unitIds: ["ward-test"] } },
                  { workingAs: "bootstrap", role: "coordinator", scope: { kind: "statewide" } },
                ],
              },
              { status: 409 },
            );
      },
    });
    await client.refresh();
    expect(view?.status).toBe("choose-role");
    expect(view?.snapshot).toBeNull();
    expect(view?.choices?.map((choice) => choice.workingAs)).toEqual([membership, "bootstrap"]);
    // Waiting on the person: no poll is sent until they choose.
    await client.refresh();
    expect(seen).toEqual([null]);
    client.chooseRole(membership);
    await vi.waitFor(() => expect(view?.status).toBe("ready"));
    expect(stored).toBe(membership);
    expect(seen).toEqual([null, membership]);
    expect(view?.workingAs).toBe(membership);
    expect(view?.access).toEqual({ role: "ward", scope: { kind: "ward", unitIds: ["ward-test"] } });
    expect(view?.canSwitch).toBe(true);
    // A name or anything else typed is never sent as the role.
    client.chooseRole("Nurse in charge, Ward 6B");
    expect(stored).toBe(membership);
    client.switchRole();
    await vi.waitFor(() => expect(view?.status).toBe("choose-role"));
    expect(stored).toBeNull();
    client.dispose();
  });
  it("forgets an ended role once, then says the account has no role without signing out", async () => {
    let view: SharedView | undefined;
    let stored: string | null = "3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9d";
    const seen: (string | null)[] = [];
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      workingAs: { get: () => stored, set: (id) => (stored = id) },
      fetch: async (_url, options) => {
        seen.push(new Headers(options?.headers).get("x-ward-working-as"));
        return Response.json(
          { error: "No Ward Flow role is assigned to this account", code: "no-role", canRequest: true },
          { status: 403 },
        );
      },
    });
    await client.refresh();
    expect(seen).toEqual(["3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9d", null]);
    expect(stored).toBeNull();
    expect(view?.status).toBe("no-role");
    expect(view?.canRequest).toBe(true);
    expect(view?.snapshot).toBeNull();
    client.dispose();
  });
  it("hands back step-up and role refusals on access steps instead of signing out", async () => {
    let view: SharedView | undefined;
    const bodies: unknown[] = [];
    const answers = [
      Response.json({ code: "step-up", error: "Sign in again to carry on." }, { status: 401 }),
      Response.json({ error: "That role is wider than your own." }, { status: 403 }),
      Response.json({ membership: {} }),
      Response.json({ code: "role", error: "Phone alerts are not part of your role" }, { status: 422 }),
    ];
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async (_url, options) => {
        if (!options?.body) return Response.json({ snapshot: snapshot(1) });
        bodies.push(JSON.parse(String(options.body)));
        return answers.shift()!;
      },
    });
    await client.refresh();
    const grant = { actorId: "9e8d7c6b-5a49-4382-a1b0-c9d8e7f6a5b4", role: "ward", scope: {}, expiresInMinutes: 60 };
    await expect(client.grantAccess(grant)).resolves.toBe("step-up");
    await expect(client.approveAccess("m1")).resolves.toBe("That role is wider than your own.");
    await expect(client.revokeAccess("m1")).resolves.toBeNull();
    await expect(client.pushSubscribe({ endpoint: "https://push.example.test/1", keys: {} })).resolves.toBe("role");
    expect(view?.status).toBe("ready");
    expect(view?.snapshot?.revision).toBe(1);
    // The end date goes as a time, worked out from minutes, never from the demo clock.
    const expiresAt = Date.parse((bodies[0] as { expiresAt: string }).expiresAt);
    expect(Math.abs(expiresAt - (Date.now() + 60 * 60_000))).toBeLessThan(60_000);
    client.dispose();
  });
  it("opens a record through the server's break glass, and shows the board it answers with", async () => {
    let view: SharedView | undefined;
    const bodies: unknown[] = [];
    const answers = [
      Response.json({ code: "step-up", error: "Sign in again to carry on." }, { status: 401 }),
      Response.json({ error: "Opening a record outside your care is not part of your role." }, { status: 422 }),
      Response.json({ until: "2026-10-07T11:00:00Z", pattern: false, snapshot: snapshot(1) }),
    ];
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async (url, options) => {
        if (!options?.body) return Response.json({ snapshot: snapshot(1) });
        expect(String(url)).toBe("https://example.test/v1/workspace/break-glass");
        bodies.push(JSON.parse(String(options.body)));
        return answers.shift()!;
      },
    });
    await client.refresh();
    const before = view?.snapshot;
    await expect(client.breakGlass("P-1", "handover")).resolves.toBe("step-up");
    await expect(client.breakGlass("P-1", "handover")).resolves.toMatch(/not part of your role/);
    await expect(client.breakGlass("P-1", "handover")).resolves.toBeNull();
    expect(view?.snapshot).not.toBe(before);
    expect(view?.status).toBe("ready");
    // Only the patient and the reason from the list are sent.
    expect(bodies[0]).toEqual({ patientId: "P-1", reason: "handover" });
    client.dispose();
  });
  it("rejects missing or live provenance before showing a shared snapshot", async () => {
    for (const dataMode of [undefined, "live"]) {
      let view: SharedView | undefined;
      const client = new SharedWorkspaceClient({
        baseUrl: "https://example.test",
        token: async () => "test",
        changed: (next) => {
          view = next;
        },
        fetch: async () => Response.json({ snapshot: { ...snapshot(1), dataMode } }),
      });
      await client.refresh();
      expect(view?.snapshot).toBeNull();
      expect(view?.status).toBe("unavailable");
      client.dispose();
    }
  });
  it("retries an uncertain save with the exact command ID and expected revision", async () => {
    const requests: string[] = [];
    let nextCommandId = 0;
    const commandId = vi.fn(() => `test-id-${++nextCommandId}`);
    let view: SharedView | undefined;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      commandId,
      changed: (next) => {
        view = next;
      },
      fetch: async (_url, options) => {
        if (!options?.body) return Response.json({ snapshot: snapshot(1) });
        requests.push(String(options.body));
        if (requests.length === 1) throw new Error("response lost");
        return Response.json({ snapshot: snapshot(2), replayed: true });
      },
    });
    await client.refresh();
    client.dispatch(event);
    await vi.waitFor(() => expect(view?.status).toBe("unavailable"));
    expect(view?.status).toBe("unavailable");
    expect(view?.snapshot?.revision).toBe(1);
    expect(view?.eventLog).toEqual([]);
    await client.retry();
    expect(requests).toHaveLength(2);
    expect(requests[0]).toBe(requests[1]);
    const firstRequest = JSON.parse(requests[0]);
    const secondRequest = JSON.parse(requests[1]);
    expect(firstRequest.commandId).toBe("test-id-1");
    expect(secondRequest.commandId).toBe(firstRequest.commandId);
    expect(firstRequest.expectedRevision).toBe(1);
    expect(secondRequest.expectedRevision).toBe(1);
    expect(commandId).toHaveBeenCalledOnce();
    expect(view?.snapshot?.revision).toBe(2);
    expect(view?.status).toBe("ready");
    expect(view?.eventLog).toEqual([eventLogEntryFor(event, true)]);
    await client.refresh();
    expect(view?.eventLog).toEqual([eventLogEntryFor(event, true)]);
    client.dispose();
  });
  it("shows committed winner state after a conflict and does not silently retry", async () => {
    let commands = 0;
    let view: SharedView | undefined;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async (_url, options) => {
        if (!options?.body) return Response.json({ snapshot: snapshot(1) });
        commands++;
        return Response.json({ snapshot: snapshot(2), error: "stale" }, { status: 409 });
      },
    });
    await client.refresh();
    client.dispatch(event);
    await vi.waitFor(() => {
      expect(view?.snapshot?.revision).toBe(2);
      expect(view?.error).toContain("not applied");
    });
    expect(commands).toBe(1);
    expect(view?.snapshot?.revision).toBe(2);
    expect(view?.error).toContain("not applied");
    client.dispose();
  });
  it("clears protected state after access is revoked", async () => {
    let calls = 0;
    let view: SharedView | undefined;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async () => (++calls <= 2 ? Response.json({ snapshot: snapshot(1) }) : Response.json({}, { status: 403 })),
    });
    await client.refresh();
    client.dispatch(event);
    await vi.waitFor(() => expect(view?.eventLog).toHaveLength(1));
    await client.refresh();
    expect(view?.snapshot).toBeNull();
    expect(view?.status).toBe("not-authorised");
    expect(view?.eventLog).toEqual([]);
    client.dispatch(event);
    expect(calls).toBe(3);
    client.dispose();
  });
  it("keeps queued actions moving when a refresh was already in flight", async () => {
    let resolve: (() => void) | undefined;
    let reads = 0;
    let commands = 0;
    let view: SharedView | undefined;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async (_url, options) => {
        if (options?.body) {
          commands++;
          return Response.json({ snapshot: snapshot(2) });
        }
        if (++reads === 2)
          await new Promise<void>((done) => {
            resolve = done;
          });
        return Response.json({ snapshot: snapshot(1) });
      },
    });
    await client.refresh();
    const refresh = client.refresh();
    await vi.waitFor(() => expect(resolve).toBeTypeOf("function"));
    client.dispatch(event);
    resolve!();
    await refresh;
    await vi.waitFor(() => expect(commands).toBe(1));
    await vi.waitFor(() => {
      expect(view?.status).toBe("ready");
      expect(view?.snapshot?.revision).toBe(2);
    });
    expect(commands).toBe(1);
    client.dispose();
  });
});

describe("phone alert calls", () => {
  const endpoint = "https://fcm.googleapis.com/fcm/send/device";
  function client(answer: (path: string) => Response) {
    return new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: () => {},
      fetch: async (url) => answer(new URL(String(url)).pathname),
    });
  }

  it("reads ownership and revocation from the server, never assuming them", async () => {
    const owned = client((path) =>
      Response.json(path.endsWith("push-status") ? { owned: true } : { subscribed: false, revoked: true }),
    );
    expect(await owned.pushStatus(endpoint)).toBe(true);
    expect(await owned.pushUnsubscribe(endpoint)).toBe(true);
    const notOwned = client(() => Response.json({}));
    expect(await notOwned.pushStatus(endpoint)).toBe(false);
    expect(await notOwned.pushUnsubscribe(endpoint)).toBe(false);
    expect(await notOwned.pushKey()).toEqual({ enabled: false });
  });

  it("returns a refusal the person can act on instead of rejecting", async () => {
    const inUse = client(() => Response.json({ code: "in-use", error: "another account" }, { status: 409 }));
    expect(await inUse.pushSubscribe({ endpoint })).toBe("in-use");
    const full = client(() => Response.json({ code: "limit", error: "10 devices" }, { status: 409 }));
    expect(await full.pushSubscribe({ endpoint })).toBe("limit");
    const ok = client(() => Response.json({ subscribed: true }));
    expect(await ok.pushSubscribe({ endpoint })).toBe("subscribed");
  });

  it("a server failure rejects, so the switch keeps its last confirmed state", async () => {
    const failing = client(() => Response.json({ error: "unavailable" }, { status: 503 }));
    await expect(failing.pushKey()).rejects.toThrow();
    await expect(failing.pushStatus(endpoint)).rejects.toThrow();
    await expect(failing.pushSubscribe({ endpoint })).rejects.toThrow();
    await expect(failing.pushUnsubscribe(endpoint)).rejects.toThrow();
  });
});

it("aborts disposed requests and suppresses late snapshots", async () => {
  let finish!: (response: Response) => void;
  let signal: AbortSignal | null | undefined;
  const changed = vi.fn();
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "token",
    changed,
    fetch: async (_url, init) => {
      signal = init?.signal;
      return new Promise((r) => {
        finish = r;
      });
    },
  });
  const pending = client.refresh();
  await vi.waitFor(() => expect(finish).toBeDefined());
  client.dispose();
  expect(signal?.aborted).toBe(true);
  finish(Response.json({ snapshot: snapshot(1) }));
  await pending;
  expect(changed).not.toHaveBeenCalled();
});

it("drops an uncertain command and queued actions when token refresh detects an account change", async () => {
  let changedAccount = false;
  let view: SharedView | undefined;
  const requests: string[] = [];
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => {
      if (changedAccount) throw new WardAuthError("session", "The signed-in account changed. Sign in again.");
      return "synthetic-token";
    },
    changed: (next) => {
      view = next;
    },
    fetch: async (_url, init) => {
      if (!init?.body) return Response.json({ snapshot: snapshot(1) });
      requests.push(String(init.body));
      throw new Error("Synthetic lost save response");
    },
  });
  await client.refresh();
  client.dispatch(event);
  client.dispatch(event);
  await vi.waitFor(() => expect(view?.status).toBe("unavailable"));
  changedAccount = true;
  await client.retry();
  expect(view?.status).toBe("not-authorised");
  expect(view?.snapshot).toBeNull();
  expect(view?.eventLog).toEqual([]);
  changedAccount = false;
  await client.retry();
  client.dispatch(event);
  expect(requests).toHaveLength(1);
  client.dispose();
});

describe("shared workspace traffic", () => {
  it("polls with the revision it holds and keeps its snapshot when the workspace has not changed", async () => {
    const urls: string[] = [];
    let view: SharedView | undefined;
    let notModified = false;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async (url) => {
        urls.push(String(url));
        return notModified
          ? Response.json({ notModified: true, revision: 3, now: 700 })
          : Response.json({ snapshot: snapshot(3) });
      },
    });
    await client.refresh();
    const held = view?.snapshot;
    notModified = true;
    await client.refresh();
    expect(urls).toEqual(["https://example.test/v1/workspace", "https://example.test/v1/workspace?since=3"]);
    expect(view?.status).toBe("ready");
    expect(view?.snapshot?.revision).toBe(3);
    expect(view?.snapshot?.now).toBe(700);
    expect(view?.snapshot?.payload).toBe(held?.payload);
    client.dispose();
  });

  it("refuses a not-modified answer for a revision it does not hold", async () => {
    let view: SharedView | undefined;
    let calls = 0;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async () =>
        calls++ === 0
          ? Response.json({ snapshot: snapshot(3) })
          : Response.json({ notModified: true, revision: 4, now: 700 }),
    });
    await client.refresh();
    await client.refresh();
    expect(view?.status).toBe("unavailable");
    client.dispose();
  });

  it("asks for revision-only replies while commands are queued, then reads the board once", async () => {
    const bodies: Record<string, unknown>[] = [];
    const reads: string[] = [];
    let revision = 1;
    let view: SharedView | undefined;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async (url, options) => {
        if (!options?.body) {
          reads.push(String(url));
          return Response.json({ snapshot: snapshot(revision) });
        }
        const body = JSON.parse(String(options.body));
        bodies.push(body);
        revision += 1;
        return body.reply === "revision"
          ? Response.json({ outcome: "accepted", commandRevision: revision })
          : Response.json({ outcome: "accepted", commandRevision: revision, snapshot: snapshot(revision) });
      },
    });
    await client.refresh();
    client.dispatch(event);
    client.dispatch(event);
    client.dispatch(event);
    await vi.waitFor(() => expect(view?.eventLog).toHaveLength(3));
    // The first command leaves before the others are queued; the second has one behind it.
    expect(bodies.map((body) => [body.expectedRevision, body.reply])).toEqual([
      [1, undefined],
      [2, "revision"],
      [3, undefined],
    ]);
    expect(view?.snapshot?.revision).toBe(4);
    expect(reads).toEqual(["https://example.test/v1/workspace"]);
    client.dispose();
  });
});
