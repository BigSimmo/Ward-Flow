import { describe, expect, it } from "vitest";
import type { Movement } from "@/components/ward-management/ward-model";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { meetingActionInboxId } from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import { activeSnooze, currentInboxOwner } from "@/components/ward-management/ward-inbox-snooze";
import { alertsNowFigures } from "@/components/ward-management/ward-alerts-figures";
import { alertChecks } from "@/components/ward-management/alerts/alerts-checks";
import { taskItems } from "@/components/ward-management/ward-act-now-items";
import { NOW_ANCHOR as now } from "@/components/ward-management/ward-sites";

describe("consolidated meeting and Checking contracts", () => {
  it("ends prior snooze and owner at a same-minute replacement without deleting history", () => {
    let state = seedWardFlowState();
    const subject = { kind: "movement" as const, id: state.movements[0]!.id };
    const id = meetingActionInboxId(subject, "book_transport");
    const record = {
      type: "RECORD_BED_MEETING_ACTION" as const,
      role: "coordinator" as const,
      now,
      subject,
      action: "book_transport" as const,
      owner: "coordinator" as const,
      dueAt: now + 100,
    };
    state = wardFlowReducer(state, record);
    state = wardFlowReducer(state, { type: "TAKE_INBOX_ITEM_OWNERSHIP", role: "coordinator", now, inboxItemId: id });
    state = wardFlowReducer(state, {
      type: "SNOOZE_INBOX_ITEM",
      role: "coordinator",
      now,
      inboxItemId: id,
      until: now + 30,
      reason: "awaiting_call_back",
    });
    const earlierSnooze = state.inboxSnoozes[id]![0];
    const earlierOwner = state.inboxOwnership[id]![0];
    state = wardFlowReducer(state, {
      type: "COMPLETE_BED_MEETING_ACTION",
      role: "coordinator",
      now,
      subject,
      action: "book_transport",
    });
    state = wardFlowReducer(state, record);
    expect(state.rejections).toEqual([]);
    expect(activeSnooze(state.inboxSnoozes[id], now, now)).toBeUndefined();
    expect(currentInboxOwner(state.inboxOwnership[id], now)).toBeUndefined();
    expect(state.inboxSnoozes[id]![0]).toEqual(earlierSnooze);
    expect(state.inboxOwnership[id]![0]).toEqual(earlierOwner);
    state = wardFlowReducer(state, { type: "TAKE_INBOX_ITEM_OWNERSHIP", role: "coordinator", now, inboxItemId: id });
    state = wardFlowReducer(state, {
      type: "SNOOZE_INBOX_ITEM",
      role: "coordinator",
      now,
      inboxItemId: id,
      until: now + 30,
      reason: "awaiting_call_back",
    });
    expect(state.rejections).toEqual([]);
    expect(currentInboxOwner(state.inboxOwnership[id], now)).toBeDefined();
    expect(activeSnooze(state.inboxSnoozes[id], now, now)).toBeDefined();
    expect(activeSnooze(state.inboxSnoozes[id], now + 31, now)).toBeUndefined();
  });
  it("counts only Alerts destinations while retaining meeting tasks independently", () => {
    const id = meetingActionInboxId({ kind: "admission", id: "synthetic-stay" }, "book_transport");
    expect(alertsNowFigures([{ id }, { id: "declines-WF-1" }], 0)).toEqual({
      actNow: 1,
      waiting: 0,
      running: 0,
      outstanding: 1,
    });
  });
  it("names refusal threshold and both transport populations without claiming unanimous decline", () => {
    const state = seedWardFlowState();
    const template = state.movements[0]!;
    const pending: Movement = {
      ...template,
      acceptedUnitId: undefined,
      stage: "placement_requested",
      closure: undefined,
      referredUnitIds: [state.units[3]!.id],
      declines: state.units.slice(0, 3).map((u) => ({ unitId: u.id, at: now - 10, reason: "no_suitable_bed" })),
    };
    const unaccepted: Movement = {
      ...template,
      id: "WF-overdue",
      stage: "pulled",
      closure: undefined,
      transport: {
        ...state.movements.find((m) => m.transport)!.transport!,
        acceptedAt: undefined,
        collectedAt: undefined,
        arrivedAt: undefined,
        cancelledAt: undefined,
        estimatedAt: now - 10,
      },
    };
    const movements = [pending, unaccepted];
    const allInbox = taskItems({ ...state, movements }, now);
    const checks = alertChecks({ allInbox, openMovements: movements, referrals: [], movements, now });
    expect(checks.find((c) => c.key === "declines")).toMatchObject({ label: "Multiple wards declined", n: 1 });
    expect(checks.find((c) => c.key === "declines")?.scope).toContain("at least three");
    expect(checks.find((c) => c.key === "transport")?.n).toBeGreaterThan(0);
    expect(checks.find((c) => c.key === "transport")?.scope).toContain("not yet arrived");
  });
});
