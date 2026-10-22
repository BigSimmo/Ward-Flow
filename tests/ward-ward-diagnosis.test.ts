import { describe, expect, it } from "vitest";

/**
 * FD-10 (owner, 29 Aug 2026): a ward records its own tentative diagnosis block beside the
 * referrer's and never over it. Both stay on the record, each with its own role and time.
 */
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";

function stay(state: WardFlowState) {
  const found = state.admissions.find((admission) => admission.state === "occupied");
  if (!found) throw new Error("the seed has no occupied stay");
  return found;
}

function record(state: WardFlowState, fields: Partial<Extract<WardFlowEvent, { type: "RECORD_WARD_DIAGNOSIS" }>>) {
  const admission = stay(state);
  return wardFlowReducer(state, {
    type: "RECORD_WARD_DIAGNOSIS",
    role: "ward",
    now: NOW_ANCHOR + 5,
    actingUnitId: admission.unitId,
    admissionId: admission.id,
    block: "F20–F29",
    ...fields,
  } as WardFlowEvent);
}

describe("RECORD_WARD_DIAGNOSIS", () => {
  it("records the ward's block with its role and time, and leaves the referrer's block alone", () => {
    const before = seedWardFlowState();
    const admission = stay(before);
    const after = record(before, {});
    const updated = after.admissions.find((candidate) => candidate.id === admission.id)!;
    expect(updated.wardDiagnosis).toEqual({ block: "F20–F29", recordedAt: NOW_ANCHOR + 5, recordedBy: "ward" });
    expect(updated.tentativeDiagnosis).toBe(admission.tentativeDiagnosis);
    expect(after.rejections).toHaveLength(before.rejections.length);
  });

  it("refuses a block off the list, another ward's stay, a repeat and a desk other than the ward or coordinator", () => {
    const before = seedWardFlowState();
    const recorded = record(before, {});
    const cases: [WardFlowState, Partial<Extract<WardFlowEvent, { type: "RECORD_WARD_DIAGNOSIS" }>>][] = [
      [before, { block: "Psychosis" as never }],
      [before, { actingUnitId: "some-other-ward" }],
      [recorded, {}],
      [before, { role: "ed" }],
    ];
    for (const [state, fields] of cases) {
      const after = record(state, fields);
      expect(after.admissions).toEqual(state.admissions);
    }
  });

  it("survives a save and reload, and a stored block off the list is refused", () => {
    const after = record(seedWardFlowState(), {});
    const saved = JSON.parse(JSON.stringify(after));
    expect(isValidStoredWardFlowState(saved)).toBe(true);
    const tampered = JSON.parse(JSON.stringify(after)) as typeof after;
    const target = tampered.admissions.find((admission) => admission.wardDiagnosis)!;
    Object.assign(target.wardDiagnosis!, { block: "typed words" });
    expect(isValidStoredWardFlowState(tampered)).toBe(false);
  });
});
