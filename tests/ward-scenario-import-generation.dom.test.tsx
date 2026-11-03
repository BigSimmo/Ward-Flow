import { act, render, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { buildScenarioFile, readScenarioFile } from "@/components/ward-management/ward-flow-scenario-file";
import { WARD_FLOW_STORED_STATE_VERSION } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("scenario import generation exhaustion", () => {
  let current: ReturnType<typeof useWardFlow>;
  function Capture() {
    current = useWardFlow();
    return null;
  }
  function scenario(generation: number) {
    const built = buildScenarioFile(
      { ...seedWardFlowStateAt(0), worldGeneration: generation },
      NOW_ANCHOR,
      WARD_FLOW_STORED_STATE_VERSION,
      new Date("2026-11-02T00:00:00Z"),
    );
    if (!built.ok) throw new Error(built.reason);
    expect(readScenarioFile(built.json, WARD_FLOW_STORED_STATE_VERSION).ok).toBe(true);
    return built.json;
  }
  function mount() {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Capture />
      </WardFlowProvider>,
    );
  }
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Outbound fetch forbidden in scratch reproduction"));
  });
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("refuses an otherwise valid maximum-generation file before changing the current world", async () => {
    mount();
    const beforeGeneration = current!.worldGeneration;
    const beforePatients = current!.patients;
    const beforeMovements = current!.movements;
    let result: Awaited<ReturnType<NonNullable<typeof current.loadScenarioFile>>>;
    await act(async () => {
      result = await current!.loadScenarioFile!(scenario(Number.MAX_SAFE_INTEGER));
    });
    expect(result!).toEqual({
      ok: false,
      reason: "This scenario file is damaged or incomplete, so nothing was loaded.",
    });
    expect(current!.worldGeneration).toBe(beforeGeneration);
    expect(current!.patients).toBe(beforePatients);
    expect(current!.movements).toBe(beforeMovements);
  });

  it("refuses replacement when the current world has exhausted its last safe generation", async () => {
    mount();
    let first: Awaited<ReturnType<NonNullable<typeof current.loadScenarioFile>>>;
    await act(async () => {
      first = await current!.loadScenarioFile!(scenario(Number.MAX_SAFE_INTEGER - 1));
    });
    expect(first!).toEqual({ ok: true });
    expect(current!.worldGeneration).toBe(Number.MAX_SAFE_INTEGER);
    const beforeMovements = current!.movements;
    let replacement: Awaited<ReturnType<NonNullable<typeof current.loadScenarioFile>>>;
    await act(async () => {
      replacement = await current!.loadScenarioFile!(scenario(0));
    });
    expect(replacement!).toEqual({
      ok: false,
      reason: "This scenario file is damaged or incomplete, so nothing was loaded.",
    });
    expect(current!.worldGeneration).toBe(Number.MAX_SAFE_INTEGER);
    expect(current!.movements).toBe(beforeMovements);
  });

  it("still loads an ordinary valid file and advances to a safe generation", async () => {
    mount();
    const before = current!.worldGeneration;
    let result: Awaited<ReturnType<NonNullable<typeof current.loadScenarioFile>>>;
    await act(async () => {
      result = await current!.loadScenarioFile!(scenario(4));
    });
    expect(result!).toEqual({ ok: true });
    expect(current!.worldGeneration).toBe(Math.max(before, 4) + 1);
    expect(Number.isSafeInteger(current!.worldGeneration)).toBe(true);
  });
});
