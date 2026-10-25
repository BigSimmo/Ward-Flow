/**
 * Closed records older than 30 days leave the live shared workspace for an archive that History
 * still reads (Josh, 25 Oct 2026, after the stress test's 8 MiB finding). Synthetic data only.
 */
import { describe, expect, it, vi } from "vitest";

import {
  ARCHIVE_AFTER_MINUTES,
  archiveClosedState,
  boundAudit,
  scopeArchive,
  seedWorld,
  type ArchivedRecord,
  type SharedWorld,
} from "../backend/ward-flow/engine";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { STATEWIDE_COORDINATOR, type WardAccess } from "../src/components/ward-management/ward-role-access";
import { SharedWorkspaceClient, type SharedView } from "../src/components/ward-management/ward-shared-client";
import { isValidSharedWardFlowState } from "../src/components/ward-management/ward-shared-state-validation";
import { nextEvent, seededRandom } from "./helpers/ward-engine-fuzz";

/** A busy synthetic world, as the shared server would hold it after a few thousand changes. */
function busyState(): { state: WardFlowState; now: number } {
  const random = seededRandom(25);
  let state = seedWardFlowState("standard");
  let now = 0;
  for (let step = 1, accepted = 0; accepted < 2500; step++) {
    const event = nextEvent(state, random, step);
    if (event.type === "RESET_SCENARIO" || event.type === "SET_SCENARIO" || event.role === "demo") continue;
    const next = wardFlowReducer(state, event);
    if (next.rejections.length > state.rejections.length) {
      state = { ...next, rejections: [] };
      continue;
    }
    state = boundAudit({ ...next, rejections: [] });
    now = Math.max(now, (event as { now: number }).now);
    accepted++;
  }
  return { state: JSON.parse(JSON.stringify(state)) as WardFlowState, now };
}

const busy = busyState();
// A month and a day later every record closed by then is old enough to archive.
const later = busy.now + ARCHIVE_AFTER_MINUTES + 24 * 60;
const split = archiveClosedState(busy.state, later);
const live = JSON.parse(JSON.stringify(split.state)) as WardFlowState;

describe("archiving closed records", () => {
  it("moves out old closed records and leaves a workspace that still passes the shared-state check", () => {
    expect(split.archived.length).toBeGreaterThan(0);
    expect(isValidSharedWardFlowState(JSON.parse(JSON.stringify(live)))).toBe(true);
    for (const record of split.archived) expect(record.closedAt).toBeLessThan(later - ARCHIVE_AFTER_MINUTES);
    const sizes = (state: WardFlowState) => JSON.stringify(state).length;
    expect(sizes(live)).toBeLessThan(sizes(busy.state));
  });

  it("archives only closed records and nothing the live workspace still names", () => {
    const text = JSON.stringify(live);
    for (const record of split.archived) {
      const body = record.body as { closure?: unknown; status?: string };
      if (record.collection === "movements") expect(body.closure).toBeTruthy();
      if (record.collection === "broadcastAlerts") expect(["stood_down", "expired"]).toContain(body.status);
      expect(text.includes(`"${record.id}"`), record.id).toBe(false);
    }
    // A referral that stays keeps every movement that carries it.
    const referrals = new Set(live.referrals.map((referral) => referral.id));
    for (const record of split.archived)
      if (record.collection === "movements")
        expect(referrals.has((record.body as { referralId?: string }).referralId ?? "")).toBe(false);
  });

  it("archives nothing younger than 30 days", () => {
    expect(archiveClosedState(busy.state, busy.now).archived).toEqual([]);
  });

  it("puts every record back exactly, so History reads the same world", () => {
    const restored = { ...live } as Record<string, unknown>;
    for (const collection of ["movements", "referrals", "broadcastAlerts"] as const)
      restored[collection] = [
        ...split.archived.filter((record) => record.collection === collection).map((record) => record.body),
        ...live[collection],
      ];
    for (const collection of ["movements", "referrals", "broadcastAlerts"] as const) {
      const ids = (list: { id: string }[]) => list.map((record) => record.id).sort();
      expect(ids(restored[collection] as { id: string }[])).toEqual(ids(busy.state[collection]));
    }
  });
});

describe("a desk reading the archive", () => {
  const world: SharedWorld = { ...seedWorld(new Date("2026-10-25T00:00:00Z")), state: live };
  const at = new Date("2026-10-25T00:00:00Z");

  it("the whole network reads every archived record", () => {
    expect(scopeArchive(world, split.archived, STATEWIDE_COORDINATOR, at)).toHaveLength(split.archived.length);
  });

  it("a ward desk reads only what its own live rule would show it", () => {
    const unit = live.units[0]!.id;
    const access: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [unit] } };
    const own = scopeArchive(world, split.archived, access, at);
    expect(own.length).toBeLessThan(split.archived.length);
    for (const record of own)
      expect(split.archived.some((stored: ArchivedRecord) => stored.id === record.id)).toBe(true);
  });
});

describe("the shared client shows archived records in History", () => {
  const snapshot = (archived?: number) => ({
    dataMode: "prototype" as const,
    revision: 7,
    now: later,
    ...(archived === undefined ? {} : { archived }),
    payload: { version: 1 as const, state: live, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
  });
  function client(archive: () => Response, archived: number | null = split.archived.length) {
    let view: SharedView | undefined;
    const paths: string[] = [];
    const shared = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async (url) => {
        const path = new URL(String(url)).pathname;
        paths.push(path);
        return path === "/v1/workspace/archive"
          ? archive()
          : Response.json({ snapshot: snapshot(archived ?? undefined) });
      },
    });
    return { shared, paths, view: () => view };
  }
  const records = () => split.archived.map(({ collection, body }) => ({ collection, body }));

  it("puts the archived records back beside the live ones", async () => {
    const { shared, view } = client(() => Response.json({ archived: split.archived.length, records: records() }));
    await shared.refresh();
    await vi.waitFor(() => expect(view()?.snapshot?.payload.state.movements.length).toBe(busy.state.movements.length));
    const ids = new Set<string>(view()!.snapshot!.payload.state.movements.map((movement) => movement.id));
    for (const record of split.archived) if (record.collection === "movements") expect(ids.has(record.id)).toBe(true);
    shared.dispose();
  });

  it("asks once per count change, and an older server without an archive is never asked", async () => {
    const asked = client(() => Response.json({ archived: split.archived.length, records: records() }));
    await asked.shared.refresh();
    await vi.waitFor(() => expect(asked.paths).toContain("/v1/workspace/archive"));
    await asked.shared.refresh();
    expect(asked.paths.filter((path) => path === "/v1/workspace/archive")).toHaveLength(1);
    asked.shared.dispose();
    const older = client(() => Response.json({}), null);
    await older.shared.refresh();
    expect(older.paths).not.toContain("/v1/workspace/archive");
    older.shared.dispose();
  });

  it("drops a cached archive when only the access context changes", async () => {
    const broad = "a".repeat(64);
    const narrow = "b".repeat(64);
    let context = broad;
    let currentView: SharedView | undefined;
    let archiveReads = 0;
    const hasArchived = () =>
      split.archived.some(({ collection, id }) =>
        currentView?.snapshot?.payload.state[collection].some((record) => record.id === id),
      );
    const shared = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        currentView = next;
      },
      fetch: async (url) => {
        if (new URL(String(url)).pathname === "/v1/workspace/archive") {
          archiveReads++;
          return Response.json({ archived: split.archived.length, records: context === broad ? records() : [] });
        }
        // Revision, generation, live payload and global archive count deliberately stay identical.
        return Response.json({ snapshot: { ...snapshot(split.archived.length), accessContext: context } });
      },
    });
    try {
      await shared.refresh();
      await vi.waitFor(() => expect(hasArchived()).toBe(true));
      expect(archiveReads).toBe(1);
      context = narrow;
      await shared.refresh();
      expect(currentView?.snapshot?.accessContext === narrow).toBe(true);
      expect(hasArchived()).toBe(false);
      await vi.waitFor(() => expect(archiveReads).toBe(2));
      await shared.refresh();
      expect(hasArchived()).toBe(false);
      expect(archiveReads).toBe(2);
    } finally {
      shared.dispose();
    }
  });

  it("drops an old-context archive reply without clearing the new context's pending read", async () => {
    const broad = "a".repeat(64);
    const narrow = "b".repeat(64);
    let context = broad;
    let currentView: SharedView | undefined;
    const replies: Array<(response: Response) => void> = [];
    const hasArchived = () =>
      split.archived.some(({ collection, id }) =>
        currentView?.snapshot?.payload.state[collection].some((record) => record.id === id),
      );
    const shared = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        currentView = next;
      },
      fetch: async (url) => {
        if (new URL(String(url)).pathname === "/v1/workspace/archive")
          return new Promise<Response>((resolve) => replies.push(resolve));
        return Response.json({ snapshot: { ...snapshot(split.archived.length), accessContext: context } });
      },
    });
    try {
      await shared.refresh();
      await vi.waitFor(() => expect(replies.length).toBe(1));
      context = narrow;
      await shared.refresh();
      await vi.waitFor(() => expect(replies.length).toBe(2));
      replies[0]!(Response.json({ archived: split.archived.length, records: records() }));
      // Await an ordinary board read after releasing A. B's archive read is still pending:
      // A's finally must not clear its same-count in-flight guard or cause a third request.
      await shared.refresh();
      expect(replies.length).toBe(2);
      expect(currentView?.snapshot?.accessContext === narrow).toBe(true);
      expect(hasArchived()).toBe(false);
      replies[1]!(Response.json({ archived: split.archived.length, records: [] }));
      await shared.refresh();
      expect(replies.length).toBe(2);
      expect(hasArchived()).toBe(false);
    } finally {
      shared.dispose();
    }
  });

  it("keeps the live board when the archive reply is malformed", async () => {
    const { shared, view, paths } = client(() =>
      Response.json({ archived: 1, records: [{ collection: "patients", body: { id: "x" } }] }),
    );
    await shared.refresh();
    await vi.waitFor(() => expect(paths).toContain("/v1/workspace/archive"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(view()?.snapshot?.payload.state.movements.length).toBe(live.movements.length);
    shared.dispose();
  });
});
