import { describe, expect, it } from "vitest";

import {
  CHRONOLOGY_CSV_HEADER,
  chronologyCsv,
  patientChronology,
  patientRecordIds,
  reasonLabel,
  type ChronologyInput,
} from "@/components/ward-management/reports/patient-chronology";
import { OVERRIDE_REASONS } from "@/components/ward-management/ward-change-reasons";
import { eventLogEntryFor } from "@/components/ward-management/ward-event-log";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const DAY_ZERO = new Date(2026, 9, 7);
// Seeded: PT-013 owns movement WF-014 (Form 4A) and nothing else.
const PERSON = "PT-013";
const MOVEMENT = "WF-014";

function inputFor(state: WardFlowState, extra: Partial<ChronologyInput> = {}): ChronologyInput {
  return {
    personId: PERSON,
    patients: state.patients,
    movements: state.movements,
    referrals: state.referrals,
    admissions: state.admissions,
    units: state.units,
    auditEvents: state.auditEvents,
    eventLog: [],
    dayZero: DAY_ZERO,
    ...extra,
  };
}

function withHistory(state: WardFlowState): WardFlowState {
  const unitId = state.units[0]!.id;
  return {
    ...state,
    movements: state.movements.map((movement) =>
      movement.id === MOVEMENT
        ? {
            ...movement,
            overrides: [{ at: NOW_ANCHOR - 30, by: "coordinator", reason: OVERRIDE_REASONS[1], unitIds: [unitId] }],
            declines: [{ unitId, at: NOW_ANCHOR - 90, reason: "no_bed" as const }],
          }
        : movement,
    ),
  };
}

describe("PIR chronology: one person's records", () => {
  it("joins a person only to their own records, through the resolver", () => {
    const state = seedWardFlowState();
    expect(patientRecordIds(PERSON, state.patients, state.movements, state.referrals, state.admissions)).toEqual({
      movements: [MOVEMENT],
      referrals: [],
      admissions: [],
    });
    const chronology = patientChronology(inputFor(state));
    expect(chronology.patient?.id).toBe(PERSON);
    expect(chronology.rows.length).toBeGreaterThan(0);
    expect(new Set(chronology.rows.map((row) => row.record))).toEqual(new Set(["Movement"]));
    // No record id is shown: patients are named only through the resolver helpers.
    expect(chronology.rows.some((row) => Object.values(row).some((value) => String(value).includes(MOVEMENT)))).toBe(
      false,
    );
  });

  it("reads the record history, with override reasons, in time order", () => {
    const chronology = patientChronology(inputFor(withHistory(seedWardFlowState())));
    const actions = chronology.rows.map((row) => row.action);
    expect(actions[0]).toBe("Placement request opened");
    const override = chronology.rows.find((row) => row.action === "Placement override");
    expect(override).toMatchObject({ reason: OVERRIDE_REASONS[1], who: "Flow coordinator", source: "Record" });
    const decline = chronology.rows.find((row) => row.action === "Ward declined");
    expect(decline?.reason).toBe(reasonLabel("no_bed"));
    // Sorted by occurrence: the decline (90 minutes ago) comes before the override (30 minutes ago).
    expect(actions.indexOf("Ward declined")).toBeLessThan(actions.indexOf("Placement override"));
    const times = chronology.rows.map((row) => row.occurredAt ?? row.recordedAt ?? Infinity);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("keeps a typed legal-form time as occurred, with no recorded time claimed", () => {
    const state = seedWardFlowState();
    const formed = state.movements.find((movement) => movement.id === MOVEMENT)?.formedAt;
    const chronology = patientChronology(inputFor(state));
    const row = chronology.rows.find((candidate) => candidate.action === "Legal form made (typed time)");
    if (formed === undefined) {
      expect(row).toBeUndefined();
    } else {
      expect(row).toMatchObject({ occurredAt: formed, recordedAt: null });
    }
  });

  it("adds audit before and after state, and does not repeat an accepted session act", () => {
    const seed = seedWardFlowState();
    const movement = seed.movements.find((candidate) => candidate.id === MOVEMENT)!;
    const event: WardFlowEvent = {
      type: "CHANGE_LEGAL_STATUS",
      role: "coordinator",
      now: NOW_ANCHOR + 5,
      movementId: MOVEMENT,
      legalStatus: movement.legalStatus === "Voluntary" ? "Involuntary inpatient" : "Voluntary",
      reason: "recorded_by_treating_team",
    };
    const after = wardFlowReducer(seed, event);
    const log = [eventLogEntryFor(event, after !== seed)];
    const chronology = patientChronology(inputFor(after, { eventLog: log }));

    const audit = chronology.rows.filter((row) => row.source === "Audit");
    expect(audit.length).toBeGreaterThan(0);
    expect(audit[0]).toMatchObject({ before: movement.legalStatus, after: event.legalStatus, who: "Flow coordinator" });
    const record = chronology.rows.find((row) => row.source === "Record" && row.action === "Legal status changed");
    expect(record).toMatchObject({ before: movement.legalStatus, after: event.legalStatus });
    expect(chronology.rows.filter((row) => row.source === "Session log")).toEqual([]);
  });

  it("shows a refused session act, and drops the audit trail when the reader may not see it", () => {
    const state = seedWardFlowState();
    const refused: WardFlowEvent = {
      type: "CHANGE_LEGAL_STATUS",
      role: "officer",
      now: NOW_ANCHOR + 7,
      movementId: MOVEMENT,
      legalStatus: "Voluntary",
      reason: "correcting_an_error",
    };
    const chronology = patientChronology(
      inputFor(state, { auditEvents: null, eventLog: [eventLogEntryFor(refused, false)] }),
    );
    expect(chronology.auditIncluded).toBe(false);
    const row = chronology.rows.find((candidate) => candidate.source === "Session log");
    expect(row?.action).toMatch(/\(refused\)$/u);
    expect(row?.recordedAt).toBe(NOW_ANCHOR + 7);
  });

  it("never lists another person's records, even from the session log", () => {
    const state = seedWardFlowState();
    const other = state.movements.find((movement) => movement.id !== MOVEMENT)!;
    const foreign: WardFlowEvent = {
      type: "CHANGE_LEGAL_STATUS",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: other.id,
      legalStatus: "Voluntary",
      reason: "correcting_an_error",
    };
    const chronology = patientChronology(inputFor(state, { eventLog: [eventLogEntryFor(foreign, true)] }));
    expect(chronology.rows).toEqual(patientChronology(inputFor(state)).rows);
  });

  it("returns no rows for a person with no records", () => {
    const state = seedWardFlowState();
    const chronology = patientChronology(inputFor(state, { personId: "PT-does-not-exist" }));
    expect(chronology.patient).toBeUndefined();
    expect(chronology.rows).toEqual([]);
  });
});

describe("PIR chronology CSV", () => {
  it("labels itself synthetic, carries every row and quotes formula-like text", () => {
    const state = withHistory(seedWardFlowState());
    const chronology = patientChronology(inputFor(state));
    const rows = [...chronology.rows, { ...chronology.rows[0]!, key: "x", action: "=HYPERLINK(1)" }];
    const csv = chronologyCsv(rows, DAY_ZERO, NOW_ANCHOR);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[0]).toMatch(/^"Synthetic demo data\. Not a clinical record\."/u);
    expect(lines[1]).toBe(CHRONOLOGY_CSV_HEADER.map((cell) => `"${cell}"`).join(","));
    expect(lines).toHaveLength(rows.length + 2);
    expect(csv).toContain(`"'=HYPERLINK(1)"`);
    expect(csv).toContain(OVERRIDE_REASONS[1]);
  });
});
