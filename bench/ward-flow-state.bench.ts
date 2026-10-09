import { bench, describe } from "vitest";

import { networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import { stageSummaries, unitCapacity } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Synthetic seeded state, built once so each benchmark measures only the operation under test.
const seeded = seedWardFlowState();
const stored: unknown = JSON.parse(JSON.stringify(seeded));
const serialised = JSON.stringify(seeded);
// WF-009 is referred to a Male-only ward, so record its gender as the reducer tests do. Clear
// its historical declines so this benchmark measures successful referrals rather than rejections.
const referable = {
  ...seeded,
  movements: seeded.movements.map((movement) =>
    movement.id === "WF-009" ? { ...movement, gender: "Male" as const, declines: [] } : movement,
  ),
};

describe("ward flow state", () => {
  bench("seed the standard scenario", () => {
    seedWardFlowState();
  });

  bench("reduce a referral to two units", () => {
    wardFlowReducer(referable, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: "WF-009",
      unitIds: ["rph-adult-secure", "fsh-adult-secure"],
    });
  });

  bench("reduce a referral refused above the parallel cap", () => {
    wardFlowReducer(referable, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: "WF-009",
      unitIds: ["rph-adult-secure", "fsh-adult-secure", "rgh-adult-secure", "gry-adult-secure"],
    });
  });

  bench("validate stored state", () => {
    isValidStoredWardFlowState(stored);
  });

  bench("restore stored state from JSON", () => {
    isValidStoredWardFlowState(JSON.parse(serialised));
  });
});

describe("ward flow derivations", () => {
  bench("stage summaries", () => {
    stageSummaries(seeded.movements);
  });

  bench("unit capacity for every unit", () => {
    for (const unit of seeded.units) unitCapacity(unit, seeded.bedReleases);
  });

  bench("network ward rows", () => {
    networkWardRows(seeded.units, NOW_ANCHOR, seeded.bedReleases, seeded.admissions, seeded.leaveBeds);
  });
});
