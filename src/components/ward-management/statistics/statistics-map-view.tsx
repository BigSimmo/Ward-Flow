"use client";

import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, ChevronRight, Clock, Lock, ListOrdered, Map as MapIcon, Stethoscope, X } from "lucide-react";

import {
  BarList,
  Button,
  CardBody,
  ColumnChart,
  Segmented,
  SrOnly,
  StatusGlyph,
  cx,
  durMinutes,
  type ChoiceItem,
} from "@/components/wf";
import {
  edStatisticsHref,
  serviceStatisticsHref,
  wardStatisticsHref,
} from "@/components/ward-management/shell/ward-facade";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import type { Admission } from "@/components/ward-management/ward-admissions";
import {
  calendarDateOf,
  dayOf,
  formatInstant,
  MINUTES_PER_DAY,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import type {
  BedRelease,
  EmergencyDepartment,
  HealthService,
  LeaveBed,
  Movement,
  Unit,
} from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import { wardStatistics } from "@/components/ward-management/ward-statistics";

import { blockedDischargesByReason } from "./statistics-derivations";
import {
  LONG_WAIT_HOURS,
  VERY_LONG_WAIT_HOURS,
  edJourneyWaitFigures as edWaitFigures,
  type EdWaitingEntry,
} from "./statistics-ed-waits";
import { StatisticsEdSwarm } from "./statistics-ed-swarm";
import { StatCard, useStatisticsLive } from "./statistics-hero";
import { FlushRow, Follow } from "./statistics-layout";
import { occupiedBeds } from "./statistics-occupancy";
import { StatisticsWaMap, type WaMapNode } from "./statistics-wa-map";
import styles from "./statistics-map-view.module.css";
import { useExecutiveStatistics, useExecutiveStatisticsControl } from "./executive-statistics-context";
import type { ExecutiveReportingFoundation } from "./executive-statistics-contract";
import {
  ExecutiveStatisticsUnavailable,
  PeopleNotListed,
  exactStatisticsCount,
  statisticsCountText,
  sumStatisticsCounts,
  withheldBar,
  type StatisticsCount,
} from "./statistics-small-numbers";
import { useCanOpenHref } from "../shell/ward-access";
import { useEffectiveWardAccess } from "../shell/ward-access-store";

export type MapLens = "beds" | "ed" | "dis" | "stay";

const SERVICE_COLOUR: Readonly<Record<HealthService, string>> = {
  "North Metro": "var(--wf-svc-north)",
  "South Metro": "var(--wf-svc-south)",
  "East Metro": "var(--wf-svc-east)",
  WACHS: "var(--wf-svc-wachs)",
  CAHS: "var(--wf-svc-cahs)",
  Private: "var(--wf-svc-private)",
};

/** "Royal Perth Hospital" reads "Royal Perth"; "St John of God Midland Public Hospital" reads "St John of God Midland". */
export const shortSite = (name: string) =>
  name.replace(/ (Public |Memorial |General )?(Hospital|Health Campus|Health Service)$/, "");

/** Whole days to one decimal, as "47.3d". */
// W-3 (fresh audit 26 Oct 2026): one unit word for a stay, "days", never "d".
const daysText = (days: number) => `${days.toFixed(1)} days`;

type WardFigures<Count = number> = {
  unit: Pick<Unit, "id" | "name">;
  ready: number;
  /** Beds in use: Occupied + Pulled (`ward-occupancy.ts`). */
  occupied: number;
  pct: number;
  dischargedToday: Count;
  dueToday: Count;
  meanStay: number | null;
};

/** One site's figures for every lens. Every number comes from the synthetic state. */
type SiteFigureData<Count> = {
  code: string;
  name: string;
  service: HealthService;
  wards: WardFigures<Count>[];
  ed: (Pick<EmergencyDepartment, "id"> & { openable?: boolean }) | undefined;
  beds: number;
  /** Beds in use: Occupied + Pulled (`ward-occupancy.ts`). */
  occupied: number;
  pct: number;
  ready: number;
  wardsOverLine: number;
  edWaiting: Count;
  edLongest: number | null;
  edOver24: Count;
  edOver48: Count;
  edEntries: readonly EdWaitingEntry[];
  dischargedToday: Count;
  dueToday: Count;
  blocked: Count;
  meanStay: number | null;
  longStays: Count;
};
export type SiteFigures = SiteFigureData<number>;
type PresentedSiteFigures = SiteFigureData<StatisticsCount>;
type MapNetwork = Pick<
  PresentedSiteFigures,
  | "beds"
  | "occupied"
  | "pct"
  | "ready"
  | "wardsOverLine"
  | "edWaiting"
  | "edOver24"
  | "edOver48"
  | "dischargedToday"
  | "dueToday"
  | "blocked"
  | "meanStay"
  | "longStays"
> & { preparing: number; longest: PresentedSiteFigures | null };

/** Gone today: left the ward on today's date. The hero's "Discharged today" uses the same rule. */
const leftToday = (admission: Admission, now: Instant) =>
  admission.leftAt !== null && dayOf(admission.leftAt) === dayOf(now);

/**
 * Due later today: still on the ward (not pulled, not departed) with a written discharge date later
 * today. The ward page's Expected discharges uses the same rule for its first day.
 */
const dueLaterToday = (admission: Admission, now: Instant) =>
  admission.state !== "departed" &&
  admission.state !== "pulled" &&
  admission.expectedDischargeAt !== null &&
  Number.isFinite(admission.expectedDischargeAt) &&
  admission.expectedDischargeAt >= now &&
  dayOf(admission.expectedDischargeAt) === dayOf(now);

/**
 * Pools a set of wards' admissions under one id so `wardStatistics` gives the set's own mean stay and
 * long-stay count, rather than an average of averages.
 */
function pooledStay(admissions: readonly Admission[], unitIds: ReadonlySet<string>, now: Instant) {
  const pooled = admissions
    .filter((admission) => unitIds.has(admission.unitId))
    .map((admission) => ({ ...admission, unitId: "pooled" }));
  const figures = wardStatistics("pooled", pooled, now);
  return { meanStay: figures.averageLengthOfStayDays, longStays: figures.longStays };
}

export function siteFigures({
  units,
  admissions,
  bedReleases,
  leaveBeds,
  movements,
  now,
}: {
  units: readonly Unit[];
  admissions: readonly Admission[];
  bedReleases: BedRelease[];
  leaveBeds: readonly LeaveBed[];
  movements: readonly Movement[];
  now: Instant;
}): SiteFigures[] {
  const eds = allEmergencyDepartments();
  const codes = [...new Set([...units.map((unit) => unit.siteCode), ...eds.map((ed) => ed.siteCode)])];
  return codes.flatMap((code) => {
    const site = siteByCode(code);
    if (!site) return [];
    const siteUnits = units.filter((unit) => unit.siteCode === code);
    const wards: WardFigures[] = siteUnits.map((unit) => {
      // L1 (site review, 12 Oct 2026): beds in use, Occupied + Pulled — the one occupancy count
      // (`ward-occupancy.ts`), so every percentage and the over-the-line count below agree with Home.
      const occupied = occupiedBeds([unit], admissions, bedReleases, leaveBeds).inUse;
      const onWard = admissions.filter((admission) => admission.unitId === unit.id);
      return {
        unit,
        ready: unitCapacity(unit, bedReleases).available,
        occupied,
        pct: unit.beds > 0 ? Math.round((occupied / unit.beds) * 100) : 0,
        dischargedToday: onWard.filter((admission) => leftToday(admission, now)).length,
        dueToday: onWard.filter((admission) => dueLaterToday(admission, now)).length,
        meanStay: wardStatistics(unit.id, [...admissions], now).averageLengthOfStayDays,
      };
    });
    const unitIds = new Set(siteUnits.map((unit) => unit.id));
    const onSite = admissions.filter((admission) => unitIds.has(admission.unitId));
    const beds = siteUnits.reduce((sum, unit) => sum + unit.beds, 0);
    const occupied = wards.reduce((sum, ward) => sum + ward.occupied, 0);
    const ed = eds.find((department) => department.siteCode === code);
    const edFigures = ed ? edWaitFigures(movements, ed.id, now) : null;
    const stay = siteUnits.length > 0 ? pooledStay(admissions, unitIds, now) : { meanStay: null, longStays: 0 };
    return [
      {
        code,
        name: shortSite(site.name),
        service: site.service,
        wards,
        ed,
        beds,
        occupied,
        pct: beds > 0 ? Math.round((occupied / beds) * 100) : 0,
        ready: wards.reduce((sum, ward) => sum + ward.ready, 0),
        wardsOverLine: wards.filter((ward) => ward.pct >= BED_ALERT_THRESHOLD_PERCENT).length,
        edWaiting: edFigures?.onTheList ?? 0,
        edLongest: edFigures?.longestWait?.waitMinutes ?? null,
        edOver24: edFigures?.over24h ?? 0,
        edOver48: edFigures?.over48h ?? 0,
        edEntries: edFigures?.waitingMovements ?? [],
        dischargedToday: wards.reduce((sum, ward) => sum + ward.dischargedToday, 0),
        dueToday: wards.reduce((sum, ward) => sum + ward.dueToday, 0),
        // Still holding a bed and blocked. `blockedDischargesByReason` is the one rule for "still holding".
        blocked: blockedDischargesByReason(onSite).totalCount,
        meanStay: stay.meanStay,
        longStays: stay.longStays,
      },
    ];
  });
}

/** Whether a lens applies to a site: the ED lens needs an ED, the rest need a ward. */
const applies = (site: PresentedSiteFigures, lens: MapLens) =>
  lens === "ed" ? site.ed !== undefined : site.wards.length > 0;

/** The figure a lens ranks and sizes by. */
export function lensValue(site: SiteFigures, lens: MapLens): number {
  if (lens === "ed") return site.edWaiting;
  if (lens === "beds") return site.ready;
  if (lens === "dis") return site.dischargedToday + site.dueToday;
  return site.meanStay ?? 0;
}

const displayedLensValue = (site: PresentedSiteFigures, lens: MapLens): StatisticsCount =>
  lens === "ed"
    ? site.edWaiting
    : lens === "beds"
      ? site.ready
      : lens === "dis"
        ? sumStatisticsCounts([site.dischargedToday, site.dueToday])
        : (site.meanStay ?? 0);
const compareSites = (a: PresentedSiteFigures, b: PresentedSiteFigures, lens: MapLens) => {
  const left = exactStatisticsCount(displayedLensValue(a, lens));
  const right = exactStatisticsCount(displayedLensValue(b, lens));
  return left === null || right === null
    ? a.name.localeCompare(b.name)
    : right - left || (lens === "ed" ? (b.edLongest ?? 0) - (a.edLongest ?? 0) : 0) || a.name.localeCompare(b.name);
};

const lensDisplay = (site: PresentedSiteFigures, lens: MapLens): string =>
  lens === "stay"
    ? site.meanStay === null
      ? "none"
      : site.meanStay.toFixed(0)
    : String(statisticsCountText(displayedLensValue(site, lens)));

const lensSub = (site: PresentedSiteFigures, lens: MapLens): string => {
  if (lens === "beds") return `${site.pct}% · ${site.ready} ready`;
  if (lens === "ed")
    return site.edLongest === null ? "none waiting" : `${durMinutes(Math.round(site.edLongest))} longest`;
  if (lens === "dis")
    return `${statisticsCountText(site.dischargedToday)} gone · ${statisticsCountText(site.dueToday)} due`;
  return `${statisticsCountText(site.longStays)} over 3 mo`;
};

const lensRing = (site: PresentedSiteFigures, lens: MapLens): number => {
  if (lens === "beds") return site.beds > 0 ? site.occupied / site.beds : 0;
  if (lens === "ed") return site.edLongest === null ? 0 : site.edLongest / (48 * 60);
  if (lens === "dis") {
    const gone = exactStatisticsCount(site.dischargedToday);
    const due = exactStatisticsCount(site.dueToday);
    return gone !== null && due !== null && gone + due > 0 ? gone / (gone + due) : 0;
  }
  const long = exactStatisticsCount(site.longStays);
  return site.occupied > 0 && long !== null ? long / site.occupied : 0;
};

/** Shape-coded status. Red only where somebody must act now: an ED wait past 48 hours. */
const lensStatus = (site: PresentedSiteFigures, lens: MapLens): WaMapNode["status"] => {
  if (lens === "ed")
    return (exactStatisticsCount(site.edOver48) ?? 0) > 0
      ? "danger"
      : (exactStatisticsCount(site.edOver24) ?? 0) > 0
        ? "warning"
        : undefined;
  if (lens === "beds") return site.wardsOverLine > 0 ? "warning" : undefined;
  if (lens === "dis") return (exactStatisticsCount(site.blocked) ?? 0) > 0 ? "warning" : undefined;
  return undefined;
};

const lensAria = (site: PresentedSiteFigures, lens: MapLens): string => {
  if (!applies(site, lens)) return `${site.name}, ${lens === "ed" ? "no ED" : "no ward"}`;
  if (lens === "beds")
    return `${site.name}: ${site.ready} ready beds, ${site.pct}% occupied${site.wardsOverLine ? `, ${site.wardsOverLine} ${site.wardsOverLine === 1 ? "ward" : "wards"} at or over ${BED_ALERT_THRESHOLD_PERCENT}%` : ""}`;
  if (lens === "ed")
    return `${site.name} ED: ${statisticsCountText(site.edWaiting)} open ED journeys${site.edLongest === null ? "" : `, longest ${durMinutes(Math.round(site.edLongest))}`}${exactStatisticsCount(site.edOver24) !== 0 ? `, ${statisticsCountText(site.edOver24)} over ${LONG_WAIT_HOURS} hours` : ""}`;
  if (lens === "dis")
    return `${site.name}: ${statisticsCountText(site.dischargedToday)} discharged today, ${statisticsCountText(site.dueToday)} due later today${exactStatisticsCount(site.blocked) !== 0 ? `, ${statisticsCountText(site.blocked)} blocked` : ""}`;
  return `${site.name}: average stay ${site.meanStay === null ? "none" : `${site.meanStay.toFixed(1)} days`}, ${statisticsCountText(site.longStays)} over 3 months`;
};

const LENSES: ReadonlyArray<{ id: MapLens; label: string; rankTitle: string; key: string }> = [
  {
    id: "beds",
    label: "Beds",
    rankTitle: "Most ready beds",
    key: `Ring: occupancy. Centre: ready beds. Amber dot: a ward at or over ${BED_ALERT_THRESHOLD_PERCENT}%.`,
  },
  {
    id: "ed",
    label: "Open ED journeys",
    rankTitle: "Most open ED journeys",
    key: `Ring: longest time since opening, to ${VERY_LONG_WAIT_HOURS}h. Centre: open ED journeys. Amber dot: over ${LONG_WAIT_HOURS}h. Triangle: over ${VERY_LONG_WAIT_HOURS}h.`,
  },
  {
    id: "dis",
    label: "Discharge",
    rankTitle: "Most discharges today",
    key: "Ring: share already gone. Centre: gone or due today. Amber dot: a blocked discharge.",
  },
  {
    id: "stay",
    label: "Stay",
    rankTitle: "Longest average stay",
    key: "Ring: share over 3 months. Centre: average stay in days, everyone who arrived, people who have left included.",
  },
];

/** The ward a rank row opens: the one that leads this site on the lens. */
function leadWard(site: PresentedSiteFigures, lens: MapLens): WardFigures<StatisticsCount> | undefined {
  const score = (ward: WardFigures<StatisticsCount>) =>
    lens === "beds"
      ? ward.ready
      : lens === "dis"
        ? exactStatisticsCount(sumStatisticsCounts([ward.dischargedToday, ward.dueToday]))
        : (ward.meanStay ?? -1);
  return [...site.wards].sort((a, b) => {
    const left = score(a);
    const right = score(b);
    return left === null || right === null
      ? a.unit.name.localeCompare(b.unit.name)
      : right - left || a.unit.name.localeCompare(b.unit.name);
  })[0];
}

type Headline = { value: string; label: string; tone?: "warning" | "danger" };

/**
 * Summary, Map view: every site across WA on one map, with lenses for beds, ED waits, discharges and
 * length of stay, and a ranked list beside it. Reached with the view bar or #map.
 */
type MapViewProps = { live?: { state: ReturnType<typeof useStatisticsLive>["state"]; now: Instant } };

export function StatisticsMapView(props: MapViewProps = {}) {
  const control = useExecutiveStatisticsControl();
  const data = useExecutiveStatistics();
  const access = useEffectiveWardAccess();
  if (control.executive || access.role === "executive")
    return data ? <ExecutiveMapView data={data} /> : <ExecutiveStatisticsUnavailable />;
  return <OperationalMapView {...props} />;
}

function OperationalMapView({
  live: liveProp,
}: {
  /** The page's own live state, so pausing the hero holds the map too. Read here when absent. */
  live?: { state: ReturnType<typeof useStatisticsLive>["state"]; now: Instant };
} = {}) {
  const ownLive = useStatisticsLive();
  const live = liveProp ?? ownLive;
  const { admissions, bedReleases, movements, leaveBeds, units, dayZero } = live.state;
  const now = live.now;

  const sites = useMemo(
    () => siteFigures({ units, admissions, bedReleases, leaveBeds, movements, now }),
    [units, admissions, bedReleases, leaveBeds, movements, now],
  );

  const network = useMemo(() => {
    const beds = sites.reduce((sum, site) => sum + site.beds, 0);
    const occupied = sites.reduce((sum, site) => sum + site.occupied, 0);
    const longest = sites.reduce<SiteFigures | null>(
      (best, site) =>
        site.edLongest !== null && (best === null || (best.edLongest ?? 0) < site.edLongest) ? site : best,
      null,
    );
    const stay = pooledStay(admissions, new Set(units.map((unit) => unit.id)), now);
    return {
      beds,
      occupied,
      pct: beds > 0 ? Math.round((occupied / beds) * 100) : 0,
      ready: sites.reduce((sum, site) => sum + site.ready, 0),
      preparing: units.reduce((sum, unit) => sum + bedsPendingPreparation(unit.id, bedReleases), 0),
      wardsOverLine: sites.reduce((sum, site) => sum + site.wardsOverLine, 0),
      edWaiting: sites.reduce((sum, site) => sum + site.edWaiting, 0),
      edOver24: sites.reduce((sum, site) => sum + site.edOver24, 0),
      edOver48: sites.reduce((sum, site) => sum + site.edOver48, 0),
      longest,
      dischargedToday: sites.reduce((sum, site) => sum + site.dischargedToday, 0),
      dueToday: sites.reduce((sum, site) => sum + site.dueToday, 0),
      blocked: sites.reduce((sum, site) => sum + site.blocked, 0),
      meanStay: stay.meanStay,
      longStays: stay.longStays,
    };
  }, [sites, admissions, bedReleases, units, now]);

  return <MapPresentation {...{ sites, network, admissions, now, dayZero }} />;
}

function ExecutiveMapView({ data }: { data: ExecutiveReportingFoundation }) {
  const sites: PresentedSiteFigures[] = data.sites.map((site) => ({
    code: site.code,
    name: shortSite(site.name),
    service: site.service,
    wards: data.wards
      .filter((ward) => site.wardIds.includes(ward.id))
      .map((ward) => ({
        unit: { id: ward.id, name: ward.name },
        ready: ward.beds.ready,
        occupied: ward.beds.inUse,
        pct: ward.beds.total > 0 ? Math.round((ward.beds.inUse / ward.beds.total) * 100) : 0,
        dischargedToday: ward.dischargedToday,
        dueToday: ward.dueToday,
        meanStay: ward.statistics.averageLengthOfStayDays,
      })),
    ed: site.edId ? { id: site.edId, openable: data.openableEmergencyDepartmentIds.includes(site.edId) } : undefined,
    beds: site.beds.total,
    occupied: site.beds.inUse,
    pct: site.beds.total > 0 ? Math.round((site.beds.inUse / site.beds.total) * 100) : 0,
    ready: site.beds.ready,
    wardsOverLine: site.wardsOverLine,
    edWaiting: site.edWaiting,
    edLongest: site.edLongest,
    edOver24: site.edOver24,
    edOver48: site.edOver48,
    edEntries: [],
    dischargedToday: site.dischargedToday,
    dueToday: site.dueToday,
    blocked: site.blocked,
    meanStay: site.meanStay,
    longStays: site.longStays,
  }));
  const beds = data.network.beds;
  const longest =
    sites.filter((site) => site.edLongest !== null).sort((a, b) => (b.edLongest ?? 0) - (a.edLongest ?? 0))[0] ?? null;
  const network: MapNetwork = {
    beds: beds.total,
    occupied: beds.inUse,
    pct: beds.total > 0 ? Math.round((beds.inUse / beds.total) * 100) : 0,
    ready: beds.ready,
    preparing: beds.beingMadeReady,
    wardsOverLine: sites.reduce((sum, site) => sum + site.wardsOverLine, 0),
    edWaiting: data.networkDetails.listedEdJourneys,
    edOver24: data.networkDetails.listedOver24h,
    edOver48: sumStatisticsCounts(sites.map((site) => site.edOver48)),
    longest,
    dischargedToday: data.network.people.admissionsEndedToday,
    dueToday: sumStatisticsCounts(sites.map((site) => site.dueToday)),
    blocked: data.networkDetails.blockedTotal,
    meanStay: data.networkDetails.pooledAverageStayDays,
    longStays: data.networkDetails.longStayTotal,
  };
  return (
    <MapPresentation
      sites={sites}
      network={network}
      admissions={[]}
      now={data.network.asAt.now}
      dayZero={new Date(data.network.asAt.dayZero)}
      aggregate={data}
    />
  );
}

function MapPresentation({
  sites,
  network,
  admissions,
  now,
  dayZero,
  aggregate,
}: {
  sites: readonly PresentedSiteFigures[];
  network: MapNetwork;
  admissions: readonly Admission[];
  now: Instant;
  dayZero: Date;
  aggregate?: ExecutiveReportingFoundation;
}) {
  const [lens, setLens] = useState<MapLens>("beds");
  // Every row links only where this desk may open the page (access audit, 31 Oct 2026).
  const canOpen = useCanOpenHref();
  const [selected, setSelected] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const lensInfo = LENSES.find((item) => item.id === lens) ?? LENSES[0]!;
  const lensItems: ChoiceItem<MapLens>[] = [
    { id: "beds", label: "Beds", count: network.ready },
    { id: "ed", label: "Open ED journeys", count: statisticsCountText(network.edWaiting) },
    {
      id: "dis",
      label: "Discharge",
      count: statisticsCountText(sumStatisticsCounts([network.dischargedToday, network.dueToday])),
    },
    { id: "stay", label: "Stay", count: network.meanStay === null ? "none" : daysText(network.meanStay) },
  ];

  const headline: Headline[] =
    lens === "beds"
      ? [
          {
            value: String(network.ready),
            label: network.preparing > 0 ? `Ready beds, ${network.preparing} being made ready` : "Ready beds",
          },
          { value: `${network.pct}%`, label: "Occupied" },
          {
            value: String(network.wardsOverLine),
            label: `Wards at or over ${BED_ALERT_THRESHOLD_PERCENT}%`,
            tone: network.wardsOverLine ? "warning" : undefined,
          },
        ]
      : lens === "ed"
        ? [
            { value: String(statisticsCountText(network.edWaiting)), label: "Open ED journeys" },
            {
              value: network.longest?.edLongest == null ? "none" : durMinutes(Math.round(network.longest.edLongest)),
              label: network.longest ? `Longest, ${network.longest.name}` : "Longest",
              tone: (exactStatisticsCount(network.edOver48) ?? 0) > 0 ? "danger" : undefined,
            },
            {
              value: String(statisticsCountText(network.edOver24)),
              label: `Over ${LONG_WAIT_HOURS}h`,
              tone: (exactStatisticsCount(network.edOver24) ?? 0) > 0 ? "warning" : undefined,
            },
          ]
        : lens === "dis"
          ? [
              { value: String(statisticsCountText(network.dischargedToday)), label: "Gone today" },
              { value: String(statisticsCountText(network.dueToday)), label: "Due later today" },
              {
                value: String(statisticsCountText(network.blocked)),
                label: "Blocked",
                tone: (exactStatisticsCount(network.blocked) ?? 0) > 0 ? "warning" : undefined,
              },
            ]
          : [
              { value: network.meanStay === null ? "none" : daysText(network.meanStay), label: "Average stay" },
              { value: String(statisticsCountText(network.longStays)), label: "Over 3 months" },
              { value: String(network.occupied), label: "Beds in use" },
            ];

  const nodes: WaMapNode[] = sites.map((site) => ({
    code: site.code,
    name: site.name,
    colour: SERVICE_COLOUR[site.service],
    applies: applies(site, lens),
    value: applies(site, lens) ? (exactStatisticsCount(displayedLensValue(site, lens)) ?? 0) : 0,
    display: lensDisplay(site, lens),
    sub: lensSub(site, lens),
    ring: lensRing(site, lens),
    status: applies(site, lens) ? lensStatus(site, lens) : undefined,
    ariaLabel: lensAria(site, lens),
  }));

  const ranked = sites.filter((site) => applies(site, lens)).sort((a, b) => compareSites(a, b, lens));

  const chosen = selected ? sites.find((site) => site.code === selected) : undefined;
  const asAt = formatInstant(now);

  return (
    <section id="map" aria-label="Map" data-testid="ward-statistics-map-view" className={styles.view}>
      <FlushRow layout="lead3">
        <StatCard
          id="map-canvas"
          icon={MapIcon}
          title="Network map"
          meta="Choose a site for its wards and ED"
          className={styles.mapCard}
          data-testid="ward-statistics-map-canvas"
        >
          <CardBody className={styles.mapBody}>
            <div className={styles.lensRow}>
              <Segmented
                items={lensItems}
                value={lens}
                onChange={(next) => {
                  setLens(next);
                  setHighlighted(null);
                }}
                label="Map lens"
                className={styles.lenses}
              />
              <span className={styles.key}>{lensInfo.key}</span>
            </div>
            <div className={styles.headline} data-testid="ward-statistics-map-headline">
              <span className={styles.eyebrow}>
                {lensInfo.label} · as at {asAt}
              </span>
              <dl className={styles.figures}>
                {headline.map((item) => (
                  <div key={item.label} className={styles.figure}>
                    <dt className={styles.figureLabel}>
                      {item.tone ? <StatusGlyph tone={item.tone} size={9} /> : null}
                      {item.label}
                    </dt>
                    <dd className={styles.figureValue}>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <StatisticsWaMap
              nodes={nodes}
              selected={selected}
              highlighted={highlighted}
              onSelect={(code) => setSelected((current) => (current === code ? null : code))}
              label={`${lensInfo.label} by site`}
            />
          </CardBody>
        </StatCard>

        <Follow stack={chosen !== undefined} className={styles.side}>
          {chosen ? <SiteCard site={chosen} lens={lens} onClose={() => setSelected(null)} /> : null}
          <StatCard
            id="map-rank"
            icon={ListOrdered}
            title={lensInfo.rankTitle}
            meta={`${ranked.length} ${lens === "ed" ? "EDs" : "sites"}`}
            data-testid="ward-statistics-map-rank"
          >
            <CardBody flush>
              <ol className={styles.rank}>
                {ranked.map((site, index) => {
                  const ward = lens === "ed" ? undefined : leadWard(site, lens);
                  const targetHref =
                    lens === "ed" && site.ed && site.ed.openable !== false
                      ? edStatisticsHref(site.ed.id)
                      : ward
                        ? wardStatisticsHref(ward.unit.id)
                        : null;
                  const href = targetHref !== null && canOpen(targetHref) ? targetHref : null;
                  const target = lens === "ed" ? `${site.name} ED` : ward ? ward.unit.name : site.name;
                  const more = lens === "ed" ? 0 : site.wards.length - 1;
                  const status = lensStatus(site, lens);
                  const content = (
                    <>
                      <span className={styles.rankNo}>{index + 1}</span>
                      <span
                        className={styles.rankDot}
                        style={{ background: SERVICE_COLOUR[site.service] }}
                        aria-hidden="true"
                      />
                      <span className={styles.rankWho}>
                        <span className={styles.rankName}>{site.name}</span>
                        <span className={styles.rankSub}>
                          {lens === "ed" ? lensSub(site, lens) : `${target}${more > 0 ? ` and ${more} more` : ""}`}
                        </span>
                      </span>
                      <span className={styles.rankValue}>
                        {status ? <StatusGlyph tone={status} size={9} /> : null}
                        {lens === "stay"
                          ? site.meanStay === null
                            ? "none"
                            : daysText(site.meanStay)
                          : statisticsCountText(displayedLensValue(site, lens))}
                      </span>
                      {href ? <ChevronRight size={14} aria-hidden="true" className={styles.rankChev} /> : null}
                    </>
                  );
                  return (
                    <li key={site.code}>
                      {href ? (
                        <Link
                          href={href}
                          className={cx(
                            styles.rankRow,
                            (selected === site.code || highlighted === site.code) && styles.rankOn,
                          )}
                          onMouseEnter={() => setHighlighted(site.code)}
                          onMouseLeave={() => setHighlighted(null)}
                          onFocus={() => setHighlighted(site.code)}
                          onBlur={() => setHighlighted(null)}
                          data-testid={`ward-statistics-map-rank-${site.code}`}
                        >
                          {content}
                          <SrOnly>{`. ${lensAria(site, lens)}. Opens ${target} statistics.`}</SrOnly>
                        </Link>
                      ) : (
                        <span className={styles.rankRow}>{content}</span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </CardBody>
          </StatCard>
        </Follow>
      </FlushRow>

      <BelowMap lens={lens} sites={sites} admissions={admissions} now={now} dayZero={dayZero} aggregate={aggregate} />
    </section>
  );
}

/** The chosen site: its wards and ED, each a link to its statistics page. */
function SiteCard({ site, lens, onClose }: { site: PresentedSiteFigures; lens: MapLens; onClose: () => void }) {
  const canOpen = useCanOpenHref();
  const edLinked = site.ed !== undefined && site.ed.openable !== false && canOpen(edStatisticsHref(site.ed.id));
  const edContent = (
    <>
      <span className={styles.siteName}>{statisticsCountText(site.edWaiting)} open ED journeys</span>
      <span className={styles.siteFig}>
        {(exactStatisticsCount(site.edOver48) ?? 0) > 0 ? (
          <StatusGlyph tone="danger" size={9} />
        ) : (exactStatisticsCount(site.edOver24) ?? 0) > 0 ? (
          <StatusGlyph tone="warning" size={9} />
        ) : null}
        {site.edLongest === null ? "none" : `${durMinutes(Math.round(site.edLongest))} longest`}
      </span>
      {edLinked ? <ChevronRight size={14} aria-hidden="true" /> : null}
    </>
  );
  return (
    <StatCard
      icon={Stethoscope}
      title={site.name}
      meta={`${site.service}${site.beds ? ` · ${site.beds} beds` : ""}`}
      data-testid="ward-statistics-map-site"
      action={
        <Button variant="ghost" size="sm" iconOnly icon={X} onClick={onClose} aria-label={`Close ${site.name}`} />
      }
    >
      <CardBody className={styles.siteBody}>
        <SrOnly>{lensAria(site, lens)}</SrOnly>
        {site.wards.length > 0 ? (
          <div className={styles.siteGroup}>
            <span className={styles.siteLabel}>Wards</span>
            {site.wards.map((ward) => {
              const href = wardStatisticsHref(ward.unit.id);
              const figures = (
                <>
                  <span className={styles.siteName}>{ward.unit.name}</span>
                  <span className={styles.siteFig}>
                    {ward.pct >= BED_ALERT_THRESHOLD_PERCENT ? <StatusGlyph tone="warning" size={9} /> : null}
                    {ward.pct}% · {ward.ready} ready
                  </span>
                </>
              );
              return canOpen(href) ? (
                <Link key={ward.unit.id} href={href} className={styles.siteRow}>
                  {figures}
                  <ChevronRight size={14} aria-hidden="true" />
                </Link>
              ) : (
                <div key={ward.unit.id} className={styles.siteRow}>
                  {figures}
                </div>
              );
            })}
          </div>
        ) : null}
        {site.ed ? (
          <div className={styles.siteGroup}>
            <span className={styles.siteLabel}>Emergency department</span>
            {!edLinked ? (
              <div className={styles.siteRow}>{edContent}</div>
            ) : (
              <Link href={edStatisticsHref(site.ed.id)} className={styles.siteRow}>
                {edContent}
              </Link>
            )}
          </div>
        ) : null}
        {site.wards.length > 0 && canOpen(serviceStatisticsHref(site.service)) ? (
          <Link href={serviceStatisticsHref(site.service)} className={styles.siteService}>
            {site.service} statistics
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        ) : null}
      </CardBody>
    </StatCard>
  );
}

/** What sits under the map changes with the lens, so the lens reads end to end. */
function BelowMap({
  lens,
  sites,
  admissions,
  now,
  dayZero,
  aggregate,
}: {
  lens: MapLens;
  sites: readonly PresentedSiteFigures[];
  admissions: readonly Admission[];
  now: Instant;
  dayZero: Date;
  aggregate?: ExecutiveReportingFoundation;
}) {
  const canOpen = useCanOpenHref();
  if (lens === "ed") {
    if (aggregate)
      return (
        <StatCard
          id="map-below"
          icon={Clock}
          title="Open ED journeys, by ED"
          aside={`${aggregate.emergencyDepartments.length} EDs`}
          data-testid="ward-statistics-map-below"
        >
          <CardBody>
            <PeopleNotListed />
            <ul>
              {aggregate.emergencyDepartments.map((ed) => (
                <li key={ed.id}>
                  {aggregate.openableEmergencyDepartmentIds.includes(ed.id) && canOpen(edStatisticsHref(ed.id)) ? (
                    <Link href={edStatisticsHref(ed.id)}>
                      {ed.name}: {statisticsCountText(ed.onTheList)}
                    </Link>
                  ) : (
                    <span>
                      {ed.name}: {statisticsCountText(ed.onTheList)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </StatCard>
      );
    const rows = sites
      .filter((site) => site.ed !== undefined)
      .sort((a, b) => compareSites(a, b, "ed"))
      .map((site) => ({
        id: site.ed!.id,
        name: site.name,
        href: canOpen(edStatisticsHref(site.ed!.id)) ? edStatisticsHref(site.ed!.id) : undefined,
        entries: site.edEntries,
      }));
    return (
      <StatCard
        id="map-below"
        icon={Clock}
        title="Open ED journeys, by ED"
        aside={`${rows.length} EDs`}
        data-testid="ward-statistics-map-below"
      >
        <CardBody>
          <StatisticsEdSwarm rows={rows} testId="ward-statistics-map-ed-swarm" />
        </CardBody>
      </StatCard>
    );
  }

  if (lens === "dis") {
    if (aggregate) {
      const columns = Array.from({ length: 7 }, (_, offset) => {
        const date = calendarDateOf(now + offset * MINUTES_PER_DAY, dayZero);
        const count = sumStatisticsCounts(
          aggregate.wards.map((ward) => ward.dueByDay.find((day) => day.offset === offset)!.count),
        );
        const shown = statisticsCountText(count);
        return {
          id: `day-${offset}`,
          label:
            offset === 0
              ? "Today"
              : date.toLocaleDateString("en-AU", { weekday: "short", timeZone: "Australia/Perth" }),
          ...withheldBar(exactStatisticsCount(count) ?? 0, shown),
        };
      });
      const blocked = aggregate.networkDetails.blocked;
      return (
        <FlushRow layout="halves" id="map-below" data-testid="ward-statistics-map-below">
          <StatCard icon={CalendarClock} title="Expected discharges" aside="Next 7 days">
            <CardBody>
              <ColumnChart columns={columns} gridlines label="Expected discharges across the network, next 7 days" />
            </CardBody>
          </StatCard>
          <StatCard icon={Lock} title="Discharges held up" aside={`${statisticsCountText(blocked.total)} not departed`}>
            <CardBody>
              <BarList
                label="Discharges held up, by reason"
                labelWidth="min(15rem, 42%)"
                rows={blocked.byReason.map((tally) => ({
                  id: tally.reason,
                  label: tally.reason,
                  ...withheldBar(exactStatisticsCount(tally.count) ?? 0, statisticsCountText(tally.count)),
                }))}
              />
            </CardBody>
          </StatCard>
        </FlushRow>
      );
    }
    const today = dayOf(now);
    const current = admissions.filter((admission) => admission.state !== "departed" && admission.state !== "pulled");
    const columns = Array.from({ length: 7 }, (_, offset) => {
      const date = calendarDateOf(now + offset * MINUTES_PER_DAY, dayZero);
      return {
        id: `day-${offset}`,
        label:
          offset === 0 ? "Today" : date.toLocaleDateString("en-AU", { weekday: "short", timeZone: "Australia/Perth" }),
        value: current.filter(
          (admission) =>
            admission.expectedDischargeAt !== null &&
            Number.isFinite(admission.expectedDischargeAt) &&
            admission.expectedDischargeAt >= now &&
            dayOf(admission.expectedDischargeAt) === today + offset,
        ).length,
      };
    });
    const blocked = blockedDischargesByReason([...admissions]);
    return (
      <FlushRow layout="halves" id="map-below" data-testid="ward-statistics-map-below">
        <StatCard icon={CalendarClock} title="Expected discharges" aside="Next 7 days">
          <CardBody>
            <ColumnChart columns={columns} gridlines label="Expected discharges across the network, next 7 days" />
          </CardBody>
        </StatCard>
        <StatCard icon={Lock} title="Discharges held up" aside={`${blocked.totalCount} not departed`}>
          <CardBody>
            <BarList
              label="Discharges held up, by reason"
              labelWidth="min(15rem, 42%)"
              rows={blocked.tallies.map((tally) => ({ id: tally.reason, label: tally.reason, value: tally.count }))}
            />
          </CardBody>
        </StatCard>
      </FlushRow>
    );
  }

  if (lens === "stay") {
    const wards = sites
      .flatMap((site) => site.wards.map((ward) => ({ ward, site })))
      .filter(({ ward }) => ward.meanStay !== null)
      .sort((a, b) => (b.ward.meanStay ?? 0) - (a.ward.meanStay ?? 0))
      .slice(0, 10);
    return (
      <StatCard
        id="map-below"
        icon={Clock}
        title="Average stay by ward"
        aside="Top 10, days"
        data-testid="ward-statistics-map-below"
      >
        <CardBody>
          <BarList
            label="Average stay by ward, top 10"
            labelWidth="min(14rem, 42%)"
            axis
            rows={wards.map(({ ward, site }) => ({
              id: ward.unit.id,
              label: canOpen(wardStatisticsHref(ward.unit.id)) ? (
                <Link href={wardStatisticsHref(ward.unit.id)}>{ward.unit.name}</Link>
              ) : (
                ward.unit.name
              ),
              labelText: ward.unit.name,
              sub: site.name,
              value: ward.meanStay ?? 0,
              display: daysText(ward.meanStay ?? 0),
            }))}
          />
        </CardBody>
      </StatCard>
    );
  }

  // Beds: ready beds by health service, every service with a ward.
  const services = [...new Set(sites.filter((site) => site.wards.length > 0).map((site) => site.service))].map(
    (service) => {
      const own = sites.filter((site) => site.service === service);
      const beds = own.reduce((sum, site) => sum + site.beds, 0);
      const occupied = own.reduce((sum, site) => sum + site.occupied, 0);
      return {
        service,
        ready: own.reduce((sum, site) => sum + site.ready, 0),
        pct: beds > 0 ? Math.round((occupied / beds) * 100) : 0,
        wards: own.reduce((sum, site) => sum + site.wards.length, 0),
      };
    },
  );
  return (
    <StatCard
      id="map-below"
      icon={MapIcon}
      title="Ready beds by health service"
      aside={`as at ${formatInstant(now)}`}
      data-testid="ward-statistics-map-below"
    >
      <CardBody>
        <BarList
          label="Ready beds by health service"
          labelWidth="min(12rem, 42%)"
          rows={services
            .sort((a, b) => b.ready - a.ready || a.service.localeCompare(b.service))
            .map((row) => ({
              id: row.service,
              label: canOpen(serviceStatisticsHref(row.service)) ? (
                <Link href={serviceStatisticsHref(row.service)}>{row.service}</Link>
              ) : (
                row.service
              ),
              labelText: row.service,
              sub: `${row.pct}% occupied · ${row.wards} ${row.wards === 1 ? "ward" : "wards"}`,
              value: row.ready,
              fill: "ready",
            }))}
        />
      </CardBody>
    </StatCard>
  );
}
