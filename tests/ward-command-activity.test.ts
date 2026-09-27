import { describe, expect, it } from "vitest";

import { deriveCommandActivity } from "@/components/ward-management/shell/ward-command-activity";
import { URGENCY_CHANGE_REASONS } from "@/components/ward-management/ward-change-reasons";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("Command activity from current records", () => {
  it("excludes future records and orders a new recorded refresh ahead of older events", () => {
    const state = seedWardFlowState();
    const current = { unitId: state.units[0].id, at: NOW_ANCHOR, byRole: "coordinator" };
    const future = { ...current, at: NOW_ANCHOR + 10 };
    const result = deriveCommandActivity({ ...state, refreshRequests: [current, future], now: NOW_ANCHOR });
    expect(result.lastEventAt).toBe(NOW_ANCHOR);
    expect(result.content.changes[0].id).toContain(`capacity-refresh:${current.unitId}:${NOW_ANCHOR}:`);
    expect(result.content.changes.some((event) => event.id.includes(`:${NOW_ANCHOR + 10}:`))).toBe(false);
    expect(result.content.changes.length).toBeGreaterThan(1);
  });

  it("updates the movement tally when an open record is added", () => {
    const state = seedWardFlowState();
    const before = deriveCommandActivity({ ...state, now: NOW_ANCHOR });
    const movement = state.movements.find((item) => item.stage === "placement_requested")!;
    expect(movement).toBeDefined();
    const after = deriveCommandActivity({
      ...state,
      movements: [...state.movements, { ...movement, id: "WF-ACTIVITY-CHECK", openedAt: NOW_ANCHOR }],
      now: NOW_ANCHOR,
    });
    const count = (value: typeof before) =>
      Number(value.content.tiles.find((tile) => tile.label === "Open movements")?.value);
    expect(count(after)).toBe(count(before) + 1);
    expect(after.content.changes.some((event) => event.text.includes("WF-ACTIVITY-CHECK"))).toBe(true);
  });

  it("shows the opening urgency tier on past events, not the current tier (WF-49)", () => {
    const state = seedWardFlowState();
    const target = state.movements.find((movement) => isOpen(movement) && movement.urgencyChanges.length === 0)!;
    expect(target).toBeDefined();
    expect(target.urgencyChanges).toHaveLength(0);
    const openingTier = target.urgency;
    const changedTier = openingTier === 1 ? 2 : 1;
    const changedAt = NOW_ANCHOR + 5;

    const after = wardFlowReducer(state, {
      type: "CHANGE_URGENCY",
      role: "coordinator",
      now: changedAt,
      movementId: target.id,
      urgency: changedTier,
      reason: URGENCY_CHANGE_REASONS[0],
    });
    expect(after.rejections).toHaveLength(state.rejections.length);

    const updated = after.movements.find((movement) => movement.id === target.id)!;
    expect(updated.urgencyChanges).toHaveLength(1);

    const result = deriveCommandActivity({
      movements: [updated],
      units: after.units,
      referrals: [],
      rejections: [],
      bedReleases: [],
      leaveBeds: [],
      refreshRequests: [],
      now: changedAt,
    });

    const openedEvent = result.content.changes.find((event) => event.id === `movement-opened:${target.id}`);
    expect(openedEvent).toBeDefined();
    expect(openedEvent!.text).toContain(`Tier ${openingTier}`);
    expect(openedEvent!.text).not.toContain(`Tier ${changedTier}`);

    const changeEvent = result.content.changes.find(
      (event) => event.id === `urgency-change:${target.id}:${changedAt}:0`,
    );
    expect(changeEvent).toBeDefined();
    expect(changeEvent!.text).toBe(`${target.id} urgency changed from Tier ${openingTier} to Tier ${changedTier}.`);
  });

  it("shows the current tier for a movement whose urgency has never changed (WF-49)", () => {
    const state = seedWardFlowState();
    const target = state.movements.find((movement) => movement.urgencyChanges.length === 0)!;
    expect(target).toBeDefined();
    expect(target.urgencyChanges).toHaveLength(0);

    const result = deriveCommandActivity({
      movements: [target],
      units: state.units,
      referrals: [],
      rejections: [],
      bedReleases: [],
      leaveBeds: [],
      refreshRequests: [],
      now: NOW_ANCHOR,
    });

    const openedEvent = result.content.changes.find((event) => event.id === `movement-opened:${target.id}`);
    expect(openedEvent).toBeDefined();
    expect(openedEvent!.text).toContain(`Tier ${target.urgency}`);
  });

  it("tags projected events with honest categories from the records that produced them", () => {
    const state = seedWardFlowState();
    const withEscalation = state.movements.find((movement) => movement.escalation !== undefined);
    const withDecline = state.movements.find((movement) => movement.declines.length > 0);
    const withReferral = state.referrals[0];
    expect(withEscalation, "seed must include an escalation to pin the category").toBeDefined();
    expect(withDecline, "seed must include a decline to pin the category").toBeDefined();
    expect(withReferral, "seed must include a referral to pin the category").toBeDefined();

    const stageCarrier = {
      ...withEscalation!,
      id: "WF-CATEGORY-STAGE" as const,
      openedAt: NOW_ANCHOR - 10,
      urgencyChanges: [],
      declines: [],
      escalation: undefined,
      overrides: [],
      legalForm: undefined,
      stageChanges: [
        { at: NOW_ANCHOR - 5, from: "placement_requested" as const, to: "pulled" as const, by: "coordinator" },
      ],
    };

    const result = deriveCommandActivity({
      movements: [withEscalation!, withDecline!, stageCarrier],
      units: state.units,
      referrals: [withReferral!],
      rejections: [],
      bedReleases: [],
      leaveBeds: [],
      refreshRequests: [],
      now: NOW_ANCHOR,
    });

    expect(result.content.changes.find((change) => change.id.startsWith("escalation:"))?.category).toBe("escalation");
    expect(result.content.changes.find((change) => change.id.startsWith("decline:"))?.category).toBe("decline");
    expect(result.content.changes.find((change) => change.id.startsWith("referral-"))?.category).toBe("referral");
    expect(result.content.changes.find((change) => change.id.startsWith("stage:WF-CATEGORY-STAGE:"))?.category).toBe(
      "transfer",
    );
    expect(result.content.changes.find((change) => change.id.startsWith("movement-opened:"))?.category).toBe("other");
  });
});
