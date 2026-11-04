import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WardDemoPanel } from "@/components/ward-management/tools/ward-demo-panel";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { readScenarioFileLater } from "@/components/ward-management/ward-flow-demo-storage";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import {
  buildScenarioFile,
  readScenarioFile,
  type ScenarioFileRead,
} from "@/components/ward-management/ward-flow-scenario-file";
import { referralDraftMemory } from "@/components/ward-management/referrals/referral-draft-lifecycle";
import { WARD_FLOW_STORED_STATE_VERSION } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("@/components/ward-management/ward-flow-demo-storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-demo-storage")>();
  return { ...actual, readScenarioFileLater: vi.fn() };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

function scenario(generation: number) {
  const built = buildScenarioFile(
    { ...seedWardFlowStateAt(0), worldGeneration: generation },
    NOW_ANCHOR,
    WARD_FLOW_STORED_STATE_VERSION,
    new Date("2026-11-04T00:00:00Z"),
  );
  if (!built.ok) throw new Error(built.reason);
  return built.json;
}

function read(text: string) {
  return readScenarioFile(text, WARD_FLOW_STORED_STATE_VERSION);
}

describe("scenario import intent ownership", () => {
  let current: ReturnType<typeof useWardFlow>;
  function Capture() {
    current = useWardFlow();
    return null;
  }
  function mount(panel = false) {
    return render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Capture />
        {panel ? <WardDemoPanel /> : null}
      </WardFlowProvider>,
    );
  }
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.mocked(readScenarioFileLater).mockImplementation(async (text) => read(text));
  });
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.mocked(readScenarioFileLater).mockReset();
    referralDraftMemory.kept = null;
  });

  it("captures ownership before file reading, so an older read cannot replace a newer import", async () => {
    mount();
    const oldRead = deferred<string>();
    let oldResult!: ReturnType<NonNullable<typeof current.loadScenarioFile>>;
    act(() => {
      oldResult = current.loadScenarioFile!(() => oldRead.promise);
    });
    await act(async () => {
      await current.loadScenarioFile!(scenario(20));
    });
    const newer = current.movements;
    const generation = current.worldGeneration;
    await act(async () => {
      oldRead.resolve(scenario(10));
      await oldResult;
    });
    expect(current.worldGeneration).toBe(generation);
    expect(current.movements).toBe(newer);
    expect(readScenarioFileLater).toHaveBeenCalledTimes(1);
    expect(await oldResult).toMatchObject({ ok: false });
  });

  it("keeps the latest import when older validation completes afterwards", async () => {
    mount();
    const oldValidation = deferred<ScenarioFileRead>();
    vi.mocked(readScenarioFileLater).mockImplementationOnce(() => oldValidation.promise);
    let oldResult!: ReturnType<NonNullable<typeof current.loadScenarioFile>>;
    act(() => {
      oldResult = current.loadScenarioFile!(scenario(10));
    });
    await act(async () => {
      await current.loadScenarioFile!(scenario(20));
    });
    const newer = current.movements;
    const generation = current.worldGeneration;
    await act(async () => {
      oldValidation.resolve(read(scenario(10)));
      await oldResult;
    });
    expect(current.worldGeneration).toBe(generation);
    expect(current.movements).toBe(newer);
    expect(await oldResult).toMatchObject({ ok: false });
  });

  it.each(["resetDemoState", "RESET_SCENARIO", "SET_SCENARIO"] as const)(
    "invalidates an import waiting on validation when %s replaces the world",
    async (reset) => {
      mount();
      const oldValidation = deferred<ScenarioFileRead>();
      vi.mocked(readScenarioFileLater).mockImplementationOnce(() => oldValidation.promise);
      let oldResult!: ReturnType<NonNullable<typeof current.loadScenarioFile>>;
      act(() => {
        oldResult = current.loadScenarioFile!(scenario(10));
      });
      act(() => {
        if (reset === "resetDemoState") current.resetDemoState();
        else if (reset === "RESET_SCENARIO") current.dispatch({ type: reset, role: "demo", now: current.now });
        else current.dispatch({ type: reset, role: "demo", now: current.now, scenario: "scarce" });
      });
      const newer = current.movements;
      const generation = current.worldGeneration;
      await act(async () => {
        oldValidation.resolve(read(scenario(10)));
        await oldResult;
      });
      expect(current.worldGeneration).toBe(generation);
      expect(current.movements).toBe(newer);
      expect(await oldResult).toMatchObject({ ok: false });
    },
  );

  it("retires the outgoing provider before a late completion can clear the next owner's draft", async () => {
    const old = mount();
    const oldValidation = deferred<ScenarioFileRead>();
    vi.mocked(readScenarioFileLater).mockImplementationOnce(() => oldValidation.promise);
    let oldResult!: ReturnType<NonNullable<typeof current.loadScenarioFile>>;
    act(() => {
      oldResult = current.loadScenarioFile!(scenario(10));
    });
    old.unmount();
    mount();
    const draft = { synthetic: "next-owner-draft" };
    referralDraftMemory.kept = draft;
    const version = referralDraftMemory.sessionVersion;
    const newer = current.movements;
    await act(async () => {
      oldValidation.resolve(read(scenario(10)));
      await oldResult;
    });
    expect(current.movements).toBe(newer);
    expect(referralDraftMemory.kept).toBe(draft);
    expect(referralDraftMemory.sessionVersion).toBe(version);
    expect(await oldResult).toMatchObject({ ok: false });
  });

  it("lets a rejected newer file supersede an older pending read without changing the current board", async () => {
    mount();
    const initial = current.movements;
    const oldRead = deferred<string>();
    let oldResult!: ReturnType<NonNullable<typeof current.loadScenarioFile>>;
    act(() => {
      oldResult = current.loadScenarioFile!(() => oldRead.promise);
    });
    await act(async () => {
      expect(await current.loadScenarioFile!("{}")).toMatchObject({ ok: false });
    });
    await act(async () => {
      oldRead.resolve(scenario(10));
      await oldResult;
    });
    expect(current.movements).toBe(initial);
  });

  it("still adopts sequential valid imports and refuses unreadable sources without cleanup", async () => {
    mount();
    await act(async () => {
      expect(await current.loadScenarioFile!(scenario(2))).toMatchObject({ ok: true });
    });
    expect(current.worldGeneration).toBe(3);
    await act(async () => {
      expect(await current.loadScenarioFile!(scenario(4))).toMatchObject({ ok: true });
    });
    expect(current.worldGeneration).toBe(5);
    const before = current.movements;
    const version = referralDraftMemory.sessionVersion;
    await act(async () => {
      expect(await current.loadScenarioFile!(() => Promise.reject(new Error("synthetic read failure")))).toMatchObject({
        ok: false,
        reason: "That file could not be read, so nothing was loaded.",
      });
    });
    expect(current.movements).toBe(before);
    expect(referralDraftMemory.sessionVersion).toBe(version);
  });

  it("passes the deferred file read through the real panel and keeps the latest status", async () => {
    const view = mount(true);
    const input = view.container.querySelector('input[type="file"]')!;
    const oldRead = deferred<string>();
    const first = new File([], "first.json", { type: "application/json" });
    Object.defineProperty(first, "text", { value: () => oldRead.promise });
    const second = new File([], "second.json", { type: "application/json" });
    Object.defineProperty(second, "text", { value: async () => scenario(20) });
    fireEvent.change(input, { target: { files: [first] } });
    await act(async () => {
      fireEvent.change(input, { target: { files: [second] } });
    });
    const status = view.container.querySelector('footer [role="status"]');
    expect(status).toHaveTextContent("Scenario loaded.");
    const generation = current.worldGeneration;
    await act(async () => {
      oldRead.resolve(scenario(10));
    });
    expect(current.worldGeneration).toBe(generation);
    expect(status).toHaveTextContent("Scenario loaded.");
  });
});
