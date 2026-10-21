// tests/ward-restrictive-practice.test.ts
//
// D-72 (21 Oct 2026): the seclusion, restraint and incident record is operational only. Fixed
// lists, typed times checked only against now and the last day, kept on the ward, and no event
// moves a bed count, a stay or a legal record.
import { describe, expect, it } from "vitest";

import {
  pastInstantFromClockText,
  recentIncidents,
  seclusionRoomView,
} from "@/components/ward-management/restrictive-practice/ward-restrictive-practice";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import { eventCarriesTypedTextPayload } from "@/components/ward-management/ward-flow-persistence-classification";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { STATEWIDE_COORDINATOR, type WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR + 5;

function added(before: WardFlowState, after: WardFlowState) {
  return after.rejections.slice(before.rejections.length).map((rejection) => rejection.reason);
}

function apply(state: WardFlowState, event: Record<string, unknown>) {
  return wardFlowReducer(state, { now: NOW, ...event } as never);
}

function setup() {
  const state = seedWardFlowState();
  const stay = state.admissions.find((admission) => admission.state === "occupied")!;
  const other = state.units.find((unit) => unit.id !== stay.unitId)!;
  return { state, stay, unitId: stay.unitId, otherUnitId: other.id };
}

const start = (unitId: string, admissionId: string, extra: Record<string, unknown> = {}) => ({
  type: "RECORD_RESTRICTIVE_PRACTICE_START",
  role: "ward",
  unitId,
  actingUnitId: unitId,
  admissionId,
  practice: "seclusion",
  startedAt: NOW - 20,
  ...extra,
});

describe("recording seclusion and restraint on a ward", () => {
  it("starts and ends an episode at the typed times, changing nothing else", () => {
    const { state, stay, unitId } = setup();
    const started = apply(state, start(unitId, stay.id));
    expect(added(state, started)).toEqual([]);
    const unit = started.units.find((candidate) => candidate.id === unitId)!;
    const episode = unit.restrictivePractice!.episodes[0]!;
    expect(episode).toMatchObject({ practice: "seclusion", admissionId: stay.id, startedAt: NOW - 20 });
    expect(seclusionRoomView(unit.restrictivePractice)).toEqual({ kind: "in_use", since: NOW - 20 });
    // No bed, stay or other ward moves.
    expect(started.admissions).toEqual(state.admissions);
    expect(started.movements).toEqual(state.movements);
    expect(started.units.filter((candidate) => candidate.id !== unitId)).toEqual(
      state.units.filter((candidate) => candidate.id !== unitId),
    );
    const before = state.units.find((candidate) => candidate.id === unitId)!;
    expect([unit.allocatable.value, unit.empty.value, unit.held, unit.blocked, unit.isClosed]).toEqual([
      before.allocatable.value,
      before.empty.value,
      before.held,
      before.blocked,
      before.isClosed,
    ]);

    const ended = apply(started, {
      type: "RECORD_RESTRICTIVE_PRACTICE_END",
      role: "ward",
      unitId,
      actingUnitId: unitId,
      episodeId: episode.id,
      endedAt: NOW - 5,
    });
    expect(added(started, ended)).toEqual([]);
    const after = ended.units.find((candidate) => candidate.id === unitId)!.restrictivePractice!;
    expect(after.episodes[0]!.endedAt).toBe(NOW - 5);
    expect(seclusionRoomView(after)).toEqual({ kind: "not_recorded" });
  });

  it("refuses a time later than now, older than a day, or an end before the start", () => {
    const { state, stay, unitId } = setup();
    expect(added(state, apply(state, start(unitId, stay.id, { startedAt: NOW + 1 })))).toEqual([
      "The time cannot be later than now",
    ]);
    expect(added(state, apply(state, start(unitId, stay.id, { startedAt: NOW - 24 * 60 - 1 })))).toEqual([
      "The time must be within the last 24 hours",
    ]);
    const started = apply(state, start(unitId, stay.id));
    const episodeId = started.units.find((unit) => unit.id === unitId)!.restrictivePractice!.episodes[0]!.id;
    const early = apply(started, {
      type: "RECORD_RESTRICTIVE_PRACTICE_END",
      role: "ward",
      unitId,
      actingUnitId: unitId,
      episodeId,
      endedAt: NOW - 30,
    });
    expect(added(started, early)).toEqual(["The end time cannot be before the start time"]);
  });

  it("refuses a second open episode of the same kind, a patient on another ward, and another ward acting", () => {
    const { state, stay, unitId, otherUnitId } = setup();
    const started = apply(state, start(unitId, stay.id));
    expect(added(started, apply(started, start(unitId, stay.id)))).toEqual(["Seclusion is already recorded as in use"]);
    // Restraint alongside seclusion is a different record and is allowed.
    expect(added(started, apply(started, start(unitId, stay.id, { practice: "bodily_restraint_physical" })))).toEqual(
      [],
    );
    expect(added(state, apply(state, start(otherUnitId, stay.id)))[0]).toMatch(/is not a patient on/);
    expect(added(state, apply(state, { ...start(unitId, stay.id), actingUnitId: otherUnitId }))[0]).toMatch(
      /a ward records only for itself/,
    );
    expect(added(state, apply(state, start(unitId, stay.id, { practice: "chemical_restraint" })))[0]).toMatch(
      /RESTRICTIVE_PRACTICES/,
    );
  });
});

describe("ward incidents and the seclusion room", () => {
  it("records an incident from the fixed list and lists the last day's, newest first", () => {
    const { state, unitId } = setup();
    const incident = (category: string, at: number) => ({
      type: "RECORD_WARD_INCIDENT",
      role: "coordinator",
      unitId,
      category,
      at,
    });
    const one = apply(state, incident("fall", NOW - 60));
    const two = apply(one, incident("self_harm", NOW - 10));
    expect(added(state, two)).toEqual([]);
    expect(added(two, apply(two, incident("made_up", NOW)))[0]).toMatch(/WARD_INCIDENT_CATEGORIES/);
    const record = two.units.find((unit) => unit.id === unitId)!.restrictivePractice;
    expect(recentIncidents(record, NOW).map((entry) => entry.category)).toEqual(["self_harm", "fall"]);
    expect(recentIncidents(record, NOW + 24 * 60 - 30).map((entry) => entry.category)).toEqual(["self_harm"]);
  });

  it("records the room status, refuses the same status twice, and shows in use over a recorded status", () => {
    const { state, stay, unitId } = setup();
    const room = { type: "SET_SECLUSION_ROOM_STATUS", role: "ward", unitId, actingUnitId: unitId };
    const out = apply(state, { ...room, status: "out_of_service" });
    expect(added(state, out)).toEqual([]);
    expect(added(out, apply(out, { ...room, status: "out_of_service" }))[0]).toMatch(/already recorded that way/);
    const record = () => out.units.find((unit) => unit.id === unitId)!.restrictivePractice;
    expect(seclusionRoomView(record())).toMatchObject({ kind: "recorded", status: "out_of_service" });
    const inUse = apply(apply(out, { ...room, status: "available" }), start(unitId, stay.id));
    expect(seclusionRoomView(inUse.units.find((unit) => unit.id === unitId)!.restrictivePractice).kind).toBe("in_use");
  });
});

describe("typed times and saving", () => {
  it("reads a typed clock time as the latest such time at or before now", () => {
    const midnight = Math.floor(NOW / 1440) * 1440;
    expect(pastInstantFromClockText("00:10", midnight + 30)).toBe(midnight + 10);
    expect(pastInstantFromClockText("2350", midnight + 30)).toBe(midnight - 10);
    expect(pastInstantFromClockText("25:00", NOW)).toBeUndefined();
    expect(pastInstantFromClockText("soon", NOW)).toBeUndefined();
  });

  it("carries no typed text, so it never stops browser saving", () => {
    const { stay, unitId } = setup();
    for (const event of [
      start(unitId, stay.id),
      { type: "RECORD_WARD_INCIDENT", role: "ward", unitId, category: "fall", at: NOW },
      { type: "SET_SECLUSION_ROOM_STATUS", role: "ward", unitId, status: "available" },
      { type: "RECORD_RESTRICTIVE_PRACTICE_END", role: "ward", unitId, episodeId: "RP-x-1", endedAt: NOW },
    ]) {
      expect(eventCarriesTypedTextPayload({ now: NOW, ...event } as never)).toBe(false);
    }
  });
});

describe("what a scoped desk is sent", () => {
  it("keeps a ward desk's own episodes and drops those naming another ward's stay", () => {
    const state = seedWardFlowState();
    const stay = state.admissions.find((admission) => admission.state === "occupied")!;
    const otherStay = state.admissions.find(
      (admission) => admission.state === "occupied" && admission.unitId !== stay.unitId,
    )!;
    const both = apply(apply(state, start(stay.unitId, stay.id)), start(otherStay.unitId, otherStay.id));
    const places = wardPlaceLookup(both.units);
    const desk: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [stay.unitId] } };
    const episodesOn = (world: WardFlowState, unitId: string) =>
      world.units.find((unit) => unit.id === unitId)?.restrictivePractice?.episodes ?? [];

    const scoped = scopeWardFlowState(both, desk, { now: NOW, places }).state;
    expect(episodesOn(scoped, stay.unitId).map((episode) => episode.admissionId)).toEqual([stay.id]);
    expect(episodesOn(scoped, otherStay.unitId)).toEqual([]);

    const statewide = scopeWardFlowState(both, STATEWIDE_COORDINATOR, { now: NOW, places }).state;
    expect(episodesOn(statewide, otherStay.unitId).map((episode) => episode.admissionId)).toEqual([otherStay.id]);
  });

  it("still sends the ward an open episode whose patient has left, so the ward can record its end", () => {
    const state = seedWardFlowState();
    const stay = state.admissions.find((admission) => admission.state === "occupied")!;
    const elsewhere = state.units.find((unit) => unit.id !== stay.unitId)!;
    const started = apply(state, start(stay.unitId, stay.id));
    // The patient moves on before anyone records the end: the stay now sits on another ward.
    const moved: WardFlowState = {
      ...started,
      admissions: started.admissions.map((admission) =>
        admission.id === stay.id ? { ...admission, unitId: elsewhere.id } : admission,
      ),
    };
    const places = wardPlaceLookup(moved.units);
    const desk: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [stay.unitId] } };
    const scoped = scopeWardFlowState(moved, desk, { now: NOW, places }).state;
    expect(scoped.admissions.some((admission) => admission.id === stay.id)).toBe(false);
    const open = scoped.units.find((unit) => unit.id === stay.unitId)!.restrictivePractice!.episodes;
    expect(open.map((episode) => episode.admissionId)).toEqual([stay.id]);
  });
});
