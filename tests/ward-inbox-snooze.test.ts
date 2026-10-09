// Stream A, 9 Oct 2026: acknowledge, own and snooze on action-inbox rows.
import { describe, expect, it } from "vitest";

import { decisionTargetInboxItems } from "../src/components/ward-management/ward-decision-targets";
import { buildActionInbox, isOpen } from "../src/components/ward-management/ward-derivations";
import {
  INBOX_CATEGORIES,
  inboxItemIsActNow,
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { inboxRowExists } from "../src/components/ward-management/ward-inbox-reducer";
import {
  activeSnooze,
  currentInboxOwner,
  isInboxItemSnoozed,
  partitionSnoozed,
  shiftEndAfter,
  snoozeAllowed,
  snoozeUntilFor,
} from "../src/components/ward-management/ward-inbox-snooze";
import { isValidStoredWardFlowState } from "../src/components/ward-management/ward-flow-storage-validation";
import { RED_ROW_SNOOZE_CAP_MINUTES } from "../src/components/ward-management/ward-operational-defaults";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function inbox(state: WardFlowState, now = NOW) {
  return buildActionInbox(state.movements.filter(isOpen), now, state.units);
}

function rowOfTone(state: WardFlowState, tone: "danger" | "warning") {
  const row = inbox(state).find((item) => item.tone === tone);
  if (!row) throw new Error(`fixture has no ${tone} inbox row`);
  return row;
}

describe("TAKE_INBOX_ITEM_OWNERSHIP", () => {
  it("records the acting role's label and the time, without touching the inbox", () => {
    const state = seedWardFlowState();
    const row = rowOfTone(state, "danger");
    const next = wardFlowReducer(state, {
      type: "TAKE_INBOX_ITEM_OWNERSHIP",
      role: "coordinator",
      now: NOW,
      inboxItemId: row.id,
    });
    expect(next.rejections).toEqual([]);
    expect(next.inboxOwnership[row.id]).toEqual([{ at: NOW, by: "Flow coordinator" }]);
    expect(currentInboxOwner(next.inboxOwnership[row.id])).toEqual({ at: NOW, by: "Flow coordinator" });
    expect(inbox(next)).toEqual(inbox(state));
  });

  it("refuses a second take by the role that already owns the row", () => {
    const state = seedWardFlowState();
    const row = rowOfTone(state, "danger");
    const once = wardFlowReducer(state, {
      type: "TAKE_INBOX_ITEM_OWNERSHIP",
      role: "coordinator",
      now: NOW,
      inboxItemId: row.id,
    });
    const twice = wardFlowReducer(once, {
      type: "TAKE_INBOX_ITEM_OWNERSHIP",
      role: "coordinator",
      now: NOW + 5,
      inboxItemId: row.id,
    });
    expect(twice.inboxOwnership[row.id]).toHaveLength(1);
    expect(twice.rejections.at(-1)?.reason).toMatch(/already owned/);
  });

  it("refuses an id that names no inbox row, and a role outside the coordinator floor", () => {
    const state = seedWardFlowState();
    const unknown = wardFlowReducer(state, {
      type: "TAKE_INBOX_ITEM_OWNERSHIP",
      role: "coordinator",
      now: NOW,
      inboxItemId: "legal-WF-NOPE",
    });
    expect(unknown.inboxOwnership).toEqual({});
    expect(unknown.rejections).toHaveLength(1);
    const row = rowOfTone(state, "danger");
    const ward = wardFlowReducer(state, {
      type: "TAKE_INBOX_ITEM_OWNERSHIP",
      role: "ward",
      now: NOW,
      inboxItemId: row.id,
    });
    expect(ward.inboxOwnership).toEqual({});
    expect(ward.rejections).toHaveLength(1);
  });
});

describe("SNOOZE_INBOX_ITEM", () => {
  it("hides a review row until its return time, then the row comes back by itself", () => {
    const state = seedWardFlowState();
    const row = rowOfTone(state, "warning");
    const until = snoozeUntilFor("4h", NOW);
    const next = wardFlowReducer(state, {
      type: "SNOOZE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId: row.id,
      until,
      reason: "waiting_on_transport",
    });
    expect(next.rejections).toEqual([]);
    expect(next.inboxSnoozes[row.id]).toEqual([
      { at: NOW, by: "Flow coordinator", kind: "snoozed", until, reason: "waiting_on_transport" },
    ]);
    // The fact itself is untouched: the inbox still computes the row.
    expect(inbox(next).some((item) => item.id === row.id)).toBe(true);

    const during = partitionSnoozed(inbox(next, NOW + 60), next.inboxSnoozes, NOW + 60);
    expect(during.active.some((item) => item.id === row.id)).toBe(false);
    expect(during.snoozed.map((item) => item.id)).toContain(row.id);

    const after = partitionSnoozed(inbox(next, until), next.inboxSnoozes, until);
    expect(after.active.some((item) => item.id === row.id)).toBe(true);
    expect(after.snoozed).toEqual([]);
  });

  it("lets an act-now row be snoozed for up to an hour and refuses anything longer", () => {
    const state = seedWardFlowState();
    const row = rowOfTone(state, "danger");
    expect(inboxItemIsActNow(row.id)).toBe(true);

    const hour = wardFlowReducer(state, {
      type: "SNOOZE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId: row.id,
      until: NOW + RED_ROW_SNOOZE_CAP_MINUTES,
      reason: "awaiting_call_back",
    });
    expect(hour.rejections).toEqual([]);
    expect(isInboxItemSnoozed(hour.inboxSnoozes[row.id], NOW + 30)).toBe(true);

    const tooLong = wardFlowReducer(state, {
      type: "SNOOZE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId: row.id,
      until: snoozeUntilFor("4h", NOW),
      reason: "awaiting_call_back",
    });
    expect(tooLong.inboxSnoozes).toEqual({});
    expect(tooLong.rejections.at(-1)?.reason).toMatch(/act now/);

    // Acknowledging the same act-now row is always allowed.
    const acknowledged = wardFlowReducer(state, {
      type: "ACKNOWLEDGE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId: row.id,
    });
    expect(acknowledged.rejections).toEqual([]);
  });

  it("refuses an off-list reason, a return time not after now, and one more than a day away", () => {
    const state = seedWardFlowState();
    const row = rowOfTone(state, "warning");
    const base = { type: "SNOOZE_INBOX_ITEM", role: "coordinator", now: NOW, inboxItemId: row.id } as const;
    for (const event of [
      { ...base, until: NOW + 30, reason: "because I said so" as never },
      { ...base, until: NOW, reason: "waiting_on_ward" as const },
      { ...base, until: NOW + 25 * 60, reason: "waiting_on_ward" as const },
    ]) {
      const next = wardFlowReducer(state, event);
      expect(next.inboxSnoozes).toEqual({});
      expect(next.rejections).toHaveLength(1);
    }
  });

  it("stays a valid stored state, so a saved session keeps its snoozes and owners", () => {
    let state = seedWardFlowState();
    const row = rowOfTone(state, "warning");
    state = wardFlowReducer(state, {
      type: "SNOOZE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId: row.id,
      until: NOW + 30,
      reason: "waiting_on_ward",
    });
    state = wardFlowReducer(state, {
      type: "TAKE_INBOX_ITEM_OWNERSHIP",
      role: "coordinator",
      now: NOW,
      inboxItemId: row.id,
    });
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(true);
    const corrupted = {
      ...state,
      inboxSnoozes: { [row.id]: [{ at: NOW, by: "x", kind: "snoozed", until: NOW + 5, reason: "typed" }] },
    };
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(corrupted)))).toBe(false);
  });
});

describe("UNSNOOZE_INBOX_ITEM", () => {
  it("returns a snoozed row now, recorded as its own entry", () => {
    const state = seedWardFlowState();
    const row = rowOfTone(state, "warning");
    const snoozed = wardFlowReducer(state, {
      type: "SNOOZE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId: row.id,
      until: NOW + 240,
      reason: "waiting_on_ward",
    });
    const returned = wardFlowReducer(snoozed, {
      type: "UNSNOOZE_INBOX_ITEM",
      role: "coordinator",
      now: NOW + 10,
      inboxItemId: row.id,
    });
    expect(returned.rejections).toEqual([]);
    expect(returned.inboxSnoozes[row.id]).toHaveLength(2);
    expect(returned.inboxSnoozes[row.id]?.at(-1)).toEqual({ at: NOW + 10, by: "Flow coordinator", kind: "returned" });
    expect(activeSnooze(returned.inboxSnoozes[row.id], NOW + 10)).toBeUndefined();
  });

  it("refuses a row that is not snoozed, including one whose snooze has already run out", () => {
    const state = seedWardFlowState();
    const row = rowOfTone(state, "warning");
    expect(
      wardFlowReducer(state, { type: "UNSNOOZE_INBOX_ITEM", role: "coordinator", now: NOW, inboxItemId: row.id })
        .rejections,
    ).toHaveLength(1);
    const snoozed = wardFlowReducer(state, {
      type: "SNOOZE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId: row.id,
      until: NOW + 30,
      reason: "waiting_on_ward",
    });
    const late = wardFlowReducer(snoozed, {
      type: "UNSNOOZE_INBOX_ITEM",
      role: "coordinator",
      now: NOW + 31,
      inboxItemId: row.id,
    });
    expect(late.rejections).toHaveLength(1);
    expect(late.inboxSnoozes[row.id]).toHaveLength(1);
  });
});

describe("snooze helpers", () => {
  it("ends the shift at the next 07:00, 15:00 or 23:00 boundary", () => {
    const day = NOW - (NOW % 1440);
    expect(shiftEndAfter(day + 14 * 60)).toBe(day + 15 * 60);
    expect(shiftEndAfter(day + 15 * 60)).toBe(day + 23 * 60);
    expect(shiftEndAfter(day + 23 * 60 + 30)).toBe(day + 1440 + 7 * 60);
    expect(shiftEndAfter(day + 2 * 60)).toBe(day + 7 * 60);
  });

  it("allows a preset for an act-now row only when it returns within the cap", () => {
    expect(snoozeAllowed(snoozeUntilFor("30m", NOW), NOW, true)).toBe(true);
    expect(snoozeAllowed(snoozeUntilFor("1h", NOW), NOW, true)).toBe(true);
    expect(snoozeAllowed(snoozeUntilFor("4h", NOW), NOW, true)).toBe(false);
    expect(snoozeAllowed(snoozeUntilFor("4h", NOW), NOW, false)).toBe(true);
    expect(snoozeAllowed(NOW, NOW, false)).toBe(false);
  });

  it("classifies act-now rows from the id the same way the inbox colours them", () => {
    const state = seedWardFlowState();
    const rows = inbox(state);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(inboxItemIsActNow(row.id), row.id).toBe(row.tone === "danger");
    for (const key of ["target_referral_decision", "target_transfer_acceptance", "target_transport_booked"] as const) {
      expect(inboxItemIsActNow(`${INBOX_CATEGORIES[key].idPrefix}WF-001`)).toBe(true);
    }
    // Decision-target rows are always red, matching the cap.
    expect(decisionTargetInboxItems([], NOW, state.configuration)).toEqual([]);
  });

  it("recognises a decision-target row id as a real inbox row", () => {
    const state = seedWardFlowState();
    expect(inboxRowExists(state, "target-transport-booked-WF-004")).toBe(true);
    expect(inboxRowExists(state, "target-transport-booked-WF-NOPE")).toBe(false);
    expect(inboxRowExists(state, "nonsense-WF-004")).toBe(false);
  });
});
