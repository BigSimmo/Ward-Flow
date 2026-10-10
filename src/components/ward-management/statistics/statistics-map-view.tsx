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
import { LONG_WAIT_HOURS, VERY_LONG_WAIT_HOURS, edWaitFigures, type EdWaitingEntry } from "./statistics-ed-waits";
import { StatisticsEdSwarm } from "./statistics-ed-swarm";
import { StatCard, useStatisticsLive } from "./statistics-hero";
import { FlushRow, Follow } from "./statistics-layout";
import { occupiedBeds } from "./statistics-occupancy";
import { StatisticsWaMap, type WaMapNode } from "./statistics-wa-map";
import styles from "./statistics-map-view.module.css";

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
const daysText = (days: number) => `${days.toFixed(1)}d`;

type WardFigures = {
  unit: Unit;
  ready: number;
  occupied: number;
  pct: number;
  dischargedToday: number;
  dueToday: number;
  meanStay: number | null;
};

/** One site's figures for every lens. Every number comes from the synthetic state. */
export type SiteFigures = {
  code: string;
  name: string;
  service: HealthService;
  wards: WardFigures[];
  ed: EmergencyDepartment | undefined;
  beds: number;
  occupied: number;
  pct: number;
  ready: number;
  wardsOverLine: number;
  edWaiting: number;
  edLongest: number | null;
  edOver24: number;
  edOver48: number;
  edEntries: readonly EdWaitingEntry[];
  dischargedToday: number;
  dueToday: number;
  blocked: number;
  meanStay: number | null;
  longStays: number;
};

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
      const occupied = occupiedBeds([unit], admissions, bedReleases, leaveBeds).occupied;
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
const applies = (site: SiteFigures, lens: MapLens) => (lens === "ed" ? site.ed !== undefined : site.wards.length > 0);

/** The figure a lens ranks and sizes by. */
export function lensValue(site: SiteFigures, lens: MapLens): number {
  if (lens === "ed") return site.edWaiting;
  if (lens === "beds") return site.ready;
  if (lens === "dis") return site.dischargedToday + site.dueToday;
  return site.meanStay ?? 0;
}

const lensDisplay = (site: SiteFigures, lens: MapLens): string =>
  lens === "stay" ? (site.meanStay === null ? "none" : site.meanStay.toFixed(0)) : String(lensValue(site, lens));

const lensSub = (site: SiteFigures, lens: MapLens): string => {
  if (lens === "beds") return `${site.pct}% · ${site.ready} ready`;
  if (lens === "ed")
    return site.edLongest === null ? "none waiting" : `${durMinutes(Math.round(site.edLongest))} longest`;
  if (lens === "dis") return `${site.dischargedToday} gone · ${site.dueToday} due`;
  return `${site.longStays} over 3 mo`;
};

const lensRing = (site: SiteFigures, lens: MapLens): number => {
  if (lens === "beds") return site.beds > 0 ? site.occupied / site.beds : 0;
  if (lens === "ed") return site.edLongest === null ? 0 : site.edLongest / (48 * 60);
  if (lens === "dis") {
    const total = site.dischargedToday + site.dueToday;
    return total > 0 ? site.dischargedToday / total : 0;
  }
  return site.occupied > 0 ? site.longStays / site.occupied : 0;
};

/** Shape-coded status. Red only where somebody must act now: an ED wait past 48 hours. */
const lensStatus = (site: SiteFigures, lens: MapLens): WaMapNode["status"] => {
  if (lens === "ed") return site.edOver48 > 0 ? "danger" : site.edOver24 > 0 ? "warning" : undefined;
  if (lens === "beds") return site.wardsOverLine > 0 ? "warning" : undefined;
  if (lens === "dis") return site.blocked > 0 ? "warning" : undefined;
  return undefined;
};

const lensAria = (site: SiteFigures, lens: MapLens): string => {
  if (!applies(site, lens)) return `${site.name}, ${lens === "ed" ? "no ED" : "no ward"}`;
  if (lens === "beds")
    return `${site.name}: ${site.ready} ready beds, ${site.pct}% occupied${site.wardsOverLine ? `, ${site.wardsOverLine} ward at or over ${BED_ALERT_THRESHOLD_PERCENT}%` : ""}`;
  if (lens === "ed")
    return `${site.name} ED: ${site.edWaiting} waiting${site.edLongest === null ? "" : `, longest ${durMinutes(Math.round(site.edLongest))}`}${site.edOver24 ? `, ${site.edOver24} over ${LONG_WAIT_HOURS} hours` : ""}`;
  if (lens === "dis")
    return `${site.name}: ${site.dischargedToday} discharged today, ${site.dueToday} due later today${site.blocked ? `, ${site.blocked} blocked` : ""}`;
  return `${site.name}: mean stay ${site.meanStay === null ? "none" : `${site.meanStay.toFixed(1)} days`}, ${site.longStays} over 3 months`;
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
    label: "ED waits",
    rankTitle: "Most waiting in ED",
    key: `Ring: longest wait, to ${VERY_LONG_WAIT_HOURS}h. Centre: people waiting. Amber dot: over ${LONG_WAIT_HOURS}h. Triangle: over ${VERY_LONG_WAIT_HOURS}h.`,
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
    rankTitle: "Longest mean stay",
    key: "Ring: share over 3 months. Centre: mean stay, days.",
  },
];

/** The ward a rank row opens: the one that leads this site on the lens. */
function leadWard(site: SiteFigures, lens: MapLens): WardFigures | undefined {
  const score = (ward: WardFigures) =>
    lens === "beds" ? ward.ready : lens === "dis" ? ward.dischargedToday + ward.dueToday : (ward.meanStay ?? -1);
  return [...site.wards].sort((a, b) => score(b) - score(a) || a.unit.name.localeCompare(b.unit.name))[0];
}

type Headline = { value: string; label: string; tone?: "warning" | "danger" };

/**
 * Summary, Map view: every site across WA on one map, with lenses for beds, ED waits, discharges and
 * length of stay, and a ranked list beside it. Reached with the view bar or #map.
 */
export function StatisticsMapView({
  live: liveProp,
}: {
  /** The page's own live state, so pausing the hero holds the map too. Read here when absent. */
  live?: { state: ReturnType<typeof useStatisticsLive>["state"]; now: Instant };
} = {}) {
  const ownLive = useStatisticsLive();
  const live = liveProp ?? ownLive;
  const { admissions, bedReleases, movements, leaveBeds, units, dayZero } = live.state;
  const now = live.now;

  const [lens, setLens] = useState<MapLens>("beds");
  const [selected, setSelected] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);

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

  const lensInfo = LENSES.find((item) => item.id === lens) ?? LENSES[0]!;
  const lensItems: ChoiceItem<MapLens>[] = [
    { id: "beds", label: "Beds", count: network.ready },
    { id: "ed", label: "ED waits", count: network.edWaiting },
    { id: "dis", label: "Discharge", count: network.dischargedToday + network.dueToday },
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
            { value: String(network.edWaiting), label: "Waiting in ED" },
            {
              value: network.longest?.edLongest == null ? "none" : durMinutes(Math.round(network.longest.edLongest)),
              label: network.longest ? `Longest, ${network.longest.name}` : "Longest",
              tone: network.edOver48 ? "danger" : undefined,
            },
            {
              value: String(network.edOver24),
              label: `Over ${LONG_WAIT_HOURS}h`,
              tone: network.edOver24 ? "warning" : undefined,
            },
          ]
        : lens === "dis"
          ? [
              { value: String(network.dischargedToday), label: "Gone today" },
              { value: String(network.dueToday), label: "Due later today" },
              { value: String(network.blocked), label: "Blocked", tone: network.blocked ? "warning" : undefined },
            ]
          : [
              { value: network.meanStay === null ? "none" : daysText(network.meanStay), label: "Mean stay" },
              { value: String(network.longStays), label: "Over 3 months" },
              { value: String(network.occupied), label: "In a bed" },
            ];

  const nodes: WaMapNode[] = sites.map((site) => ({
    code: site.code,
    name: site.name,
    colour: SERVICE_COLOUR[site.service],
    applies: applies(site, lens),
    value: applies(site, lens) ? lensValue(site, lens) : 0,
    display: lensDisplay(site, lens),
    sub: lensSub(site, lens),
    ring: lensRing(site, lens),
    status: applies(site, lens) ? lensStatus(site, lens) : undefined,
    ariaLabel: lensAria(site, lens),
  }));

  const ranked = sites
    .filter((site) => applies(site, lens))
    .sort(
      (a, b) =>
        lensValue(b, lens) - lensValue(a, lens) ||
        (lens === "ed" ? (b.edLongest ?? 0) - (a.edLongest ?? 0) : 0) ||
        a.name.localeCompare(b.name),
    );

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
                  const href =
                    lens === "ed" && site.ed
                      ? edStatisticsHref(site.ed.id)
                      : ward
                        ? wardStatisticsHref(ward.unit.id)
                        : null;
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
                          : lensValue(site, lens)}
                      </span>
                      <ChevronRight size={14} aria-hidden="true" className={styles.rankChev} />
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

      <BelowMap lens={lens} sites={sites} admissions={admissions} now={now} dayZero={dayZero} />
    </section>
  );
}

/** The chosen site: its wards and ED, each a link to its statistics page. */
function SiteCard({ site, lens, onClose }: { site: SiteFigures; lens: MapLens; onClose: () => void }) {
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
            {site.wards.map((ward) => (
              <Link key={ward.unit.id} href={wardStatisticsHref(ward.unit.id)} className={styles.siteRow}>
                <span className={styles.siteName}>{ward.unit.name}</span>
                <span className={styles.siteFig}>
                  {ward.pct >= BED_ALERT_THRESHOLD_PERCENT ? <StatusGlyph tone="warning" size={9} /> : null}
                  {ward.pct}% · {ward.ready} ready
                </span>
                <ChevronRight size={14} aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : null}
        {site.ed ? (
          <div className={styles.siteGroup}>
            <span className={styles.siteLabel}>Emergency department</span>
            <Link href={edStatisticsHref(site.ed.id)} className={styles.siteRow}>
              <span className={styles.siteName}>{site.edWaiting} waiting</span>
              <span className={styles.siteFig}>
                {site.edOver48 ? (
                  <StatusGlyph tone="danger" size={9} />
                ) : site.edOver24 ? (
                  <StatusGlyph tone="warning" size={9} />
                ) : null}
                {site.edLongest === null ? "none" : `${durMinutes(Math.round(site.edLongest))} longest`}
              </span>
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
          </div>
        ) : null}
        {site.wards.length > 0 ? (
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
}: {
  lens: MapLens;
  sites: readonly SiteFigures[];
  admissions: readonly Admission[];
  now: Instant;
  dayZero: Date;
}) {
  if (lens === "ed") {
    const rows = sites
      .filter((site) => site.ed !== undefined)
      .sort((a, b) => b.edWaiting - a.edWaiting || (b.edLongest ?? 0) - (a.edLongest ?? 0))
      .map((site) => ({
        id: site.ed!.id,
        name: site.name,
        href: edStatisticsHref(site.ed!.id),
        entries: site.edEntries,
      }));
    return (
      <StatCard
        id="map-below"
        icon={Clock}
        title="Everyone waiting, by ED"
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
        <StatCard icon={Lock} title="Blocked discharges" aside={`${blocked.totalCount} not departed`}>
          <CardBody>
            <BarList
              label="Blocked discharges by blocker"
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
        title="Mean stay by ward"
        aside="Top 10, days"
        data-testid="ward-statistics-map-below"
      >
        <CardBody>
          <BarList
            label="Mean length of stay by ward, top 10"
            labelWidth="min(14rem, 42%)"
            axis
            rows={wards.map(({ ward, site }) => ({
              id: ward.unit.id,
              label: <Link href={wardStatisticsHref(ward.unit.id)}>{ward.unit.name}</Link>,
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
              label: <Link href={serviceStatisticsHref(row.service)}>{row.service}</Link>,
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
