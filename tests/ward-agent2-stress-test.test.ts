import { describe, expect, it } from "vitest";
import { unitCapacity } from "../src/components/ward-management/ward-derivations";
import { bedMapWards } from "../src/components/ward-management/capacity/bed-map";
import { wardFlowReducer, seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import type { Movement, Unit, BedRelease } from "../src/components/ward-management/ward-model";

describe("Agent 2 Stress Test Suite", () => {
  it("Scenario 1: unit.beds = 0", () => {
    const zeroUnit: Unit = {
      id: "zero-ward",
      name: "Zero Ward",
      siteCode: "FSH",
      cohort: "Adult",
      authorised: true,
      lockedBeds: 0,
      beds: 0,
      empty: { value: 0, source: "feed", confirmedAt: 0, staleAfterMinutes: 60 },
      allocatable: { value: 0, source: "ward", confirmedAt: 0, staleAfterMinutes: 60 },
      allocatableLocked: 0,
      held: 0,
      blocked: 0,
      sexMix: { Female: 0, Male: 0 },
      speciallingCapacity: 0,
      highAcuityCapacity: 0,
      sexDesignation: "Undesignated",
      forensic: false,
      intakeConstraints: [],
    };
    const cap = unitCapacity(zeroUnit, []);
    expect(cap).toEqual({
      available: 0,
      held: 0,
      potential: 0,
      blocked: 0,
      occupied: 0,
      surge: 0,
    });

    // Inconsistent feed: beds = 0, but empty = 2
    const inconsistentZero: Unit = {
      ...zeroUnit,
      empty: { value: 2, source: "feed", confirmedAt: 0, staleAfterMinutes: 60 },
      allocatable: { value: 2, source: "ward", confirmedAt: 0, staleAfterMinutes: 60 },
    };
    const capInc = unitCapacity(inconsistentZero, []);
    // available = 2, held = 0, notEmpty = max(0-2, 0) = 0, blocked = 0, occupied = 0
    // Total sum = available (2) + held (0) + blocked (0) + occupied (0) = 2 > beds (0)!
    expect(capInc.available + capInc.held + capInc.blocked + capInc.occupied).toBe(2);
    expect(capInc.available + capInc.held + capInc.blocked + capInc.occupied).toBeGreaterThan(inconsistentZero.beds);
  });

  it("Scenario 2: blocked beds when empty.value === unit.beds", () => {
    // Ward has 20 beds, all 20 are physically empty, but 5 are closed/blocked for maintenance
    const blockedUnit: Unit = {
      id: "blocked-ward",
      name: "Blocked Ward",
      siteCode: "FSH",
      cohort: "Adult",
      authorised: true,
      lockedBeds: 0,
      beds: 20,
      empty: { value: 20, source: "feed", confirmedAt: 0, staleAfterMinutes: 60 },
      allocatable: { value: 15, source: "ward", confirmedAt: 0, staleAfterMinutes: 60 },
      allocatableLocked: 0,
      held: 0,
      blocked: 5,
      sexMix: { Female: 0, Male: 0 },
      speciallingCapacity: 2,
      highAcuityCapacity: 2,
      sexDesignation: "Undesignated",
      forensic: false,
      intakeConstraints: [],
    };
    const cap = unitCapacity(blockedUnit, []);
    // notEmpty = max(20 - 20, 0) = 0
    // blocked = min(5, 0) = 0!
    // held = max(20 - 15, 0) = 5
    // available = min(15, 20) = 15
    // The 5 blocked beds were classified as HELD instead of BLOCKED!
    expect(cap.blocked).toBe(0); // BUG: blocked count collapses to 0!
    expect(cap.held).toBe(5);
  });

  it("Scenario 3: bedMapWards throws if pendingPreparation > capacity.available", () => {
    const unit: Unit = {
      id: "prep-ward",
      name: "Prep Ward",
      siteCode: "FSH",
      cohort: "Adult",
      authorised: true,
      lockedBeds: 0,
      beds: 10,
      empty: { value: 0, source: "feed", confirmedAt: 0, staleAfterMinutes: 60 },
      allocatable: { value: 0, source: "ward", confirmedAt: 0, staleAfterMinutes: 60 },
      allocatableLocked: 0,
      held: 0,
      blocked: 0,
      sexMix: { Female: 5, Male: 5 },
      speciallingCapacity: 0,
      highAcuityCapacity: 0,
      sexDesignation: "Undesignated",
      forensic: false,
      intakeConstraints: [],
    };
    const releases: BedRelease[] = [
      {
        id: "BR-PREP-01",
        unitId: "prep-ward",
        admissionId: "AD-TEST-01",
        state: "discharged",
        confirmedAt: 100,
        expectedAt: 100,
        waitingOn: null,
        preparing: true,
        blocker: null,
        blockedBy: null,
        preparationNote: null,
        confirmedBy: "coordinator",
      },
    ];
    // bedsPendingPreparation is 1, but capacity.available is 0
    expect(() => bedMapWards([unit], releases)).toThrowError(/still being made ready but only 0 ready/);
  });

  it("Scenario 4: Gender Segregation Breach when noTransportNeeded and gender corrected at pulled", () => {
    let state = seedWardFlowState();
    const femaleOnlyUnit = state.units.find((u) => u.sexDesignation === "Female only")!;
    expect(femaleOnlyUnit).toBeDefined();

    // Setup a female patient movement
    const movementId = "WF-FEM-01" as const;
    const femaleMovement: Movement = {
      id: movementId,
      stage: "placement_requested",
      cohort: femaleOnlyUnit.cohort,
      security: "Open",
      sex: "Female",
      gender: "Female",
      specialling: false,
      highAcuity: false,
      urgency: 2,
      legalStatus: "Voluntary",
      flaggedUrgent: false,
      declines: [],
      stageChanges: [],
      withdrawnReferrals: [],
      referredUnitIds: [femaleOnlyUnit.id],
      overrides: [],
      unwinds: [],
      transportNeed: { needed: false, at: 100 },
      originEdId: "fsh-ed",
      openedAt: 100,
      statusChanges: [],
      urgencyChanges: [],
      owner: "ED mental health team",
      blocker: "No blocker",
    };
    state = { ...state, movements: [femaleMovement, ...state.movements] };

    // Coordinator refers to units (stage -> destination_review)
    state = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: 105,
      movementId,
      unitIds: [femaleOnlyUnit.id],
    });

    // Ward accepts in principle (stage -> accepted_awaiting_bed)
    state = wardFlowReducer(state, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: 110,
      movementId,
      unitId: femaleOnlyUnit.id,
    });

    // Ward pulls patient (stage -> pulled)
    state = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: 120,
      movementId,
      unitId: femaleOnlyUnit.id,
    });
    expect(state.movements.find((m) => m.id === movementId)?.stage).toBe("pulled");

    // Clinical record corrected: patient is actually Male!
    state = wardFlowReducer(state, {
      type: "RECORD_MOVEMENT_GENDER",
      role: "coordinator",
      now: 130,
      movementId,
      gender: "Male",
    });
    expect(state.movements.find((m) => m.id === movementId)?.gender).toBe("Male");

    // Since no transport is needed, ward confirms patient arrived directly from pulled
    state = wardFlowReducer(state, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      actingUnitId: femaleOnlyUnit.id,
      now: 140,
      movementId,
    });

    // BUG CHECK: Did PATIENT_ARRIVED succeed in placing a Male patient on a Female-only ward?
    const arrivedMovement = state.movements.find((m) => m.id === movementId);
    expect(arrivedMovement?.stage).toBe("arrived"); // BREACH! Patient arrived despite gender mismatch!
    expect(state.rejections.some((r) => r.attempted === "PATIENT_ARRIVED")).toBe(false);
  });

  it("Scenario 5: Gender Segregation Breach when transport already collected (stage: moving)", () => {
    let state = seedWardFlowState();
    const femaleOnlyUnit = state.units.find((u) => u.sexDesignation === "Female only")!;

    const movementId = "WF-FEM-02" as const;
    const femaleMovement: Movement = {
      id: movementId,
      stage: "placement_requested",
      cohort: femaleOnlyUnit.cohort,
      security: "Open",
      sex: "Female",
      gender: "Female",
      specialling: false,
      highAcuity: false,
      urgency: 2,
      legalStatus: "Voluntary",
      flaggedUrgent: false,
      declines: [],
      stageChanges: [],
      withdrawnReferrals: [],
      referredUnitIds: [femaleOnlyUnit.id],
      overrides: [],
      unwinds: [],
      transportNeed: { needed: true, at: 100 },
      originEdId: "fsh-ed",
      openedAt: 100,
      statusChanges: [],
      urgencyChanges: [],
      owner: "ED mental health team",
      blocker: "No blocker",
    };
    state = { ...state, movements: [femaleMovement, ...state.movements] };

    // Move to destination_review
    state = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: 105,
      movementId,
      unitIds: [femaleOnlyUnit.id],
    });

    // Accept in principle
    state = wardFlowReducer(state, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: 110,
      movementId,
      unitId: femaleOnlyUnit.id,
    });

    // Pull patient
    state = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: 120,
      movementId,
      unitId: femaleOnlyUnit.id,
    });

    // Book transport
    state = wardFlowReducer(state, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: 125,
      movementId,
      provider: "Ambulance service",
      escortRequired: false,
      cadNumber: "CAD-9999",
      transportLegalStatus: "voluntary",
      estimatedAt: 150,
    });

    // Handover ready
    state = wardFlowReducer(state, {
      type: "HANDOVER_READY",
      role: "ed",
      now: 130,
      movementId,
    });

    // Transport accepted
    state = wardFlowReducer(state, {
      type: "TRANSPORT_ACCEPTED",
      role: "officer",
      now: 135,
      movementId,
    });

    // Transport en route
    state = wardFlowReducer(state, {
      type: "TRANSPORT_EN_ROUTE",
      role: "officer",
      now: 138,
      movementId,
    });

    // Patient collected (stage -> moving)
    state = wardFlowReducer(state, {
      type: "PATIENT_COLLECTED",
      role: "officer",
      now: 140,
      movementId,
    });
    expect(state.movements.find((m) => m.id === movementId)?.stage).toBe("moving");

    // While in transit, coordinator discovers patient is Male and records correction
    state = wardFlowReducer(state, {
      type: "RECORD_MOVEMENT_GENDER",
      role: "coordinator",
      now: 145,
      movementId,
      gender: "Male",
    });

    // Ambulance arrives at hospital, ward confirms arrival
    state = wardFlowReducer(state, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      actingUnitId: femaleOnlyUnit.id,
      now: 150,
      movementId,
    });

    // BUG CHECK: Did PATIENT_ARRIVED succeed in placing Male patient on Female-only ward?
    const arrivedMovement = state.movements.find((m) => m.id === movementId);
    expect(arrivedMovement?.stage).toBe("arrived"); // BREACH! Patient arrived on female-only ward!
    expect(state.rejections.some((r) => r.attempted === "PATIENT_ARRIVED")).toBe(false);
  });
});

