import { describe, expect, it } from "vitest";
// Offline synthetic diagnostics. Controller owns execution. No network or writes.
import {
  seedWardFlowStateAt,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import {
  GENDER_PLACEMENT_REASONS,
  OVERRIDE_REASONS,
  RELEASE_PULL_REASONS,
} from "../src/components/ward-management/ward-change-reasons";
import { TRANSPORT_PROVIDERS } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { communityTeamOptions } from "../src/components/ward-management/referrals/referral-destination-options";
import {
  CANCEL_TRANSPORT_REASONS,
  WARD_REQUEST_WITHDRAWAL_REASONS,
} from "../src/components/ward-management/ward-change-reasons";

const id = "WF-012",
  unitId = "rph-adult-secure",
  now = NOW_ANCHOR;
const movement = (s: WardFlowState, mid = id) => s.movements.find((m) => m.id === mid)!;
const unit = (s: WardFlowState) => s.units.find((u) => u.id === unitId)!;
const apply = (s: WardFlowState, e: WardFlowEvent) => {
  const next = wardFlowReducer(s, e);
  const refused = next.rejections.slice(s.rejections.length);
  if (refused.length) throw new Error(`Setup ${e.type}: ${JSON.stringify(refused)}`);
  return next;
};
function beforePull(): WardFlowState {
  let s = seedWardFlowStateAt(0);
  s = {
    ...s,
    movements: s.movements.map((m) => (m.id === id ? { ...m, security: "Secure" } : m)),
    units: s.units.map((u) =>
      u.id === unitId
        ? {
            ...u,
            beds: 20,
            lockedBeds: 20,
            allocatableLocked: 6,
            allocatable: { ...u.allocatable, value: 6, confirmedAt: now },
            empty: { ...u.empty, value: 6, confirmedAt: now },
          }
        : u,
    ),
    bedReleases: s.bedReleases.filter((r) => r.unitId !== unitId),
  };
  s = apply(s, {
    type: "REFER_TO_UNITS",
    role: "coordinator",
    now,
    movementId: id,
    unitIds: [unitId],
    genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
    genderPlacementChecked: true,
  });
  return apply(s, { type: "ACCEPT_IN_PRINCIPLE", role: "ward", now, movementId: id, unitId });
}
function pulled() {
  return apply(beforePull(), { type: "PULL_PATIENT", role: "ward", now, movementId: id, unitId });
}
function book(s: WardFlowState) {
  return apply(s, {
    type: "BOOK_TRANSPORT",
    role: "ed",
    now,
    movementId: id,
    provider: TRANSPORT_PROVIDERS[0],
    escortRequired: false,
    cadNumber: "SYNTHETIC-AUDIT",
    transportLegalStatus: "voluntary",
    estimatedAt: now + 20,
  });
}

describe("23 September engine audit repairs", () => {
  it("invalidates a pre-pull capacity draft and allows a fresh ward observation", () => {
    const initial = beforePull();
    const captured = unit(initial).allocatable;
    const held = apply(initial, { type: "PULL_PATIENT", role: "ward", now, movementId: id, unitId });
    expect(unit(held).allocatable.revision).toBe((captured.revision ?? 0) + 1);
    const stale = wardFlowReducer(held, {
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now: now + 1,
      unitId,
      actingUnitId: unitId,
      value: 6,
      expectedRevision: captured.revision ?? 0,
    });
    expect(stale.rejections).toHaveLength(held.rejections.length + 1);
    expect(stale.units).toBe(held.units);
    const fresh = apply(held, {
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now: now + 1,
      unitId,
      actingUnitId: unitId,
      value: 6,
      expectedRevision: unit(held).allocatable.revision ?? 0,
    });
    expect(unit(fresh).allocatable.value).toBe(6);
    expect(movement(fresh).admissionId).toBe(movement(held).admissionId);
  });
  it("requires an observed capacity revision and advances it again on release", () => {
    const initial = pulled();
    const missing = wardFlowReducer(initial, {
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now,
      unitId,
      actingUnitId: unitId,
      value: 6,
    });
    expect(missing.units).toBe(initial.units);
    expect(missing.rejections).toHaveLength(initial.rejections.length + 1);
    const released = apply(initial, {
      type: "RELEASE_PULL",
      role: "ward",
      actingUnitId: unitId,
      now: now + 1,
      movementId: id,
      reason: RELEASE_PULL_REASONS[0],
    });
    expect(unit(released).allocatable.revision).toBe((unit(initial).allocatable.revision ?? 0) + 1);
    expect(unit(released).allocatable.value).toBe(6);
  });
  it("never seeds a calculated current legal clock or an unproven expiry", () => {
    for (const item of seedWardFlowStateAt(0).movements) {
      expect(item.legalClock, item.id).toBeUndefined();
      if (item.legalForm?.dueAt !== undefined) {
        // Six pre-existing explicitly authored synthetic examples, not statutory calculations.
        const authored: Record<string, number> = {
          "WF-004": 300,
          "WF-006": 90,
          "WF-011": 340,
          "WF-014": 60,
          "WF-023": 400,
          "WF-025": 150,
        };
        expect(item.legalForm.dueAt, item.id).toBe(NOW_ANCHOR + authored[item.id]);
      }
    }
  });
  it("retains entered expiry and history on receipt, and permits an initial correction of legacy calculated data", () => {
    let state = seedWardFlowStateAt(0);
    state = {
      ...state,
      movements: state.movements.map((m) =>
        m.id === "WF-001"
          ? {
              ...m,
              legalForm: { code: "1A", kind: "examination", dueAt: now + 5000 },
              legalClock: { code: "1A", startedAt: now - 1, expiresAt: now + 5000, basis: "written" },
              legalFormExpiryHistory: [{ at: now - 1, by: "ed", dueAt: now + 5000, basis: "written_on_form" }],
              legalFormReceivedAt: undefined,
            }
          : m,
      ),
    };
    state = apply(state, { type: "RECORD_LEGAL_FORM_EXPIRY", role: "ed", now, movementId: "WF-001", dueAt: now + 5 });
    const current = movement(state, "WF-001");
    const received = apply(state, {
      type: "RECORD_LEGAL_FORM_RECEIVED",
      role: "ed",
      now: now + 1,
      movementId: "WF-001",
    });
    expect(movement(received, "WF-001").legalForm).toEqual(current.legalForm);
    expect(movement(received, "WF-001").legalFormExpiryHistory).toEqual(current.legalFormExpiryHistory);
    expect(movement(received, "WF-001").legalClock).toBeUndefined();
    const early = wardFlowReducer(received, {
      type: "RECORD_LEGAL_FORM_EXPIRY",
      role: "ed",
      now: now + 2,
      movementId: "WF-001",
      dueAt: now + 4,
    });
    expect(early.movements).toBe(received.movements);
  });
  it("retains a newer entered expiry even when a stale legacy clock remains", () => {
    let state = seedWardFlowStateAt(0);
    state = {
      ...state,
      movements: state.movements.map((m) =>
        m.id === "WF-001"
          ? {
              ...m,
              legalForm: { code: "1A", dueAt: now + 100 },
              legalClock: { code: "1A", startedAt: now - 1, expiresAt: now + 5000, basis: "written" },
              legalFormExpiryHistory: [{ at: now, by: "ed", dueAt: now + 100, basis: "written_on_form" }],
            }
          : m,
      ),
    };
    const next = wardFlowReducer(state, {
      type: "RECORD_LEGAL_FORM_EXPIRY",
      role: "ed",
      now: now + 1,
      movementId: "WF-001",
      dueAt: now + 50,
    });
    expect(next.movements).toBe(state.movements);
    expect(next.rejections.at(-1)?.reason).toContain("must be later");
  });
  it("preserves extension ordering for an authored paper expiry without inventing an actor history", () => {
    const state = seedWardFlowStateAt(0);
    const before = movement(state, "WF-004");
    expect(before.legalFormExpiryHistory).toBeUndefined();
    const next = wardFlowReducer(state, {
      type: "RECORD_LEGAL_FORM_EXPIRY",
      role: "ed",
      now,
      movementId: before.id,
      dueAt: before.legalForm!.dueAt! - 1,
    });
    expect(next.movements).toBe(state.movements);
    expect(next.rejections.at(-1)?.reason).toContain("must be later");
  });
  it("preserves entered 3D expiry and receipt when updating the same form's written time", () => {
    let state = seedWardFlowStateAt(0);
    state = apply(state, {
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "ed",
      now,
      movementId: "WF-001",
      formCode: "3D",
      writtenAt: now - 5,
      paperExpiresAt: now + 100,
    });
    state = apply(state, { type: "RECORD_LEGAL_FORM_RECEIVED", role: "ed", now, movementId: "WF-001" });
    const before = movement(state, "WF-001");
    const changed = apply(state, {
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "ed",
      now: now + 1,
      movementId: "WF-001",
      formCode: "3D",
      writtenAt: now - 2,
    });
    expect(movement(changed, "WF-001").formedAt).toBe(now - 2);
    expect(movement(changed, "WF-001").legalForm).toEqual(before.legalForm);
    expect(movement(changed, "WF-001").legalFormReceivedAt).toBe(before.legalFormReceivedAt);
    expect(movement(changed, "WF-001").legalFormExpiryHistory).toEqual(before.legalFormExpiryHistory);
    const replaced = apply(changed, {
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "ed",
      now: now + 2,
      movementId: "WF-001",
      formCode: "5A",
      writtenAt: now + 2,
    });
    expect(movement(replaced, "WF-001").legalForm?.dueAt).toBeUndefined();
    expect(movement(replaced, "WF-001").legalFormReceivedAt).toBeUndefined();
    expect(movement(replaced, "WF-001").legalFormExpiryHistory).toEqual(before.legalFormExpiryHistory);
  });
  it("does not preserve a calculated legacy expiry while editing the same form time", () => {
    const initial = seedWardFlowStateAt(0);
    const state = {
      ...initial,
      movements: initial.movements.map((m) =>
        m.id === "WF-001"
          ? {
              ...m,
              legalForm: { code: "1A", dueAt: now + 50 },
              legalClock: { code: "1A" as const, startedAt: now - 1, expiresAt: now + 50, basis: "written" as const },
            }
          : m,
      ),
    };
    const next = apply(state, {
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "ed",
      now,
      movementId: "WF-001",
      formCode: "1A",
      writtenAt: now - 2,
    });
    expect(movement(next, "WF-001").legalForm?.dueAt).toBeUndefined();
    expect(movement(next, "WF-001").legalClock).toBeUndefined();
  });
  it.each(["RECORD_LEGAL_FORM_WRITTEN", "RECORD_LEGAL_FORM_CONTINUATION"] as const)(
    "%s replaces current authority and retains separate history",
    (type) => {
      let state = seedWardFlowStateAt(0);
      state = apply(state, {
        type: "RECORD_LEGAL_FORM_EXPIRY",
        role: "ed",
        now,
        movementId: "WF-001",
        dueAt: now + 100,
      });
      const history = movement(state, "WF-001").legalFormExpiryHistory;
      const event =
        type === "RECORD_LEGAL_FORM_WRITTEN"
          ? { type, role: "ed" as const, now: now + 1, movementId: "WF-001", formCode: "5A", writtenAt: now + 1 }
          : { type, role: "ed" as const, now: now + 1, movementId: "WF-001", formCode: "5B", startedAt: now + 1 };
      const replaced = apply(state, event);
      expect(movement(replaced, "WF-001").legalForm?.dueAt).toBeUndefined();
      expect(movement(replaced, "WF-001").legalClock).toBeUndefined();
      expect(movement(replaced, "WF-001").legalFormExpiryHistory).toEqual(history);
      const typed = apply(replaced, { ...event, now: now + 2, paperExpiresAt: now + 10 });
      expect(movement(typed, "WF-001").legalForm?.dueAt).toBe(now + 10);
      expect(movement(typed, "WF-001").legalFormExpiryHistory?.at(-1)).toMatchObject({
        dueAt: now + 10,
        basis: "written_on_form",
      });
      const invalid = wardFlowReducer(typed, { ...event, now: now + 3, paperExpiresAt: NaN });
      expect(invalid.movements).toBe(typed.movements);
    },
  );
  it("records exact consumed override gates and their audit fact, but ignores unused reasons", () => {
    let initial = beforePull();
    initial = { ...initial, units: initial.units.map((u) => (u.id === unitId ? { ...u, allocatableLocked: 0 } : u)) };
    const accepted = apply(initial, {
      type: "PULL_PATIENT",
      role: "ward",
      now,
      movementId: id,
      unitId,
      overrideReason: OVERRIDE_REASONS[0],
    });
    const added = movement(accepted).overrides.slice(movement(initial).overrides.length);
    expect(added).toEqual([
      expect.objectContaining({ gate: "locked_bed_capacity", reason: OVERRIDE_REASONS[0], unitIds: [unitId], at: now }),
    ]);
    expect(accepted.auditEvents.at(-1)).toMatchObject({
      category: "override",
      details: { overrideFactRecorded: true },
    });
    const clean = beforePull();
    const ordinary = apply(clean, {
      type: "PULL_PATIENT",
      role: "ward",
      now,
      movementId: id,
      unitId,
      overrideReason: OVERRIDE_REASONS[0],
    });
    expect(movement(ordinary).overrides).toEqual(movement(clean).overrides);
    expect(ordinary.auditEvents.at(-1)).toMatchObject({
      category: "override",
      details: { overrideFactRecorded: false },
    });
  });
  it("records both exhausted staffing gates once on the same accepted pull", () => {
    const initial = beforePull();
    const state = {
      ...initial,
      movements: initial.movements.map((m) => (m.id === id ? { ...m, specialling: true, highAcuity: true } : m)),
      units: initial.units.map((u) => (u.id === unitId ? { ...u, speciallingCapacity: 0, highAcuityCapacity: 0 } : u)),
    };
    const next = apply(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now,
      movementId: id,
      unitId,
      overrideReason: OVERRIDE_REASONS[0],
      numConsulted: true,
    });
    const added = movement(next).overrides.slice(movement(initial).overrides.length);
    expect(added.map((entry) => entry.gate)).toEqual(["specialling_staffing", "high_acuity_staffing"]);
    expect(added[0].numConsulted).toBeUndefined();
    expect(added[1].numConsulted).toBe(true);
  });
  it("restored pulls record only the staffing override actually required", () => {
    let state = pulled();
    state = apply(state, {
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      now: now + 1,
      movementId: id,
      to: "accepted_awaiting_bed",
      reason: "recorded_in_error",
    });
    state = {
      ...state,
      movements: state.movements.map((m) => (m.id === id ? { ...m, highAcuity: true } : m)),
      units: state.units.map((u) => (u.id === unitId ? { ...u, highAcuityCapacity: 0 } : u)),
    };
    const restored = apply(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: now + 2,
      movementId: id,
      unitId,
      overrideReason: OVERRIDE_REASONS[0],
      numConsulted: true,
    });
    expect(movement(restored).overrides.at(-1)).toMatchObject({ gate: "high_acuity_staffing", numConsulted: true });
    expect(restored.auditEvents.at(-1)).toMatchObject({
      category: "override",
      details: { overrideFactRecorded: true },
    });
    expect(restored.admissions).toBe(state.admissions);
  });
  it("reconciles transport need in both directions without losing recorded physical arrival", () => {
    let state = apply(pulled(), { type: "RECORD_TRANSPORT_NEED", role: "ed", now, movementId: id, needed: false });
    state = book(state);
    state = apply(state, { type: "RECORD_TRANSPORT_NEED", role: "ed", now: now + 1, movementId: id, needed: true });
    expect(movement(state).transport?.needed).toBe(true);
    const premature = wardFlowReducer(state, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      actingUnitId: unitId,
      now: now + 2,
      movementId: id,
    });
    expect(premature.movements).toBe(state.movements);
    // Owner-approved rule (25 Sept 2026): "not needed" is refused while a booked job is live, so the
    // booked job is cancelled first; the refusal itself is asserted here rather than bypassed.
    const refusedWhileBooked = wardFlowReducer(state, {
      type: "RECORD_TRANSPORT_NEED",
      role: "ed",
      now: now + 2,
      movementId: id,
      needed: false,
    });
    expect(refusedWhileBooked.rejections.length).toBe(state.rejections.length + 1);
    const cancelled = apply(state, {
      type: "CANCEL_TRANSPORT",
      role: "coordinator",
      now: now + 2,
      movementId: id,
      reason: CANCEL_TRANSPORT_REASONS[0],
    });
    const noVehicle = apply(cancelled, {
      type: "RECORD_TRANSPORT_NEED",
      role: "ed",
      now: now + 2,
      movementId: id,
      needed: false,
    });
    expect(movement(noVehicle).transportNeed?.needed).toBe(false);
    expect(
      movement(
        apply(noVehicle, { type: "PATIENT_ARRIVED", role: "ward", actingUnitId: unitId, now: now + 3, movementId: id }),
      ).stage,
    ).toBe("arrived");
    state = apply(state, { type: "HANDOVER_READY", role: "ed", now: now + 2, movementId: id });
    for (const type of ["TRANSPORT_ACCEPTED", "TRANSPORT_EN_ROUTE", "PATIENT_COLLECTED"] as const)
      state = apply(state, { type, role: "officer", now: now + 3, movementId: id });
    // Once collected, "not needed" is refused too (the vehicle is on the road); the recorded physical
    // collection must survive to arrival either way.
    const lateNotNeeded = wardFlowReducer(state, {
      type: "RECORD_TRANSPORT_NEED",
      role: "ed",
      now: now + 4,
      movementId: id,
      needed: false,
    });
    expect(lateNotNeeded.rejections.length).toBe(state.rejections.length + 1);
    const arrived = apply(state, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      actingUnitId: unitId,
      now: now + 5,
      movementId: id,
    });
    expect(movement(arrived).transport?.collectedAt).toBe(now + 3);
    expect(movement(arrived).stage).toBe("arrived");
  });
  it.each([false, true])("community retry retains withdrawn history (withdrawn=%s)", (withdrawn) => {
    let state = beforePull();
    const team = communityTeamOptions()[0];
    const referral = state.referrals[0];
    state = {
      ...state,
      movements: state.movements.map((m) =>
        m.id === id
          ? {
              ...m,
              referralId: referral.id,
              patientId: referral.patientId,
              legalForm: undefined,
              legalStatus: "Voluntary",
            }
          : m,
      ),
      referrals: state.referrals.map((r) =>
        r.id === referral.id
          ? { ...r, destinations: [{ destination: { kind: "community_team", teamName: team }, state: "queued" }] }
          : r,
      ),
    };
    if (withdrawn)
      state = apply(state, {
        type: "RECORD_REFERRER_WITHDRAWAL",
        role: "coordinator",
        now,
        movementId: id,
        referralId: referral.id,
        destinationKind: "community_team",
        reason: WARD_REQUEST_WITHDRAWAL_REASONS[0],
      } as WardFlowEvent);
    const next = apply(state, { type: "REFER_TO_COMMUNITY_TEAM", role: "ed", now: now + 1, movementId: id, team });
    expect(next.referrals.length).toBe(state.referrals.length + (withdrawn ? 1 : 0));
    const live = next.referrals.find(
      (r) => r.id === next.notices.findLast((n) => n.kind === "community_referral_received")?.about.referralId,
    );
    expect(live?.destinations.some((a) => a.state === "queued" && a.withdrawnAt === undefined)).toBe(true);
    if (withdrawn) expect(next.referrals.find((r) => r.id === referral.id)?.destinations[0].withdrawnAt).toBe(now);
  });
  it("clearance writes agree within an explicit episode and never spread by patient ID", () => {
    let state = beforePull();
    const referral = state.referrals[0];
    state = {
      ...state,
      movements: state.movements.map((m) =>
        m.id === id
          ? { ...m, referralId: referral.id, patientId: referral.patientId }
          : m.id === "WF-001"
            ? { ...m, referralId: undefined, patientId: referral.patientId }
            : m,
      ),
    };
    state = apply(state, { type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE", role: "ed", now, movementId: id, cleared: true });
    const unrelated = movement(state, "WF-001");
    state = apply(state, {
      type: "RECORD_MEDICAL_CLEARANCE",
      role: "ed",
      now: now + 1,
      referralId: referral.id,
      cleared: false,
    });
    expect(movement(state).medicalClearance).toEqual({ cleared: false, at: now + 1 });
    expect(state.referrals.find((r) => r.id === referral.id)?.medicalClearance).toEqual(
      movement(state).medicalClearance,
    );
    expect(movement(state, "WF-001")).toBe(unrelated);
  });
  it("does not propagate clearance through an inconsistent explicit patient link", () => {
    let state = beforePull();
    const referral = state.referrals[0];
    const otherPatient = state.patients.find((p) => p.id !== referral.patientId)!;
    state = {
      ...state,
      movements: state.movements.map((m) =>
        m.id === id ? { ...m, referralId: referral.id, patientId: otherPatient.id } : m,
      ),
    };
    const before = movement(state);
    const next = apply(state, {
      type: "RECORD_MEDICAL_CLEARANCE",
      role: "ed",
      now,
      referralId: referral.id,
      cleared: false,
    });
    expect(movement(next)).toBe(before);
    const own = apply(next, {
      type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
      role: "ed",
      now: now + 1,
      movementId: id,
      cleared: true,
    });
    expect(own.referrals.find((r) => r.id === referral.id)?.medicalClearance).toEqual({ cleared: false, at: now });
  });
  it.each([NaN, Infinity, -Infinity])("refuses non-finite written and continuation times (%s)", (invalid) => {
    const state = seedWardFlowStateAt(0);
    for (const event of [
      {
        type: "RECORD_LEGAL_FORM_WRITTEN" as const,
        role: "ed" as const,
        now,
        movementId: "WF-001",
        formCode: "1A",
        writtenAt: invalid,
      },
      {
        type: "RECORD_LEGAL_FORM_CONTINUATION" as const,
        role: "ed" as const,
        now,
        movementId: "WF-002",
        formCode: "5B",
        startedAt: invalid,
      },
    ]) {
      const next = wardFlowReducer(state, event);
      expect(next.movements).toBe(state.movements);
      expect(next.rejections).toHaveLength(state.rejections.length + 1);
    }
  });
  it.each([
    { formName: "", fileName: "synthetic.pdf", sizeBytes: 512 },
    { formName: "  ", fileName: "synthetic.pdf", sizeBytes: 512 },
    { formName: "Synthetic details", fileName: "", sizeBytes: 512 },
    { formName: "Synthetic details", fileName: "  ", sizeBytes: 512 },
    ...[undefined, 0, -1, NaN, Infinity, 0.5].map((sizeBytes) => ({
      formName: "Synthetic details",
      fileName: "synthetic.pdf",
      sizeBytes,
    })),
  ])("rejects empty or invalid document details without a business-state change (%j)", (details) => {
    const state = seedWardFlowStateAt(0);
    const next = wardFlowReducer(state, { type: "UPLOAD_PATIENT_FORM", role: "ed", now, movementId: id, ...details });
    expect(next.movements).toBe(state.movements);
    expect(next.rejections).toHaveLength(state.rejections.length + 1);
  });
  it("records only the supplied document metadata without an invented size", () => {
    const state = seedWardFlowStateAt(0);
    const next = apply(state, {
      type: "UPLOAD_PATIENT_FORM",
      role: "ed",
      now,
      movementId: id,
      formName: "Synthetic details",
      fileName: "synthetic.pdf",
      sizeBytes: 512,
    });
    expect(movement(next).uploadedForms?.at(-1)).toMatchObject({
      formName: "Synthetic details",
      fileName: "synthetic.pdf",
      sizeBytes: 512,
      uploadedAt: now,
      uploadedBy: "ed",
    });
    expect(movement(next).uploadedForms?.length).toBe((movement(state).uploadedForms?.length ?? 0) + 1);
  });
  it.each([undefined, "another-ward"])("requires matching ward scope for morning counts (%s)", (actingUnitId) => {
    const initial = seedWardFlowStateAt(0);
    const next = wardFlowReducer(initial, {
      type: "CONFIRM_MORNING_ROLLUP",
      role: "ward",
      now,
      unitId,
      actingUnitId,
      expectedDischarges: 3,
    });
    expect(next.morningRollupConfirmations).toBe(initial.morningRollupConfirmations);
    expect(next.rejections).toHaveLength(initial.rejections.length + 1);
  });
  it.each([NaN, Infinity, -1, 0.5])("rejects malformed morning count %s", (expectedDischarges) => {
    const initial = seedWardFlowStateAt(0);
    const next = wardFlowReducer(initial, {
      type: "CONFIRM_MORNING_ROLLUP",
      role: "ward",
      now,
      unitId,
      actingUnitId: unitId,
      expectedDischarges,
    });
    expect(next.morningRollupConfirmations).toBe(initial.morningRollupConfirmations);
    expect(next.rejections).toHaveLength(initial.rejections.length + 1);
  });
  it("permits a scoped ward count and the coordinator's cross-ward count", () => {
    let state = seedWardFlowStateAt(0);
    state = apply(state, {
      type: "CONFIRM_MORNING_ROLLUP",
      role: "ward",
      now,
      unitId,
      actingUnitId: unitId,
      expectedDischarges: 0,
    });
    state = apply(state, {
      type: "CONFIRM_MORNING_ROLLUP",
      role: "coordinator",
      now: now + 1,
      unitId,
      expectedDischarges: 2,
    });
    expect(state.morningRollupConfirmations[unitId].expectedDischarges).toBe(2);
  });
});
