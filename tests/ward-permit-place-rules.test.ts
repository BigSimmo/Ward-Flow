import { describe, expect, it } from "vitest";

import { commandRefusal, seedWorld } from "../backend/ward-flow/engine";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { commandScopeRefusal } from "@/components/ward-management/ward-access-state";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  DESK_RULES,
  deskRuleRefusal,
  OUTSIDE_PLACE,
  PLACE_RULES,
  placeRuleRefusal,
  teamIsOwn,
} from "@/components/ward-management/ward-permit-place-rules";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR, siteByCode } from "@/components/ward-management/ward-sites";
import { COMMUNITY_TEAMS } from "@/components/ward-management/ward-teams";

/**
 * Phase 1 of the permissions build (D-223): `PLACE_RULES` is a copy of `commandScopeRefusal`'s place
 * rules. Until phase 2 makes the server run the table, this holds the two to the same answer: where
 * the table refuses, the server refuses in the same words; where the table lets a change through,
 * the server either lets it through too or refuses it only in its record-reference pass (which
 * answers `OUTSIDE_PLACE` and stays on the server). A change that names no record gets exactly the
 * server's answer.
 */
const AT = new Date("2026-11-14T02:00:00Z");
const world = seedWorld(AT);
const state = world.state as unknown as WardFlowState;
const places = wardPlaceLookup(state.units);
const options = { now: NOW_ANCHOR, places };

const own = state.units[0]!;
const other = state.units.find(
  (unit) => unit.siteCode !== own.siteCode && places.unitService(unit.id) !== places.unitService(own.id),
)!;
const ed = siteByCode(own.siteCode)?.emergencyDepartment ?? siteByCode("RPH")!.emergencyDepartment!;
const otherEd = state.units
  .map((unit) => siteByCode(unit.siteCode)?.emergencyDepartment)
  .find((candidate) => candidate && candidate.id !== ed.id)!;
const team = Object.values(COMMUNITY_TEAMS)[0]!;

const DESKS: readonly WardAccess[] = [
  { role: "coordinator", scope: { kind: "service", service: places.unitService(own.id)! } },
  { role: "bed_manager", scope: { kind: "site", siteCode: own.siteCode } },
  { role: "ward", scope: { kind: "ward", unitIds: [own.id] } },
  { role: "ward", scope: { kind: "ward", unitIds: [other.id] } },
  { role: "ed", scope: { kind: "ed", edId: ed.id } },
  { role: "community", scope: { kind: "team", teamName: team } },
  { role: "officer", scope: { kind: "jobs", service: places.unitService(own.id)! } },
];

/** Field sets that name no record, so the server's record-reference pass has nothing to refuse. */
const PLACE_FIELDS: readonly Record<string, unknown>[] = [
  {},
  { unitId: own.id },
  { unitId: other.id },
  { actingUnitId: own.id },
  { actingUnitId: other.id },
  { unitIds: [own.id] },
  { unitIds: [own.id, other.id] },
  { acceptedUnitId: other.id },
  { originUnitId: other.id },
  { siteCode: own.siteCode },
  { siteCode: other.siteCode },
  { network: true },
  { targetScope: "all", targetUnitIds: [own.id] },
  { targetScope: "all", targetUnitIds: [other.id] },
  { kind: "bed_call", targetScope: "metro_adult" },
  { targetScope: "nowhere" },
  { actingPlaceId: ed.id },
  { actingPlaceId: otherEd.id },
  { edId: ed.id },
  { actingPlaceId: "coordinator" },
  { actingTeamId: team },
  { actingTeamId: "another-team" },
  { placeId: otherEd.id },
  { source: "ed_medical", originSiteCode: ed.siteCode },
  { source: "ed_medical", originSiteCode: otherEd.siteCode },
  { target: { actingUnitId: other.id } },
  { change: { kind: "transfer", receivingUnitId: other.id } },
];

/** Field sets that name records, which the server also checks against the desk's projection. */
const RECORD_FIELDS: readonly Record<string, unknown>[] = [
  ...state.movements
    .slice(0, 8)
    .flatMap((movement) => [
      { movementId: movement.id },
      { movementId: movement.id, actingUnitId: movement.acceptedUnitId },
    ]),
  ...state.referrals
    .slice(0, 6)
    .flatMap((referral) => [
      { referralId: referral.id },
      { referralId: referral.id, destinationKind: "psychiatric_ward" },
      { referralId: referral.id, destinationKind: "emergency_department" },
      { referralId: referral.id, destinationKind: "community_team" },
    ]),
  { alertId: "not-an-alert", unitIds: [own.id] },
];

/**
 * Every change a rule names, plus a sample the generic place claims alone decide (they ask the same
 * of every change). Asking all 207 for every field set takes over half a minute for no more cover.
 */
const TYPES = [
  ...new Set([
    ...[...DESK_RULES, ...PLACE_RULES].flatMap((rule) => rule.types ?? []),
    "CONFIRM_CAPACITY",
    "PATIENT_ARRIVED",
    "SET_ARRIVAL_DETAILS",
    "MARK_NOTICE_READ",
    "RECORD_OBSERVATION_LEVEL",
    "PULL_PATIENT",
  ]),
];

it("samples real change types", () => {
  for (const type of TYPES) expect(Object.hasOwn(EVENT_ROLE, type), type).toBe(true);
});

function compare(access: WardAccess, fields: Record<string, unknown>, exact: boolean) {
  for (const type of TYPES) {
    const command = { type, role: access.role, now: NOW_ANCHOR, ...fields };
    const table = placeRuleRefusal({ state, access, command, places });
    const server = commandScopeRefusal(state, access, command, options);
    const label = `${access.role}/${JSON.stringify(access.scope)} ${type} ${JSON.stringify(fields)}`;
    if (table) expect(server, label).toBe(table.refusal);
    else if (exact) expect(server, label).toBeNull();
    else expect([null, OUTSIDE_PLACE], label).toContain(server);
  }
}

describe("PLACE_RULES gives commandScopeRefusal's answers (phase 1 parity, D-223)", () => {
  it("matches exactly for every change that names no record", () => {
    for (const access of DESKS) for (const fields of PLACE_FIELDS) compare(access, fields, true);
  });

  it("matches up to the server's record-reference pass for changes that name records", () => {
    for (const access of DESKS) for (const fields of RECORD_FIELDS) compare(access, fields, false);
  });

  it("never refuses the whole network", () => {
    const statewide: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };
    expect(placeRuleRefusal({ state, access: statewide, command: { type: "SET_CONFIGURATION" }, places })).toBeNull();
    expect(deskRuleRefusal(statewide, { type: "RECORD_OUTAGE_WINDOW" })).toBeNull();
  });

  it("asks the outage and site switch rules before the role, as commandRefusal does", () => {
    const ward: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [own.id] } };
    for (const command of [
      { type: "RECORD_OUTAGE_WINDOW", role: "ward", now: NOW_ANCHOR },
      { type: "SET_SITE_FEATURE_SWITCH", role: "ward", siteCode: own.siteCode },
    ]) {
      expect(deskRuleRefusal(ward, command)?.refusal).toBe(commandRefusal(world, ward, command, AT));
    }
    expect(DESK_RULES.map((rule) => rule.id)).toEqual(["site-feature-switch", "outage-statewide"]);
  });

  it("keeps the rules that answer in their own words ahead of the place claims, each named once", () => {
    const ownWords = PLACE_RULES.map((rule) => rule.id).slice(0, 4);
    expect(ownWords).toEqual([
      "configuration-statewide",
      "ward-sign-off-names-ward",
      "network-sign-off-statewide",
      "site-sign-off-own-site",
    ]);
    expect(new Set(PLACE_RULES.map((rule) => rule.id)).size).toBe(PLACE_RULES.length);
  });

  it("knows a team's own name and slug, and nobody else's", () => {
    const desk: WardAccess = { role: "community", scope: { kind: "team", teamName: team } };
    expect(teamIsOwn(desk, team, places)).toBe(true);
    expect(teamIsOwn(desk, places.teamSlug(team), places)).toBe(true);
    expect(teamIsOwn(desk, "another-team", places)).toBe(false);
    expect(teamIsOwn({ role: "ward", scope: { kind: "ward", unitIds: [own.id] } }, team, places)).toBe(false);
  });
});
