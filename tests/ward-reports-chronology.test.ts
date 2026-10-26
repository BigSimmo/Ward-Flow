import { describe, expect, it } from "vitest";

import {
  CHRONOLOGY_CSV_HEADER,
  chronologyCsv,
  patientChronology,
  patientRecordIds,
  reasonLabel,
  type ChronologyInput,
} from "@/components/ward-management/reports/patient-chronology";
import {
  legalFormReceiptCorrectionReasonLabels,
  OVERRIDE_REASONS,
} from "@/components/ward-management/ward-change-reasons";
import { formatSheetMoment } from "@/components/ward-management/ward-clock";
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
            declines: [{ unitId, at: NOW_ANCHOR - 90, reason: "no_suitable_bed" as const }],
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
    expect(override).toMatchObject({ reason: OVERRIDE_REASONS[1], who: "Bed coordinator", source: "Record" });
    const decline = chronology.rows.find((row) => row.action === "Ward declined");
    expect(decline?.reason).toBe(reasonLabel("no_suitable_bed"));
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
    expect(audit[0]).toMatchObject({ before: movement.legalStatus, after: event.legalStatus, who: "Bed coordinator" });
    const record = chronology.rows.find((row) => row.source === "Record" && row.action === "Legal status changed");
    expect(record).toMatchObject({ before: movement.legalStatus, after: event.legalStatus });
    expect(chronology.rows.filter((row) => row.source === "Session log")).toEqual([]);
  });

  it("shows a seclusion ending on the patient's chronology, though the end names only its episode", () => {
    const seed = seedWardFlowState();
    const stay = seed.admissions.find(
      (admission) =>
        admission.state === "occupied" &&
        seed.patients.some((patient) =>
          patientRecordIds(
            patient.id,
            seed.patients,
            seed.movements,
            seed.referrals,
            seed.admissions,
          ).admissions.includes(admission.id),
        ),
    )!;
    const personId = seed.patients.find((patient) =>
      patientRecordIds(patient.id, seed.patients, seed.movements, seed.referrals, seed.admissions).admissions.includes(
        stay.id,
      ),
    )!.id;
    const acting = { role: "ward", unitId: stay.unitId, actingUnitId: stay.unitId } as const;
    const start: WardFlowEvent = {
      type: "RECORD_RESTRICTIVE_PRACTICE_START",
      ...acting,
      now: NOW_ANCHOR + 5,
      admissionId: stay.id,
      practice: "seclusion",
      startedAt: NOW_ANCHOR - 15,
    };
    const started = wardFlowReducer(seed, start);
    const episodeId = started.units.find((unit) => unit.id === stay.unitId)!.restrictivePractice!.episodes[0]!.id;
    const end: WardFlowEvent = {
      type: "RECORD_RESTRICTIVE_PRACTICE_END",
      ...acting,
      now: NOW_ANCHOR + 10,
      episodeId,
      endedAt: NOW_ANCHOR,
    };
    const ended = wardFlowReducer(started, end);
    expect(ended.rejections).toEqual(seed.rejections);

    // The end names only its episode; the chronology reads the stay from the ward's record.
    const endEntry = eventLogEntryFor(end, true);
    expect(endEntry).toMatchObject({ episodeId, unitId: stay.unitId });
    expect(endEntry.admissionId).toBeUndefined();

    const eventLog = [eventLogEntryFor(start, true), endEntry];
    const chronology = patientChronology(inputFor(ended, { personId, auditEvents: null, eventLog }));
    const actions = chronology.rows.filter((row) => row.source === "Session log").map((row) => row.action);
    expect(actions).toEqual(["Seclusion or restraint started", "Seclusion or restraint ended"]);
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

  it("keeps distinct same-minute session acts that share a record", () => {
    const state = seedWardFlowState();
    const at = NOW_ANCHOR + 11;
    const ready: WardFlowEvent = {
      type: "HANDOVER_READY",
      role: "ed",
      now: at,
      movementId: MOVEMENT,
    };
    const accepted: WardFlowEvent = {
      type: "TRANSPORT_ACCEPTED",
      role: "officer",
      now: at,
      movementId: MOVEMENT,
    };
    const chronology = patientChronology(
      inputFor(state, {
        auditEvents: null,
        eventLog: [eventLogEntryFor(ready, true), eventLogEntryFor(accepted, true)],
      }),
    );
    const session = chronology.rows.filter((row) => row.source === "Session log").map((row) => row.action);
    expect(session).toHaveLength(2);
    expect(new Set(session).size).toBe(2);
  });

  it("shows the original receipt time when a form receipt was corrected", () => {
    const state = seedWardFlowState();
    const receivedAt = NOW_ANCHOR - 120;
    const correctedAt = NOW_ANCHOR - 30;
    const patched: WardFlowState = {
      ...state,
      movements: state.movements.map((movement) =>
        movement.id === MOVEMENT
          ? {
              ...movement,
              legalFormReceivedAt: undefined,
              legalFormReceiptCorrections: [
                {
                  at: correctedAt,
                  by: "coordinator",
                  reason: "recorded_in_error",
                  receivedAt,
                },
              ],
            }
          : movement,
      ),
    };
    const row = patientChronology(inputFor(patched)).rows.find(
      (candidate) => candidate.action === "Form receipt time corrected",
    );
    expect(row).toMatchObject({
      recordedAt: correctedAt,
      after: "Cleared",
      source: "Record",
    });
    expect(row?.before).toMatch(/\d/);
    expect(row?.before).not.toBe("Not recorded");
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

  it("keeps a different act in the same minute on the same record, and drops only the same act", () => {
    const seed = seedWardFlowState();
    const at = NOW_ANCHOR + 11;
    const state: WardFlowState = {
      ...seed,
      movements: seed.movements.map((movement) =>
        movement.id === MOVEMENT
          ? {
              ...movement,
              transport: undefined,
              stageChanges: [
                ...movement.stageChanges,
                { at, from: "pulled" as const, to: "handover_ready" as const, by: "ward" },
              ],
            }
          : movement,
      ),
    };
    const log = [
      {
        type: "HANDOVER_READY" as const,
        role: "ward" as const,
        now: at,
        accepted: true,
        movementId: MOVEMENT,
        sequence: 0,
      },
      {
        type: "TRANSPORT_ACCEPTED" as const,
        role: "officer" as const,
        now: at,
        accepted: true,
        movementId: MOVEMENT,
        sequence: 1,
      },
    ];
    const chronology = patientChronology(inputFor(state, { auditEvents: null, eventLog: log }));
    const session = chronology.rows.filter((row) => row.source === "Session log");
    expect(session).toHaveLength(1);
    expect(session[0]?.recordedAt).toBe(at);
    expect(chronology.rows.filter((row) => row.action === "Stage changed" && row.recordedAt === at)).toHaveLength(1);
  });

  it("shows a corrected form receipt with the original time before and cleared after", () => {
    const seed = seedWardFlowState();
    const received = NOW_ANCHOR - 120;
    const state: WardFlowState = {
      ...seed,
      movements: seed.movements.map((movement) =>
        movement.id === MOVEMENT
          ? {
              ...movement,
              legalFormReceivedAt: undefined,
              legalFormReceiptCorrections: [
                { at: NOW_ANCHOR - 60, by: "coordinator", reason: "recorded_in_error" as const, receivedAt: received },
              ],
            }
          : movement,
      ),
    };
    const row = patientChronology(inputFor(state)).rows.find((r) => r.action === "Form receipt time corrected");
    expect(row).toMatchObject({
      before: formatSheetMoment(received, DAY_ZERO, { includeYearAndZone: true }),
      after: "Cleared",
      who: "Bed coordinator",
      reason: legalFormReceiptCorrectionReasonLabels.recorded_in_error,
    });
  });

  it("reads the officer's Delivered as a transport delivery, never as the patient's arrival", () => {
    const seed = seedWardFlowState();
    const unitId = seed.units[0]!.id;
    const wardName = seed.units[0]!.name;
    const state: WardFlowState = {
      ...seed,
      movements: seed.movements.map((movement) =>
        movement.id === MOVEMENT
          ? {
              ...movement,
              acceptedUnitId: unitId,
              closure: undefined,
              transport: {
                id: `${MOVEMENT}-transport`,
                provider: "Patient transport service" as const,
                escortRequired: false,
                collectedAt: NOW_ANCHOR - 20,
                arrivedAt: NOW_ANCHOR - 10,
              },
            }
          : movement,
      ),
    };
    const delivered = { type: "PATIENT_ARRIVED" as const, role: "officer" as const, movementId: MOVEMENT };
    const log = [
      { ...delivered, now: NOW_ANCHOR - 10, accepted: true, sequence: 0 },
      { ...delivered, now: NOW_ANCHOR - 5, accepted: false, sequence: 1 },
    ];
    const rows = patientChronology(inputFor(state, { auditEvents: null, eventLog: log })).rows;
    const actions = rows.map((row) => row.action);
    expect(actions).toContain(`Transport delivered to ${wardName}`);
    expect(actions).toContain(`Transport delivered to ${wardName} (refused)`);
    expect(actions.some((action) => action.includes("Patient arrived"))).toBe(false);
    // The recorded delivery already says it, so only the refused attempt comes from the session log.
    expect(rows.filter((row) => row.source === "Session log")).toHaveLength(1);
  });

  it("lists the transport job's recorded steps, the transport need and recorded documents", () => {
    const seed = seedWardFlowState();
    const state: WardFlowState = {
      ...seed,
      movements: seed.movements.map((movement) =>
        movement.id === MOVEMENT
          ? {
              ...movement,
              transportNeed: { needed: true, at: NOW_ANCHOR - 50 },
              transport: {
                id: `${MOVEMENT}-transport`,
                provider: "Patient transport service" as const,
                escortRequired: true,
                bookedBy: { role: "coordinator" as const },
                acceptedAt: NOW_ANCHOR - 40,
                enRouteAt: NOW_ANCHOR - 30,
              },
              uploadedForms: [
                {
                  id: "FORM-1",
                  formName: "Transfer letter",
                  fileName: "letter.pdf",
                  uploadedAt: NOW_ANCHOR - 20,
                  uploadedBy: "ed" as const,
                },
              ],
            }
          : movement,
      ),
    };
    const log = [
      {
        type: "TRANSPORT_ACCEPTED" as const,
        role: "officer" as const,
        now: NOW_ANCHOR - 40,
        accepted: true,
        movementId: MOVEMENT,
        sequence: 0,
      },
    ];
    const rows = patientChronology(inputFor(state, { eventLog: log })).rows;
    const actions = rows.map((row) => row.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "Transport need recorded",
        "Transport booked",
        "Transport accepted",
        "Transport en route",
        "Document recorded",
      ]),
    );
    expect(rows.find((row) => row.action === "Transport booked")).toMatchObject({
      who: "Bed coordinator",
      recordedAt: null,
      after: "Patient transport service, escort required",
    });
    expect(rows.find((row) => row.action === "Document recorded")?.after).toBe("Transfer letter");
    expect(rows.some((row) => Object.values(row).some((value) => String(value).includes("letter.pdf")))).toBe(false);
    // The recorded acceptance already says it, so the session log does not repeat it.
    expect(rows.filter((row) => row.source === "Session log")).toEqual([]);
  });

  it("shows a destination cancelled by an acceptance elsewhere, naming no decider", () => {
    const seed = seedWardFlowState();
    const person = seed.patients.find(
      (patient) =>
        patientRecordIds(patient.id, seed.patients, seed.movements, seed.referrals, seed.admissions).referrals.length >
        0,
    )!;
    const referralId = patientRecordIds(person.id, seed.patients, seed.movements, seed.referrals, seed.admissions)
      .referrals[0]!;
    const state: WardFlowState = {
      ...seed,
      referrals: seed.referrals.map((referral) =>
        referral.id === referralId
          ? {
              ...referral,
              destinations: [
                ...referral.destinations,
                {
                  ...referral.destinations[0]!,
                  state: "cancelled" as const,
                  decidedAt: NOW_ANCHOR - 15,
                  decidedBy: undefined,
                  withdrawnAt: undefined,
                },
              ],
            }
          : referral,
      ),
    };
    const row = patientChronology(inputFor(state, { personId: person.id })).rows.find(
      (candidate) => candidate.action === "Referral cancelled",
    );
    expect(row).toMatchObject({
      recordedAt: NOW_ANCHOR - 15,
      who: "No one (automatic)",
      reason: "Accepted somewhere else",
    });
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
    expect(lines[0]).toContain("2026");
    expect(lines[0]).toContain("AWST");
    expect(lines[1]).toBe(`"Scope","Selected patient's retained chronology"`);
    expect(lines[2]).toContain('"Period"');
    expect(lines[3]).toBe(CHRONOLOGY_CSV_HEADER.map((cell) => `"${cell}"`).join(","));
    expect(lines).toHaveLength(rows.length + 4);
    expect(csv).toContain(`"'=HYPERLINK(1)"`);
    expect(csv).toContain(OVERRIDE_REASONS[1]);
  });

  it("names the person on its own line when given, before the column header", () => {
    const chronology = patientChronology(inputFor(seedWardFlowState()));
    const lines = chronologyCsv(chronology.rows, DAY_ZERO, NOW_ANCHOR, "Sample Person · 1000001").split("\r\n");
    expect(lines[1]).toBe(`"Patient","Sample Person · 1000001"`);
    expect(lines[4]).toBe(CHRONOLOGY_CSV_HEADER.map((cell) => `"${cell}"`).join(","));
  });
});
