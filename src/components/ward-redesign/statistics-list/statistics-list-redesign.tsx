"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, BedDouble, CalendarClock, ChevronDown, ChevronUp, Lock } from "lucide-react";

import {
  BarList,
  Button,
  CardBody,
  CardFoot,
  FilterChip,
  HeroStat,
  GroupHead,
  Icon,
  PhoneListRow,
  Segmented,
  SrOnly,
  StatusGlyph,
  cx,
  tableClasses,
  rowDim,
  useIsPhone,
} from "@/components/wf";
import { wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { bedIsOccupied } from "@/components/ward-management/ward-admissions";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { BED_STATE_LABELS, bedStates } from "@/components/ward-management/ward-bed-states";
import { wardBedsInUse } from "@/components/ward-management/ward-occupancy";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { wardServiceOrder } from "@/components/ward-management/ward-derivations";
import type { HealthService } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";

import { admissionStagePosition } from "@/components/ward-management/statistics/statistics-derivations";
import { HeroTool } from "@/components/ward-management/statistics/statistics-hero-tools";
import { StatCard, StatisticsPage, useStatisticsLive } from "@/components/ward-management/statistics/statistics-hero";
import { FlushRow } from "@/components/ward-management/statistics/statistics-layout";
import {
  STATISTICS_COMPARE_HREF,
  statisticsSectionById,
} from "@/components/ward-management/statistics/statistics-sections";
import { ServiceDot } from "@/components/ward-management/statistics/statistics-services-index";
import {
  PhoneBody,
  PhoneDotKey,
  PhoneList,
  phoneBodyStyles as phone,
} from "@/components/ward-management/statistics/statistics-phone-parts";
import styles from "@/components/ward-management/statistics/statistics-v6.module.css";
import index from "@/components/ward-management/statistics/statistics-index.module.css";
import list from "./statistics-list-redesign.module.css";
import {
  useExecutiveStatistics,
  useExecutiveStatisticsControl,
} from "@/components/ward-management/statistics/executive-statistics-context";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import {
  ExecutiveStatisticsUnavailable,
  statisticsCountText,
  exactStatisticsCount,
  sumStatisticsCounts,
  withheldBar,
  type StatisticsCount,
} from "@/components/ward-management/statistics/statistics-small-numbers";

/** A sortable column head: the button inside carries the sort, the cell carries `aria-sort`. */
function SortTh<K extends string>({
  id,
  label,
  sort,
  asc,
  onSort,
  numeric = false,
}: {
  id: K;
  label: string;
  sort: K;
  asc: boolean;
  onSort: (id: K) => void;
  numeric?: boolean;
}) {
  const active = sort === id;
  return (
    <th
      scope="col"
      className={cx(styles.sortTh, numeric && styles.num)}
      aria-sort={active ? (asc ? "ascending" : "descending") : "none"}
    >
      <button type="button" onClick={() => onSort(id)}>
        {label}
        {active ? <Icon icon={asc ? ChevronUp : ChevronDown} size={14} /> : null}
      </button>
    </th>
  );
}

type WardSortKey =
  "name" | "beds" | "occupied" | "rate" | "ready" | "pending" | "pulled" | "closed" | "blocked" | "longest";
type WardChip = "over" | "none-ready" | "pending" | "pulled" | "blocked";

/** Whole days in a bed so far, or null for someone not yet arrived (or a clock wound back). */
function stayDays(arrivedAt: number | null, now: number): number | null {
  if (arrivedAt === null || arrivedAt > now) return null;
  return Math.floor((now - arrivedAt) / MINUTES_PER_DAY);
}

const plural = (count: StatisticsCount, one: string, many: string) => (count === 1 ? one : many);

/** Redesign: how much of the list shows before Show more. */
const FIRST_SERVICES = 2;
const FIRST_ROWS = 8;

/**
 * ALL WARDS — the Wards index page (Statistics A, 9 Oct 2026).
 *
 * Every ward on one table, each row the way into that ward's own page. The bed figures are the
 * ruled boxes from `bedStates`, so Ready, Pulled, Closed and Occupied add up to the ward's beds.
 * Being made ready comes from `bedsPendingPreparation` and is already counted inside Ready. A
 * blocked discharge is a current admission carrying a block reason. Stays are measured from the
 * recorded arrival to the board time, for people in a bed now.
 *
 * ⚠️ **The filter chips HIGHLIGHT matching rows and never hide one** (owner rule): a ward that is
 * not shown cannot be seen to be fine.
 */

type WardIndexRow = {
  id: string;
  name: string;
  hospital: string;
  code: string;
  service: HealthService | undefined;
  beds: number;
  occupied: number;
  inUse: number;
  rate: number;
  ready: number;
  pending: number;
  pulled: number;
  closed: number;
  blocked: StatisticsCount;
  longest: number | null;
  mean: number | null;
};
export function StatisticsListRedesign() {
  const control = useExecutiveStatisticsControl();
  const access = useEffectiveWardAccess();
  return control.executive || access.role === "executive" ? <ExecutiveWardsIndex /> : <OperationalWardsIndex />;
}
function ExecutiveWardsIndex() {
  const data = useExecutiveStatistics();
  const control = useExecutiveStatisticsControl();
  if (!data) return <ExecutiveStatisticsUnavailable />;
  const rows: WardIndexRow[] = data.wards.map((ward) => ({
    id: ward.id,
    name: ward.name,
    hospital: data.catalogue.sites.find((site) => site.code === ward.siteCode)?.name ?? ward.siteCode,
    code: ward.siteCode,
    service: ward.service,
    beds: ward.beds.total,
    occupied: ward.beds.occupied,
    inUse: ward.beds.inUse,
    rate: ward.beds.total > 0 ? Math.round((ward.beds.inUse / ward.beds.total) * 100) : 0,
    ready: ward.beds.ready,
    pending: ward.pendingPreparation,
    pulled: ward.beds.pulled,
    closed: ward.beds.closed,
    blocked: ward.blocked,
    longest: ward.longestStayDays,
    mean: ward.meanCurrentStayDays,
  }));
  return (
    <WardsIndexView
      rows={rows}
      now={data.network.asAt.now}
      paused={control.paused}
      togglePause={control.togglePause}
      scopeLabel={data.network.scope.kind === "service" ? data.network.scope.service : undefined}
      releasedBlockedTotal={data.networkDetails.blockedTotal}
    />
  );
}
function OperationalWardsIndex() {
  const live = useStatisticsLive();
  const { units, admissions, bedReleases, leaveBeds } = live.state;
  const now = live.now;
  const rows = useMemo(
    () =>
      units.map((unit) => {
        const site = siteByCode(unit.siteCode);
        const states = bedStates(unit, admissions, bedReleases, leaveBeds);
        const current = admissions.filter(
          (admission) => admission.unitId === unit.id && admissionStagePosition(admission) !== "ended",
        );
        const stays = current
          .filter((admission) => bedIsOccupied(admission))
          .map((admission) => stayDays(admission.arrivedAt, now))
          .filter((days): days is number => days !== null);
        return {
          id: unit.id,
          name: unit.name,
          hospital: site?.name ?? unit.siteCode,
          code: unit.siteCode,
          service: site?.service as HealthService | undefined,
          beds: unit.beds,
          occupied: states.occupied,
          // L1: the rate is the one occupancy count, Occupied + Pulled (`ward-occupancy.ts`).
          inUse: wardBedsInUse(unit, admissions, bedReleases),
          rate: unit.beds > 0 ? Math.round((wardBedsInUse(unit, admissions, bedReleases) / unit.beds) * 100) : 0,
          ready: states.ready,
          pending: bedsPendingPreparation(unit.id, bedReleases),
          pulled: states.pulled,
          closed: states.closed,
          blocked: current.filter((admission) => admission.blockReason !== null).length,
          longest: stays.length > 0 ? Math.max(...stays) : null,
          mean: stays.length > 0 ? stays.reduce((total, days) => total + days, 0) / stays.length : null,
        };
      }),
    [units, admissions, bedReleases, leaveBeds, now],
  );

  return <WardsIndexView rows={rows} now={now} paused={live.paused} togglePause={live.togglePause} />;
}
function WardsIndexView({
  rows,
  now,
  paused,
  togglePause,
  scopeLabel,
  releasedBlockedTotal,
}: {
  rows: WardIndexRow[];
  now: number;
  paused: boolean;
  togglePause: (() => void) | null;
  scopeLabel?: string;
  releasedBlockedTotal?: StatisticsCount;
}) {
  const section = statisticsSectionById("units");
  if (!section) throw new Error("statistics-sections.ts no longer defines the units section");
  const shown = (count: StatisticsCount) => statisticsCountText(count);
  const positive = (count: StatisticsCount) => {
    const exact = exactStatisticsCount(count);
    return exact === null || exact > 0;
  };
  const [sort, setSort] = useState<WardSortKey>("rate");
  const [asc, setAsc] = useState(false);
  const [group, setGroup] = useState<"service" | "none">("service");
  const [chips, setChips] = useState<ReadonlySet<WardChip>>(new Set());
  const [showMore, setShowMore] = useState(false);
  const [blockedAll, setBlockedAll] = useState(false);
  const isPhone = useIsPhone();

  type Row = WardIndexRow;

  const matches = (row: Row) =>
    chips.size > 0 &&
    [...chips].every((chip) =>
      chip === "over"
        ? row.rate >= BED_ALERT_THRESHOLD_PERCENT
        : chip === "none-ready"
          ? row.ready === 0
          : chip === "pending"
            ? row.pending > 0
            : chip === "pulled"
              ? row.pulled > 0
              : positive(row.blocked),
    );

  const sorted = useMemo(() => {
    const value = (row: Row): number | string | null =>
      sort === "name"
        ? row.name
        : sort === "longest"
          ? (row.longest ?? -1)
          : sort === "blocked"
            ? exactStatisticsCount(row.blocked)
            : row[sort];
    return [...rows].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      if (left === null || right === null)
        return left === right ? a.name.localeCompare(b.name) : left === null ? 1 : -1;
      if (left < right) return asc ? -1 : 1;
      if (left > right) return asc ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [rows, sort, asc]);

  const groups =
    group === "service"
      ? [
          ...wardServiceOrder.map((service) => ({
            service: service as HealthService | undefined,
            rows: sorted.filter((row) => row.service === service),
          })),
          { service: undefined, rows: sorted.filter((row) => row.service === undefined) },
        ].filter((entry) => entry.rows.length > 0)
      : [{ service: undefined, rows: sorted }];

  // Redesign: a long list opens on its first rows. By service shows the first two services and One
  // list its first eight wards, the rest behind Show more. A pressed chip shows every ward, because
  // highlighting never hides one.
  const everything = showMore || chips.size > 0;
  const visibleGroups = everything
    ? groups
    : group === "service"
      ? groups.slice(0, FIRST_SERVICES)
      : groups.map((entry) => ({ ...entry, rows: entry.rows.slice(0, FIRST_ROWS) }));
  const visibleCount = visibleGroups.reduce((total, entry) => total + entry.rows.length, 0);
  const hiddenServices = groups.length - visibleGroups.length;
  const moreLabel = showMore
    ? "Show fewer"
    : group === "service"
      ? `Show ${hiddenServices} more ${plural(hiddenServices, "service", "services")}, ${rows.length - visibleCount} ${plural(rows.length - visibleCount, "ward", "wards")}`
      : `Show all ${rows.length} wards`;
  const moreButton =
    chips.size > 0 || (group === "service" ? groups.length <= FIRST_SERVICES : rows.length <= FIRST_ROWS) ? null : (
      <Button
        variant="ghost"
        size="sm"
        className={list.more}
        aria-expanded={showMore}
        onClick={() => setShowMore((more) => !more)}
      >
        {moreLabel}
      </Button>
    );

  const onSort = (key: WardSortKey) => {
    if (key === sort) setAsc((value) => !value);
    else {
      setSort(key);
      setAsc(key === "name");
    }
  };
  const toggleChip = (chip: WardChip, pressed: boolean) =>
    setChips((current) => {
      const next = new Set(current);
      if (pressed) next.add(chip);
      else next.delete(chip);
      return next;
    });

  const count = (test: (row: Row) => boolean) => rows.filter(test).length;
  const overLine = count((row) => row.rate >= BED_ALERT_THRESHOLD_PERCENT);
  const noneReady = count((row) => row.ready === 0);
  const readyBeds = rows.reduce((total, row) => total + row.ready, 0);
  const pendingBeds = rows.reduce((total, row) => total + row.pending, 0);
  const pulledBeds = rows.reduce((total, row) => total + row.pulled, 0);
  const blockedTotal = releasedBlockedTotal ?? sumStatisticsCounts(rows.map((row) => row.blocked));
  const matched = count(matches);

  const byMean = rows
    .filter((row): row is Row & { mean: number } => row.mean !== null)
    .sort((a, b) => b.mean - a.mean)
    .slice(0, 10);
  const blockedRows = rows
    .filter((row) => positive(row.blocked))
    .sort((a, b) => (exactStatisticsCount(b.blocked) ?? -1) - (exactStatisticsCount(a.blocked) ?? -1));

  const chipItems: Array<{ id: WardChip; label: string; count: number; tone?: "warning" }> = [
    { id: "over", label: `At or over ${BED_ALERT_THRESHOLD_PERCENT}%`, count: overLine, tone: "warning" },
    { id: "none-ready", label: "None ready", count: noneReady },
    // These count wards, so they say so: the hero's "Pulled, not arrived" counts beds (UX audit 21 Oct 2026).
    { id: "pending", label: "With a bed being made ready", count: count((row) => row.pending > 0) },
    { id: "pulled", label: "With a pulled bed", count: count((row) => row.pulled > 0) },
    { id: "blocked", label: "With a discharge held up", count: count((row) => positive(row.blocked)) },
  ];

  return (
    <StatisticsPage
      section={section}
      navSection="ward"
      testId="ward-statistics-wards-index"
      eyebrowLabel={`Statistics · ${rows.length} ${plural(rows.length, "ward", "wards")}`}
      title="All wards"
      eyebrowDetail={scopeLabel}
      now={now}
      paused={paused}
      onTogglePause={togglePause ?? undefined}
      tools={
        <HeroTool
          href={STATISTICS_COMPARE_HREF}
          icon={<ArrowLeftRight size={14} aria-hidden="true" />}
          testId="ward-statistics-wards-compare"
        >
          Compare wards
        </HeroTool>
      }
      phone={{
        // Redesign: the title names the page, as on desktop. It said "14 wards over 85%", the same
        // fact as the Over 85% figure under it, which stays because it is the phone's highlight toggle.
        title: "All wards",
        sub: `${readyBeds} ready ${plural(readyBeds, "bed", "beds")} · ${shown(blockedTotal)} ${plural(blockedTotal, "discharge", "discharges")} held up`,
        stats: (
          <>
            <HeroStat
              value={overLine}
              label={`Over ${BED_ALERT_THRESHOLD_PERCENT}%`}
              tone={overLine > 0 ? "warning" : undefined}
              onToggle={() => toggleChip("over", !chips.has("over"))}
              pressed={chips.has("over")}
            />
            <HeroStat
              value={noneReady}
              label="None ready"
              onToggle={() => toggleChip("none-ready", !chips.has("none-ready"))}
              pressed={chips.has("none-ready")}
            />
            {/* Phone review F-24: "Pulled" alone is shorthand; the desktop label says what it means. */}
            <HeroStat value={pulledBeds} label="Pulled, not arrived" />
          </>
        ),
      }}
      stats={
        <>
          <HeroStat
            value={overLine}
            label={`At or over ${BED_ALERT_THRESHOLD_PERCENT}%`}
            tone={overLine > 0 ? "warning" : undefined}
          />
          <HeroStat value={noneReady} label="None ready" />
          <HeroStat
            value={readyBeds}
            label={pendingBeds > 0 ? `Ready beds, ${pendingBeds} being made ready` : "Ready beds"}
          />
          <HeroStat value={pulledBeds} label="Pulled, not arrived" />
          <HeroStat value={shown(blockedTotal)} label="Discharges held up" />
        </>
      }
    >
      {isPhone ? (
        <PhoneBody testId="ward-statistics-wards-phone">
          <div className={phone.chips} role="group" aria-label="Highlight wards">
            {chipItems
              .filter((chip) => chip.id === "pulled" || chip.id === "blocked")
              .map((chip) => (
                <FilterChip
                  key={chip.id}
                  pressed={chips.has(chip.id)}
                  onPressedChange={(pressed) => toggleChip(chip.id, pressed)}
                >
                  {chip.label}
                </FilterChip>
              ))}
          </div>
          {chips.size > 0 ? (
            <p className={phone.highlightLine} data-testid="ward-statistics-wards-match-count">
              {`${matched} of ${rows.length} highlighted, all rows stay`}
              <button type="button" className={phone.clear} onClick={() => setChips(new Set())}>
                Clear
              </button>
            </p>
          ) : null}
          <Segmented<"service" | "none">
            className={phone.seg}
            size="md"
            label="Group wards"
            value={group}
            onChange={(next) => {
              setGroup(next);
              if (next === "none") {
                setSort("rate");
                setAsc(false);
              }
            }}
            items={[
              { id: "service", label: "By service" },
              // Redesign: the desktop switch's own words, so one control has one name.
              { id: "none", label: "One list" },
            ]}
          />
          <PhoneList label="Every ward">
            {visibleGroups.map((entry) => (
              <Fragment key={entry.service ?? "all"}>
                {group === "service" ? (
                  <li className={phone.listHead}>
                    <GroupHead
                      title={
                        // Redesign: no service colour dot beside the service's own name (calm colour).
                        <span className={phone.dotName}>{entry.service ?? "Service not recorded"}</span>
                      }
                      aside={<b className={phone.mono}>{entry.rows.length}</b>}
                    />
                  </li>
                ) : null}
                {entry.rows.map((row) => {
                  const hit = matches(row);
                  return (
                    <PhoneListRow
                      key={row.id}
                      as="li"
                      className={cx(chips.size > 0 && !hit && phone.dim)}
                      name={row.name}
                      // Redesign: "held up", the hero's word, and only the parts that are not nought.
                      meta={[
                        row.hospital.replace(
                          / (Memorial |General |Public )?(Hospital|Health Campus|Health Service)$/u,
                          "",
                        ),
                        row.ready > 0 ? `${row.ready} ready` : null,
                        positive(row.blocked) ? `${shown(row.blocked)} held up` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      value={
                        <span className={phone.flagged}>
                          {row.rate >= BED_ALERT_THRESHOLD_PERCENT ? <StatusGlyph tone="warning" size={9} /> : null}
                          {row.rate}%
                        </span>
                      }
                      time={`${row.inUse} of ${row.beds}`}
                      href={wardStatisticsHref(row.id)}
                    />
                  );
                })}
              </Fragment>
            ))}
          </PhoneList>
          {moreButton}
          <PhoneDotKey testId="ward-statistics-wards-dot-key">
            {`Amber dot: ${BED_ALERT_THRESHOLD_PERCENT}% or more of beds in use`}
          </PhoneDotKey>
        </PhoneBody>
      ) : (
        <>
          <StatCard
            icon={BedDouble}
            id="every-ward"
            className={index.anchorTarget}
            title="Every ward"
            aside={
              <span className={list.headTools}>
                <span className={index.matchCount} data-testid="ward-statistics-wards-match-count">
                  {chips.size > 0 ? `${matched} of ${rows.length} highlighted` : `${rows.length} wards`}
                </span>
                <Segmented
                  label="Group wards"
                  value={group}
                  onChange={setGroup}
                  items={[
                    { id: "service", label: "By service" },
                    { id: "none", label: "One list" },
                  ]}
                />
              </span>
            }
            data-testid="ward-statistics-wards-table-card"
          >
            <div className={cx(styles.toolbar, list.chipRow)}>
              <div className={list.chips} role="group" aria-label="Highlight wards">
                {chipItems.map((chip) => (
                  <FilterChip
                    key={chip.id}
                    pressed={chips.has(chip.id)}
                    onPressedChange={(pressed) => toggleChip(chip.id, pressed)}
                    count={chip.count}
                    tone={chip.tone}
                  >
                    {chip.label}
                  </FilterChip>
                ))}
              </div>
            </div>
            <div className={index.tableScroll} tabIndex={0} role="region" aria-label="Every ward, scrollable">
              <table className={cx(tableClasses.table, styles.table)} data-testid="ward-statistics-wards-table">
                <caption className={styles.srOnly}>
                  Every inpatient ward: beds, occupancy, ready, being made ready, pulled, closed, blocked discharges and
                  the longest current stay
                </caption>
                <thead>
                  <tr>
                    <SortTh id="name" label="Ward" sort={sort} asc={asc} onSort={onSort} />
                    <SortTh id="beds" label="Beds" sort={sort} asc={asc} onSort={onSort} numeric />
                    <SortTh id="occupied" label="Occupied" sort={sort} asc={asc} onSort={onSort} numeric />
                    <SortTh id="rate" label="Occupancy" sort={sort} asc={asc} onSort={onSort} numeric />
                    <SortTh id="ready" label={BED_STATE_LABELS.ready} sort={sort} asc={asc} onSort={onSort} numeric />
                    <SortTh id="pending" label="Making ready" sort={sort} asc={asc} onSort={onSort} numeric />
                    <SortTh id="pulled" label={BED_STATE_LABELS.pulled} sort={sort} asc={asc} onSort={onSort} numeric />
                    <SortTh id="closed" label={BED_STATE_LABELS.closed} sort={sort} asc={asc} onSort={onSort} numeric />
                    <SortTh id="blocked" label="Blocked" sort={sort} asc={asc} onSort={onSort} numeric />
                    <SortTh id="longest" label="Longest stay" sort={sort} asc={asc} onSort={onSort} numeric />
                  </tr>
                </thead>
                <tbody>
                  {visibleGroups.map((entry) => (
                    <Fragment key={entry.service ?? "all"}>
                      {group === "service" ? (
                        <tr className={index.groupRow}>
                          <th scope="colgroup" colSpan={10}>
                            <span className={index.groupLabel}>
                              {entry.service ?? "Service not recorded"}
                              <span className={styles.muted}>{entry.rows.length}</span>
                            </span>
                          </th>
                        </tr>
                      ) : null}
                      {entry.rows.map((row) => {
                        const hit = matches(row);
                        return (
                          <tr key={row.id} data-match={hit || undefined} {...rowDim(chips.size > 0 && !hit)}>
                            <th scope="row">
                              <span className={index.rowName}>
                                <Link href={wardStatisticsHref(row.id)} className={index.rowLink}>
                                  {row.name}
                                </Link>
                                <span className={index.rowSub}>
                                  {group === "none" ? <ServiceDot service={row.service} /> : null}
                                  {row.hospital}
                                </span>
                                {hit ? <SrOnly>Highlighted by the chosen filters.</SrOnly> : null}
                              </span>
                            </th>
                            <td className={styles.num}>{row.beds}</td>
                            <td className={styles.num}>{row.occupied}</td>
                            <td className={styles.num}>
                              <span className={styles.occBar}>
                                <span className={styles.occTrack} aria-hidden="true">
                                  <span className={styles.occFill} style={{ width: `${Math.min(100, row.rate)}%` }} />
                                  <span
                                    className={styles.occTick}
                                    style={{ left: `${BED_ALERT_THRESHOLD_PERCENT}%` }}
                                  />
                                </span>
                                <span className={styles.occValue}>
                                  {row.rate >= BED_ALERT_THRESHOLD_PERCENT ? (
                                    <StatusGlyph tone="warning" size={9} />
                                  ) : null}
                                  {row.rate}%
                                </span>
                              </span>
                            </td>
                            <td className={cx(styles.num, row.ready === 0 && styles.zero)}>{row.ready}</td>
                            <td className={cx(styles.num, row.pending === 0 && styles.zero)}>{row.pending}</td>
                            <td className={cx(styles.num, row.pulled === 0 && styles.zero)}>{row.pulled}</td>
                            <td className={cx(styles.num, row.closed === 0 && styles.zero)}>{row.closed}</td>
                            <td className={cx(styles.num, exactStatisticsCount(row.blocked) === 0 && styles.zero)}>
                              {shown(row.blocked)}
                            </td>
                            <td className={cx(styles.num, row.longest === null && styles.zero)}>
                              {row.longest === null ? "none" : `${row.longest}d`}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {moreButton ? <div className={list.moreRow}>{moreButton}</div> : null}
            <CardFoot
              meta={`Ready includes beds being made ready. Highlighting never hides a ward. Stays count whole days since arrival.`}
            />
          </StatCard>

          <FlushRow layout="halves">
            <StatCard
              icon={CalendarClock}
              id="mean-stay"
              className={index.anchorTarget}
              title="Stay so far, people in a bed now"
              aside={<span className={cx(styles.muted, index.phoneHide)}>Top 10, days</span>}
              data-testid="ward-statistics-wards-mean-stay"
            >
              <CardBody>
                {byMean.length === 0 ? (
                  <p className={index.cardNote}>Nobody with a recorded arrival is in a bed.</p>
                ) : (
                  <BarList
                    label="Mean stay so far of the people in a bed now, by ward, top ten"
                    track
                    labelWidth="9.5rem"
                    rows={byMean.map((row) => ({
                      id: row.id,
                      label: row.name,
                      value: row.mean,
                      display: row.mean.toFixed(1),
                    }))}
                  />
                )}
              </CardBody>
              <CardFoot meta="People in a bed now, from their recorded arrival." />
            </StatCard>

            <StatCard
              icon={Lock}
              id="blocked"
              className={index.anchorTarget}
              title="Discharges held up"
              aside={<span className={cx(styles.muted, index.phoneHide)}>{shown(blockedTotal)} in all</span>}
              data-testid="ward-statistics-wards-blocked"
            >
              <CardBody>
                {blockedRows.length === 0 ? (
                  <p className={index.cardNote}>No ward has a current admission with a block reason recorded.</p>
                ) : (
                  <BarList
                    label="Current admissions with a block reason, by ward"
                    track
                    labelWidth="9.5rem"
                    rows={(blockedAll ? blockedRows : blockedRows.slice(0, FIRST_ROWS)).map((row) => ({
                      id: row.id,
                      label: row.name,
                      ...withheldBar(exactStatisticsCount(row.blocked) ?? 0, shown(row.blocked)),
                    }))}
                  />
                )}
              </CardBody>
              {blockedRows.length > FIRST_ROWS ? (
                <CardFoot
                  meta={
                    <>
                      Showing <b>{blockedAll ? blockedRows.length : FIRST_ROWS}</b> of {blockedRows.length} wards
                    </>
                  }
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-expanded={blockedAll}
                    onClick={() => setBlockedAll((all) => !all)}
                  >
                    {blockedAll ? "Show fewer" : `Show all ${blockedRows.length}`}
                  </Button>
                </CardFoot>
              ) : null}
            </StatCard>
          </FlushRow>
        </>
      )}
    </StatisticsPage>
  );
}
