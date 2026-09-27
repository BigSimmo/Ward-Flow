import { describe, expect, it } from "vitest";
import { wardFlowReducer, seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import type { Admission } from "@/components/ward-management/ward-admissions";

describe("Advanced clinical coordination features & behaviors", () => {
  const baseState = seedWardFlowState();
  const now = 9 * 60; // 09:00

  describe("Option 0: Arrival Time & Transport ETA on Pulled Beds", () => {
    it("records arrival details and clears the default pullExpiresAt 4h hold", () => {
      // Find or pull a patient
      const pulledMovement = baseState.movements.find((m) => m.stage === "pulled") ?? baseState.movements[0];
      const stateWithHold = {
        ...baseState,
        movements: baseState.movements.map((m) =>
          m.id === pulledMovement.id ? { ...m, pullExpiresAt: now + 240 } : m,
        ),
      };

      const eta = now + 120; // 2 hours from now
      const result = wardFlowReducer(stateWithHold, {
        type: "SET_ARRIVAL_DETAILS",
        role: "coordinator",
        now,
        movementId: pulledMovement.id,
        arrivalMode: "mental_health_transport",
        trackingNumber: "CAD-2026-9812",
        estimatedArrivalAt: eta,
      });

      const updated = result.movements.find((m) => m.id === pulledMovement.id)!;
      expect(updated.arrivalDetails).toBeDefined();
      expect(updated.arrivalDetails?.mode).toBe("mental_health_transport");
      expect(updated.arrivalDetails?.trackingNumber).toBe("CAD-2026-9812");
      expect(updated.arrivalDetails?.estimatedArrivalAt).toBe(eta);
      expect(updated.arrivalDetails?.recordedBy).toBe("coordinator");
      expect(updated.arrivalDetails?.recordedAt).toBe(now);

      // The 4-hour hold is cleared because arrival plan is confirmed
      expect(updated.pullExpiresAt).toBeUndefined();
    });

    it("refuses SET_ARRIVAL_DETAILS for non-existent movement", () => {
      const result = wardFlowReducer(baseState, {
        type: "SET_ARRIVAL_DETAILS",
        role: "coordinator",
        now,
        movementId: "WF-NONEXISTENT",
        arrivalMode: "self",
        estimatedArrivalAt: now + 60,
      });

      expect(result.rejections.length).toBeGreaterThan(baseState.rejections.length);
      expect(result.rejections.at(-1)?.reason).toContain("no movement found");
    });
  });

  describe("Option 1: Cascade Solver (Step-Down Candidate Tagging)", () => {
    it("allows ward manager or coordinator to tag step-down candidate", () => {
      const admission = baseState.admissions.find((a) => a.state === "occupied")!;
      expect(admission.stepDownCandidate).toBeFalsy();

      const tagged = wardFlowReducer(baseState, {
        type: "SET_STEP_DOWN_CANDIDATE",
        role: "ward",
        now,
        actingUnitId: admission.unitId,
        admissionId: admission.id,
        stepDownCandidate: true,
      });

      const updated = tagged.admissions.find((a) => a.id === admission.id)!;
      expect(updated.stepDownCandidate).toBe(true);

      const untagged = wardFlowReducer(tagged, {
        type: "SET_STEP_DOWN_CANDIDATE",
        role: "ward",
        now,
        actingUnitId: admission.unitId,
        admissionId: admission.id,
        stepDownCandidate: false,
      });

      expect(untagged.admissions.find((a) => a.id === admission.id)!.stepDownCandidate).toBe(false);
    });
  });

  describe("Option 2: Discharge Barriers for Long-Stay Patients (LOS >= 7 Days)", () => {
    it("refuses to set discharge barrier if patient stay is less than 7 days", () => {
      // Create or find patient with stay < 7 days (e.g. arrived 2 days ago)
      const recentAdmission: Admission = {
        ...baseState.admissions[0],
        id: "ADM-RECENT",
        state: "occupied",
        arrivedAt: now - 2 * MINUTES_PER_DAY,
      };
      const testState = {
        ...baseState,
        admissions: [recentAdmission, ...baseState.admissions],
      };

      const result = wardFlowReducer(testState, {
        type: "SET_DISCHARGE_BARRIER",
        role: "ward",
        now,
        actingUnitId: recentAdmission.unitId,
        admissionId: recentAdmission.id,
        barrier: "NDIS",
      });

      expect(result.rejections.length).toBeGreaterThan(testState.rejections.length);
      expect(result.rejections.at(-1)?.reason).toContain("less than 7 days");
    });

    it("successfully sets discharge barrier when patient stay is 7 days or more", () => {
      const longStayAdmission: Admission = {
        ...baseState.admissions[0],
        id: "ADM-LONG-STAY",
        state: "occupied",
        arrivedAt: now - 10 * MINUTES_PER_DAY,
      };
      const testState = {
        ...baseState,
        admissions: [longStayAdmission, ...baseState.admissions],
      };

      const result = wardFlowReducer(testState, {
        type: "SET_DISCHARGE_BARRIER",
        role: "ward",
        now,
        actingUnitId: longStayAdmission.unitId,
        admissionId: longStayAdmission.id,
        barrier: "Accommodation / Housing",
      });

      const updated = result.admissions.find((a) => a.id === "ADM-LONG-STAY")!;
      expect(updated.dischargeBarrier).toBe("Accommodation / Housing");

      // Can clear with "None"
      const cleared = wardFlowReducer(result, {
        type: "SET_DISCHARGE_BARRIER",
        role: "ward",
        now,
        actingUnitId: longStayAdmission.unitId,
        admissionId: longStayAdmission.id,
        barrier: "None",
      });
      expect(cleared.admissions.find((a) => a.id === "ADM-LONG-STAY")!.dischargeBarrier).toBeNull();
    });
  });

  describe("Option 3: Pre-Admission Medical Clearance Checkpoint", () => {
    it("updates medical clearance on movement and synchronizes linked referral", () => {
      const movement = baseState.movements.find((m) => m.referralId !== undefined) ?? baseState.movements[0];
      const result = wardFlowReducer(baseState, {
        type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
        role: "ed",
        now,
        movementId: movement.id,
        cleared: true,
      });

      const updatedMovement = result.movements.find((m) => m.id === movement.id)!;
      expect(updatedMovement.medicalClearance).toEqual({ cleared: true, at: now });

      if (movement.referralId) {
        const updatedReferral = result.referrals.find((r) => r.id === movement.referralId)!;
        expect(updatedReferral.medicalClearance).toEqual({ cleared: true, at: now });
      }
    });
  });

  describe("Option 4: Upload Forms Hub for Transport", () => {
    it("attaches uploaded forms with audit metadata to movement", () => {
      const movement = baseState.movements[0];
      const result1 = wardFlowReducer(baseState, {
        type: "UPLOAD_PATIENT_FORM",
        role: "ward",
        now,
        movementId: movement.id,
        formName: "Form 4A Transport Order",
        fileName: "form-4a-signed.pdf",
        sizeBytes: 245000,
      });

      const updated1 = result1.movements.find((m) => m.id === movement.id)!;
      expect(updated1.uploadedForms?.length).toBe(1);
      expect(updated1.uploadedForms?.[0].formName).toBe("Form 4A Transport Order");
      expect(updated1.uploadedForms?.[0].fileName).toBe("form-4a-signed.pdf");
      expect(updated1.uploadedForms?.[0].sizeBytes).toBe(245000);
      expect(updated1.uploadedForms?.[0].uploadedBy).toBe("ward");

      // Upload a second form (Clinical Transfer Summary)
      const result2 = wardFlowReducer(result1, {
        type: "UPLOAD_PATIENT_FORM",
        role: "ed",
        now: now + 15,
        movementId: movement.id,
        formName: "Clinical Transfer Summary",
        fileName: "transfer-summary-ed.pdf",
        sizeBytes: 512,
      });

      const updated2 = result2.movements.find((m) => m.id === movement.id)!;
      expect(updated2.uploadedForms?.length).toBe(2);
      expect(updated2.uploadedForms?.[1].formName).toBe("Clinical Transfer Summary");
      expect(updated2.uploadedForms?.[1].sizeBytes).toBe(512);
    });
  });
});
