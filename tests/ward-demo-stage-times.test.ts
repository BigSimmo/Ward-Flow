import { describe, expect, it } from "vitest";

import { edJourneyStages } from "@/components/ward-management/ed/ed-journey";
import { withDemoStageTimes } from "@/components/ward-management/ward-demo-stage-times";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * v10 pass 3 (10 Oct 2026): seeded movements carry synthetic referral and acceptance times so the
 * Journey strip shows real stages. Synthetic only, derived from each movement's own times.
 */
describe("synthetic seed stage times", () => {
  const seeded = seedWardFlowState().movements;

  it("gives referred seed movements a referral time and accepted ones an acceptance time", () => {
    expect(seeded.filter((movement) => movement.referredAt !== undefined).length).toBeGreaterThan(5);
    expect(seeded.filter((movement) => movement.acceptedAt !== undefined).length).toBeGreaterThan(5);
  });

  it("orders arrival, referral, acceptance and the next recorded step, never after the anchor", () => {
    for (const movement of seeded) {
      if (movement.referredAt === undefined) continue;
      expect(movement.referredAt).toBeGreaterThan(movement.openedAt);
      expect(movement.referredAt).toBeLessThanOrEqual(NOW_ANCHOR);
      if (movement.acceptedAt !== undefined) {
        expect(movement.acceptedAt).toBeGreaterThan(movement.referredAt);
        expect(movement.acceptedAt).toBeLessThanOrEqual(movement.transport?.acceptedAt ?? NOW_ANCHOR);
        expect(movement.acceptedAt).toBeLessThanOrEqual(movement.closure?.at ?? NOW_ANCHOR);
      }
    }
  });

  it("leaves an unreferred movement alone and keeps a time already recorded", () => {
    const unreferred = wardMovements.find(
      (movement) =>
        movement.referredUnitIds.length === 0 &&
        movement.acceptedUnitId === undefined &&
        movement.declines.length === 0,
    );
    if (unreferred) expect(withDemoStageTimes([unreferred], NOW_ANCHOR)[0]).toBe(unreferred);
    const referred = wardMovements.find((movement) => movement.acceptedUnitId !== undefined)!;
    const recorded = { ...referred, referredAt: referred.openedAt + 1 };
    expect(withDemoStageTimes([recorded], NOW_ANCHOR)[0]?.referredAt).toBe(referred.openedAt + 1);
  });

  it("shows more than one Journey stage on an accepted seed movement", () => {
    const accepted = seeded.find(
      (movement) => movement.acceptedAt !== undefined && movement.closure === undefined && !movement.transport,
    );
    const subject = accepted ?? seeded.find((movement) => movement.acceptedAt !== undefined)!;
    const stages = edJourneyStages(subject, undefined, "Now", NOW_ANCHOR);
    expect(stages.map((stage) => stage.label)).toEqual(expect.arrayContaining(["To referral", "Finding a bed"]));
  });
});
