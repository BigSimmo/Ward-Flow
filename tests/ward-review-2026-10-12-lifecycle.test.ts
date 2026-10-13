/**
 * Regression tests for the lifecycle findings of the 8 Oct 2026 core-engine review, fixed 13 Oct 2026
 * (docs/ward-flow/audit-2026-10-08-core-engine-review.md). Each test fails on the pre-fix engine.
 * Ward callers always name their own ward, as the strict ward-scoping rule requires.
 */
import { describe, expect, it } from "vitest";

import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";
import { DIVERSION_REASONS, TRANSPORT_WHEREABOUTS } from "@/components/ward-management/ward-change-reasons";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { referralEligibility } from "@/components/ward-management/ward-eligibility";
import { ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS } from "@/components/ward-management/ward-model";

const now = 642;
type WithoutNow<T> = T extends unknown ? Omit<T, "now"> : never;
type TestEvent = WithoutNow<WardFlowEvent>;

function harness(initial: WardFlowState = seedWardFlowState()) {
  let state = initial;
  let t = now;
  const send = (event: TestEvent | Record<string, unknown>) => {
    const before = state.rejections.length;
    state = wardFlowReducer(state, { now: t++, ...event } as WardFlowEvent);
    return state.rejections.length === before ? null : state.rejections.at(-1)!.reason;
  };
  const ok = (event: TestEvent | Record<string, unknown>) => {
    const refusal = send(event);
    if (refusal) throw new Error(`${(event as { type: string }).type} refused: ${refusal}`);
  };
  return {
    get state() {
      return state;
    },
    set state(s: WardFlowState) {
      state = s;
    },
    send,
    ok,
  };
}
type H = ReturnType<typeof harness>;

const DRAFT = {
  cohort: "Adult",
  security: "Open",
  sex: "Female",
  gender: "Female",
  specialling: false,
  highAcuity: false,
  legalStatus: "Voluntary",
  urgency: 2,
  legalFormCode: null,
};

function raise(h: H, umrn: string, sex = "Female") {
  h.ok({
    type: "ADD_PATIENT",
    role: "coordinator",
    umrn,
    givenName: "Demo",
    familyName: "Review",
    dateOfBirth: "1980-01-01",
  });
  const patient = h.state.patients.at(-1)!;
  const refusal = h.send({
    type: "RAISE_REFERRAL",
    role: "ed",
    edId: "jhc-ed",
    patientId: patient.id,
    draft: { ...DRAFT, sex },
  });
  return { patient, movement: h.state.movements.at(-1)!, refusal };
}

const accept = (h: H, movementId: string, unitId: string) =>
  h.ok({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId, unitId, actingUnitId: unitId });
const pull = (h: H, movementId: string, unitId: string) =>
  h.ok({ type: "PULL_PATIENT", role: "ward", movementId, unitId, actingUnitId: unitId });

function admittedPatient(h: H, umrn: string, unitId = "scgh-adult-open") {
  const { patient, movement: inbound } = raise(h, umrn);
  h.ok({ type: "REFER_TO_UNITS", role: "coordinator", movementId: inbound.id, unitIds: [unitId] });
  accept(h, inbound.id, unitId);
  pull(h, inbound.id, unitId);
  h.ok({ type: "RECORD_TRANSPORT_NEED", role: "ward", movementId: inbound.id, needed: false, actingUnitId: unitId });
  h.ok({ type: "PATIENT_ARRIVED", role: "ward", movementId: inbound.id, actingUnitId: unitId });
  const admission = h.state.admissions.find((a) => a.movementId === inbound.id)!;
  expect(admission.state).toBe("occupied");
  return { patient, inbound, admission };
}

function repatriationPulled(h: H, admissionId: string, dest = "rph-adult-secure") {
  h.ok({
    type: "RECORD_REPATRIATION",
    role: "coordinator",
    admissionId,
    homeHospital: "RPH",
    receivingWardAgreed: true,
    mode: "road",
    provider: "Ambulance service",
    cadNumber: "SYN-CAD-REV",
    transportLegalStatus: "voluntary",
    estimatedAt: 700,
  });
  const m = h.state.movements.at(-1)!;
  h.ok({ type: "REFER_TO_UNITS", role: "coordinator", movementId: m.id, unitIds: [dest] });
  accept(h, m.id, dest);
  pull(h, m.id, dest);
  return m;
}

const mv = (h: H, id: string) => h.state.movements.find((m) => m.id === id)!;
const newNotices = (h: H, before: number) => h.state.notices.slice(before).map((n) => `${n.kind}->${n.to.role}`);

describe("review 2026-10-08 lifecycle fixes", () => {
  it("S2-2: clearing the blocker text does not lift the revoked-examination bed hold", () => {
    const h = harness();
    expect(h.send({ type: "RECORD_EXAMINATION", role: "ed", movementId: "WF-005", outcome: "revoked" })).toBeNull();
    expect(h.send({ type: "TRANSPORT_EN_ROUTE", role: "officer", movementId: "WF-005" })).not.toBeNull();
    h.send({ type: "CLEAR_MOVEMENT_BLOCKER", role: "coordinator", movementId: "WF-005" });
    expect(h.send({ type: "TRANSPORT_EN_ROUTE", role: "officer", movementId: "WF-005" })).toMatch(
      /examination was revoked/,
    );
    expect(h.send({ type: "PATIENT_COLLECTED", role: "officer", movementId: "WF-005" })).not.toBeNull();
  });

  it("S2-3: arrival into a full ward does not create a phantom free bed later", () => {
    const h = harness();
    const unitId = "scgh-adult-open";
    const { admission } = admittedPatient(h, "SYN-REV-003", unitId);
    h.state = {
      ...h.state,
      units: h.state.units.map((u) => (u.id === unitId ? { ...u, empty: { ...u.empty, value: 0 } } : u)),
    };
    try {
      admittedPatient(h, "SYN-REV-004", unitId);
    } catch {
      // Refusing the arrival is also a correct outcome.
    }
    h.ok({
      type: "RECORD_LEAVING",
      role: "ward",
      admissionId: admission.id,
      actingUnitId: unitId,
      leavingDestination: "discharged-to-the-community",
    });
    expect(h.state.units.find((u) => u.id === unitId)!.empty.value).toBe(0);
  });

  it("S2-6: a repatriation cannot be recorded from a stay that has already ended", () => {
    const h = harness();
    const { patient, admission } = admittedPatient(h, "SYN-REV-002");
    h.ok({
      type: "RECORD_PATIENT_DISCHARGE",
      role: "ward",
      actingUnitId: admission.unitId,
      admissionId: admission.id,
      patientId: patient.id,
      expectedGeneration: h.state.worldGeneration,
      expectedRevision: h.state.dischargeRevisions[admission.id] ?? 0,
      leavingDestination: "discharged-to-the-community",
    });
    const before = h.state.movements.length;
    const refusal = h.send({
      type: "RECORD_REPATRIATION",
      role: "coordinator",
      admissionId: admission.id,
      homeHospital: "RPH",
      receivingWardAgreed: true,
      mode: "road",
      provider: "Ambulance service",
      cadNumber: "SYN-CAD-REV2",
      transportLegalStatus: "voluntary",
      estimatedAt: 700,
    });
    expect(refusal).toMatch(/departed/);
    expect(h.state.movements.length).toBe(before);
  });

  it("S1-3: a community-team referral keeps the walk-in patient's link", () => {
    const h = harness();
    const { patient, movement } = raise(h, "SYN-REV-010");
    h.ok({ type: "REFER_TO_COMMUNITY_TEAM", role: "ed", movementId: movement.id, team: communityTeamOptions()[0]! });
    expect(h.state.referrals.at(-1)!.patientId).toBe(patient.id);
  });

  it("S1-4: withdrawing before acceptance tells the referred wards", () => {
    const h = harness();
    const { movement } = raise(h, "SYN-REV-011");
    h.ok({
      type: "REFER_TO_UNITS",
      role: "coordinator",
      movementId: movement.id,
      unitIds: ["scgh-adult-open", "arm-adult-open"],
    });
    const before = h.state.notices.length;
    h.ok({ type: "WITHDRAW_REFERRAL", role: "ed", movementId: movement.id, actingPlaceId: "jhc-ed" });
    expect(newNotices(h, before).filter((n) => n === "ward_request_withdrawn->ward")).toHaveLength(2);
  });

  it("S1-4: withdrawing after transport is booked tells the transport officer", () => {
    const h = harness();
    const { movement } = raise(h, "SYN-REV-012");
    h.ok({ type: "REFER_TO_UNITS", role: "coordinator", movementId: movement.id, unitIds: ["scgh-adult-open"] });
    accept(h, movement.id, "scgh-adult-open");
    pull(h, movement.id, "scgh-adult-open");
    h.ok({
      type: "BOOK_TRANSPORT",
      role: "ed",
      movementId: movement.id,
      provider: "Ambulance service",
      escortRequired: false,
      cadNumber: "CAD-REV-0002",
      transportLegalStatus: "voluntary",
      estimatedAt: 0,
    });
    const before = h.state.notices.length;
    h.ok({ type: "WITHDRAW_REFERRAL", role: "ed", movementId: movement.id, actingPlaceId: "jhc-ed" });
    expect(newNotices(h, before)).toContain("transport_cancelled_officer->officer");
    expect(mv(h, movement.id).transport?.cancelledAt).toBeDefined();
  });

  it("S1-5: a revoked-examination closure clears the referred wards and records them as withdrawn", () => {
    const h = harness();
    const { movement } = raise(h, "SYN-REV-013");
    h.ok({
      type: "REFER_TO_UNITS",
      role: "coordinator",
      movementId: movement.id,
      unitIds: ["scgh-adult-open", "arm-adult-open"],
    });
    h.ok({ type: "RECORD_EXAMINATION", role: "ed", movementId: movement.id, outcome: "revoked" });
    const m = mv(h, movement.id);
    expect(m.referredUnitIds).toEqual([]);
    expect((m.withdrawnReferrals ?? []).map((w) => w.unitId).sort()).toEqual(["arm-adult-open", "scgh-adult-open"]);
  });

  it("S1-6: no override is recorded for a ward that needed none", () => {
    const h = harness();
    const { movement } = raise(h, "SYN-REV-014");
    h.send({
      type: "REFER_TO_UNITS",
      role: "coordinator",
      movementId: movement.id,
      unitIds: ["scgh-adult-open"],
      overrideReason: "The bed information is known to be out of date",
    });
    expect(mv(h, movement.id).overrides ?? []).toEqual([]);
  });

  it("S1-7: waitlist entries are cleared when another ward accepts", () => {
    const h = harness();
    const { movement } = raise(h, "SYN-REV-015");
    h.ok({
      type: "REFER_TO_UNITS",
      role: "coordinator",
      movementId: movement.id,
      unitIds: ["scgh-adult-open", "arm-adult-open"],
    });
    h.ok({
      type: "DECLINE",
      role: "ward",
      movementId: movement.id,
      unitId: "scgh-adult-open",
      actingUnitId: "scgh-adult-open",
      reason: "no_bed",
    });
    expect(mv(h, movement.id).waitlistedUnitIds).toContain("scgh-adult-open");
    accept(h, movement.id, "arm-adult-open");
    expect(mv(h, movement.id).waitlistedUnitIds ?? []).toEqual([]);
  });

  it("S1-8: a re-pull after a step back sets a fresh hold expiry", () => {
    const h = harness();
    const { movement } = raise(h, "SYN-REV-016");
    h.ok({ type: "REFER_TO_UNITS", role: "coordinator", movementId: movement.id, unitIds: ["scgh-adult-open"] });
    accept(h, movement.id, "scgh-adult-open");
    pull(h, movement.id, "scgh-adult-open");
    const first = mv(h, movement.id).pullExpiresAt!;
    h.ok({
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      movementId: movement.id,
      to: "accepted_awaiting_bed",
      reason: "recorded_in_error",
    });
    pull(h, movement.id, "scgh-adult-open");
    expect(mv(h, movement.id).pullExpiresAt!).toBeGreaterThan(first);
  });

  it("S2-7: release-and-reopen before a bed was held reports an acceptance withdrawn, not a bed release", () => {
    const h = harness();
    const { movement } = raise(h, "SYN-REV-021");
    h.ok({ type: "REFER_TO_UNITS", role: "coordinator", movementId: movement.id, unitIds: ["scgh-adult-open"] });
    accept(h, movement.id, "scgh-adult-open");
    const before = h.state.notices.length;
    h.ok({
      type: "RELEASE_AND_REOPEN_SEARCH",
      role: "coordinator",
      movementId: movement.id,
      reason: "patient_no_longer_coming",
    });
    const kinds = h.state.notices.slice(before).map((n) => n.kind);
    expect(kinds.some((k) => k.startsWith("bed_pull_released"))).toBe(false);
    expect(mv(h, movement.id).unwinds?.at(-1)?.kind).toBe("acceptance_withdrawn");
  });

  it("S2-13: a transfer-out advances the source discharge revision once", () => {
    const h = harness();
    const { admission } = admittedPatient(h, "SYN-REV-023");
    const m = repatriationPulled(h, admission.id);
    const rev0 = h.state.dischargeRevisions[admission.id] ?? 0;
    h.ok({
      type: "RECORD_TRANSPORT_NEED",
      role: "ward",
      movementId: m.id,
      needed: false,
      actingUnitId: "rph-adult-secure",
    });
    h.ok({ type: "PATIENT_ARRIVED", role: "ward", movementId: m.id, actingUnitId: "rph-adult-secure" });
    expect((h.state.dischargeRevisions[admission.id] ?? 0) - rev0).toBe(1);
  });

  describe("off-list inputs are refused at runtime (S1-9, S1-10, S1-11, S1-13, S2-8)", () => {
    it("S1-9: an examination outcome not on the list", () => {
      const h = harness();
      const { movement } = raise(h, "SYN-REV-017");
      h.ok({ type: "REFER_TO_UNITS", role: "coordinator", movementId: movement.id, unitIds: ["scgh-adult-open"] });
      accept(h, movement.id, "scgh-adult-open");
      pull(h, movement.id, "scgh-adult-open");
      expect(
        h.send({ type: "RECORD_EXAMINATION", role: "ed", movementId: movement.id, outcome: "inpatient" }),
      ).not.toBeNull();
      expect(mv(h, movement.id).closure).toBeUndefined();
    });

    it("S1-10: an ED outcome not on the list", () => {
      const h = harness();
      const { movement } = raise(h, "SYN-REV-018");
      expect(
        h.send({ type: "RECORD_ED_OUTCOME", role: "ed", movementId: movement.id, outcome: "discharge" }),
      ).not.toBeNull();
      expect(mv(h, movement.id).closure).toBeUndefined();
    });

    it("S1-11: the same ward named twice", () => {
      const h = harness();
      const { movement } = raise(h, "SYN-REV-019");
      expect(
        h.send({
          type: "REFER_TO_UNITS",
          role: "coordinator",
          movementId: movement.id,
          unitIds: ["scgh-adult-open", "scgh-adult-open"],
        }),
      ).not.toBeNull();
    });

    it("S1-13: a referral field not on its list", () => {
      const h = harness();
      expect(raise(h, "SYN-REV-020", "female").refusal).not.toBeNull();
    });

    it("S2-8: a step-back target not on the stage list", () => {
      const h = harness();
      const stage = mv(h, "WF-006").stage;
      expect(
        h.send({
          type: "STEP_BACK_STAGE",
          role: "coordinator",
          movementId: "WF-006",
          to: "pullled",
          reason: "recorded_in_error",
        }),
      ).not.toBeNull();
      expect(mv(h, "WF-006").stage).toBe(stage);
    });
  });

  it("S2-4: a referrer withdrawal closes the linked journey tidily and tells the wards", () => {
    const h = harness();
    const queued = h.state.referrals.find(
      (r) =>
        r.patientId !== undefined &&
        r.destinations.some((d) => d.destination.kind === "emergency_department") &&
        r.destinations.every((d) => d.state === "queued" && d.withdrawnAt === undefined) &&
        !h.state.movements.some((m) => m.referralId === r.id),
    )!;
    expect(queued, "fixture premise: a waiting referral with a patient").toBeDefined();
    const ed = queued.destinations.find((d) => d.destination.kind === "emergency_department")!.destination;
    if (ed.kind !== "emergency_department") throw new Error("unreachable");
    h.ok({
      type: "RAISE_REFERRAL",
      role: "ed",
      edId: ed.edId,
      referralId: queued.id,
      patientId: queued.patientId,
      draft: DRAFT,
    });
    const linked = h.state.movements.at(-1)!;
    expect(linked.referralId).toBe(queued.id);
    h.ok({ type: "REFER_TO_UNITS", role: "coordinator", movementId: linked.id, unitIds: ["scgh-adult-open"] });
    const before = h.state.notices.length;
    h.ok({ type: "RECORD_REFERRER_WITHDRAWAL", role: "coordinator", referralId: queued.id });
    const after = mv(h, linked.id);
    expect(after.closure).toBeDefined();
    expect(after.referredUnitIds).toEqual([]);
    expect(after.acceptedUnitId).toBeUndefined();
    expect((after.withdrawnReferrals ?? []).map((w) => w.unitId)).toContain("scgh-adult-open");
    expect(newNotices(h, before)).toContain("ward_request_withdrawn->ward");
  });

  it("S2-9: a locked bed that is not free fails the capacity gate, which no override reaches", () => {
    const state = seedWardFlowState();
    const referral = state.referrals.find((r) => r.id === "RF-001")!;
    const addressing = referral.destinations.find((d) => d.destination.kind === "psychiatric_ward")!;
    if (addressing.destination.kind !== "psychiatric_ward") throw new Error("RF-001 must address a ward");
    const destination = { ...addressing.destination, secureBedNeeded: true };
    const base = state.units.find((u) => u.id === destination.unitId) ?? state.units[0]!;
    const unit = { ...base, lockedBeds: 2, allocatableLocked: 0, allocatable: { ...base.allocatable, value: 3 } };
    const gates = referralEligibility(referral, destination, unit, now).gates;
    expect(gates.find((g) => g.gate === "security")?.pass, "kind: the ward has locked beds").toBe(true);
    expect(gates.find((g) => g.gate === "allocatable_bed")?.pass, "capacity: none of them is free").toBe(false);
  });

  it("S1-14: the ED medical bed release threshold follows owner ruling FD-19 (48 hours)", () => {
    expect(ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS).toBe(48);
  });

  it("keeps diversion working for seeded journeys (S2-1 regression guard)", () => {
    const h = harness();
    h.ok({
      type: "RECORD_DIVERSION",
      role: "officer",
      movementId: "WF-006",
      reason: DIVERSION_REASONS[0],
      place: TRANSPORT_WHEREABOUTS[1],
    });
    expect(h.send({ type: "RELEASE_DIVERTED_BED", role: "coordinator", movementId: "WF-006" })).toBeNull();
  });
});
