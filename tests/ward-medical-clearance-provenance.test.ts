import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { GENERAL_OBSERVATION } from "../src/components/ward-management/ward-observation";
import { handoverLines } from "@/components/ward-management/legal-forms/legal-forms-view";
import { currentLegalDueAt, formProgression } from "@/components/ward-management/legal-forms/legal-form-progression";
import type { Movement } from "@/components/ward-management/ward-model";

type WithoutNow<T> = T extends unknown ? Omit<T, "now"> : never;
function journey(linked = false) {
  let state = seedWardFlowState();
  const send = (event: WithoutNow<WardFlowEvent>) => {
    state = wardFlowReducer(state, { ...event, now: NOW_ANCHOR } as WardFlowEvent);
  };
  let referralId: string | undefined;
  if (linked) {
    send({
      type: "RECEIVE_REFERRAL",
      role: "community",
      ageBand: "Adult",
      destinations: [{ kind: "emergency_department", edId: "jhc-ed", purpose: "psychiatric_review" }],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "SCGH",
      transportNeeded: false,
      history: "Synthetic review fixture",
    });
    referralId = state.referrals.at(-1)!.id;
    send({ type: "RECORD_MEDICAL_CLEARANCE", role: "ed", referralId, cleared: false });
  }
  send({
    type: "RAISE_REFERRAL",
    role: "ed",
    edId: "jhc-ed",
    ...(referralId ? { referralId } : {}),
    draft: {
      cohort: "Adult",
      security: "Open",
      sex: "Female",
      gender: "Female",
      observation: GENERAL_OBSERVATION,
      highAcuity: false,
      legalStatus: "Voluntary",
      urgency: 2,
      legalFormCode: null,
    },
  });
  const movementId = state.movements.at(-1)!.id;
  const unitId = "scgh-adult-open";
  send({ type: "REFER_TO_UNITS", role: "coordinator", movementId, unitIds: [unitId] });
  send({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId, unitId });
  send({ type: "PULL_PATIENT", role: "ward", movementId, unitId });
  const book = () =>
    send({
      type: "BOOK_TRANSPORT",
      role: "ed",
      movementId,
      provider: "Ambulance service",
      escortRequired: false,
      cadNumber: "SYN-ARRIVAL-1",
      transportLegalStatus: "voluntary",
      estimatedAt: NOW_ANCHOR + 60,
    });
  return {
    send,
    book,
    movementId,
    unitId,
    get state() {
      return state;
    },
  };
}

describe("recorded medical clearance provenance and physical arrival", () => {
  it("inherits an existing false referral clearance and refuses onward booking", () => {
    const j = journey(true);
    expect(j.state.rejections).toHaveLength(0);
    j.book();
    expect(j.state.movements.at(-1)!.transport).toBeUndefined();
    expect(j.state.movements.at(-1)!.medicalClearance?.cleared).toBe(false);
    expect(j.state.rejections.at(-1)!.reason).toContain("Medical clearance");
  });

  it("refuses onward booking when medical clearance is unassessed (undefined)", () => {
    const j = journey();
    expect(j.state.movements.at(-1)!.medicalClearance).toBeUndefined();
    j.book();
    expect(j.state.movements.at(-1)!.transport).toBeUndefined();
    expect(j.state.rejections.at(-1)!.reason).toContain("Medical clearance");
  });

  it("permits onward booking and transit with affirmative clearance, and records arrival despite a later negative clearance", () => {
    const j = journey();
    expect(j.state.movements.at(-1)!.medicalClearance).toBeUndefined();
    j.send({
      type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
      role: "ed",
      movementId: j.movementId,
      cleared: true,
    });
    expect(j.state.movements.at(-1)!.medicalClearance?.cleared).toBe(true);
    j.book();
    expect(j.state.rejections).toHaveLength(0);
    expect(j.state.movements.at(-1)!.transport).toBeDefined();

    for (const event of [
      { type: "HANDOVER_READY", role: "ed" },
      { type: "TRANSPORT_ACCEPTED", role: "officer" },
      { type: "TRANSPORT_EN_ROUTE", role: "officer" },
      { type: "PATIENT_COLLECTED", role: "officer" },
    ] as const)
      j.send({ ...event, movementId: j.movementId });
    expect(j.state.rejections).toHaveLength(0);
    expect(j.state.movements.at(-1)!.transport?.collectedAt).toBe(NOW_ANCHOR);
    j.send({ type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE", role: "ed", movementId: j.movementId, cleared: false });
    j.send({ type: "PATIENT_ARRIVED", role: "ward", movementId: j.movementId, actingUnitId: j.unitId });
    expect(j.state.rejections).toHaveLength(0);
    expect(j.state.movements.at(-1)!.stage).toBe("arrived");
    expect(j.state.movements.at(-1)!.medicalClearance?.cleared).toBe(false);
  });
});

describe("handoverLines expired legal form retention", () => {
  it("retains expired legal orders with alert badge format", () => {
    const expiredMovement: Movement = {
      id: "WF-EXP",
      cohort: "Adult",
      security: "Open",
      sex: "Female",
      gender: "Female",
      observation: GENERAL_OBSERVATION,
      highAcuity: false,
      legalStatus: "Involuntary inpatient",
      legalForm: { code: "3A", kind: "examination", dueAt: NOW_ANCHOR - 90 },
      openedAt: NOW_ANCHOR,
      flaggedUrgent: false,
      urgency: 1,
      blocker: "None",
      statusChanges: [],
      urgencyChanges: [],
      overrides: [],
      stage: "pulled",
      owner: "Bed coordinator",
      referredUnitIds: [],
      declines: [],
      withdrawnReferrals: [],
      unwinds: [],
      stageChanges: [],
    };
    const activeMovement: Movement = {
      ...expiredMovement,
      id: "WF-ACT",
      legalForm: { code: "6A", kind: "detention", dueAt: NOW_ANCHOR + 120 },
    };
    const farFutureMovement: Movement = {
      ...expiredMovement,
      id: "WF-FAR",
      legalForm: { code: "6A", kind: "detention", dueAt: NOW_ANCHOR + 600 },
    };

    const lines = handoverLines(
      [expiredMovement, activeMovement, farFutureMovement],
      NOW_ANCHOR,
      (m) => `Patient ${m.id}`,
      480,
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("⚠️ EXPIRED [2h ago]: Form 3A, Patient WF-EXP");
    expect(lines[1]).toContain("Form 6A, Patient WF-ACT");
  });
});

describe("72-hour assessment countdown retention on ward arrival", () => {
  it("retains countdown clock on ward arrival until formal examination or Form 6A is recorded", () => {
    const arrivedMovement: Movement = {
      id: "WF-ARR",
      cohort: "Adult",
      security: "Open",
      sex: "Female",
      gender: "Female",
      observation: GENERAL_OBSERVATION,
      highAcuity: false,
      legalStatus: "Involuntary inpatient",
      legalForm: { code: "4C", kind: "transfer", dueAt: NOW_ANCHOR + 180 },
      openedAt: NOW_ANCHOR,
      flaggedUrgent: false,
      urgency: 1,
      blocker: "None",
      closure: { at: NOW_ANCHOR, outcome: "arrived", reason: "arrived" },
      statusChanges: [],
      urgencyChanges: [],
      overrides: [],
      stage: "arrived",
      owner: "Bed coordinator",
      referredUnitIds: [],
      declines: [],
      withdrawnReferrals: [],
      unwinds: [],
      stageChanges: [],
    };

    // Before examination, 72h assessment clock is still ticking
    expect(formProgression(arrivedMovement)?.endedWhen).toBe("at arrival");
    expect(currentLegalDueAt(arrivedMovement)).toBe(NOW_ANCHOR + 180);

    // After examination is recorded, the transfer form deadline is ended
    const examinedMovement: Movement = {
      ...arrivedMovement,
      examination: { at: NOW_ANCHOR + 60, outcome: "inpatient_order" },
    };
    expect(currentLegalDueAt(examinedMovement)).toBeUndefined();

    // Or once Form 6A is recorded
    const form6aMovement: Movement = {
      ...arrivedMovement,
      legalForm: { code: "6A", kind: "detention", dueAt: NOW_ANCHOR + 21 * 1440 },
    };
    expect(currentLegalDueAt(form6aMovement)).toBe(NOW_ANCHOR + 21 * 1440);
  });
});

describe("PATIENT_COLLECTED restrictive practice guard", () => {
  it("rejects collection when source admission has an open restrictive practice episode", () => {
    let state = seedWardFlowState();
    const sourceStay = state.admissions.find((a) => a.unitId === "scgh-adult-open" && a.state === "occupied");
    expect(sourceStay).toBeDefined();

    // Start seclusion on source stay
    state = wardFlowReducer(state, {
      type: "RECORD_RESTRICTIVE_PRACTICE_START",
      role: "ward",
      unitId: sourceStay!.unitId,
      actingUnitId: sourceStay!.unitId,
      admissionId: sourceStay!.id,
      practice: "seclusion",
      startedAt: NOW_ANCHOR - 30,
      now: NOW_ANCHOR,
    });

    // Create a movement originating from this source stay
    const targetMovementId = "WF-004";
    state = {
      ...state,
      movements: state.movements.map((m) =>
        m.id === targetMovementId
          ? {
              ...m,
              sourceAdmissionId: sourceStay!.id,
              stage: "handover_ready" as const,
              transport: {
                id: "TR-TEST-1",
                provider: "Ambulance service",
                escortRequired: false,
                enRouteAt: NOW_ANCHOR - 10,
              },
            }
          : m,
      ),
    };

    // Attempt collection while seclusion is still open
    const refused = wardFlowReducer(state, {
      type: "PATIENT_COLLECTED",
      role: "officer",
      movementId: targetMovementId,
      now: NOW_ANCHOR,
    });

    expect(refused.rejections.at(-1)?.reason).toContain("Seclusion is still recorded as in use for this patient");
    expect(refused.movements.find((m) => m.id === targetMovementId)?.stage).toBe("handover_ready");

    // Now end the seclusion episode
    const episode = state.units.find((u) => u.id === sourceStay!.unitId)!.restrictivePractice!.episodes[0]!;
    state = wardFlowReducer(state, {
      type: "RECORD_RESTRICTIVE_PRACTICE_END",
      role: "ward",
      unitId: sourceStay!.unitId,
      actingUnitId: sourceStay!.unitId,
      episodeId: episode.id,
      endedAt: NOW_ANCHOR - 5,
      now: NOW_ANCHOR,
    });

    // Collection now succeeds
    const collected = wardFlowReducer(state, {
      type: "PATIENT_COLLECTED",
      role: "officer",
      movementId: targetMovementId,
      now: NOW_ANCHOR,
    });

    expect(collected.movements.find((m) => m.id === targetMovementId)?.stage).toBe("moving");
  });
});
