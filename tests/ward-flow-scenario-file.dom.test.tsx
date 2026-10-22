import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WardDemoPanel } from "@/components/ward-management/tools/ward-demo-panel";
import {
  WARD_FLOW_DEMO_STORAGE_KEY,
  WardFlowProvider,
  useWardFlow,
} from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import {
  WARD_FLOW_SCENARIO_FILE_FORMAT,
  buildScenarioFile,
  readScenarioFile,
} from "@/components/ward-management/ward-flow-scenario-file";
import { TYPED_TEXT_NOT_KEPT } from "@/components/ward-management/ward-flow-typed-text-ledger";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Demo scenario files (Josh, 4 October 2026): Save writes the synthetic world to a downloaded file,
 * Load replaces the world from one. D-18 still holds: typed text never reaches browser storage. Since
 * 21 Oct 2026 (Josh, fix plan item 2) a loaded world is saved with every typed field replaced, so it
 * survives a refresh, unless it holds typed text the restore fence cannot hold as a placeholder.
 */
describe("demo scenario save and load", () => {
  const FIXED_SYSTEM_TIME = new Date(2026, 8, 17, 10, 42, 0);
  // The browser-storage shape version the provider passes to the file module.
  const STATE_VERSION = 5;

  let current: ReturnType<typeof useWardFlow> | undefined;
  function Capture() {
    current = useWardFlow();
    return null;
  }

  function addTypedPatient() {
    act(() => {
      current!.dispatch({
        type: "ADD_PATIENT",
        role: "coordinator",
        now: current!.now,
        umrn: "UMRN-TEST-001",
        givenName: "Josephine",
        familyName: "Typiste",
        dateOfBirth: "1990-01-01",
      });
    });
  }

  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_SYSTEM_TIME);
    current = undefined;
  });

  afterEach(() => {
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it("round-trips typed work and the scenario clock, and keeps a loaded typed patient out of browser storage", async () => {
    render(
      <WardFlowProvider>
        <Capture />
      </WardFlowProvider>,
    );
    // The saved-session read loads on demand; browser saving starts once its answer is adopted.
    await act(async () => {
      await import("@/components/ward-management/ward-flow-demo-restore");
    });
    act(() => {
      current!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current!.now, minutes: 75 });
    });
    addTypedPatient();
    const savedNow = current!.now;
    const built = await current!.saveScenarioFile!();
    if (!built.ok) throw new Error(built.reason);
    expect(built.fileName).toMatch(/^ward-flow-scenario-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);

    act(() => current!.resetDemoState());
    expect(current!.patients.some((patient) => patient.givenName === "Josephine")).toBe(false);
    // The reseed re-enabled browser saving, which proves the next assertion is the load's doing.
    expect(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).not.toBeNull();
    const generationBefore = current!.worldGeneration;

    let result: Awaited<ReturnType<NonNullable<NonNullable<typeof current>["loadScenarioFile"]>>> | undefined;
    await act(async () => {
      result = await current!.loadScenarioFile!(built.json);
    });
    expect(result).toEqual({ ok: true });
    expect(current!.patients.some((patient) => patient.givenName === "Josephine")).toBe(true);
    expect(current!.now).toBe(savedNow);
    expect(current!.worldGeneration).toBeGreaterThan(generationBefore);
    expect(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).toBeNull();

    // A typed date of birth cannot become the placeholder and still pass the restore fence, so this
    // loaded world stays unsaved, and a later safe event does not resurrect saving for it.
    act(() => {
      current!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current!.now, minutes: 5 });
    });
    expect(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).toBeNull();
    expect(current!.savingOnDevice).toBe(false);
  });

  it("keeps a loaded scenario through a refresh, with its typed text replaced", async () => {
    const TYPED = "Synthetic scenario blocker words 51ad";
    const { unmount } = render(
      <WardFlowProvider>
        <Capture />
      </WardFlowProvider>,
    );
    const movement = current!.movements.find((candidate) => !candidate.closure)!;
    act(() => {
      current!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current!.now, minutes: 75 });
    });
    act(() => {
      current!.dispatch({
        type: "RECORD_MOVEMENT_BLOCKER",
        role: "coordinator",
        now: current!.now,
        movementId: movement.id,
        blocker: TYPED,
      });
    });
    const savedNow = current!.now;
    const built = await current!.saveScenarioFile!();
    if (!built.ok) throw new Error(built.reason);
    act(() => current!.resetDemoState());

    await act(async () => {
      await current!.loadScenarioFile!(built.json);
    });
    const loadedGeneration = current!.worldGeneration;
    expect(current!.movements.find((candidate) => candidate.id === movement.id)?.blocker).toBe(TYPED);
    const raw = window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(raw).not.toContain(TYPED);
    expect(current!.savingOnDevice).toBe(true);

    unmount();
    render(
      <WardFlowProvider>
        <Capture />
      </WardFlowProvider>,
    );
    expect(current!.worldGeneration).toBe(loadedGeneration);
    expect(current!.now).toBe(savedNow);
    expect(current!.movements.find((candidate) => candidate.id === movement.id)?.blocker).toBe(TYPED_TEXT_NOT_KEPT);
  });

  it("never saves refusal records into the file", () => {
    const state = seedWardFlowStateAt(0);
    const built = buildScenarioFile(
      {
        ...state,
        rejections: [{ id: "R-1", attempted: "ADVANCE_CLOCK", reason: "quoted id", at: NOW_ANCHOR }],
      } as never,
      NOW_ANCHOR,
      STATE_VERSION,
      FIXED_SYSTEM_TIME,
    );
    if (!built.ok) throw new Error(built.reason);
    expect(JSON.parse(built.json).state.rejections).toEqual([]);
  });

  it("refuses to save a world holding a repatriation rather than dropping it silently", () => {
    const state = seedWardFlowStateAt(0);
    const built = buildScenarioFile(
      { ...state, repatriations: [{}] } as never,
      NOW_ANCHOR,
      STATE_VERSION,
      FIXED_SYSTEM_TIME,
    );
    expect(built.ok).toBe(false);
  });

  it("refuses files that are not a clean scenario of this version, without quoting their content", () => {
    const built = buildScenarioFile(seedWardFlowStateAt(0), NOW_ANCHOR, STATE_VERSION, FIXED_SYSTEM_TIME);
    if (!built.ok) throw new Error(built.reason);
    const good = JSON.parse(built.json);
    const cases = [
      "not json at all",
      JSON.stringify({ ...good, format: "something-else" }),
      JSON.stringify({ ...good, stateVersion: STATE_VERSION - 1 }),
      JSON.stringify({ ...good, now: "later" }),
      JSON.stringify({ ...good, state: { ...good.state, rejections: [{ id: "SECRET-ID" }] } }),
      JSON.stringify({ ...good, state: { ...good.state, units: "SECRET-ID" } }),
    ];
    for (const text of cases) {
      const read = readScenarioFile(text, STATE_VERSION);
      expect(read.ok).toBe(false);
      if (!read.ok) expect(read.reason).not.toContain("SECRET-ID");
    }
    expect(readScenarioFile(built.json, STATE_VERSION).ok).toBe(true);
    expect(good.format).toBe(WARD_FLOW_SCENARIO_FILE_FORMAT);
  });

  it("loads a v6 world into this v7 build through the same migration as a browser restore", () => {
    const built = buildScenarioFile(seedWardFlowStateAt(0), NOW_ANCHOR, 7, FIXED_SYSTEM_TIME);
    if (!built.ok) throw new Error(built.reason);
    const file = JSON.parse(built.json);
    const v6State = { ...file.state };
    delete v6State.plannedAdmissions;
    delete v6State.plannedAdmissionSequence;
    const read = readScenarioFile(JSON.stringify({ ...file, stateVersion: 6, state: v6State }), 7);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.state.plannedAdmissions).toEqual([]);
    expect(read.state.plannedAdmissionSequence).toBe(0);
    expect(read.state.movements).toEqual(v6State.movements);
    expect(read.state.admissions).toEqual(v6State.admissions);
    // Only into the version this build writes, and only from v6.
    expect(readScenarioFile(JSON.stringify({ ...file, stateVersion: 5, state: v6State }), 7).ok).toBe(false);
  });

  it("offers Save and Load in the Tools demo panel and reports the outcome", async () => {
    const createObjectURL = vi.fn(() => "blob:scenario");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    const { container } = render(
      <WardFlowProvider>
        <Capture />
        <WardDemoPanel />
      </WardFlowProvider>,
    );
    const message = () => container.querySelector('[data-testid="ward-tools-demo-panel"] > [role="status"]');
    addTypedPatient();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save to file" }));
    });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(message()).toHaveTextContent(/^Download requested: ward-flow-scenario-.*Check your browser downloads\.$/);
    const built = await current!.saveScenarioFile!();
    if (!built.ok) throw new Error(built.reason);

    // DA-10: Reset demo asks first; the reset happens on the dialog's own Reset demo button.
    fireEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Reset the demo?" })).getByRole("button", { name: "Reset demo" }),
    );
    expect(current!.patients.some((patient) => patient.givenName === "Josephine")).toBe(false);

    vi.useRealTimers();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([built.json], "scenario.json", { type: "application/json" });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    await waitFor(() => expect(message()).toHaveTextContent(/Scenario loaded/));
    expect(current!.patients.some((patient) => patient.givenName === "Josephine")).toBe(true);

    const bad = new File(["{}"], "notes.json", { type: "application/json" });
    await act(async () => {
      fireEvent.change(input, { target: { files: [bad] } });
    });
    await waitFor(() => expect(message()).toHaveTextContent("This file is not a Ward Flow demo scenario."));
    clickSpy.mockRestore();
  });
});
