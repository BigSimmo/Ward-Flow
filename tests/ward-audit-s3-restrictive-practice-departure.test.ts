// tests/ward-audit-s3-restrictive-practice-departure.test.ts
//
// Fresh audit S-3 (26 Oct 2026): a stay cannot leave its ward while seclusion or restraint is still
// recorded as in use for it, and an episode whose patient has left does not hold the room.
import { describe, expect, it } from "vitest";

import { seclusionRoomView } from "@/components/ward-management/restrictive-practice/restrictive-practice-view";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR + 5;

function apply(state: WardFlowState, event: Record<string, unknown>) {
  return wardFlowReducer(state, { now: NOW, ...event } as never);
}

function leaving(admission: { id: string; unitId: string }) {
  return {
    type: "RECORD_LEAVING",
    role: "ward",
    actingUnitId: admission.unitId,
    admissionId: admission.id,
    leavingDestination: "discharged-to-the-community",
  };
}

function discharge(state: WardFlowState, admission: { id: string; unitId: string; patientId: string | null }) {
  return {
    type: "RECORD_PATIENT_DISCHARGE",
    role: "ward",
    actingUnitId: admission.unitId,
    admissionId: admission.id,
    patientId: admission.patientId,
    expectedGeneration: state.worldGeneration,
    expectedRevision: state.dischargeRevisions[admission.id] ?? 0,
    leavingDestination: "discharged-to-the-community",
  };
}

// A stay the seed lets leave today, so the only new refusal is the open episode.
function leavableStay() {
  const state = seedWardFlowState();
  const stay = state.admissions.find(
    (admission) =>
      admission.state === "occupied" &&
      admission.patientId !== null &&
      apply(state, leaving(admission)).rejections.length === state.rejections.length,
  );
  if (!stay) throw new Error("the seed has no stay that may leave");
  return { state, stay };
}

function secluded(state: WardFlowState, stay: { id: string; unitId: string }) {
  return apply(state, {
    type: "RECORD_RESTRICTIVE_PRACTICE_START",
    role: "ward",
    unitId: stay.unitId,
    actingUnitId: stay.unitId,
    admissionId: stay.id,
    practice: "seclusion",
    startedAt: NOW - 20,
  });
}

describe("audit S-3: leaving with seclusion or restraint still in use", () => {
  it("refuses Has left until the ward records when the seclusion ended", () => {
    const { state, stay } = leavableStay();
    const started = secluded(state, stay);
    const refused = apply(started, leaving(stay));
    expect(refused.rejections.at(-1)?.reason).toBe(
      "Seclusion is still recorded as in use for this patient. Record when it ended before they leave the ward",
    );
    expect(refused.admissions.find((admission) => admission.id === stay.id)?.state).toBe("occupied");

    const episode = started.units.find((unit) => unit.id === stay.unitId)!.restrictivePractice!.episodes[0]!;
    const ended = apply(started, {
      type: "RECORD_RESTRICTIVE_PRACTICE_END",
      role: "ward",
      unitId: stay.unitId,
      actingUnitId: stay.unitId,
      episodeId: episode.id,
      endedAt: NOW - 5,
    });
    const left = apply(ended, leaving(stay));
    expect(left.rejections).toHaveLength(ended.rejections.length);
    expect(left.admissions.find((admission) => admission.id === stay.id)?.state).toBe("departed");
  });

  it("refuses the recorded discharge the same way", () => {
    const { state, stay } = leavableStay();
    const started = secluded(state, stay);
    const refused = apply(started, discharge(started, stay));
    expect(refused.admissions.find((admission) => admission.id === stay.id)?.state).toBe("occupied");
    expect(JSON.stringify([refused.auditEvents.at(-1), refused.rejections.at(-1)])).toContain(
      "Seclusion is still recorded as in use for this patient",
    );
  });

  it("does not count a seclusion as holding the room once its patient has left", () => {
    const { state, stay } = leavableStay();
    const record = secluded(state, stay).units.find((unit) => unit.id === stay.unitId)!.restrictivePractice;
    expect(seclusionRoomView(record, () => true).kind).toBe("in_use");
    expect(seclusionRoomView(record, () => false).kind).toBe("not_recorded");
  });
});
