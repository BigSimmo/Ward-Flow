import { describe, expect, it } from "vitest";
import { localCommandOutcome } from "@/components/ward-management/use-local-command-completion";
import {
  seedWardFlowStateAt,
  wardFlowReducer,
  type WardFlowState,
} from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";

/** WF-009 made an adult man, and FSH Adult Secure given another cohort, so only RPH suits him. */
function onlyOneWardSuits(): WardFlowState {
  const seeded = seedWardFlowStateAt(0);
  const movement = seeded.movements.find((row) => row.id === "WF-009")!;
  const otherCohort = seeded.units.find((unit) => unit.cohort !== movement.cohort)!.cohort;
  return {
    ...seeded,
    movements: seeded.movements.map((row) => (row.id === "WF-009" ? { ...row, gender: "Male" } : row)),
    units: seeded.units.map((unit) => (unit.id === "fsh-adult-secure" ? { ...unit, cohort: otherCohort } : unit)),
  };
}

const refer = (unitIds: string[]) =>
  ({ type: "REFER_TO_UNITS", role: "coordinator", now: NOW_ANCHOR, movementId: "WF-009", unitIds }) as WardFlowEvent;

describe("the local board's answer to Refer to wards (audit E-05)", () => {
  it("is accepted with the held-back ward's reason when only some wards were referred", () => {
    const before = onlyOneWardSuits();
    const next = wardFlowReducer(before, refer(["rph-adult-secure", "fsh-adult-secure"]));
    expect(next.movements.find((row) => row.id === "WF-009")?.referredUnitIds).toContain("rph-adult-secure");
    const outcome = localCommandOutcome(before, next);
    expect(outcome.status).toBe("accepted");
    expect(outcome.partly).toBe(next.rejections.at(-1)?.reason);
    expect(outcome.partly).toMatch(/FSH Adult Secure/u);
  });

  it("stays refused when no ward could be referred, and carries no note when every ward was", () => {
    const before = onlyOneWardSuits();
    const refused = wardFlowReducer(before, refer(["fsh-adult-secure"]));
    expect(localCommandOutcome(before, refused)).toMatchObject({ status: "refused" });
    expect(localCommandOutcome(before, refused).partly).toBeUndefined();
    const accepted = wardFlowReducer(before, refer(["rph-adult-secure"]));
    expect(localCommandOutcome(before, accepted).status).toBe("accepted");
    expect(localCommandOutcome(before, accepted).partly).toBeUndefined();
  });
});
