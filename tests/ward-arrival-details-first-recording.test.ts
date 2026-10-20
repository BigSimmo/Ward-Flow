import { describe, expect, it } from "vitest";

import { pilotMeasures } from "@/components/ward-management/reports/pilot-measures";
import { patientChronology } from "@/components/ward-management/reports/patient-chronology";
import type { ReportWeek } from "@/components/ward-management/reports/weekly-report";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { shiftInstants } from "@/components/ward-management/ward-reanchor";
import type { Movement } from "@/components/ward-management/ward-model";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";

/**
 * Overall review (20 Oct 2026): every edit to an arrival plan used to overwrite `recordedAt` and
 * `recordedBy`, so the latest edit read as the first recording. The first recording now stays put
 * and a later edit is stamped `updatedAt` / `updatedBy`.
 */
const NOW = 10_000;

function pulledMovement(state: WardFlowState): Movement {
  const movement = state.movements.find((m) => m.stage === "pulled" && m.acceptedUnitId !== undefined && !m.closure);
  if (!movement) throw new Error("seed has no held movement");
  return movement;
}

describe("arrival plan: first recording is kept", () => {
  it("keeps the first time and role, and stamps a later edit as the update", () => {
    const seeded = seedWardFlowState();
    const movement = pulledMovement(seeded);
    const cleared: WardFlowState = {
      ...seeded,
      movements: seeded.movements.map((m) => (m.id === movement.id ? { ...m, arrivalDetails: undefined } : m)),
    };
    const first = wardFlowReducer(cleared, {
      type: "SET_ARRIVAL_DETAILS",
      role: "coordinator",
      now: NOW,
      movementId: movement.id,
      arrivalMode: "ambulance",
      estimatedArrivalAt: NOW + 60,
    });
    expect(first.rejections).toHaveLength(0);
    const recorded = first.movements.find((m) => m.id === movement.id)!.arrivalDetails!;
    expect(recorded).toMatchObject({ recordedAt: NOW, recordedBy: "coordinator", estimatedArrivalAt: NOW + 60 });
    expect(recorded.updatedAt).toBeUndefined();
    expect(recorded.updatedBy).toBeUndefined();

    const edited = wardFlowReducer(first, {
      type: "SET_ARRIVAL_DETAILS",
      role: "ward",
      actingUnitId: movement.acceptedUnitId,
      now: NOW + 25,
      movementId: movement.id,
      arrivalMode: "police",
      estimatedArrivalAt: NOW + 90,
    });
    expect(edited.rejections).toHaveLength(0);
    const after = edited.movements.find((m) => m.id === movement.id)!.arrivalDetails!;
    expect(after).toMatchObject({
      mode: "police",
      estimatedArrivalAt: NOW + 90,
      recordedAt: NOW,
      recordedBy: "coordinator",
      updatedAt: NOW + 25,
      updatedBy: "ward",
    });

    // The saved state, with and without the new optional fields, still restores.
    const stored = (state: WardFlowState) => JSON.parse(JSON.stringify({ ...state, rejections: [] })) as unknown;
    expect(isValidStoredWardFlowState(stored(edited))).toBe(true);
    expect(isValidStoredWardFlowState(stored(first))).toBe(true);
  });

  it("refuses a restored update time that is not a number", () => {
    const seeded = seedWardFlowState();
    const movement = pulledMovement(seeded);
    const broken = JSON.parse(
      JSON.stringify({
        ...seeded,
        movements: seeded.movements.map((m) =>
          m.id === movement.id
            ? {
                ...m,
                arrivalDetails: {
                  mode: "ambulance",
                  estimatedArrivalAt: NOW,
                  recordedAt: NOW,
                  recordedBy: "ward",
                  updatedAt: "later",
                },
              }
            : m,
        ),
      }),
    ) as unknown;
    expect(isValidStoredWardFlowState(broken)).toBe(false);
  });

  it("lists the first recording and the latest update as separate chronology rows", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((m) => m.patientId !== undefined)!;
    const withPlan: WardFlowState = {
      ...state,
      movements: state.movements.map((m) =>
        m.id === movement.id
          ? {
              ...m,
              arrivalDetails: {
                mode: "ambulance",
                estimatedArrivalAt: NOW + 60,
                recordedAt: NOW,
                recordedBy: "coordinator",
                updatedAt: NOW + 25,
                updatedBy: "ward",
              },
            }
          : m,
      ),
    };
    const chronology = patientChronology({
      personId: movement.patientId!,
      patients: withPlan.patients,
      movements: withPlan.movements,
      referrals: withPlan.referrals,
      admissions: withPlan.admissions,
      units: withPlan.units,
      auditEvents: withPlan.auditEvents,
      eventLog: [],
      dayZero: new Date(2026, 9, 7),
    });
    const rows = chronology.rows.filter((row) => row.record === "Movement" && row.action.startsWith("Arrival details"));
    expect(rows.map((row) => [row.action, row.recordedAt, row.who])).toEqual([
      ["Arrival details recorded", NOW, WARD_FLOW_ROLE_LABELS.coordinator],
      ["Arrival details updated", NOW + 25, WARD_FLOW_ROLE_LABELS.ward],
    ]);
  });

  it("stops a bed hold at the first arrival recording, not at a later edit", () => {
    const DAY = 24 * 60;
    const HOLD = 240;
    const week: ReportWeek = { offset: 0, start: 0, end: 7 * DAY, countedEnd: 7 * DAY };
    const state = seedWardFlowState();
    const base = state.movements[0]!;
    const movement: Movement = {
      ...base,
      id: "MV-arrival-edit" as Movement["id"],
      patientId: undefined,
      referralId: undefined,
      stage: "moving",
      openedAt: DAY,
      stageChanges: [
        { at: DAY + 100, to: "pulled", by: "ward" },
        { at: DAY + 100 + HOLD + 60, to: "moving", by: "officer" },
      ],
      declines: [],
      overrides: [],
      unwinds: [],
      closure: undefined,
      leftDepartmentAt: undefined,
      transport: undefined,
      // Sorted inside the hold, then edited after the hold would have run out.
      arrivalDetails: {
        mode: "ambulance",
        estimatedArrivalAt: DAY + 300,
        recordedAt: DAY + 150,
        recordedBy: "ward",
        updatedAt: DAY + 100 + HOLD + 30,
        updatedBy: "ward",
      },
    };
    const measures = pilotMeasures(
      { movements: [movement], referrals: [], patients: state.patients, now: 8 * DAY, pullHoldMinutes: HOLD },
      week,
    );
    expect(measures.holds).toEqual({ held: 1, ranOut: 0, givenBack: 0 });
  });

  it("moves both arrival times when the demo clock re-anchors", () => {
    const state = seedWardFlowState();
    const movement = pulledMovement(state);
    const withPlan: WardFlowState = {
      ...state,
      movements: state.movements.map((m) =>
        m.id === movement.id
          ? {
              ...m,
              arrivalDetails: {
                mode: "ambulance",
                estimatedArrivalAt: NOW + 60,
                recordedAt: NOW,
                recordedBy: "coordinator",
                updatedAt: NOW + 25,
                updatedBy: "ward",
              },
            }
          : m,
      ),
    };
    const shifted = shiftInstants(withPlan, 137).movements.find((m) => m.id === movement.id)!.arrivalDetails!;
    expect(shifted).toMatchObject({ recordedAt: NOW + 137, updatedAt: NOW + 162, estimatedArrivalAt: NOW + 197 });
  });
});
