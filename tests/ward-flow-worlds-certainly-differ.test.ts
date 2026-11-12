import { describe, expect, it } from "vitest";

import { worldsCertainlyDiffer } from "@/components/ward-management/ward-flow-open-tabs-day";

// Review finding 13 (12 Nov 2026): a tab skips encoding two whole worlds only when a top-level field
// proves their JSON differs. Anything it cannot prove falls back to the full comparison.
describe("worldsCertainlyDiffer", () => {
  const world = { worldGeneration: 2, auditSequence: 5, auditEvents: [{ id: "a" }], label: "x", flag: true };

  it("is true when a counter, string, boolean or list length differs", () => {
    expect(worldsCertainlyDiffer(world, { ...world, auditSequence: 6 })).toBe(true);
    expect(worldsCertainlyDiffer(world, { ...world, label: "y" })).toBe(true);
    expect(worldsCertainlyDiffer(world, { ...world, flag: false })).toBe(true);
    expect(worldsCertainlyDiffer(world, { ...world, auditEvents: [] })).toBe(true);
  });

  it("is false when it cannot tell, so the whole JSON is still compared", () => {
    expect(worldsCertainlyDiffer(world, { ...world, auditEvents: [{ id: "b" }] })).toBe(false);
    expect(worldsCertainlyDiffer(world, structuredClone(world))).toBe(false);
    expect(worldsCertainlyDiffer({ n: Number.NaN }, { n: null })).toBe(false);
    expect(worldsCertainlyDiffer({ n: 1 }, {})).toBe(false);
    expect(worldsCertainlyDiffer({ rejections: [1] }, { rejections: [] })).toBe(false);
    expect(worldsCertainlyDiffer(null, world)).toBe(false);
  });
});
