import { describe, expect, it } from "vitest";

import { alertGroupOf, alertKindOf } from "@/components/ward-management/alerts/alerts-model";
import { wardClinicalRows } from "@/components/ward-management/bed-meeting/tv-clinical-derivations";
import { buildOccupants, buildTiles } from "@/components/ward-management/board/ward-board-model";
import { patientMode } from "@/components/ward-management/patients/patient-mode";
import { downtimePack } from "@/components/ward-management/reports/downtime-pack";
import { buildCensus } from "@/components/ward-management/search/patient-census";
import { projectExecutiveReportingFoundation } from "@/components/ward-management/statistics/executive-statistics-projector";
import { rosterStatus } from "@/components/ward-management/statistics/statistics-ward-phone";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { wardBedRoster } from "@/components/ward-management/ward/ward-screen-derivations";
import { absentOnOrder } from "@/components/ward-management/ward-absence-tasks";
import {
  activeActNowItems,
  activeTaskItems,
  newActNowItems,
  type TaskSource,
} from "@/components/ward-management/ward-act-now-items";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { demoDayZero, dueSoonThresholdsOf } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { INBOX_CATEGORIES } from "@/components/ward-management/ward-inbox-reducer";
import { createPatientResolver } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { isOnOrder, stayLegalStatus } from "@/components/ward-management/ward-stay-legal";

/**
 * AUDIT 6 (issue #1569): one missing person reaches every screen that should show them.
 *
 * `ward-absence-and-cto.test.ts` pins the reducer and `ward-awol-tracker-status.test.ts` the patient
 * status card. This file dispatches ONE `RECORD_ABSENT_WITHOUT_LEAVE` on the synthetic seed and reads
 * each screen's own view model from the resulting state, so a screen that stops reading the absence
 * fails here. Synthetic seed only; no names are printed.
 */

type State = ReturnType<typeof seedWardFlowState>;

const NOW = NOW_ANCHOR;

/** An occupied stay on an order with no held bed yet: the case that must raise act now (audit A3-1). */
function stayOnOrderInBed(state: State) {
  const stay = state.admissions.find(
    (admission) =>
      admission.state === "occupied" &&
      admission.awayAtEmergencyDepartmentSince === null &&
      !state.leaveBeds.some((bed) => bed.admissionId === admission.id) &&
      isOnOrder(stayLegalStatus(admission, state)),
  );
  if (!stay) throw new Error("the seed has no occupied stay on an order without leave");
  return stay;
}

function taskSource(state: State): TaskSource {
  return {
    movements: state.movements,
    units: state.units,
    configuration: state.configuration,
    inboxSnoozes: state.inboxSnoozes,
    admissions: state.admissions,
    patients: state.patients,
    referrals: state.referrals,
    supportNotifications: state.supportNotifications,
    plannedAdmissions: state.plannedAdmissions,
    leaveBeds: state.leaveBeds,
  };
}

function markMissing() {
  const before = seedWardFlowState();
  const stay = stayOnOrderInBed(before);
  const after = wardFlowReducer(before, {
    type: "RECORD_ABSENT_WITHOUT_LEAVE",
    role: "ward",
    now: NOW,
    admissionId: stay.id,
    actingUnitId: stay.unitId,
  });
  expect(after.rejections.length, "the one dispatch was accepted").toBe(before.rejections.length);
  const unit = after.units.find((candidate) => candidate.id === stay.unitId)!;
  const leaveBed = after.leaveBeds.find((bed) => bed.admissionId === stay.id)!;
  expect(leaveBed.absentWithoutLeave?.since).toBe(NOW);
  return { before, after, stay, unit, leaveBed };
}

const absenceRowId = (admissionId: string) => `${INBOX_CATEGORIES.absent_without_leave.idPrefix}${admissionId}`;

describe("audit 6: a person marked absent without leave reaches every screen after one dispatch", () => {
  it("raises a new act now alert on that one update, and nothing before it", () => {
    const { before, after, stay } = markMissing();
    const previous = new Set(activeActNowItems(taskSource(before), NOW).map((item) => item.id));
    expect(previous.has(absenceRowId(stay.id))).toBe(false);

    // The open-tab notifier and the phone push both raise what `newActNowItems` returns.
    const raised = newActNowItems(previous, activeActNowItems(taskSource(after), NOW));
    const row = raised.find((item) => item.id === absenceRowId(stay.id));
    expect(row).toMatchObject({ tone: "danger", title: "Absent without leave on an order" });
    expect(row?.detail).toMatch(/^Missing from .+ since /u);
  });

  it("Home (coordinator) and the header Tasks badge list the absence first", () => {
    const { after, stay } = markMissing();
    // `coordinator-screen.tsx` builds its work list from `activeTaskItems`, as the Tasks badge does.
    const active = activeTaskItems(taskSource(after), NOW);
    expect(active[0]?.id).toBe(absenceRowId(stay.id));
  });

  it("Alerts files the row as an absence in the act now group", () => {
    const { after, stay } = markMissing();
    const row = activeTaskItems(taskSource(after), NOW).find((item) => item.id === absenceRowId(stay.id))!;
    expect(alertKindOf(row.id)).toBe("awol");
    expect(alertGroupOf(row)).toBe("act");
  });

  it("the ward's own Home tab counts the absence in Act now", () => {
    const { after, stay, unit } = markMissing();
    // `ward-screen.tsx` passes this ward's held beds only.
    const rows = absentOnOrder({
      leaveBeds: after.leaveBeds.filter((bed) => bed.unitId === unit.id),
      admissions: after.admissions,
      movements: after.movements,
      patients: after.patients,
    });
    expect(rows.map((row) => row.admission.id)).toContain(stay.id);
  });

  it("the ward bed board shows the bed as absent without leave, never as leave", () => {
    const { after, stay, unit } = markMissing();
    const unitLeaveBeds = after.leaveBeds.filter((bed) => bed.unitId === unit.id);
    const { bedsList } = wardBedRoster({
      unit,
      unitLeaveBeds,
      admissions: after.admissions,
      bedReleases: after.bedReleases,
      states: bedStates(unit, after.admissions, after.bedReleases, after.leaveBeds, []),
      accepted: after.movements.filter((movement) => isOpen(movement) && movement.acceptedUnitId === unit.id),
      movements: after.movements,
      resolvePatientIdentity: createPatientResolver(after),
      now: NOW,
      criteriaLedOn: false,
      patients: after.patients,
      plannedAdmissions: after.plannedAdmissions,
      dayZero: demoDayZero(new Date("2026-10-19T00:00:00Z")),
      wardReferralInbox: () => [],
    });
    const bed = bedsList.find((candidate) => candidate.admissionId === stay.id);
    expect(bed?.statusText).toBe("Absent without leave");
  });

  it("the Patients census row says absent without leave and not on leave", () => {
    const { after, stay } = markMissing();
    const census = buildCensus({
      ...after,
      now: NOW,
      thresholds: dueSoonThresholdsOf(after.configuration),
      dayZero: demoDayZero(new Date("2026-10-19T00:00:00Z")),
    });
    const row = census.rows.find((candidate) => candidate.key === `adm:${stay.id}`);
    expect(row).toMatchObject({ where: "Absent without leave", absentWithoutLeave: true, onLeave: false });
  });

  it("the patient page opens in its absent without leave mode", () => {
    const { after, stay, leaveBed } = markMissing();
    expect(patientMode({ admission: after.admissions.find((a) => a.id === stay.id), leaveBed })).toBe("awol");
  });

  it("the ward TV clinical and handover boards put the person under Absent without leave", () => {
    const { after, stay, unit } = markMissing();
    const rows = wardClinicalRows({
      movements: after.movements,
      referrals: after.referrals,
      patients: after.patients,
      plannedAdmissions: after.plannedAdmissions,
      unit,
      admissions: after.admissions,
      leaveBeds: after.leaveBeds,
      bedReleases: after.bedReleases,
      now: NOW,
      nameOf: (subject) => subject.id,
    });
    const row = rows.find((candidate) => candidate.key === stay.id);
    expect(row?.where).toBe("awol");
    expect(row?.whereabouts?.tone).toBe("danger");
    expect(row?.attention.some((item) => item.group === "missing")).toBe(true);
  });

  it("the statistics ward rosters (desktop and phone) say absent without leave, as the census does", () => {
    const { after, stay } = markMissing();
    const status = rosterStatus(
      after.admissions.find((admission) => admission.id === stay.id)!,
      after.leaveBeds,
    );
    expect(status).toBe("Absent without leave");
    // Someone on approved leave still reads On leave, so the label tells the two apart.
    const onLeave = after.leaveBeds.find((bed) => !bed.absentWithoutLeave);
    if (onLeave) {
      const admission = after.admissions.find((candidate) => candidate.id === onLeave.admissionId)!;
      expect(rosterStatus(admission, after.leaveBeds)).toBe("On leave");
    }
  });

  it("the downtime pack names the missing person on their ward, as it names everyone else (D-115)", () => {
    const { after, stay, unit } = markMissing();
    const pack = downtimePack({
      units: after.units,
      bedUnits: [unit],
      admissions: after.admissions,
      bedReleases: after.bedReleases,
      leaveBeds: after.leaveBeds,
      movements: after.movements,
      referrals: after.referrals,
      now: NOW,
      identify: (subject) => `person ${subject.id}`,
    });
    const ward = pack.wards.find((candidate) => candidate.unitId === unit.id)!;
    expect(ward.absentWithoutLeave).toEqual([{ admissionId: stay.id, person: `person ${stay.id}`, since: NOW }]);
    // The held bed is still a held bed (D-38): the count does not move.
    expect(ward.counts.onLeave).toBe(after.leaveBeds.filter((bed) => bed.unitId === unit.id).length);
  });

  it("executive statistics count an absence without leave apart from approved leave (D-115 item 6)", () => {
    const { after } = markMissing();
    const report = projectExecutiveReportingFoundation(
      after,
      { role: "executive", scope: { kind: "statewide" } },
      {
        now: NOW,
        dayZero: "2026-10-24T00:00:00.000Z",
        startedAt: "2026-10-24T00:00:00.000Z",
        places: wardPlaceLookup(after.units),
      },
    );
    const ward = report.journey.find((stage) => stage.id === "ward")!;
    const labels = ward.breakdown.map((row) => row.label);
    expect(labels).toContain("On leave");
    expect(labels).toContain("Absent without leave");
    const figureOf = (label: string) => ward.breakdown.find((row) => row.label === label)!.figure;
    // One person is a small number: it is never printed exactly, and neither is approved leave,
    // which the published held-bed total would otherwise give away by subtraction.
    // A released count that is hidden, never a dropped record or a printed zero.
    for (const label of ["Absent without leave", "On leave"]) {
      const figure = figureOf(label);
      expect(figure.kind, label).toBe("count");
      expect(figure.kind === "count" ? figure.count.kind : undefined, label).toMatch(/^(small|withheld)$/);
    }
  });

  it("ward board (/ward-flow/board/[unitId]): the tile and person panel say Absent without leave (D-115 item 4)", () => {
    const { after, stay, unit } = markMissing();
    const tiles = buildTiles(unit, after.admissions, after.bedReleases, NOW, { leaveBeds: after.leaveBeds });
    const tile = tiles.find((candidate) => candidate.key === stay.id);
    expect(tile).toMatchObject({ kind: "occupied", absentWithoutLeave: true });
    // Nobody else on the ward is marked, approved leave included.
    expect(tiles.filter((candidate) => candidate.kind === "occupied" && candidate.absentWithoutLeave)).toHaveLength(1);
    const occupant = buildOccupants(unit, after.admissions, NOW, after.leaveBeds).find(
      (candidate) => candidate.key === stay.id,
    );
    expect(occupant?.absentWithoutLeave).toBe(true);
  });
});
