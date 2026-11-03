import { describe, expect, it } from "vitest";

import { scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { isEdOriginJourney } from "@/components/ward-management/ward-ed-presence";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  wardFlowReducer,
  movementSourceAdmission,
  type WardFlowState,
} from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { STEP_BACK_REASONS, type Movement } from "@/components/ward-management/ward-model";
import { GENERAL_OBSERVATION } from "@/components/ward-management/ward-observation";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { isValidSharedWardFlowState } from "@/components/ward-management/ward-shared-state-validation";
import { NOW_ANCHOR, allEmergencyDepartments } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR + 10;
const DESTINATION = "scgh-adult-open";
const TRANSFER_REFUSAL = "A transfer still has a bed pulled for this patient";
type PinnedMovement = Movement & { referralSourceAdmissionId?: string };

function send(state: WardFlowState, event: Record<string, unknown>): WardFlowState {
  return wardFlowReducer(state, { now: NOW, ...event } as WardFlowEvent);
}

function accepted(state: WardFlowState, event: Record<string, unknown>): WardFlowState {
  const next = send(state, event);
  expect(next.rejections, next.rejections.at(-1)?.reason).toEqual(state.rejections);
  expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify({ ...next, rejections: [] })))).toBe(true);
  return next;
}

function departure(admission: { id: string; unitId: string }) {
  return {
    type: "RECORD_LEAVING",
    role: "ward",
    actingUnitId: admission.unitId,
    admissionId: admission.id,
    leavingDestination: "discharged-to-the-community",
  };
}

/** Reachable ordinary ward referral via ED, without inserting a hand-built movement. */
function pulledTransfer() {
  let state = seedWardFlowState();
  const source = state.admissions.find(
    (admission) =>
      admission.state === "occupied" &&
      admission.patientId !== null &&
      admission.unitId === "rph-adult-secure" &&
      send(state, departure(admission)).rejections.length === state.rejections.length,
  )!;
  expect(source).toBeDefined();
  const ed = allEmergencyDepartments()[0]!;
  state = accepted(state, {
    type: "RECEIVE_REFERRAL",
    role: "ward",
    patientId: source.patientId,
    ageBand: "Adult",
    source: "psychiatric_ward",
    originUnitId: source.unitId,
    actingUnitId: source.unitId,
    originSiteCode: "RPH",
    destinations: [{ kind: "emergency_department", edId: ed.id, purpose: "bed" }],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "unknown", reason: "not_known" },
    urgency: 2,
    transportNeeded: false,
    history: "Synthetic transfer consistency fixture.",
  });
  state = accepted(state, {
    type: "RAISE_REFERRAL",
    role: "ed",
    edId: ed.id,
    referralId: state.referrals.at(-1)!.id,
    patientId: source.patientId,
    draft: {
      cohort: "Adult",
      sex: source.sex,
      gender: source.gender,
      security: "Open",
      observation: GENERAL_OBSERVATION,
      highAcuity: false,
      legalStatus: "Voluntary",
      urgency: 2,
      legalFormCode: null,
    },
  });
  const movementId = state.movements.at(-1)!.id;
  state = accepted(state, {
    type: "REFER_TO_UNITS",
    role: "coordinator",
    movementId,
    unitIds: [DESTINATION],
  });
  state = accepted(state, {
    type: "ACCEPT_IN_PRINCIPLE",
    role: "ward",
    actingUnitId: DESTINATION,
    movementId,
    unitId: DESTINATION,
  });
  state = accepted(state, {
    type: "PULL_PATIENT",
    role: "ward",
    actingUnitId: DESTINATION,
    movementId,
    unitId: DESTINATION,
  });
  state = accepted(state, { type: "RECORD_TRANSPORT_NEED", role: "coordinator", movementId, needed: false });
  const movement = state.movements.find((row) => row.id === movementId)! as PinnedMovement;
  return { state, source, movement };
}

function arrive(state: WardFlowState, movementId: string) {
  return accepted(state, {
    type: "PATIENT_ARRIVED",
    role: "ward",
    movementId,
    actingUnitId: DESTINATION,
  });
}

describe("SC06: stable source of an ordinary ward-referral transfer", () => {
  it("pins the occupied source when its destination is pulled without changing the ED origin", () => {
    const { state, source, movement } = pulledTransfer();
    expect(movement.referralSourceAdmissionId).toBe(source.id);
    expect(movement.sourceAdmissionId).toBeUndefined();
    expect(isEdOriginJourney(movement)).toBe(true);
    expect(state.admissions.find((row) => row.id === source.id)?.state).toBe("occupied");
    expect(state.admissions.find((row) => row.id === movement.admissionId)?.state).toBe("pulled");
  });

  it.each(["RECORD_LEAVING", "RECORD_PATIENT_DISCHARGE"])(
    "refuses %s before arrival while preserving both beds and the pending transfer",
    (type) => {
      const { state, source } = pulledTransfer();
      const refused = send(state, {
        ...departure(source),
        type,
        ...(type === "RECORD_PATIENT_DISCHARGE"
          ? {
              patientId: source.patientId,
              expectedGeneration: state.worldGeneration,
              expectedRevision: state.dischargeRevisions[source.id] ?? 0,
            }
          : {}),
      });
      expect(refused.rejections.at(-1)?.reason).toContain(TRANSFER_REFUSAL);
      expect(refused.admissions).toEqual(state.admissions);
      expect(refused.units).toEqual(state.units);
      expect(refused.movements).toEqual(state.movements);
    },
  );

  it("also protects a restored older pulled transfer with no stored source pin", () => {
    const { state, source, movement } = pulledTransfer();
    const legacy = {
      ...state,
      movements: state.movements.map((row) => {
        if (row.id !== movement.id) return row;
        const { referralSourceAdmissionId: _pin, ...withoutPin } = row as PinnedMovement;
        void _pin;
        return withoutPin;
      }),
    };
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(legacy)))).toBe(true);
    const refused = send(legacy, departure(source));
    expect(refused.rejections.at(-1)?.reason).toContain(TRANSFER_REFUSAL);
    expect(refused.admissions).toEqual(legacy.admissions);
  });

  it("does not replace a missing pinned source with another occupied stay found through the referral", () => {
    const { state, movement } = pulledTransfer();
    const missing: Movement = { ...movement, referralSourceAdmissionId: "AD-NOT-RECORDED" };
    const broken = {
      ...state,
      movements: state.movements.map((row) => (row.id === movement.id ? missing : row)),
    };
    expect(movementSourceAdmission(broken, missing)).toBeUndefined();
    const refused = send(broken, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      movementId: movement.id,
      actingUnitId: DESTINATION,
    });
    expect(refused.rejections.at(-1)?.reason).toContain("occupied source stay");
    expect(refused.admissions).toEqual(broken.admissions);
    expect(refused.units).toEqual(broken.units);
  });

  it("arrives atomically, rejects a later source discharge, and restores both sides on arrival Undo", () => {
    const { state, source, movement } = pulledTransfer();
    const arrived = arrive(state, movement.id);
    expect(arrived.admissions.find((row) => row.id === source.id)).toMatchObject({
      state: "departed",
      leavingDestination: "transferred-to-another-psychiatric-ward",
    });
    expect(arrived.admissions.find((row) => row.id === movement.admissionId)?.state).toBe("occupied");
    const late = send(arrived, departure(source));
    expect(late.rejections.at(-1)?.reason).toContain("already left");
    expect(late.admissions).toEqual(arrived.admissions);
    const undone = accepted(arrived, {
      type: "UNDO_TRANSPORT_STEP",
      role: "ward",
      movementId: movement.id,
      actingUnitId: DESTINATION,
      now: NOW + 1,
    });
    expect(undone.admissions).toEqual(state.admissions);
    expect(undone.movements).toEqual(state.movements);
    expect(send(undone, departure(source)).rejections.at(-1)?.reason).toContain(TRANSFER_REFUSAL);
  });

  it("releases the destination hold before permitting independent source departure", () => {
    const { state, source, movement } = pulledTransfer();
    const beforeCapacity = state.units.find((row) => row.id === DESTINATION)!.allocatable.value;
    const released = accepted(state, {
      type: "RELEASE_PULL",
      role: "ward",
      actingUnitId: DESTINATION,
      movementId: movement.id,
      reason: "patient_no_longer_coming",
    });
    const releasedMovement = released.movements.find((row) => row.id === movement.id)! as PinnedMovement;
    expect(releasedMovement.admissionId).toBeUndefined();
    expect(releasedMovement.referralSourceAdmissionId).toBeUndefined();
    expect(released.admissions.some((row) => row.id === movement.admissionId)).toBe(false);
    expect(released.admissions.find((row) => row.id === source.id)?.state).toBe("occupied");
    expect(released.units.find((row) => row.id === DESTINATION)!.allocatable.value).toBe(beforeCapacity + 1);
    expect(accepted(released, departure(source)).admissions.find((row) => row.id === source.id)?.state).toBe(
      "departed",
    );
  });

  it("keeps the held source protected after a stage correction and repull", () => {
    const { state, source, movement } = pulledTransfer();
    const corrected = accepted(state, {
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      movementId: movement.id,
      to: "accepted_awaiting_bed",
      reason: STEP_BACK_REASONS[0],
    });
    expect(send(corrected, departure(source)).rejections.at(-1)?.reason).toContain(TRANSFER_REFUSAL);
    const repulled = accepted(corrected, {
      type: "PULL_PATIENT",
      role: "ward",
      movementId: movement.id,
      actingUnitId: DESTINATION,
      unitId: DESTINATION,
    });
    expect(repulled.admissions).toEqual(corrected.admissions);
    expect(
      (repulled.movements.find((row) => row.id === movement.id)! as PinnedMovement).referralSourceAdmissionId,
    ).toBe(source.id);
  });

  it("withdraws without changing the source ward and retains the closed movement's provenance", () => {
    const { state, source, movement } = pulledTransfer();
    const withdrawn = accepted(state, {
      type: "WITHDRAW_REFERRAL",
      role: "coordinator",
      movementId: movement.id,
    });
    const closed = withdrawn.movements.find((row) => row.id === movement.id)! as PinnedMovement;
    expect(closed.closure).toBeDefined();
    expect(closed.referralSourceAdmissionId).toBe(source.id);
    expect(closed.admissionId).toBeUndefined();
    expect(withdrawn.admissions.some((row) => row.id === movement.admissionId)).toBe(false);
    expect(withdrawn.admissions.find((row) => row.id === source.id)).toEqual(source);
    expect(accepted(withdrawn, departure(source)).admissions.find((row) => row.id === source.id)?.state).toBe(
      "departed",
    );
  });

  it("validates the new source link and removes it when that stay is outside the receiving desk's scope", () => {
    const { state, source, movement } = pulledTransfer();
    const pinned: WardFlowState = {
      ...state,
      movements: state.movements.map((row) =>
        row.id === movement.id ? { ...row, referralSourceAdmissionId: source.id } : row,
      ),
    };
    const places = wardPlaceLookup(state.units);
    const scoped = scopeWardFlowState(
      pinned,
      { role: "ward", scope: { kind: "ward", unitIds: [DESTINATION] } },
      { now: NOW, places },
    ).state;
    expect(scoped.admissions.some((row) => row.id === source.id)).toBe(false);
    expect((scoped.movements.find((row) => row.id === movement.id)! as PinnedMovement).referralSourceAdmissionId).toBe(
      undefined,
    );
    const broken = {
      ...pinned,
      movements: pinned.movements.map((row) =>
        row.id === movement.id ? { ...row, referralSourceAdmissionId: "AD-NOT-RECORDED" } : row,
      ),
    };
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(broken)))).toBe(false);
    for (const invalid of [null, "", 123]) {
      const malformed = {
        ...pinned,
        movements: pinned.movements.map((row) =>
          row.id === movement.id ? { ...row, referralSourceAdmissionId: invalid } : row,
        ),
      };
      expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(malformed)))).toBe(false);
    }
  });

  it.each<WardAccess>([
    { role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } },
    { role: "ward", scope: { kind: "ward", unitIds: [DESTINATION] } },
    { role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure", DESTINATION] } },
    { role: "ed", scope: { kind: "ed", edId: "rph-ed" } },
    { role: "bed_manager", scope: { kind: "site", siteCode: "RPH" } },
    { role: "coordinator", scope: { kind: "service", service: "East Metro" } },
    { role: "coordinator", scope: { kind: "service", service: "North Metro" } },
    { role: "executive", scope: { kind: "statewide" } },
    { role: "officer", scope: { kind: "jobs" } },
  ])("keeps a valid scoped shared snapshot for $role at $scope", (access) => {
    const { state, source, movement } = pulledTransfer();
    const scoped = scopeWardFlowState(state, access, { now: NOW, places: wardPlaceLookup(state.units) }).state;
    expect(isValidSharedWardFlowState(JSON.parse(JSON.stringify(scoped)))).toBe(true);
    const visible = scoped.movements.find((row) => row.id === movement.id);
    if (!scoped.admissions.some((row) => row.id === source.id))
      expect(visible?.referralSourceAdmissionId).toBeUndefined();
  });
});
