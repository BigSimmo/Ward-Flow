import { describe, expect, it } from "vitest";

import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { commandScopeRefusal } from "../src/components/ward-management/ward-access-state";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Referral, ReferralAddressing } from "../src/components/ward-management/ward-model";
import { GENERAL_OBSERVATION } from "../src/components/ward-management/ward-observation";
import type { WardAccess } from "../src/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * Acting place, strict (audit M2 and M4, Josh, 10 Nov 2026). An ED records medical clearance only
 * for a journey it sent; a ward answers only as itself, and names itself every time; and the shared
 * server checks the ward a referral answer stands for even when the answer names none.
 */

type WithoutNow<T> = T extends unknown ? Omit<T, "now"> : never;
const ORIGIN_ED = "jhc-ed";
const OTHER_ED = "scgh-ed";
const UNIT = "scgh-adult-open";

function journey() {
  let state = seedWardFlowState();
  const send = (event: WithoutNow<WardFlowEvent>, at = NOW_ANCHOR) => {
    state = wardFlowReducer(state, { ...event, now: at } as WardFlowEvent);
    return state;
  };
  send({
    type: "RAISE_REFERRAL",
    role: "ed",
    edId: ORIGIN_ED,
    draft: {
      cohort: "Adult",
      security: "Open",
      sex: "Female",
      gender: "Female",
      observation: GENERAL_OBSERVATION,
      highAcuity: false,
      legalStatus: "Voluntary",
      urgency: 2,
      legalFormCode: null,
    },
  });
  const movementId = state.movements.at(-1)!.id;
  send({ type: "REFER_TO_UNITS", role: "coordinator", movementId, unitIds: [UNIT] });
  return {
    send,
    movementId,
    get state() {
      return state;
    },
    get movement() {
      return state.movements.find((m) => m.id === movementId)!;
    },
  };
}

describe("M2: medical clearance from the origin ED only", () => {
  it("refuses clearance from another ED, and from an ED that names none", () => {
    const j = journey();
    expect(j.movement.originEdId).toBe(ORIGIN_ED);
    const before = j.state.rejections.length;
    j.send({
      type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
      role: "ed",
      movementId: j.movementId,
      cleared: true,
      actingPlaceId: OTHER_ED,
    });
    j.send({ type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE", role: "ed", movementId: j.movementId, cleared: true });
    expect(j.state.rejections.slice(before).map((r) => r.reason)).toEqual([
      "Only the originating ED may record medical clearance for this journey.",
      "Only the originating ED may record medical clearance for this journey.",
    ]);
    expect(j.movement.medicalClearance).toBeUndefined();
  });

  it("keeps a deterioration pause when another ED clears, and resumes it for the origin ED", () => {
    const j = journey();
    j.send({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId: j.movementId, unitId: UNIT, actingUnitId: UNIT });
    j.send({ type: "RECORD_ED_MEDICAL_DETERIORATION", role: "ed", movementId: j.movementId, actingPlaceId: ORIGIN_ED });
    expect(j.movement.medicalDeterioration?.resumedAt).toBeUndefined();
    const rejected = j.state.rejections.length;
    j.send(
      {
        type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
        role: "ed",
        movementId: j.movementId,
        cleared: true,
        actingPlaceId: OTHER_ED,
      },
      NOW_ANCHOR + 60,
    );
    expect(j.state.rejections).toHaveLength(rejected + 1);
    expect(j.movement.medicalDeterioration?.resumedAt).toBeUndefined();
    j.send(
      {
        type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
        role: "ed",
        movementId: j.movementId,
        cleared: true,
        actingPlaceId: ORIGIN_ED,
      },
      NOW_ANCHOR + 120,
    );
    expect(j.state.rejections).toHaveLength(rejected + 1);
    expect(j.movement.medicalDeterioration?.resumedAt).toBe(NOW_ANCHOR + 120);
    expect(j.movement.medicalClearance).toEqual({ cleared: true, at: NOW_ANCHOR + 120 });
  });

  it("still lets the coordinator record clearance without naming a place", () => {
    const j = journey();
    const before = j.state.rejections.length;
    j.send({ type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE", role: "coordinator", movementId: j.movementId, cleared: true });
    expect(j.state.rejections).toHaveLength(before);
    expect(j.movement.medicalClearance?.cleared).toBe(true);
  });
});

describe("M4: a ward names itself on every answer", () => {
  it.each(["ACCEPT_IN_PRINCIPLE", "DECLINE"] as const)("refuses %s from a ward that names no ward", (type) => {
    const j = journey();
    const before = j.state.rejections.length;
    j.send({
      type,
      role: "ward",
      movementId: j.movementId,
      unitId: UNIT,
      reason: "no_suitable_bed",
    } as WithoutNow<WardFlowEvent>);
    expect(j.state.rejections.slice(before).map((r) => r.reason)).toEqual([
      `${type} from a ward must name the acting ward; a ward answers only its own referrals`,
    ]);
    expect(j.movement.acceptedUnitId).toBeUndefined();
    expect(j.movement.referredUnitIds).toContain(UNIT);
  });

  it("refuses a pull from a ward that names no ward, and accepts both steps once it does", () => {
    const j = journey();
    j.send({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId: j.movementId, unitId: UNIT, actingUnitId: UNIT });
    expect(j.movement.acceptedUnitId).toBe(UNIT);
    const before = j.state.rejections.length;
    j.send({ type: "PULL_PATIENT", role: "ward", movementId: j.movementId, unitId: UNIT });
    expect(j.state.rejections).toHaveLength(before + 1);
    expect(j.movement.stage).not.toBe("pulled");
    j.send({ type: "PULL_PATIENT", role: "ward", movementId: j.movementId, unitId: UNIT, actingUnitId: UNIT });
    expect(j.state.rejections).toHaveLength(before + 1);
    expect(j.movement.stage).toBe("pulled");
  });

  it("lets the coordinator answer for any ward without naming one", () => {
    const j = journey();
    const before = j.state.rejections.length;
    j.send({ type: "ACCEPT_IN_PRINCIPLE", role: "coordinator", movementId: j.movementId, unitId: UNIT });
    expect(j.state.rejections).toHaveLength(before);
    expect(j.movement.acceptedUnitId).toBe(UNIT);
  });
});

describe("M4 on the shared server: a referral answer that names no ward", () => {
  const seeded = seedWardFlowState();
  const places = wardPlaceLookup(seeded.units);
  const options = { now: NOW_ANCHOR, places };
  const [unitA, unitB] = seeded.units;
  const arm: ReferralAddressing = {
    destination: {
      kind: "psychiatric_ward",
      unitId: unitB!.id,
      sex: "Female",
      secureBedNeeded: false,
      involuntaryBedNeeded: false,
      highAcuityNursingNeeded: false,
    },
    state: "queued",
    referredAt: NOW_ANCHOR - 60,
  };
  // Ward A sent this referral to ward B, so ward A sees it as its sender.
  const referral: Referral = {
    ...seeded.referrals[0]!,
    id: "acting-place-strict",
    source: "psychiatric_ward",
    originUnitId: unitA!.id,
    destinations: [arm],
  };
  const state: WardFlowState = { ...seeded, referrals: [...seeded.referrals, referral] };
  const ward = (unitId: string): WardAccess => ({ role: "ward", scope: { kind: "ward", unitIds: [unitId] } });
  const answer = (type: "ACCEPT_REFERRAL" | "DECLINE_REFERRAL", actingUnitId: string) => ({
    type,
    role: "ward",
    referralId: referral.id,
    destinationKind: "psychiatric_ward",
    actingUnitId,
    ...(type === "DECLINE_REFERRAL" ? { reason: "no_suitable_bed" } : {}),
  });

  it.each(["ACCEPT_REFERRAL", "DECLINE_REFERRAL"] as const)(
    "refuses %s from the sending ward for the receiving ward's arm",
    (type) => {
      expect(commandScopeRefusal(state, ward(unitA!.id), answer(type, unitA!.id), options)).toBe(
        "This change names a record outside your role's place.",
      );
    },
  );

  it.each(["ACCEPT_REFERRAL", "DECLINE_REFERRAL"] as const)("the app refuses %s from a ward naming no ward", (type) => {
    const { actingUnitId: _omitted, ...unnamed } = answer(type, unitB!.id);
    const next = wardFlowReducer(state, { ...unnamed, unitId: unitB!.id, now: NOW_ANCHOR } as WardFlowEvent);
    expect(next.rejections.at(-1)?.reason).toBe(
      `${type} from a ward must name the acting ward; a ward answers only its own referrals`,
    );
  });

  it.each(["ACCEPT_REFERRAL", "DECLINE_REFERRAL"] as const)("lets the receiving ward send %s", (type) => {
    expect(commandScopeRefusal(state, ward(unitB!.id), answer(type, unitB!.id), options)).toBeNull();
  });
});
