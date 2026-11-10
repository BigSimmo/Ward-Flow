import { describe, expect, it } from "vitest";

/**
 * PR #1583 review: the discharge checklist and follow-up reply events store the event's time, so a
 * time that is not a real instant is refused; and a checklist tick is refused once the stay has
 * ended, while a community follow-up reply may still arrive after it. Synthetic seed records only.
 */
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const reduce = (state: WardFlowState, event: Record<string, unknown>) =>
  wardFlowReducer(state, { role: "ward", now: NOW_ANCHOR + 5, ...event } as WardFlowEvent);

function occupied(state: WardFlowState) {
  const found = state.admissions.find((admission) => admission.state === "occupied");
  if (!found) throw new Error("the seed has no occupied stay");
  return found;
}

describe("discharge checklist guards", () => {
  it("refuses a tick whose time is not a real instant", () => {
    const before = seedWardFlowState();
    const admission = occupied(before);
    const after = reduce(before, {
      type: "RECORD_DISCHARGE_CHECK",
      now: Number.NaN,
      admissionId: admission.id,
      actingUnitId: admission.unitId,
      item: "carer_told",
      state: "done",
    });
    expect(after.admissions).toBe(before.admissions);
  });

  it("refuses a follow-up reply whose time is not a real instant", () => {
    const before = seedWardFlowState();
    const admission = occupied(before);
    const after = reduce(before, {
      type: "RECORD_FOLLOW_UP_REPLY",
      role: "coordinator",
      now: Number.POSITIVE_INFINITY,
      admissionId: admission.id,
      reply: "accepted",
    });
    expect(after.admissions).toBe(before.admissions);
  });

  it("refuses a checklist tick on a stay that has ended", () => {
    const seeded = seedWardFlowState();
    const admission = occupied(seeded);
    const before: WardFlowState = {
      ...seeded,
      admissions: seeded.admissions.map((candidate) =>
        candidate.id === admission.id ? { ...candidate, state: "departed", leftAt: NOW_ANCHOR } : candidate,
      ),
    };
    const after = reduce(before, {
      type: "RECORD_DISCHARGE_CHECK",
      admissionId: admission.id,
      actingUnitId: admission.unitId,
      item: "carer_told",
      state: "done",
    });
    expect(after.admissions).toBe(before.admissions);
    // The control: the same tick on the stay while it is still in a bed is recorded.
    const recorded = reduce(seeded, {
      type: "RECORD_DISCHARGE_CHECK",
      admissionId: admission.id,
      actingUnitId: admission.unitId,
      item: "carer_told",
      state: "done",
    });
    expect(
      recorded.admissions.find((candidate) => candidate.id === admission.id)?.dischargeChecks?.carer_told?.state,
    ).toBe("done");
  });
});
