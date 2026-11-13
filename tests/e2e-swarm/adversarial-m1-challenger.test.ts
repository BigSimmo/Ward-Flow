import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { testRunLockInternals } from "../../scripts/test-run-lock.mjs";
import { createIsolatedState, createTestJourney } from "./helpers/test-harness";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { openRestrictivePracticeRefusal } from "@/components/ward-management/restrictive-practice/ward-restrictive-practice";
import type { Admission, Movement } from "@/components/ward-management/ward-model";

const TEST_NOW = NOW_ANCHOR;

describe("Adversarial Challenger M1 — Focus Area 1: PID 4 Deadlock & Lock Directory Reclaims", () => {
  it("strictly returns false for Windows NT Kernel PID 4 and Unix Init PID 1 under non-sentinel checks", () => {
    // When checking actual process liveness (allowSentinel: false), PIDs 4 and 1 must be treated as dead
    expect(testRunLockInternals.processIsAlive(4, { allowSentinel: false })).toBe(false);
    expect(testRunLockInternals.processIsAlive(1, { allowSentinel: false })).toBe(false);

    // Negative, zero, float, and NaN must always return false
    expect(testRunLockInternals.processIsAlive(0, { allowSentinel: false })).toBe(false);
    expect(testRunLockInternals.processIsAlive(-4, { allowSentinel: false })).toBe(false);
    expect(testRunLockInternals.processIsAlive(4.5 as unknown as number, { allowSentinel: false })).toBe(false);
    expect(testRunLockInternals.processIsAlive(NaN, { allowSentinel: false })).toBe(false);
  });

  it("reclaims stale lock directory when owner is coordinator sentinel with dead holderPid", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wf-adv-lock-"));
    try {
      const ownerPath = path.join(tempDir, "owner.json");
      fs.writeFileSync(
        ownerPath,
        JSON.stringify({
          pid: 4,
          holderPid: 99999999, // guaranteed dead process
          coordinator: true,
          startedAt: new Date(Date.now() - 60_000).toISOString(),
        }),
      );

      const isStale = testRunLockInternals.ownerDirectoryIsStale(tempDir);
      expect(isStale).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it("reclaims stale legacy lock directory with pid: 4 when older than incompleteLockGraceMs", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wf-adv-lock-legacy-"));
    try {
      const ownerPath = path.join(tempDir, "owner.json");
      fs.writeFileSync(
        ownerPath,
        JSON.stringify({
          pid: 4, // legacy lock with no holderPid
          startedAt: new Date(Date.now() - 60_000).toISOString(),
        }),
      );

      // Artificially age the directory mtime past 30s
      const pastTime = (Date.now() - 45_000) / 1000;
      fs.utimesSync(tempDir, pastTime, pastTime);

      const isStale = testRunLockInternals.ownerDirectoryIsStale(tempDir);
      expect(isStale).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it("never reclaims a lock directory owned by a live parent process", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wf-adv-lock-live-"));
    try {
      const ownerPath = path.join(tempDir, "owner.json");
      fs.writeFileSync(
        ownerPath,
        JSON.stringify({
          pid: 4,
          holderPid: process.pid, // current running process is definitely alive
          coordinator: true,
          startedAt: new Date().toISOString(),
        }),
      );

      const isStale = testRunLockInternals.ownerDirectoryIsStale(tempDir);
      expect(isStale).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it("reclaims lock directory when registered children are all dead", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wf-adv-lock-child-"));
    try {
      const ownerPath = path.join(tempDir, "owner.json");
      const token = "adv-test-token";
      fs.writeFileSync(
        ownerPath,
        JSON.stringify({
          pid: 4,
          holderPid: 99999999,
          token,
          coordinator: true,
        }),
      );

      const childrenDir = path.join(tempDir, "children");
      fs.mkdirSync(childrenDir);
      fs.writeFileSync(
        path.join(childrenDir, "child-1.json"),
        JSON.stringify({
          token,
          state: "running",
          guardianPid: 99999998, // dead
          childPid: 99999997, // dead
        }),
      );

      const isStale = testRunLockInternals.ownerDirectoryIsStale(tempDir);
      expect(isStale).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });
});

describe("Adversarial Challenger M1 — Focus Area 2: Medical Clearance Affirmative Check (cleared !== true)", () => {
  it("rejects BOOK_TRANSPORT across all non-true and falsy/malformed clearance values", () => {
    // 1. undefined (unassessed)
    const jUndefined = createTestJourney();
    jUndefined.bookTransport();
    expect(jUndefined.currentMovement().transport).toBeUndefined();
    expect(jUndefined.lastRejection()).toContain("Medical clearance");

    // 2. boolean false (explicit un-clearance)
    const jFalse = createTestJourney({ initialClearance: false });
    jFalse.bookTransport();
    expect(jFalse.currentMovement().transport).toBeUndefined();
    expect(jFalse.lastRejection()).toContain("Medical clearance");

    // 3. null
    const jNull = createTestJourney();
    jNull.send({
      type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
      role: "ed",
      movementId: jNull.movementId,
      cleared: null as unknown as boolean,
    } as never);
    jNull.bookTransport();
    expect(jNull.currentMovement().transport).toBeUndefined();
    expect(jNull.lastRejection()).toContain("Medical clearance");

    // 4. string "true" (truthy string, not boolean true)
    const jString = createTestJourney();
    jString.send({
      type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
      role: "ed",
      movementId: jString.movementId,
      cleared: "true" as unknown as boolean,
    } as never);
    jString.bookTransport();
    expect(jString.currentMovement().transport).toBeUndefined();
    expect(jString.lastRejection()).toContain("Medical clearance");

    // 5. number 1 (truthy integer, not boolean true)
    const jNumber = createTestJourney();
    jNumber.send({
      type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
      role: "ed",
      movementId: jNumber.movementId,
      cleared: 1 as unknown as boolean,
    } as never);
    jNumber.bookTransport();
    expect(jNumber.currentMovement().transport).toBeUndefined();
    expect(jNumber.lastRejection()).toContain("Medical clearance");

    // 6. boolean true (strictly affirmative) MUST SUCCEED
    const jTrue = createTestJourney({ initialClearance: true });
    jTrue.bookTransport();
    expect(jTrue.currentMovement().transport).toBeDefined();
    expect(jTrue.state.rejections).toHaveLength(0);
  });

  it("adversarially blocks downstream transport steps if cleared !== true", () => {
    const j = createTestJourney(); // unassessed

    // Try HANDOVER_READY without clearance
    j.send({ type: "HANDOVER_READY", role: "ed", movementId: j.movementId } as never);
    expect(j.lastRejection()).toContain("Medical clearance");

    // Try TRANSPORT_ACCEPTED without clearance
    j.send({ type: "TRANSPORT_ACCEPTED", role: "officer", movementId: j.movementId } as never);
    expect(j.lastRejection()).toContain("Medical clearance");

    // Try TRANSPORT_EN_ROUTE without clearance
    j.send({ type: "TRANSPORT_EN_ROUTE", role: "officer", movementId: j.movementId } as never);
    expect(j.lastRejection()).toContain("Medical clearance");

    // Try PATIENT_COLLECTED without clearance
    j.send({ type: "PATIENT_COLLECTED", role: "officer", movementId: j.movementId } as never);
    expect(j.lastRejection()).toContain("Medical clearance");
  });

  it("blocks collection if clearance is revoked after booking", () => {
    const j = createTestJourney({ initialClearance: true });
    j.bookTransport();
    j.send({ type: "HANDOVER_READY", role: "ed", movementId: j.movementId } as never);
    j.send({ type: "TRANSPORT_ACCEPTED", role: "officer", movementId: j.movementId } as never);
    j.send({ type: "TRANSPORT_EN_ROUTE", role: "officer", movementId: j.movementId } as never);

    // Clearance revoked while ambulance is en route
    j.recordClearance(false);
    expect(j.currentMovement().medicalClearance?.cleared).toBe(false);

    // Attempt PATIENT_COLLECTED
    j.send({ type: "PATIENT_COLLECTED", role: "officer", movementId: j.movementId } as never);
    expect(j.lastRejection()).toContain("Medical clearance");
    expect(j.currentMovement().stage).toBe("handover_ready"); // collection refused
  });

  it("permits physical arrival for already collected patients even if clearance is subsequently revoked", () => {
    const j = createTestJourney({ initialClearance: true });
    j.bookTransport();
    j.advanceToMoving();
    expect(j.currentMovement().stage).toBe("moving");
    expect(j.currentMovement().transport?.collectedAt).toBeDefined();

    // Revoke clearance while patient is in ambulance transit
    j.recordClearance(false);

    // PATIENT_ARRIVED at receiving ward
    j.send({
      type: "PATIENT_ARRIVED",
      role: "ward",
      movementId: j.movementId,
      actingUnitId: j.unitId,
    } as never);

    // Arrival must NOT be rejected by medical clearance gate (patient is physically at hospital)
    expect(j.currentMovement().stage).toBe("arrived");
  });

  it("rejects BOOK_TRANSPORT on unseeded/default seeded movements without clearance (e.g. WF-001)", () => {
    const state = seedWardFlowState();
    const unclearedMovement = state.movements.find((m) => m.id === "WF-001")!;
    expect(unclearedMovement.medicalClearance).toBeUndefined();

    const result = wardFlowReducer(state, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: TEST_NOW,
      movementId: "WF-001",
      provider: "Ambulance service",
      escortRequired: false,
      cadNumber: "CAD-WF-001",
      transportLegalStatus: "voluntary",
      estimatedAt: TEST_NOW + 60,
    });

    expect(result.rejections.at(-1)?.attempted).toBe("BOOK_TRANSPORT");
    expect(result.rejections.at(-1)?.reason).toContain("Medical clearance");
  });
});

describe("Adversarial Challenger M1 — Focus Area 3: Restrictive Practice Refusal During Collection", () => {
  const send = (state: WardFlowState, event: Record<string, unknown>): WardFlowState => {
    return wardFlowReducer(state, { ...event, now: event.now ?? TEST_NOW } as WardFlowEvent);
  };

  it("blocks PATIENT_COLLECTED when sending ward has active seclusion on source stay", () => {
    let state = createIsolatedState();
    const sourceStay = state.admissions.find((a: Admission) => a.state === "occupied")!;
    const sendingUnitId = sourceStay.unitId;
    const destUnitId = "scgh-adult-open";

    // Start seclusion on source admission
    state = send(state, {
      type: "RECORD_RESTRICTIVE_PRACTICE_START",
      role: "ward",
      unitId: sendingUnitId,
      actingUnitId: sendingUnitId,
      admissionId: sourceStay.id,
      practice: "seclusion",
      startedAt: TEST_NOW - 25,
    });

    const transferMovement: Movement = {
      ...state.movements[0]!,
      id: "WF-ADV-SEC-1",
      stage: "handover_ready" as const,
      sourceAdmissionId: sourceStay.id,
      acceptedUnitId: destUnitId,
      admissionId: "AD-ADV-PULLED",
      medicalClearance: { at: TEST_NOW - 10, cleared: true },
      transport: {
        id: "WF-ADV-SEC-1-transport",
        provider: "Ambulance service",
        escortRequired: false,
        cadNumber: "CAD-ADV-1",
        transportLegalStatus: "voluntary" as const,
        estimatedAt: TEST_NOW + 60,
        acceptedAt: TEST_NOW - 10,
        enRouteAt: TEST_NOW - 5,
        bookedBy: { role: "ed" as const },
      },
    };

    state = {
      ...state,
      movements: [...state.movements, transferMovement],
    };

    // Attempt collection
    state = send(state, {
      type: "PATIENT_COLLECTED",
      role: "officer",
      movementId: "WF-ADV-SEC-1",
    });

    expect(state.rejections.at(-1)?.attempted).toBe("PATIENT_COLLECTED");
    expect(state.rejections.at(-1)?.reason).toContain("Seclusion is still recorded as in use for this patient");

    const m = state.movements.find((x: Movement) => x.id === "WF-ADV-SEC-1")!;
    expect(m.stage).toBe("handover_ready"); // Strictly blocked
    expect(m.transport?.collectedAt).toBeUndefined();
  });

  it("blocks PATIENT_COLLECTED when sending ward has active bodily restraint on source stay", () => {
    let state = createIsolatedState();
    const sourceStay = state.admissions.find((a: Admission) => a.state === "occupied")!;
    const sendingUnitId = sourceStay.unitId;
    const destUnitId = "scgh-adult-open";

    // Start bodily restraint
    state = send(state, {
      type: "RECORD_RESTRICTIVE_PRACTICE_START",
      role: "ward",
      unitId: sendingUnitId,
      actingUnitId: sendingUnitId,
      admissionId: sourceStay.id,
      practice: "bodily_restraint_physical",
      startedAt: TEST_NOW - 15,
    });

    const transferMovement: Movement = {
      ...state.movements[0]!,
      id: "WF-ADV-RES-1",
      stage: "handover_ready" as const,
      sourceAdmissionId: sourceStay.id,
      acceptedUnitId: destUnitId,
      admissionId: "AD-ADV-PULLED-2",
      medicalClearance: { at: TEST_NOW - 10, cleared: true },
      transport: {
        id: "WF-ADV-RES-1-transport",
        provider: "Ambulance service",
        escortRequired: false,
        cadNumber: "CAD-ADV-2",
        transportLegalStatus: "voluntary" as const,
        estimatedAt: TEST_NOW + 60,
        acceptedAt: TEST_NOW - 10,
        enRouteAt: TEST_NOW - 5,
        bookedBy: { role: "ed" as const },
      },
    };

    state = {
      ...state,
      movements: [...state.movements, transferMovement],
    };

    // Attempt collection
    state = send(state, {
      type: "PATIENT_COLLECTED",
      role: "officer",
      movementId: "WF-ADV-RES-1",
    });

    expect(state.rejections.at(-1)?.attempted).toBe("PATIENT_COLLECTED");
    expect(state.rejections.at(-1)?.reason).toContain("Restraint is still recorded as in use for this patient");

    const m = state.movements.find((x: Movement) => x.id === "WF-ADV-RES-1")!;
    expect(m.stage).toBe("handover_ready");
  });

  it("does not block PATIENT_COLLECTED for another patient when seclusion is on a different stay", () => {
    let state = createIsolatedState();
    const occupiedStays = state.admissions.filter((a: Admission) => a.state === "occupied");
    expect(occupiedStays.length).toBeGreaterThanOrEqual(2);

    const secludedStay = occupiedStays[0]!;
    const transferStay = occupiedStays[1]!;
    const destUnitId = "scgh-adult-open";

    // Put secludedStay into seclusion
    state = send(state, {
      type: "RECORD_RESTRICTIVE_PRACTICE_START",
      role: "ward",
      unitId: secludedStay.unitId,
      actingUnitId: secludedStay.unitId,
      admissionId: secludedStay.id,
      practice: "seclusion",
      startedAt: TEST_NOW - 20,
    });

    // Create transfer movement for transferStay (NOT in seclusion)
    const transferMovement: Movement = {
      ...state.movements[0]!,
      id: "WF-ADV-OTHER-PATIENT",
      stage: "handover_ready" as const,
      sourceAdmissionId: transferStay.id,
      acceptedUnitId: destUnitId,
      admissionId: "AD-ADV-PULLED-3",
      medicalClearance: { at: TEST_NOW - 10, cleared: true },
      transport: {
        id: "WF-ADV-OTHER-transport",
        provider: "Ambulance service",
        escortRequired: false,
        cadNumber: "CAD-ADV-3",
        transportLegalStatus: "voluntary" as const,
        estimatedAt: TEST_NOW + 60,
        acceptedAt: TEST_NOW - 10,
        enRouteAt: TEST_NOW - 5,
        bookedBy: { role: "ed" as const },
      },
    };

    state = {
      ...state,
      movements: [...state.movements, transferMovement],
    };

    // Attempt collection of transferStay
    state = send(state, {
      type: "PATIENT_COLLECTED",
      role: "officer",
      movementId: "WF-ADV-OTHER-PATIENT",
    });

    const m = state.movements.find((x: Movement) => x.id === "WF-ADV-OTHER-PATIENT")!;
    expect(m.stage).toBe("moving"); // Should proceed cleanly!
    expect(m.transport?.collectedAt).toBe(TEST_NOW);
  });

  it("does not block PATIENT_COLLECTED for movements without source admissions (e.g. ED source)", () => {
    const j = createTestJourney({ initialClearance: true });
    // ED journey has no sourceAdmissionId
    expect(j.currentMovement().sourceAdmissionId).toBeUndefined();

    j.bookTransport();
    j.send({ type: "HANDOVER_READY", role: "ed", movementId: j.movementId } as never);
    j.send({ type: "TRANSPORT_ACCEPTED", role: "officer", movementId: j.movementId } as never);
    j.send({ type: "TRANSPORT_EN_ROUTE", role: "officer", movementId: j.movementId } as never);

    // Collection should succeed cleanly without crashing on undefined source
    j.send({ type: "PATIENT_COLLECTED", role: "officer", movementId: j.movementId } as never);

    expect(j.currentMovement().stage).toBe("moving");
    expect(j.currentMovement().transport?.collectedAt).toBeDefined();
  });

  it("refuses PATIENT_COLLECTED even when an exception payload is provided if seclusion is active", () => {
    let state = createIsolatedState();
    const sourceStay = state.admissions.find((a: Admission) => a.state === "occupied")!;
    const sendingUnitId = sourceStay.unitId;
    const destUnitId = "scgh-adult-open";

    // Active seclusion
    state = send(state, {
      type: "RECORD_RESTRICTIVE_PRACTICE_START",
      role: "ward",
      unitId: sendingUnitId,
      actingUnitId: sendingUnitId,
      admissionId: sourceStay.id,
      practice: "seclusion",
      startedAt: TEST_NOW - 30,
    });

    const transferMovement: Movement = {
      ...state.movements[0]!,
      id: "WF-ADV-SEC-EXC",
      stage: "handover_ready" as const,
      sourceAdmissionId: sourceStay.id,
      acceptedUnitId: destUnitId,
      admissionId: "AD-ADV-PULLED-4",
      medicalClearance: { at: TEST_NOW - 10, cleared: true },
      transport: {
        id: "WF-ADV-SEC-EXC-transport",
        provider: "Ambulance service",
        escortRequired: false,
        cadNumber: "CAD-ADV-4",
        transportLegalStatus: "voluntary" as const,
        estimatedAt: TEST_NOW + 60,
        acceptedAt: TEST_NOW - 10,
        enRouteAt: TEST_NOW - 5,
        bookedBy: { role: "ed" as const },
      },
    };

    state = {
      ...state,
      movements: [...state.movements, transferMovement],
    };

    // Attempt collection with exception - exception MUST NOT bypass active seclusion!
    state = send(state, {
      type: "PATIENT_COLLECTED",
      role: "officer",
      movementId: "WF-ADV-SEC-EXC",
      exception: {
        reason: "escort_unavailable",
        notes: "Attempted override of restrictive practice",
      },
    });

    expect(state.rejections.at(-1)?.attempted).toBe("PATIENT_COLLECTED");
    expect(state.rejections.at(-1)?.reason).toContain("Seclusion is still recorded as in use for this patient");

    const m = state.movements.find((x: Movement) => x.id === "WF-ADV-SEC-EXC")!;
    expect(m.stage).toBe("handover_ready"); // Not moved
  });

  it("blocks PATIENT_COLLECTED when sending ward has active mechanical bodily restraint", () => {
    let state = createIsolatedState();
    const sourceStay = state.admissions.find((a: Admission) => a.state === "occupied")!;
    const sendingUnitId = sourceStay.unitId;
    const destUnitId = "scgh-adult-open";

    state = send(state, {
      type: "RECORD_RESTRICTIVE_PRACTICE_START",
      role: "ward",
      unitId: sendingUnitId,
      actingUnitId: sendingUnitId,
      admissionId: sourceStay.id,
      practice: "bodily_restraint_mechanical",
      startedAt: TEST_NOW - 15,
    });

    const transferMovement: Movement = {
      ...state.movements[0]!,
      id: "WF-ADV-RES-MECH",
      stage: "handover_ready" as const,
      sourceAdmissionId: sourceStay.id,
      acceptedUnitId: destUnitId,
      admissionId: "AD-ADV-PULLED-5",
      medicalClearance: { at: TEST_NOW - 10, cleared: true },
      transport: {
        id: "WF-ADV-RES-MECH-transport",
        provider: "Ambulance service",
        escortRequired: false,
        cadNumber: "CAD-ADV-5",
        transportLegalStatus: "voluntary" as const,
        estimatedAt: TEST_NOW + 60,
        acceptedAt: TEST_NOW - 10,
        enRouteAt: TEST_NOW - 5,
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
      movementId: "WF-ADV-RES-MECH",
    });

    expect(state.rejections.at(-1)?.attempted).toBe("PATIENT_COLLECTED");
    expect(state.rejections.at(-1)?.reason).toContain("Restraint is still recorded as in use for this patient");
  });

  it("blocks PATIENT_COLLECTED when seclusion ended but bodily restraint remains open", () => {
    let state = createIsolatedState();
    const sourceStay = state.admissions.find((a: Admission) => a.state === "occupied")!;
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
      startedAt: TEST_NOW - 60,
    });

    const unitBeforeEnd = state.units.find((u) => u.id === sendingUnitId)!;
    const seclusionEpisodeId = unitBeforeEnd.restrictivePractice!.episodes.at(-1)!.id;

    // End seclusion
    state = send(state, {
      type: "RECORD_RESTRICTIVE_PRACTICE_END",
      role: "ward",
      unitId: sendingUnitId,
      actingUnitId: sendingUnitId,
      episodeId: seclusionEpisodeId,
      endedAt: TEST_NOW - 20,
    });

    // Start physical restraint
    state = send(state, {
      type: "RECORD_RESTRICTIVE_PRACTICE_START",
      role: "ward",
      unitId: sendingUnitId,
      actingUnitId: sendingUnitId,
      admissionId: sourceStay.id,
      practice: "bodily_restraint_physical",
      startedAt: TEST_NOW - 15,
    });

    const transferMovement: Movement = {
      ...state.movements[0]!,
      id: "WF-ADV-COMBO",
      stage: "handover_ready" as const,
      sourceAdmissionId: sourceStay.id,
      acceptedUnitId: destUnitId,
      admissionId: "AD-ADV-PULLED-6",
      medicalClearance: { at: TEST_NOW - 10, cleared: true },
      transport: {
        id: "WF-ADV-COMBO-transport",
        provider: "Ambulance service",
        escortRequired: false,
        cadNumber: "CAD-ADV-6",
        transportLegalStatus: "voluntary" as const,
        estimatedAt: TEST_NOW + 60,
        acceptedAt: TEST_NOW - 10,
        enRouteAt: TEST_NOW - 5,
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
      movementId: "WF-ADV-COMBO",
    });

    // Must still reject, now with "Restraint"
    expect(state.rejections.at(-1)?.attempted).toBe("PATIENT_COLLECTED");
    expect(state.rejections.at(-1)?.reason).toContain("Restraint is still recorded as in use for this patient");
  });
});
