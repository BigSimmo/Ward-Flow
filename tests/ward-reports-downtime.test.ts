import { afterEach, describe, expect, it, vi } from "vitest";

import {
  downtimePack,
  forgetDowntimePack,
  lastDowntimePack,
  rememberDowntimePack,
} from "@/components/ward-management/reports/downtime-pack";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { legalFormOrdered } from "@/components/ward-management/legal-forms/legal-forms-derivations";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Observation } from "@/components/ward-management/ward-observation";

function packFor(now = NOW_ANCHOR) {
  const state = seedWardFlowState();
  const pack = downtimePack({
    units: state.units,
    admissions: state.admissions,
    bedReleases: state.bedReleases,
    leaveBeds: state.leaveBeds,
    movements: state.movements,
    now,
    identify: () => "Synthetic person",
  });
  return { state, pack };
}

afterEach(() => {
  forgetDowntimePack();
  vi.unstubAllGlobals();
});

describe("downtimePack", () => {
  it("stamps the moment it was generated", () => {
    expect(packFor(NOW_ANCHOR + 17).pack.generatedAt).toBe(NOW_ANCHOR + 17);
  });

  it("lists every ward once with the live bed-state counts, and totals them", () => {
    const { state, pack } = packFor();
    expect(pack.wards).toHaveLength(state.units.length);
    for (const ward of pack.wards) {
      const unit = state.units.find((candidate) => candidate.id === ward.unitId)!;
      expect(ward.counts).toEqual(bedStates(unit, state.admissions, state.bedReleases, state.leaveBeds));
    }
    expect(pack.totals.beds).toBe(state.units.reduce((sum, unit) => sum + unit.beds, 0));
    expect(pack.totals.ready).toBe(pack.wards.reduce((sum, ward) => sum + ward.counts.ready, 0));
    expect(pack.totals.pendingPreparation).toBe(pack.wards.reduce((sum, ward) => sum + ward.pendingPreparation, 0));
    for (const ward of pack.wards) {
      expect(ward.pendingPreparation).toBe(ward.counts.beingMadeReady);
    }
  });

  it("keeps the ED queue to open movements still in the department, longest wait first per ED", () => {
    const { state, pack } = packFor();
    const open = new Set<string>(state.movements.filter(isOpen).map((movement) => movement.id));
    expect(pack.edQueue.length).toBeGreaterThan(0);
    for (const line of pack.edQueue) expect(open.has(line.movementId)).toBe(true);
    for (let index = 1; index < pack.edQueue.length; index += 1) {
      const [a, b] = [pack.edQueue[index - 1]!, pack.edQueue[index]!];
      if (a.ed === b.ed) expect(a.waitedMinutes).toBeGreaterThanOrEqual(b.waitedMinutes);
    }
    expect(pack.edQueue.every((line) => line.person === "Synthetic person")).toBe(true);
  });

  it("lists pending moves only for open, accepted movements", () => {
    const { state, pack } = packFor();
    const accepted = state.movements.filter((movement) => isOpen(movement) && movement.acceptedUnitId !== undefined);
    expect(pack.pendingMoves.map((line) => line.movementId).sort()).toEqual(accepted.map((m) => m.id).sort());
  });

  it.each<[{ level: Observation["level"]; intervalMinutes: number | null }, string]>([
    [{ level: "general", intervalMinutes: null }, "General, hourly"],
    [{ level: "intermittent", intervalMinutes: 15 }, "Intermittent, every 15 minutes"],
    [{ level: "intermittent", intervalMinutes: 30 }, "Intermittent, every 30 minutes"],
    [{ level: "within_sight", intervalMinutes: null }, "Constant within sight (1:1)"],
    [{ level: "arms_length", intervalMinutes: null }, "Constant within arm's length (1:1)"],
    [{ level: "two_staff", intervalMinutes: null }, "Two staff constant (2:1)"],
  ])("retains the recorded observation detail %j in ED and pending-move rows", (recorded, expected) => {
    const state = seedWardFlowState();
    const movement = {
      ...state.movements[0],
      stage: "pulled" as const,
      closure: undefined,
      leftDepartmentAt: undefined,
      acceptedUnitId: state.units[0].id,
      flaggedUrgent: true,
      observation: { ...recorded, reviewAt: NOW_ANCHOR + 30 },
    };
    const pack = downtimePack({ ...state, movements: [movement], now: NOW_ANCHOR, identify: () => "Synthetic person" });
    expect(pack.edQueue[0].observation).toBe(expected);
    expect(pack.pendingMoves[0].observation).toBe(expected);
    // A later change in the live record must not alter a pack already taken.
    movement.observation.level = recorded.level === "general" ? "two_staff" : "general";
    expect(pack.edQueue[0].observation).toBe(expected);
    expect(pack.pendingMoves[0].observation).toBe(expected);
  });

  it("carries legal forms with recorded or typed times only, in the legal forms screen's order", () => {
    const { state, pack } = packFor();
    const ordered = legalFormOrdered(state.movements, NOW_ANCHOR);
    expect(pack.legalForms.map((line) => line.movementId)).toEqual(ordered.map((movement) => movement.id));
    for (const line of pack.legalForms) {
      const movement = state.movements.find((candidate) => candidate.id === line.movementId)!;
      expect(line.typedExpiryAt).toBe(movement.legalForm?.dueAt ?? null);
      expect(line.madeAt).toBe(movement.formedAt ?? null);
    }
  });

  it("never holds a pack in the server process", () => {
    const { pack } = packFor();
    rememberDowntimePack(pack);
    expect(lastDowntimePack()).toBeNull();
  });

  it("remembers the last pack in browser memory only, until forgotten", () => {
    vi.stubGlobal("window", {});
    expect(lastDowntimePack()).toBeNull();
    const { pack } = packFor();
    rememberDowntimePack(pack);
    expect(lastDowntimePack()).toBe(pack);
    forgetDowntimePack();
    expect(lastDowntimePack()).toBeNull();
  });

  it("withholds another access context's pack synchronously, including before generation refresh", () => {
    vi.stubGlobal("window", {});
    const owner = { active: true };
    const narrower = { active: true };
    const { pack } = packFor();
    rememberDowntimePack(pack, 4, owner);
    expect(lastDowntimePack(owner, 4)).toBe(pack);
    expect(lastDowntimePack(narrower, 4)).toBeNull();
    expect(lastDowntimePack(owner, 5)).toBeNull();
    owner.active = false;
    expect(lastDowntimePack(owner, 4)).toBeNull();
    rememberDowntimePack(pack, 4, owner);
    expect(lastDowntimePack(owner, 4)).toBeNull();
  });

  it("forgets only the exiting context, preserving a new context's fresh snapshot", () => {
    vi.stubGlobal("window", {});
    const previous = { active: true };
    const current = { active: true };
    const { pack } = packFor();
    rememberDowntimePack(pack, 1, current);
    forgetDowntimePack(previous);
    expect(lastDowntimePack(current, 1)).toBe(pack);
    forgetDowntimePack(current);
    expect(lastDowntimePack(current, 1)).toBeNull();
  });
});

describe("downtime pack dates (device audit 11 Oct 2026)", () => {
  it("never lists an ED arrival after the pack's freeze time", async () => {
    const { pack } = packFor();
    for (const line of pack.edQueue) expect(line.openedAt).toBeLessThanOrEqual(pack.generatedAt);
  });
});

describe("downtime pack ED population (device audit 11 Oct 2026)", () => {
  it("says how the still-in-ED count relates to every open journey", () => {
    const { state, pack } = packFor();
    expect(pack.edQueue.length + pack.leftEd).toBe(state.movements.filter(isOpen).length);
    for (const line of pack.edQueue) expect(line.ed).not.toMatch(/Emergency Department$/u);
  });
});
