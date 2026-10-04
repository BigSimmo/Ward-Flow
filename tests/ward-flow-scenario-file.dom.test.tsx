import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WardDemoControls } from "@/components/ward-management/ward-demo-controls";
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
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Demo scenario files (Josh, 4 October 2026): Save writes the synthetic world to a downloaded file,
 * Load replaces the world from one. D-18 still holds — a loaded world never reaches browser storage.
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

  it("round-trips typed work and the scenario clock, and keeps the loaded world out of browser storage", () => {
    render(
      <WardFlowProvider>
        <Capture />
      </WardFlowProvider>,
    );
    act(() => {
      current!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current!.now, minutes: 75 });
    });
    addTypedPatient();
    const savedNow = current!.now;
    const built = current!.saveScenarioFile!();
    if (!built.ok) throw new Error(built.reason);
    expect(built.fileName).toMatch(/^ward-flow-scenario-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);

    act(() => current!.resetDemoState());
    expect(current!.patients.some((patient) => patient.givenName === "Josephine")).toBe(false);
    // The reseed re-enabled browser saving, which proves the next assertion is the load's doing.
    expect(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).not.toBeNull();
    const generationBefore = current!.worldGeneration;

    let result: ReturnType<NonNullable<typeof current>["loadScenarioFile"] & object> | undefined;
    act(() => {
      result = current!.loadScenarioFile!(built.json);
    });
    expect(result).toEqual({ ok: true });
    expect(current!.patients.some((patient) => patient.givenName === "Josephine")).toBe(true);
    expect(current!.now).toBe(savedNow);
    expect(current!.worldGeneration).toBeGreaterThan(generationBefore);
    expect(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).toBeNull();

    // A later safe event does not resurrect browser saving for the loaded world.
    act(() => {
      current!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current!.now, minutes: 5 });
    });
    expect(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).toBeNull();
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

  it("offers Save and Load in the demo menu and reports the outcome", async () => {
    const createObjectURL = vi.fn(() => "blob:scenario");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    render(
      <WardFlowProvider>
        <Capture />
        <WardDemoControls />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-demo-controls-trigger"));
    addTypedPatient();
    fireEvent.click(screen.getByTestId("ward-demo-save-file"));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("ward-demo-file-message")).toHaveTextContent(/^Saved ward-flow-scenario-/);
    const built = current!.saveScenarioFile!();
    if (!built.ok) throw new Error(built.reason);

    fireEvent.click(screen.getByTestId("ward-demo-reset"));
    expect(current!.patients.some((patient) => patient.givenName === "Josephine")).toBe(false);

    vi.useRealTimers();
    fireEvent.click(screen.getByTestId("ward-demo-controls-trigger"));
    const input = screen.getByTestId("ward-demo-load-file-input") as HTMLInputElement;
    const file = new File([built.json], "scenario.json", { type: "application/json" });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    await waitFor(() => expect(screen.getByTestId("ward-demo-file-message")).toHaveTextContent(/Scenario loaded/));
    expect(current!.patients.some((patient) => patient.givenName === "Josephine")).toBe(true);

    const bad = new File(["{}"], "notes.json", { type: "application/json" });
    await act(async () => {
      fireEvent.change(input, { target: { files: [bad] } });
    });
    await waitFor(() =>
      expect(screen.getByTestId("ward-demo-file-message")).toHaveTextContent(
        "This file is not a Ward Flow demo scenario.",
      ),
    );
    clickSpy.mockRestore();
  });
});
