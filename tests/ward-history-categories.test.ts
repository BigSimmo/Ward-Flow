import { describe, expect, it } from "vitest";
import { classifyAuditEvent } from "@/components/ward-management/ward-audit";
import {
  AUDIT_CATEGORY,
  HISTORY_EXCLUSIONS,
  NEW_HISTORY_CATEGORIES,
  NEW_HISTORY_CATEGORY_LABELS,
  REFINED_HISTORY_EVENT_TYPES,
  historyCategoryForType,
  historyWritesOutcome,
  isHistoryExclusion,
  isReviewableCategory,
} from "@/components/ward-management/ward-audit-categories";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";

type EventType = WardFlowEvent["type"];
const EVENT_TYPES = Object.keys(EVENT_ROLE) as EventType[];

/** The smallest event `classifyAuditEvent` can read: no override, no legal form. */
const bare = (type: EventType) => ({ type, role: "coordinator" }) as unknown as WardFlowEvent;

describe("History category table (D-222, item 10)", () => {
  it("classifies or excludes every event type, and names no type the engine does not know", () => {
    expect(EVENT_TYPES.length).toBeGreaterThan(200);
    expect(Object.keys(AUDIT_CATEGORY).sort()).toEqual([...EVENT_TYPES].sort());
    for (const type of EVENT_TYPES) {
      const row = AUDIT_CATEGORY[type];
      if (isHistoryExclusion(row)) {
        expect(row.reason.trim().length, type).toBeGreaterThan(10);
        expect(historyCategoryForType(type), type).toBeNull();
      } else {
        expect(typeof row, type).toBe("string");
        expect(historyCategoryForType(type), type).toBe(row);
      }
    }
  });

  it("excludes exactly the five approved types, each with a reason", () => {
    const excluded = EVENT_TYPES.filter((type) => isHistoryExclusion(AUDIT_CATEGORY[type])).sort();
    expect(excluded).toEqual(
      ["ADVANCE_CLOCK", "MARK_NOTICE_READ", "MARK_REFERRAL_OPENED", "RESET_SCENARIO", "SET_SCENARIO"].sort(),
    );
    expect(Object.keys(HISTORY_EXCLUSIONS).sort()).toEqual(excluded);
    // The three demonstration controls are exactly the demo-only events.
    const demoOnly = EVENT_TYPES.filter((type) => EVENT_ROLE[type].every((role) => role === "demo")).sort();
    expect(demoOnly).toEqual(["ADVANCE_CLOCK", "RESET_SCENARIO", "SET_SCENARIO"]);
  });

  it("agrees with today's classifier on every type it already writes", () => {
    let writtenToday = 0;
    for (const type of EVENT_TYPES) {
      const today = classifyAuditEvent(bare(type));
      if (today === null) continue;
      writtenToday += 1;
      expect(AUDIT_CATEGORY[type], type).toBe(today);
    }
    // 56 types write today; three of them (the accepts and the pull) only with an override, and the
    // raise only with a legal form, so a bare event reaches 52 of them.
    expect(writtenToday).toBe(52);
  });

  it("keeps the four refined events refined, with the table as their plain fallback", () => {
    for (const type of REFINED_HISTORY_EVENT_TYPES) expect(classifyAuditEvent(bare(type)), type).toBeNull();
    expect(classifyAuditEvent({ ...bare("PULL_PATIENT"), overrideReason: "x" } as unknown as WardFlowEvent)).toBe(
      "override",
    );
    expect(AUDIT_CATEGORY.PULL_PATIENT).toBe("pulled-bed");
    expect(AUDIT_CATEGORY.ACCEPT_IN_PRINCIPLE).toBe("referral-answer");
    expect(AUDIT_CATEGORY.ACCEPT_REFERRAL).toBe("referral-answer");
    expect(AUDIT_CATEGORY.RAISE_REFERRAL).toBe("referral");
  });

  it("puts the findings' saves in the new categories", () => {
    // A2-4: the original step now writes, not only its Undo.
    for (const type of ["DISPATCH_BROADCAST_ALERT", "EXTEND_BROADCAST_ALERT", "STAND_DOWN_BROADCAST_ALERT"] as const)
      expect(AUDIT_CATEGORY[type]).toBe("bed-call");
    expect(AUDIT_CATEGORY.RELEASE_PULL).toBe("pulled-bed");
    // R5-3: the five community team saves.
    for (const type of [
      "RECORD_COMMUNITY_TREATMENT_ORDER",
      "END_COMMUNITY_TREATMENT_ORDER",
      "RECORD_TRIBUNAL_HEARING",
      "RECORD_TRIBUNAL_OUTCOME",
      "RECORD_CARE_PLAN",
    ] as const)
      expect(AUDIT_CATEGORY[type]).toBe("care-record");
    // RV2-8 and AC1-6: ward page steps.
    expect(AUDIT_CATEGORY.SET_INTAKE_WINDOW).toBe("beds-and-wards");
    expect(AUDIT_CATEGORY.SET_BED_CLOSED).toBe("beds-and-wards");
    expect(AUDIT_CATEGORY.MARK_WARD_READY_FOR_NEXT).toBe("beds-and-wards");
    // LG-6: the legal form receipt from the ED board.
    expect(AUDIT_CATEGORY.RECORD_LEGAL_FORM_RECEIVED).toBe("legal-form");
  });

  it("uses every new category, each with a plain label", () => {
    const used = new Set(Object.values(AUDIT_CATEGORY).filter((row) => typeof row === "string"));
    for (const category of NEW_HISTORY_CATEGORIES) {
      expect(used.has(category), category).toBe(true);
      expect(NEW_HISTORY_CATEGORY_LABELS[category]).toMatch(/^[A-Z][a-z ]+$/);
    }
    expect(NEW_HISTORY_CATEGORY_LABELS).toEqual({
      "bed-call": "Bed call",
      "pulled-bed": "Pulled bed",
      "care-record": "Care record",
      journey: "Journey step",
      "beds-and-wards": "Beds and wards",
      handover: "Handover",
    });
  });

  it("keeps the new categories off the Review list and records their accepted saves only", () => {
    for (const category of NEW_HISTORY_CATEGORIES) {
      expect(isReviewableCategory(category), category).toBe(false);
      expect(historyWritesOutcome(category, "accepted")).toBe(true);
      for (const outcome of ["denied", "stale", "partial"] as const)
        expect(historyWritesOutcome(category, outcome)).toBe(false);
    }
    expect(isReviewableCategory("review")).toBe(false);
    for (const category of ["override", "referral", "legal-form", "discharge", "undo", "arrival"] as const) {
      expect(isReviewableCategory(category), category).toBe(true);
      expect(historyWritesOutcome(category, "denied"), category).toBe(true);
    }
  });

  it("reads an unknown or retired type as no line, never a throw", () => {
    expect(historyCategoryForType("RELEASE_BED")).toBeNull();
    expect(historyCategoryForType("toString")).toBeNull();
    expect(historyCategoryForType("")).toBeNull();
  });
});
