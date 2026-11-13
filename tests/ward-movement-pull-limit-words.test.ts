import { describe, expect, it } from "vitest";

import { attentionItems } from "@/components/ward-management/movements/movement-workspace-derivations";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * D-187: a pull is never released automatically; a person releases it. The movement page once said
 * "The pull ran out … The bed may no longer be held", which the engine contradicts: the bed stays
 * pulled after its time limit passes. Synthetic seed data only.
 */
describe("Movement page: a pull past its time limit", () => {
  it("says the time limit passed and the bed stays pulled until someone releases it", () => {
    const state = seedWardFlowState();
    const destination = state.units[0]!;
    const movement = {
      ...state.movements[0]!,
      stage: "pulled" as const,
      acceptedUnitId: destination.id,
      pullExpiresAt: NOW_ANCHOR - 30,
      closure: undefined,
    };
    const pull = attentionItems({
      movement,
      units: state.units,
      now: NOW_ANCHOR,
      thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
      destination,
      open: true,
      blockerIsActive: false,
    }).find((item) => item.key === "pull");
    expect(pull?.say).toMatch(/^The pull time limit passed at .+\. The bed stays pulled until someone releases it\.$/u);
    expect(pull?.say).not.toMatch(/ran out|may no longer be held/u);
  });
});
