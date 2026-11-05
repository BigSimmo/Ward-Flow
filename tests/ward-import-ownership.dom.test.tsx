import { useLayoutEffect } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardDemoPanel } from "@/components/ward-management/tools/ward-demo-panel";
import { buildScenarioFile, readScenarioFile } from "@/components/ward-management/ward-flow-scenario-file";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { wardFlowContainerReducer, fixtureWorlds } from "@/components/ward-management/ward-flow-provider-container";
import { deviceCopyFromEvents } from "@/components/ward-management/ward-flow-typed-text-scrub";
import { WARD_FLOW_STORED_STATE_VERSION } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

let current: ReturnType<typeof useWardFlow>;
function Capture() {
  const value = useWardFlow();
  useLayoutEffect(() => {
    current = value;
  });
  return null;
}
function file(generation = 0) {
  const built = buildScenarioFile(
    { ...seedWardFlowStateAt(0), worldGeneration: generation },
    NOW_ANCHOR,
    WARD_FLOW_STORED_STATE_VERSION,
    new Date("2026-11-04T00:00:00Z"),
  );
  if (!built.ok) throw new Error(built.reason);
  return built.json;
}
function mount() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Capture />
      <WardDemoPanel />
    </WardFlowProvider>,
  );
}
afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("scenario replacement ownership", () => {
  it("rejects a parsing continuation after a newer local command, preserving that work", async () => {
    mount();
    let result: Awaited<ReturnType<NonNullable<typeof current.loadScenarioFile>>>;
    await act(async () => {
      const loading = current.loadScenarioFile!(file(10));
      current.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current.now, minutes: 15 });
      result = await loading;
    });
    expect(result!.ok).toBe(false);
    expect(current.now).toBe(NOW_ANCHOR + 15);
    expect(current.worldGeneration).not.toBe(11);
  });

  it("lets only the latest concurrent provider import replace the world", async () => {
    mount();
    let first: Awaited<ReturnType<NonNullable<typeof current.loadScenarioFile>>>;
    let second: typeof first;
    await act(async () => {
      [first, second] = await Promise.all([current.loadScenarioFile!(file(10)), current.loadScenarioFile!(file(20))]);
    });
    expect(first!.ok).toBe(false);
    expect(second!).toEqual({ ok: true });
    expect(current.worldGeneration).toBe(21);
  });

  it("discards a late file read after a reset", async () => {
    const { container } = mount();
    let finish!: (text: string) => void;
    const reading = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const input = container.querySelector('input[type="file"]')!;
    act(() => fireEvent.change(input, { target: { files: [{ text: () => reading }] } }));
    act(() => current.resetDemoState());
    const generation = current.worldGeneration;
    await act(async () => {
      finish(file(10));
      await reading;
    });
    expect(current.worldGeneration).toBe(generation);
  });

  it("keeps same-generation local work made while a file is still being read", async () => {
    const { container } = mount();
    let finish!: (text: string) => void;
    const reading = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const input = container.querySelector('input[type="file"]')!;
    act(() => fireEvent.change(input, { target: { files: [{ text: () => reading }] } }));
    const generation = current.worldGeneration;
    act(() => current.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current.now, minutes: 15 }));
    await act(async () => {
      finish(file(10));
      await reading;
    });
    expect(current.worldGeneration).toBe(generation);
    expect(current.now).toBe(NOW_ANCHOR + 15);
  });

  it("discards file A when file B was selected before A finished reading", async () => {
    const { container } = mount();
    let finish!: (text: string) => void;
    const reading = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const input = container.querySelector('input[type="file"]')!;
    act(() => fireEvent.change(input, { target: { files: [{ text: () => reading }] } }));
    await act(async () => {
      fireEvent.change(input, { target: { files: [{ text: async () => file(20) }] } });
    });
    await act(async () => {
      finish(file(10));
      await reading;
    });
    expect(current.worldGeneration).toBe(21);
  });

  it("retires outgoing typed-text metadata and validates the incoming save/restore round trip", () => {
    const parsed = readScenarioFile(file(), WARD_FLOW_STORED_STATE_VERSION);
    if (!parsed.ok) throw new Error(parsed.reason);
    const incoming = parsed.state;
    const outgoing = {
      world: seedWardFlowStateAt(0),
      typedTextSeen: true,
      restoredElapsed: 0,
      typedTextEvents: incoming.patients.slice(0, 2).map((patient) => ({
        type: "RECORD_ESCALATION" as const,
        role: "coordinator" as const,
        now: NOW_ANCHOR,
        movementId: incoming.movements[0].id,
        triedUnitIds: [],
        contact: patient.id,
      })),
    };
    const loaded = wardFlowContainerReducer(outgoing, {
      type: "LOAD_SCENARIO_FILE_INTERNAL",
      world: incoming,
      restoredElapsed: 0,
    });
    expect(loaded.typedTextFromFile).toBe(true);
    expect(loaded.typedTextEvents).toBeUndefined();
    const copy = deviceCopyFromEvents(
      loaded.world,
      loaded.typedTextEvents ?? [],
      fixtureWorlds,
      loaded.typedTextFromFile,
    );
    expect(copy).not.toBeNull();
    const saved = buildScenarioFile(
      copy!,
      NOW_ANCHOR,
      WARD_FLOW_STORED_STATE_VERSION,
      new Date("2026-11-04T00:00:00Z"),
    );
    if (!saved.ok) throw new Error(saved.reason);
    const restored = readScenarioFile(saved.json, WARD_FLOW_STORED_STATE_VERSION);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.state.patients.map((patient) => patient.id)).toEqual(
      incoming.patients.map((patient) => patient.id),
    );
    expect(new Set(restored.state.patients.map((patient) => patient.id)).size).toBe(incoming.patients.length);
  });
});
