import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";

// Compound drill 3 (master audit list, 10 Nov 2026; links M10, M33, M34), old-tab half: a tab left
// open across the release holds saves that waited while it was offline, and the new backend's
// reply is one this old build cannot read (a newer board format). The waiting saves must not be
// sent against a board the tab could not check, must not be lost without a word, and the person is
// told the board is not current. The server half, with a real migration applied under a running
// backend, is backend/ward-flow/ward-audit-drill-3-old-tab-migration.test.mjs. Synthetic data only.

const POLL_MS = 3_000;
const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
const event = {
  type: "REQUEST_CAPACITY_REFRESH",
  role: "coordinator",
  now: 642,
  unitId: state.units[0]!.id,
} as WardFlowEvent;

function setup() {
  const server = { online: true, released: false, revision: 1 };
  const posted: string[] = [];
  let view: SharedView | undefined;
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "synthetic-token",
    changed: (next) => {
      view = next;
    },
    fetch: async (url, init) => {
      if (!server.online) throw new TypeError("offline");
      const path = new URL(String(url)).pathname;
      if (path === "/v1/workspace/commands") {
        posted.push(JSON.parse(String(init?.body)).commandId);
        server.revision += 1;
      }
      // After the release the board comes back in a format this old build does not know.
      const version = server.released ? 2 : 1;
      return Response.json({
        actorId: "synthetic-actor-drill-3",
        outcome: "accepted",
        commandRevision: server.revision,
        snapshot: {
          dataMode: "prototype",
          revision: server.revision,
          now: 642,
          payload: { version, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
        },
      });
    },
  });
  return { client, server, posted, view: () => view };
}

describe("compound drill 3: an old open tab, a migration and waiting saves", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-11-10T22:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("keeps the waiting saves unsent, and says the board is not current, when the new backend's board is unreadable", async () => {
    const harness = setup();
    await harness.client.refresh();
    expect(harness.view()?.status).toBe("ready");
    harness.server.online = false;
    void harness.client.dispatch(event);
    void harness.client.dispatch(event);
    await vi.advanceTimersByTimeAsync(0);
    expect(harness.view()?.waiting).toBe(2);

    // The 6 am release lands (new backend, migrated schema) while the tab is offline.
    harness.server.released = true;
    harness.server.online = true;
    window.dispatchEvent(new Event("online"));
    await harness.client.refresh();
    await vi.advanceTimersByTimeAsync(5 * POLL_MS);

    expect(harness.posted).toEqual([]);
    expect(harness.view()?.status).toBe("unavailable");
    expect(harness.view()?.error ?? "").not.toBe("");
    // Still held and still counted, so the page warns before it is closed or reloaded.
    expect(harness.view()?.waiting).toBe(2);
    harness.client.dispose();
  });

  it("sends the waiting saves once each when the board is readable again", async () => {
    const harness = setup();
    await harness.client.refresh();
    harness.server.online = false;
    void harness.client.dispatch(event);
    void harness.client.dispatch(event);
    await vi.advanceTimersByTimeAsync(0);
    harness.server.released = true;
    harness.server.online = true;
    await harness.client.refresh();
    expect(harness.posted).toEqual([]);
    // The tab is moved onto a build that reads the new format (here: the format is readable again).
    harness.server.released = false;
    await harness.client.refresh();
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(harness.posted).toHaveLength(2);
    expect(new Set(harness.posted).size).toBe(2);
    harness.client.dispose();
  });
});
