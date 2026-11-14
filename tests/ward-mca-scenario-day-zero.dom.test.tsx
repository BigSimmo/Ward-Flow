// CC-4 (mechanics and clock audit, 14 Nov 2026): a saved scenario file records its day 0. Loaded on a
// later day, its timed records replay on the new day (they are minutes from day 0), and its typed
// calendar days (tribunal hearing, care plan dates) now move by the same whole days, so the two stay
// in step. Dates of birth stay as written. A file saved before CC-4 has no day 0 and loads as before.
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import {
  buildScenarioFile,
  readScenarioFile,
  scenarioOnBoardDay,
} from "@/components/ward-management/ward-flow-scenario-file";
import { demoDayZero } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Patient } from "@/components/ward-management/ward-patients";

const STATE_VERSION = 5;
const NOV_10 = new Date("2026-11-10T02:00:00Z"); // 10:00 Perth
const NOV_14 = new Date("2026-11-14T02:00:00Z"); // four days later

function typedDays(patients: readonly Patient[]) {
  const pt002 = patients.find((patient) => patient.id === "PT-002")!;
  const pt036 = patients.find((patient) => patient.id === "PT-036")!;
  return {
    hearing: pt002.tribunalHearing?.date,
    plans: pt036.carePlans?.map((plan) => [plan.agreedOn, plan.reviewOn]),
    dateOfBirth: pt002.dateOfBirth,
  };
}

beforeEach(() => {
  window.sessionStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.useRealTimers();
});

describe("a scenario file keeps its timed records and typed days in step on a later day", () => {
  let current: ReturnType<typeof useWardFlow> | undefined;
  function Capture() {
    current = useWardFlow();
    return null;
  }
  beforeEach(() => {
    current = undefined;
  });

  it("saves day 0, and a load four days later moves the typed days four days", async () => {
    vi.setSystemTime(NOV_10);
    render(
      <WardFlowProvider>
        <Capture />
      </WardFlowProvider>,
    );
    const saved = typedDays(current!.patients);
    expect(saved.hearing).toBe("2026-11-05");
    const savedNow = current!.now;
    const built = await current!.saveScenarioFile!();
    if (!built.ok) throw new Error(built.reason);
    expect(JSON.parse(built.json).dayZero).toBe(demoDayZero(NOV_10).toISOString());
    cleanup();

    vi.setSystemTime(NOV_14);
    render(
      <WardFlowProvider>
        <Capture />
      </WardFlowProvider>,
    );
    await act(async () => {
      expect(await current!.loadScenarioFile!(built.json)).toEqual({ ok: true });
    });
    // Timed records: the same minutes from day 0, so the same time of day on the new day.
    expect(current!.now).toBe(savedNow);
    expect(current!.dayZero.toISOString()).toBe(demoDayZero(NOV_14).toISOString());
    // Typed days: moved by the same four days.
    const loaded = typedDays(current!.patients);
    expect(loaded.hearing).toBe("2026-11-09");
    expect(loaded.plans).toEqual([
      ["2026-03-17", "2026-09-17"],
      ["2026-10-11", "2027-01-11"],
    ]);
    expect(loaded.dateOfBirth).toBe(saved.dateOfBirth);
  });

  it("loads a file saved before CC-4 (no day 0) exactly as it was", async () => {
    vi.setSystemTime(NOV_10);
    render(
      <WardFlowProvider>
        <Capture />
      </WardFlowProvider>,
    );
    const built = await current!.saveScenarioFile!();
    if (!built.ok) throw new Error(built.reason);
    const older = JSON.parse(built.json) as Record<string, unknown>;
    delete older.dayZero;
    const olderJson = JSON.stringify(older);
    cleanup();

    vi.setSystemTime(NOV_14);
    render(
      <WardFlowProvider>
        <Capture />
      </WardFlowProvider>,
    );
    await act(async () => {
      expect(await current!.loadScenarioFile!(olderJson)).toEqual({ ok: true });
    });
    expect(typedDays(current!.patients).hearing).toBe("2026-11-05");
  });
});

describe("the file's day 0", () => {
  const state = seedWardFlowStateAt(0, "standard", { dayZero: demoDayZero(NOV_10) });

  it("is read back, and moving onto the same day changes nothing", () => {
    const built = buildScenarioFile(state, NOW_ANCHOR, STATE_VERSION, NOV_10, demoDayZero(NOV_10));
    if (!built.ok) throw new Error(built.reason);
    const read = readScenarioFile(built.json, STATE_VERSION);
    if (!read.ok) throw new Error(read.reason);
    expect(read.dayZero?.toISOString()).toBe(demoDayZero(NOV_10).toISOString());
    expect(scenarioOnBoardDay(read, demoDayZero(NOV_10))).toBe(read.state);
    expect(typedDays(scenarioOnBoardDay(read, demoDayZero(NOV_14)).patients).hearing).toBe("2026-11-09");
    // Built without a day 0 (as before CC-4): no field, and nothing moves.
    const older = buildScenarioFile(state, NOW_ANCHOR, STATE_VERSION, NOV_10);
    if (!older.ok) throw new Error(older.reason);
    expect(JSON.parse(older.json)).not.toHaveProperty("dayZero");
    const olderRead = readScenarioFile(older.json, STATE_VERSION);
    if (!olderRead.ok) throw new Error(olderRead.reason);
    expect(scenarioOnBoardDay(olderRead, demoDayZero(NOV_14))).toBe(olderRead.state);
  });

  it("refuses a file whose day 0 is not a date", () => {
    const built = buildScenarioFile(state, NOW_ANCHOR, STATE_VERSION, NOV_10, demoDayZero(NOV_10));
    if (!built.ok) throw new Error(built.reason);
    for (const dayZero of ["not a date", 12]) {
      const damaged = JSON.stringify({ ...JSON.parse(built.json), dayZero });
      expect(readScenarioFile(damaged, STATE_VERSION)).toEqual({
        ok: false,
        reason: "This scenario file is damaged or incomplete, so nothing was loaded.",
      });
    }
  });
});
