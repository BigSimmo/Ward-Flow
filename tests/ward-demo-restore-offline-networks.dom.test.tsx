import { afterEach, describe, expect, it, vi } from "vitest";

// CodeRabbit on #870: a failed demonstration-network load must not hold back a standard save's
// restore. A demonstration save still reads as unavailable storage, so it is not overwritten.
afterEach(() => {
  vi.doUnmock("@/components/ward-management/ward-scenario-network-loader");
  vi.resetModules();
  window.sessionStorage.clear();
});

async function offlineStorage() {
  vi.resetModules();
  vi.doMock("@/components/ward-management/ward-scenario-network-loader", () => ({
    loadScenarioNetworks: () => Promise.reject(new Error("offline")),
  }));
  const storage = await import("@/components/ward-management/ward-flow-demo-storage");
  const { seedWardFlowState } = await import("@/components/ward-management/ward-flow-reducer");
  const { NOW_ANCHOR } = await import("@/components/ward-management/ward-sites");
  return { storage, seedWardFlowState, NOW_ANCHOR };
}

describe("restoring a save while the demonstration networks cannot load", () => {
  const dayZero = new Date("2026-10-16T00:00:00Z");
  const savedAt = Date.parse("2026-10-16T10:00:00Z") / 60_000;

  it("still restores a standard save", async () => {
    const { storage, seedWardFlowState, NOW_ANCHOR } = await offlineStorage();
    expect(storage.tryWriteDemoState(seedWardFlowState(), dayZero, NOW_ANCHOR, savedAt)).toBe(true);
    const read = await storage.readDemoStateLater(dayZero, savedAt + 30);
    expect(read.saved?.now).toBe(NOW_ANCHOR);
  });

  it("does not restore a demonstration save, and calls the storage unavailable", async () => {
    const { storage, seedWardFlowState, NOW_ANCHOR } = await offlineStorage();
    expect(storage.tryWriteDemoState(seedWardFlowState(), dayZero, NOW_ANCHOR, savedAt)).toBe(true);
    const raw = JSON.parse(window.sessionStorage.getItem(storage.WARD_FLOW_DEMO_STORAGE_KEY)!);
    raw.state.scenario = "quiet-day";
    const read = await storage.readDemoStateLater(dayZero, savedAt + 30, JSON.stringify(raw));
    expect(read.saved).toBeUndefined();
    expect(read.recoveryNotice).toBe(storage.STORAGE_UNAVAILABLE);
  });
});
