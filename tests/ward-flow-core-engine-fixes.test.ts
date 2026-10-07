import { describe, expect, it } from "vitest";

import { referralForMovement } from "../src/components/ward-management/ward-derivations";
import { eligibility } from "../src/components/ward-management/ward-eligibility";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { TRANSPORT_PROVIDERS } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR, siteByCode } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

describe("Ward Flow Core Engine & Reducer Fixes", () => {
  describe("Task 1.1: handleRaiseReferral preserves patientId & referralId", () => {
    it("preserves patientId and referralId from linked referral on created movement", () => {
      let state = seedWardFlowState("standard");
      const validPatientId = state.patients[0].id;

      // Receive a referral with patientId
      state = wardFlowReducer(state, {
        type: "RECEIVE_REFERRAL",
        role: "community",
        now: NOW,
        patientId: validPatientId,
        ageBand: "Adult",
        destinations: [{ kind: "emergency_department", edId: "jhc-ed", purpose: "psychiatric_review" }],
        homeRegion: "Perth Metropolitan",
        suburb: { kind: "named", name: "Joondalup" },
        source: "community",
        urgency: 2,
        originSiteCode: "JHC",
        transportNeeded: false,
        history: "Test clinical referral history notes.",
      });

      const referral = state.referrals.at(-1);
      expect(state.rejections, state.rejections.at(-1)?.reason).toHaveLength(0);
      expect(referral).toBeDefined();

      // Raise movement from that referral
      state = wardFlowReducer(state, {
        type: "RAISE_REFERRAL",
        role: "ed",
        now: NOW,
        edId: "jhc-ed",
        referralId: referral!.id,
        draft: {
          cohort: "Adult",
          security: "Open",
          sex: "Female",
          gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
          specialling: false,
          highAcuity: false,
          legalStatus: "Voluntary",
          urgency: 2,
          legalFormCode: null,
        },
      });

      expect(state.rejections, state.rejections.at(-1)?.reason).toHaveLength(0);
      const movement = state.movements.find((m) => m.referralId === referral!.id);
      expect(movement).toBeDefined();
      expect(movement!.referralId).toBe(referral!.id);
      expect(movement!.patientId).toBe(validPatientId);

      // Check referralForMovement strictly resolves patient identity
      const resolved = referralForMovement(movement!, state.referrals);
      expect(resolved).toBeDefined();
      expect(resolved!.patientId).toBe(validPatientId);
    });

    it("allows passing patientId directly on RAISE_REFERRAL event when raising unlinked movement", () => {
      let state = seedWardFlowState("standard");

      state = wardFlowReducer(state, {
        type: "RAISE_REFERRAL",
        role: "ed",
        now: NOW,
        edId: "jhc-ed",
        patientId: "PT-002",
        draft: {
          cohort: "Adult",
          security: "Open",
          sex: "Male",
          gender: "Male", // R7 (2026-09-25): record gender so the walk needs no coordinator review
          specialling: false,
          highAcuity: false,
          legalStatus: "Voluntary",
          urgency: 1,
          legalFormCode: null,
        },
      });

      const movement = state.movements.at(-1);
      expect(movement).toBeDefined();
      expect(movement!.patientId).toBe("PT-002");
    });
  });

  describe("Task 1.2: PULL_PATIENT patientId resolution fallback chain", () => {
    it("resolves patientId from referral, movement, or event fallback chain", () => {
      let state = seedWardFlowState("standard");

      // Setup a movement with patientId but no referral
      state = wardFlowReducer(state, {
        type: "RAISE_REFERRAL",
        role: "ed",
        now: NOW,
        edId: "jhc-ed",
        patientId: "PT-003",
        draft: {
          cohort: "Adult",
          security: "Open",
          sex: "Female",
          gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
          specialling: false,
          highAcuity: false,
          legalStatus: "Voluntary",
          urgency: 2,
          legalFormCode: null,
        },
      });

      const movement = state.movements.at(-1)!;
      const unitId = "scgh-adult-open";

      // Step through placement to pulled
      state = wardFlowReducer(state, {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        now: NOW + 5,
        movementId: movement.id,
        unitIds: [unitId],
      });

      state = wardFlowReducer(state, {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now: NOW + 10,
        movementId: movement.id,
        unitId,
      });

      state = wardFlowReducer(state, {
        type: "PULL_PATIENT",
        role: "ward",
        now: NOW + 15,
        movementId: movement.id,
        unitId,
      });

      const pulledAdmission = state.admissions.find((a) => a.movementId === movement.id);
      expect(pulledAdmission).toBeDefined();
      expect(pulledAdmission!.patientId).toBe("PT-003");
    });
  });

  // Owner decision (Josh, 25 Sept 2026, approving the audit's arrival fix): PATIENT_ARRIVED never
  // invents an admission for a movement that has none; the invented one was locked without taking a
  // locked bed and back-dated to when the referral opened. This test used to pin that invention; it
  // now pins its absence, while still checking the arrival itself and the empty-bed decrement.
  describe("Task 1.3: PATIENT_ARRIVED leaves an absent admission absent", () => {
    it("records the arrival without inventing an Admission when the movement has no admissionId", () => {
      const state = seedWardFlowState("standard");
      // WF-014 in seed is in 'moving' stage and has no admissionId
      const targetMovement = state.movements.find((m) => m.id === "WF-014");
      expect(targetMovement).toBeDefined();
      expect(targetMovement!.admissionId).toBeUndefined();
      expect(targetMovement!.stage).toBe("moving");

      const beforeAdmissionIds = state.admissions.map((a) => a.id);
      const acceptedUnit = state.units.find((u) => u.id === targetMovement!.acceptedUnitId)!;
      const emptyBedsBefore = acceptedUnit.empty.value;
      const lockedBefore = acceptedUnit.allocatableLocked;

      const afterState = wardFlowReducer(state, {
        type: "PATIENT_ARRIVED",
        role: "officer",
        now: NOW,
        movementId: "WF-014",
      });

      expect(afterState.rejections).toHaveLength(0);
      // No admission invented: the same ids, in the same order, and none for this movement.
      expect(afterState.admissions.map((a) => a.id)).toEqual(beforeAdmissionIds);
      expect(afterState.admissions.some((a) => a.movementId === "WF-014" && a.id.startsWith("AD-ARR-"))).toBe(false);

      const arrivedMovement = afterState.movements.find((m) => m.id === "WF-014")!;
      expect(arrivedMovement.stage).toBe("arrived");
      expect(arrivedMovement.admissionId).toBeUndefined();

      // The arrival still takes the physical bed, and the locked-bed count does not move.
      const afterUnit = afterState.units.find((u) => u.id === targetMovement!.acceptedUnitId)!;
      expect(afterUnit.empty.value).toBe(Math.max(0, emptyBedsBefore - 1));
      expect(afterUnit.allocatableLocked).toBe(lockedBefore);
    });
  });

  describe("Task 1.4: RECORD_REPATRIATION enqueues return transfer Movement", () => {
    it("initiates a return transfer Movement when receivingWardAgreed is true", () => {
      const state = seedWardFlowState("standard");
      const admission = state.admissions[0]!;
      const movementsBefore = state.movements.length;

      const afterState = wardFlowReducer(state, {
        type: "RECORD_REPATRIATION",
        role: "coordinator",
        now: NOW,
        admissionId: admission.id,
        homeHospital: "RPH",
        receivingWardAgreed: true,
        mode: "road",
        provider: TRANSPORT_PROVIDERS[0],
        cadNumber: "CAD-9876",
        transportLegalStatus: "voluntary",
        estimatedAt: NOW + 120,
      });

      expect(afterState.rejections).toHaveLength(0);
      expect(afterState.repatriations).toHaveLength(1);
      expect(afterState.movements.length).toBe(movementsBefore + 1);

      const returnMovement = afterState.movements.at(-1)!;
      expect(returnMovement.stage).toBe("placement_requested");
      expect(returnMovement.sourceAdmissionId).toBe(admission.id);
      expect(returnMovement.admissionId).toBeUndefined();
      expect(returnMovement.patientId).toBe(admission.patientId ?? undefined);
      expect(returnMovement.blocker).toContain("Royal Perth Hospital");
      expect(returnMovement.blocker).toContain("agreed; awaiting destination bed placement");

      const targetSite = siteByCode("RPH");
      expect(returnMovement.blocker).toContain(targetSite?.service);
    });

    it("does not enqueue return movement if receivingWardAgreed is false", () => {
      const state = seedWardFlowState("standard");
      const admission = state.admissions[0]!;
      const movementsBefore = state.movements.length;

      const afterState = wardFlowReducer(state, {
        type: "RECORD_REPATRIATION",
        role: "coordinator",
        now: NOW,
        admissionId: admission.id,
        homeHospital: "RPH",
        receivingWardAgreed: false,
        mode: "road",
        provider: TRANSPORT_PROVIDERS[0],
        cadNumber: "CAD-9877",
        transportLegalStatus: "voluntary",
        estimatedAt: NOW + 120,
      });

      expect(afterState.rejections).toHaveLength(0);
      expect(afterState.repatriations).toHaveLength(1);
      expect(afterState.movements.length).toBe(movementsBefore);
    });

    it("lets the receiving ward pull the return movement instead of refusing it as someone else's bed", () => {
      const state = seedWardFlowState("standard");
      const admission = state.admissions.find((candidate) => candidate.state === "occupied")!;
      const repatState = wardFlowReducer(state, {
        type: "RECORD_REPATRIATION",
        role: "coordinator",
        now: NOW,
        admissionId: admission.id,
        homeHospital: "RPH",
        receivingWardAgreed: true,
        mode: "road",
        provider: TRANSPORT_PROVIDERS[0],
        cadNumber: "CAD-9876",
        transportLegalStatus: "voluntary",
        estimatedAt: NOW + 120,
      });
      const returnMovement = repatState.movements.at(-1)!;
      const destination = repatState.units.find(
        (unit) =>
          unit.id !== admission.unitId &&
          unit.cohort === returnMovement.cohort &&
          unit.empty.value > 1 &&
          eligibility(returnMovement, unit, NOW).eligible,
      )!;
      expect(destination, "the seed needs a second ward with room for this cohort").toBeDefined();

      let next = wardFlowReducer(repatState, {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        now: NOW + 5,
        movementId: returnMovement.id,
        unitIds: [destination.id],
      });
      next = wardFlowReducer(next, {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now: NOW + 10,
        movementId: returnMovement.id,
        unitId: destination.id,
      });
      next = wardFlowReducer(next, {
        type: "PULL_PATIENT",
        role: "ward",
        now: NOW + 15,
        movementId: returnMovement.id,
        unitId: destination.id,
      });

      expect(next.rejections.map((rejection) => rejection.reason)).toEqual([]);
      const pulled = next.movements.find((movement) => movement.id === returnMovement.id)!;
      expect(pulled.stage).toBe("pulled");
      expect(pulled.admissionId).not.toBe(admission.id);
      expect(next.admissions.find((candidate) => candidate.id === admission.id)?.state).toBe("occupied");

      // Arrival ends the sending stay, so the patient never holds a bed at both hospitals.
      const sendingUnitEmptyBefore = next.units.find((unit) => unit.id === admission.unitId)!.empty.value;
      next = wardFlowReducer(next, {
        type: "RECORD_TRANSPORT_NEED",
        role: "ward",
        now: NOW + 20,
        movementId: returnMovement.id,
        needed: false,
      });
      next = wardFlowReducer(next, {
        type: "PATIENT_ARRIVED",
        role: "ward",
        now: NOW + 30,
        movementId: returnMovement.id,
        actingUnitId: destination.id,
      });
      expect(next.rejections.map((rejection) => rejection.reason)).toEqual([]);
      const sending = next.admissions.find((candidate) => candidate.id === admission.id)!;
      expect(sending.state).toBe("departed");
      expect(sending.leavingDestination).toBe("transferred-to-another-psychiatric-ward");
      expect(next.units.find((unit) => unit.id === admission.unitId)!.empty.value).toBe(sendingUnitEmptyBefore + 1);
    });

    it("does not delete source admission from state when repatriation referral is withdrawn", () => {
      const state = seedWardFlowState("standard");
      const admission = state.admissions[0]!;

      const repatState = wardFlowReducer(state, {
        type: "RECORD_REPATRIATION",
        role: "coordinator",
        now: NOW,
        admissionId: admission.id,
        homeHospital: "RPH",
        receivingWardAgreed: true,
        mode: "road",
        provider: TRANSPORT_PROVIDERS[0],
        cadNumber: "CAD-9876",
        transportLegalStatus: "voluntary",
        estimatedAt: NOW + 120,
      });

      const returnMovement = repatState.movements.at(-1)!;
      expect(returnMovement.sourceAdmissionId).toBe(admission.id);
      expect(returnMovement.admissionId).toBeUndefined();

      // Refer to a unit and withdraw
      const referredState = wardFlowReducer(repatState, {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        now: NOW + 5,
        movementId: returnMovement.id,
        unitIds: ["unit-rph-acute"],
      });

      const withdrawnState = wardFlowReducer(referredState, {
        type: "WITHDRAW_REFERRAL",
        role: "coordinator",
        now: NOW + 10,
        movementId: returnMovement.id,
      });

      // Source admission must still exist in admissions (not deleted by releasePulledBedAndAdmission)!
      expect(withdrawnState.admissions.some((a) => a.id === admission.id)).toBe(true);
    });
  });
});
