// tests/ward-audit-s5-repatriation-source-discharge.test.ts
//
// Fresh audit S-5 (26 Oct 2026): a stay cannot leave while the return journey it sends is still
// open, so the home ward never keeps a held bed for someone already discharged.
import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR + 5;
const REFUSAL =
  "A return to the home hospital is still open for this patient. Release or withdraw it before they leave the ward";

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

// A stay the seed lets leave today, with an agreed return journey open for it.
function stayWithOpenReturn() {
  const seeded = seedWardFlowState();
  const stay = seeded.admissions.find(
    (admission) =>
      admission.state === "occupied" &&
      admission.patientId !== null &&
      !admission.unitId.startsWith("rph-") &&
      apply(seeded, leaving(admission)).rejections.length === seeded.rejections.length,
  );
  if (!stay) throw new Error("the seed has no stay that may leave");
  const state = apply(seeded, {
    type: "RECORD_REPATRIATION",
    role: "coordinator",
    admissionId: stay.id,
    homeHospital: "RPH",
    receivingWardAgreed: true,
    mode: "road",
    provider: "Ambulance service",
    cadNumber: "SYN-CAD-AUDIT-0005",
    transportLegalStatus: "voluntary",
    estimatedAt: NOW + 120,
  });
  expect(state.rejections).toHaveLength(seeded.rejections.length);
  const returning = state.movements.at(-1)!;
  expect(returning.sourceAdmissionId).toBe(stay.id);
  return { state, stay, returning };
}

describe("audit S-5: leaving while a return journey is open", () => {
  it("refuses Has left while the return is open", () => {
    const { state, stay } = stayWithOpenReturn();
    const refused = apply(state, leaving(stay));
    expect(refused.rejections.at(-1)?.reason).toBe(REFUSAL);
    expect(refused.admissions.find((admission) => admission.id === stay.id)?.state).toBe("occupied");
  });

  it("refuses the recorded discharge the same way", () => {
    const { state, stay } = stayWithOpenReturn();
    const refused = apply(state, {
      type: "RECORD_PATIENT_DISCHARGE",
      role: "ward",
      actingUnitId: stay.unitId,
      admissionId: stay.id,
      patientId: stay.patientId,
      expectedGeneration: state.worldGeneration,
      expectedRevision: state.dischargeRevisions[stay.id] ?? 0,
      leavingDestination: "discharged-to-the-community",
    });
    expect(refused.admissions.find((admission) => admission.id === stay.id)?.state).toBe("occupied");
    expect(JSON.stringify([refused.auditEvents.at(-1), refused.rejections.at(-1)])).toContain(REFUSAL);
  });

  it("lets the stay leave once the return is closed", () => {
    const { state, stay, returning } = stayWithOpenReturn();
    const closed: WardFlowState = {
      ...state,
      movements: state.movements.map((movement) =>
        movement.id === returning.id
          ? { ...movement, closure: { at: NOW, outcome: "withdrawn", reason: "Return withdrawn" } }
          : movement,
      ),
    } as WardFlowState;
    const left = apply(closed, leaving(stay));
    expect(left.rejections).toHaveLength(closed.rejections.length);
    expect(left.admissions.find((admission) => admission.id === stay.id)?.state).toBe("departed");
  });
});
