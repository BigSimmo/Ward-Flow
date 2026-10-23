import { describe, expect, it } from "vitest";
import { validSharedCommand } from "../backend/ward-flow/command-schemas";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import {
  GENERAL_OBSERVATION,
  observationAt,
  type Observation,
} from "../src/components/ward-management/ward-observation";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function waiting(): WardFlowState {
  const seed = seedWardFlowState();
  return {
    ...seed,
    movements: [
      {
        ...seed.movements[0],
        closure: undefined,
        admissionId: undefined,
        observation: GENERAL_OBSERVATION,
        observationChanges: undefined,
      },
    ],
    admissions: [],
    rejections: [],
  };
}

function command<Expected>(state: WardFlowState, observation: Observation, expected: Expected) {
  return {
    type: "RECORD_OBSERVATION_LEVEL",
    role: "ed",
    now: NOW + 5,
    target: { kind: "movement", movementId: state.movements[0].id },
    observation,
    expected,
  } as const;
}

function record(state: WardFlowState, observation: Observation, expected: unknown): WardFlowState {
  return wardFlowReducer(state, command(state, observation, expected) as unknown as WardFlowEvent);
}

describe("an observation draft's editing baseline", () => {
  it("records against a matching baseline and keeps the existing change history", () => {
    const state = waiting();
    const next = record(state, observationAt("within_sight"), {
      observation: GENERAL_OBSERVATION,
      changeCount: 0,
    });
    expect(next.rejections).toEqual([]);
    expect(next.movements[0].observation).toEqual({
      level: "within_sight",
      intervalMinutes: null,
      reviewAt: null,
    });
    expect(next.movements[0].observationChanges).toHaveLength(1);
  });

  it("refuses an old draft after a newer constant level has been polled", () => {
    const before = waiting();
    const expected = { observation: GENERAL_OBSERVATION, changeCount: 0 };
    const latest = record(before, observationAt("arms_length"), expected);
    const staleSave = record(latest, observationAt("intermittent"), expected);
    expect(staleSave.rejections.at(-1)?.reason).toMatch(/changed.*editing/i);
    expect(staleSave.movements).toBe(latest.movements);
    expect(staleSave.movements[0].observation.level).toBe("arms_length");
    expect(staleSave.movements[0].observationChanges).toHaveLength(1);
  });

  it("refuses a changed-and-restored level even when the current values match the old draft", () => {
    const expected = { observation: GENERAL_OBSERVATION, changeCount: 0 };
    const first = record(waiting(), observationAt("within_sight"), expected);
    const restored = record(first, GENERAL_OBSERVATION, {
      observation: observationAt("within_sight"),
      changeCount: 1,
    });
    const staleSave = record(restored, observationAt("intermittent"), expected);
    expect(staleSave.rejections.at(-1)?.reason).toMatch(/changed.*editing/i);
    expect(staleSave.movements).toBe(restored.movements);
    expect(staleSave.movements[0].observationChanges).toHaveLength(2);
  });

  it.each([
    ["level", observationAt("within_sight")],
    ["interval", { level: "intermittent", intervalMinutes: 30, reviewAt: null }],
    ["review time", { level: "intermittent", intervalMinutes: 15, reviewAt: NOW + 90 }],
  ] as const)("refuses a changed %s even if the history count is unchanged", (_field, current) => {
    const seed = waiting();
    const state = { ...seed, movements: [{ ...seed.movements[0], observation: current }] };
    const next = record(state, observationAt("two_staff"), {
      observation: observationAt("intermittent"),
      changeCount: 0,
    });
    expect(next.rejections.at(-1)?.reason).toMatch(/changed.*editing/i);
    expect(next.movements).toBe(state.movements);
  });

  it.each([
    null,
    {},
    { observation: GENERAL_OBSERVATION, changeCount: -1 },
    { observation: GENERAL_OBSERVATION, changeCount: 0.5 },
    { observation: GENERAL_OBSERVATION, changeCount: Number.NaN },
    { observation: GENERAL_OBSERVATION, changeCount: Number.MAX_SAFE_INTEGER + 1 },
    { observation: { ...GENERAL_OBSERVATION, level: "unknown" }, changeCount: 0 },
    { observation: GENERAL_OBSERVATION, changeCount: 0, note: "extra" },
  ])("refuses a malformed supplied baseline without changing the plan (%j)", (expected) => {
    const state = waiting();
    const next = record(state, observationAt("within_sight"), expected);
    expect(next.rejections.at(-1)?.reason).toMatch(/valid editing baseline/i);
    expect(next.movements).toBe(state.movements);
  });

  it("keeps older callers usable when they omit the optional baseline", () => {
    const state = waiting();
    const event = {
      type: "RECORD_OBSERVATION_LEVEL",
      role: "ed",
      now: NOW + 5,
      target: { kind: "movement", movementId: state.movements[0].id },
      observation: observationAt("within_sight"),
    } as const;
    const next = wardFlowReducer(state, event);
    expect(next.rejections).toEqual([]);
    expect(next.movements[0].observation.level).toBe("within_sight");
  });

  it.each(["movement", "admission"] as const)(
    "uses the named %s history when a movement has changes from before admission",
    (kind) => {
      const seed = seedWardFlowState();
      const held = seed.admissions.find((admission) => admission.state === "occupied")!;
      const movement = {
        ...waiting().movements[0],
        admissionId: held.id,
        observationChanges: [{ at: NOW - 5, from: observationAt("within_sight"), to: GENERAL_OBSERVATION }],
      };
      const admission = {
        ...held,
        movementId: movement.id,
        observation: GENERAL_OBSERVATION,
        observationChanges: undefined,
      };
      const state = { ...seed, movements: [movement], admissions: [admission], rejections: [] };
      const target =
        kind === "movement"
          ? { kind, movementId: movement.id }
          : { kind, admissionId: admission.id, actingUnitId: admission.unitId };
      const event = {
        ...command(state, observationAt("two_staff"), {
          observation: GENERAL_OBSERVATION,
          changeCount: kind === "movement" ? 1 : 0,
        }),
        role: "ward",
        target,
      } as const;
      const next = wardFlowReducer(state, event);
      expect(next.rejections).toEqual([]);
      expect(next.movements[0].observation.level).toBe("two_staff");
      expect(next.admissions[0].observation.level).toBe("two_staff");
      expect(next.movements[0].observationChanges).toHaveLength(2);
      expect(next.admissions[0].observationChanges).toHaveLength(1);

      const staleSave = wardFlowReducer(next, {
        ...event,
        observation: observationAt("intermittent"),
      });
      expect(staleSave.rejections.at(-1)?.reason).toMatch(/changed.*editing/i);
      expect(staleSave.movements).toBe(next.movements);
      expect(staleSave.admissions).toBe(next.admissions);
    },
  );

  it("passes a well-formed baseline through the shared command boundary", () => {
    const event = command(waiting(), observationAt("within_sight"), {
      observation: GENERAL_OBSERVATION,
      changeCount: 0,
    });
    expect(validSharedCommand(JSON.parse(JSON.stringify(event)))).toBe(true);
  });
});
