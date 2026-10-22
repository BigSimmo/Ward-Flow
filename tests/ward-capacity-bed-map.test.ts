import { describe, expect, it } from "vitest";

import { bedMapWards, groupBedMapWardsByService, type BedMapWard } from "@/components/ward-management/capacity/bed-map";
import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import {
  bedKindGaps,
  bedKindTotals,
  networkTotals,
  networkWardRows,
} from "@/components/ward-management/capacity/capacity-derivations";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { HEALTH_SERVICES, type BedRelease, type Unit } from "@/components/ward-management/ward-model";
import { wardServiceOrder } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { bedReleases, leaveBeds } from "@/components/ward-management/ward-movements";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import { GENERAL_OBSERVATION } from "../src/components/ward-management/ward-observation";

const NOW = NOW_ANCHOR;
const units = allUnits();

describe("bedMapWards — the bed map's per-ward figures", () => {
  it("has a non-empty population to render, or every assertion below is vacuous", () => {
    expect(units.length).toBeGreaterThan(0);
    expect(bedReleases.length).toBeGreaterThan(0);
  });

  /**
   * ⚠️ THE PARTITION THIS WHOLE MAP DEPENDS ON. `unitCapacity` is documented (see its own callers in
   * `ward-board.tsx` and `ward-management-network.tsx`) to split every unit into four figures that
   * sum to `unit.beds`; this pins that as a fact about today's real fixture rather than trusting the
   * documentation alone, because the bed map draws exactly `unit.beds` squares per ward and a
   * mismatch here would mean it draws the wrong number.
   */
  it("sums available + held + blocked + occupied to unit.beds, for every real unit", () => {
    for (const unit of units) {
      const capacity = unitCapacity(unit, bedReleases);
      const total = capacity.available + capacity.held + capacity.blocked + capacity.occupied;
      expect(total, `${unit.id}: partition sums to ${total}, not ${unit.beds} beds`).toBe(unit.beds);
    }
  });

  it("reads every figure from bedStates/bedsPendingPreparation and counts nothing of its own", () => {
    const wards = bedMapWards(units, bedReleases, wardAdmissions, leaveBeds);
    expect(wards.length).toBe(units.length);
    for (const ward of wards) {
      const states = bedStates(ward.unit, wardAdmissions, bedReleases, leaveBeds);
      expect(ward.ready, ward.unit.id).toBe(unitCapacity(ward.unit, bedReleases).available);
      expect(ward.ready, ward.unit.id).toBe(states.ready);
      expect(ward.pulled, ward.unit.id).toBe(states.pulled);
      expect(ward.closed, ward.unit.id).toBe(states.closed);
      expect(ward.occupied, ward.unit.id).toBe(states.occupied);
      expect(ward.onLeave, ward.unit.id).toBe(states.onLeave);
      expect(ward.ready + ward.pulled + ward.closed + ward.occupied, ward.unit.id).toBe(ward.unit.beds);
      expect(ward.pendingPreparation, ward.unit.id).toBe(bedsPendingPreparation(ward.unit.id, bedReleases));
    }
  });

  it("without admissions, counts no bed as Pulled and leaves Occupied as unitCapacity reports it", () => {
    for (const ward of bedMapWards(units, bedReleases)) {
      const capacity = unitCapacity(ward.unit, bedReleases);
      expect(ward.pulled, ward.unit.id).toBe(0);
      expect(ward.closed, ward.unit.id).toBe(capacity.held + capacity.blocked);
      expect(ward.occupied, ward.unit.id).toBe(capacity.occupied);
    }
  });

  /**
   * 🔴 A bed cannot be "still being made ready" without being one of the ready beds. Floored on the
   * population actually containing a preparing ward, or this would pass by never being exercised —
   * `capacity-derivations.ts`'s own doc comment names `arm-adult-open` as the seeded case.
   */
  it("never has more beds pending preparation than are ready, for every real ward", () => {
    // The seed marks no bed as being made ready (a preparation note is never guessed; coordinator
    // decision 25 Sept 2026), so a ward records one here, on a real stay that has already left.
    const seeded = seedWardFlowState();
    const left = seeded.bedReleases.find((release) => release.state === "discharged");
    if (!left) throw new Error("the seed has no stay that has left, so nothing can be made ready");
    const recorded = wardFlowReducer(seeded, {
      type: "SET_BED_PREPARATION",
      role: "ward",
      now: NOW_ANCHOR,
      releaseId: left.id,
      actingUnitId: left.unitId,
      preparing: true,
    });
    const wards = bedMapWards(units, recorded.bedReleases);
    const preparingWards = wards.filter((ward) => ward.pendingPreparation > 0);
    expect(
      preparingWards.length,
      "no ward has a bed pending preparation — this guard would be vacuous",
    ).toBeGreaterThan(0);
    for (const ward of wards) {
      expect(ward.pendingPreparation, ward.unit.id).toBeLessThanOrEqual(ward.ready);
    }
  });

  it("retains preparation records beyond offered capacity without fabricating ready beds", () => {
    const brokenUnit: Unit = {
      ...units[0],
      id: "test-broken-unit",
      name: "Test Broken Unit",
      beds: 4,
      empty: { ...units[0].empty, value: 1 },
      allocatable: { ...units[0].allocatable, value: 1 },
    };
    const brokenReleases: BedRelease[] = [
      {
        id: "test-release-1",
        unitId: "test-broken-unit",
        admissionId: "AD-TEST-01",
        state: "discharged",
        expectedAt: NOW,
        waitingOn: null,
        blocker: null,
        blockedBy: null,
        preparing: true,
        preparationNote: null,
        confirmedAt: NOW,
        confirmedBy: "Test fixture",
      },
      {
        id: "test-release-2",
        unitId: "test-broken-unit",
        admissionId: "AD-TEST-02",
        state: "discharged",
        expectedAt: NOW,
        waitingOn: null,
        blocker: null,
        blockedBy: null,
        preparing: true,
        preparationNote: null,
        confirmedAt: NOW,
        confirmedBy: "Test fixture",
      },
    ];
    // `available` for this unit is 1 (min(1, 1)); two preparing releases exceed it.
    const ward = bedMapWards([brokenUnit], brokenReleases)[0];
    expect(ward.pendingPreparation).toBe(2);
    expect(ward.ready).toBe(1);
    expect(ward.ready + ward.pulled + ward.closed + ward.occupied).toBe(brokenUnit.beds);
  });

  /** The map and table must retain the same Ready population for identical inputs. */
  it("agrees with the network table's own ready figure for every real ward, today", () => {
    const wards = bedMapWards(units, bedReleases);
    const tableRows = networkWardRows(units, NOW, bedReleases);
    expect(wards.length).toBe(tableRows.length);
    for (const ward of wards) {
      const row = tableRows.find((candidate) => candidate.unit.id === ward.unit.id);
      expect(row, ward.unit.id).toBeDefined();
      expect(ward.ready, `${ward.unit.id}: bed map and network table disagree on Ready`).toBe(row?.ready);
    }
  });

  it("keeps a last-bed pull out of unmet demand and reconciles a later capacity confirmation", () => {
    let state = seedWardFlowState();
    const unitId = "scgh-adult-open";
    const existingPulls = state.admissions.filter(
      (admission) => admission.unitId === unitId && admission.state === "pulled",
    );
    const existingLivePulls = existingPulls.filter((admission) => admission.movementId !== null).length;
    state = wardFlowReducer(state, {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId: "jhc-ed",
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
    state = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId,
      unitIds: [unitId],
    });
    state = wardFlowReducer(state, { type: "ACCEPT_IN_PRINCIPLE", role: "ward", now: NOW, movementId, unitId });
    const unit = () => state.units.find((candidate) => candidate.id === unitId)!;
    const confirm = (value: number) => {
      state = wardFlowReducer(state, {
        type: "CONFIRM_CAPACITY",
        role: "ward",
        now: NOW,
        unitId,
        actingUnitId: unitId,
        expectedRevision: unit().allocatable.revision ?? 0,
        value,
      });
    };
    confirm(1);
    state = wardFlowReducer(state, { type: "PULL_PATIENT", role: "ward", now: NOW, movementId, unitId });
    expect(state.rejections).toEqual([]);
    expect(unit().allocatable.value).toBe(0);
    expect(
      bedKindTotals(
        bedKindGaps(
          state.movements.filter((movement) => movement.id === movementId),
          [unit()],
          NOW,
        ),
      ),
    ).toEqual({ waiting: 0, bedsThatFit: 0, gap: 0 });

    // A newer ward observation can disagree with the reservation without erasing it. The
    // display must partition it once while retaining the exact observed empty/offered figures.
    const empty = structuredClone(unit().empty);
    confirm(empty.value);
    expect(state.rejections).toEqual([]);
    expect(unit().allocatable.value).toBe(empty.value);
    expect(unit().empty).toEqual(empty);
    const rows = networkWardRows([unit()], NOW, state.bedReleases, state.admissions, state.leaveBeds);
    const [row] = rows;
    const [map] = bedMapWards([unit()], state.bedReleases, state.admissions, state.leaveBeds);
    expect(row.ready).toBe(empty.value - existingLivePulls - 1);
    expect(row.pulled).toBe(existingPulls.length + 1);
    expect(row.ready + row.pulled + row.closed + row.occupied).toBe(unit().beds);
    expect([row.ready, row.pulled, row.closed, row.occupied]).toEqual([
      map.ready,
      map.pulled,
      map.closed,
      map.occupied,
    ]);
    expect(networkTotals(rows).ready).toBe(map.ready);
    const movements = state.movements.filter((movement) => movement.id === movementId);
    expect(bedKindTotals(bedKindGaps(movements, [unit()], NOW, state.admissions))).toEqual({
      waiting: 0,
      bedsThatFit: map.ready,
      gap: map.ready,
    });
    for (const horizon of bedsForecast([unit()], [], state.admissions, movements, NOW).horizons) {
      expect(horizon.readyNow).toBe(map.ready);
      expect(horizon.waitingForBed).toBe(0);
    }
  });
});

describe("groupBedMapWardsByService — grouping ward blocks by health service", () => {
  const wards: BedMapWard[] = bedMapWards(units, bedReleases);

  it("has a non-empty population to render, or every assertion below is vacuous", () => {
    expect(wards.length).toBeGreaterThan(0);
  });

  it("returns one group per member of wardServiceOrder, in that order", () => {
    const groups = groupBedMapWardsByService(wards);
    expect(groups.map((group) => group.service)).toEqual(wardServiceOrder);
    // wardServiceOrder must itself be every member of HEALTH_SERVICES — see that constant's own
    // doc comment on the defect class of a service silently missing from a hand-written copy.
    expect(new Set(groups.map((group) => group.service))).toEqual(new Set(HEALTH_SERVICES));
  });

  it("places every real ward in exactly one group, losing none and duplicating none", () => {
    const groups = groupBedMapWardsByService(wards);
    const placed = groups.flatMap((group) => group.wards.map((ward) => ward.unit.id));
    expect(placed.length, "a ward is missing from every group, or counted more than once").toBe(wards.length);
    expect(new Set(placed).size).toBe(wards.length);
  });

  /**
   * 🔴 **CORRECTS A CLAIM IN THIS TASK'S OWN BUILD BRIEF.** The brief that asked for this map stated
   * "WACHS has no inpatient unit reporting to this board." Checked directly against `ward-sites.ts`
   * rather than trusted: WACHS carries five units today (Albany, Bunbury, Broome, Geraldton,
   * Kununurra), all with real bed counts, and `ward-management-network.tsx`'s own service clusters
   * already render all five without any empty-group handling. This test is the self-invalidating
   * pin the finding needs — it goes red the day WACHS genuinely has no unit, which is the one day
   * `ServiceGroup`'s absence branch (bed-map.tsx) needs to actually run against real data instead of
   * only the synthetic fixture in `ward-capacity-bed-map.dom.test.tsx`.
   *
   * That day came for CAHS, not WACHS (owner ruling 2026-09-25): Perth Children's moved under CAHS,
   * and it has an emergency department and no adult mental health ward (`units: []` in
   * `ward-sites.ts`). So the pin now names the one empty service exactly, and goes red if any other
   * service empties or CAHS gains a ward.
   */
  it("has at least one real ward for every service in the current fixture except CAHS, WACHS included", () => {
    const groups = groupBedMapWardsByService(wards);
    expect(groups.filter((group) => group.wards.length === 0).map((group) => group.service)).toEqual(["CAHS"]);
    for (const group of groups.filter((entry) => entry.service !== "CAHS")) {
      expect(group.wards.length, `${group.service} has no ward in today's fixture`).toBeGreaterThan(0);
    }
  });

  it("throws rather than silently placing a ward whose site code does not resolve", () => {
    const orphanWard: BedMapWard = {
      unit: { ...wards[0].unit, id: "test-orphan-unit", siteCode: "NOT-A-REAL-SITE" },
      ready: 0,
      pulled: 0,
      closed: 0,
      occupied: 0,
      onLeave: 0,
      pendingPreparation: 0,
    };
    expect(() => groupBedMapWardsByService([orphanWard])).toThrow(/no site matches/iu);
  });
});
