import { describe, expect, it } from "vitest";

import { seedWardFlowStateAt, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { buildScenarioFile, readScenarioFile } from "@/components/ward-management/ward-flow-scenario-file";
import {
  isValidStoredWardFlowState,
  WARD_FLOW_STORED_STATE_VERSION,
} from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function fixture() {
  // Recovery reads JSON: optional undefined seed fields are absent on disk.
  const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as WardFlowState;
  const stay = state.admissions.find((admission) => admission.state === "occupied")!;
  const unit = state.units.find((candidate) => candidate.id === stay.unitId)!;
  const record = {
    episodes: [
      {
        id: `RP-${unit.id}-1`,
        practice: "seclusion" as const,
        admissionId: stay.id,
        startedAt: NOW_ANCHOR - 20,
        recordedAt: NOW_ANCHOR - 10,
        recordedBy: "Ward",
      },
    ],
    incidents: [
      {
        id: `IN-${unit.id}-1`,
        category: "fall" as const,
        at: NOW_ANCHOR - 20,
        recordedAt: NOW_ANCHOR - 10,
        recordedBy: "Ward",
      },
    ],
  };
  unit.restrictivePractice = record;
  expect(isValidStoredWardFlowState(state)).toBe(true);
  return { state, unit, record };
}

describe("restrictive-practice recovery integrity", () => {
  it("refuses duplicate episode IDs, including an ended and open episode sharing an ID", () => {
    const { state, unit, record } = fixture();
    unit.restrictivePractice!.episodes = [{ ...record.episodes[0], endedAt: NOW_ANCHOR - 5 }, record.episodes[0]];
    expect(isValidStoredWardFlowState(state)).toBe(false);
  });

  it("refuses duplicate incident IDs", () => {
    const { state, record } = fixture();
    record.incidents.push({ ...record.incidents[0], at: NOW_ANCHOR - 15 });
    expect(isValidStoredWardFlowState(state)).toBe(false);
  });

  it("refuses an episode whose stay cannot be resolved", () => {
    const { state, record } = fixture();
    record.episodes[0].admissionId = "AD-SYNTHETIC-MISSING";
    expect(isValidStoredWardFlowState(state)).toBe(false);
  });

  it("refuses a start later than its recording", () => {
    const { state, record } = fixture();
    record.episodes[0].startedAt = record.episodes[0].recordedAt + 1;
    expect(isValidStoredWardFlowState(state)).toBe(false);
  });

  it("refuses an ending earlier than its start", () => {
    const { state, unit, record } = fixture();
    unit.restrictivePractice!.episodes[0].endedAt = record.episodes[0].startedAt - 1;
    expect(isValidStoredWardFlowState(state)).toBe(false);
  });

  it("refuses an incident later than its recording", () => {
    const { state, record } = fixture();
    record.incidents[0].at = record.incidents[0].recordedAt + 1;
    expect(isValidStoredWardFlowState(state)).toBe(false);
  });

  it("retains old open and ended episodes for departed stays", () => {
    const { state, unit, record } = fixture();
    const departed = state.admissions.find((admission) => admission.state === "departed")!;
    unit.restrictivePractice!.episodes = [
      {
        ...record.episodes[0],
        admissionId: departed.id,
        startedAt: NOW_ANCHOR - 10_000,
        recordedAt: NOW_ANCHOR - 9_990,
      },
      {
        ...record.episodes[0],
        id: `RP-${unit.id}-2`,
        admissionId: departed.id,
        startedAt: NOW_ANCHOR - 20_000,
        recordedAt: NOW_ANCHOR - 19_990,
        endedAt: NOW_ANCHOR - 19_980,
      },
    ];
    expect(isValidStoredWardFlowState(state)).toBe(true);
  });

  it("retains ward history when the admission now belongs to another ward", () => {
    const { state, unit, record } = fixture();
    const moved = state.admissions.find((admission) => admission.unitId !== unit.id)!;
    record.episodes[0].admissionId = moved.id;
    expect(isValidStoredWardFlowState(state)).toBe(true);
  });

  it.each([NOW_ANCHOR - 20, NOW_ANCHOR - 15, NOW_ANCHOR - 5])(
    "retains an ending at %s, including before or after the start was recorded",
    (endedAt) => {
      const { state, unit } = fixture();
      unit.restrictivePractice!.episodes[0].endedAt = endedAt;
      expect(isValidStoredWardFlowState(state)).toBe(true);
    },
  );

  it("accepts times recorded at the instant they happened", () => {
    const { state, record } = fixture();
    record.episodes[0].startedAt = record.episodes[0].recordedAt;
    record.incidents[0].at = record.incidents[0].recordedAt;
    expect(isValidStoredWardFlowState(state)).toBe(true);
  });

  it("uses the same integrity fence when loading a scenario file", () => {
    const { state, unit } = fixture();
    const built = buildScenarioFile(
      state,
      NOW_ANCHOR,
      WARD_FLOW_STORED_STATE_VERSION,
      new Date("2026-10-23T00:00:00Z"),
    );
    if (!built.ok) throw new Error(built.reason);
    expect(readScenarioFile(built.json, WARD_FLOW_STORED_STATE_VERSION).ok).toBe(true);
    const file = JSON.parse(built.json) as { state: WardFlowState };
    const episodes = file.state.units.find((candidate) => candidate.id === unit.id)!.restrictivePractice!.episodes;
    episodes.push({ ...episodes[0] });
    expect(readScenarioFile(JSON.stringify(file), WARD_FLOW_STORED_STATE_VERSION).ok).toBe(false);
  });
});
