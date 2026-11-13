import { describe, expect, it } from "vitest";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { NOW_ANCHOR as now } from "../src/components/ward-management/ward-sites";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

const UNIT = "scgh-adult-open";
function fixture() {
  const state = seedWardFlowState();
  const original = state.units.find((u) => u.id === UNIT)!;
  const unit = {
    ...original,
    beds: 2,
    lockedBeds: 0,
    allocatableLocked: 0,
    allocatable: { ...original.allocatable, value: 2 },
    empty: { ...original.empty, value: 2 },
  };
  return {
    ...state,
    units: state.units.map((u) => (u.id === UNIT ? unit : u)),
    admissions: [],
    movements: [],
    referrals: [],
    bedReleases: [],
    leaveBeds: [],
  } as WardFlowState;
}
function received(initial = fixture()) {
  const state = wardFlowReducer(initial, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now,
    ageBand: "Adult",
    destinations: [
      {
        kind: "psychiatric_ward",
        unitId: UNIT,
        sex: "Female",
        gender: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "unknown", reason: "not_known" },
    source: "community",
    urgency: 2,
    originSiteCode: "SCGH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  });
  expect(state.rejections).toEqual([]);
  return state;
}
const accept = (s: WardFlowState, bedNumber?: number) =>
  wardFlowReducer(s, {
    type: "ACCEPT_REFERRAL",
    role: "ward",
    actingUnitId: UNIT,
    now,
    referralId: s.referrals.at(-1)!.id,
    destinationKind: "psychiatric_ward",
    unitId: UNIT,
    ...(bedNumber ? { bedNumber } : {}),
  });
const hold = (s: WardFlowState, bedNumber: number) =>
  wardFlowReducer(s, {
    type: "HOLD_REFERRAL_BED",
    role: "ward",
    actingUnitId: UNIT,
    now: now + 1,
    referralId: s.referrals.at(-1)!.id,
    unitId: UNIT,
    bedNumber,
  } as unknown as WardFlowEvent);

function acceptedMovement() {
  let state = wardFlowReducer(fixture(), {
    type: "RAISE_REFERRAL",
    role: "ed",
    now,
    edId: "jhc-ed",
    draft: {
      cohort: "Adult",
      security: "Open",
      sex: "Female",
      gender: "Female",
      observation: { level: "general" as const, intervalMinutes: null, reviewAt: null },
      highAcuity: false,
      legalStatus: "Voluntary",
      urgency: 2,
      legalFormCode: null,
    },
  });
  const movementId = state.movements.at(-1)!.id;
  const events: WardFlowEvent[] = [
    { type: "REFER_TO_UNITS", role: "coordinator", now, movementId, unitIds: [UNIT] },
    { type: "ACCEPT_IN_PRINCIPLE", role: "ward", actingUnitId: UNIT, now, movementId, unitId: UNIT, bedNumber: 2 },
    { type: "RECORD_TRANSPORT_NEED", role: "ed", actingPlaceId: "jhc-ed", now, movementId, needed: false },
  ];
  state = events.reduce(wardFlowReducer, state);
  expect(state.rejections).toEqual([]);
  return { state, movementId };
}

import { bedStates } from "../src/components/ward-management/ward-bed-states";
import { searchWardFlow } from "../src/components/ward-management/search/ward-smart-search";
import type { Admission } from "../src/components/ward-management/ward-admissions";
const counts = (s: WardFlowState) =>
  bedStates(
    s.units.find((u) => u.id === UNIT)!,
    s.admissions,
    s.bedReleases,
    s.leaveBeds,
    [...s.referrals, ...s.movements],
  );
describe("consolidated reservation accuracy", () => {
  it("counts a named reservation, excludes its ward from free-bed search and preserves the competing guard", () => {
    const initial = fixture();
    initial.units = initial.units.map((u) =>
      u.id === UNIT ? { ...u, empty: { ...u.empty, value: 1 }, allocatable: { ...u.allocatable, value: 1 } } : u,
    );
    const held = hold(accept(received(initial)), 2);
    expect(held.rejections).toEqual([]);
    expect(counts(held)).toMatchObject({ ready: 0, pulled: 1, occupied: 1 });
    expect(
      searchWardFlow({
        query: "free beds",
        patients: [],
        movements: [],
        units: held.units.filter((u) => u.id === UNIT),
        admissions: held.admissions,
        referrals: held.referrals,
      }).wards,
    ).toEqual([]);
    const competing = hold(accept(received(held)), 2);
    expect(competing.rejections.length).toBeGreaterThan(held.rejections.length);
    expect(counts(competing)).toMatchObject({ ready: 0, pulled: 1 });
  });
  it("deduplicates physical beds and conversion links, then releases the named hold", () => {
    const held = hold(accept(received()), 2);
    expect(counts(held)).toMatchObject({ ready: 1, pulled: 1 });
    const duplicate = { ...held, referrals: [...held.referrals, { ...held.referrals[0], id: "duplicate" }] };
    expect(counts(duplicate)).toMatchObject({ ready: 1, pulled: 1 });
    const admission = {
      id: "AD-ARR-test",
      referralId: held.referrals[0].id,
      unitId: UNIT,
      bedNumber: 2,
      state: "pulled",
      movementId: "WF-test",
    } as unknown as Admission;
    expect(counts({ ...held, admissions: [admission] })).toMatchObject({ ready: 1, pulled: 1 });
    const released = {
      ...held,
      referrals: held.referrals.map((r) => ({
        ...r,
        destinations: r.destinations.map((a) => ({ ...a, heldBedNumber: undefined })),
      })),
    };
    expect(counts(released)).toMatchObject({ ready: 2, pulled: 0 });
  });
  it("does not consume this ward's hold for a waiting-list or other ward admission", () => {
    const held = hold(accept(received()), 2);
    const admission = {
      id: "AD-other",
      referralId: held.referrals[0].id,
      unitId: UNIT,
      state: "waitlisted",
      bedNumber: 2,
    } as unknown as Admission;
    expect(counts({ ...held, admissions: [admission] })).toMatchObject({ ready: 1, pulled: 1 });
    expect(counts({ ...held, admissions: [{ ...admission, unitId: "other", state: "occupied" }] })).toMatchObject({
      ready: 1,
      pulled: 1,
    });
  });
  it("counts a movement-only named hold once through referral conversion and arrival", () => {
    const state = fixture();
    const unit = state.units.find((u) => u.id === UNIT)!;
    const movement = {
      id: "WF-held",
      heldBedNumber: 2,
      acceptedUnitId: UNIT,
      stage: "accepted_awaiting_bed",
    } as unknown as import("../src/components/ward-management/ward-model").Movement;
    expect(bedStates(unit, [], [], [], [movement])).toMatchObject({ ready: 1, pulled: 1 });
    const referral = hold(accept(received()), 2).referrals[0];
    expect(bedStates(unit, [], [], [], [referral, { ...movement, referralId: referral.id }])).toMatchObject({
      ready: 1,
      pulled: 1,
    });
    expect(bedStates(unit, [], [], [], [{ ...movement, stage: "arrived" }])).toMatchObject({ ready: 2, pulled: 0 });
    expect(
      bedStates(
        unit,
        [],
        [],
        [],
        [{ ...movement, closure: { kind: "cancelled", at: 643 } } as unknown as typeof movement],
      ),
    ).toMatchObject({ ready: 2, pulled: 0 });
  });
  it("keeps one commitment through actual movement pull, arrival and release commands", () => {
    const { state: accepted, movementId } = acceptedMovement();
    expect(counts(accepted)).toMatchObject({ ready: 1, pulled: 1, occupied: 0 });
    const pulled = wardFlowReducer(accepted, {
      type: "PULL_PATIENT",
      role: "ward",
      actingUnitId: UNIT,
      now,
      movementId,
      unitId: UNIT,
    });
    expect(pulled.rejections).toEqual([]);
    expect(counts(pulled)).toMatchObject({ ready: 1, pulled: 1, occupied: 0 });
    const arrived = wardFlowReducer(pulled, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      actingUnitId: UNIT,
      now: now + 1,
      movementId,
      exception: { gaps: ["fit_to_travel_missing"], reason: "treating_team_confirmed" },
    });
    expect(arrived.rejections).toEqual([]);
    expect(counts(arrived)).toMatchObject({ ready: 1, pulled: 0, occupied: 1 });
    const released = wardFlowReducer(pulled, {
      type: "RELEASE_PULL",
      role: "coordinator",
      now,
      movementId,
      reason: "pull_made_in_error",
    });
    expect(released.rejections).toEqual([]);
    expect(counts(released)).toMatchObject({ ready: 2, pulled: 0, occupied: 0 });
  });
  it("keeps Search aligned after a live pull and capacity reconfirmation", () => {
    const state = fixture();
    const unit = state.units.find((u) => u.id === UNIT)!;
    const admission = {
      id: "AD-ARR-test",
      unitId: UNIT,
      state: "pulled",
      movementId: "WF-test",
    } as unknown as Admission;
    const result = searchWardFlow({
      query: unit.name,
      patients: [],
      movements: [],
      units: [unit],
      admissions: [admission],
    });
    expect(result.wards[0].readyBeds).toBe(bedStates(unit, [admission], [], [], []).ready);
    expect(result.wards[0].readyBeds).toBe(1);
  });
});
