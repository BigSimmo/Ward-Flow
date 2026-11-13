import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
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
import {
  downtimePack,
  rememberDowntimePack,
  lastDowntimePack,
  forgetDowntimePack,
  markDowntimePackHandled,
  downtimePackHandled,
} from "@/components/ward-management/reports/downtime-pack";
import { SYNTHETIC_TRAVEL_BANDS, TRAVEL_BANDS_ARE_INVENTED } from "@/components/ward-management/ward-travel-bands";
import { pullHoldMinutesFor, AEROMEDICAL_TRANSIT_HOLD_MINUTES } from "@/components/ward-management/ward-flow-placement-events";
import { currentDeskId, COORDINATOR_DESK_ID, OFFICER_DESK_ID } from "@/components/ward-management/settings/workstation-desks";
import { unitCapacity } from "@/components/ward-management/ward-derivations-transport";
import { handoverLines, instantFromDateAndTimeInputs } from "@/components/ward-management/legal-forms/legal-forms-view";
import { formProgression, currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-form-progression";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { formatDateOfBirth } from "@/components/ward-management/ward-patients";
import { BAND_LABELS } from "@/components/ward-management/discharges/discharge-board-model";
import { GENERAL_OBSERVATION, observationAt } from "@/components/ward-management/ward-observation";

describe("Tier 4 - Real-World WA Hospital Clinical Scenarios", () => {
  const now = NOW_ANCHOR;

  const send = (state: ReturnType<typeof createIsolatedState>, event: Omit<WardFlowEvent, "now"> & { now?: number }) => {
    return wardFlowReducer(state, { ...event, now: event.now ?? now } as WardFlowEvent);
  };

  // ==========================================================================
  // Scenario 1: Rural WA Aeromedical Evacuation
  // (Pilbara/Kimberley to Perth Metropolitan Acute Psychiatric Unit)
  // ==========================================================================
  describe("Scenario 1: Rural WA Aeromedical Evacuation (Hedland to SCGH)", () => {
    it("completes full aeromedical journey with 600m hold, affirmative clearance, RFDS flight, and dual-bed preservation", () => {
      let state = createIsolatedState();
      const originEd = "jhc-ed";
      const destUnitId = "scgh-adult-open";
      const destUnit = state.units.find((u) => u.id === destUnitId)!;

      // 1. Regional travel band check: Pilbara to SCGH must require air transport
      expect(TRAVEL_BANDS_ARE_INVENTED).toBe(false);
      expect(SYNTHETIC_TRAVEL_BANDS["Pilbara"]?.["SCGH"]).toBe("air_transport_only");

      // 2. Raise acute referral at ED for an involuntary patient requiring tertiary care
      state = send(state, {
        type: "RAISE_REFERRAL",
        role: "ed",
        edId: originEd,
        draft: {
          cohort: "Adult",
          security: "Open",
          sex: "Female",
          gender: "Female",
          observation: observationAt("within_sight"),
          highAcuity: true,
          legalStatus: "Involuntary",
          urgency: 1,
          legalFormCode: "1A",
          legalFormDueAt: now + 72 * 60,
        },
      });

      const movementId = state.movements.at(-1)!.id;
      let movement = state.movements.find((m) => m.id === movementId)!;
      expect(movement.stage).toBe("placement_requested");
      expect(movement.legalStatus).toBe("Involuntary");

      // 3. Bed coordinator refers patient to SCGH; ward accepts with extended hold
      state = send(state, {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        movementId,
        unitIds: [destUnitId],
      });

      movement = state.movements.find((m) => m.id === movementId)!;
      expect(movement.stage).toBe("destination_review");

      state = send(state, {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        movementId,
        unitId: destUnitId,
        actingUnitId: destUnitId,
        extendedHold: true,
      });

      movement = state.movements.find((m) => m.id === movementId)!;
      expect(movement.stage).toBe("accepted_awaiting_bed");
      expect(movement.extendedHoldAt).toBeDefined();

      // 4. Bed pulled at SCGH: Aeromedical transit hold of 600 minutes applied
      state = send(state, {
        type: "PULL_PATIENT",
        role: "ward",
        movementId,
        unitId: destUnitId,
        actingUnitId: destUnitId,
      });

      movement = state.movements.find((m) => m.id === movementId)!;
      expect(movement.stage).toBe("pulled");
      expect(movement.allocatedBed).toBeDefined();
      expect(movement.admissionId).toBeDefined();

      // Set transitMode and provider to verify 600m transit hold calculation
      movement.transitMode = "flight";
      const holdMinutes = pullHoldMinutesFor(state, movement, destUnitId);
      expect(holdMinutes).toBe(AEROMEDICAL_TRANSIT_HOLD_MINUTES);
      expect(holdMinutes).toBe(600);

      // 5. Transfer gate safety: Attempt transport booking before medical clearance
      state = send(state, {
        type: "BOOK_TRANSPORT",
        role: "ed",
        movementId,
        provider: "RFDS",
        escortRequired: true,
        cadNumber: "RFDS-PILB-901",
        transportLegalStatus: "involuntary",
        estimatedAt: now + 360,
      });

      // Transport booking must be rejected because medical clearance is not affirmative
      expect(state.rejections.at(-1)?.attempted).toBe("BOOK_TRANSPORT");
      expect(state.rejections.at(-1)?.reason).toContain("Medical clearance");

      // 6. ED Senior Medical Officer records affirmative medical clearance
      state = send(state, {
        type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
        role: "ed",
        movementId,
        cleared: true,
      });

      movement = state.movements.find((m) => m.id === movementId)!;
      expect(movement.medicalClearance?.cleared).toBe(true);

      // 7. RFDS aeromedical flight transport booking now succeeds
      state = send(state, {
        type: "BOOK_TRANSPORT",
        role: "ed",
        movementId,
        provider: "RFDS",
        escortRequired: true,
        cadNumber: "RFDS-PILB-901",
        transportLegalStatus: "involuntary",
        estimatedAt: now + 360, // 6-hour flight/transfer window
      });

      movement = state.movements.find((m) => m.id === movementId)!;
      expect(movement.transport).toBeDefined();
      expect(movement.transport?.provider).toBe("RFDS");
      expect(movement.transport?.cadNumber).toBe("RFDS-PILB-901");

      // 8. Flight departure progress
      state = send(state, { type: "HANDOVER_READY", role: "ed", movementId });
      state = send(state, { type: "TRANSPORT_ACCEPTED", role: "officer", movementId });
      state = send(state, { type: "TRANSPORT_EN_ROUTE", role: "officer", movementId });
      state = send(state, { type: "PATIENT_COLLECTED", role: "officer", movementId });

      movement = state.movements.find((m) => m.id === movementId)!;
      expect(movement.stage).toBe("moving");
      expect(movement.transport?.collectedAt).toBe(now);

      // 9. Dual-bed holding invariant (Ruling F): Bed at SCGH is strictly held while patient is in flight
      expect(movement.allocatedBed).toBeDefined();
      expect(movement.admissionId).toBeDefined();
      const heldAdmission = state.admissions.find((a) => a.id === movement.admissionId);
      expect(heldAdmission).toBeDefined();

      // 10. Flight lands in Perth, patient arrives at SCGH
      state = send(state, {
        type: "PATIENT_ARRIVED",
        role: "ward",
        movementId,
        actingUnitId: destUnitId,
      });

      movement = state.movements.find((m) => m.id === movementId)!;
      expect(movement.stage).toBe("arrived");
      expect(movement.closure?.outcome).toBe("arrived");

      // 11. Inpatient arrival retains 72h assessment countdown until Form 6A examination
      const dueAt = currentLegalDueAt(movement);
      expect(dueAt).toBeDefined();
      expect(formProgression(movement)?.nextCode).toBe("6A");
    });
  });

  // ==========================================================================
  // Scenario 2: Involuntary Form 1A Assessment Under 72h Countdown
  // ==========================================================================
  describe("Scenario 2: Involuntary Form 1A Assessment with Delayed Psychiatric Exam", () => {
    it("tracks 72h countdown across multiple shift handovers and raises EXPIRED alert badge when delayed", () => {
      const intakeTime = now - (72 * 60 + 120); // Patient was detained under Form 1A 74 hours ago (2 hours overdue)
      const assessmentDeadline = intakeTime + 72 * 60; // Due 2 hours ago

      // Involuntary patient who arrived on the ward under Form 1A
      const patientMovement: Movement = {
        id: "WF-INVOL-72H-DELAY",
        stage: "arrived",
        legalStatus: "Involuntary",
        legalForm: {
          code: "1A",
          dueAt: assessmentDeadline,
          receivedAt: intakeTime,
        },
        closure: { outcome: "arrived", at: intakeTime + 240, by: "ward", reason: "arrived" },
        examination: undefined, // Delayed: Consultant Psychiatrist delayed in emergency
        flaggedUrgent: false,
        urgency: 1,
        cohort: "Adult",
        security: "Secure",
        sex: "Male",
        gender: "Male",
        openedAt: intakeTime,
        statusChanges: [],
        urgencyChanges: [],
        overrides: [],
        owner: "ward",
        referredUnitIds: [],
        declines: [],
        blocker: "None",
        observation: observationAt("arms_length"),
        highAcuity: true,
      } as unknown as Movement;

      // 1. Inpatient arrival invariant (Feature 05): 72h countdown is NOT prematurely cleared on ward arrival
      expect(currentLegalDueAt(patientMovement)).toBe(assessmentDeadline);
      expect(formProgression(patientMovement)?.nextCode).toBe("6A");

      // 2. Early shift handover check (at T = intakeTime + 24h, 48 hours remaining)
      const earlyNow = intakeTime + 24 * 60;
      const earlyLines = handoverLines([patientMovement], earlyNow, (m) => `Patient ${m.id}`, 480);
      // Since 48 hours > 8-hour window, excluded from immediate handover
      expect(earlyLines).toHaveLength(0);

      // 3. Imminent shift handover check (at T = assessmentDeadline - 180, 3 hours remaining)
      const imminentNow = assessmentDeadline - 180;
      const imminentLines = handoverLines([patientMovement], imminentNow, (m) => `Patient ${m.id}`, 480);
      expect(imminentLines).toHaveLength(1);
      expect(imminentLines[0]).not.toContain("⚠️ EXPIRED");
      expect(imminentLines[0]).toContain("Form 1A");
      expect(imminentLines[0]).toContain("Patient WF-INVOL-72H-DELAY");

      // 4. Overdue shift handover check (at T = now, 2 hours past statutory 72h limit)
      // Feature 04: Expired order must NOT be dropped, but rendered with prominent ⚠️ EXPIRED badge
      const overdueLines = handoverLines([patientMovement], now, (m) => `Patient ${m.id}`, 480);
      expect(overdueLines).toHaveLength(1);
      expect(overdueLines[0]).toContain("⚠️ EXPIRED");
      expect(overdueLines[0]).toContain("[2h ago]");
      expect(overdueLines[0]).toContain("Form 1A");
      expect(overdueLines[0]).toContain("Patient WF-INVOL-72H-DELAY");

      // 5. Morning review: Consultant Psychiatrist conducts statutory examination and signs Form 6A
      const examinedMovement: Movement = {
        ...patientMovement,
        examination: {
          at: now,
          by: "ward",
          examinerName: "Dr Marcus Vance",
          outcome: "inpatient_order", // Form 6A inpatient order signed
        },
      };

      // Invariant: Once Form 6A examination is signed, temporary Form 1A countdown is cleared
      expect(currentLegalDueAt(examinedMovement)).toBeUndefined();
    });
  });

  // ==========================================================================
  // Scenario 3: Hospital-Wide Network Downtime Failure & Census Printout
  // ==========================================================================
  describe("Scenario 3: Hospital-Wide Network Downtime Failure & Census Printout", () => {
    it("generates complete offline downtime pack with inpatient census, validates A4 print CSS, and handles recovery", () => {
      let state = createIsolatedState();
      const unit = state.units.find((u) => u.beds > 0)!;

      // Add occupied inpatient with full clinical metadata
      const testAdmission: Admission = {
        id: "AD-CENSUS-01",
        unitId: unit.id,
        state: "occupied",
        bedNumber: 4,
        movementId: "WF-CENSUS-01",
        patientId: "PT-CENSUS-01",
        legalStatus: "Involuntary",
        observation: observationAt("within_sight"),
        highAcuity: true,
      };

      const testMovement: Movement = {
        ...state.movements[0]!,
        id: "WF-CENSUS-01",
        stage: "arrived",
        admissionId: "AD-CENSUS-01",
      };

      state = {
        ...state,
        admissions: [...state.admissions, testAdmission],
        movements: [...state.movements, testMovement],
      };

      // 1. Generate downtime pack snapshot during network outage
      const pack = downtimePack({
        units: state.units,
        bedUnits: [unit],
        admissions: state.admissions,
        bedReleases: state.bedReleases,
        leaveBeds: state.leaveBeds,
        movements: state.movements,
        now,
        identify: (m) => `Jane Doe · SYN-UMRN-445566`,
        patients: [
          {
            id: "PT-CENSUS-01",
            displayName: "Jane Doe",
            formalName: "Doe, Jane",
            umrn: "SYN-UMRN-445566",
            sex: "Female",
            gender: "Female",
            dateOfBirth: "1985-03-22",
          } as any,
        ],
      });

      // 2. Assert inpatient census table structure
      expect(pack.census).toBeDefined();
      expect(pack.census!.length).toBeGreaterThan(0);
      const censusLine = pack.census!.find((c) => c.unitId === unit.id && c.bedNumber === "4");
      expect(censusLine).toBeDefined();
      expect(censusLine?.patientName).toBe("Jane Doe");
      expect(censusLine?.umrn).toBe("SYN-UMRN-445566");
      expect(censusLine?.legalStatus).toBe("Form 1A");
      expect(censusLine?.observationLevel).toBe("Constant within sight (1:1)");
      expect(censusLine?.specialRequirements).toBe("High acuity");

      // 3. Assert A4 print CSS file exists and contains print formatting
      const cssPath = path.resolve(process.cwd(), "src/components/ward-management/reports/reports.module.css");
      expect(fs.existsSync(cssPath)).toBe(true);
      const cssContent = fs.readFileSync(cssPath, "utf8");
      expect(cssContent).toContain("@media print");
      expect(cssContent).toContain(".packTable");
      expect(cssContent).toContain("data-print-hide");

      // 4. Session memory management under simulated browser window context
      const owner = { active: true, ready: true };
      (globalThis as any).window = {};
      try {
        rememberDowntimePack(pack, state.worldGeneration, owner);
        markDowntimePackHandled(pack);
        expect(downtimePackHandled(pack)).toBe(true);

        // 5. System recovery / scenario reset advances world generation, invalidating cached pack
        const nextGen = state.worldGeneration + 1;
        const stalePack = lastDowntimePack(owner, nextGen);
        expect(stalePack).toBeNull(); // Cache invalidated on world generation change

        forgetDowntimePack(owner);
      } finally {
        delete (globalThis as any).window;
      }
    });
  });

  // ==========================================================================
  // Scenario 4: Complex Multi-Ward Bed Flow Allocation & Formatting
  // ==========================================================================
  describe("Scenario 4: Complex Multi-Ward Bed Flow Allocation & Formatting", () => {
    it("decouples bed occupancy from arithmetic drift and enforces 24h clinical time and Australian DOB", () => {
      const mockUnit: Unit = {
        id: "TEST-MIXED-ACUTE",
        name: "King Edward Acute Unit",
        siteCode: "KEMH",
        beds: 12,
        allocatable: { value: 3, revision: 1, source: "test" },
        empty: { value: 4, revision: 1 },
        allocatableLocked: 1,
        speciallingCapacity: 1,
        isClosed: false,
        closedBeds: [],
      } as unknown as Unit;

      // Active admissions: 9 patients
      const admissions = Array.from({ length: 9 }, (_, i) => ({
        id: `AD-MIXED-${i + 1}`,
        unitId: "TEST-MIXED-ACUTE",
        state: "occupied" as const,
      })) as any[];

      // 1 bed in cleaning
      const bedReleases: BedRelease[] = [
        {
          id: "REL-CLEAN-1",
          unitId: "TEST-MIXED-ACUTE",
          bedNumber: 10,
          state: "discharged",
          preparing: true,
        } as unknown as BedRelease,
      ];

      // 1. Bed occupancy decoupling (Feature 10)
      const cap = unitCapacity(mockUnit, bedReleases, { admissions });
      expect(cap.occupied).toBe(9); // strictly derived from active admissions
      expect(cap.bedsPendingPreparation).toBe(1);
      expect(cap.availableNow).toBe(3 - 1); // available (3) - cleaning (1) = 2

      // 2. 24-hour clinical time format check (Feature 11)
      expect(formatInstant(960)).toBe("16:00");
      expect(formatInstant(642)).toBe("10:42");
      expect(formatInstant(0)).toBe("00:00");
      expect(BAND_LABELS["by-1600"]).toBe("Expected by 16:00");

      // 3. Australian Date of Birth formatting (Feature 11)
      expect(formatDateOfBirth("1974-08-14")).toBe("14/08/1974");
      expect(formatDateOfBirth("2000-01-09")).toBe("09/01/2000");
      expect(formatDateOfBirth(null)).toBe("DOB not recorded");
    });
  });

  // ==========================================================================
  // Scenario 5: Restrictive Practice Seclusion Containment During Transport
  // ==========================================================================
  describe("Scenario 5: Restrictive Practice Seclusion Containment During Transport", () => {
    it("strictly blocks transport collection during acute seclusion and permits transfer after formal end", () => {
      let state = createIsolatedState();
      const sourceStay = state.admissions.find((a) => a.state === "occupied")!;
      const sendingUnitId = sourceStay.unitId;
      const destUnitId = state.units.find((u) => u.id !== sendingUnitId && u.cohort === "Adult")!.id;

      // 1. Acute behavioural emergency: Ward records seclusion start
      state = send(state, {
        type: "RECORD_RESTRICTIVE_PRACTICE_START",
        role: "ward",
        unitId: sendingUnitId,
        actingUnitId: sendingUnitId,
        admissionId: sourceStay.id,
        practice: "seclusion",
        startedAt: now - 30,
      });

      // Destination pulled bed
      const destAdmission: Admission = {
        id: "AD-DEST-HOLD-5",
        unitId: destUnitId,
        state: "pulled",
        patientId: sourceStay.patientId,
        movementId: "WF-SCENARIO-SEC-5",
        bedNumber: 3,
        legalStatus: "Involuntary",
        observation: GENERAL_OBSERVATION,
      };

      // 2. Pre-arranged transfer movement ready for collection
      const transferMovement: Movement = {
        ...state.movements[0]!,
        id: "WF-SCENARIO-SEC-5",
        patientId: sourceStay.patientId,
        stage: "handover_ready",
        sourceAdmissionId: sourceStay.id,
        acceptedUnitId: destUnitId,
        admissionId: "AD-DEST-HOLD-5",
        medicalClearance: { at: now - 20, cleared: true },
        transport: {
          id: "WF-SEC-5-transport",
          provider: "Ambulance service",
          escortRequired: true,
          cadNumber: "CAD-EMERG-SEC-5",
          transportLegalStatus: "involuntary",
          estimatedAt: now + 30,
          acceptedAt: now - 15,
          enRouteAt: now - 5,
          bookedBy: { role: "ed" },
        },
      };

      state = {
        ...state,
        admissions: [...state.admissions, destAdmission],
        movements: [...state.movements, transferMovement],
      };

      // 3. Transport officer attempts PATIENT_COLLECTED while seclusion is active
      state = send(state, {
        type: "PATIENT_COLLECTED",
        role: "officer",
        movementId: "WF-SCENARIO-SEC-5",
      });

      // Restrictive practice guard (Feature 06) halts collection
      expect(state.rejections.at(-1)?.attempted).toBe("PATIENT_COLLECTED");
      expect(state.rejections.at(-1)?.reason).toContain("Seclusion is still recorded as in use");

      // Movement stage remains handover_ready; patient is safely contained on ward
      let movement = state.movements.find((m) => m.id === "WF-SCENARIO-SEC-5")!;
      expect(movement.stage).toBe("handover_ready");
      expect(movement.transport?.collectedAt).toBeUndefined();

      // Destination bed allocation remains protected
      expect(movement.admissionId).toBe("AD-DEST-HOLD-5");

      // 4. Clinical de-escalation: Medical officer reviews patient and ends seclusion
      const unit = state.units.find((u) => u.id === sendingUnitId)!;
      const episodeId = unit.restrictivePractice!.episodes.at(-1)!.id;

      state = send(state, {
        type: "RECORD_RESTRICTIVE_PRACTICE_END",
        role: "ward",
        unitId: sendingUnitId,
        actingUnitId: sendingUnitId,
        episodeId,
        endedAt: now - 5,
      });

      // Ensure openRestrictivePracticeRefusal is now clear
      const unitAfter = state.units.find((u) => u.id === sendingUnitId)!;
      expect(openRestrictivePracticeRefusal(unitAfter.restrictivePractice, sourceStay.id)).toBeUndefined();

      // 5. Transport collection is re-attempted and now succeeds
      state = send(state, {
        type: "PATIENT_COLLECTED",
        role: "officer",
        movementId: "WF-SCENARIO-SEC-5",
      });

      movement = state.movements.find((m) => m.id === "WF-SCENARIO-SEC-5")!;
      expect(movement.stage).toBe("moving");
      expect(movement.transport?.collectedAt).toBe(now);

      // 6. Patient arrives at destination facility
      state = send(state, {
        type: "PATIENT_ARRIVED",
        role: "ward",
        movementId: "WF-SCENARIO-SEC-5",
        actingUnitId: destUnitId,
      });

      movement = state.movements.find((m) => m.id === "WF-SCENARIO-SEC-5")!;
      expect(movement.stage).toBe("arrived");
      expect(movement.closure?.outcome).toBe("arrived");
    });
  });
});
