import { describe, expect, it } from "vitest";
import { AUDIT_CATEGORY, isHistoryExclusion } from "@/components/ward-management/ward-audit-categories";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import {
  historyActorLabel,
  historyLineWording,
  type HistoryActorInput,
  type HistoryLineDetails,
  type HistoryPlaceNames,
} from "@/components/ward-management/ward-history-lines";

type EventType = WardFlowEvent["type"];

// Synthetic place names, injected; no record or person is real.
const places: HistoryPlaceNames = {
  unit: (id) => ({ "unit-moodjar": "Moodjar", "unit-karri": "Karri" })[id],
  ed: (id) => ({ "ed-south": "South Coast ED" })[id],
  team: (id) => ({ "team-bentley": "Bentley", Bentley: "Bentley" })[id],
  site: (code) => ({ SCH: "South Coast Hospital" })[code],
};

describe("History line wording (D-222)", () => {
  it("gives every classified type a plain line with no type name or underscore", () => {
    for (const type of Object.keys(EVENT_ROLE) as EventType[]) {
      if (isHistoryExclusion(AUDIT_CATEGORY[type])) continue;
      const line = historyLineWording(type);
      expect(line.length, type).toBeGreaterThan(3);
      expect(line, type).not.toMatch(/[A-Z]{2,}_|_/);
    }
  });

  it("words the bed call steps (A2-4)", () => {
    const call = { alertKind: "bed_call" } as const;
    expect(
      historyLineWording("DISPATCH_BROADCAST_ALERT", { ...call, desksAsked: 6, durationMinutes: 240 }, places),
    ).toBe("Bed call sent to 6 wards for 4 h");
    expect(
      historyLineWording(
        "DISPATCH_BROADCAST_ALERT",
        { alertKind: "directive", desksAsked: 1, durationMinutes: 90 },
        places,
      ),
    ).toBe("Broadcast sent to 1 desk for 90 min");
    expect(historyLineWording("EXTEND_BROADCAST_ALERT", { ...call, minutesAdded: 30 }, places)).toBe(
      "Bed call extended by 30 min",
    );
    expect(historyLineWording("STAND_DOWN_BROADCAST_ALERT", call, places)).toBe("Bed call stood down");
    expect(historyLineWording("ADD_BROADCAST_ALERT_UNITS", { ...call, desksAsked: 2 }, places)).toBe(
      "2 more wards asked on the bed call",
    );
    expect(
      historyLineWording(
        "REPLY_BROADCAST_ALERT",
        { ...call, unitId: "unit-moodjar", answer: "can_take", beds: 2 },
        places,
      ),
    ).toBe("Moodjar answered the bed call: Can take, 2 beds");
    expect(
      historyLineWording("ACKNOWLEDGE_BROADCAST_ALERT", { alertKind: "directive", unitId: "unit-karri" }, places),
    ).toBe("Broadcast acknowledged by Karri");
    expect(historyLineWording("RAISE_PULL_NOW", { alertKind: "pull_now", unitId: "unit-karri" }, places)).toBe(
      "Pull now asked of Karri",
    );
    expect(historyLineWording("REQUEST_CAPACITY_REFRESH", { alertKind: null, unitId: "unit-karri" }, places)).toBe(
      "Karri asked to update its bed numbers",
    );
    expect(historyLineWording("SEND_WARD_BUZZ", { alertKind: null, unitId: "unit-moodjar" }, places)).toBe(
      "Moodjar buzzed for a bed update",
    );
  });

  it("words the pulled bed steps (A2-4)", () => {
    expect(historyLineWording("PULL_PATIENT", { unitId: "unit-moodjar", reason: null }, places)).toBe(
      "Bed pulled on Moodjar",
    );
    expect(
      historyLineWording("RELEASE_PULL", { unitId: "unit-moodjar", reason: "bed_needed_for_another_patient" }, places),
    ).toBe("Pulled bed released on Moodjar: bed needed elsewhere");
    expect(historyLineWording("RELEASE_HELD_BED", { unitId: null, reason: null }, places)).toBe(
      "Pulled bed released after transport stopped",
    );
    expect(historyLineWording("RELEASE_DIVERTED_BED")).toBe("Pulled bed released after the move was diverted");
    expect(historyLineWording("RELEASE_AND_REOPEN_SEARCH")).toBe("Pulled bed released and bed search reopened");
    expect(historyLineWording("EXTEND_PULL", { unitId: null, reason: null, hoursAdded: 2 }, places)).toBe(
      "Pulled bed hold extended by 2 h",
    );
  });

  it("words the care record steps (R5-3)", () => {
    expect(historyLineWording("RECORD_COMMUNITY_TREATMENT_ORDER")).toBe("Community treatment order recorded");
    expect(historyLineWording("END_COMMUNITY_TREATMENT_ORDER")).toBe("Community treatment order ended");
    expect(historyLineWording("RECORD_TRIBUNAL_HEARING")).toBe("Tribunal hearing date recorded");
    expect(historyLineWording("RECORD_TRIBUNAL_OUTCOME", { outcome: "Adjourned" })).toBe(
      "Tribunal outcome recorded: Adjourned",
    );
    expect(historyLineWording("RECORD_CARE_PLAN")).toBe("Care plan added");
    expect(historyLineWording("RECORD_FOLLOW_UP_REPLY")).toBe("Follow-up reply recorded");
  });

  it("never carries typed text or values outside the closed lists into a line", () => {
    const typed = "SYNTHETIC-TYPED-TEXT";
    const smuggled = {
      alertKind: "bed_call",
      answer: typed,
      reason: typed,
      outcome: typed,
      unitId: typed,
      title: typed,
      message: typed,
      desksAsked: Number.NaN,
      durationMinutes: -5,
      minutesAdded: 1.5,
      beds: typed,
    } as unknown as HistoryLineDetails;
    for (const type of Object.keys(EVENT_ROLE) as EventType[]) {
      const line = historyLineWording(type, smuggled, { unit: (id) => (id === typed ? null : "Moodjar") });
      expect(line, type).not.toContain(typed);
      expect(line, type).not.toMatch(/NaN|-5|1\.5|undefined|null/);
    }
    // A reason from another closed list is not a release reason.
    expect(historyLineWording("RELEASE_PULL", { unitId: null, reason: "provider_unavailable" } as never)).toBe(
      "Pulled bed released",
    );
  });
});

describe("History desk wording (D-222 choice 3)", () => {
  const desk = (actor: Partial<HistoryActorInput>): HistoryActorInput => ({
    role: "coordinator",
    actingUnitId: null,
    attribution: "desk-session",
    ...actor,
  });

  it("names a coordinator acting on a ward's or an ED's step as 'Bed coordinator, for <place>'", () => {
    expect(historyActorLabel(desk({ actingUnitId: "unit-moodjar" }), places)).toBe("Bed coordinator, for Moodjar");
    expect(historyActorLabel(desk({ actingEdId: "ed-south" }), places)).toBe("Bed coordinator, for South Coast ED");
    expect(historyActorLabel(desk({}), places)).toBe("Bed coordinator");
    expect(historyActorLabel(desk({ actingUnitId: "unit-unknown" }), places)).toBe("Bed coordinator");
    expect(
      historyActorLabel(
        desk({ scope: { kind: "service", service: "North Metro" }, actingUnitId: "unit-karri" }),
        places,
      ),
    ).toBe("North Metro bed coordinator, for Karri");
  });

  it("names a coordinator on a step-role event by the role the step was recorded as", () => {
    expect(historyActorLabel(desk({ asRole: "officer", actingUnitId: "unit-moodjar" }), places)).toBe(
      "Bed coordinator, as transport officer",
    );
  });

  it("names each desk by its role and place", () => {
    expect(
      historyActorLabel(
        desk({ role: "ward", actingUnitId: "unit-moodjar", scope: { kind: "ward", unitIds: ["unit-moodjar"] } }),
        places,
      ),
    ).toBe("Moodjar nurse in charge");
    expect(historyActorLabel(desk({ role: "ed", scope: { kind: "ed", edId: "ed-south" } }), places)).toBe(
      "South Coast ED clinician",
    );
    expect(historyActorLabel(desk({ role: "community", scope: { kind: "team", teamName: "Bentley" } }), places)).toBe(
      "Bentley community team",
    );
    expect(historyActorLabel(desk({ role: "bed_manager", scope: { kind: "site", siteCode: "SCH" } }), places)).toBe(
      "South Coast Hospital site bed manager",
    );
    expect(historyActorLabel(desk({ role: "officer", scope: { kind: "jobs" } }), places)).toBe("Transport officer");
    expect(historyActorLabel(desk({ role: "ward" }), {})).toBe("Nurse in charge");
  });

  it("adds the signed-in account after the desk, only when it is a valid short name", () => {
    const team = desk({ role: "community", scope: { kind: "team", teamName: "Bentley" } });
    expect(historyActorLabel({ ...team, account: "L. Hart" }, places)).toBe("Bentley community team, L. Hart");
    expect(historyActorLabel({ ...team, account: "<script>" }, places)).toBe("Bentley community team");
    expect(historyActorLabel({ ...team, account: "x".repeat(41) }, places)).toBe("Bentley community team");
    // A row the screen stamped (no session desk) never shows an account.
    expect(historyActorLabel({ ...team, attribution: "declared-prototype-role", account: "L. Hart" }, places)).toBe(
      "Community team",
    );
  });

  it("reads a stored row with no desk stamp as the role label only, as today", () => {
    expect(
      historyActorLabel({ role: "ward", actingUnitId: "unit-moodjar", attribution: "declared-prototype-role" }, places),
    ).toBe("Nurse in charge");
    expect(
      historyActorLabel(
        { role: "coordinator", actingUnitId: "unit-moodjar", attribution: "declared-prototype-role" },
        places,
      ),
    ).toBe("Bed coordinator");
    expect(historyActorLabel({ role: null, actingUnitId: null, attribution: "declared-prototype-role" })).toBe(
      "Not recorded",
    );
  });

  it("reads an automatic line as 'Raised automatically'", () => {
    expect(historyActorLabel({ role: null, actingUnitId: null, attribution: "system" })).toBe("Raised automatically");
  });
});
