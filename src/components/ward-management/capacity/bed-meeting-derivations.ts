import { groupDischarges } from "@/components/ward-management/discharges/discharge-board";
import { delayGroups, type DelayCause } from "@/components/ward-management/delays/delays-derivations";
import { edOpenSummaries, elapsedOpenMinutes } from "@/components/ward-management/ed/ed-home-derivations";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { wardLabel } from "@/components/ward-management/ward-absence-labels";
import type { Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { BedRelease, HealthService, LeaveBed, Movement, Unit } from "@/components/ward-management/ward-model";
import { LONG_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import {
  edHealthService,
  movementBelongsToService,
  unitHealthService,
} from "@/components/ward-management/ward-service-scope";

import { networkServiceGroupTotals, networkWardRows } from "./capacity-derivations";

/**
 * THE MORNING BED-MEETING SHEET — one printed page for the meeting where the day's flow is decided:
 * today's capacity, expected discharges, people waiting in an emergency department, and the top
 * delays.
 *
 * **It re-derives nothing.** Every figure comes from the selector that already owns it on its own
 * screen — `networkWardRows`/`networkServiceGroupTotals` (Capacity), `groupDischarges`
 * (Discharges), `edOpenSummaries` (ED home) and `delayGroups` (Delays) — so the paper and the
 * screens cannot disagree. This module only narrows those answers to the chosen service, picks
 * the few rows that fit on one page, and counts what it left off so nothing is dropped silently.
 *
 * It lives beside Capacity rather than on its own route because the Morning screen was retired
 * into Capacity (OA-41). The 24-hour wait is Josh's own default (D-24), never a limit.
 */

/** How many named rows each section prints before it says "and N more". One A4 page is the brief. */
export const BED_MEETING_ROW_LIMIT = 6;

export type BedMeetingCapacity = {
  wards: number;
  beds: number;
  occupied: number;
  ready: number;
  lockedReady: number;
  pulled: number;
  closed: number;
  /** `undefined` when no ward reports it — never a misleading zero. */
  pendingPreparation: number | undefined;
};

export type BedMeetingDischargeRow = {
  id: string;
  ward: string;
  status: "Held up" | "Confirmed" | "Expected";
  note: string | null;
};

export type BedMeetingDischarges = {
  heldUp: number;
  confirmed: number;
  expected: number;
  dischargedToday: number;
  /** Releases expected two or more days ahead — left out of today's figures, and said so. */
  beyondToday: number;
  /** Held up first, then confirmed, then expected — the same order the Discharges board reads. */
  rows: BedMeetingDischargeRow[];
  moreRows: number;
};

export type BedMeetingEdRow = {
  id: string;
  department: string;
  waiting: number;
  longestWaitMinutes: number;
  detained: number;
};

export type BedMeetingEdPerson = { id: string; name: string; department: string; waitMinutes: number };

export type BedMeetingEd = {
  waiting: number;
  detained: number;
  /** Waiting longer than `LONG_WAIT_MINUTES` — Josh's default (D-24), not a legal limit. */
  overLongWait: number;
  departments: BedMeetingEdRow[];
  longestWaits: BedMeetingEdPerson[];
  morePeople: number;
};

export type BedMeetingDelayRow = { cause: DelayCause; title: string; count: number; longestWaitMinutes: number };

export type BedMeetingDelayPerson = { id: string; name: string; cause: string; waitMinutes: number };

export type BedMeetingDelays = {
  /** Every open movement that sits in a delay group. */
  total: number;
  /** Worst cause first — `delayGroups`' own ranking, never re-sorted here. */
  groups: BedMeetingDelayRow[];
  longestWaits: BedMeetingDelayPerson[];
  morePeople: number;
};

export type BedMeetingSheet = {
  service: HealthService | null;
  capacity: BedMeetingCapacity;
  discharges: BedMeetingDischarges;
  ed: BedMeetingEd;
  delays: BedMeetingDelays;
};

export type BedMeetingInput = {
  units: Unit[];
  movements: Movement[];
  bedReleases: BedRelease[];
  admissions: Admission[];
  leaveBeds: LeaveBed[];
  now: Instant;
  /** The service scope chosen on Capacity; `null` is all services. */
  service: HealthService | null;
  /** Resolves a movement to the patient's display name — the screen's own resolver. */
  nameOf: (movement: Movement) => string;
};

/** Longest first, then by id so two prints of the same picture never reshuffle. */
function byWaitThenId<T extends { waitMinutes: number; id: string }>(a: T, b: T): number {
  return b.waitMinutes - a.waitMinutes || a.id.localeCompare(b.id);
}

export function bedMeetingSheet(input: BedMeetingInput): BedMeetingSheet {
  const { units, movements, bedReleases, admissions, leaveBeds, now, service, nameOf } = input;

  const scopedUnits = service === null ? units : units.filter((unit) => unitHealthService(unit) === service);
  const scopedUnitIds = new Set(scopedUnits.map((unit) => unit.id));
  const scopedReleases = bedReleases.filter((release) => scopedUnitIds.has(release.unitId));
  const scopedMovements =
    service === null ? movements : movements.filter((movement) => movementBelongsToService(movement, service, units));

  // Capacity — the same rows and the same group totals the Capacity screen renders.
  const rows = networkWardRows(scopedUnits, now, scopedReleases, admissions, leaveBeds);
  const totals = networkServiceGroupTotals(rows);
  const tracked = rows.map((row) => row.pendingPreparation).filter((value): value is number => value !== undefined);
  const capacity: BedMeetingCapacity = {
    wards: totals.wards,
    beds: rows.reduce((sum, row) => sum + row.unit.beds, 0),
    occupied: totals.occupied,
    ready: totals.ready,
    lockedReady: totals.lockedReady,
    pulled: totals.pulled,
    closed: totals.closed,
    pendingPreparation: tracked.length === 0 ? undefined : tracked.reduce((sum, value) => sum + value, 0),
  };

  // Discharges — the Discharges board's own grouping.
  const unitName = (unitId: string) => wardLabel(unitId, units.find((unit) => unit.id === unitId)?.name);
  const groups = groupDischarges(scopedReleases, now);
  const dischargeRows: BedMeetingDischargeRow[] = [
    ...groups.blocked.map((release) => ({
      id: release.id,
      ward: unitName(release.unitId),
      status: "Held up" as const,
      note: release.blocker,
    })),
    ...groups.confirmed.map((release) => ({
      id: release.id,
      ward: unitName(release.unitId),
      status: "Confirmed" as const,
      note: null,
    })),
    ...groups.expected.map((release) => ({
      id: release.id,
      ward: unitName(release.unitId),
      status: "Expected" as const,
      note: release.waitingOn ?? null,
    })),
  ];
  const discharges: BedMeetingDischarges = {
    heldUp: groups.blocked.length,
    confirmed: groups.confirmed.length,
    expected: groups.expected.length,
    dischargedToday: groups["discharged-today"].length,
    beyondToday: groups.excludedBeyondToday,
    rows: dischargeRows.slice(0, BED_MEETING_ROW_LIMIT),
    moreRows: Math.max(0, dischargeRows.length - BED_MEETING_ROW_LIMIT),
  };

  // Emergency departments — the ED home's own per-department summaries, narrowed to the service.
  const edSummaries = edOpenSummaries(movements, now).filter(
    (summary) => summary.waiting > 0 && (service === null || edHealthService(summary.ed.id) === service),
  );
  const edPeople = edSummaries
    .flatMap((summary) =>
      summary.open.map((movement) => ({
        id: movement.id,
        name: nameOf(movement),
        department: summary.ed.name,
        waitMinutes: elapsedOpenMinutes(movement, now),
      })),
    )
    .sort(byWaitThenId);
  const ed: BedMeetingEd = {
    waiting: edSummaries.reduce((sum, summary) => sum + summary.waiting, 0),
    detained: edSummaries.reduce((sum, summary) => sum + summary.detained, 0),
    overLongWait: edPeople.filter((person) => person.waitMinutes > LONG_WAIT_MINUTES).length,
    departments: [...edSummaries]
      .sort(
        (a, b) =>
          b.waiting - a.waiting || b.longestWaitMinutes - a.longestWaitMinutes || a.ed.id.localeCompare(b.ed.id),
      )
      .map((summary) => ({
        id: summary.ed.id,
        department: summary.ed.name,
        waiting: summary.waiting,
        longestWaitMinutes: summary.longestWaitMinutes,
        detained: summary.detained,
      })),
    longestWaits: edPeople.slice(0, BED_MEETING_ROW_LIMIT),
    morePeople: Math.max(0, edPeople.length - BED_MEETING_ROW_LIMIT),
  };

  // Delays — the Delays screen's own causes, worst first.
  const delayed = delayGroups(scopedMovements.filter(isOpen), units, now);
  const delayPeople = delayed
    .flatMap((group) =>
      group.movements.map((movement) => ({
        id: movement.id,
        name: nameOf(movement),
        cause: group.title,
        waitMinutes: elapsedOpenMinutes(movement, now),
      })),
    )
    .sort(byWaitThenId);
  const delays: BedMeetingDelays = {
    total: delayPeople.length,
    groups: delayed.map((group) => ({
      cause: group.cause,
      title: group.title,
      count: group.movements.length,
      longestWaitMinutes: Math.max(...group.movements.map((movement) => elapsedOpenMinutes(movement, now))),
    })),
    longestWaits: delayPeople.slice(0, BED_MEETING_ROW_LIMIT),
    morePeople: Math.max(0, delayPeople.length - BED_MEETING_ROW_LIMIT),
  };

  return { service, capacity, discharges, ed, delays };
}
