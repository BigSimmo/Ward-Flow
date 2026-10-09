// Stream A, 9 Oct 2026: decision targets per step, labelled defaults set in Settings.
import { describe, expect, it } from "vitest";

import { GENDER_PLACEMENT_REASONS, OVERRIDE_REASONS } from "../src/components/ward-management/ward-change-reasons";
import { defaultWardConfiguration } from "../src/components/ward-management/ward-configuration";
import {
  decisionTargetInboxItems,
  decisionTargetReading,
} from "../src/components/ward-management/ward-decision-targets";
import { isOpen } from "../src/components/ward-management/ward-derivations";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Movement } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;
const UNIT = "rph-adult-secure";
const MOVEMENT = "WF-012";
const defaults = defaultWardConfiguration();

function movement(state: WardFlowState, id = MOVEMENT): Movement {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

/** Room at the unit so the real event walk cannot be refused on capacity. */
function withRoom(state: WardFlowState): WardFlowState {
  return {
    ...state,
    units: state.units.map((candidate) =>
      candidate.id === UNIT
        ? {
            ...candidate,
            empty: { ...candidate.empty, value: 6, confirmedAt: NOW },
            allocatable: { ...candidate.allocatable, value: 6, confirmedAt: NOW },
          }
        : candidate,
    ),
    bedReleases: state.bedReleases.filter((release) => release.unitId !== UNIT),
  };
}

function step(state: WardFlowState, event: Record<string, unknown>, now: number) {
  const next = wardFlowReducer(state, { ...event, now, movementId: MOVEMENT } as never);
  expect(next.rejections, `${String(event.type)} was refused`).toEqual(state.rejections);
  return next;
}

const referred = () =>
  step(
    withRoom(seedWardFlowState()),
    {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      unitIds: [UNIT],
      genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
      genderPlacementChecked: true,
    },
    NOW,
  );

describe("decision targets through the real event walk", () => {
  it("runs no target on the seeded record, which carries no step start times", () => {
    const state = seedWardFlowState();
    const open = state.movements.filter(isOpen);
    expect(open.every((entry) => decisionTargetReading(entry, NOW, defaults) === undefined)).toBe(true);
    expect(decisionTargetInboxItems(open, NOW, defaults)).toEqual([]);
  });

  it("starts the referral decision at referral and shows time left with units", () => {
    const state = referred();
    const reading = decisionTargetReading(movement(state), NOW + 30, defaults);
    expect(reading).toMatchObject({
      step: "referral_decision",
      label: "Referral decision",
      startedAt: NOW,
      dueAt: NOW + defaults.referralDecisionTargetMinutes,
      overdue: false,
      text: "1h 30m left",
    });
    expect(decisionTargetInboxItems([movement(state)], NOW + 30, defaults)).toEqual([]);
  });

  it("raises one act-now inbox row once the referral decision is overdue", () => {
    const state = referred();
    const late = NOW + defaults.referralDecisionTargetMinutes + 65;
    expect(decisionTargetReading(movement(state), late, defaults)?.text).toBe("1h 05m overdue");
    const items = decisionTargetInboxItems([movement(state)], late, defaults);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: `target-referral-decision-${MOVEMENT}`,
      tone: "danger",
      kind: "fact",
      title: "Referral decision overdue",
      movementId: MOVEMENT,
      dueAt: NOW + defaults.referralDecisionTargetMinutes,
    });
    // The row is a real inbox row: the coordinator can acknowledge it.
    const acknowledged = wardFlowReducer(state, {
      type: "ACKNOWLEDGE_INBOX_ITEM",
      role: "coordinator",
      now: late,
      inboxItemId: items[0]!.id,
    });
    expect(acknowledged.rejections).toEqual(state.rejections);
  });

  it("reads the configured target, so a change in Settings moves the due time", () => {
    const state = referred();
    const tighter = { ...defaults, referralDecisionTargetMinutes: 30 };
    expect(decisionTargetReading(movement(state), NOW + 45, tighter)).toMatchObject({
      overdue: true,
      text: "15m overdue",
    });
    expect(decisionTargetInboxItems([movement(state)], NOW + 45, tighter)).toHaveLength(1);
  });

  it("moves to transfer acceptance on acceptance, then transport booked once the bed is pulled", () => {
    const accepted = step(referred(), { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: UNIT }, NOW + 20);
    expect(decisionTargetReading(movement(accepted), NOW + 30, defaults)).toMatchObject({
      step: "transfer_acceptance",
      startedAt: NOW + 20,
      dueAt: NOW + 20 + defaults.transferAcceptanceTargetMinutes,
    });

    const pulled = step(accepted, { type: "PULL_PATIENT", role: "ward", unitId: UNIT }, NOW + 40);
    const reading = decisionTargetReading(
      movement(pulled),
      NOW + 40 + defaults.transportBookedTargetMinutes + 1,
      defaults,
    );
    expect(reading).toMatchObject({ step: "transport_booked", startedAt: NOW + 40, overdue: true, text: "1m overdue" });
    const items = decisionTargetInboxItems(
      [movement(pulled)],
      NOW + 40 + defaults.transportBookedTargetMinutes + 1,
      defaults,
    );
    expect(items.map((item) => item.id)).toEqual([`target-transport-booked-${MOVEMENT}`]);
  });

  it("stops the transport clock once a job is booked", () => {
    const state = referred();
    const pulled = {
      ...movement(state),
      stage: "pulled" as const,
      stageChanges: [{ at: NOW, to: "pulled" as const, by: "ward" }],
    };
    expect(decisionTargetReading(pulled, NOW + 5, defaults)?.step).toBe("transport_booked");
    const booked = {
      ...pulled,
      transport: { id: "TR-1", provider: "Patient transport service" as const, escortRequired: false },
    };
    expect(decisionTargetReading(booked, NOW + 5, defaults)).toBeUndefined();
  });

  it("restarts the referral decision clock on re-refer, not on a parallel decline alone", () => {
    const first = referred();
    expect(movement(first).referralDecisionOpenedAt).toBe(NOW);

    // A second ward referred in parallel keeps the original decision open time.
    const secondUnit = "fsh-adult-secure";
    const withSecondRoom = {
      ...first,
      units: first.units.map((candidate) =>
        candidate.id === secondUnit
          ? {
              ...candidate,
              empty: { ...candidate.empty, value: 6, confirmedAt: NOW },
              allocatable: { ...candidate.allocatable, value: 6, confirmedAt: NOW },
            }
          : candidate,
      ),
    };
    const parallel = step(
      withSecondRoom,
      {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        unitIds: [secondUnit],
        genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
        genderPlacementChecked: true,
      },
      NOW + 10,
    );
    // Parallel add while UNIT is still live keeps the original open time.
    expect(movement(parallel).referralDecisionOpenedAt).toBe(NOW);
    expect(decisionTargetReading(movement(parallel), NOW + 15, defaults)?.startedAt).toBe(NOW);

    // One of two wards declining must not rewind or advance the clock by itself.
    // Use a hard decline reason (not waitlist-instead-of-decline) so the live set actually shrinks.
    const afterDecline = step(
      parallel,
      { type: "DECLINE", role: "ward", unitId: UNIT, reason: "capability_mismatch" },
      NOW + defaults.referralDecisionTargetMinutes + 30,
    );
    expect(movement(afterDecline).referralDecisionOpenedAt).toBe(NOW);
    expect(movement(afterDecline).referredUnitIds).toEqual([secondUnit]);
    expect(
      decisionTargetReading(movement(afterDecline), NOW + defaults.referralDecisionTargetMinutes + 35, defaults)
        ?.startedAt,
    ).toBe(NOW);

    // Re-refer after the last live ward declined opens a fresh wait at the REFER act.
    const cleared = step(
      afterDecline,
      { type: "DECLINE", role: "ward", unitId: secondUnit, reason: "capability_mismatch" },
      NOW + defaults.referralDecisionTargetMinutes + 40,
    );
    expect(movement(cleared).referredUnitIds).toEqual([]);
    const reReferAt = NOW + defaults.referralDecisionTargetMinutes + 45;
    const reReferred = step(
      cleared,
      {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        unitIds: [UNIT],
        genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
        genderPlacementChecked: true,
        // Dabakarn already declined this movement; a recorded override is required to refer again.
        overrideReason: OVERRIDE_REASONS[0],
      },
      reReferAt,
    );
    expect(movement(reReferred).referredAt).toBe(NOW);
    expect(movement(reReferred).referralDecisionOpenedAt).toBe(reReferAt);
    expect(decisionTargetReading(movement(reReferred), reReferAt + 5, defaults)).toMatchObject({
      step: "referral_decision",
      startedAt: reReferAt,
      overdue: false,
    });
  });

  it("keeps the original start when a ward waitlists instead of declining", () => {
    const state = referred();
    const waitlisted = step(state, { type: "DECLINE", role: "ward", unitId: UNIT, reason: "no_bed" }, NOW + 90);
    // No bed waitlists the ward: it stays live and the clock does not move.
    expect(movement(waitlisted).waitlistedUnitIds).toEqual([UNIT]);
    expect(movement(waitlisted).referredUnitIds).toEqual([UNIT]);
    expect(movement(waitlisted).referralDecisionOpenedAt).toBe(NOW);
    const reading = decisionTargetReading(
      movement(waitlisted),
      NOW + defaults.referralDecisionTargetMinutes + 1,
      defaults,
    );
    expect(reading).toMatchObject({ startedAt: NOW, overdue: true });
  });

  it("does not start a transport booking target when no transport is needed", () => {
    const state = referred();
    const pulled = {
      ...movement(state),
      stage: "pulled" as const,
      stageChanges: [{ at: NOW, to: "pulled" as const, by: "ward" }],
      transportNeed: { needed: false, at: NOW },
    };
    expect(decisionTargetReading(pulled, NOW + 5, defaults)).toBeUndefined();
  });
});
