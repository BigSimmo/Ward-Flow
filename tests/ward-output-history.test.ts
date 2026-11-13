import { captureAuditEvent } from "@/components/ward-management/ward-audit";
import { describe, expect, it } from "vitest";
import { patientChronology, type ChronologyInput } from "@/components/ward-management/reports/patient-chronology";
import { eventLogEntryFor } from "@/components/ward-management/ward-event-log";
import { observationEditingToken } from "@/components/ward-management/ward-flow-observation-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { GENERAL_OBSERVATION, observationAt } from "@/components/ward-management/ward-observation";
import { emptyCareJourney, separationHandoff } from "@/components/ward-management/ward-care-journey";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const dayZero = new Date("2026-11-03T16:00:00.000Z");
function fixture() {
  const seed = seedWardFlowState();
  const movement = {
    ...seed.movements.find((row) => row.id === "WF-014")!,
    observation: GENERAL_OBSERVATION,
    observationChanges: [],
    admissionId: "output-history-stay",
    closure: undefined,
  };
  const admission = {
    ...seed.admissions[0]!,
    id: "output-history-stay",
    state: "occupied" as const,
    movementId: movement.id,
    patientId: "PT-013" as const,
    observation: GENERAL_OBSERVATION,
    observationChanges: [],
  };
  const state: WardFlowState = { ...seed, movements: [movement], admissions: [admission], auditEvents: [] };
  const input = (next: WardFlowState, extra: Partial<ChronologyInput> = {}): ChronologyInput => ({
    personId: "PT-013",
    patients: next.patients,
    movements: next.movements,
    admissions: next.admissions,
    referrals: next.referrals,
    units: next.units,
    auditEvents: next.auditEvents,
    eventLog: [],
    dayZero,
    ...extra,
  });
  const change: WardFlowEvent = {
    type: "RECORD_OBSERVATION_LEVEL",
    role: "coordinator",
    now: NOW_ANCHOR + 1,
    target: { kind: "movement", movementId: movement.id },
    observation: observationAt("within_sight", NOW_ANCHOR + 50),
  };
  return { state, input, change, admission, movement };
}

describe("output audit: observation chronology", () => {
  it("captures a refused malformed target without throwing or copying a payload", () => {
    const f = fixture();
    const event = { ...f.change, target: undefined } as unknown as WardFlowEvent;
    expect(eventLogEntryFor(event, false)).toMatchObject({ type: "RECORD_OBSERVATION_LEVEL", accepted: false });
    expect(captureAuditEvent(f.state, f.state, event, false)).toMatchObject({
      subject: { kind: "unresolved" },
      outcome: "denied",
    });
  });

  it("retains one logical change across linked records, domain audit and session log", () => {
    const f = fixture();
    const next = wardFlowReducer(f.state, f.change);
    expect(next.rejections).toEqual([]);
    expect(next.auditEvents).toHaveLength(1);
    expect(next.auditEvents[0]).toMatchObject({
      category: "patient-record",
      action: "RECORD_OBSERVATION_LEVEL",
      subject: { kind: "movement", movementId: f.movement.id },
    });
    const rows = patientChronology(f.input(next, { eventLog: [eventLogEntryFor(f.change, true)] })).rows.filter(
      (row) => row.action === "Observation level changed",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "Record", who: "Bed coordinator", recordedAt: f.change.now });
    expect(rows[0]?.before).toContain("General");
    expect(rows[0]?.after).toContain("Constant within sight");
    expect(rows[0]?.after).toContain("demo time");
  });

  it("retains record history when audit is unavailable and deduplicates only linked mirrors", () => {
    const f = fixture();
    const next = wardFlowReducer(f.state, f.change);
    const input = f.input(next, { auditEvents: null });
    const rows = patientChronology(input).rows.filter((row) => row.action === "Observation level changed");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.who).toBe("Not recorded");
    input.admissions = input.admissions.map((row) => ({ ...row, movementId: null }));
    input.movements = input.movements.map((row) => ({ ...row, admissionId: undefined }));
    expect(patientChronology(input).rows.filter((row) => row.action === "Observation level changed")).toHaveLength(2);
  });

  it("preserves two accepted changes in the same minute and a refused admission-target attempt", () => {
    const f = fixture();
    const first = wardFlowReducer(f.state, f.change);
    const admission = first.admissions[0]!;
    const second: WardFlowEvent = {
      type: "RECORD_OBSERVATION_LEVEL",
      role: "coordinator",
      now: f.change.now,
      target: { kind: "admission", admissionId: admission.id, actingUnitId: admission.unitId },
      observation: GENERAL_OBSERVATION,
      expected: observationEditingToken(
        "admission",
        admission.id,
        admission.observation,
        admission.observationChanges!.length,
      ),
    };
    const next = wardFlowReducer(first, second);
    expect(next.rejections).toEqual([]);
    const refused = wardFlowReducer(next, second);
    expect(refused.rejections).toHaveLength(1);
    const log = eventLogEntryFor(second, false);
    expect(log).toMatchObject({ admissionId: admission.id, actingUnitId: admission.unitId });
    const rows = patientChronology(f.input(refused, { eventLog: [log] })).rows.filter((row) =>
      row.action.startsWith("Observation level changed"),
    );
    expect(rows).toHaveLength(3);
    expect(rows.filter((row) => row.source === "Record")).toHaveLength(2);
    expect(rows.some((row) => row.action.includes("denied"))).toBe(true);
  });
  it("does not use a refused audit entry to suppress an accepted session act in the same minute", () => {
    const f = fixture();
    const rows = patientChronology(
      f.input(f.state, {
        auditEvents: [captureAuditEvent(f.state, f.state, f.change, false)!],
        eventLog: [eventLogEntryFor(f.change, true)],
      }),
    ).rows.filter((row) => row.action.startsWith("Observation level changed"));
    expect(rows).toHaveLength(2);
    expect(rows.some((row) => row.source === "Audit" && row.action.includes("denied"))).toBe(true);
    expect(rows.some((row) => row.source === "Session log" && row.action === "Observation level changed")).toBe(true);
  });

  it.each([1, 2])("pairs %s audited refusals one for one with two session attempts", (auditCount) => {
    const f = fixture();
    let next = wardFlowReducer(f.state, f.change);
    for (let index = 0; index < auditCount; index += 1) next = wardFlowReducer(next, f.change);
    const log = eventLogEntryFor(f.change, false);
    const rows = patientChronology(f.input(next, { eventLog: [log, { ...log, sequence: 1 }] })).rows.filter((row) =>
      row.action.startsWith("Observation level changed"),
    );
    expect(rows).toHaveLength(3);
    expect(rows.filter((row) => row.source === "Audit")).toHaveLength(auditCount);
    expect(rows.filter((row) => row.source === "Session log")).toHaveLength(2 - auditCount);
  });
});

describe("output audit: standalone separation review time", () => {
  const admission = (
    leftAt: number,
  ): Pick<Admission, "id" | "leftAt" | "state" | "leavingDestination" | "careJourney"> => ({
    id: "synthetic-review-stay",
    state: "departed",
    leftAt,
    leavingDestination: "discharged-to-the-community",
    careJourney: {
      ...emptyCareJourney(),
      coding: {
        kind: "coding",
        receivingClass: "community_or_custody",
        separationCode: "90",
        dischargedFromLeave: false,
        recordedAt: leftAt,
        recordedBy: "Bed coordinator",
      },
    },
  });
  it.each([0, 1440, -1])("keeps an absolute departure and explicit minute origin at offset %s", (leftAt) => {
    const handoff = separationHandoff(admission(leftAt), dayZero);
    expect(handoff).toMatchObject({
      schemaVersion: 2,
      leftAt,
      timeBasis: { unit: "minutes", origin: dayZero.toISOString(), timeZone: "Australia/Perth" },
      departureAt: new Date(dayZero.getTime() + leftAt * 60_000).toISOString(),
    });
  });
  it("does not invent a calendar basis when none is supplied", () => {
    expect(separationHandoff(admission(0))).toMatchObject({ leftAt: 0, timeBasis: null, departureAt: null });
  });
});
