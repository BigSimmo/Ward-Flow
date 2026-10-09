import { describe, expect, it } from "vitest";

import { buildCensus } from "@/components/ward-management/search/patient-census";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

const NOW = 642;
const DAY_ZERO = new Date("2026-10-01T00:00:00+08:00");

function census(state: ReturnType<typeof seedWardFlowState>) {
  return buildCensus({
    movements: state.movements,
    referrals: state.referrals,
    units: state.units,
    patients: state.patients,
    admissions: state.admissions,
    now: NOW,
    dayZero: DAY_ZERO,
  });
}

describe("patient census", () => {
  it("gives one row per record key", () => {
    const keys = census(seedWardFlowState()).rows.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("shows a ward patient on an open transfer once, as the movement", () => {
    const seed = seedWardFlowState();
    const occupied = seed.admissions.find((admission) => admission.state === "occupied");
    const open = seed.movements.find(isOpen);
    expect(occupied).toBeDefined();
    expect(open).toBeDefined();
    const state = {
      ...seed,
      movements: seed.movements.map((movement) =>
        movement.id === open!.id ? { ...movement, sourceAdmissionId: occupied!.id } : movement,
      ),
    };
    const rows = census(state).rows;
    expect(rows.some((row) => row.key === `adm:${occupied!.id}`)).toBe(false);
    expect(rows.some((row) => row.key === open!.id)).toBe(true);
  });
});
