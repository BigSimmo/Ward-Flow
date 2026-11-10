import { describe, expect, it } from "vitest";

import {
  applyCommand,
  scopeWorld,
  scopedActNowAlerts,
  seedWorld,
  worldNow,
  type SharedWorld,
} from "../backend/ward-flow/engine";
import { eligibility } from "../src/components/ward-management/ward-eligibility";
import type { WardAccess } from "../src/components/ward-management/ward-role-access";

/**
 * Master audit M115 (10 Nov 2026): moving a patient moves who can see them. Two desks, ward A and
 * ward B, read the shared workspace the way each poll does (`scopeWorld`, `scopedActNowAlerts` on the
 * stored world as it stands after each saved command). Synthetic seed only; offline.
 */
const at = new Date("2026-10-20T10:00:00Z");
const ward = (unitId: string): WardAccess => ({ role: "ward", scope: { kind: "ward", unitIds: [unitId] } });

function transferFixture() {
  const world = structuredClone(seedWorld(at)) as SharedWorld;
  const state = world.state;
  const now = worldNow(world, at);
  // A stay on ward A with its placement record (an arrived movement) linked, as a real stay has.
  // Built as tests/ward-adversarial-transfer-recovery.test.ts builds it: synthetic ids only.
  const admission = state.admissions.find((a) => a.state === "occupied" && a.patientId);
  if (!admission?.patientId) throw new Error("the seed needs an occupied stay");
  const cohort = state.units.find((u) => u.id === admission.unitId)?.cohort;
  const movement = structuredClone(state.movements.find((m) => m.cohort === cohort)!);
  movement.id = "WF-SYN-M115";
  delete movement.referralId;
  delete movement.sourceAdmissionId;
  delete movement.referralSourceAdmissionId;
  movement.closure = { at: now, outcome: "arrived", reason: "Synthetic fixture arrival" };
  movement.admissionId = admission.id;
  movement.patientId = admission.patientId;
  movement.stage = "arrived";
  movement.acceptedUnitId = admission.unitId;
  state.movements.push(movement);
  admission.movementId = movement.id;
  state.units = state.units.map((u) => ({
    ...u,
    allocatable: { ...u.allocatable, confirmedAt: now },
    empty: { ...u.empty, confirmedAt: now },
  }));
  const unitA = admission.unitId;
  // Ward B: eligible, with a free bed, and with nothing of this patient's on it before the move.
  const before = (unitId: string) => scopeWorld(world, ward(unitId), at).state;
  const unitB = state.units.find(
    (u) =>
      u.id !== unitA &&
      eligibility(movement, u, now).eligible &&
      u.empty.value > 0 &&
      u.allocatableLocked > 0 &&
      !before(u.id).patients.some((p) => p.id === admission.patientId),
  )?.id;
  if (!unitB) throw new Error("the seed needs a second eligible ward with a free bed");
  return { world, admission, patientId: admission.patientId, unitA, unitB };
}

function step(world: SharedWorld, admissionId: string, patientId: string, unitB: string, name: string) {
  const result = applyCommand(
    world,
    {
      type: "RECORD_ADMISSION_CARE",
      role: "coordinator",
      admissionId,
      patientId,
      expectedGeneration: world.state.worldGeneration,
      expectedRevision: world.state.dischargeRevisions[admissionId] ?? 0,
      change: { kind: "transfer", receivingUnitId: unitB, step: name },
    },
    at,
  );
  expect(result.outcome, `${name}: ${result.reason ?? ""}`).toBe("accepted");
  return result.world;
}

const liveStays = (world: SharedWorld, unitId: string, patientId: string) =>
  scopeWorld(world, ward(unitId), at).state.admissions.filter(
    (a) => a.patientId === patientId && a.state !== "departed",
  );

describe("M115: a transfer from ward A to ward B moves the record between the two desks", () => {
  it("ward A holds the live stay before the move and ward B holds nothing of the patient", () => {
    const { world, patientId, unitA, unitB } = transferFixture();
    expect(liveStays(world, unitA, patientId)).toHaveLength(1);
    expect(scopeWorld(world, ward(unitB), at).state.patients.some((p) => p.id === patientId)).toBe(false);
  });

  it("on the first read after the arrival is saved, ward B gains the live stay and ward A loses it", () => {
    const { world, admission, patientId, unitA, unitB } = transferFixture();
    let next = world;
    for (const name of ["accepted", "handover", "arrived"]) next = step(next, admission.id, patientId, unitB, name);
    // Ward B: the patient and one live stay on its own ward.
    const b = scopeWorld(next, ward(unitB), at).state;
    expect(b.patients.some((p) => p.id === patientId)).toBe(true);
    const bStays = liveStays(next, unitB, patientId);
    expect(bStays).toHaveLength(1);
    expect(bStays[0]!.unitId).toBe(unitB);
    // Ward A: no live stay. The old stay may remain as a departed one (the hand-off window), never occupied.
    expect(liveStays(next, unitA, patientId)).toEqual([]);
    const aOld = scopeWorld(next, ward(unitA), at).state.admissions.find((a) => a.id === admission.id);
    if (aOld) expect(aOld.state).toBe("departed");
    // Ward A's copy carries nothing about the new stay on ward B.
    expect(JSON.stringify(scopeWorld(next, ward(unitA), at).state.admissions)).not.toContain(bStays[0]!.id);
  });

  it("ward A's phone alerts name nothing of the moved patient or the new stay", () => {
    const { world, admission, patientId, unitA, unitB } = transferFixture();
    let next = world;
    for (const name of ["accepted", "handover", "arrived"]) next = step(next, admission.id, patientId, unitB, name);
    const newStay = liveStays(next, unitB, patientId)[0]!;
    for (const alert of scopedActNowAlerts(next, ward(unitA), at)) {
      expect(alert.id).not.toContain(newStay.id);
      expect(alert.id).not.toContain(patientId);
      expect(alert.id).not.toContain("WF-SYN-M115");
    }
  });

  // Not provable offline here: the open patient drawer on ward A's screen closing on that poll. The
  // drawer reads the scoped snapshot, so it needs a two-desk browser or shared-provider DOM test.
  it.todo("closes an open patient drawer on ward A within one poll after the patient arrives on ward B");
});
