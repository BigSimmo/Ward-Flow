import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-events";
import {
  EARLIER_HISTORY_NOT_RECORDED_ENTRY,
  EVENT_HISTORY_TABLE,
  buildHistoryEntry,
  selectBedHistory,
  selectPatientHistory,
} from "@/components/ward-management/ward-history";

// The reference instant history times are stated against (day 0, 11:40).
const NOW = 700;

describe("Ward Flow Read-Only Plain History", () => {
  describe("EVENT_HISTORY_TABLE completeness and classification", () => {
    it("classifies all 103 event types into bed, patient, both or neither with plain wording", () => {
      const allEventTypes = Object.keys(EVENT_ROLE) as Array<WardFlowEvent["type"]>;
      // 97 -> 96 on 2026-09-25: OVERRIDE_LEGAL_MISMATCH removed (owner ruling).
      // D-34 adds the explicit ED medical deterioration transition.
      // Stream A (9 Oct 2026) adds inbox ownership, snooze and return.
      // 9 Oct 2026: RECORD_SUPPORT_NOTIFICATION (advisory carer/PSP/MHAS checklist).
      expect(allEventTypes.length).toBe(103);

      for (const eventType of allEventTypes) {
        const config = EVENT_HISTORY_TABLE[eventType];
        expect(config, `Missing config for ${eventType}`).toBeDefined();
        expect(["bed", "patient", "both", "neither"]).toContain(config.category);
        expect(typeof config.plainWording).toBe("string");
        expect(config.plainWording.length).toBeGreaterThan(0);
      }
    });
  });

  it("retains the fixed D-34 audit tag and joins the deterioration to its movement", () => {
    const event: WardFlowEvent = {
      type: "RECORD_ED_MEDICAL_DETERIORATION",
      role: "ed",
      now: NOW,
      movementId: "SYN-D34-MOVEMENT",
      actingPlaceId: "jhc-ed",
    };
    const entry = buildHistoryEntry(event, NOW);
    expect(entry.reason).toBe("Medical Deterioration - ED Resuscitation Required");
    expect(entry.relatedLinks.movementId).toBe(event.movementId);
    expect(EVENT_HISTORY_TABLE[event.type].category).toBe("both");
  });

  describe("selectPatientHistory", () => {
    const mockEvents: WardFlowEvent[] = [
      {
        type: "ADD_PATIENT",
        role: "ed",
        now: 600,
        patient: {
          id: "P-101",
          name: "Synthetic Patient A",
          gender: "Female",
        } as unknown as WardFlowEvent extends { type: "ADD_PATIENT"; patient: infer P } ? P : never,
        patientId: "P-101",
      } as unknown as WardFlowEvent,
      {
        type: "RECORD_EXAMINATION",
        role: "ed",
        now: 630,
        movementId: "MOV-1",
        patientId: "P-101",
        outcome: "inpatient_order",
      } as unknown as WardFlowEvent,
      {
        type: "DECLINE",
        role: "ward",
        now: 645,
        movementId: "MOV-1",
        patientId: "P-101",
        unitId: "U-1",
        declineReason: "No clinical staffing for specialling",
      } as unknown as WardFlowEvent,
      {
        type: "PULL_PATIENT",
        role: "ward",
        now: 660,
        movementId: "MOV-2",
        patientId: "P-202",
        unitId: "U-2",
      } as unknown as WardFlowEvent,
    ];

    it("always begins with 'Earlier history not recorded' boundary line", () => {
      const history = selectPatientHistory(mockEvents, "MOV-1", NOW);
      expect(history.length).toBe(3); // boundary + 2 events on this patient's movement
      expect(history[0]).toEqual(EARLIER_HISTORY_NOT_RECORDED_ENTRY);
      expect(history[0].summary).toBe("Earlier history not recorded");
    });

    it("filters events strictly for the requested patient", () => {
      const history = selectPatientHistory(mockEvents, "MOV-1", NOW);
      const summaries = history.slice(1).map((entry) => entry.summary);

      // D-14: the patient link is never read, so ADD_PATIENT (which carries only the link, no record
      // id) and MOV-2's event do not join this record's history.
      expect(summaries).toEqual(["Psychiatric examination outcome recorded", "Ward declined inpatient request"]);
    });

    it("extracts reason if recorded, or shows 'Not recorded'", () => {
      const history = selectPatientHistory(mockEvents, "MOV-1", NOW);

      // RECORD_EXAMINATION carries outcome
      expect(history[1].reason).toBe("Outcome: inpatient_order");
      // DECLINE carries declineReason
      expect(history[2].reason).toBe("No clinical staffing for specialling");
    });

    it("follows role-not-person rule for who field", () => {
      const history = selectPatientHistory(mockEvents, "MOV-1", NOW);
      expect(history[1].who).toBe("ED mental health");
      expect(history[1].role).toBe("ed");
      expect(history[2].who).toBe("Ward manager");
      expect(history[2].role).toBe("ward");
    });

    it("never joins by, or copies, the patient link (D-14)", () => {
      expect(selectPatientHistory(mockEvents, "P-101", NOW)).toEqual([EARLIER_HISTORY_NOT_RECORDED_ENTRY]);
      for (const entry of selectPatientHistory(mockEvents, "MOV-1", NOW)) {
        expect(Object.keys(entry.relatedLinks)).not.toContain("patientId");
      }
    });

    it("returns only the boundary line when no events match patient", () => {
      const history = selectPatientHistory(mockEvents, "P-999", NOW);
      expect(history).toEqual([EARLIER_HISTORY_NOT_RECORDED_ENTRY]);
    });
  });

  describe("selectBedHistory", () => {
    const mockBedEvents: WardFlowEvent[] = [
      {
        type: "CONFIRM_CAPACITY",
        role: "ward",
        now: 540,
        actingUnitId: "UNIT-7",
        unitId: "UNIT-7",
        value: 12,
        expectedRevision: 1,
      } as unknown as WardFlowEvent,
      {
        type: "FLAG_BED_RELEASE",
        role: "ward",
        now: 570,
        actingUnitId: "UNIT-7",
        unitId: "UNIT-7",
        bedId: "BED-04",
        blocker: "pending_physio",
      } as unknown as WardFlowEvent,
      {
        type: "RELEASE_BED",
        role: "ward",
        now: 620,
        actingUnitId: "UNIT-7",
        unitId: "UNIT-7",
        bedId: "BED-04",
      } as unknown as WardFlowEvent,
      {
        type: "CONFIRM_CAPACITY",
        role: "ward",
        now: 550,
        actingUnitId: "UNIT-8",
        unitId: "UNIT-8",
        value: 8,
        expectedRevision: 1,
      } as unknown as WardFlowEvent,
    ];

    it("always begins with 'Earlier history not recorded' boundary line", () => {
      const history = selectBedHistory(mockBedEvents, "UNIT-7", NOW);
      expect(history[0]).toEqual(EARLIER_HISTORY_NOT_RECORDED_ENTRY);
    });

    it("filters events for the given unit and bed", () => {
      const unitHistory = selectBedHistory(mockBedEvents, "UNIT-7", NOW);
      expect(unitHistory.length).toBe(4); // boundary + 3 events for UNIT-7

      const bedHistory = selectBedHistory(mockBedEvents, "UNIT-7", NOW, "BED-04");
      expect(bedHistory.length).toBe(3); // boundary + 2 events specifically on BED-04
      expect(bedHistory[1].summary).toBe("Upcoming bed release flagged");
      expect(bedHistory[1].reason).toBe("pending_physio");
      expect(bedHistory[2].summary).toBe("Bed freed and returned to unit capacity");
    });

    it("returns only boundary entry if unitId is not found", () => {
      const history = selectBedHistory(mockBedEvents, "UNIT-UNKNOWN", NOW);
      expect(history).toEqual([EARLIER_HISTORY_NOT_RECORDED_ENTRY]);
    });
  });

  describe("buildHistoryEntry missing fields handling", () => {
    it("handles missing role, time, or reason without crashing or backfilling", () => {
      const minimalEvent = {
        type: "ADVANCE_CLOCK",
      } as unknown as WardFlowEvent;

      const entry = buildHistoryEntry(minimalEvent, NOW);
      expect(entry.time).toBe("Not recorded");
      expect(entry.instant).toBe("Not recorded");
      expect(entry.who).toBe("Not recorded");
      expect(entry.role).toBe("Not recorded");
      expect(entry.reason).toBe("Not recorded");
      expect(entry.summary).toBe("Operational demonstration clock advanced");
    });

    it("shows an invalid time as Not recorded, never as a number", () => {
      for (const now of [Number.NaN, Number.POSITIVE_INFINITY]) {
        const entry = buildHistoryEntry(
          {
            type: "ADVANCE_CLOCK",
            role: "coordinator",
            now,
          } as unknown as WardFlowEvent,
          NOW,
        );
        expect(entry.time).toBe("Not recorded");
        expect(entry.instant).toBe("Not recorded");
      }
    });

    it("says which day a time falls on, never a bare clock face", () => {
      const yesterday = buildHistoryEntry(
        { type: "ADVANCE_CLOCK", role: "coordinator", now: NOW - 1440 } as unknown as WardFlowEvent,
        NOW,
      );
      expect(yesterday.time).toBe("11:40 yesterday");
      const today = buildHistoryEntry(
        { type: "ADVANCE_CLOCK", role: "coordinator", now: NOW } as unknown as WardFlowEvent,
        NOW,
      );
      expect(today.time).toBe("11:40");
    });
  });

  describe("classification rule (walkthrough review, 25 Sept 2026)", () => {
    it("classes events the engine records nothing for, or that only log a request, as neither", () => {
      for (const type of [
        "RECORD_PATIENT_DISCHARGE",
        "OPEN_DISCHARGE_RECORD",
        "REQUEST_CAPACITY_REFRESH",
        "SEND_WARD_BUZZ",
      ] as const) {
        expect(EVENT_HISTORY_TABLE[type].category, type).toBe("neither");
      }
    });

    it("classes holding, occupying or freeing a bed for a named patient as both, in both histories", () => {
      for (const type of [
        "PULL_PATIENT",
        "PATIENT_ARRIVED",
        "RECORD_LEAVING",
        "RELEASE_PULL",
        "RELEASE_AND_REOPEN_SEARCH",
        "RELEASE_HELD_BED",
        "RELEASE_DIVERTED_BED",
      ] as const) {
        expect(EVENT_HISTORY_TABLE[type].category, type).toBe("both");
      }
      const pull = {
        type: "PULL_PATIENT",
        role: "ward",
        now: 100,
        movementId: "WF-1",
        actingUnitId: "unit-a",
      } as unknown as WardFlowEvent;
      expect(selectPatientHistory([pull], "WF-1", NOW)).toHaveLength(2);
      expect(selectBedHistory([pull], "unit-a", NOW)).toHaveLength(2);
    });
  });
});
