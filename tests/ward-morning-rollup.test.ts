import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("Morning Bed Rollup and Ward Buzz state tracking", () => {
  const now = NOW_ANCHOR + 60; // 11:42

  it("seedWardFlowState initializes morningRollupConfirmations as an empty record", () => {
    const state = seedWardFlowState();
    expect(state.morningRollupConfirmations).toBeDefined();
    expect(state.morningRollupConfirmations).toEqual({});
  });

  describe("CONFIRM_MORNING_ROLLUP", () => {
    it("updates the confirmation entry for a unit when dispatched by ward manager", () => {
      const state = seedWardFlowState();
      const unit = state.units[0]!;

      const next = wardFlowReducer(state, {
        type: "CONFIRM_MORNING_ROLLUP",
        role: "ward",
        now,
        unitId: unit.id,
        actingUnitId: unit.id,
        expectedDischarges: 3,
      });

      expect(next.rejections).toHaveLength(state.rejections.length);
      expect(next.morningRollupConfirmations[unit.id]).toEqual({
        confirmedAt: now,
        confirmedByRole: "ward",
        expectedDischarges: 3,
      });
    });

    it("allows coordinator to confirm morning rollup for a unit", () => {
      const state = seedWardFlowState();
      const unit = state.units[1]!;

      const next = wardFlowReducer(state, {
        type: "CONFIRM_MORNING_ROLLUP",
        role: "coordinator",
        now,
        unitId: unit.id,
        expectedDischarges: 0,
      });

      expect(next.rejections).toHaveLength(state.rejections.length);
      expect(next.morningRollupConfirmations[unit.id]).toEqual({
        confirmedAt: now,
        confirmedByRole: "coordinator",
        expectedDischarges: 0,
      });
    });

    it("rejects confirmation when unit is missing", () => {
      const state = seedWardFlowState();
      const next = wardFlowReducer(state, {
        type: "CONFIRM_MORNING_ROLLUP",
        role: "ward",
        now,
        unitId: "non-existent-unit",
        expectedDischarges: 2,
      });

      expect(next.rejections).toHaveLength(state.rejections.length + 1);
      const latestRejection = next.rejections[next.rejections.length - 1]!;
      expect(latestRejection.reason).toContain("no unit found for id non-existent-unit");
      expect(next.morningRollupConfirmations).toEqual({});
    });

    it("rejects confirmation when expectedDischarges is negative", () => {
      const state = seedWardFlowState();
      const unit = state.units[0]!;

      const next = wardFlowReducer(state, {
        type: "CONFIRM_MORNING_ROLLUP",
        role: "ward",
        now,
        unitId: unit.id,
        expectedDischarges: -1,
        actingUnitId: unit.id,
      });

      expect(next.rejections).toHaveLength(state.rejections.length + 1);
      const latestRejection = next.rejections[next.rejections.length - 1]!;
      expect(latestRejection.reason).toContain("expectedDischarges must be a finite, non-negative whole number");
      expect(next.morningRollupConfirmations[unit.id]).toBeUndefined();
    });

    it("refuses unpermitted role (e.g. ED)", () => {
      const state = seedWardFlowState();
      const unit = state.units[0]!;

      const next = wardFlowReducer(state, {
        type: "CONFIRM_MORNING_ROLLUP",
        role: "ed",
        now,
        unitId: unit.id,
        expectedDischarges: 1,
      });

      expect(next.rejections).toHaveLength(state.rejections.length + 1);
      expect(next.morningRollupConfirmations[unit.id]).toBeUndefined();
    });
  });

  describe("SEND_WARD_BUZZ", () => {
    it("adds a buzz to refreshRequests from coordinator", () => {
      const state = seedWardFlowState();
      const unit = state.units[0]!;

      const next = wardFlowReducer(state, {
        type: "SEND_WARD_BUZZ",
        role: "coordinator",
        now,
        unitId: unit.id,
        message: "Please confirm your morning bed discharges",
        urgent: true,
      });

      expect(next.rejections).toHaveLength(state.rejections.length);
      expect(next.refreshRequests).toHaveLength(state.refreshRequests.length + 1);
      const latestRequest = next.refreshRequests[next.refreshRequests.length - 1]!;
      expect(latestRequest).toEqual({
        unitId: unit.id,
        at: now,
        byRole: "coordinator",
        message: "Please confirm your morning bed discharges",
        urgent: true,
      });
    });

    it("adds a buzz from bed_manager role", () => {
      const state = seedWardFlowState();
      const unit = state.units[1]!;

      const next = wardFlowReducer(state, {
        type: "SEND_WARD_BUZZ",
        role: "bed_manager",
        now,
        unitId: unit.id,
        message: "Bed manager checking ICU step-downs",
      });

      expect(next.rejections).toHaveLength(state.rejections.length);
      const latestRequest = next.refreshRequests[next.refreshRequests.length - 1]!;
      expect(latestRequest).toEqual({
        unitId: unit.id,
        at: now,
        byRole: "bed_manager",
        message: "Bed manager checking ICU step-downs",
        urgent: undefined,
      });
    });

    it("adds a buzz from executive role", () => {
      const state = seedWardFlowState();
      const unit = state.units[0]!;

      const next = wardFlowReducer(state, {
        type: "SEND_WARD_BUZZ",
        role: "executive",
        now,
        unitId: unit.id,
        message: "Executive escalation: site capacity threshold breached",
        urgent: true,
      });

      expect(next.rejections).toHaveLength(state.rejections.length);
      const latestRequest = next.refreshRequests[next.refreshRequests.length - 1]!;
      expect(latestRequest).toEqual({
        unitId: unit.id,
        at: now,
        byRole: "executive",
        message: "Executive escalation: site capacity threshold breached",
        urgent: true,
      });
    });

    it("rejects buzz for non-existent unit", () => {
      const state = seedWardFlowState();

      const next = wardFlowReducer(state, {
        type: "SEND_WARD_BUZZ",
        role: "coordinator",
        now,
        unitId: "non-existent-unit",
        message: "Ping",
      });

      expect(next.rejections).toHaveLength(state.rejections.length + 1);
      const latestRejection = next.rejections[next.rejections.length - 1]!;
      expect(latestRejection.reason).toContain("no unit found for id non-existent-unit");
      expect(next.refreshRequests).toHaveLength(state.refreshRequests.length);
    });

    it("refuses buzz from unpermitted role (e.g. ward manager)", () => {
      const state = seedWardFlowState();
      const unit = state.units[0]!;

      const next = wardFlowReducer(state, {
        type: "SEND_WARD_BUZZ",
        role: "ward",
        now,
        unitId: unit.id,
        message: "Ward buzz",
      });

      expect(next.rejections).toHaveLength(state.rejections.length + 1);
      expect(next.refreshRequests).toHaveLength(state.refreshRequests.length);
    });
  });
});
