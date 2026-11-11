// tests/ward-audit-m35-report-reconciliation.test.ts
//
// Audit item M35, report half: the figures the Map and the weekly report show for a day equal what
// the accepted audit rows say. A synthetic day is driven through the real reducer (departures, one
// refused departure, a ward transfer, an override), and each figure is read before and after with
// the same functions the screens use:
//
//   - Map "discharged today"  : siteFigures(...).dischargedToday   (statistics-map-view)
//   - Weekly report overrides : weeklyOperationsReport(...).overrides   (reports/weekly-report)
//   - Weekly report declines  : weeklyOperationsReport(...).declines
//
// Each figure's change is compared with the accepted audit rows of the matching kind. The three
// findings first pinned here were fixed on 10 Nov 2026 (D-130):
//   1. "Discharged today" no longer counts a ward transfer out (a care change, not a departure).
//   2. A decline writes an accepted `referral-answer` audit row.
//   3. An arrival writes an accepted `arrival` audit row.
//
// Synthetic data only.

import { describe, expect, it } from "vitest";

import { eligibility } from "@/components/ward-management/ward-eligibility";
import type { AuditEvent } from "@/components/ward-management/ward-audit";
import { GENDER_PLACEMENT_REASONS } from "@/components/ward-management/ward-change-reasons";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { reportWeek, weeklyOperationsReport } from "@/components/ward-management/reports/weekly-report";
import { siteFigures } from "@/components/ward-management/statistics/statistics-map-view";
import { dayOf } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const DAY_ZERO = new Date("2026-10-24T00:00:00.000Z");
/** The screens read this instant; every driven event is at or before it, on the same day. */
const REPORT_NOW = NOW_ANCHOR + 30;
const at = (minutes: number) => NOW_ANCHOR + minutes;

function figures(state: WardFlowState) {
  const input = { ...state, now: REPORT_NOW };
  const sites = siteFigures(input);
  const weekly = weeklyOperationsReport(
    {
      movements: state.movements,
      referrals: state.referrals,
      admissions: state.admissions,
      patients: state.patients,
      units: state.units,
      bedReleases: state.bedReleases,
      leaveBeds: state.leaveBeds,
      edAccessTargetMinutes: state.configuration.edAccessTargetMinutes,
      now: REPORT_NOW,
    },
    reportWeek(-1, REPORT_NOW, DAY_ZERO),
  );
  return {
    dischargedBySite: Object.fromEntries(sites.map((site) => [site.code, site.dischargedToday])),
    dischargedTotal: sites.reduce((sum, site) => sum + site.dischargedToday, 0),
    overrides: weekly.overrides.placement + weekly.overrides.referral,
    declines: weekly.declines.placement + weekly.declines.referral,
  };
}

const acceptedRows = (state: WardFlowState, keep: (row: AuditEvent) => boolean) =>
  state.auditEvents.filter((row) => row.outcome === "accepted" && keep(row));
const siteOf = (state: WardFlowState, unitId: string) => state.units.find((unit) => unit.id === unitId)!.siteCode;

function send(state: WardFlowState, event: WardFlowEvent) {
  return wardFlowReducer(state, event);
}

/** Departures: three accepted in two sites, and one refused for a destination that is not on the list. */
function driveDeparture(
  state: WardFlowState,
  admissionId: string,
  unitId: string,
  minutes: number,
  destination: string,
) {
  return send(state, {
    type: "RECORD_LEAVING",
    role: "ward",
    now: at(minutes),
    admissionId,
    actingUnitId: unitId,
    leavingDestination: destination,
  } as WardFlowEvent);
}

function pickOccupiedInDistinctSites(state: WardFlowState, count: number) {
  const seen = new Set<string>();
  const picked = [] as WardFlowState["admissions"];
  for (const admission of state.admissions) {
    if (admission.state !== "occupied" || !admission.arrivedAt || admission.arrivedAt > at(0)) continue;
    const site = siteOf(state, admission.unitId);
    if (picked.length < count && (picked.length < 2 ? !seen.has(site) : true)) {
      seen.add(site);
      picked.push(admission);
    }
  }
  return picked;
}

/** The receiving-ward arrangement the existing transfer test uses, applied to a clone. */
function transferArrived(state: WardFlowState, admissionId: string, minutes: number): WardFlowState | undefined {
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
    const after = send(next, {
      type: "RECORD_ADMISSION_CARE",
      role: "coordinator",
      now: at(minutes + index),
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

/** An override recorded for real: refer a movement to a ward it does not suit, with a reason. */
function driveOverride(state: WardFlowState, minutes: number): WardFlowState | undefined {
  const movement = state.movements.find((m) => m.stage === "placement_requested" && m.id === "WF-012")!;
  for (const unit of state.units) {
    const next = send(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: at(minutes),
      movementId: movement.id,
      unitIds: [unit.id],
      overrideReason: "The bed information is known to be out of date",
      genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
      genderPlacementChecked: true,
    } as WardFlowEvent);
    const recorded = next.movements.find((m) => m.id === movement.id)!.overrides.length;
    if (next.rejections.length === state.rejections.length && recorded > movement.overrides.length) return next;
  }
  return undefined;
}

describe("M35 report figures reconcile with the accepted audit rows", () => {
  it("is one synthetic day: the instants the screens read share a calendar day", () => {
    expect(dayOf(at(0))).toBe(dayOf(REPORT_NOW));
  });

  it("Map discharged today changes by exactly the accepted departure rows, per site and in total", () => {
    const seed = seedWardFlowState();
    const before = figures(seed);
    const [a, b, c, refusedOne] = pickOccupiedInDistinctSites(seed, 4);
    const destination = LEAVING_DESTINATIONS[0]!.id;
    let state = seed;
    for (const [index, admission] of [a!, b!, c!].entries())
      state = driveDeparture(state, admission.id, admission.unitId, 1 + index, destination);
    const rowsBeforeRefusal = state.auditEvents.length;
    const refused = driveDeparture(state, refusedOne!.id, refusedOne!.unitId, 5, "not-a-destination");
    // the refusal changes no figure and leaves no accepted row
    expect(refused.rejections.length).toBe(state.rejections.length + 1);
    expect(acceptedRows(refused, (row) => row.action === "RECORD_LEAVING")).toHaveLength(3);
    expect(refused.auditEvents.length).toBeGreaterThanOrEqual(rowsBeforeRefusal);
    state = refused;

    const after = figures(state);
    const departures = acceptedRows(
      state,
      (row) =>
        row.category === "discharge" &&
        row.action === "RECORD_LEAVING" &&
        row.details.kind === "departure" &&
        row.details.after === "departed",
    );
    expect(departures).toHaveLength(3);
    expect(after.dischargedTotal - before.dischargedTotal).toBe(departures.length);
    for (const site of Object.keys(after.dischargedBySite)) {
      const rows = departures.filter(
        (row) => row.subject.kind === "admission" && siteOf(state, row.subject.unitId) === site,
      ).length;
      expect(after.dischargedBySite[site]! - before.dischargedBySite[site]!, `site ${site}`).toBe(rows);
    }
  });

  it("a ward transfer out is not counted as a discharge by the Map; its audit row is a care change, not a departure", () => {
    const seed = seedWardFlowState();
    const before = figures(seed);
    const source = seed.admissions.find(
      (a) => a.state === "occupied" && a.patientId && a.arrivedAt! <= at(0) && transferArrived(seed, a.id, 1),
    )!;
    const state = transferArrived(seed, source.id, 1)!;
    const after = figures(state);
    const departures = acceptedRows(state, (row) => row.category === "discharge" && row.action === "RECORD_LEAVING");
    const transfers = acceptedRows(
      state,
      (row) =>
        row.category === "discharge" &&
        row.action === "RECORD_ADMISSION_CARE" &&
        row.details.kind === "care" &&
        row.details.recorded?.kind === "transfer" &&
        row.details.recorded.step === "arrived",
    );
    expect(transfers).toHaveLength(1);
    expect(departures).toHaveLength(0);
    // Fixed (D-130): a move to another psychiatric ward is a move, so the figure does not rise.
    expect(after.dischargedTotal - before.dischargedTotal).toBe(departures.length);
    expect(state.admissions.find((a) => a.id === source.id)!.leavingDestination).toBe(
      "transferred-to-another-psychiatric-ward",
    );
  });

  it("weekly report overrides change by exactly the accepted override rows that recorded one", () => {
    const seed = seedWardFlowState();
    const before = figures(seed);
    const state = driveOverride(seed, 2);
    expect(state, "the seed has a ward this movement can be referred to with an override").toBeDefined();
    const after = figures(state!);
    const rows = acceptedRows(
      state!,
      (row) => row.category === "override" && row.details.overrideFactRecorded === true,
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(after.overrides - before.overrides).toBe(rows.length);
  });

  it("weekly report overrides ignore an override request the engine refused", () => {
    const seed = seedWardFlowState();
    const before = figures(seed);
    const refused = send(seed, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: at(3),
      movementId: "WF-012",
      unitIds: ["no-such-ward"],
      overrideReason: "The bed information is known to be out of date",
    } as WardFlowEvent);
    expect(refused.rejections.length).toBe(seed.rejections.length + 1);
    expect(figures(refused).overrides).toBe(before.overrides);
    expect(acceptedRows(refused, (row) => row.category === "override")).toHaveLength(0);
  });

  // Fixed 10 Nov 2026 (D-130): declines and arrivals now write accepted audit rows.
  it("M35: the weekly report's decline count equals the accepted decline rows", () => {
    const seed = seedWardFlowState();
    const before = figures(seed);
    let state = send(seed, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: at(1),
      movementId: "WF-012",
      unitIds: ["rgh-adult-secure"],
      genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
      genderPlacementChecked: true,
    } as WardFlowEvent);
    state = send(state, {
      type: "DECLINE",
      role: "ward",
      now: at(2),
      movementId: "WF-012",
      unitId: "rgh-adult-secure",
      actingUnitId: "rgh-adult-secure",
      reason: "capability_mismatch",
    } as WardFlowEvent);
    expect(state.rejections.length).toBe(seed.rejections.length);
    const after = figures(state);
    expect(after.declines - before.declines).toBe(1);
    const rows = acceptedRows(state, (row) => /DECLINE/.test(row.action));
    expect(rows).toHaveLength(after.declines - before.declines);
  });

  it("M35: an arrival (an admission) is an accepted audit row", () => {
    const seed = seedWardFlowState();
    const moving = seed.movements.find((m) => m.stage === "moving")!;
    const after = send(seed, {
      type: "PATIENT_ARRIVED",
      role: "coordinator",
      now: at(1),
      movementId: moving.id,
    } as WardFlowEvent);
    expect(after.rejections.length).toBe(seed.rejections.length);
    expect(acceptedRows(after, (row) => String(row.action) === "PATIENT_ARRIVED")).toHaveLength(1);
  });
});
