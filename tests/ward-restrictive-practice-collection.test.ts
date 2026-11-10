import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { GENERAL_OBSERVATION } from "@/components/ward-management/ward-observation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { RESTRICTIVE_PRACTICE_IDS } from "@/components/ward-management/restrictive-practice/ward-restrictive-practice";

const NOW = NOW_ANCHOR + 5;
const SOURCE = "scgh-adult-open";
const DESTINATION = "rph-adult-secure";
type TestEvent = WardFlowEvent extends infer Event ? (Event extends WardFlowEvent ? Omit<Event, "now"> : never) : never;

/** Reach the sending stay and return journey through their actual producers. */
function readyJourney(returning = true) {
  let state = seedWardFlowState();
  const send = (event: TestEvent) => {
    const before = state;
    state = wardFlowReducer(state, { now: NOW, ...event } as WardFlowEvent);
    expect(state.rejections).toHaveLength(before.rejections.length);
  };
  send({
    type: "ADD_PATIENT",
    role: "coordinator",
    umrn: "SYN-COLLECTION-001",
    givenName: "Synthetic",
    familyName: "Collection",
    dateOfBirth: "1980-01-01",
  });
  const patientId = state.patients.at(-1)!.id;
  send({
    type: "RAISE_REFERRAL",
    role: "ed",
    edId: "jhc-ed",
    patientId,
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
  const outboundId = state.movements.at(-1)!.id;
  const pull = (movementId: string, unitId: string) => {
    send({ type: "REFER_TO_UNITS", role: "coordinator", movementId, unitIds: [unitId] });
    send({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId, unitId, actingUnitId: unitId });
    send({ type: "PULL_PATIENT", role: "ward", movementId, unitId, actingUnitId: unitId });
  };
  pull(outboundId, SOURCE);
  const sourceAdmissionId = state.movements.at(-1)!.admissionId!;
  let movementId = outboundId;
  let destinationId = SOURCE;
  if (returning) {
    send({ type: "RECORD_TRANSPORT_NEED", role: "coordinator", movementId, needed: false });
    send({ type: "PATIENT_ARRIVED", role: "ward", movementId, actingUnitId: SOURCE });
    send({
      type: "RECORD_REPATRIATION",
      role: "coordinator",
      admissionId: sourceAdmissionId,
      homeHospital: "RPH",
      receivingWardAgreed: true,
      mode: "road",
      provider: "Ambulance service",
      cadNumber: "SYN-CAD-COLLECT-01",
      transportLegalStatus: "voluntary",
      estimatedAt: NOW + 60,
    });
    movementId = state.movements.at(-1)!.id;
    destinationId = DESTINATION;
    pull(movementId, destinationId);
  }
  send({
    type: "BOOK_TRANSPORT",
    role: "coordinator",
    movementId,
    provider: "Ambulance service",
    escortRequired: false,
    cadNumber: "SYN-CAD-COLLECT-02",
    transportLegalStatus: "voluntary",
    estimatedAt: NOW + 60,
  });
  send({ type: "HANDOVER_READY", role: "coordinator", movementId });
  send({ type: "TRANSPORT_ACCEPTED", role: "officer", movementId });
  send({ type: "TRANSPORT_EN_ROUTE", role: "officer", movementId });
  expect(state.movements.find((movement) => movement.id === movementId)?.stage).toBe("handover_ready");
  return { state, movementId, sourceAdmissionId, destinationId, patientId };
}

function startEpisode(
  state: WardFlowState,
  admissionId: string,
  practice: (typeof RESTRICTIVE_PRACTICE_IDS)[number] = "seclusion",
) {
  const admission = state.admissions.find((candidate) => candidate.id === admissionId)!;
  const next = wardFlowReducer(state, {
    type: "RECORD_RESTRICTIVE_PRACTICE_START",
    role: "ward",
    now: NOW,
    unitId: admission.unitId,
    actingUnitId: admission.unitId,
    admissionId,
    practice,
    startedAt: NOW,
  });
  expect(next.rejections).toHaveLength(state.rejections.length);
  return next;
}

function collect(state: WardFlowState, movementId: string) {
  return wardFlowReducer(state, { type: "PATIENT_COLLECTED", role: "officer", now: NOW, movementId });
}

describe("collection rechecks the sending stay's restrictive practice", () => {
  it.each(RESTRICTIVE_PRACTICE_IDS)(
    "refuses a newly recorded %s after handover readiness without releasing either bed",
    (practice) => {
      const journey = readyJourney();
      const before = startEpisode(journey.state, journey.sourceAdmissionId, practice);
      const after = collect(before, journey.movementId);
      expect(after.rejections).toHaveLength(before.rejections.length + 1);
      expect(after.rejections.at(-1)?.reason).toContain("still recorded as in use for this patient");
      expect(after.movements).toEqual(before.movements);
      expect(after.admissions).toEqual(before.admissions);
      expect(after.units).toEqual(before.units);
    },
  );

  it("permits collection once the sending ward records the episode ended", () => {
    const journey = readyJourney();
    const started = startEpisode(journey.state, journey.sourceAdmissionId);
    const episode = started.units.find((unit) => unit.id === SOURCE)!.restrictivePractice!.episodes.at(-1)!;
    const ended = wardFlowReducer(started, {
      type: "RECORD_RESTRICTIVE_PRACTICE_END",
      role: "ward",
      now: NOW,
      unitId: SOURCE,
      actingUnitId: SOURCE,
      episodeId: episode.id,
      endedAt: NOW,
    });
    expect(ended.rejections).toHaveLength(started.rejections.length);
    const after = collect(ended, journey.movementId);
    expect(after.rejections).toHaveLength(ended.rejections.length);
    expect(after.movements.find((movement) => movement.id === journey.movementId)).toMatchObject({
      stage: "moving",
      transport: { collectedAt: NOW },
    });
    expect(after.admissions).toEqual(ended.admissions);
  });

  it("does not let another patient's episode on the sending ward block collection", () => {
    const journey = readyJourney();
    const other = journey.state.admissions.find(
      (admission) =>
        admission.unitId === SOURCE && admission.state === "occupied" && admission.id !== journey.sourceAdmissionId,
    );
    if (!other) throw new Error("fixture needs another occupied stay on the sending ward");
    const before = startEpisode(journey.state, other.id);
    const after = collect(before, journey.movementId);
    expect(after.rejections).toHaveLength(before.rejections.length);
    expect(after.movements.find((movement) => movement.id === journey.movementId)?.stage).toBe("moving");
  });

  it("checks legacy psychiatric-ward referral linkage without sourceAdmissionId", () => {
    const journey = readyJourney();
    const referralId = "REF-SYN-COLLECTION-LEGACY";
    const legacy: WardFlowState = {
      ...journey.state,
      referrals: [
        ...journey.state.referrals,
        {
          ...journey.state.referrals[0]!,
          id: referralId,
          patientId: journey.patientId,
          source: "psychiatric_ward",
          originUnitId: SOURCE,
        },
      ],
      movements: journey.state.movements.map((movement) =>
        movement.id === journey.movementId ? { ...movement, sourceAdmissionId: undefined, referralId } : movement,
      ),
    };
    const before = startEpisode(legacy, journey.sourceAdmissionId);
    const after = collect(before, journey.movementId);
    expect(after.rejections).toHaveLength(before.rejections.length + 1);
    expect(after.rejections.at(-1)?.reason).toContain("Seclusion is still recorded as in use");
    expect(after.movements).toEqual(before.movements);
  });

  it("leaves ordinary ED collection without a sending stay available", () => {
    const journey = readyJourney(false);
    const after = collect(journey.state, journey.movementId);
    expect(after.rejections).toHaveLength(journey.state.rejections.length);
    expect(after.movements.find((movement) => movement.id === journey.movementId)?.stage).toBe("moving");
  });

  it("still records physical arrival if a sending episode is recorded after collection", () => {
    const journey = readyJourney();
    const collected = collect(journey.state, journey.movementId);
    expect(collected.rejections).toHaveLength(journey.state.rejections.length);
    const before = startEpisode(collected, journey.sourceAdmissionId);
    const after = wardFlowReducer(before, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW,
      movementId: journey.movementId,
      actingUnitId: journey.destinationId,
    });
    expect(after.rejections).toHaveLength(before.rejections.length);
    expect(after.movements.find((movement) => movement.id === journey.movementId)?.stage).toBe("arrived");
    expect(after.admissions.find((admission) => admission.id === journey.sourceAdmissionId)?.state).toBe("departed");
  });
});
