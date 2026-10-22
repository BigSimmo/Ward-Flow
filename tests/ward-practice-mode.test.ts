import { describe, expect, it } from "vitest";

import { PRACTICE_STEPS, practiceProgress } from "@/components/ward-management/demo-reset/ward-practice-steps";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";

function fixture() {
  const state = seedWardFlowState();
  const startedWith = new Set(state.movements.map((movement) => movement.id));
  const [unitA, unitB] = state.units;
  const fresh = (patch: Partial<Movement>): Movement => ({
    ...state.movements[0]!,
    id: "MV-practice" as Movement["id"],
    openedAt: 10_000,
    stage: "placement_requested",
    stageChanges: [],
    referredUnitIds: [],
    declines: [],
    withdrawnReferrals: [],
    waitlistedUnitIds: undefined,
    acceptedUnitId: undefined,
    transport: undefined,
    closure: undefined,
    ...patch,
  });
  return { state, startedWith, unitA: unitA!, unitB: unitB!, fresh };
}

describe("practiceProgress", () => {
  it("waits for a new bed request and ignores the ones that existed at the start", () => {
    const f = fixture();
    const progress = practiceProgress(f.state.movements, f.startedWith);
    expect(progress.movementId).toBeUndefined();
    expect(progress.next).toBe("raise");
    expect(Object.values(progress.done).some(Boolean)).toBe(false);
  });

  it("ticks raise, then needs two wards asked before ask is done", () => {
    const f = fixture();
    const one = practiceProgress([...f.state.movements, f.fresh({ referredUnitIds: [f.unitA.id] })], f.startedWith);
    expect(one).toMatchObject({ movementId: "MV-practice", next: "ask" });
    const two = practiceProgress(
      [
        ...f.state.movements,
        f.fresh({
          referredUnitIds: [f.unitA.id],
          declines: [{ unitId: f.unitB.id, at: 10_010, reason: "no_suitable_bed" } as Movement["declines"][number]],
        }),
      ],
      f.startedWith,
    );
    expect(two.done.ask).toBe(true);
    expect(two.next).toBe("accept");
  });

  it("finishes when the practice request has been held, transported and arrived", () => {
    const f = fixture();
    const progress = practiceProgress(
      [
        ...f.state.movements,
        f.fresh({
          stage: "arrived",
          referredUnitIds: [f.unitA.id, f.unitB.id],
          acceptedUnitId: f.unitA.id,
          stageChanges: [
            { at: 10_050, to: "pulled", by: "ward" },
            { at: 10_100, to: "arrived", by: "ward" },
          ],
          transport: { id: "TJ-1", provider: "Ambulance service", escortRequired: false } as Movement["transport"],
        }),
      ],
      f.startedWith,
    );
    expect(progress.next).toBeUndefined();
    expect(PRACTICE_STEPS.every((step) => progress.done[step.id])).toBe(true);
  });
});
