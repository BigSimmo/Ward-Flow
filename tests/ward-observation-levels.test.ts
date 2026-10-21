import { describe, expect, it } from "vitest";

import { remainingSpeciallingCapacity, type Admission } from "../src/components/ward-management/ward-admissions";
import { unitHasLockedBeds } from "../src/components/ward-management/ward-bed-designation";
import { CLINICAL_VALUES, OBSERVATION_LEVEL_NAMES } from "../src/components/ward-management/ward-clinical-values";
import { EVENT_ROLE } from "../src/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import {
  isValidStoredWardFlowState,
  migrateStoredWardFlowState,
  WARD_FLOW_STORED_STATE_VERSION,
} from "../src/components/ward-management/ward-flow-storage-validation";
import { selectPatientHistory } from "../src/components/ward-management/ward-history";
import type { Movement, Unit } from "../src/components/ward-management/ward-model";
import {
  GENERAL_OBSERVATION,
  INTERMITTENT_INTERVAL_MINUTES,
  OBSERVATION_LEVELS,
  isObservation,
  observationAt,
  observationStaff,
  observationSummary,
  upgradeLegacyObservationRows,
  type Observation,
  type ObservationLevel,
} from "../src/components/ward-management/ward-observation";
import { isValidSharedWardFlowState } from "../src/components/ward-management/ward-shared-state-validation";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * Fix plan item 10 (Josh, 21 Oct 2026): observation levels replace the yes/no specialling flag.
 * General (hourly), Intermittent (15 or 30 minutes), Constant within sight (1:1), Constant within
 * arm's length (1:1) and Two staff constant (2:1), with a typed review time. 1:1 counts one staff
 * against the ward's observation capacity, 2:1 counts two, and General and Intermittent none.
 */

const NOW = NOW_ANCHOR;
const UNIT_ID = "rgh-adult-secure";

function unitIn(state: WardFlowState): Unit {
  return state.units.find((candidate) => candidate.id === UNIT_ID)!;
}

/** Two movements accepted at a ward staffed for `staff` observation staff, with plenty of beds. */
function bench(levels: readonly ObservationLevel[], staff: number): WardFlowState {
  const seeded = seedWardFlowState();
  const base = seeded.units.find((candidate) => candidate.id === UNIT_ID)!;
  const unit: Unit = {
    ...base,
    beds: 20,
    empty: { ...base.empty, value: 6, confirmedAt: NOW },
    allocatable: { ...base.allocatable, value: 6, confirmedAt: NOW },
    allocatableLocked: 6,
    speciallingCapacity: staff,
  };
  const securityWord = unitHasLockedBeds(unit) ? "Secure" : "Open";
  const sources = seeded.movements.filter(
    (candidate) => candidate.cohort === unit.cohort && candidate.security === securityWord,
  );
  const movements: Movement[] = levels.map((level, index) => ({
    ...sources[index],
    id: `WF-OBS-${index}`,
    patientId: `PT-WF-OBS-${index}`,
    referralId: undefined,
    observation: observationAt(level),
    stage: "accepted_awaiting_bed",
    acceptedUnitId: UNIT_ID,
    referredUnitIds: [],
    declines: [],
    closure: undefined,
    transport: undefined,
    pullExpiresAt: undefined,
    admissionId: undefined,
  }));
  return {
    ...seeded,
    units: seeded.units.map((candidate) => (candidate.id === UNIT_ID ? unit : candidate)),
    movements,
    patients: [
      ...seeded.patients,
      ...movements.map((m) => ({ ...seeded.patients[0], id: m.patientId!, umrn: `SYN-${m.id}` })),
    ],
    admissions: seeded.admissions.filter((admission) => admission.unitId !== UNIT_ID),
    bedReleases: seeded.bedReleases.filter((release) => release.unitId !== UNIT_ID),
    rejections: [],
  };
}

function pull(state: WardFlowState, movementId: string): WardFlowState {
  return wardFlowReducer(state, { type: "PULL_PATIENT", role: "ward", now: NOW, movementId, unitId: UNIT_ID });
}

function admissionFor(state: WardFlowState, movementId: string): Admission | undefined {
  return state.admissions.find((admission) => admission.movementId === movementId);
}

describe("the five observation levels", () => {
  it("are the five Josh chose, in order, with names from the clinical values file", () => {
    expect(OBSERVATION_LEVELS).toEqual(["general", "intermittent", "within_sight", "arms_length", "two_staff"]);
    expect(Object.values(OBSERVATION_LEVEL_NAMES)).toEqual([
      "General",
      "Intermittent",
      "Constant within sight",
      "Constant within arm's length",
      "Two staff constant",
    ]);
  });

  it("count one staff for each 1:1 level, two for 2:1, and none for General or Intermittent", () => {
    expect(OBSERVATION_LEVELS.map(observationStaff)).toEqual([0, 0, 1, 1, 2]);
    expect(CLINICAL_VALUES.observationOneToOneStaff.value).toBe(1);
    expect(CLINICAL_VALUES.observationTwoToOneStaff.value).toBe(2);
  });

  it("offer 15 and 30 minutes for Intermittent and read General as hourly", () => {
    expect(INTERMITTENT_INTERVAL_MINUTES).toEqual([15, 30]);
    expect(observationSummary(GENERAL_OBSERVATION)).toBe("General, hourly");
    expect(observationSummary({ level: "intermittent", intervalMinutes: 30, reviewAt: null })).toBe(
      "Intermittent, every 30 minutes",
    );
    expect(observationSummary(observationAt("arms_length"))).toBe("Constant within arm's length (1:1)");
    expect(observationSummary(observationAt("two_staff"))).toBe("Two staff constant (2:1)");
  });

  it("refuse an interval on any level but Intermittent, and an interval off the list", () => {
    expect(isObservation({ level: "intermittent", intervalMinutes: 15, reviewAt: NOW })).toBe(true);
    expect(isObservation({ level: "intermittent", intervalMinutes: 20, reviewAt: null })).toBe(false);
    expect(isObservation({ level: "general", intervalMinutes: 15, reviewAt: null })).toBe(false);
    expect(isObservation({ level: "one_to_one", intervalMinutes: null, reviewAt: null })).toBe(false);
    expect(isObservation({ level: "general", intervalMinutes: null, reviewAt: Number.NaN })).toBe(false);
  });
});

describe("observation staff capacity counts staff, not patients", () => {
  it("a two staff patient takes both of a ward's two observation staff", () => {
    const state = pull(bench(["two_staff"], 2), "WF-OBS-0");
    expect(state.rejections).toEqual([]);
    expect(admissionFor(state, "WF-OBS-0")?.observation.level).toBe("two_staff");
    expect(remainingSpeciallingCapacity(unitIn(state), state.admissions)).toBe(0);
  });

  it("refuses a two staff patient at a ward with one observation staff free", () => {
    const state = pull(bench(["two_staff"], 1), "WF-OBS-0");
    expect(admissionFor(state, "WF-OBS-0")).toBeUndefined();
    expect(state.rejections.at(-1)?.reason).toMatch(/not enough observation staff left/);
    expect(state.rejections.at(-1)?.reason).toContain("Two staff constant (2:1)");
  });

  it("takes a 1:1 patient there, then refuses a second 1:1", () => {
    const first = pull(bench(["within_sight", "arms_length"], 1), "WF-OBS-0");
    expect(first.rejections).toEqual([]);
    const second = pull(first, "WF-OBS-1");
    expect(admissionFor(second, "WF-OBS-1")).toBeUndefined();
    expect(second.rejections.at(-1)?.reason).toMatch(/not enough observation staff left/);
  });

  it("never refuses General or Intermittent, which take no staff", () => {
    const state = pull(pull(bench(["general", "intermittent"], 0), "WF-OBS-0"), "WF-OBS-1");
    expect(state.rejections).toEqual([]);
    expect(remainingSpeciallingCapacity(unitIn(state), state.admissions)).toBe(0);
  });
});

describe("RECORD_OBSERVATION_LEVEL is the only way a level changes", () => {
  const change = (
    state: WardFlowState,
    target: Extract<Parameters<typeof wardFlowReducer>[1], { type: "RECORD_OBSERVATION_LEVEL" }>["target"],
    observation: Observation,
    role: "ward" | "ed" | "coordinator" = "ward",
  ) => wardFlowReducer(state, { type: "RECORD_OBSERVATION_LEVEL", role, now: NOW + 5, target, observation });

  it("may be raised by the ED, the ward and the coordinator", () => {
    expect(EVENT_ROLE.RECORD_OBSERVATION_LEVEL).toEqual(["ed", "ward", "coordinator"]);
  });

  it("changes the stay and the movement it came from together, and keeps both histories", () => {
    const pulled = pull(bench(["general"], 2), "WF-OBS-0");
    const admission = admissionFor(pulled, "WF-OBS-0")!;
    const next: Observation = { level: "two_staff", intervalMinutes: null, reviewAt: NOW + 120 };
    const state = change(pulled, { kind: "admission", admissionId: admission.id, actingUnitId: UNIT_ID }, next);
    expect(state.rejections).toEqual([]);
    const after = state.admissions.find((candidate) => candidate.id === admission.id)!;
    expect(after.observation).toEqual(next);
    expect(after.observationChanges).toEqual([{ at: NOW + 5, from: GENERAL_OBSERVATION, to: next }]);
    const movement = state.movements.find((candidate) => candidate.id === "WF-OBS-0")!;
    expect(movement.observation).toEqual(next);
    expect(movement.observationChanges).toHaveLength(1);
    expect(remainingSpeciallingCapacity(unitIn(state), state.admissions)).toBe(0);
  });

  it("from the movement before a bed is held, changes the movement only", () => {
    const state = change(
      bench(["general"], 2),
      { kind: "movement", movementId: "WF-OBS-0" },
      observationAt("intermittent"),
      "ed",
    );
    expect(state.rejections).toEqual([]);
    expect(state.movements[0].observation).toEqual({ level: "intermittent", intervalMinutes: 15, reviewAt: null });
  });

  it("does not refuse a ward raising an occupied bed past its staffed capacity", () => {
    const pulled = pull(bench(["general"], 0), "WF-OBS-0");
    const admission = admissionFor(pulled, "WF-OBS-0")!;
    const state = change(
      pulled,
      { kind: "admission", admissionId: admission.id, actingUnitId: UNIT_ID },
      observationAt("within_sight"),
    );
    expect(state.rejections).toEqual([]);
    expect(remainingSpeciallingCapacity(unitIn(state), state.admissions)).toBe(0);
  });

  it("refuses no change, an interval off the list, and another ward acting", () => {
    const pulled = pull(bench(["general"], 2), "WF-OBS-0");
    const admissionId = admissionFor(pulled, "WF-OBS-0")!.id;
    const own = { kind: "admission", admissionId, actingUnitId: UNIT_ID } as const;
    expect(change(pulled, own, GENERAL_OBSERVATION).rejections.at(-1)?.reason).toMatch(/already recorded/);
    expect(
      change(pulled, own, { level: "intermittent", intervalMinutes: 45, reviewAt: null }).rejections.at(-1)?.reason,
    ).toMatch(/INTERMITTENT_INTERVAL_MINUTES/);
    expect(
      change(pulled, { ...own, actingUnitId: "rph-adult-open" }, observationAt("within_sight")).rejections.at(-1)
        ?.reason,
    ).toMatch(/belongs to unit/);
  });

  it("appears in the patient's history as a change of observation level", () => {
    const pulled = pull(bench(["general"], 2), "WF-OBS-0");
    const event = {
      type: "RECORD_OBSERVATION_LEVEL",
      role: "ward",
      now: NOW + 5,
      target: { kind: "movement", movementId: "WF-OBS-0" },
      observation: observationAt("within_sight"),
    } as const;
    const entries = selectPatientHistory([event], "WF-OBS-0", NOW + 10);
    expect(entries.map((entry) => entry.summary)).toContain("Observation level changed");
    expect(pulled.rejections).toEqual([]);
  });
});

describe("saves made before observation levels still load", () => {
  /** The current seed, written back the way a save from before fix plan item 10 held it. */
  function legacySave(): Record<string, unknown> {
    const state = JSON.parse(JSON.stringify(seedWardFlowState())) as Record<string, unknown>;
    const toLegacy = (row: Record<string, unknown>) => {
      const { observation, ...rest } = row as Record<string, unknown> & { observation: Observation };
      delete rest.observationChanges;
      return { ...rest, specialling: observationStaff(observation.level) > 0 };
    };
    state.movements = (state.movements as Record<string, unknown>[]).map(toLegacy);
    state.admissions = (state.admissions as Record<string, unknown>[]).map(toLegacy);
    return state;
  }

  it("reads true as Constant within sight and false as General, and nothing else", () => {
    const upgraded = upgradeLegacyObservationRows(legacySave()) as unknown as WardFlowState;
    for (const row of [...upgraded.movements, ...upgraded.admissions]) {
      expect("specialling" in row).toBe(false);
      expect(["general", "within_sight"]).toContain(row.observation.level);
    }
    expect(upgraded.movements.some((movement) => movement.observation.level === "within_sight")).toBe(true);
  });

  it("returns a current state unchanged, as the same object", () => {
    const current = seedWardFlowState();
    expect(upgradeLegacyObservationRows(current)).toBe(current);
    expect(migrateStoredWardFlowState(current, WARD_FLOW_STORED_STATE_VERSION)).toBe(current);
  });

  it("restores a browser save or scenario file through the stored-state check", () => {
    const legacy = legacySave();
    expect(isValidStoredWardFlowState(legacy)).toBe(false);
    expect(isValidStoredWardFlowState(migrateStoredWardFlowState(legacy, WARD_FLOW_STORED_STATE_VERSION))).toBe(true);
  });

  it("reads a shared workspace's old rows as levels before the server or browser uses them", () => {
    const legacy = legacySave() as unknown as WardFlowState;
    expect(isValidSharedWardFlowState(legacy)).toBe(true);
    expect(legacy.movements.every((movement) => isObservation(movement.observation))).toBe(true);
    expect(legacy.admissions.every((admission) => isObservation(admission.observation))).toBe(true);
  });
});
