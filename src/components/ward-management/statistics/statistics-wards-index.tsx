"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, BedDouble, CalendarClock, ChevronDown, ChevronUp, Lock } from "lucide-react";

import {
  BarList,
  CardBody,
  CardFoot,
  FilterChip,
  HeroStat,
  Icon,
  Segmented,
  SrOnly,
  StatusGlyph,
  cx,
  tableClasses,
} from "@/components/wf";
import { wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { bedIsOccupied } from "@/components/ward-management/ward-admissions";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { BED_STATE_LABELS, bedStates } from "@/components/ward-management/ward-bed-states";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { wardServiceOrder } from "@/components/ward-management/ward-derivations";
import type { HealthService } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";

import { admissionStagePosition } from "./statistics-derivations";
import { HeroTool } from "./statistics-hero-tools";
import { StatCard, StatisticsPage, useStatisticsLive } from "./statistics-hero";
import { FlushRow } from "./statistics-layout";
import { STATISTICS_COMPARE_HREF, statisticsSectionById } from "./statistics-sections";
import { ServiceDot } from "./statistics-services-index";
import styles from "./statistics-v6.module.css";
import index from "./statistics-index.module.css";

/** A sortable column head: the button inside carries the sort, the cell carries `aria-sort`. */
export function SortTh<K extends string>({
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

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

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
export function StatisticsWardsIndexScreen() {
  const section = statisticsSectionById("units");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'units' section");

  const live = useStatisticsLive();
  const { units, admissions, bedReleases, leaveBeds } = live.state;
  const now = live.now;

  const [sort, setSort] = useState<WardSortKey>("rate");
  const [asc, setAsc] = useState(false);
  const [group, setGroup] = useState<"service" | "none">("service");
  const [chips, setChips] = useState<ReadonlySet<WardChip>>(new Set());

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
          rate: unit.beds > 0 ? Math.round((states.occupied / unit.beds) * 100) : 0,
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
  type Row = (typeof rows)[number];

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
              : row.blocked > 0,
    );

  const sorted = useMemo(() => {
    const value = (row: Row): number | string =>
      sort === "name" ? row.name : sort === "longest" ? (row.longest ?? -1) : row[sort];
    return [...rows].sort((a, b) => {
      const left = value(a);
      const right = value(b);
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
  const blockedTotal = rows.reduce((total, row) => total + row.blocked, 0);
  const matched = count(matches);

  const byMean = rows
    .filter((row): row is Row & { mean: number } => row.mean !== null)
    .sort((a, b) => b.mean - a.mean)
    .slice(0, 10);
  const blockedRows = rows.filter((row) => row.blocked > 0).sort((a, b) => b.blocked - a.blocked);

  const chipItems: Array<{ id: WardChip; label: string; count: number; tone?: "warning" }> = [
    { id: "over", label: `Over ${BED_ALERT_THRESHOLD_PERCENT}%`, count: overLine, tone: "warning" },
    { id: "none-ready", label: "None ready", count: noneReady },
    { id: "pending", label: BED_STATE_LABELS.beingMadeReady, count: count((row) => row.pending > 0) },
    { id: "pulled", label: "Pulled, not arrived", count: count((row) => row.pulled > 0) },
    { id: "blocked", label: "Blocked discharge", count: count((row) => row.blocked > 0) },
  ];

  return (
    <StatisticsPage
      section={section}
      navSection="ward"
      testId="ward-statistics-wards-index"
      eyebrowLabel={`Statistics · ${units.length} ${plural(units.length, "ward", "wards")}`}
      title="All wards"
      now={now}
      paused={live.paused}
      onTogglePause={live.togglePause}
      tools={
        <HeroTool
          href={STATISTICS_COMPARE_HREF}
          icon={<ArrowLeftRight size={14} aria-hidden="true" />}
          testId="ward-statistics-wards-compare"
        >
          Compare wards
        </HeroTool>
      }
      stats={
        <>
          <HeroStat
            value={overLine}
            label={`Over ${BED_ALERT_THRESHOLD_PERCENT}%`}
            tone={overLine > 0 ? "warning" : undefined}
          />
          <HeroStat value={noneReady} label="None ready" />
          <HeroStat
            value={readyBeds}
            label={pendingBeds > 0 ? `Ready beds, ${pendingBeds} being made ready` : "Ready beds"}
          />
          <HeroStat value={pulledBeds} label="Pulled, not arrived" />
          <HeroStat value={blockedTotal} label="Blocked discharges" />
        </>
      }
    >
      <StatCard
        icon={BedDouble}
        id="every-ward"
        className={index.anchorTarget}
        title="Every ward"
        aside={<span className={cx(styles.muted, index.phoneHide)}>Sort by any column. Open a ward for its page.</span>}
        data-testid="ward-statistics-wards-table-card"
      >
        <div className={styles.toolbar}>
          <div className={index.chips} role="group" aria-label="Highlight wards">
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
          <Segmented
            label="Group wards"
            value={group}
            onChange={setGroup}
            items={[
              { id: "service", label: "By service" },
              { id: "none", label: "One list" },
            ]}
          />
          <span className={index.matchCount} data-testid="ward-statistics-wards-match-count">
            {chips.size > 0 ? `${matched} of ${rows.length} highlighted` : `${rows.length} wards`}
          </span>
        </div>
        <div className={index.tableScroll} tabIndex={0} role="region" aria-label="Every ward, scrollable">
          <table className={cx(tableClasses.table, styles.table)} data-testid="ward-statistics-wards-table">
            <caption className={styles.srOnly}>
              Every inpatient ward: beds, occupancy, ready, being made ready, pulled, closed, blocked discharges and the
              longest current stay
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
              {groups.map((entry) => (
                <Fragment key={entry.service ?? "all"}>
                  {group === "service" ? (
                    <tr className={index.groupRow}>
                      <th scope="colgroup" colSpan={10}>
                        <span className={index.groupLabel}>
                          <ServiceDot service={entry.service} />
                          {entry.service ?? "Service not recorded"}
                          <span className={styles.muted}>{entry.rows.length}</span>
                        </span>
                      </th>
                    </tr>
                  ) : null}
                  {entry.rows.map((row) => {
                    const hit = matches(row);
                    return (
                      <tr key={row.id} className={hit ? index.match : undefined} data-match={hit || undefined}>
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
                              <span className={styles.occTick} style={{ left: `${BED_ALERT_THRESHOLD_PERCENT}%` }} />
                            </span>
                            <span className={styles.occValue}>
                              {row.rate >= BED_ALERT_THRESHOLD_PERCENT ? <StatusGlyph tone="warning" size={9} /> : null}
                              {row.rate}%
                            </span>
                          </span>
                        </td>
                        <td className={cx(styles.num, row.ready === 0 && styles.zero)}>{row.ready}</td>
                        <td className={cx(styles.num, row.pending === 0 && styles.zero)}>{row.pending}</td>
                        <td className={cx(styles.num, row.pulled === 0 && styles.zero)}>{row.pulled}</td>
                        <td className={cx(styles.num, row.closed === 0 && styles.zero)}>{row.closed}</td>
                        <td className={cx(styles.num, row.blocked === 0 && styles.zero)}>{row.blocked}</td>
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
        <CardFoot
          meta={`Ready includes beds being made ready. Highlighting never hides a ward. Stays count whole days since arrival.`}
        />
      </StatCard>

      <FlushRow layout="halves">
        <StatCard
          icon={CalendarClock}
          id="mean-stay"
          className={index.anchorTarget}
          title="Mean stay by ward"
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
          title="Blocked discharges"
          aside={<span className={cx(styles.muted, index.phoneHide)}>{blockedTotal} in all</span>}
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
                rows={blockedRows.map((row) => ({ id: row.id, label: row.name, value: row.blocked }))}
              />
            )}
          </CardBody>
        </StatCard>
      </FlushRow>
    </StatisticsPage>
  );
}
