// Clinical follow-up to audit M35 (Josh, 10 Nov 2026, D-130): on the Statistics Map, a ward transfer
// out is a move, not a discharge. The live Map (`siteFigures`) and the executive Map's own figures
// (`projectExecutiveReportingFoundation`) both leave it out of "Gone today". Synthetic seed only.
import { describe, expect, it } from "vitest";

import { eligibility } from "@/components/ward-management/ward-eligibility";
import { endedInWardTransfer } from "@/components/ward-management/ward-admissions";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { siteFigures } from "@/components/ward-management/statistics/statistics-map-view";
import { projectExecutiveReportingFoundation } from "@/components/ward-management/statistics/executive-statistics-projector";
import { exactStatisticsCount } from "@/components/ward-management/statistics/statistics-small-numbers";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const REPORT_NOW = NOW_ANCHOR + 30;
const at = (minutes: number) => NOW_ANCHOR + minutes;

/** The receiving-ward arrangement the M35 audit test uses: a real three-step transfer. */
function transferArrived(state: WardFlowState, admissionId: string): WardFlowState | undefined {
  const clone = structuredClone(state);
  const admission = clone.admissions.find((candidate) => candidate.id === admissionId)!;
  const base = clone.movements.find((m) => m.cohort === clone.units.find((u) => u.id === admission.unitId)?.cohort)!;
  base.admissionId = admission.id;
  base.patientId = admission.patientId!;
  base.stage = "arrived";
  base.acceptedUnitId = admission.unitId;
  admission.movementId = base.id;
  clone.units = clone.units.map((u) => ({
    ...u,
    allocatable: { ...u.allocatable, confirmedAt: NOW_ANCHOR },
    empty: { ...u.empty, confirmedAt: NOW_ANCHOR },
  }));
  const target = clone.units.find(
    (u) => u.id !== admission.unitId && eligibility(base, u, NOW_ANCHOR).eligible && u.allocatableLocked > 0,
  );
  if (!target) return undefined;
  let next = clone;
  for (const [index, step] of (["accepted", "handover", "arrived"] as const).entries()) {
    const after = wardFlowReducer(next, {
      type: "RECORD_ADMISSION_CARE",
      role: "coordinator",
      now: at(1 + index),
      admissionId,
      patientId: admission.patientId!,
      expectedGeneration: next.worldGeneration,
      expectedRevision: next.dischargeRevisions[admissionId] ?? 0,
      change: { kind: "transfer", receivingUnitId: target.id, step },
    } as WardFlowEvent);
    if (after.rejections.length !== next.rejections.length) return undefined;
    next = after;
  }
  return next;
}

const liveGoneToday = (state: WardFlowState) =>
  siteFigures({ ...state, now: REPORT_NOW }).reduce((sum, site) => sum + site.dischargedToday, 0);

function executiveGoneToday(state: WardFlowState) {
  const report = projectExecutiveReportingFoundation(
    state,
    { role: "executive", scope: { kind: "statewide" } },
    {
      now: REPORT_NOW,
      dayZero: "2026-10-24T00:00:00.000Z",
      startedAt: "2026-10-24T00:00:00.000Z",
      places: wardPlaceLookup(state.units),
    },
  );
  return {
    sites: report.sites.map((site) => exactStatisticsCount(site.dischargedToday)),
    ended: exactStatisticsCount(report.network.people.admissionsEndedToday),
  };
}

describe("Statistics Map: a ward transfer out is a move, not a discharge", () => {
  const seed = seedWardFlowState();
  const source = seed.admissions.find(
    (a) => a.state === "occupied" && a.patientId && a.arrivedAt! <= at(0) && transferArrived(seed, a.id),
  )!;
  const moved = transferArrived(seed, source.id)!;

  it("the transfer really ended the sending stay today, as a transfer", () => {
    const ended = moved.admissions.find((a) => a.id === source.id)!;
    expect(ended.state).toBe("departed");
    expect(endedInWardTransfer(ended)).toBe(true);
  });

  it("the live Map's Gone today does not rise for the transfer", () => {
    const ended = moved.admissions.find((a) => a.id === source.id)!;
    expect(Math.floor(ended.leftAt! / 1440)).toBe(Math.floor(REPORT_NOW / 1440));
    expect(liveGoneToday(moved)).toBe(liveGoneToday(seed));
  });

  it("the executive Map's site figures do not rise either, while the stay still counts as ended", () => {
    const before = executiveGoneToday(seed);
    const after = executiveGoneToday(moved);
    expect(after.sites).toEqual(before.sites);
    // The stay ended, so the people figure moves; only the discharge count leaves it out.
    if (before.ended !== null && after.ended !== null) expect(after.ended).toBe(before.ended + 1);
  });
});
