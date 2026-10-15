import {
  dailySheetGroups,
  dailySheetPeople,
  type DailySheetPerson,
} from "@/components/ward-management/board/ward-daily-sheet";
import {
  bedMeetingSheet,
  type BedMeetingCapacity,
  type BedMeetingDischargeRow,
  type BedMeetingDischarges,
} from "@/components/ward-management/capacity/bed-meeting-derivations";
import {
  bedKindGaps,
  networkWardRows,
  type BedKindGap,
} from "@/components/ward-management/capacity/capacity-derivations";
import {
  ED_HELD_STAGES,
  ED_LEAVING_STAGES,
  ED_STAGE_LABELS,
  edHomeSummaries,
  edWaitingSeries,
  elapsedOpenMinutes,
  type EdSummary,
} from "@/components/ward-management/ed/ed-home-derivations";
import { edHasNoBedYet } from "@/components/ward-management/ed/ed-no-bed";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import { isOpen, wardServiceOrder } from "@/components/ward-management/ward-derivations";
import type { BedRelease, HealthService, LeaveBed, Movement, Unit } from "@/components/ward-management/ward-model";
import {
  edHealthService,
  healthServiceAcronym,
  movementBelongsToService,
  unitHealthService,
} from "@/components/ward-management/ward-service-scope";
import { allEmergencyDepartments, edById, edShortName } from "@/components/ward-management/ward-sites";

/**
 * THE WARD AND ED TV VIEWS (Josh, 15 Oct 2026): the bed meeting TV, narrowed to one ward or one
 * emergency department for the screen in that ward's office or that department's tea room.
 *
 * Like the bed meeting TV, these re-derive nothing. Capacity and discharges come from
 * `bedMeetingSheet` narrowed to one ward, the ward's people from `dailySheetPeople` (the Shift
 * brief's own rows), and the ED figures from `edHomeSummaries` and the ED board's own stage words
 * and "no bed yet" rule. This module only picks rows that fit on a screen and counts the rest.
 */

/** How many named rows a TV panel shows before it says "and N more". */
export const TV_ROW_LIMIT = 8;

/** A person on someone else's ward or in an ED, shown on a shared screen by initials only. */
export type TvJourneyRow = {
  id: string;
  name: string;
  where: string;
  stage: string;
  waitMinutes: number;
};

type TvInputs = {
  units: Unit[];
  movements: Movement[];
  bedReleases: BedRelease[];
  admissions: Admission[];
  leaveBeds: LeaveBed[];
  now: Instant;
  /** The screen's own resolver, narrowed to initials by the caller. */
  nameOf: (movement: Movement) => string;
};

function byWaitThenId(a: TvJourneyRow, b: TvJourneyRow): number {
  return b.waitMinutes - a.waitMinutes || a.id.localeCompare(b.id);
}

function edLabel(edId: string): string {
  const ed = edById(edId);
  return ed ? edShortName(ed) : edId;
}

/** A bed meeting discharge row, with the person it belongs to from the Shift brief's own rows. */
export type WardTvGoingRow = BedMeetingDischargeRow & { person: DailySheetPerson | undefined };

export type WardTvSheet = {
  unit: Unit;
  capacity: BedMeetingCapacity;
  /** Accepted for this ward and not yet arrived, longest wait first. */
  incoming: { total: number; onTheWay: number };
  /** Asked of this ward and not yet answered by anyone. */
  askedCount: number;
  /** Everyone heading for this ward: the ones waiting on its answer first, then the accepted, each longest first. */
  coming: { rows: TvJourneyRow[]; more: number };
  discharges: BedMeetingDischarges;
  going: WardTvGoingRow[];
  occupied: number;
  heldUp: DailySheetPerson[];
  overdue: DailySheetPerson[];
  noDate: number;
  away: DailySheetPerson[];
};

export function wardTvSheet(input: TvInputs & { unit: Unit }): WardTvSheet {
  const { unit, movements, bedReleases, admissions, leaveBeds, now, nameOf } = input;
  const sheet = bedMeetingSheet({
    units: [unit],
    movements,
    bedReleases,
    admissions,
    leaveBeds,
    now,
    service: null,
    nameOf,
  });
  const open = movements.filter(isOpen);
  const row = (movement: Movement, stage: string): TvJourneyRow => ({
    id: movement.id,
    name: nameOf(movement),
    where: edLabel(movement.originEdId),
    stage,
    waitMinutes: elapsedOpenMinutes(movement, now),
  });
  const incoming = open
    .filter((movement) => movement.acceptedUnitId === unit.id)
    .map((movement) => row(movement, ED_STAGE_LABELS[movement.stage]))
    .sort(byWaitThenId);
  const onTheWay = open.filter(
    (movement) => movement.acceptedUnitId === unit.id && ED_LEAVING_STAGES.includes(movement.stage),
  ).length;
  const asked = open
    .filter((movement) => movement.acceptedUnitId === undefined && movement.referredUnitIds.includes(unit.id))
    .map((movement) => row(movement, "Waiting on this ward's answer"))
    .sort(byWaitThenId);
  const coming = [...asked, ...incoming];
  const people = dailySheetPeople(admissions, unit.id, now);
  const groups = dailySheetGroups(people);
  return {
    unit,
    capacity: sheet.capacity,
    incoming: { total: incoming.length, onTheWay },
    askedCount: asked.length,
    coming: { rows: coming.slice(0, TV_ROW_LIMIT), more: Math.max(0, coming.length - TV_ROW_LIMIT) },
    discharges: sheet.discharges,
    going: sheet.discharges.rows.map((row) => {
      // A release's admission is a join key, never shown: it only finds the person's de-identified line.
      const admissionId = bedReleases.find((release) => release.id === row.id)?.admissionId;
      return { ...row, person: people.find((person) => person.key === admissionId) };
    }),
    occupied: people.length,
    heldUp: groups.heldUp,
    overdue: groups.overdue,
    noDate: groups.noDate.length,
    away: groups.awayFromWard,
  };
}

export type EdTvWard = { id: string; name: string; ready: number; lockedReady: number };

export type EdTvSheet = {
  summary: EdSummary;
  service: HealthService | undefined;
  accessTargetMinutes: number;
  noBed: number;
  held: number;
  leaving: number;
  people: TvJourneyRow[];
  morePeople: number;
  /** Waiting at each point over `ED_TREND_SPAN_MINUTES`, the last point now (`edWaitingSeries`). */
  trend: number[];
  /** Wards in this department's health service with a bed ready now, most ready first. */
  wards: EdTvWard[];
  moreWards: number;
  readyInService: number;
};

export function edTvSheet(input: TvInputs & { edId: string; accessTargetMinutes: number }): EdTvSheet | undefined {
  const { edId, units, movements, bedReleases, admissions, leaveBeds, now, nameOf, accessTargetMinutes } = input;
  const summary = edHomeSummaries(movements, now, accessTargetMinutes).find((row) => row.ed.id === edId);
  if (!summary) return undefined;
  const unitName = (unitId: string | undefined) =>
    unitId === undefined ? undefined : units.find((unit) => unit.id === unitId)?.name;
  const people = summary.open
    .map((movement) => {
      const destination = unitName(movement.acceptedUnitId);
      const stage = ED_STAGE_LABELS[movement.stage];
      return {
        id: movement.id,
        name: nameOf(movement),
        where: destination ?? "",
        stage,
        waitMinutes: elapsedOpenMinutes(movement, now),
      };
    })
    .sort(byWaitThenId);
  const trend = edWaitingSeries(movements, edId, now);
  // The last point is now: the same open count as the tiles, as the ED index does.
  trend[trend.length - 1] = summary.waiting;

  const service = edHealthService(edId);
  const serviceUnits = service === undefined ? [] : units.filter((unit) => unitHealthService(unit) === service);
  const rows = networkWardRows(serviceUnits, now, bedReleases, admissions, leaveBeds);
  const withBeds = rows
    .filter((row) => row.ready > 0)
    .sort((a, b) => b.ready - a.ready || a.unit.name.localeCompare(b.unit.name))
    .map((row) => ({ id: row.unit.id, name: row.unit.name, ready: row.ready, lockedReady: row.lockedReady }));
  const inStages = (stages: readonly Movement["stage"][]) =>
    summary.open.filter((movement) => stages.includes(movement.stage)).length;

  return {
    summary,
    service,
    accessTargetMinutes,
    noBed: summary.open.filter(edHasNoBedYet).length,
    held: inStages(ED_HELD_STAGES),
    leaving: inStages(ED_LEAVING_STAGES),
    people: people.slice(0, TV_ROW_LIMIT),
    morePeople: Math.max(0, people.length - TV_ROW_LIMIT),
    trend,
    wards: withBeds.slice(0, TV_ROW_LIMIT),
    moreWards: Math.max(0, withBeds.length - TV_ROW_LIMIT),
    readyInService: rows.reduce((sum, row) => sum + row.ready, 0),
  };
}

/* --------------------------------------------------------------------------------------------- *
 * The bed meeting views: the whole state, or one health service (Josh, 15 Oct 2026: "a TV
 * version for each health service, for the overall view, good for handover meetings").
 * --------------------------------------------------------------------------------------------- */

/** The services a TV can show: every one in the Capacity screen's order that has a ward or an ED. */
export function tvHealthServices(units: Unit[]): HealthService[] {
  const eds = allEmergencyDepartments();
  return wardServiceOrder.filter(
    (service) =>
      units.some((unit) => unitHealthService(unit) === service) || eds.some((ed) => edHealthService(ed.id) === service),
  );
}

/** `?service=nmhs` (any case) or `all`. `undefined` when the link names no service the network has. */
export function tvServiceFromParam(value: string, units: Unit[]): HealthService | null | undefined {
  const wanted = value.trim().toUpperCase();
  if (wanted === "ALL") return null;
  return tvHealthServices(units).find((service) => healthServiceAcronym(service) === wanted);
}

/** The link form of a service: its acronym in lower case, or `all`. */
export function tvServiceParam(service: HealthService | null): string {
  return service === null ? "all" : healthServiceAcronym(service).toLowerCase();
}

/** One health service's line on the state screen, every figure from that service's own bed meeting sheet. */
export type TvServiceRow = {
  service: HealthService;
  ready: number;
  lockedReady: number;
  edWaiting: number;
  longestWaitMinutes: number;
  going: number;
};

/** One ward's line on a health service screen, every figure from that ward's own TV sheet. */
export type TvWardRow = {
  id: string;
  name: string;
  ready: number;
  lockedReady: number;
  asked: number;
  coming: number;
  going: number;
};

export type MeetingTvExtras = {
  /** The state screen: one line per health service. Empty on a health service screen. */
  services: TvServiceRow[];
  /** A health service screen: one line per ward, by name. Empty on the state screen. */
  wards: TvWardRow[];
  moreWards: number;
  /** Capacity's "beds that fit" rows, narrowed to the screen's service. */
  gaps: BedKindGap[];
};

type MeetingInputs = TvInputs & { service: HealthService | null };

function serviceRow(input: MeetingInputs, service: HealthService): TvServiceRow {
  const sheet = bedMeetingSheet({ ...input, service });
  const { heldUp, confirmed, expected } = sheet.discharges;
  return {
    service,
    ready: sheet.capacity.ready,
    lockedReady: sheet.capacity.lockedReady,
    edWaiting: sheet.ed.waiting,
    longestWaitMinutes: sheet.ed.departments.reduce((longest, row) => Math.max(longest, row.longestWaitMinutes), 0),
    going: heldUp + confirmed + expected,
  };
}

export function meetingTvExtras(input: MeetingInputs): MeetingTvExtras {
  const { service, units, movements, now } = input;
  const scopedUnits = service === null ? units : units.filter((unit) => unitHealthService(unit) === service);
  const scopedMovements =
    service === null ? movements : movements.filter((movement) => movementBelongsToService(movement, service, units));
  const wards =
    service === null
      ? []
      : [...scopedUnits]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((unit) => {
            const sheet = wardTvSheet({ ...input, unit });
            const { heldUp, confirmed, expected } = sheet.discharges;
            return {
              id: unit.id,
              name: unit.name,
              ready: sheet.capacity.ready,
              lockedReady: sheet.capacity.lockedReady,
              asked: sheet.askedCount,
              coming: sheet.incoming.total,
              going: heldUp + confirmed + expected,
            };
          });
  return {
    services: service === null ? tvHealthServices(units).map((each) => serviceRow(input, each)) : [],
    wards: wards.slice(0, TV_ROW_LIMIT),
    moreWards: Math.max(0, wards.length - TV_ROW_LIMIT),
    gaps: bedKindGaps(scopedMovements, scopedUnits, now),
  };
}
