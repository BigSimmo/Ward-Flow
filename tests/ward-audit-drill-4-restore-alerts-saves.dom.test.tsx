import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeCommandRecovery } from "../src/components/ward-management/ward-command-recovery";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";

// Compound drill 4 (master audit list, 10 Nov 2026), open-tab half: a database restore, plus saves
// waiting in open tabs, plus recovery notes that name saves the restored database has lost. Phone
// alerts already sent are in the server half,
// backend/ward-flow/ward-audit-drill-4-restore-alerts-saves.test.mjs, which also shows that a
// waiting save made against the lost revisions is refused as stale (409) by the restored backend.
//
// A restore takes the workspace's revision backwards. A tab that held a newer revision must not
// go on showing the lost board as current, and a recovery note for a lost save must never be
// reported as saved. Synthetic data only.

type State = SharedSnapshot["payload"]["state"];
const seed = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as State;
const movementId = seed.movements.find((movement) => !movement.closure)!.id;
const lostChange = { type: "RECORD_TRANSPORT_NEED", role: "coordinator", now: 642, movementId, needed: true };
const afterLost = wardFlowReducer(seed, lostChange as unknown as WardFlowEvent);
const receiptScope = "synthetic-receipt-scope-drill-4";
const transportOf = (state: State | undefined) =>
  JSON.stringify(state?.movements.find((movement) => movement.id === movementId)?.transportNeed ?? null);

function setup(start: { revision: number; state: State }) {
  const server = { ...start, receipts: new Map<string, number>() };
  const asked: string[] = [];
  let view: SharedView | undefined;
  const snapshot = (): SharedSnapshot => ({
    dataMode: "prototype",
    revision: server.revision,
    now: 642,
    payload: { version: 1, state: server.state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
  });
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "synthetic-token",
    recoveryStorage: window.localStorage,
    changed: (next) => {
      view = next;
    },
    fetch: async (url) => {
      const parsed = new URL(String(url));
      asked.push(parsed.pathname + parsed.search);
      if (parsed.pathname === "/v1/workspace/receipt") {
        const revision = server.receipts.get(parsed.searchParams.get("commandId") ?? "");
        return Response.json({
          receipt: revision === undefined ? null : { outcome: "accepted", commandRevision: revision },
        });
      }
      return Response.json({
        actorId: "synthetic-actor-drill-4",
        accessUntil: Date.now() + 8 * 3_600_000,
        receiptScope,
        snapshot: snapshot(),
      });
    },
  });
  /** The database is restored from a backup taken at `revision`, with `state`. */
  const restore = (revision: number, state: State) => {
    server.revision = revision;
    server.state = state;
    server.receipts.clear();
  };
  return { client, server, asked, view: () => view, restore };
}

describe("compound drill 4: an open tab across a database restore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-11-10T02:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("a recovery note for a save the restore lost is never reported as saved, and keeps saving held", async () => {
    const lost = "0f0e0d0c-0b0a-4908-8706-050403020100";
    expect(
      writeCommandRecovery(window.localStorage, [
        { commandId: lost, receiptScope, expiresAt: Date.now() + 8 * 3_600_000, phase: "sent" },
      ]),
    ).toBe(true);
    // The tab reloads after the restore; the restored database has no receipt for that save.
    const harness = setup({ revision: 2, state: seed });
    await harness.client.refresh();
    await vi.advanceTimersByTimeAsync(0);

    expect(harness.asked.some((path) => path.includes(`commandId=${lost}`))).toBe(true);
    expect(harness.view()?.recoveryResults ?? []).not.toContainEqual(expect.objectContaining({ outcome: "accepted" }));
    expect(harness.view()?.recovery ?? "").not.toMatch(/accepted|saved/i);
    expect(harness.view()?.recovery ?? "").toMatch(/unresolved/i);
    // Saving stays held while the identity is unresolved (#1435), so nothing new is sent on top.
    const outcome = await harness.client.dispatch(lostChange as unknown as WardFlowEvent);
    expect(outcome.status).toBe("cancelled");
    harness.client.dispose();
  });

  it("a recovery note left unresolved by a restore ends as 'outcome not known' when its identity expires", async () => {
    const lost = "1f1e1d1c-1b1a-4918-9716-151413121110";
    writeCommandRecovery(window.localStorage, [
      { commandId: lost, receiptScope, expiresAt: Date.now() + 60_000, phase: "sent" },
    ]);
    const harness = setup({ revision: 2, state: seed });
    await harness.client.refresh();
    vi.setSystemTime(Date.now() + 61_000);
    await harness.client.retry();
    await vi.advanceTimersByTimeAsync(0);
    expect(harness.view()?.recoveryResults).toContainEqual({ commandId: lost, outcome: "expired" });
    expect(harness.view()?.recovery).toMatch(/outcome is unknown/i);
    harness.client.dispose();
  });

  // DEFECT (drill 4, 10 Nov 2026): a tab that held revision 4 ignores the restored board at
  // revision 2, because a lower revision is never adopted (`adopt`, ward-shared-client.ts). It keeps
  // showing the lost change as current, marked ready, until the restored workspace climbs past 4,
  // and a revision number reached again after the restore can carry different content. Not fixed
  // here: it needs a restore marker from the server (for example a workspace epoch). It fails today,
  // so it is an expected failure; turn it back into a plain test once that exists.
  it.fails(
    "DEFECT: a tab holding a newer revision than the restored database stops showing the lost board as current",
    async () => {
      const harness = setup({ revision: 4, state: afterLost });
      await harness.client.refresh();
      expect(transportOf(harness.view()?.snapshot?.payload.state)).toBe(transportOf(afterLost));
      harness.restore(2, seed);
      await harness.client.refresh();
      const shown = harness.view();
      const showsLostBoardAsCurrent =
        shown?.status === "ready" && transportOf(shown.snapshot?.payload.state) === transportOf(afterLost);
      expect(showsLostBoardAsCurrent).toBe(false);
      harness.client.dispose();
    },
  );

  it("today's behaviour, recorded for the drill: the tab keeps its newer board after the restore", async () => {
    const harness = setup({ revision: 4, state: afterLost });
    await harness.client.refresh();
    harness.restore(2, seed);
    await harness.client.refresh();
    expect(harness.view()?.snapshot?.revision).toBe(4);
    expect(transportOf(harness.view()?.snapshot?.payload.state)).toBe(transportOf(afterLost));
    expect(transportOf(afterLost)).not.toBe(transportOf(seed));
    harness.client.dispose();
  });
});
