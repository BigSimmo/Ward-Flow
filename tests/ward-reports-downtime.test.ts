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
});
