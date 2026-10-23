import { describe, expect, it } from "vitest";
import { validSharedCommand } from "../backend/ward-flow/command-schemas";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { observationEditingToken } from "../src/components/ward-management/ward-flow-observation-events";
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
const BASELINE = '["movement","WF-OBS-BASELINE","general",null,null,0]';

function waiting(): WardFlowState {
  const seed = seedWardFlowState();
  return {
    ...seed,
    movements: [
      {
        ...seed.movements[0],
        id: "WF-OBS-BASELINE",
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
  it("encodes scalar facts and target identity in a stable tuple, independent of object key order", () => {
    expect(observationEditingToken("movement", "WF-OBS-BASELINE", GENERAL_OBSERVATION, 0)).toBe(BASELINE);
    expect(
      observationEditingToken(
        "admission",
        "WF-OBS-ADMISSION",
        { reviewAt: 123, intervalMinutes: 30, level: "intermittent" },
        2,
      ),
    ).toBe('["admission","WF-OBS-ADMISSION","intermittent",30,123,2]');
  });

  it("records against a matching baseline and keeps the existing change history", () => {
    const state = waiting();
    const next = record(state, observationAt("within_sight"), BASELINE);
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
    const expected = BASELINE;
    const latest = record(before, observationAt("arms_length"), expected);
    const staleSave = record(latest, observationAt("intermittent"), expected);
    expect(staleSave.rejections.at(-1)?.reason).toMatch(/observation changed.*reopen/i);
    expect(staleSave.movements).toBe(latest.movements);
    expect(staleSave.movements[0].observation.level).toBe("arms_length");
    expect(staleSave.movements[0].observationChanges).toHaveLength(1);
  });

  it("refuses a changed-and-restored level even when the current values match the old draft", () => {
    const expected = BASELINE;
    const first = record(waiting(), observationAt("within_sight"), expected);
    const restored = record(first, GENERAL_OBSERVATION, '["movement","WF-OBS-BASELINE","within_sight",null,null,1]');
    const staleSave = record(restored, observationAt("intermittent"), expected);
    expect(staleSave.rejections.at(-1)?.reason).toMatch(/observation changed.*reopen/i);
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
    const next = record(state, observationAt("two_staff"), '["movement","WF-OBS-BASELINE","intermittent",15,null,0]');
    expect(next.rejections.at(-1)?.reason).toMatch(/observation changed.*reopen/i);
    expect(next.movements).toBe(state.movements);
  });

  it.each([
    null,
    {},
    0,
    "",
    '["movement","WF-OBS-BASELINE","general",null,null,-1]',
    '["movement","WF-OBS-BASELINE","general",null,null,0.5]',
    '["movement","WF-OBS-BASELINE","unknown",null,null,0]',
    '["movement","WF-OBS-BASELINE","general",null,null,0,"extra"]',
    '["movement","WF-OBS-BASELINE","general",null,null,0] ',
  ])("refuses a malformed supplied baseline without changing the plan (%j)", (expected) => {
    const state = waiting();
    const next = record(state, observationAt("within_sight"), expected);
    expect(next.rejections.at(-1)?.reason).toMatch(/observation changed.*reopen/i);
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
      const held = { ...seed.admissions.find((admission) => admission.state === "occupied")!, id: "WF-OBS-ADMISSION" };
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
        ...command(
          state,
          observationAt("two_staff"),
          kind === "movement"
            ? '["movement","WF-OBS-BASELINE","general",null,null,1]'
            : '["admission","WF-OBS-ADMISSION","general",null,null,0]',
        ),
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
      expect(staleSave.rejections.at(-1)?.reason).toMatch(/observation changed.*reopen/i);
      expect(staleSave.movements).toBe(next.movements);
      expect(staleSave.admissions).toBe(next.admissions);
    },
  );

  it("passes a well-formed baseline through the shared command boundary", () => {
    const event = command(waiting(), observationAt("within_sight"), BASELINE);
    expect(validSharedCommand(JSON.parse(JSON.stringify(event)))).toBe(true);
  });

  it.each(["movement", "admission"] as const)(
    "refuses editing the %s if its linked record holds a different observation fact",
    (kind) => {
      const seed = seedWardFlowState();
      const held = { ...seed.admissions.find((admission) => admission.state === "occupied")!, id: "WF-OBS-ADMISSION" };
      const movement = {
        ...waiting().movements[0],
        admissionId: held.id,
        observation: kind === "movement" ? GENERAL_OBSERVATION : observationAt("arms_length"),
      };
      const admission = {
        ...held,
        movementId: movement.id,
        observation: kind === "admission" ? GENERAL_OBSERVATION : observationAt("arms_length"),
        observationChanges: undefined,
      };
      const state = { ...seed, movements: [movement], admissions: [admission], rejections: [] };
      const target =
        kind === "movement"
          ? { kind, movementId: movement.id }
          : { kind, admissionId: admission.id, actingUnitId: admission.unitId };
      const next = wardFlowReducer(state, {
        ...command(
          state,
          observationAt("intermittent"),
          kind === "movement" ? BASELINE : '["admission","WF-OBS-ADMISSION","general",null,null,0]',
        ),
        role: "ward",
        target,
      });
      expect(next.rejections.at(-1)?.reason).toMatch(/observation changed.*reopen/i);
      expect(next.movements).toBe(state.movements);
      expect(next.admissions).toBe(state.admissions);
    },
  );

  it("refuses reusing a draft against a different patient record with matching facts and history", () => {
    const seed = waiting();
    const state = { ...seed, movements: [{ ...seed.movements[0], id: "WF-OBS-OTHER" as const }] };
    const next = record(state, observationAt("within_sight"), BASELINE);
    expect(next.rejections.at(-1)?.reason).toMatch(/observation changed.*reopen/i);
    expect(next.movements).toBe(state.movements);
  });

  it("refuses a movement token reused as an admission token even when identifiers and facts match", () => {
    const seed = waiting();
    const admission = {
      ...seedWardFlowState().admissions.find((row) => row.state === "occupied")!,
      id: "WF-OBS-BASELINE",
      movementId: "WF-OBS-BASELINE" as const,
      observation: GENERAL_OBSERVATION,
      observationChanges: undefined,
    };
    const state = {
      ...seed,
      movements: [{ ...seed.movements[0], admissionId: admission.id }],
      admissions: [admission],
    };
    const next = wardFlowReducer(state, {
      ...command(state, observationAt("within_sight"), BASELINE),
      role: "ward",
      target: { kind: "admission", admissionId: admission.id, actingUnitId: admission.unitId },
    });
    expect(next.rejections.at(-1)?.reason).toMatch(/observation changed.*reopen/i);
    expect(next.movements).toBe(state.movements);
    expect(next.admissions).toBe(state.admissions);
  });
});
