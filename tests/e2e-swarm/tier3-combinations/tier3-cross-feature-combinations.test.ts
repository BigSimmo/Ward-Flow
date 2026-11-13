import { describe, expect, it } from "vitest";
import {
  createIsolatedState,
  createTestJourney,
  TEST_NOW,
} from "../helpers/test-harness";
import { wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { Movement, Unit, Admission, BedRelease } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { openRestrictivePracticeRefusal } from "@/components/ward-management/restrictive-practice/ward-restrictive-practice";
import { downtimePack } from "@/components/ward-management/reports/downtime-pack";
import { SYNTHETIC_TRAVEL_BANDS, TRAVEL_BANDS_ARE_INVENTED } from "@/components/ward-management/ward-travel-bands";
import { pullHoldMinutesFor, AEROMEDICAL_TRANSIT_HOLD_MINUTES } from "@/components/ward-management/ward-flow-placement-events";
import { currentDeskId, COORDINATOR_DESK_ID, OFFICER_DESK_ID } from "@/components/ward-management/settings/workstation-desks";
import { unitCapacity } from "@/components/ward-management/ward-derivations-transport";
import { handoverLines, instantFromDateAndTimeInputs } from "@/components/ward-management/legal-forms/legal-forms-view";
import { formProgression, currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-form-progression";
import type { BroadcastAlert } from "@/components/ward-management/alerts/ward-broadcast-model";

describe("Tier 3 - Cross-Feature Combinations", () => {
  const now = NOW_ANCHOR;

  // Helper to send events with default now
  const send = (state: ReturnType<typeof createIsolatedState>, event: Omit<WardFlowEvent, "now"> & { now?: number }) => {
    return wardFlowReducer(state, { ...event, now: event.now ?? now } as WardFlowEvent);
  };

  const createMockUnit = (overrides?: Partial<Unit>): Unit => {
    return {
      id: "TEST-ACUTE-1",
      name: "Test Acute Ward",
      siteCode: "SCGH",
      beds: 20,
      allocatable: { value: 5, revision: 1, source: "test" },
      empty: { value: 6, revision: 1 },
      allocatableLocked: 2,
      speciallingCapacity: 2,
      isClosed: false,
      closedBeds: [],
      ...overrides,
    } as unknown as Unit;
  };

  // --------------------------------------------------------------------------
  // Combination 1: Medical Clearance + Transport Restrictive Practice Refusal
  // (Features 03, 06, 16)
  // --------------------------------------------------------------------------
  describe("Combination 1: Medical Clearance & Transport Restrictive Practice Refusal", () => {
    it("refuses PATIENT_COLLECTED when open seclusion is active despite affirmative medical clearance", () => {
      let state = createIsolatedState();
      const sourceStay = state.admissions.find((a) => a.state === "occupied")!;
      const sendingUnitId = sourceStay.unitId;
      const destUnitId = "scgh-adult-open";

      // 1. Establish affirmative medical clearance on the transfer movement
      const transferMovement: Movement = {
        ...state.movements[0]!,
        id: "WF-COMB-SEC-1",
        stage: "handover_ready",
        sourceAdmissionId: sourceStay.id,
        acceptedUnitId: destUnitId,
        admissionId: "AD-PULLED-COMB-1",
        medicalClearance: { at: now - 30, cleared: true }, // Affirmative clearance present
        transport: {
          id: "WF-COMB-SEC-1-transport",
          provider: "Ambulance service",
          escortRequired: false,
          cadNumber: "CAD-COMB-1",
          transportLegalStatus: "voluntary",
          estimatedAt: now + 60,
          acceptedAt: now - 15,
          enRouteAt: now - 5,
          bookedBy: { role: "ed" },
        },
      };

      state = {
        ...state,
        movements: [...state.movements, transferMovement],
      };

      // 2. Start open seclusion on the source ward
      state = send(state, {
        type: "RECORD_RESTRICTIVE_PRACTICE_START",
        role: "ward",
        unitId: sendingUnitId,
        actingUnitId: sendingUnitId,
        admissionId: sourceStay.id,
        practice: "seclusion",
        startedAt: now - 20,
      });

      // 3. Attempt PATIENT_COLLECTED
      state = send(state, {
        type: "PATIENT_COLLECTED",
        role: "officer",
        movementId: "WF-COMB-SEC-1",
      });

      expect(state.rejections.at(-1)?.attempted).toBe("PATIENT_COLLECTED");
      expect(state.rejections.at(-1)?.reason).toContain("Seclusion is still recorded as in use");

      // Stage must remain handover_ready; patient is NOT allowed to be moved
      const movement = state.movements.find((m) => m.id === "WF-COMB-SEC-1")!;
      expect(movement.stage).toBe("handover_ready");
      expect(movement.transport?.collectedAt).toBeUndefined();
    });

    it("refuses PATIENT_COLLECTED when seclusion is ended but medical clearance is revoked/deteriorated", () => {
      let state = createIsolatedState();
      const sourceStay = state.admissions.find((a) => a.state === "occupied")!;
      const sendingUnitId = sourceStay.unitId;
      const destUnitId = "scgh-adult-open";

      // Transfer movement where medical clearance is revoked (cleared: false)
      const transferMovement: Movement = {
        ...state.movements[0]!,
        id: "WF-COMB-SEC-2",
        stage: "handover_ready",
        sourceAdmissionId: sourceStay.id,
        acceptedUnitId: destUnitId,
        admissionId: "AD-PULLED-COMB-2",
        medicalClearance: { at: now - 10, cleared: false }, // Medical deterioration
        transport: {
          id: "WF-COMB-SEC-2-transport",
          provider: "Ambulance service",
          escortRequired: false,
          cadNumber: "CAD-COMB-2",
          transportLegalStatus: "voluntary",
          estimatedAt: now + 60,
          acceptedAt: now - 15,
          enRouteAt: now - 5,
          bookedBy: { role: "ed" },
        },
      };

      state = {
        ...state,
        movements: [...state.movements, transferMovement],
      };

      // Ensure no active seclusion exists
      const unit = state.units.find((u) => u.id === sendingUnitId);
      expect(openRestrictivePracticeRefusal(unit?.restrictivePractice, sourceStay.id)).toBeUndefined();

      // Attempt PATIENT_COLLECTED
      state = send(state, {
        type: "PATIENT_COLLECTED",
        role: "officer",
        movementId: "WF-COMB-SEC-2",
      });

      expect(state.rejections.at(-1)?.attempted).toBe("PATIENT_COLLECTED");
      expect(state.rejections.at(-1)?.reason).toContain("Medical clearance");

      const movement = state.movements.find((m) => m.id === "WF-COMB-SEC-2")!;
      expect(movement.stage).toBe("handover_ready");
    });

    it("advances to moving when BOTH affirmative medical clearance and restrictive practice resolution are satisfied", () => {
      let state = createIsolatedState();
      const sourceStay = state.admissions.find((a) => a.state === "occupied")!;
      const sendingUnitId = sourceStay.unitId;
      const destUnitId = "scgh-adult-open";

      // 1. Start then end seclusion
      state = send(state, {
        type: "RECORD_RESTRICTIVE_PRACTICE_START",
        role: "ward",
        unitId: sendingUnitId,
        actingUnitId: sendingUnitId,
        admissionId: sourceStay.id,
        practice: "seclusion",
        startedAt: now - 60,
      });

      const unit = state.units.find((u) => u.id === sendingUnitId)!;
      const episodeId = unit.restrictivePractice!.episodes.at(-1)!.id;

      state = send(state, {
        type: "RECORD_RESTRICTIVE_PRACTICE_END",
        role: "ward",
        unitId: sendingUnitId,
        actingUnitId: sendingUnitId,
        episodeId,
        endedAt: now - 15,
      });

      // 2. Add transfer movement with affirmative medical clearance
      const transferMovement: Movement = {
        ...state.movements[0]!,
        id: "WF-COMB-OK",
        stage: "handover_ready",
        sourceAdmissionId: sourceStay.id,
        acceptedUnitId: destUnitId,
        admissionId: "AD-PULLED-COMB-3",
        medicalClearance: { at: now - 30, cleared: true },
        transport: {
          id: "WF-COMB-OK-transport",
          provider: "Ambulance service",
          escortRequired: false,
          cadNumber: "CAD-COMB-3",
          transportLegalStatus: "voluntary",
          estimatedAt: now + 60,
          acceptedAt: now - 15,
          enRouteAt: now - 5,
          bookedBy: { role: "ed" },
        },
      };

      state = {
        ...state,
        movements: [...state.movements, transferMovement],
      };

      // 3. Collect patient
      state = send(state, {
        type: "PATIENT_COLLECTED",
        role: "officer",
        movementId: "WF-COMB-OK",
      });

      const movement = state.movements.find((m) => m.id === "WF-COMB-OK")!;
      expect(movement.stage).toBe("moving");
      expect(movement.transport?.collectedAt).toBe(now);
    });
  });

  // --------------------------------------------------------------------------
  // Combination 2: Aeromedical RFDS Transit Hold (600m) + Downtime Census Snapshot
  // (Features 07, 08, 10, 16)
  // --------------------------------------------------------------------------
  describe("Combination 2: Aeromedical RFDS Transit Hold Extension (600m) & Downtime Census Snapshot", () => {
    it("extends transit hold to 600m for RFDS aeromedical moves and reflects pulled bed without false surge in downtime pack", () => {
      let state = createIsolatedState();
      const destUnitId = "scgh-adult-open";
      const destUnit = state.units.find((u) => u.id === destUnitId)!;

      // Ensure travel bands lookup confirms air transport requirement for Pilbara -> SCGH
      expect(TRAVEL_BANDS_ARE_INVENTED).toBe(false);
      expect(SYNTHETIC_TRAVEL_BANDS["Pilbara"]?.["SCGH"]).toBe("air_transport_only");

      // Create an incoming aeromedical movement from Hedland with RFDS provider
      const aeromedicalMovement: Movement = {
        ...state.movements[0]!,
        id: "WF-AERO-DOWNTIME",
        stage: "pulled",
        originEdId: "hedland-ed",
        acceptedUnitId: destUnitId,
        admissionId: "AD-AERO-DEST",
        allocatedBed: 12,
        extendedHoldAt: now - 60,
        acceptedAt: now - 60,
        transitMode: "flight",
        medicalClearance: { at: now - 45, cleared: true },
        transport: {
          id: "WF-AERO-transport",
          provider: "RFDS",
          escortRequired: true,
          cadNumber: "RFDS-FLIGHT-802",
          transportLegalStatus: "involuntary",
          estimatedAt: now + 300, // 5 hours flight
          acceptedAt: now - 30,
          bookedBy: { role: "ed" },
        },
      };

      // Verify transit hold calculation returns 600 minutes (10 hours)
      const holdMinutes = pullHoldMinutesFor(state, aeromedicalMovement, destUnitId);
      expect(holdMinutes).toBe(AEROMEDICAL_TRANSIT_HOLD_MINUTES);
      expect(holdMinutes).toBe(600);

      state = {
        ...state,
        movements: [...state.movements, aeromedicalMovement],
      };

      // Generate downtime pack while aeromedical patient is held in pulled state
      const pack = downtimePack({
        units: state.units,
        bedUnits: [destUnit],
        admissions: state.admissions,
        bedReleases: state.bedReleases,
        leaveBeds: state.leaveBeds,
        movements: state.movements,
        now,
        identify: (m) => `Synthetic Patient (${m.id})`,
      });

      // Downtime pack must capture pending aeromedical move
      const pendingMove = pack.pendingMoves.find((pm) => pm.movementId === "WF-AERO-DOWNTIME");
      expect(pendingMove).toBeDefined();
      expect(pendingMove?.to).toBe(destUnit.name);
      expect(pendingMove?.transportEta).toBe(now + 300);

      // Bed states for destUnit in downtime pack: pulled must reflect reservation, occupied must NOT count aeromedical patient yet
      const wardReport = pack.wards.find((w) => w.unitId === destUnitId)!;
      expect(wardReport.counts.pulled).toBeGreaterThanOrEqual(1);

      // Inpatient census must list only current physically occupied inpatients
      expect(pack.census).toBeDefined();
      const inCensus = pack.census!.some((c) => c.umrn.includes("WF-AERO-DOWNTIME"));
      expect(inCensus).toBe(false); // In flight / pulled, not yet in physical bed
    });

    it("transitions patient into downtime inpatient census immediately upon PATIENT_ARRIVED", () => {
      let state = createIsolatedState();
      const destUnitId = "scgh-adult-open";
      const destUnit = state.units.find((u) => u.id === destUnitId)!;

      // Add arrived aeromedical admission with linked movementId
      const arrivedAdmission: Admission = {
        id: "AD-AERO-ARRIVED",
        unitId: destUnitId,
        state: "occupied",
        bedNumber: 15,
        movementId: "WF-AERO-ARRIVED",
        patientId: "PT-AERO-01",
        legalStatus: "Involuntary",
        observation: { level: "within_sight", intervalMinutes: null, reviewAt: null },
        highAcuity: true,
      };

      const arrivedMovement: Movement = {
        ...state.movements[0]!,
        id: "WF-AERO-ARRIVED",
        stage: "arrived",
        originEdId: "hedland-ed",
        acceptedUnitId: destUnitId,
        admissionId: "AD-AERO-ARRIVED",
        closure: { outcome: "arrived", at: now, by: "ward", reason: "arrived" },
      };

      state = {
        ...state,
        admissions: [...state.admissions, arrivedAdmission],
        movements: [...state.movements, arrivedMovement],
      };

      const pack = downtimePack({
        units: state.units,
        bedUnits: [destUnit],
        admissions: state.admissions,
        bedReleases: state.bedReleases,
        leaveBeds: state.leaveBeds,
        movements: state.movements,
        now,
        identify: (m) => `Aeromedical Inpatient · SYN-UMRN-998811`,
      });

      expect(pack.census).toBeDefined();
      const censusLine = pack.census!.find((c) => c.unitId === destUnitId && c.bedNumber === "15");
      expect(censusLine).toBeDefined();
      expect(censusLine?.patientName).toBe("Aeromedical Inpatient");
      expect(censusLine?.umrn).toBe("SYN-UMRN-998811");
      expect(censusLine?.legalStatus).toBe("Form 1A");
      expect(censusLine?.observationLevel).toBe("Constant within sight (1:1)");
      expect(censusLine?.specialRequirements).toBe("High acuity");
    });
  });

  // --------------------------------------------------------------------------
  // Combination 3: Broadcast Alert Stand-Down + Desk Identity Persistence
  // (Features 01, 09, 12)
  // --------------------------------------------------------------------------
  describe("Combination 3: Broadcast Alert Stand-Down & Workstation Desk Identity", () => {
    it("preserves desk workstation context across global alert routes and stands down active surge alert", () => {
      // 1. Check desk identity derivation with session persistence
      const wardDeskId = "rph-adult-secure";
      // Route is /ward-flow/alerts, but session desk is set to ward desk
      const resolvedDesk = currentDeskId("/ward-flow/alerts", wardDeskId);
      expect(resolvedDesk).toBe(wardDeskId);

      // Route is /ward-flow/discharges with no session desk fallback -> coordinator
      expect(currentDeskId("/ward-flow/discharges", null)).toBe(COORDINATOR_DESK_ID);

      // 2. Raise surge alert and stand down
      let state = createIsolatedState();
      const alertId = "AL-SURGE-COMB-1";
      const surgeAlert: BroadcastAlert = {
        id: alertId,
        raisedAt: now - 90,
        expiresAt: now + 180,
        authorRole: "coordinator",
        category: "surge",
        severity: "severe",
        targetScope: "all_wards",
        acknowledgedUnits: ["scgh-adult-open"],
        headline: "Metropolitan Surge Escalation - Red Capacity",
        detail: "Statewide adult bed pressure exceeds 98%. Immediate discharge planning required.",
        status: "active",
      };

      state = {
        ...state,
        broadcastAlerts: [surgeAlert],
      };

      // Stand down alert
      state = send(state, {
        type: "STAND_DOWN_BROADCAST_ALERT",
        role: "coordinator",
        alertId,
        now: now + 5,
      });

      const alert = (state.broadcastAlerts as BroadcastAlert[]).find((a) => a.id === alertId);
      expect(alert?.status).toBe("stood_down");
      expect(alert?.stoodDownAt).toBe(now + 5);
      expect(alert?.stoodDownBy).toBe("coordinator");

      // Verify scenario idempotency on redundant SET_SCENARIO (Feature 12)
      const currentScenario = state.scenario;
      const initialGeneration = state.worldGeneration;
      const stateAfterSameScenario = wardFlowReducer(state, {
        type: "SET_SCENARIO",
        role: "demo",
        now: state.now,
        scenario: currentScenario,
      });
      expect(stateAfterSameScenario).toBe(state); // Strict identity
      expect(stateAfterSameScenario.worldGeneration).toBe(initialGeneration);
    });
  });

  // --------------------------------------------------------------------------
  // Combination 4: Bed Occupancy Decoupling + Cleaning Transparency
  // (Features 07, 10)
  // --------------------------------------------------------------------------
  describe("Combination 4: Bed Occupancy Decoupling & Cleaning Bed Capacity Transparency", () => {
    it("derives occupied count directly from active admissions while exposing beds undergoing cleaning", () => {
      const testUnit = createMockUnit({
        id: "unit-comb-decouple",
        name: "Test Acute Psychiatric Unit",
        beds: 20,
        empty: { value: 5, revision: 1 },
        allocatable: { value: 5, revision: 1, source: "test" },
      });

      // 15 active admissions
      const admissions = [
        ...Array.from({ length: 15 }, (_, i) => ({
          id: `AD-OCC-${i + 1}`,
          unitId: "unit-comb-decouple",
          state: "occupied" as const,
        })),
        { id: "AD-DISCH", unitId: "unit-comb-decouple", state: "discharged" as const },
        { id: "AD-OTHER", unitId: "other-unit", state: "occupied" as const },
      ] as any[];

      // 2 bed releases in preparation (cleaning)
      const bedReleases: BedRelease[] = [
        {
          id: "REL-1",
          unitId: "unit-comb-decouple",
          bedNumber: 16,
          state: "discharged",
          preparing: true,
        } as unknown as BedRelease,
        {
          id: "REL-2",
          unitId: "unit-comb-decouple",
          bedNumber: 17,
          state: "discharged",
          preparing: true,
        } as unknown as BedRelease,
      ];

      const cap = unitCapacity(testUnit, bedReleases, { admissions });

      // Occupied must strictly equal 15 from admissions, regardless of arithmetic remainder
      expect(cap.occupied).toBe(15);
      // Cleaning beds must be explicitly transparent
      expect(cap.bedsPendingPreparation).toBe(2);
      expect(cap.availableAfterCleaning).toBeGreaterThanOrEqual(cap.availableNow);
      expect(cap.surge).toBe(0); // 15 <= 20 beds, zero surge
    });

    it("detects physical bed surge when active admissions exceed total bed capacity", () => {
      const smallUnit = createMockUnit({
        id: "unit-surge-test",
        name: "Small Pod Unit",
        beds: 6,
        empty: { value: 0, revision: 1 },
        allocatable: { value: 0, revision: 1, source: "test" },
      });

      // 8 admissions in a 6-bed unit (2 overflow/surge patients)
      const admissions = Array.from({ length: 8 }, (_, i) => ({
        id: `AD-SURGE-${i + 1}`,
        unitId: "unit-surge-test",
        state: "occupied" as const,
      })) as any[];

      const cap = unitCapacity(smallUnit, [], { admissions });
      expect(cap.occupied).toBe(8);
      expect(cap.surge).toBe(2); // 8 - 6 = 2 surge
    });
  });

  // --------------------------------------------------------------------------
  // Combination 5: Legal Assessment 72h Countdown + Expired Form Handover
  // (Features 04, 05, 16)
  // --------------------------------------------------------------------------
  describe("Combination 5: Legal 72h Assessment Countdown Retention & Expired Handover Display", () => {
    it("retains 72h countdown on arrival and displays prominent EXPIRED badge in handover when past due before Form 6A", () => {
      const assessmentDueAt = now - 180; // 72-hour assessment window expired 3 hours ago

      const overdueInvoluntaryMovement: Movement = {
        id: "WF-LEGAL-COMB-1",
        stage: "arrived",
        legalStatus: "Involuntary",
        legalForm: {
          code: "1A",
          dueAt: assessmentDueAt,
          receivedAt: now - (72 * 60 + 180),
        },
        closure: { outcome: "arrived", at: now - 240, by: "ward", reason: "arrived" },
        examination: undefined, // Delayed psychiatrist examination!
        flaggedUrgent: false,
        urgency: 1,
        cohort: "Adult",
        security: "Secure",
        sex: "Male",
        gender: "Male",
        openedAt: now - (72 * 60 + 240),
        statusChanges: [],
        urgencyChanges: [],
        overrides: [],
        owner: "ward",
        referredUnitIds: [],
        declines: [],
        blocker: "None",
        observation: "close",
        highAcuity: true,
      } as unknown as Movement;

      // 1. Invariant: 72h countdown is NOT cleared upon arrival (Feature 05)
      expect(currentLegalDueAt(overdueInvoluntaryMovement)).toBe(assessmentDueAt);

      // 2. Progression status indicates pending Form 6A examination
      const prog = formProgression(overdueInvoluntaryMovement);
      expect(prog?.nextCode).toBe("6A");
      expect(prog?.endedWhen).toBe("at arrival");

      // 3. Shift handover display retains the overdue order with prominent ⚠️ EXPIRED badge (Feature 04)
      const handover = handoverLines(
        [overdueInvoluntaryMovement],
        now,
        (m) => `Patient UMRN-771122 (${m.id})`,
        480, // 8-hour shift window
      );

      expect(handover).toHaveLength(1);
      expect(handover[0]).toContain("⚠️ EXPIRED");
      expect(handover[0]).toContain("[3h ago]");
      expect(handover[0]).toContain("Form 1A");
      expect(handover[0]).toContain("Patient UMRN-771122");

      // 4. Clinical safety boundary: Clinician enters manual date/time for Form 6A (Ruling D-5)
      const dayZero = new Date("2026-10-01T00:00:00+08:00");
      const validInstant = instantFromDateAndTimeInputs("2026-10-02", "16:00", dayZero);
      expect(validInstant).toBeDefined();

      // Corrupted / automated inputs return undefined without guessing
      expect(instantFromDateAndTimeInputs("invalid-date", "16:00", dayZero)).toBeUndefined();
    });

    it("clears temporary 72h countdown once Form 6A is recorded, removing Form 1A expiry from subsequent handovers", () => {
      const assessmentDueAt = now - 60;

      // Examination is now recorded by the consultant psychiatrist
      const examinedMovement: Movement = {
        id: "WF-LEGAL-COMB-2",
        stage: "arrived",
        legalStatus: "Involuntary",
        legalForm: {
          code: "1A",
          dueAt: assessmentDueAt,
          receivedAt: now - (72 * 60 + 60),
        },
        closure: { outcome: "arrived", at: now - 120, by: "ward", reason: "arrived" },
        examination: {
          at: now - 10,
          by: "ward",
          examinerName: "Dr David Evans",
          outcome: "inpatient_order", // Form 6A signed
        },
        flaggedUrgent: false,
        urgency: 2,
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        gender: "Female",
        openedAt: now - (72 * 60 + 120),
        statusChanges: [],
        urgencyChanges: [],
        overrides: [],
        owner: "ward",
        referredUnitIds: [],
        declines: [],
        blocker: "None",
        observation: "general",
        highAcuity: false,
      } as unknown as Movement;

      // Once Form 6A examination is signed, temporary Form 1A timer is cleared
      expect(currentLegalDueAt(examinedMovement)).toBeUndefined();
    });
  });
});
