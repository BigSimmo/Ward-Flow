import type { Admission } from "@/components/ward-management/ward-admissions";
import { bedsPendingPreparation, openBedsNow } from "@/components/ward-management/ward-bed-availability";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { clockState, type Instant } from "@/components/ward-management/ward-clock";
import { bedKindGaps } from "@/components/ward-management/capacity/capacity-derivations";
import { delayGroups } from "@/components/ward-management/delays/delays-derivations";
import { elapsedLabel, isOpen } from "@/components/ward-management/ward-derivations";
import { serviceRollup } from "@/components/ward-management/ward-morning-rollup";
import {
  HEALTH_SERVICES,
  type BedRelease,
  type LeaveBed,
  type Movement,
  type Referral,
  type Unit,
} from "@/components/ward-management/ward-model";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { DUE_SOON_URGENT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { edPressure } from "@/components/ward-management/ward-pressure";
import { pullToArrival } from "@/components/ward-management/statistics/statistics-derivations";
import { occupiedBeds } from "@/components/ward-management/statistics/statistics-occupancy";
import { strandedFlags } from "@/components/ward-management/ward-stranded";
import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { siteByCode, wardSites } from "@/components/ward-management/ward-sites";

export type ToolsFigureGroup = "beds" | "pressure" | "due" | "movement";

export type ToolsFigureRow = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  flagged?: boolean;
};

export type ToolsServiceOccupancy = {
  service: string;
  occupied: number;
  beds: number;
  percent: string;
};

export type ToolsBedKindRow = {
  id: string;
  need: string;
  waiting: number;
  bedsThatFit: number;
};

export type ToolsFiguresModel = {
  scopeLabel: string;
  networkContext: boolean;
  notAllEligible: boolean;
  occupancy: { occupied: number; beds: number; pulled: number; percent: string };
  networkOccupancy?: { occupied: number; beds: number; pulled: number; percent: string };
  services: ToolsServiceOccupancy[];
  beds: ToolsFigureRow[];
  pressure: ToolsFigureRow[];
  due: ToolsFigureRow[];
  movement: ToolsFigureRow[];
  bedKinds: ToolsBedKindRow[];
  duePassed: number;
  dueSoon: number;
};

export type ToolsFiguresInput = {
  movements: Movement[];
  units: Unit[];
  admissions: readonly Admission[];
  referrals: Referral[];
  bedReleases: BedRelease[];
  leaveBeds: readonly LeaveBed[];
  now: Instant;
  role: WardChromeRole;
  placeId?: string;
  placeName?: string;
};

/** Occupied of staffed beds, as a percentage to one decimal when needed. Leave stays inside occupied. */
export function occupancyPercent(occupied: number, beds: number): string {
  if (beds <= 0) return "—";
  const value = Math.round((occupied / beds) * 1000) / 10;
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

function pendingDetail(units: readonly Unit[], releases: BedRelease[], actionable: boolean): string | undefined {
  const pending = units.reduce((total, unit) => total + bedsPendingPreparation(unit.id, releases), 0);
  if (pending === 0) return undefined;
  if (!actionable) return `${pending} pending`;
  const open = units.reduce((total, unit) => total + openBedsNow(unit, releases), 0);
  return `${open} can be pulled into · ${pending} pending`;
}

function closedBeds(
  units: readonly Unit[],
  admissions: readonly Admission[],
  releases: BedRelease[],
  leave: readonly LeaveBed[],
): number {
  return units.reduce((total, unit) => total + bedStates(unit, admissions, releases, leave).closed, 0);
}

function unitsForService(units: readonly Unit[], service: (typeof HEALTH_SERVICES)[number]): Unit[] {
  return units.filter((unit) => siteByCode(unit.siteCode)?.service === service);
}

function occupancyOf(
  units: readonly Unit[],
  admissions: readonly Admission[],
  releases: BedRelease[],
  leave: readonly LeaveBed[],
) {
  const counts = occupiedBeds(units, admissions, releases, leave);
  return { ...counts, percent: occupancyPercent(counts.occupied, counts.beds) };
}

function legalCounts(movements: readonly Movement[], now: Instant) {
  let passed = 0;
  let withinHour = 0;
  for (const movement of movements) {
    if (!isOpen(movement)) continue;
    const dueAt = movement.legalForm?.dueAt;
    if (dueAt === undefined) continue;
    const state = clockState(dueAt, now);
    if (state === "breached") passed += 1;
    else if (state === "critical") withinHour += 1;
  }
  return { passed, withinHour };
}

function minutesText(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded}m`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * Live shift figures for Tools. Occupancy uses `occupiedBeds` (5 October 2026). Ready, out today,
 * discharges held up and on leave come from `serviceRollup`. Recorded due times are counted with
 * `clockState` and are not calculated Act periods.
 */
export function buildToolsFigures(input: ToolsFiguresInput): ToolsFiguresModel {
  const { movements, units, admissions, referrals, bedReleases, leaveBeds, now, role, placeId, placeName } = input;
  const releases = [...bedReleases];
  const leave = [...leaveBeds];
  const wardUnit = role === "ward" && placeId !== undefined ? units.find((unit) => unit.id === placeId) : undefined;
  const focusUnits = wardUnit ? [wardUnit] : units;
  const networkContext = wardUnit !== undefined || role === "ed";
  const actionable = role !== "ed";
  const rollup = serviceRollup(wardSites, focusUnits, releases, leave, now);
  const occupancy = occupancyOf(focusUnits, admissions, releases, leave);
  const networkOccupancy = networkContext ? occupancyOf(units, admissions, releases, leave) : undefined;
  const legal = legalCounts(movements, now);
  const dueLabel = `Due within ${DUE_SOON_URGENT_MINUTES / 60}h (your default)`;
  const open = movements.filter(isOpen);
  const counts = wardNavCounts({ movements, units, referrals, bedReleases, leaveBeds, now });
  const stranded = strandedFlags(admissions, now);
  const transport = delayGroups(movements, units, now).find((group) => group.cause === "awaiting_transport");
  const arrival = pullToArrival([...admissions]);
  const departments = edPressure(now, movements);
  const fromEd = departments.reduce((total, entry) => total + entry.waiting, 0);
  const mine =
    role === "ed" && placeId !== undefined ? departments.find((entry) => entry.ed.id === placeId) : undefined;
  const longestPool = mine !== undefined ? open.filter((movement) => movement.originEdId === mine.ed.id) : open;
  const longest = longestPool.reduce<Movement | undefined>(
    (found, movement) => (found === undefined || movement.openedAt < found.openedAt ? movement : found),
    undefined,
  );
  const services = (wardUnit ? [] : HEALTH_SERVICES).flatMap((service) => {
    const serviceUnits = unitsForService(units, service);
    if (serviceUnits.length === 0) return [];
    const serviceOccupancy = occupancyOf(serviceUnits, admissions, releases, leave);
    if (serviceOccupancy.beds === 0) return [];
    return [
      { service, occupied: serviceOccupancy.occupied, beds: serviceOccupancy.beds, percent: serviceOccupancy.percent },
    ];
  });

  const readyDetail = pendingDetail(focusUnits, releases, actionable && wardUnit !== undefined ? true : actionable);
  const beds: ToolsFigureRow[] = [
    {
      id: "ready",
      label: wardUnit ? "Ready here" : role === "ed" ? "Ready statewide" : "Ready now",
      value: String(rollup.service.availableNow),
      detail: [role === "ed" ? "Not all eligible" : undefined, readyDetail].filter(Boolean).join(" · ") || undefined,
    },
    { id: "out-today", label: "Out today", value: String(rollup.service.expectedToday) },
    {
      id: "held-up",
      label: "Discharges held up",
      value: String(rollup.service.blockedToday),
      flagged: rollup.service.blockedToday > 0,
    },
    { id: "on-leave", label: "On leave", value: String(rollup.service.onLeave), detail: "Inside occupied" },
    { id: "closed", label: "Closed", value: String(closedBeds(focusUnits, admissions, releases, leave)) },
    { id: "pulled", label: "Pulled", value: String(occupancy.pulled), detail: "Bed given, not yet arrived" },
  ];

  const pressure: ToolsFigureRow[] = mine
    ? [
        { id: "waiting-here", label: "Waiting here", value: String(mine.waiting), detail: mine.ed.name },
        {
          id: "longest-here",
          label: "Longest here",
          value: mine.waiting === 0 ? "—" : `${Math.floor(mine.longestWaitMinutes / 60)}h`,
        },
        { id: "from-ed", label: "From ED, whole network", value: String(fromEd) },
      ]
    : [
        { id: "waiting", label: "Waiting", value: String(open.length), detail: "Open movements" },
        {
          id: "from-ed",
          label: "From ED",
          value: String(fromEd),
          detail: "Open movements that started in an emergency department",
        },
        {
          id: "longest",
          label: "Longest wait",
          value: longest === undefined ? "—" : elapsedLabel(longest, now),
          detail: longest?.id,
        },
      ];

  if (counts.referrals) {
    pressure.push({
      id: "referrals",
      label: "Awaiting a decision",
      value: String(counts.referrals.value),
      detail: "Referrals still waiting on an answer",
    });
  }

  const due: ToolsFigureRow[] = [
    { id: "passed", label: "Deadline passed", value: String(legal.passed), flagged: legal.passed > 0 },
    { id: "within-hour", label: dueLabel, value: String(legal.withinHour), flagged: legal.withinHour > 0 },
    {
      id: "severe",
      label: "Time limit or nowhere to go",
      value: String(counts.delays?.value ?? 0),
      flagged: (counts.delays?.value ?? 0) > 0,
    },
    {
      id: "stranded",
      label: "Long stay or ready but waiting",
      value: String(stranded.length),
      detail: "No expected discharge date, or a hold outside the ward",
    },
  ];

  const movement: ToolsFigureRow[] = [
    { id: "open", label: "Open movements", value: String(open.length) },
    {
      id: "transport",
      label: "Awaiting transport",
      value: String(transport?.movements.length ?? 0),
      flagged: (transport?.movements.length ?? 0) > 0,
    },
    {
      id: "pull-to-arrival",
      label: "Pull to arrival",
      value: arrival.averageMinutes === null ? "Not recorded" : minutesText(arrival.averageMinutes),
      detail:
        arrival.measuredCount > 0
          ? `Average of ${arrival.measuredCount} completed journeys`
          : arrival.awaitingArrivalCount > 0
            ? `${arrival.awaitingArrivalCount} still to arrive`
            : undefined,
    },
  ];

  return {
    scopeLabel: wardUnit
      ? (placeName ?? wardUnit.name)
      : role === "ed"
        ? (placeName ?? "This department")
        : "Whole network",
    networkContext,
    notAllEligible: role === "ed",
    occupancy: networkContext && networkOccupancy && role === "ed" ? networkOccupancy : occupancy,
    networkOccupancy: wardUnit ? networkOccupancy : undefined,
    services,
    beds,
    pressure,
    due,
    movement,
    bedKinds: bedKindGaps(movements, focusUnits, now).map((row) => ({
      id: row.id,
      need: row.need,
      waiting: row.waiting,
      bedsThatFit: row.bedsThatFit,
    })),
    duePassed: legal.passed,
    dueSoon: legal.withinHour,
  };
}
