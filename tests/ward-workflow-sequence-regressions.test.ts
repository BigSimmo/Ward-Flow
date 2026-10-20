import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { STEP_BACK_REASONS } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR, allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { commandScopeRefusal } from "@/components/ward-management/ward-access-state";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";
import { wardReferralInboxEntries } from "@/components/ward-management/referrals/referral-inbox";

const now = NOW_ANCHOR;
function apply(state: WardFlowState, event: WardFlowEvent) {
  const next = wardFlowReducer(state, event);
  expect(next.rejections.at(-1) === state.rejections.at(-1), next.rejections.at(-1)?.reason).toBe(true);
  return next;
}

describe("intervening actions and physical provenance", () => {
  it("still undoes a recorded transfer arrival into its legitimate source-stay and destination-hold pair", () => {
    let state = seedWardFlowState();
    const source = state.admissions.find(
      (a) => a.state === "occupied" && a.patientId && a.unitId === "rph-adult-secure",
    )!;
    const referral = {
      ...state.referrals[0],
      id: "RF-UNDO-TRANSFER",
      patientId: source.patientId!,
      source: "psychiatric_ward" as const,
      originUnitId: source.unitId,
    };
    const movement = {
      ...state.movements[0],
      id: "WF-UNDO-TRANSFER" as const,
      patientId: source.patientId!,
      referralId: referral.id,
      admissionId: undefined,
      closure: undefined,
      gender: source.gender,
      sex: source.sex,
      cohort: "Adult" as const,
      security: "Open" as const,
      legalStatus: "Voluntary" as const,
      specialling: false,
      highAcuity: false,
      transport: undefined,
      stage: "accepted_awaiting_bed" as const,
      acceptedUnitId: "scgh-adult-open",
      referredUnitIds: ["scgh-adult-open"],
    };
    state = { ...state, referrals: [...state.referrals, referral], movements: [...state.movements, movement] };
    state = apply(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now,
      movementId: movement.id,
      unitId: "scgh-adult-open",
      actingUnitId: "scgh-adult-open",
    });
    state = apply(state, { type: "RECORD_TRANSPORT_NEED", role: "ward", now, movementId: movement.id, needed: false });
    const arrived = apply(state, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now,
      movementId: movement.id,
      actingUnitId: "scgh-adult-open",
    });
    const undone = apply(arrived, {
      type: "UNDO_TRANSPORT_STEP",
      role: "ward",
      now: now + 1,
      movementId: movement.id,
      actingUnitId: "scgh-adult-open",
    });
    expect(undone.admissions).toEqual(state.admissions);
    // Optimistic-write revisions advance even when the domain facts are restored.
    const capacityFacts = (world: WardFlowState) =>
      world.units.map((u) => ({ ...u, allocatable: { ...u.allocatable, revision: 0 } }));
    expect(capacityFacts(undone)).toEqual(capacityFacts(state));
    expect(undone.movements).toEqual(state.movements);
  });

  it("refuses departure Undo after another ward acquired the same patient, without restoring counters", () => {
    const state = seedWardFlowState();
    const admission = state.admissions.find((a) => a.state === "occupied")!;
    const patient = state.patients[0];
    admission.patientId = patient.id;
    patient.legalStatus = "Voluntary";
    state.movements = state.movements.filter((m) => m.patientId !== patient.id && m.admissionId !== admission.id);
    const departed = apply(state, {
      type: "RECORD_LEAVING",
      role: "ward",
      now,
      admissionId: admission.id,
      actingUnitId: admission.unitId,
      leavingDestination: "discharged-to-the-community",
    });
    const otherUnit = state.units.find((u) => u.id !== admission.unitId)!;
    const concurrent: WardFlowState = {
      ...departed,
      admissions: [...departed.admissions, { ...admission, id: "AD-LATER", unitId: otherUnit.id, state: "occupied" }],
    };
    const refused = wardFlowReducer(concurrent, {
      type: "UNDO_DEPARTURE",
      role: "ward",
      now: now + 1,
      admissionId: admission.id,
      actingUnitId: admission.unitId,
    });
    expect(refused.rejections.at(-1)?.reason).toContain("another bed");
    expect(refused.admissions).toEqual(concurrent.admissions);
    expect(refused.units).toEqual(concurrent.units);
    expect(refused.undoRecords).toEqual(concurrent.undoRecords);
  });

  it("resumes a corrected moving stage without replacing the original collection time", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find(
      (m) => m.stage === "moving" && m.transport?.collectedAt !== undefined && m.transport.enRouteAt !== undefined,
    )!;
    movement.gender = movement.sex === "Female" ? "Female" : "Male";
    movement.sex = movement.gender;
    const collectedAt = movement.transport!.collectedAt;
    const corrected = apply(state, {
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      now,
      movementId: movement.id,
      to: "handover_ready",
      reason: STEP_BACK_REASONS[0],
    } as WardFlowEvent);
    const resumed = apply(corrected, {
      type: "PATIENT_COLLECTED",
      role: "officer",
      now: now + 1,
      movementId: movement.id,
    });
    const result = resumed.movements.find((m) => m.id === movement.id)!;
    expect(result.stage).toBe("moving");
    expect(result.transport?.collectedAt).toBe(collectedAt);
    expect(result.stageChanges.at(-1)).toMatchObject({
      at: now + 1,
      to: "moving",
      reason: "Restored after stage correction",
    });
  });
});

function acceptedDirectReferral() {
  let state = seedWardFlowState();
  const unit = state.units.find((u) => u.id === "scgh-adult-open")!;
  const ed = allEmergencyDepartments()[0];
  state = apply(state, {
    type: "RECEIVE_REFERRAL",
    role: "ed",
    now,
    ageBand: "Adult",
    source: "ed_medical",
    originSiteCode: ed.siteCode,
    destinations: [
      {
        kind: "psychiatric_ward",
        unitId: unit.id,
        sex: "Female",
        gender: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "unknown", reason: "not_known" },
    urgency: 2,
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  });
  const referral = state.referrals.at(-1)!;
  state = apply(state, {
    type: "ACCEPT_REFERRAL",
    role: "ward",
    now,
    referralId: referral.id,
    destinationKind: "psychiatric_ward",
    unitId: unit.id,
    actingUnitId: unit.id,
  });
  const event: WardFlowEvent = {
    type: "RAISE_REFERRAL",
    role: "ward",
    now: now + 1,
    edId: ed.id,
    referralId: referral.id,
    acceptedUnitId: unit.id,
    actingUnitId: unit.id,
    draft: {
      cohort: "Adult",
      sex: "Female",
      gender: "Female",
      security: "Open",
      specialling: false,
      highAcuity: false,
      legalStatus: "Voluntary",
      urgency: 2,
      legalFormCode: null,
    },
  };
  return { state, event, unit, referral };
}

describe("accepted direct referral continuation", () => {
  it("projects only this ward's accepted arm, including a referral originally addressed to any ward", () => {
    const { state, referral, unit } = acceptedDirectReferral();
    const current = state.referrals.find((r) => r.id === referral.id)!;
    const accepted = current.destinations.find((arm) => arm.state === "accepted")!;
    if (accepted.destination.kind !== "psychiatric_ward") throw new Error("Expected a ward acceptance");
    delete accepted.destination.unitId;
    expect(accepted.acceptedUnitId).toBe(unit.id);
    const entries = wardReferralInboxEntries([current], unit.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ ageBand: current.ageBand, originSiteCode: current.originSiteCode });
    expect(entries[0]).not.toHaveProperty("destinations");
    expect(wardReferralInboxEntries([current], "another-ward")).toEqual([]);
  });

  it("starts a linked accepted movement explicitly, consumes no bed and refuses repeated starts", () => {
    const { state, event, unit, referral } = acceptedDirectReferral();
    expect(state.movements.some((m) => m.referralId === referral.id)).toBe(false);
    const started = apply(state, event);
    const movement = started.movements.at(-1)!;
    expect(movement).toMatchObject({
      referralId: referral.id,
      acceptedUnitId: unit.id,
      stage: "accepted_awaiting_bed",
    });
    expect(started.units).toEqual(state.units);
    expect(started.admissions).toEqual(state.admissions);
    const repeated = wardFlowReducer(started, event);
    expect(repeated.rejections.at(-1)?.reason).toContain("already has a linked movement");
    expect(repeated.movements).toEqual(started.movements);
    const pulled = apply(started, {
      type: "PULL_PATIENT",
      role: "ward",
      now: now + 2,
      movementId: movement.id,
      unitId: unit.id,
      actingUnitId: unit.id,
    });
    expect(pulled.movements.find((m) => m.id === movement.id)?.stage).toBe("pulled");
  });

  it("records the accepted ward as accepted, not as a live request a withdrawal could take back", () => {
    const { state, event, unit } = acceptedDirectReferral();
    const started = apply(state, event);
    const movement = started.movements.at(-1)!;
    expect(movement.referredUnitIds).toEqual([]);
    const withdrawn = wardFlowReducer(started, {
      type: "WITHDRAW_WARD_REQUEST",
      role: "coordinator",
      now: now + 2,
      movementId: movement.id,
      unitId: unit.id,
      reason: "no_answer_from_the_ward",
    });
    expect(withdrawn.rejections.at(-1)?.reason).toContain("does not hold a live referral");
    expect(withdrawn.movements.find((m) => m.id === movement.id)).toMatchObject({
      acceptedUnitId: unit.id,
      stage: "accepted_awaiting_bed",
    });
  });

  it("scopes the accepting ward and never lets it past the ED scope check", () => {
    const { state, event, unit } = acceptedDirectReferral();
    const options = { now, places: wardPlaceLookup(state.units) };
    const access = { role: "ward" as const, scope: { kind: "ward" as const, unitIds: [unit.id] } };
    // The source ED is outside this ward's scope, so the accepting ward is refused (owner, 19 Oct).
    expect(commandScopeRefusal(state, access, event as unknown as Record<string, unknown>, options)).toContain(
      "outside",
    );
    expect(
      commandScopeRefusal(
        state,
        access,
        { ...(event as unknown as Record<string, unknown>), edId: undefined },
        options,
      ),
    ).toBeNull();
    expect(commandScopeRefusal(state, access, { ...event, acceptedUnitId: "outside-unit" }, options)).toContain(
      "outside",
    );
    const wrongWard = wardFlowReducer(state, { ...event, actingUnitId: "outside-unit" } as WardFlowEvent);
    expect(wrongWard.movements).toEqual(state.movements);
    expect(wrongWard.rejections.at(-1)?.reason).toContain("accepting ward");
  });

  it.each(["withdrawn", "not accepted", "wrong ED", "wrong needs", "wrong role"])(
    "refuses a %s continuation without writing a movement",
    (scenario) => {
      const { state, event, referral } = acceptedDirectReferral();
      const continuation = { ...event } as Extract<WardFlowEvent, { type: "RAISE_REFERRAL" }>;
      const current = state.referrals.find((r) => r.id === referral.id)!;
      const arm = current.destinations.find((d) => d.state === "accepted")!;
      if (scenario === "withdrawn") arm.withdrawnAt = now;
      if (scenario === "not accepted") arm.state = "queued";
      if (scenario === "wrong ED")
        continuation.edId = allEmergencyDepartments().find((ed) => ed.siteCode !== current.originSiteCode)!.id;
      if (scenario === "wrong needs") continuation.draft = { ...continuation.draft, security: "Secure" };
      if (scenario === "wrong role") continuation.role = "ed";
      const refused = wardFlowReducer(state, continuation);
      expect(refused.rejections.length).toBe(state.rejections.length + 1);
      expect(refused.movements).toEqual(state.movements);
      expect(refused.admissions).toEqual(state.admissions);
      expect(refused.units).toEqual(state.units);
    },
  );
});
