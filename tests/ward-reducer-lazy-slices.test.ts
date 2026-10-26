import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const WARD = path.join(process.cwd(), "src/components/ward-management");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("lazily loaded reducer slices", () => {
  it("refuses to run a slice before it loads, and runs it after", async () => {
    vi.resetModules();
    const registry = await import("@/components/ward-management/ward-flow-reducer-slice-registry");
    const { seedWardFlowState, wardFlowReducer } = await import("@/components/ward-management/ward-flow-reducer");
    const { loadReducerSlices } = await import("@/components/ward-management/ward-flow-slice-dispatch");
    expect(registry.reducerSlicesLoaded()).toBe(false);
    // Seeding and the reducer's own cases need no slice.
    const state = seedWardFlowState();
    const advanced = wardFlowReducer(state, { type: "ADVANCE_CLOCK", role: "demo", now: 0, minutes: 5 });
    expect(advanced.clockOffsetMinutes).toBe(state.clockOffsetMinutes + 5);
    const opened = {
      type: "MARK_REFERRAL_OPENED",
      role: "ward",
      now: 0,
      referralId: "RF-none",
      unitId: "none",
      actingUnitId: "none",
    } as const;
    expect(() => wardFlowReducer(state, opened)).toThrow("not loaded");
    await loadReducerSlices();
    expect(registry.reducerSlicesLoaded()).toBe(true);
    expect(() => wardFlowReducer(state, opened)).not.toThrow();
  });

  it("keeps every slice out of page code's static imports", () => {
    const slicesFile = readFileSync(path.join(WARD, "ward-flow-reducer-slices.ts"), "utf8");
    const slices = [...slicesFile.matchAll(/from "\.\/([\w/-]+)"/g)]
      .map((match) => match[1])
      .filter((name) => name !== "ward-flow-reducer-slice-registry");
    expect(slices.length).toBeGreaterThan(15);
    const sliceFiles = new Set(slices.map((name) => path.join(WARD, `${name}.ts`)));
    const offenders: string[] = [];
    for (const file of sourceFiles(path.join(process.cwd(), "src"))) {
      if (sliceFiles.has(file) || file.endsWith("ward-flow-reducer-slices.ts")) continue;
      const text = readFileSync(file, "utf8");
      for (const name of [...slices, "ward-flow-reducer-slices"]) {
        const base = name.split("/").at(-1);
        const pattern = new RegExp(`^import (?!type )[^;]*?from "[^"]*/${base}";`, "ms");
        if (pattern.test(text)) offenders.push(`${path.relative(process.cwd(), file)} -> ${base}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
