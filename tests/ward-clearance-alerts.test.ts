import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import type { Movement } from "../src/components/ward-management/ward-model";
import { wardClearanceAlerts } from "../src/components/ward-management/ward/ward-clearance-alerts";

const base = seedWardFlowState().movements[0];
const unitId = "unit-a";

function movement(patch: Partial<Movement>): Movement {
  return { ...base, acceptedUnitId: unitId, referredUnitIds: [], closure: undefined, ...patch };
}

describe("wardClearanceAlerts", () => {
  it("counts one row per open transfer marked not cleared or with nothing recorded", () => {
    const alerts = wardClearanceAlerts(
      [
        movement({ id: "WF-1", medicalClearance: { cleared: false, at: 0 } }),
        movement({ id: "WF-2", medicalClearance: undefined }),
        movement({ id: "WF-3", medicalClearance: undefined }),
        movement({ id: "WF-4", medicalClearance: { cleared: true, at: 0 } }),
      ],
      unitId,
    );
    expect(alerts.missing.map((m) => m.id)).toEqual(["WF-1"]);
    expect(alerts.unrecorded.map((m) => m.id)).toEqual(["WF-2", "WF-3"]);
    expect(alerts.count).toBe(3);
  });

  // Codex review on #584: a closed transfer still marked not cleared held the Notices badge above zero.
  it("leaves out closed transfers, so the badge can reach zero", () => {
    const closure = { at: 0, outcome: "arrived" as const, reason: "Arrived" };
    const alerts = wardClearanceAlerts(
      [
        movement({ id: "WF-1", closure, medicalClearance: { cleared: false, at: 0 } }),
        movement({ id: "WF-2", closure, medicalClearance: undefined }),
      ],
      unitId,
    );
    expect(alerts).toEqual({ missing: [], unrecorded: [], count: 0 });
  });

  it("ignores transfers for another ward", () => {
    const alerts = wardClearanceAlerts(
      [movement({ acceptedUnitId: "unit-b", medicalClearance: { cleared: false, at: 0 } })],
      unitId,
    );
    expect(alerts.count).toBe(0);
  });
});
