import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt, type WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import {
  applySharedEvent,
  type SharedEventRecord,
  type SharedJoinResponse,
} from "../src/components/ward-management/shared/ward-flow-shared-core";
import {
  adoptSharedWorld,
  applyRemoteEvents,
  confirmPendingHead,
  initialSharedSync,
  recordLocalDispatch,
  sharedSyncView,
  type SharedSync,
} from "../src/components/ward-management/shared/ward-flow-shared-sync";

// Synthetic fixture ids only.
const WORLD = "11111111-1111-4111-8111-111111111111";
const RELEASE = "derived-expected-AD-RPHS-05";

const confirmRelease: WardFlowEvent = {
  type: "CONFIRM_BED_RELEASE",
  role: "ward",
  now: 642,
  releaseId: RELEASE,
  actingUnitId: "rph-adult-secure",
};
const refresh = (unitId: string): WardFlowEvent => ({
  type: "REQUEST_CAPACITY_REFRESH",
  role: "coordinator",
  now: 643,
  unitId,
});

function join(state: WardFlowState = seedWardFlowStateAt(0), seq = 0): SharedJoinResponse {
  return {
    worldId: WORLD,
    seq,
    state,
    dayZeroMs: Date.UTC(2026, 9, 8, 16),
    startedAtMs: Date.UTC(2026, 9, 9, 1),
    serverNowMs: Date.UTC(2026, 9, 9, 2),
    typedTextAllowed: false,
  };
}

/** A browser as the provider holds it: the displayed world and the sync record. */
type Browser = { world: WardFlowState; sync: SharedSync };

function joined(clientId: string, response = join()): Browser {
  return adoptSharedWorld(initialSharedSync(clientId), response);
}

/** What the provider does on a screen dispatch in shared mode. */
function dispatchLocal(browser: Browser, event: WardFlowEvent): Browser {
  const { next, accepted } = applySharedEvent(browser.world, event);
  return { world: next, sync: recordLocalDispatch(browser.sync, event, accepted) };
}

describe("shared sync: local dispatch", () => {
  it("queues accepted events with unique ids and keeps refusals local", () => {
    let browser = joined("browser-a");
    browser = dispatchLocal(browser, confirmRelease);
    browser = dispatchLocal(browser, refresh("no-such-unit"));
    browser = dispatchLocal(browser, refresh("rph-adult-secure"));
    expect(browser.sync.pending.map((entry) => entry.eventId)).toEqual(["browser-a-0", "browser-a-1"]);
    expect(browser.sync.pending.map((entry) => entry.event.type)).toEqual([
      "CONFIRM_BED_RELEASE",
      "REQUEST_CAPACITY_REFRESH",
    ]);
    // The refusal is on this browser's screen only.
    expect(browser.world.rejections).toHaveLength(1);
    expect(sharedSyncView(browser.sync)).toEqual({
      status: "live",
      pendingCount: 2,
      detachedReason: undefined,
      notice: undefined,
    });
  });

  it("leaves the board on a typed-text event and sends nothing more (mirrors D-18)", () => {
    let browser = joined("browser-a");
    browser = dispatchLocal(browser, confirmRelease);
    const typed = { type: "RECORD_ESCALATION", role: "coordinator", now: 644 } as unknown as WardFlowEvent;
    browser = { ...browser, sync: recordLocalDispatch(browser.sync, typed, true) };
    expect(browser.sync.status).toBe("detached");
    expect(browser.sync.detachedReason).toBe("typed-text");
    expect(browser.sync.pending).toEqual([]);
    browser = dispatchLocal(browser, refresh("rph-adult-secure"));
    expect(browser.sync.pending).toEqual([]);
  });

  it("shares typed text only when the server says it is allowed", () => {
    const open = joined("browser-a", { ...join(), typedTextAllowed: true });
    const typed = { type: "RECORD_ESCALATION", role: "coordinator", now: 644 } as unknown as WardFlowEvent;
    const after = recordLocalDispatch(open.sync, typed, true);
    expect(after.status).toBe("live");
    expect(after.pending).toHaveLength(1);
  });

  it("does nothing before the browser has joined", () => {
    const sync = initialSharedSync("browser-a");
    expect(recordLocalDispatch(sync, confirmRelease, true)).toBe(sync);
  });
});

describe("shared sync: confirmation and conflict", () => {
  it("moves a confirmed event from pending to the confirmed world", () => {
    let browser = dispatchLocal(joined("browser-a"), confirmRelease);
    const confirmed = confirmPendingHead(browser.sync, browser.world, "browser-a-0", 1);
    expect(confirmed).not.toBeNull();
    browser = confirmed!;
    expect(browser.sync.confirmedSeq).toBe(1);
    expect(browser.sync.pending).toEqual([]);
    expect(browser.sync.confirmed?.bedReleases.find((release) => release.id === RELEASE)?.state).toBe("confirmed");
    expect(browser.world.bedReleases).toEqual(browser.sync.confirmed?.bedReleases);
  });

  it("asks for a fresh join when a confirmation does not line up", () => {
    const browser = dispatchLocal(joined("browser-a"), confirmRelease);
    expect(confirmPendingHead(browser.sync, browser.world, "browser-a-9", 1)).toBeNull();
    expect(confirmPendingHead(browser.sync, browser.world, "browser-a-0", 5)).toBeNull();
  });

  it("two browsers, one bed: the loser catches up and sees its action refused", () => {
    let a = dispatchLocal(joined("browser-a"), confirmRelease);
    let b = dispatchLocal(joined("browser-b"), confirmRelease);
    b = dispatchLocal(b, refresh("rph-adult-secure"));
    // A reached the server first.
    a = confirmPendingHead(a.sync, a.world, "browser-a-0", 1)!;
    const fromServer: SharedEventRecord[] = [{ seq: 1, eventId: "browser-a-0", event: confirmRelease }];
    // B's post conflicts; B fetches seq 1 and replays its own two events on top.
    const caughtUp = applyRemoteEvents(b.sync, b.world, fromServer);
    expect(caughtUp).not.toBeNull();
    b = caughtUp!;
    // Its confirm is now refused by the reducer and dropped; the refresh still stands and is resent.
    expect(b.sync.pending.map((entry) => entry.eventId)).toEqual(["browser-b-1"]);
    expect(b.world.rejections.at(-1)?.attempted).toBe("CONFIRM_BED_RELEASE");
    expect(b.sync.confirmedSeq).toBe(1);
    // Both browsers agree on the bed.
    expect(b.world.bedReleases).toEqual(a.world.bedReleases);
  });

  it("drops a pending event the server already stored (its response was lost)", () => {
    const browser = dispatchLocal(joined("browser-a"), confirmRelease);
    const caughtUp = applyRemoteEvents(browser.sync, browser.world, [
      { seq: 1, eventId: "browser-a-0", event: confirmRelease },
    ]);
    expect(caughtUp?.sync.pending).toEqual([]);
    expect(caughtUp?.world.rejections).toEqual([]);
  });

  it("keeps this browser's refusals across a catch-up so screens counting them still see theirs", () => {
    let browser = dispatchLocal(joined("browser-a"), refresh("no-such-unit"));
    expect(browser.world.rejections).toHaveLength(1);
    browser = applyRemoteEvents(browser.sync, browser.world, [
      { seq: 1, eventId: "browser-b-0", event: refresh("rph-adult-secure") },
    ])!;
    expect(browser.world.rejections).toHaveLength(1);
    expect(browser.world.refreshRequests.at(-1)?.unitId).toBe("rph-adult-secure");
  });

  it("asks for a fresh join on a gap in sequence numbers", () => {
    const browser = joined("browser-a");
    expect(
      applyRemoteEvents(browser.sync, browser.world, [{ seq: 2, eventId: "browser-b-0", event: confirmRelease }]),
    ).toBeNull();
  });
});
