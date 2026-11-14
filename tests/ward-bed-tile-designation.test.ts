import { describe, expect, it } from "vitest";

import type { Admission } from "@/components/ward-management/ward-admissions";
import { demoDayZero } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Unit } from "@/components/ward-management/ward-model";
import { createPatientResolver } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardBedRoster } from "@/components/ward-management/ward/ward-screen-derivations";

/**
 * Finding B4 (14 Nov 2026): on a mixed ward a bed tile's Locked/Open tag follows what sits on it,
 * never the tile's place. A stay's tile takes its recorded bed kind; free tiles share the locked beds
 * left over, so the Locked tiles still number the ward's locked beds. Synthetic seed records only.
 */

const state = seedWardFlowState();
const template = state.admissions.find((admission) => admission.state === "occupied")!;

/** A small mixed ward: three beds, bed 1 locked by number, beds 2 and 3 open. */
function mixedWard(): Unit {
  const seedUnit = state.units.find((unit) => unit.id === template.unitId)!;
  return {
    ...seedUnit,
    beds: 3,
    lockedBeds: 1,
    closedBeds: [],
    releasedPullSpans: [],
    seatHistoryStays: undefined,
  };
}

function stay(id: string, bedKind: "locked" | "open", bedNumber: number, unitId: string): Admission {
  return { ...template, id, unitId, state: "occupied", bedKind, bedNumber, movementId: null, referralId: null };
}

function roster(unit: Unit, admissions: Admission[]) {
  return wardBedRoster({
    unit,
    unitLeaveBeds: [],
    admissions,
    bedReleases: [],
    states: { ready: 1, pulled: 0, closed: 0, occupied: 2, beingMadeReady: 0, onLeave: 0 },
    accepted: [],
    movements: [],
    resolvePatientIdentity: createPatientResolver(state),
    now: NOW_ANCHOR,
    criteriaLedOn: false,
    patients: state.patients,
    plannedAdmissions: state.plannedAdmissions,
    dayZero: demoDayZero(new Date("2026-10-19T00:00:00Z")),
    wardReferralInbox: () => [],
  }).bedsList;
}

describe("Ward bed tiles — Locked/Open follows what sits on the tile (B4)", () => {
  it("tags the only free bed Open when the ward's one locked bed is held by a locked stay", () => {
    const unit = mixedWard();
    // The locked stay sits in bed 3 (it overflowed there), the open stay in bed 2: bed 1 is free,
    // but the ward's one locked bed is taken, so the free bed is an open bed.
    const beds = roster(unit, [stay("b4-open", "open", 2, unit.id), stay("b4-locked", "locked", 3, unit.id)]);
    const free = beds.find((bed) => bed.status === "ready")!;
    expect(free.bedNumber).toBe(1);
    expect(free).toMatchObject({ designation: "Open", podId: "open" });
    expect(beds.find((bed) => bed.admissionId === "b4-locked")).toMatchObject({
      designation: "Locked",
      podId: "locked",
    });
    expect(beds.find((bed) => bed.admissionId === "b4-open")).toMatchObject({ designation: "Open", podId: "open" });
    expect(beds.filter((bed) => bed.designation === "Locked")).toHaveLength(unit.lockedBeds);
  });

  it("reads exactly as the bed numbers do when the records agree", () => {
    const unit = mixedWard();
    const beds = roster(unit, [stay("b4-locked", "locked", 1, unit.id), stay("b4-open", "open", 2, unit.id)]);
    expect(beds.map((bed) => [bed.bedNumber, bed.designation])).toEqual([
      [1, "Locked"],
      [2, "Open"],
      [3, "Open"],
    ]);
  });
});
