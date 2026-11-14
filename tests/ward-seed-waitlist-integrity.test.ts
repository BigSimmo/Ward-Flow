import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import { waitlistStands } from "@/components/ward-management/ward-waitlist";

/*
 * D-229 (stress test D1a-E-1): a seeded wait list must be written the way the reducer's
 * own waitlist answer writes it, or the screens that read the live referral and its answer show
 * nothing while the ward shows a wait list. Every scenario, with and without the worked examples.
 */
const seeds = WARD_SCENARIOS.flatMap((scenario) =>
  [false, true].map((workedExamples) => ({
    label: `${scenario}${workedExamples ? " with worked examples" : ""}`,
    state: seedWardFlowState(scenario, { workedExamples }),
  })),
);

describe("seeded wait lists match the reducer's waitlist answer", () => {
  it.each(seeds)("$label: every standing wait list holds a live referral and a waitlisted answer", ({ state }) => {
    const broken = state.movements.flatMap((movement) =>
      movement.closure
        ? []
        : (movement.waitlistedUnitIds ?? [])
            .filter((unitId) => waitlistStands(movement, unitId))
            .filter(
              (unitId) =>
                !movement.referredUnitIds.includes(unitId) ||
                !(movement.referralAnswerHistory ?? []).some(
                  (answer) => answer.unitId === unitId && answer.answer === "waitlisted",
                ),
            )
            .map((unitId) => `${movement.id} at ${unitId}`),
    );
    expect(broken).toEqual([]);
  });

  it.each(seeds)("$label: within the parallel referral limit", ({ state }) => {
    const over = state.movements.filter(
      (movement) => (movement.waitlistedUnitIds?.length ?? 0) > state.configuration.parallelReferralCap,
    );
    expect(over.map((movement) => movement.id)).toEqual([]);
  });
});
