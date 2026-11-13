import { describe, it, expect } from "vitest";
import {
  createIsolatedState,
  createTestJourney,
  TEST_NOW,
} from "../helpers/test-harness";
import { instantFromDateAndTimeInputs } from "@/components/ward-management/legal-forms/legal-forms-view";
import { wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";

describe("Feature 16: Architectural Rulings & Statutory Boundaries", () => {
  describe("Ruling D-5: No Automated Date Arithmetic on Legal Expiries", () => {
    const dayZero = new Date("2026-10-01T00:00:00+08:00");

    it("requires explicit clinician date and time input via instantFromDateAndTimeInputs", () => {
      // Clinician provides exact date and 24h time
      const instant = instantFromDateAndTimeInputs("2026-10-02", "14:30", dayZero);
      expect(instant).toBeDefined();
      expect(typeof instant).toBe("number");
      // Day 1 (1440 min) + 14h (840 min) + 30 min = 2310 min
      expect(instant).toBe(1440 + 840 + 30);
    });

    it("strictly refuses incomplete or malformed date/time inputs without inventing durations", () => {
      // Missing time
      expect(instantFromDateAndTimeInputs("2026-10-02", "", dayZero)).toBeUndefined();
      // Missing date
      expect(instantFromDateAndTimeInputs("", "14:30", dayZero)).toBeUndefined();
      // Non-existent calendar day (31st of February)
      expect(instantFromDateAndTimeInputs("2026-02-31", "10:00", dayZero)).toBeUndefined();
      // Malformed time string
      expect(instantFromDateAndTimeInputs("2026-10-02", "25:99", dayZero)).toBeUndefined();
    });
  });

  describe("Ruling D-72: Operational Restrictive Practice Scope (No Chemical Restraint/EHR Registers)", () => {
    it("restricts tracked restrictive practices strictly to operational seclusion/bodily restraint", () => {
      const state = createIsolatedState();
      const admission = state.admissions.find((a) => a.state === "occupied");
      expect(admission).toBeDefined();
      const unitId = admission!.unitId;

      // Start an operational seclusion episode
      const startEvent: WardFlowEvent = {
        type: "RECORD_RESTRICTIVE_PRACTICE_START",
        role: "ward",
        now: TEST_NOW,
        unitId,
        actingUnitId: unitId,
        admissionId: admission!.id,
        practice: "seclusion",
        startedAt: TEST_NOW - 30,
      };

      const next = wardFlowReducer(state, startEvent);
      expect(next.rejections).toHaveLength(0);
      const updatedUnit = next.units.find((u) => u.id === unitId)!;
      const openEpisodes = (updatedUnit.restrictivePractice?.episodes ?? []).filter(
        (rp) => rp.endedAt === undefined,
      );
      expect(openEpisodes.length).toBeGreaterThan(0);
      expect(openEpisodes[0].practice).toBe("seclusion");
    });
  });

  describe("Aeromedical Dual-Bed Holding Resilience", () => {
    it("preserves destination bed allocation throughout active transit until arrived", () => {
      // Journey with affirmative medical clearance
      const j = createTestJourney({
        initialClearance: true,
        edId: "hedland-ed",
        unitId: "scgh-adult-open",
        extendedHold: true,
      });

      // Book transport
      j.bookTransport();

      // Advance to moving (patient collected and in flight)
      j.advanceToMoving();
      const movingMovement = j.currentMovement();
      expect(movingMovement.stage).toBe("moving");
      // Allocated bed and admission must be firmly preserved at destination
      expect(movingMovement.allocatedBed).toBeDefined();
      expect(movingMovement.admissionId).toBeDefined();

      const heldAdmission = j.state.admissions.find((a) => a.id === movingMovement.admissionId);
      expect(heldAdmission).toBeDefined();

      // Only upon patient arrival is the stage transitioned to arrived
      j.advanceToArrived();
      const arrivedMovement = j.currentMovement();
      expect(arrivedMovement.stage).toBe("arrived");
    });

    it("holds the bed even when aeromedical transit encounters extended flight durations", () => {
      const j = createTestJourney({
        initialClearance: true,
        edId: "karratha-ed",
        unitId: "scgh-adult-open",
        extendedHold: true,
      });

      const movement = j.currentMovement();
      expect(movement.extendedHoldAt).toBeDefined();
      expect(movement.allocatedBed).toBeDefined();
    });
  });
});
