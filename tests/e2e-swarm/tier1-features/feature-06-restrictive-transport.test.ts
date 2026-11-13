import { describe, expect, it } from "vitest";
import { createIsolatedState } from "../helpers/test-harness";
import { wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { openRestrictivePracticeRefusal } from "@/components/ward-management/restrictive-practice/ward-restrictive-practice";

describe("Tier 1 - Feature 06: Restrictive Practice Transport Collection Guard", () => {
  const now = NOW_ANCHOR;

  const send = (state: ReturnType<typeof createIsolatedState>, event: Omit<WardFlowEvent, "now"> & { now?: number }) => {
    return wardFlowReducer(state, { ...event, now: event.now ?? now } as WardFlowEvent);
  };

  it("directly tests openRestrictivePracticeRefusal returns refusal message for active seclusion", () => {
    const refusal = openRestrictivePracticeRefusal(
      {
        episodes: [
          {
            id: "EP-1",
            admissionId: "AD-SEC-1",
            practice: "seclusion",
            startedAt: now - 30,
            endedAt: undefined, // open episode
            recordedAt: now - 30,
            recordedBy: "ward",
          },
        ],
        incidents: [],
      },
      "AD-SEC-1",
    );

    expect(refusal).toBeDefined();
    expect(refusal).toContain("Seclusion is still recorded as in use for this patient");
    expect(refusal).toContain("Record when it ended before they leave the ward");
  });

  it("directly tests openRestrictivePracticeRefusal returns refusal message for active bodily restraint", () => {
    const refusal = openRestrictivePracticeRefusal(
      {
        episodes: [
          {
            id: "EP-2",
            admissionId: "AD-RES-1",
            practice: "bodily_restraint",
            startedAt: now - 45,
            endedAt: undefined, // open episode
            recordedAt: now - 45,
            recordedBy: "ward",
          },
        ],
        incidents: [],
      },
      "AD-RES-1",
    );

    expect(refusal).toBeDefined();
    expect(refusal).toContain("Restraint is still recorded as in use for this patient");
  });

  it("returns undefined when seclusion episode has completed (endedAt is recorded)", () => {
    const refusal = openRestrictivePracticeRefusal(
      {
        episodes: [
          {
            id: "EP-3",
            admissionId: "AD-SEC-1",
            practice: "seclusion",
            startedAt: now - 120,
            endedAt: now - 30, // ended
            recordedAt: now - 120,
            recordedBy: "ward",
          },
        ],
        incidents: [],
      },
      "AD-SEC-1",
    );

    expect(refusal).toBeUndefined();
  });

  it("rejects PATIENT_COLLECTED when sending ward has active open seclusion on source admission", () => {
    let state = createIsolatedState();
    const sourceStay = state.admissions.find((a) => a.state === "occupied")!;
    const sendingUnitId = sourceStay.unitId;
    const destUnitId = "scgh-adult-open";

    // Start seclusion on source stay
    state = send(state, {
      type: "RECORD_RESTRICTIVE_PRACTICE_START",
      role: "ward",
      unitId: sendingUnitId,
      actingUnitId: sendingUnitId,
      admissionId: sourceStay.id,
      practice: "seclusion",
      startedAt: now - 20,
    });

    // Create a transfer movement from this source admission
    const transferMovement = {
      ...state.movements[0]!,
      id: "WF-TRANS-SEC",
      stage: "handover_ready" as const,
      sourceAdmissionId: sourceStay.id,
      acceptedUnitId: destUnitId,
      admissionId: "AD-TEMP-PULLED",
      medicalClearance: { at: now - 10, cleared: true },
      transport: {
        id: "WF-TRANS-SEC-transport",
        provider: "Ambulance service",
        escortRequired: false,
        cadNumber: "CAD-999",
        transportLegalStatus: "voluntary" as const,
        estimatedAt: now + 60,
        acceptedAt: now - 5,
        enRouteAt: now - 2,
        bookedBy: { role: "ed" as const },
      },
    };

    state = {
      ...state,
      movements: [...state.movements, transferMovement],
    };

    // Attempt PATIENT_COLLECTED while seclusion is open
    state = send(state, {
      type: "PATIENT_COLLECTED",
      role: "officer",
      movementId: "WF-TRANS-SEC",
    });

    expect(state.rejections.at(-1)?.attempted).toBe("PATIENT_COLLECTED");
    expect(state.rejections.at(-1)?.reason).toContain("Seclusion is still recorded as in use");

    const m = state.movements.find((x) => x.id === "WF-TRANS-SEC")!;
    expect(m.stage).toBe("handover_ready"); // Not advanced to moving
  });

  it("permits PATIENT_COLLECTED after seclusion end is formally recorded on sending ward", () => {
    let state = createIsolatedState();
    const sourceStay = state.admissions.find((a) => a.state === "occupied")!;
    const sendingUnitId = sourceStay.unitId;
    const destUnitId = "scgh-adult-open";

    // Start seclusion
    state = send(state, {
      type: "RECORD_RESTRICTIVE_PRACTICE_START",
      role: "ward",
      unitId: sendingUnitId,
      actingUnitId: sendingUnitId,
      admissionId: sourceStay.id,
      practice: "seclusion",
      startedAt: now - 60,
    });

    const unitBeforeEnd = state.units.find((u) => u.id === sendingUnitId);
    const episodeId = unitBeforeEnd?.restrictivePractice?.episodes.at(-1)?.id!;

    // End seclusion
    state = send(state, {
      type: "RECORD_RESTRICTIVE_PRACTICE_END",
      role: "ward",
      unitId: sendingUnitId,
      actingUnitId: sendingUnitId,
      episodeId,
      endedAt: now - 10,
    });

    // Verify openRestrictivePracticeRefusal on the unit is now clear
    const unit = state.units.find((u) => u.id === sendingUnitId);
    const refusal = openRestrictivePracticeRefusal(unit?.restrictivePractice, sourceStay.id);
    expect(refusal).toBeUndefined();

    // Now test transport collection with no open restrictive practice
    const transferMovement = {
      ...state.movements[0]!,
      id: "WF-TRANS-CLEAR",
      stage: "handover_ready" as const,
      sourceAdmissionId: sourceStay.id,
      acceptedUnitId: destUnitId,
      admissionId: "AD-TEMP-PULLED-2",
      medicalClearance: { at: now - 10, cleared: true },
      transport: {
        id: "WF-TRANS-CLEAR-transport",
        provider: "Ambulance service",
        escortRequired: false,
        cadNumber: "CAD-999",
        transportLegalStatus: "voluntary" as const,
        estimatedAt: now + 60,
        acceptedAt: now - 5,
        enRouteAt: now - 2,
        bookedBy: { role: "ed" as const },
      },
    };

    state = {
      ...state,
      movements: [...state.movements, transferMovement],
    };

    state = send(state, {
      type: "PATIENT_COLLECTED",
      role: "officer",
      movementId: "WF-TRANS-CLEAR",
    });

    if (state.rejections.length > 0) {
      // If rejected for another reason, fail with that reason
      expect(state.rejections.at(-1)?.reason).toBeUndefined();
    }

    const m = state.movements.find((x) => x.id === "WF-TRANS-CLEAR")!;
    expect(m.stage).toBe("moving");
    expect(m.transport?.collectedAt).toBe(now);
  });
});
