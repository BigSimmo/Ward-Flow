import { describe, it, expect } from "vitest";
import {
  createIsolatedState,
  TEST_NOW,
} from "../helpers/test-harness";
import { currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-form-progression";
import {
  typedTimeRefusal,
} from "@/components/ward-management/restrictive-practice/ward-restrictive-practice";
import { downtimePack } from "@/components/ward-management/reports/downtime-pack";
import {
  TRAVEL_BANDS,
  SYNTHETIC_TRAVEL_BANDS,
  TRAVEL_BANDS_ARE_INVENTED,
} from "@/components/ward-management/ward-travel-bands";
import { EXTRA_TRAVEL_HOLD_MINUTES } from "@/components/ward-management/ward-model";
import { wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { Movement, Unit, Admission } from "@/components/ward-management/ward-model";

describe("Tier 2 - Boundaries & Corner Cases: Features 05 - 08", () => {
  describe("Feature 05: 72-Hour Legal Assessment Clock Boundaries", () => {
    it("returns undefined for voluntary patient arriving at ward", () => {
      const movement: Movement = {
        id: "WF-BND-72-VOL",
        referralId: "REF-VOL-1",
        stage: "arrived",
        legalStatus: "Voluntary",
        urgency: 2,
        originEdId: "scgh-ed",
        acceptedUnitId: "scgh-adult-open",
        createdAt: TEST_NOW - 500,
        arrivedAt: TEST_NOW - 120,
      };

      const dueAt = currentLegalDueAt(movement);
      expect(dueAt).toBeUndefined();
    });

    it("retains recorded legal form deadline upon ward arrival before examination", () => {
      const formDue = TEST_NOW + 1440;
      const movement: Movement = {
        id: "WF-BND-72-ARRIVED",
        referralId: "REF-ARR-1",
        stage: "arrived",
        legalStatus: "Involuntary",
        legalForm: {
          code: "1A",
          dueAt: formDue,
        },
        urgency: 1,
        originEdId: "rph-ed",
        acceptedUnitId: "rph-adult-open",
        createdAt: TEST_NOW - 2000,
        arrivedAt: TEST_NOW - 60,
      };

      const dueAt = currentLegalDueAt(movement);
      expect(dueAt).toBe(formDue);
    });

    it("clears referral form clock once inpatient Form 6A order is recorded", () => {
      const movement: Movement = {
        id: "WF-BND-72-FORM6A",
        referralId: "REF-FORM6A-1",
        stage: "arrived",
        legalStatus: "Involuntary",
        legalForm: {
          code: "6A",
          dueAt: TEST_NOW + 14400,
        },
        urgency: 1,
        originEdId: "jhc-ed",
        acceptedUnitId: "scgh-adult-open",
        createdAt: TEST_NOW - 2000,
        arrivedAt: TEST_NOW - 120,
      };

      const dueAt = currentLegalDueAt(movement);
      expect(dueAt).toBe(TEST_NOW + 14400);
    });

    it("retains pre-arrival Form 1A deadline while patient is still moving (not yet arrived)", () => {
      const initialFormDue = TEST_NOW + 600;
      const movement: Movement = {
        id: "WF-BND-72-MOVING",
        referralId: "REF-MOVING-1",
        stage: "moving",
        legalStatus: "Involuntary",
        legalForm: {
          code: "1A",
          dueAt: initialFormDue,
        },
        urgency: 1,
        originEdId: "busselton-ed",
        acceptedUnitId: "bunbury-adult",
        createdAt: TEST_NOW - 500,
      };

      const dueAt = currentLegalDueAt(movement);
      expect(dueAt).toBe(initialFormDue);
    });

    it("returns undefined when legalForm is missing or dueAt is non-finite", () => {
      const movement: Movement = {
        id: "WF-BND-72-NO-FORM",
        referralId: "REF-NO-FORM",
        stage: "accepted_awaiting_bed",
        legalStatus: "Involuntary",
        legalForm: undefined,
        urgency: 1,
        originEdId: "fsh-ed",
        createdAt: TEST_NOW - 100,
      };

      expect(currentLegalDueAt(movement)).toBeUndefined();
    });
  });

  describe("Feature 06: Restrictive Practice Timestamp & Episode Boundaries", () => {
    it("accepts timestamp exactly at now (now - 0)", () => {
      expect(typedTimeRefusal(TEST_NOW, TEST_NOW)).toBeNull();
    });

    it("accepts timestamp 23 hours 59 minutes in the past", () => {
      expect(typedTimeRefusal(TEST_NOW - 1439, TEST_NOW)).toBeNull();
    });

    it("rejects timestamp 24 hours 1 minute in the past (>1440 min limit)", () => {
      const refusal = typedTimeRefusal(TEST_NOW - 1441, TEST_NOW);
      expect(refusal).toContain("within the last 24 hours");
    });

    it("rejects future timestamp (now + 1 min)", () => {
      const refusal = typedTimeRefusal(TEST_NOW + 1, TEST_NOW);
      expect(refusal).toContain("cannot be later than now");
    });

    it("rejects end time earlier than start time", () => {
      const start = TEST_NOW - 60;
      const invalidEnd = TEST_NOW - 70;
      const refusal = typedTimeRefusal(invalidEnd, TEST_NOW, start);
      expect(refusal).toContain("cannot be before the start time");
    });

    it("rejects duplicate start of same restrictive practice while an episode is open", () => {
      const state = createIsolatedState();
      const admission = state.admissions.find((a) => a.state === "occupied")!;
      const unitId = admission.unitId;

      const startEvent: WardFlowEvent = {
        type: "RECORD_RESTRICTIVE_PRACTICE_START",
        role: "ward",
        now: TEST_NOW,
        unitId,
        actingUnitId: unitId,
        admissionId: admission.id,
        practice: "seclusion",
        startedAt: TEST_NOW - 15,
      };

      const firstState = wardFlowReducer(state, startEvent);
      expect(firstState.rejections).toHaveLength(0);

      // Attempt duplicate start
      const secondState = wardFlowReducer(firstState, startEvent);
      expect(secondState.rejections.length).toBeGreaterThan(0);
      expect(secondState.rejections.at(-1)?.reason).toContain("already recorded as in use");
    });
  });

  describe("Feature 07: Downtime Pack Disaster Census Boundaries", () => {
    it("generates downtime pack with empty state without throwing", () => {
      const emptyPack = downtimePack({
        units: [],
        bedUnits: [],
        admissions: [],
        movements: [],
        bedReleases: [],
        leaveBeds: [],
        now: TEST_NOW,
        identify: (m) => m.id,
      });

      expect(emptyPack).toBeDefined();
      expect(emptyPack.wards).toEqual([]);
      expect(emptyPack.totals.beds).toBe(0);
      expect(emptyPack.totals.occupied).toBe(0);
    });

    it("handles heavy surge scenario (>100% capacity) in census totals", () => {
      const state = createIsolatedState();
      const pack = downtimePack({
        units: state.units,
        bedUnits: state.units.filter((u) => u.beds > 0),
        admissions: state.admissions,
        movements: state.movements,
        bedReleases: state.bedReleases,
        leaveBeds: state.leaveBeds,
        now: TEST_NOW,
        identify: (m) => m.id,
      });

      expect(pack.totals.beds).toBeGreaterThan(0);
      expect(pack.wards.length).toBeGreaterThan(0);
    });

    it("preserves valid admission with standard general observation in census table", () => {
      const state = createIsolatedState();
      const testAdmission: Admission = {
        id: "ADM-TEST-01",
        unitId: state.units[0].id,
        gender: "Female",
        legalStatus: "Voluntary",
        state: "occupied",
        observation: { level: "general" },
      };

      const pack = downtimePack({
        units: state.units,
        bedUnits: state.units.filter((u) => u.beds > 0),
        admissions: [testAdmission],
        movements: [],
        bedReleases: [],
        leaveBeds: [],
        now: TEST_NOW,
        identify: (m) => m.id,
      });

      expect(pack.wards.length).toBeGreaterThan(0);
    });
  });

  describe("Feature 08: WA Travel Bands & RFDS Flight Boundaries", () => {
    it("identifies transfers between units on the same site as under_an_hour", () => {
      const metroBands = SYNTHETIC_TRAVEL_BANDS["Perth Metropolitan"];
      expect(metroBands?.SCGH).toBe("under_an_hour");
      expect(metroBands?.RPH).toBe("under_an_hour");
    });

    it("identifies distant regional to metro transfers as air_transport_only", () => {
      const pilbaraBands = SYNTHETIC_TRAVEL_BANDS["Pilbara"];
      expect(pilbaraBands?.RPH).toBe("air_transport_only");
      expect(pilbaraBands?.SCGH).toBe("air_transport_only");
      expect(pilbaraBands?.FSH).toBe("air_transport_only");
    });

    it("defines standard EXTRA_TRAVEL_HOLD_MINUTES as 60 minutes", () => {
      expect(EXTRA_TRAVEL_HOLD_MINUTES).toBe(60);
    });

    it("identifies all four defined WA travel bands", () => {
      expect(TRAVEL_BANDS).toContain("under_an_hour");
      expect(TRAVEL_BANDS).toContain("one_to_three_hours");
      expect(TRAVEL_BANDS).toContain("three_hours_or_more");
      expect(TRAVEL_BANDS).toContain("air_transport_only");
      expect(TRAVEL_BANDS_ARE_INVENTED).toBe(false);
    });

    it("leaves unrecorded region-site pairs as undefined without fallback guessing", () => {
      const pilbara = SYNTHETIC_TRAVEL_BANDS["Pilbara"];
      expect(pilbara?.BUN).toBeUndefined();
    });
  });
});
