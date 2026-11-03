import { afterEach, describe, expect, it } from "vitest";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { tryReadDemoState } from "@/components/ward-management/ward-flow-demo-restore";
import {
  isValidStoredWardFlowState,
  migrateStoredWardFlowState,
  WARD_FLOW_STORED_STATE_VERSION,
} from "@/components/ward-management/ward-flow-storage-validation";
import { observationStaff, type Observation } from "@/components/ward-management/ward-observation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("same-version browser restore observation migration", () => {
  const dayZero = new Date("2026-11-02T00:00:00Z");
  const savedAt = Date.parse("2026-11-02T10:00:00Z") / 60_000;
  function payload() {
    return {
      version: WARD_FLOW_STORED_STATE_VERSION,
      dayZero: dayZero.getTime(),
      worldGeneration: 0,
      now: NOW_ANCHOR + 17,
      savedAtAbsolute: savedAt,
      state: JSON.parse(JSON.stringify({ ...seedWardFlowStateAt(0), clockOffsetMinutes: 17 })),
    };
  }
  function legacyPayload() {
    const saved = payload();
    for (const key of ["movements", "admissions"]) {
      saved.state[key] = saved.state[key].map((row: Record<string, unknown> & { observation: Observation }) => {
        const { observation, ...rest } = row;
        delete rest.observationChanges;
        return {
          ...rest,
          specialling: observationStaff((observation as { level: "general" | "within_sight" }).level) > 0,
        };
      });
    }
    return saved;
  }
  afterEach(() => window.sessionStorage.clear());

  it("restores a supported same-version legacy save without losing its changed clock or records", () => {
    const legacy = legacyPayload();
    expect(isValidStoredWardFlowState(legacy.state)).toBe(false);
    expect(isValidStoredWardFlowState(migrateStoredWardFlowState(legacy.state, legacy.version))).toBe(true);
    const result = tryReadDemoState(dayZero, savedAt + 1, JSON.stringify(legacy));
    expect(result.saved?.state.clockOffsetMinutes).toBe(17);
    expect(result.saved?.state.movements).toHaveLength(legacy.state.movements.length);
    expect(result.saved?.state.admissions).toHaveLength(legacy.state.admissions.length);
    for (const row of [...result.saved!.state.movements, ...result.saved!.state.admissions]) {
      expect("specialling" in row).toBe(false);
      expect(["general", "within_sight"]).toContain(row.observation.level);
    }
  });
  it("continues to restore a current valid save", () => {
    const result = tryReadDemoState(dayZero, savedAt + 1, JSON.stringify(payload()));
    expect(result.saved?.state.clockOffsetMinutes).toBe(17);
  });
  it("continues to reject unsupported versions", () => {
    const result = tryReadDemoState(dayZero, savedAt + 1, JSON.stringify({ ...legacyPayload(), version: 999 }));
    expect(result.saved).toBeUndefined();
    expect(result.recoveryNotice).toContain("could not be restored safely");
  });
  it("does not invent an observation when the legacy value is malformed", () => {
    const saved = legacyPayload();
    saved.state.movements[0].specialling = "not-a-boolean";
    const result = tryReadDemoState(dayZero, savedAt + 1, JSON.stringify(saved));
    expect(result.saved).toBeUndefined();
    expect(result.recoveryNotice).toContain("could not be restored safely");
  });
});
