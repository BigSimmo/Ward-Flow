import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { TRANSPORT_PROVIDERS } from "../src/components/ward-management/ward-model";
import { communityTeamOptions } from "../src/components/ward-management/referrals/referral-destination-options";
import { CANCEL_TRANSPORT_REASONS } from "../src/components/ward-management/ward-change-reasons";

describe("2026-09-16 Product Owner Rulings Verification", () => {
  describe("Ruling 1: Form 1A receipt marks the psychiatric examination clock", () => {
    /*
     * 🔴 **CORRECTED 2026-09-17, T2 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`)
     * — THE THREE COMPUTED-HOURS ASSERTIONS THIS CASE USED TO OPEN WITH ARE GONE, NOT MERELY
     * MOVED.** `FORM_1A_VALIDITY_HOURS`, `FORM_1A_EXAMINATION_WINDOW_HOURS` and
     * `FORM_3D_DETENTION_WINDOW_HOURS` were deleted from `ward-model.ts` by this task, on owner
     * answer 1, 2026-09-17: this prototype works out no legal time limits of its own; the
     * clinician types the expiry written on the form. Ruling 1's real, still-true behaviour — that
     * recording a Form 1A as received starts the receipt clock and refuses a second recording — is
     * what the rest of this case still proves.
     */
    it("marks a Form 1A as received once, refusing a second recording", () => {
      const state = seedWardFlowState();
      const movement = state.movements.find((m) => m.legalForm?.code === "1A" && !m.closure);
      expect(movement).toBeDefined();
      if (!movement) return;

      const received = wardFlowReducer(state, {
        type: "RECORD_LEGAL_FORM_RECEIVED",
        role: "ed",
        now: NOW_ANCHOR + 60,
        movementId: movement.id,
      });
      expect(received.rejections).toEqual([]);
      const updated = received.movements.find((m) => m.id === movement.id);
      expect(updated?.legalFormReceivedAt).toBe(NOW_ANCHOR + 60);

      const duplicate = wardFlowReducer(received, {
        type: "RECORD_LEGAL_FORM_RECEIVED",
        role: "ed",
        now: NOW_ANCHOR + 120,
        movementId: movement.id,
      });
      expect(duplicate.rejections.length).toBeGreaterThan(0);
      expect(duplicate.rejections[0].reason).toContain("already marked as received");
    });
  });

  describe("Ruling 16: Direct ED-to-CMHT referral pathway", () => {
    it("allows ED clinician to refer patient directly to CMHT when acute admission is not needed", () => {
      const state = seedWardFlowState();
      const movement = state.movements.find((m) => m.stage === "destination_review" && !m.closure);
      expect(movement).toBeDefined();
      if (!movement) return;

      const team = communityTeamOptions()[0];
      const result = wardFlowReducer(state, {
        type: "REFER_TO_COMMUNITY_TEAM",
        role: "ed",
        now: NOW_ANCHOR,
        movementId: movement.id,
        team,
      });

      expect(result.rejections).toEqual([]);
      const updated = result.movements.find((m) => m.id === movement.id);
      expect(updated?.closure?.outcome).toBe("did_not_proceed");
      expect(updated?.closure?.reason).toContain(team);
    });

    it("refuses an invalid CMHT team name", () => {
      const state = seedWardFlowState();
      const movement = state.movements.find((m) => !m.closure);
      expect(movement).toBeDefined();
      if (!movement) return;

      const result = wardFlowReducer(state, {
        type: "REFER_TO_COMMUNITY_TEAM",
        role: "ed",
        now: NOW_ANCHOR,
        movementId: movement.id,
        team: "Nonexistent Fantasyland Team",
      });
      expect(result.rejections.length).toBeGreaterThan(0);
      expect(result.rejections[0].reason).toContain("not a valid community mental health team");
    });
  });

  describe("Ruling 6 / Invariant I-05: Arrival Immutability", () => {
    it("strictly rejects stepping back a movement that has physically arrived", () => {
      const state = seedWardFlowState();
      const arrived = state.movements.find((m) => m.stage === "arrived");
      expect(arrived).toBeDefined();
      if (!arrived) return;

      const attempt = wardFlowReducer(state, {
        type: "STEP_BACK_STAGE",
        role: "coordinator",
        now: NOW_ANCHOR,
        movementId: arrived.id,
        to: "moving",
        reason: "recorded_in_error",
      });
      expect(attempt.rejections.length).toBeGreaterThan(0);
      expect(attempt.rejections[0].reason).toContain("cannot step back an arrived movement");
    });
  });

  describe("Ruling 6: Ward arrival confirmation", () => {
    it("allows accepting ward to mark patient arrived when moving", () => {
      const state = seedWardFlowState();
      const moving = state.movements.find((m) => m.stage === "moving" && !m.closure);
      expect(moving).toBeDefined();
      if (!moving || !moving.acceptedUnitId) return;

      const arrival = wardFlowReducer(state, {
        type: "PATIENT_ARRIVED",
        role: "ward",
        now: NOW_ANCHOR,
        movementId: moving.id,
        actingUnitId: moving.acceptedUnitId,
      });

      expect(arrival.rejections).toEqual([]);
      const updated = arrival.movements.find((m) => m.id === moving.id);
      expect(updated?.stage).toBe("arrived");
      expect(updated?.closure?.outcome).toBe("arrived");
    });

    it("refuses another ward from confirming arrival for a patient accepted elsewhere", () => {
      const state = seedWardFlowState();
      const moving = state.movements.find((m) => m.stage === "moving" && !m.closure);
      expect(moving).toBeDefined();
      if (!moving || !moving.acceptedUnitId) return;

      const wrongUnit = state.units.find((u) => u.id !== moving.acceptedUnitId);
      expect(wrongUnit).toBeDefined();
      if (!wrongUnit) return;

      const arrival = wardFlowReducer(state, {
        type: "PATIENT_ARRIVED",
        role: "ward",
        now: NOW_ANCHOR,
        movementId: moving.id,
        actingUnitId: wrongUnit.id,
      });

      expect(arrival.rejections.length).toBeGreaterThan(0);
      expect(arrival.rejections[0].reason).toContain("cannot confirm arrival for a patient accepted at");
    });
  });

  describe("Ruling 11: Transport cancellation authority", () => {
    it("allows ward role to cancel transport if it booked it", () => {
      const state = seedWardFlowState();
      const pulled = state.movements.find((m) => m.stage === "pulled" && !m.closure);
      expect(pulled).toBeDefined();
      if (!pulled) return;

      const bookingUnit = state.units[0];
      const otherUnit = state.units[1];

      const booked = wardFlowReducer(state, {
        type: "BOOK_TRANSPORT",
        role: "ward",
        now: NOW_ANCHOR,
        movementId: pulled.id,
        provider: TRANSPORT_PROVIDERS[0],
        escortRequired: false,
        cadNumber: "CAD-STUB-0001",
        transportLegalStatus: "voluntary",
        estimatedAt: 0,
        actingUnitId: bookingUnit.id,
      });
      expect(booked.rejections).toEqual([]);

      // Other ward cannot cancel
      const otherCancel = wardFlowReducer(booked, {
        type: "CANCEL_TRANSPORT",
        role: "ward",
        now: NOW_ANCHOR + 5,
        movementId: pulled.id,
        reason: CANCEL_TRANSPORT_REASONS[0],
        actingUnitId: otherUnit.id,
      });
      expect(otherCancel.rejections.length).toBeGreaterThan(0);
      expect(otherCancel.rejections[0].reason).toContain("may only cancel transport it booked");

      // Originating ward can cancel
      const cancelled = wardFlowReducer(booked, {
        type: "CANCEL_TRANSPORT",
        role: "ward",
        now: NOW_ANCHOR + 10,
        movementId: pulled.id,
        reason: CANCEL_TRANSPORT_REASONS[0],
        actingUnitId: bookingUnit.id,
      });
      expect(cancelled.rejections).toEqual([]);
      const updated = cancelled.movements.find((m) => m.id === pulled.id);
      const unwind = updated?.unwinds.find((u) => u.kind === "transport_cancelled");
      expect(unwind?.by).toBe("ward");
      expect(unwind?.reason).toBe(CANCEL_TRANSPORT_REASONS[0]);
      expect(unwind?.at).toBe(NOW_ANCHOR + 10);
    });
  });
});
