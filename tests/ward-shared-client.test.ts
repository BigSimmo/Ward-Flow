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

describe("shared snapshot access context", () => {
  it.each([undefined, "a".repeat(64)])(
    "preserves the optional server context without breaking older snapshots: %s",
    async (accessContext) => {
      let view: SharedView | undefined;
      const client = new SharedWorkspaceClient({
        baseUrl: "https://example.test",
        token: async () => "test",
        changed: (next) => {
          view = next;
        },
        fetch: async () =>
          Response.json({ snapshot: { ...snapshot(1), ...(accessContext === undefined ? {} : { accessContext }) } }),
      });
      await client.refresh();
      expect(view?.status).toBe("ready");
      expect(view?.snapshot?.accessContext).toBe(accessContext);
      client.dispose();
    },
  );

  it.each([null, "", "a".repeat(63), "a".repeat(65), "A".repeat(64), "g".repeat(64), 42, {}])(
    "refuses malformed server access context %#",
    async (accessContext) => {
      let view: SharedView | undefined;
      const client = new SharedWorkspaceClient({
        baseUrl: "https://example.test",
        token: async () => "test",
        changed: (next) => {
          view = next;
        },
        fetch: async () => Response.json({ snapshot: { ...snapshot(1), accessContext } }),
      });
      await client.refresh();
      expect(view?.status).toBe("unavailable");
      expect(view?.snapshot).toBeNull();
      client.dispose();
    },
  );

  it("keeps context on clock-only polls and replaces it on equal-revision snapshots and command replies", async () => {
    let view: SharedView | undefined;
    let reads = 0;
    const first = "a".repeat(64);
    const changed = "b".repeat(64);
    const committed = "c".repeat(64);
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      commandId: () => "11111111-1111-4111-8111-111111111111",
      changed: (next) => {
        view = next;
      },
      fetch: async (_url, init) => {
        if (init?.body)
          return Response.json({ outcome: "accepted", snapshot: { ...snapshot(2), accessContext: committed } });
        reads++;
        if (reads === 2) return Response.json({ notModified: true, revision: 1, now: 643 });
        return Response.json({ snapshot: { ...snapshot(1), accessContext: reads === 1 ? first : changed } });
      },
    });
    await client.refresh();
    const payload = view!.snapshot!.payload;
    expect(view?.snapshot?.accessContext).toBe(first);
    await client.refresh();
    expect(view?.snapshot?.accessContext).toBe(first);
    expect(view?.snapshot?.now).toBe(643);
    await client.refresh();
    expect(view?.snapshot?.revision).toBe(1);
    expect(view?.snapshot?.accessContext).toBe(changed);
    expect(view?.snapshot?.payload).toBe(payload);
    await expect(client.dispatch(event)).resolves.toMatchObject({ status: "accepted" });
    expect(view?.snapshot?.accessContext).toBe(committed);
    expect(view?.snapshot?.revision).toBe(2);
    client.dispose();
  });
});

describe("shared view response ordering", () => {
  it("does not report an old opening as successful when its union read is interrupted by a desk change", async () => {
    let view: SharedView | undefined;
    const finishes = new Map<string, (response: Response) => void>();
    let finishUnion!: (response: Response) => void;
    let reads = 0;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async (_url, init) => {
        if (init?.body) {
          const { patientId } = JSON.parse(String(init.body));
          return new Promise((resolve) => {
            finishes.set(patientId, resolve);
          });
        }
        if (reads++ === 1)
          return new Promise((resolve) => {
            finishUnion = resolve;
          });
        return Response.json({
          snapshot: snapshot(1),
          workingAs: new Headers(init?.headers).get("x-ward-working-as") ?? "bootstrap",
        });
      },
    });
    await client.refresh();
    const first = client.breakGlass("synthetic-first", "handover");
    const second = client.breakGlass("synthetic-second", "handover");
    await vi.waitFor(() => expect(finishes.size).toBe(2));
    finishes.get("synthetic-second")!(Response.json({ snapshot: snapshot(1) }));
    await expect(second).resolves.toBeNull();
    finishes.get("synthetic-first")!(Response.json({ snapshot: snapshot(1) }));
    await vi.waitFor(() => expect(finishUnion).toBeDefined());
    const membership = "3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9d";
    client.chooseRole(membership);
    await vi.waitFor(() => expect(view?.workingAs).toBe(membership));
    finishUnion(Response.json({ snapshot: snapshot(1) }));
    await expect(first).resolves.toMatch(/working view changed/i);
    expect(view?.workingAs).toBe(membership);
    expect(view?.status).toBe("ready");
    client.dispose();
  });

  it("re-reads the union of overlapping grants when their snapshots arrive out of order", async () => {
    let view: SharedView | undefined;
    const finishes = new Map<string, (response: Response) => void>();
    const scoped = (minutes: number): SharedSnapshot => ({
      ...snapshot(1),
      payload: {
        ...snapshot(1).payload,
        state: { ...state, configuration: { ...state.configuration, pullHoldMinutes: minutes } },
      },
    });
    let reads = 0;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async (_url, init) => {
        if (init?.body) {
          const { patientId } = JSON.parse(String(init.body));
          return new Promise((resolve) => {
            finishes.set(patientId, resolve);
          });
        }
        return Response.json({ snapshot: reads++ === 0 ? snapshot(1) : scoped(60) });
      },
    });
    await client.refresh();
    const first = client.breakGlass("synthetic-first", "handover");
    const second = client.breakGlass("synthetic-second", "handover");
    await vi.waitFor(() => expect(finishes.size).toBe(2));
    finishes.get("synthetic-second")!(Response.json({ snapshot: scoped(60) }));
    await expect(second).resolves.toBeNull();
    finishes.get("synthetic-first")!(Response.json({ snapshot: scoped(45) }));
    await expect(first).resolves.toBeNull();
    expect(view?.snapshot?.payload.state.configuration.pullHoldMinutes).toBe(60);
    expect(reads).toBe(2);
    client.dispose();
  });

  it("forgets a refused role locally even when the external role setter is read only", async () => {
    let view: SharedView | undefined;
    let reads = 0;
    const seen: (string | null)[] = [];
    const membership = "3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9d";
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      workingAs: { get: () => membership, set: () => {} },
      fetch: async (_url, init) => {
        const workingAs = new Headers(init?.headers).get("x-ward-working-as");
        seen.push(workingAs);
        if (reads++ === 0) return Response.json({ snapshot: snapshot(1), workingAs });
        if (reads === 2) return Response.json({ code: "no-role" }, { status: 403 });
        if (workingAs) throw new Error("The test stops a repeated refused-role request");
        return Response.json({ snapshot: snapshot(1), workingAs: "bootstrap" });
      },
    });
    await client.refresh();
    await client.refresh();
    expect(view?.status).toBe("ready");
    expect(view?.workingAs).toBe("bootstrap");
    expect(seen).toEqual([membership, membership, null]);
    client.dispose();
  });

  it("cancels a token-waiting access mutation when a poll discovers the selected role has ended", async () => {
    let view: SharedView | undefined;
    let stored: string | null = "3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9d";
    let tokens = 0;
    let reads = 0;
    let releaseToken!: (token: string) => void;
    const posts: (string | null)[] = [];
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => {
        if (tokens++ === 1)
          return new Promise((resolve) => {
            releaseToken = resolve;
          });
        return "test";
      },
      workingAs: { get: () => stored, set: (id) => (stored = id) },
      changed: (next) => {
        view = next;
      },
      fetch: async (_url, init) => {
        const workingAs = new Headers(init?.headers).get("x-ward-working-as");
        if (init?.body) {
          posts.push(workingAs);
          return Response.json({});
        }
        if (reads++ === 0) return Response.json({ snapshot: snapshot(1), workingAs });
        return workingAs
          ? Response.json({ code: "no-role" }, { status: 403 })
          : Response.json({ snapshot: snapshot(1), workingAs: "bootstrap" });
      },
    });
    await client.refresh();
    const mutation = client
      .grantAccess({
        actorId: "22222222-2222-4222-8222-222222222222",
        role: "ward",
        scope: { kind: "ward", unitIds: ["rph-adult-secure"] },
        expiresInMinutes: 60,
      })
      .catch((error: unknown) => error);
    await vi.waitFor(() => expect(releaseToken).toBeDefined());
    await client.refresh();
    expect(view?.workingAs).toBe("bootstrap");
    releaseToken("test");
    expect(await mutation).toBeInstanceOf(Error);
    expect(posts).toEqual([]);
    expect(view?.status).toBe("ready");
    expect(view?.workingAs).toBe("bootstrap");
    client.dispose();
  });

  it("does not replay a refused command through another role when its selected membership ends", async () => {
    let view: SharedView | undefined;
    let stored: string | null = "3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9d";
    const commands: (string | null)[] = [];
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      workingAs: { get: () => stored, set: (id) => (stored = id) },
      fetch: async (_url, init) => {
        const workingAs = new Headers(init?.headers).get("x-ward-working-as");
        if (!init?.body) return Response.json({ snapshot: snapshot(1), workingAs: workingAs ?? "bootstrap" });
        commands.push(workingAs);
        return workingAs
          ? Response.json({ code: "no-role", error: "No Ward Flow role is assigned to this account" }, { status: 403 })
          : Response.json({ snapshot: snapshot(2) });
      },
    });
    await client.refresh();
    client.dispatch(event);
    await vi.waitFor(() => expect(view?.status).toBe("ready"));
    expect(commands).toEqual(["3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9d"]);
    expect(view?.snapshot?.revision).toBe(1);
    expect(view?.workingAs).toBe("bootstrap");
    // Main's ended-role contract: the refused attempt is logged and the person is told why.
    expect(view?.eventLog).toEqual([expect.objectContaining({ accepted: false })]);
    expect(view?.error).toBe(
      "The role this tab was working as has ended. Review the current desk before making changes.",
    );
    client.dispose();
  });

  it("forgets the old revision when a revoked desk falls back to the account's remaining role", async () => {
    let view: SharedView | undefined;
    let stored: string | null = "3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9d";
    const urls: string[] = [];
    let reads = 0;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      workingAs: { get: () => stored, set: (id) => (stored = id) },
      fetch: async (url, init) => {
        urls.push(String(url));
        if (reads++ === 0) return Response.json({ snapshot: snapshot(1) });
        if (new Headers(init?.headers).has("x-ward-working-as"))
          return Response.json({ code: "no-role" }, { status: 403 });
        return String(url).includes("?since=")
          ? Response.json({ notModified: true, revision: 1, now: 700 })
          : Response.json({ snapshot: snapshot(1), workingAs: "bootstrap" });
      },
    });
    await client.refresh();
    await client.refresh();
    expect(urls).toEqual([
      "https://example.test/v1/workspace",
      "https://example.test/v1/workspace?since=1",
      "https://example.test/v1/workspace",
    ]);
    expect(view?.workingAs).toBe("bootstrap");
    expect(view?.status).toBe("ready");
    client.dispose();
  });

  it("preserves the payload identity for identical full scoped polls while updating the server clock", async () => {
    let view: SharedView | undefined;
    let now = 642;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async () => Response.json({ snapshot: { ...snapshot(1), now } }),
    });
    await client.refresh();
    const held = view?.snapshot;
    now = 700;
    await client.refresh();
    expect(view?.snapshot?.now).toBe(700);
    expect(view?.snapshot?.payload).toBe(held?.payload);
    client.dispose();
  });

  it("confirms an in-flight command without losing a concurrently opened record", async () => {
    let view: SharedView | undefined;
    let finishCommand!: (response: Response) => void;
    let granted = false;
    let reads = 0;
    const accepted = snapshot(2);
    accepted.payload.state.undoRecords = [
      {
        kind: "step",
        undoType: "UNDO_REFER_TO_UNITS",
        action: "REFER_TO_UNITS",
        subjectId: "WF-030",
        at: 642,
        seq: 42,
        role: "coordinator",
        unitId: null,
        changes: [],
      },
    ];
    const opened = (revision: number): SharedSnapshot => ({
      ...snapshot(revision),
      payload: {
        ...snapshot(revision).payload,
        state: { ...state, configuration: { ...state.configuration, pullHoldMinutes: 45 } },
      },
    });
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async (url) => {
        if (String(url).endsWith("/commands"))
          return new Promise((resolve) => {
            finishCommand = resolve;
          });
        if (String(url).endsWith("/break-glass")) {
          granted = true;
          return Response.json({ snapshot: opened(1) });
        }
        reads += 1;
        return Response.json({ snapshot: granted ? opened(2) : snapshot(1) });
      },
    });
    await client.refresh();
    const completion = client.dispatchConfirmed(event);
    await vi.waitFor(() => expect(finishCommand).toBeDefined());
    await expect(client.breakGlass("synthetic-patient", "handover")).resolves.toBeNull();
    finishCommand(Response.json({ snapshot: accepted }));
    const outcome = await completion;
    expect(outcome).toMatchObject({ status: "accepted", undoRecords: accepted.payload.state.undoRecords });
    await vi.waitFor(() => expect(view?.status).toBe("ready"));
    expect(view?.eventLog).toEqual([eventLogEntryFor(event, true)]);
    expect(view?.snapshot?.revision).toBe(2);
    expect(view?.snapshot?.payload.state.configuration.pullHoldMinutes).toBe(45);
    expect(reads).toBe(2);
    expect(outcome.canUndo?.()).toBe(true);
    client.dispose();
  });

  it("keeps the opened view when a pre-grant poll's sign-in check fails after break glass", async () => {
    let view: SharedView | undefined;
    let failSignIn!: () => void;
    let tokenCalls = 0;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => {
        if (++tokenCalls === 2)
          await new Promise<never>((_, reject) => {
            failSignIn = () => reject(new WardAuthError("session", "Sign in again."));
          });
        return "test";
      },
      changed: (next) => {
        view = next;
      },
      fetch: async (url) =>
        Response.json({ snapshot: String(url).endsWith("/break-glass") ? snapshot(2) : snapshot(1) }),
    });
    await client.refresh();
    const stalePoll = client.refresh().catch(() => undefined);
    await vi.waitFor(() => expect(failSignIn).toBeDefined());
    await client.breakGlass("synthetic-patient", "handover");
    failSignIn();
    await stalePoll;
    expect(view?.status).not.toBe("not-authorised");
    expect(view?.snapshot?.revision).toBe(2);
    client.dispose();
  });

  it.each([200, 403])("ignores a pre-grant poll answered after break glass (HTTP %i)", async (status) => {
    let view: SharedView | undefined;
    let finishPoll!: (response: Response) => void;
    let reads = 0;
    const opened = snapshot(1);
    opened.payload = {
      ...opened.payload,
      state: {
        ...state,
        configuration: { ...state.configuration, pullHoldMinutes: 45 },
      },
    };
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async (url) => {
        if (String(url).endsWith("/break-glass")) return Response.json({ snapshot: opened });
        if (reads++ === 0) return Response.json({ snapshot: snapshot(1) });
        return new Promise((resolve) => {
          finishPoll = resolve;
        });
      },
    });
    await client.refresh();
    const pendingPoll = client.refresh();
    await vi.waitFor(() => expect(finishPoll).toBeDefined());
    await expect(client.breakGlass("synthetic-patient", "handover")).resolves.toBeNull();
    expect(view?.snapshot?.payload.state.configuration.pullHoldMinutes).toBe(45);
    finishPoll(Response.json(status === 200 ? { snapshot: snapshot(1) } : { error: "Unauthorised" }, { status }));
    await pendingPoll;
    expect(view?.status).toBe("ready");
    expect(view?.snapshot?.payload.state.configuration.pullHoldMinutes).toBe(45);
    client.dispose();
  });

  it("does not send a queued command as a new desk when its token wait finishes after a role choice", async () => {
    let view: SharedView | undefined;
    let releaseToken!: (token: string) => void;
    let tokens = 0;
    let stored: string | null = "bootstrap";
    const membership = "3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9d";
    const sent: { method: string; workingAs: string | null }[] = [];
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => {
        if (tokens++ === 1)
          return new Promise((resolve) => {
            releaseToken = resolve;
          });
        return "test";
      },
      changed: (next) => {
        view = next;
      },
      workingAs: { get: () => stored, set: (id) => (stored = id) },
      fetch: async (_url, init) => {
        const workingAs = new Headers(init?.headers).get("x-ward-working-as");
        sent.push({ method: init?.method ?? "GET", workingAs });
        return Response.json({ snapshot: snapshot(1), workingAs });
      },
    });
    await client.refresh();
    client.dispatch(event);
    await vi.waitFor(() => expect(releaseToken).toBeDefined());
    client.chooseRole(membership);
    releaseToken("test");
    await vi.waitFor(() => expect(view?.status).toBe("ready"));
    expect(sent).toEqual([
      { method: "GET", workingAs: "bootstrap" },
      { method: "GET", workingAs: membership },
    ]);
    expect(view?.eventLog).toEqual([]);
    expect(view?.workingAs).toBe(membership);
    client.dispose();
  });
});

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
    expect(view?.error).toBe(
      "Demo controls are switched off on the shared workspace. Nothing was changed. Ask whoever runs the demonstration to switch them on.",
    );
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
  it("shows the workflow's own reason when the engine refuses a command (audit F-08)", async () => {
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
              { outcome: "denied", error: "no allocatable bed on this ward", snapshot: snapshot(1) },
              { status: 422 },
            )
          : Response.json({ snapshot: snapshot(1) }),
    });
    await client.refresh();
    const outcome = await client.dispatch(event);
    expect(outcome.status).toBe("refused");
    expect(outcome.message).toBe("No allocatable bed on this ward. Nothing was changed.");
    expect(view?.error).toBe("No allocatable bed on this ward. Nothing was changed.");
    client.dispose();
  });
  it("says which ward was not asked when Refer to wards went to only some of them (audit E-05)", async () => {
    let view: SharedView | undefined;
    const reason = "FSH Adult Secure is not eligible for movement UM100023 — failed gate cohort.";
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async (_url, options) =>
        options?.body
          ? Response.json({ outcome: "partly", commandRevision: 2, error: reason, snapshot: snapshot(2) })
          : Response.json({ snapshot: snapshot(1) }),
    });
    await client.refresh();
    const outcome = await client.dispatch(event);
    expect(outcome.status).toBe("accepted");
    expect(outcome.partly).toBe(reason);
    expect(view?.error).toBe(`Sent to the suitable wards only. ${reason}`);
    client.dispose();
  });
  it("never sends a referral's chart files to the shared board (audit F-01)", async () => {
    const bodies: string[] = [];
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: () => {},
      fetch: async (_url, options) => {
        if (options?.body) bodies.push(String(options.body));
        return Response.json({ snapshot: snapshot(1) });
      },
    });
    await client.refresh();
    const chart = { name: "chart.pdf", mimeType: "application/pdf", sizeBytes: 4, base64: "JVBERg==" } as const;
    const referral = {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: 642,
      intake: {
        charts: [
          { ...chart, kind: "medication" },
          { ...chart, kind: "observation" },
        ],
      },
    } as unknown as WardFlowEvent;
    await client.dispatch(referral);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).not.toContain("JVBERg");
    const sent = JSON.parse(bodies[0]!) as { event: { intake: { charts: object[] } } };
    expect(sent.event.intake.charts).toEqual([
      { name: "chart.pdf", mimeType: "application/pdf", sizeBytes: 4, kind: "medication" },
      { name: "chart.pdf", mimeType: "application/pdf", sizeBytes: 4, kind: "observation" },
    ]);
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
  it("never re-sends a write without x-ward-working-as when the chosen role has ended, and refreshes the desk", async () => {
    let view: SharedView | undefined;
    let stored: string | null = "3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9d";
    const postHeaders: (string | null)[] = [];
    const getHeaders: (string | null)[] = [];
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      workingAs: { get: () => stored, set: (id) => (stored = id) },
      fetch: async (_url, options) => {
        const as = new Headers(options?.headers).get("x-ward-working-as");
        if (!options?.body) {
          getHeaders.push(as);
          return Response.json({ snapshot: snapshot(as ? 1 : 2), workingAs: as ?? "fallback-coordinator" });
        }
        postHeaders.push(as);
        return Response.json(
          { error: "No Ward Flow role is assigned to this account", code: "no-role" },
          { status: 403 },
        );
      },
    });
    await client.refresh();
    client.dispatch(event);
    await vi.waitFor(() => expect(getHeaders).toHaveLength(2));
    expect(postHeaders).toEqual(["3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9d"]);
    expect(getHeaders).toEqual(["3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9d", null]);
    expect(stored).toBeNull();
    expect(view?.eventLog).toHaveLength(1);
    expect(view?.eventLog?.[0]?.accepted).toBe(false);
    expect(view?.error).toBe(
      "The role this tab was working as has ended. Review the current desk before making changes.",
    );
    expect(view?.workingAs).toBe("fallback-coordinator");
    client.dispose();
  });
  it("refuses an access write after the chosen role ends instead of re-sending it under another role", async () => {
    let view: SharedView | undefined;
    let stored: string | null = "3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9d";
    const postHeaders: (string | null)[] = [];
    const getUrls: string[] = [];
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      workingAs: { get: () => stored, set: (id) => (stored = id) },
      fetch: async (url, options) => {
        if (!options?.body) {
          getUrls.push(String(url));
          return Response.json({ snapshot: snapshot(1), workingAs: "fallback-coordinator" });
        }
        postHeaders.push(new Headers(options?.headers).get("x-ward-working-as"));
        return Response.json(
          { error: "No Ward Flow role is assigned to this account", code: "no-role" },
          { status: 403 },
        );
      },
    });
    await client.refresh();
    const result = await client.revokeAccess("3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9e");
    expect(result).toBe("The role this tab was working as has ended. Review the current desk before making changes.");
    expect(postHeaders).toEqual(["3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9d"]);
    expect(stored).toBeNull();
    // The desk is read again in full, never from the ended role's revision.
    await vi.waitFor(() => expect(getUrls).toHaveLength(2));
    expect(getUrls[1]).toBe("https://example.test/v1/workspace");
    expect(view?.workingAs).toBe("fallback-coordinator");
    client.dispose();
  });
  it("drops a board read that was out when the role ended, so the ended desk never comes back", async () => {
    let view: SharedView | undefined;
    let stored: string | null = "3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9d";
    let releaseRead: (() => void) | undefined;
    let reads = 0;
    const seen: number[] = [];
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
        if (next.snapshot) seen.push(next.snapshot.revision);
      },
      workingAs: { get: () => stored, set: (id) => (stored = id) },
      fetch: async (_url, options) => {
        if (!options?.body) {
          reads += 1;
          // The second read starts under the ended role and answers only after the refusal.
          if (reads === 2) await new Promise<void>((resolve) => (releaseRead = resolve));
          return Response.json({ snapshot: snapshot(reads), workingAs: "fallback-coordinator" });
        }
        return Response.json(
          { error: "No Ward Flow role is assigned to this account", code: "no-role" },
          { status: 403 },
        );
      },
    });
    await client.refresh();
    const stale = client.refresh();
    await vi.waitFor(() => expect(releaseRead).toBeDefined());
    await client.revokeAccess("3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9e");
    expect(view?.snapshot).toBeNull();
    releaseRead!();
    await stale;
    await vi.waitFor(() => expect(reads).toBe(3));
    await vi.waitFor(() => expect(view?.snapshot?.revision).toBe(3));
    expect(seen).not.toContain(2);
    client.dispose();
  });
  it("signs out with the server's reason when the sign-in reaches the session limit", async () => {
    let view: SharedView | undefined;
    const error = "Signed out after 12 hours. Sign in again to carry on.";
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async () => Response.json({ code: "session-limit", error }, { status: 401 }),
    });
    await client.refresh().catch(() => {});
    expect(view?.status).toBe("not-authorised");
    expect(view?.error).toBe(error);
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
    await expect(client.revokeAccess("m1")).resolves.toBe("That role is wider than your own.");
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
      fetch: async () =>
        ++calls <= 2
          ? Response.json({ snapshot: snapshot(1) })
          : Response.json({ error: "Origin not allowed" }, { status: 403 }),
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

  it("names its access context on polls, and leaves it out once a minute for a full read (audit F-04)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const urls: string[] = [];
      const accessContext = "b".repeat(64);
      const client = new SharedWorkspaceClient({
        baseUrl: "https://example.test",
        token: async () => "test",
        changed: () => {},
        fetch: async (url) => {
          urls.push(String(url));
          return String(url).includes("context=")
            ? Response.json({ notModified: true, revision: 3, now: 700 })
            : Response.json({ snapshot: { ...snapshot(3), accessContext } });
        },
      });
      await client.refresh();
      await client.refresh();
      vi.advanceTimersByTime(61_000);
      await client.refresh();
      await client.refresh();
      expect(urls).toEqual([
        "https://example.test/v1/workspace",
        `https://example.test/v1/workspace?since=3&context=${accessContext}`,
        "https://example.test/v1/workspace?since=3",
        `https://example.test/v1/workspace?since=3&context=${accessContext}`,
      ]);
      client.dispose();
    } finally {
      vi.useRealTimers();
    }
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

  it("keeps checking queued commands against the last board it saw when someone else saved in between", async () => {
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
        // Another desk saves just before the second command lands.
        revision += bodies.length === 2 ? 2 : 1;
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
    // The third command is not sent against 4, which would hide the other desk's save at 3.
    expect(bodies.map((body) => [body.expectedRevision, body.reply])).toEqual([
      [1, undefined],
      [2, "revision"],
      [2, undefined],
    ]);
    await vi.waitFor(() => expect(reads).toHaveLength(2));
    client.dispose();
  });
});
