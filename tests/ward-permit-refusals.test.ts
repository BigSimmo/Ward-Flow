import { describe, expect, it } from "vitest";

import { commandRefusal, deskCommand, seedWorld } from "../backend/ward-flow/engine";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { deskFor, deskRoleForAccess } from "@/components/ward-management/ward-desk";
import { SUITABILITY_GATES } from "@/components/ward-management/ward-eligibility";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  NOT_YOUR_ROLE,
  PLANNED_ARRIVAL_OVERRIDABLE_GATES,
  permit,
  RECORD_CHECKS,
  recordedRole,
  type Change,
} from "@/components/ward-management/ward-permit";
import { OUTSIDE_PLACE } from "@/components/ward-management/ward-permit-place-rules";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * R-STRUCT-4, D-223 (Josh, 14 Nov 2026): the saves the signed rules allow but the app refused are
 * pinned as allowed, and the place refusals the screens missed are pinned as hidden. Each change is
 * built WITHOUT a role, as a screen will build it once the shell stamps the desk (History, D-222);
 * the server is sent the membership's own role, which is what the stamp writes.
 */
const AT = new Date("2026-11-14T02:00:00Z");
const world = seedWorld(AT);
const state = world.state as unknown as WardFlowState;
const places = wardPlaceLookup(state.units);
const records = { state, places };

/** The whole saved path: the server's role and place check, then the reducer. */
function save(access: WardAccess, change: Change): { refusal: string | null; rejected: boolean } {
  const desk = deskFor(access, { canSwitch: false });
  const sent = deskCommand(access, { ...change, role: recordedRole(desk, change.type), now: NOW_ANCHOR }) as Record<
    string,
    unknown
  >;
  const refusal = commandRefusal(world, access, sent, AT);
  if (refusal !== null) return { refusal, rejected: true };
  const after = wardFlowReducer(state, sent as unknown as WardFlowEvent);
  return { refusal: null, rejected: after.rejections.length > state.rejections.length };
}

const answer = (access: WardAccess, change: Change) => permit(deskFor(access, { canSwitch: false }), change, records);

describe("R-STRUCT-4: allowed saves the app refused, pinned as allowed (D-223)", () => {
  it("R2-1: the site bed manager confirms beds on its own site, never another site's", () => {
    const own = state.units[0]!;
    const elsewhere = state.units.find((unit) => unit.siteCode !== own.siteCode)!;
    const bedManager: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: own.siteCode } };
    const confirm = (unitId: string): Change => ({
      type: "CONFIRM_CAPACITY",
      unitId,
      actingUnitId: unitId,
      value: 2,
      expectedRevision: state.units.find((unit) => unit.id === unitId)!.allocatable.revision ?? 0,
    });
    expect(answer(bedManager, confirm(own.id))).toEqual({ kind: "allow" });
    expect(save(bedManager, confirm(own.id))).toEqual({ refusal: null, rejected: false });
    expect(answer(bedManager, confirm(elsewhere.id))).toEqual({ kind: "never", refusal: OUTSIDE_PLACE });
    expect(save(bedManager, confirm(elsewhere.id)).refusal).toBe(OUTSIDE_PLACE);
    // The demo fault: the screen typed "ward", which the server refuses for a bed manager's membership.
    expect(commandRefusal(world, bedManager, { ...confirm(own.id), role: "ward", now: NOW_ANCHOR }, AT)).toBe(
      NOT_YOUR_ROLE,
    );
  });

  it("X1b-6: the person's own ED and the accepting ward save an arrival plan; another ward cannot", () => {
    const movement = state.movements.find(
      (candidate) => candidate.acceptedUnitId && candidate.originEdId && !candidate.closure,
    )!;
    const accepting = movement.acceptedUnitId!;
    const otherWard = state.units.find(
      (unit) => unit.id !== accepting && unit.siteCode !== state.units.find((u) => u.id === accepting)!.siteCode,
    )!;
    const plan = (actingUnitId?: string): Change => ({
      type: "SET_ARRIVAL_DETAILS",
      movementId: movement.id,
      arrivalMode: "mental_health_transport",
      estimatedArrivalAt: NOW_ANCHOR + 60,
      ...(actingUnitId ? { actingUnitId } : {}),
    });
    const ed: WardAccess = { role: "ed", scope: { kind: "ed", edId: movement.originEdId! } };
    const ward: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [accepting] } };
    const elsewhere: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [otherWard.id] } };

    expect(answer(ed, plan())).toEqual({ kind: "allow" });
    expect(save(ed, plan())).toEqual({ refusal: null, rejected: false });
    expect(answer(ward, plan(accepting))).toEqual({ kind: "allow" });
    expect(save(ward, plan(accepting))).toEqual({ refusal: null, rejected: false });
    expect(answer(elsewhere, plan(otherWard.id)).kind).toBe("never");
    expect(save(elsewhere, plan(otherWard.id)).rejected).toBe(true);
    // The live fault: the modal sent "coordinator" from the ED's membership.
    expect(commandRefusal(world, ed, { ...plan(), role: "coordinator", now: NOW_ANCHOR }, AT)).toBe(NOT_YOUR_ROLE);
    expect(RECORD_CHECKS.map((check) => check.id)).toEqual(["arrival-plan-accepting-ward"]);
  });

  it("X2-4: a planned arrival may override a stale bed count only, never the gender check", () => {
    const unit = state.units[0]!;
    const ward: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [unit.id] } };
    expect(answer(ward, { type: "CONVERT_PLANNED_ADMISSION", unitId: unit.id, overrideReason: "x" })).toEqual({
      kind: "allow",
    });
    expect([...PLANNED_ARRIVAL_OVERRIDABLE_GATES]).toEqual(["capacity_freshness"]);
    for (const gate of PLANNED_ARRIVAL_OVERRIDABLE_GATES) expect(SUITABILITY_GATES).toContain(gate);
    expect(PLANNED_ARRIVAL_OVERRIDABLE_GATES as readonly string[]).not.toContain("gender_designation");
  });
});

describe("place refusals the screens missed, pinned as hidden (D-223)", () => {
  it("R3-10: a ward never books transport for a journey it received rather than sent", () => {
    const movement = state.movements.find(
      (candidate) => candidate.acceptedUnitId && candidate.originEdId && !candidate.closure,
    )!;
    const receiving: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [movement.acceptedUnitId!] } };
    const book: Change = { type: "BOOK_TRANSPORT", movementId: movement.id };
    expect(answer(receiving, book)).toEqual({ kind: "never", refusal: OUTSIDE_PLACE });
    expect(save(receiving, book).refusal).toBe(OUTSIDE_PLACE);
  });

  it("REC-E-1: the site bed manager never signs off a ward's handover", () => {
    const unit = state.units[0]!;
    const bedManager: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: unit.siteCode } };
    expect(answer(bedManager, { type: "RECORD_HANDOVER_SIGN_OFF", unitId: unit.id })).toEqual({
      kind: "never",
      refusal: NOT_YOUR_ROLE,
    });
  });
});

describe("the desk a change comes from", () => {
  it("records the membership's role, and gates a coordinator on another desk's route through that desk", () => {
    const statewide: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };
    const onWard = deskFor(statewide, { routeRole: "ward" });
    expect(onWard).toMatchObject({ role: "coordinator", actsAs: "ward", canSwitch: true });
    // A step the ward lens cannot take is "not now" with today's lock line, not hidden.
    expect(permit(onWard, { type: "REFER_TO_UNITS" })).toEqual({
      kind: "not-now",
      refusal: NOT_YOUR_ROLE,
      reason: "Coordinator only",
    });
    // Any other desk acts only as itself, whatever the route says.
    const ward: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [state.units[0]!.id] } };
    expect(deskFor(ward, { routeRole: "coordinator" })).toMatchObject({
      role: "ward",
      actsAs: "ward",
      canSwitch: false,
    });
    // The access admin has no clinical role; its one switch is recorded under the coordinator role (D-142).
    const admin: WardAccess = { role: "admin", scope: { kind: "statewide" } };
    expect(deskRoleForAccess(admin)).toBe("executive");
    expect(recordedRole(deskFor(admin), "SET_SITE_FEATURE_SWITCH")).toBe("coordinator");
    expect(recordedRole(deskFor(statewide), "ADVANCE_CLOCK")).toBe("demo");
  });
});
