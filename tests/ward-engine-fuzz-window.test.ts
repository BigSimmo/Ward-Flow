import { describe, expect, it } from "vitest";
import { engineFuzzEnvironment, engineFuzzWindow } from "../scripts/ward-flow/engine-fuzz-window.mjs";

describe("bounded nightly engine seed windows", () => {
  it("reproduces a UTC date and moves to a disjoint window the next day", () => {
    const today = engineFuzzWindow("2026-10-20");
    expect(engineFuzzWindow("2026-10-20")).toEqual(today);
    const tomorrow = engineFuzzWindow("2026-10-21");
    expect(tomorrow.firstSeed).toBe(today.lastSeed + 1);
    expect(today.eventBudget).toBe(1600);
    expect(today.sequences).toBe(16);
    expect(today.steps).toBe(100);
    expect(engineFuzzEnvironment(today)).toEqual({
      WARD_ENGINE_FUZZ_FIRST_SEED: String(today.firstSeed),
      WARD_ENGINE_FUZZ_SEQUENCES: "16",
      WARD_ENGINE_FUZZ_STEPS: "100",
    });
  });

  it("keeps windows within distinct positive 32-bit seeds even across the epoch", () => {
    for (const date of ["1969-12-31", "1970-01-01", "9999-12-31"]) {
      const window = engineFuzzWindow(date);
      expect(window.firstSeed).toBeGreaterThan(0);
      expect(window.lastSeed).toBeLessThan(2 ** 32);
      expect(window.lastSeed - window.firstSeed).toBe(15);
    }
  });

  it.each(["2026-02-30", "invalid", "2026-1-1", "2026-10-20\nWARD_ENGINE_FUZZ_STEPS=999"])(
    "refuses invalid date %s",
    (date) => {
      expect(() => engineFuzzWindow(date)).toThrow("valid UTC date");
    },
  );
});
