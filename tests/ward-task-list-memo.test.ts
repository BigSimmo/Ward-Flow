import { describe, expect, it, vi } from "vitest";

// Production audit PERF-02 / H-0340: the shared task list is built once per caller shape.
const taskItemsSpy = vi.hoisted(() => ({ sources: [] as unknown[] }));
vi.mock("@/components/ward-management/ward-act-now-items", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-act-now-items")>();
  return {
    ...actual,
    taskItems: (...args: Parameters<typeof actual.taskItems>) => {
      taskItemsSpy.sources.push(args[0]);
      return actual.taskItems(...args);
    },
  };
});

import { rememberLastCall } from "@/components/ward-management/ward-last-call";
import { shellFigures } from "@/components/ward-management/shell/ward-facade";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardSites } from "@/components/ward-management/ward-sites";

describe("rememberLastCall slots", () => {
  it("keeps several answers so callers with different inputs do not evict each other", () => {
    const derive = vi.fn((input: { n: number }) => ({ doubled: input.n * 2 }));
    const remembered = rememberLastCall(derive, (input: { n: number }) => [input], 2);
    const a = { n: 1 };
    const b = { n: 2 };
    const first = remembered(a);
    expect(remembered(b)).toEqual({ doubled: 4 });
    expect(remembered(a)).toBe(first);
    expect(remembered(b)).toEqual({ doubled: 4 });
    expect(derive).toHaveBeenCalledTimes(2);
    // A third input evicts the least recently used one (a); the most recent (b) stays.
    remembered({ n: 3 });
    remembered(b);
    expect(derive).toHaveBeenCalledTimes(3);
    remembered(a);
    expect(derive).toHaveBeenCalledTimes(4);
  });
});

describe("shell figures reuse the shared task list", () => {
  it("passes the held leave list, not a fresh copy that misses the memo", () => {
    const state = seedWardFlowState();
    const input = {
      movements: state.movements,
      units: state.units,
      referrals: state.referrals,
      bedReleases: state.bedReleases,
      leaveBeds: state.leaveBeds,
      now: 0,
      thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
      sites: wardSites,
    };
    taskItemsSpy.sources.length = 0;
    shellFigures(input);
    shellFigures(input);
    expect(taskItemsSpy.sources).toHaveLength(2);
    for (const source of taskItemsSpy.sources)
      expect((source as { leaveBeds: unknown }).leaveBeds).toBe(state.leaveBeds);
  });
});
