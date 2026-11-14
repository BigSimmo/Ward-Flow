import { describe, expect, it } from "vitest";

import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { scopeWorkspace } from "../src/components/ward-management/ward-access-scope";
import { scopeWardFlowState } from "../src/components/ward-management/ward-access-state";
import { totalReadyBedsNow } from "../src/components/ward-management/ward-bed-states";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { unitInScope, type WardAccess } from "../src/components/ward-management/ward-role-access";
import { wardBedsInUse } from "../src/components/ward-management/ward-occupancy";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * Josh, 14 Nov 2026 ("Ensure all screens align"; Demo-Rules-RV2-17, Lead-VM-7): "Beds ready now"
 * read 24 on the ED, community and Transport desks and 23 on the coordinator's, because those desks
 * were not sent the bed still being made ready. Every desk now reads the coordinator's figure.
 */
function worldFor(scenario: "standard" | "scarce"): WardFlowState {
  const seeded = seedWardFlowState();
  return scenario === "standard"
    ? seeded
    : wardFlowReducer(seeded, { type: "SET_SCENARIO", role: "demo", now: NOW_ANCHOR, scenario });
}

function desksFor(world: WardFlowState): Record<string, WardAccess> {
  const places = wardPlaceLookup(world.units);
  const unit = world.admissions.find((admission) => admission.leftAt === null)?.unitId ?? world.units[0].id;
  const team = world.patients.find((patient) => patient.catchmentCommunityTeam)?.catchmentCommunityTeam ?? "None";
  return {
    ed: { role: "ed", scope: { kind: "ed", edId: world.movements[0]?.originEdId ?? "none" } },
    community: { role: "community", scope: { kind: "team", teamName: team } },
    transport: { role: "officer", scope: { kind: "jobs" } },
    executive: { role: "executive", scope: { kind: "statewide" } },
    admin: { role: "admin", scope: { kind: "statewide" } },
    siteBedManager: { role: "bed_manager", scope: { kind: "site", siteCode: places.unitSiteCode(unit)! } },
    nurseInCharge: { role: "ward", scope: { kind: "ward", unitIds: [unit] } },
  };
}

const readyOf = (state: Pick<WardFlowState, "units" | "admissions" | "bedReleases" | "movements" | "referrals">) =>
  totalReadyBedsNow(state.units, state.admissions, state.bedReleases, [...state.movements, ...state.referrals]);

describe("Beds ready now is one figure on every desk (Josh, 14 Nov 2026)", () => {
  for (const scenario of ["standard", "scarce"] as const) {
    const world = worldFor(scenario);
    const places = wardPlaceLookup(world.units);
    const coordinator = readyOf(world);

    it(`the ${scenario} day holds a bed being made ready, which the figure leaves out`, () => {
      expect(totalReadyBedsNow(world.units, world.admissions, [], [...world.movements, ...world.referrals])).toBe(
        coordinator + 1,
      );
    });

    for (const [name, access] of Object.entries(desksFor(world))) {
      it(`the ${name} desk's copy from the server reads the coordinator's ${scenario} figure`, () => {
        const scoped = JSON.parse(
          JSON.stringify(scopeWardFlowState(world, access, { now: NOW_ANCHOR, places }).state),
        ) as WardFlowState;
        expect(readyOf(scoped)).toBe(coordinator);
      });

      it(`the ${name} desk's copy in the browser reads the coordinator's ${scenario} figure`, () => {
        // As `WardAccessScope` builds it: the scoped workspace, and the releases of the desk's own wards.
        const scoped = scopeWorkspace(world, access, { now: NOW_ANCHOR, places });
        const bedReleases = world.bedReleases.filter((release) => unitInScope(access.scope, release.unitId, places));
        expect(readyOf({ ...scoped, bedReleases })).toBe(coordinator);
      });
    }

    it(`keeps named holds out of In use for a ward outside the desk's records (${scenario})`, () => {
      // Occupancy passes no holds, so a named hold is never a bed in use; the carried counts agree.
      // Name a free bed for one open journey so the check is not vacuous (codex review, PR #1674).
      const unit = world.units.find((candidate) => candidate.beds > 2)!;
      const taken = new Set(
        world.admissions.filter((row) => row.unitId === unit.id && row.leftAt === null).map((row) => row.bedNumber),
      );
      const freeBed = Array.from({ length: unit.beds }, (_, index) => index + 1).find((bed) => !taken.has(bed))!;
      const journey = world.movements.find(
        (movement) => movement.closure === undefined && movement.stage !== "arrived" && !movement.admissionId,
      )!;
      const held: WardFlowState = {
        ...world,
        movements: world.movements.map((movement) =>
          movement.id === journey.id ? { ...movement, acceptedUnitId: unit.id, heldBedNumber: freeBed } : movement,
        ),
      };
      const scoped = scopeWardFlowState(held, desksFor(held).ed, { now: NOW_ANCHOR, places }).state;
      expect(scoped.units.find((candidate) => candidate.id === unit.id)?.readyOutOfView?.named).toBe(1);
      for (const scopedUnit of scoped.units) {
        const whole = held.units.find((candidate) => candidate.id === scopedUnit.id)!;
        expect(wardBedsInUse(scopedUnit, held.admissions, held.bedReleases)).toBe(
          wardBedsInUse(whole, held.admissions, held.bedReleases),
        );
      }
    });

    it(`carries only counts for the wards outside a desk's records (${scenario})`, () => {
      const scoped = scopeWardFlowState(world, desksFor(world).ed, { now: NOW_ANCHOR, places }).state;
      for (const unit of scoped.units) {
        expect(Object.values(unit.readyOutOfView ?? {}).every((value) => Number.isInteger(value))).toBe(true);
      }
      expect(scoped.units.every((unit) => unit.readyOutOfView !== undefined)).toBe(true);
      // The statewide coordinator's copy is the saved state itself: nothing added.
      const whole = scopeWardFlowState(
        world,
        { role: "coordinator", scope: { kind: "statewide" } },
        {
          now: NOW_ANCHOR,
          places,
        },
      ).state;
      expect(whole.units.some((unit) => unit.readyOutOfView !== undefined)).toBe(false);
    });
  }
});
