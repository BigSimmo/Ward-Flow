import { describe, it, expect } from "vitest";
import {
  createIsolatedState,
  TEST_NOW,
} from "../helpers/test-harness";
import { wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import {
  currentDeskId,
  COORDINATOR_DESK_ID,
  OFFICER_DESK_ID,
} from "@/components/ward-management/settings/workstation-desks";
import { unitCapacity } from "@/components/ward-management/ward-derivations-transport";
import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import {
  formatInstant,
} from "@/components/ward-management/ward-clock";
import {
  formatDateOfBirth,
} from "@/components/ward-management/ward-patients";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { Unit, BedRelease } from "@/components/ward-management/ward-model";

describe("Tier 2 - Boundaries & Corner Cases: Features 09 - 12", () => {
  describe("Feature 09: Broadcast Alerts & Workstation Desk Routing Boundaries", () => {
    it("rejects STAND_DOWN_BROADCAST_ALERT when alertId does not exist", () => {
      const state = createIsolatedState();
      const event: WardFlowEvent = {
        type: "STAND_DOWN_BROADCAST_ALERT",
        role: "coordinator",
        now: TEST_NOW,
        alertId: "NON-EXISTENT-ALERT-999",
      };

      const next = wardFlowReducer(state, event);
      expect(next.rejections.length).toBeGreaterThan(0);
      expect(next.rejections.at(-1)?.reason).toContain("not found");
    });

    it("routes root path and unfamiliar segments to COORDINATOR_DESK_ID", () => {
      expect(currentDeskId("/")).toBe(COORDINATOR_DESK_ID);
      expect(currentDeskId("")).toBe(COORDINATOR_DESK_ID);
      expect(currentDeskId("/random-page")).toBe(COORDINATOR_DESK_ID);
      expect(currentDeskId("/ward-flow/search")).toBe(COORDINATOR_DESK_ID);
    });

    it("routes transport officer segment to OFFICER_DESK_ID", () => {
      expect(currentDeskId("/ward-flow/transport/officer")).toBe(OFFICER_DESK_ID);
    });

    it("routes deeply nested ward and board paths to the exact unit ID", () => {
      expect(currentDeskId("/ward-flow/ward/rph-adult-secure")).toBe("rph-adult-secure");
      expect(currentDeskId("/board/fsh-adult-open")).toBe("fsh-adult-open");
    });

    it("routes ED subroutes cleanly to the ED ID", () => {
      expect(currentDeskId("/ward-flow/ed/scgh-ed")).toBe("scgh-ed");
    });
  });

  describe("Feature 10: Bed Occupancy Math & Capacity Boundaries", () => {
    const createMockUnit = (overrides?: Partial<Unit>): Unit => {
      return {
        id: "TEST-BND-WARD-1",
        name: "Boundary Ward",
        siteCode: "SCGH",
        beds: 10,
        allocatable: { value: 0, revision: 1, source: "test" },
        empty: { value: 0, revision: 1 },
        allocatableLocked: 0,
        speciallingCapacity: 0,
        isClosed: false,
        closedBeds: [],
        ...overrides,
      } as unknown as Unit;
    };

    it("handles unit where allocatable equals empty", () => {
      const unit = createMockUnit({
        allocatable: { value: 3, revision: 1, source: "test" },
        empty: { value: 3, revision: 1 },
      });
      const { available, held } = boundedBedAvailability(unit);
      expect(available).toBe(3);
      expect(held).toBe(0);
    });

    it("bounds ready availability to minimum of allocatable and empty", () => {
      const unit = createMockUnit({
        allocatable: { value: 5, revision: 1, source: "test" },
        empty: { value: 2, revision: 1 },
      });
      const { available, held } = boundedBedAvailability(unit);
      expect(available).toBe(2);
      expect(held).toBe(0);
    });

    it("reports zero available beds when empty count is zero", () => {
      const unit = createMockUnit({
        allocatable: { value: 4, revision: 1, source: "test" },
        empty: { value: 0, revision: 1 },
      });
      const { available } = boundedBedAvailability(unit);
      expect(available).toBe(0);
    });

    it("correctly filters preparing releases in bedsPendingPreparation", () => {
      const unitId = "TEST-BND-WARD-1";
      const releases: BedRelease[] = [
        { id: "BR-1", unitId, state: "discharged", preparing: true } as BedRelease,
        { id: "BR-2", unitId, state: "discharged", preparing: false } as BedRelease,
      ];
      expect(bedsPendingPreparation(unitId, releases)).toBe(1);
    });

    it("calculates unitCapacity correctly from total beds and empty count", () => {
      const unit = createMockUnit({
        beds: 20,
        empty: { value: 4, revision: 1 },
        allocatable: { value: 4, revision: 1, source: "test" },
      });
      const cap = unitCapacity(unit, []);
      expect(cap.occupied).toBe(16); // 20 - 4
      expect(cap.available).toBe(4);
    });
  });

  describe("Feature 11: 24-Hour Clinical Time & Date Boundaries", () => {
    it("formats 0 minutes as 00:00 midnight", () => {
      expect(formatInstant(0)).toBe("00:00");
    });

    it("formats 1439 minutes as 23:59 end-of-day boundary", () => {
      expect(formatInstant(1439)).toBe("23:59");
    });

    it("formats 1440 minutes cleanly as 00:00 (next day midnight rollover)", () => {
      expect(formatInstant(1440)).toBe("00:00");
    });

    it("formats Australian date of birth for leap year baby (29/02/2004)", () => {
      expect(formatDateOfBirth("2004-02-29")).toBe("29/02/2004");
    });

    it("formats Australian date of birth for turn-of-century baby (01/01/2000)", () => {
      expect(formatDateOfBirth("2000-01-01")).toBe("01/01/2000");
    });

    it("handles negative instants with proper 24-hour wrap-around", () => {
      expect(formatInstant(-60)).toBe("23:00");
    });
  });

  describe("Feature 12: Reducer Event Boundaries & Blocker Handling", () => {
    it("rejects empty or whitespace-only blocker string", () => {
      const state = createIsolatedState();
      const movement = state.movements[0];

      const event: WardFlowEvent = {
        type: "RECORD_MOVEMENT_BLOCKER",
        role: "coordinator",
        now: TEST_NOW,
        movementId: movement.id,
        blocker: "   ",
      };

      const next = wardFlowReducer(state, event);
      expect(next.rejections.length).toBeGreaterThan(0);
      expect(next.rejections.at(-1)?.reason).toContain("a blank is not a statement");
    });

    it("accepts long detailed clinical blocker without truncation", () => {
      const state = createIsolatedState();
      const movement = state.movements[0];
      const detailedBlocker =
        "Patient requires high-flow nasal oxygen (40L/min) and telemetry bed post-overdose. Intensive care liaison nurse review pending.";

      const event: WardFlowEvent = {
        type: "RECORD_MOVEMENT_BLOCKER",
        role: "coordinator",
        now: TEST_NOW,
        movementId: movement.id,
        blocker: detailedBlocker,
      };

      const next = wardFlowReducer(state, event);
      const updated = next.movements.find((m) => m.id === movement.id);
      expect(updated?.blocker).toBe(detailedBlocker);
    });

    it("repeated dispatches of identical scenario are idempotent and return identical reference", () => {
      const state = createIsolatedState();
      const current = state.scenario;

      const event: WardFlowEvent = {
        type: "SET_SCENARIO",
        role: "demo",
        now: TEST_NOW,
        scenario: current,
      };

      const next1 = wardFlowReducer(state, event);
      const next2 = wardFlowReducer(next1, event);
      expect(next1).toBe(state);
      expect(next2).toBe(state);
    });
  });
});
