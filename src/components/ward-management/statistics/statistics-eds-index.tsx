"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Clock, Hospital, Users } from "lucide-react";

import { CardBody, CardFoot, ColumnChart, HeroStat, StatusGlyph, cx, durMinutes, tableClasses } from "@/components/wf";
import { edStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { LONG_WAIT_MINUTES, VERY_LONG_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";

import { ED_WAIT_BANDS, edWaitBands, edWaitFigures } from "./statistics-ed-waits";
import { StatisticsEdSwarm } from "./statistics-ed-swarm";
import { HeroTool } from "./statistics-hero-tools";
import { StatCard, StatisticsPage, useStatisticsLive } from "./statistics-hero";
import { FlushRow, Follow } from "./statistics-layout";
import { STATISTICS_COMPARE_HREF, statisticsSectionById } from "./statistics-sections";
import { ServiceDot } from "./statistics-services-index";
import { SortTh } from "./statistics-wards-index";
import styles from "./statistics-v6.module.css";
import index from "./statistics-index.module.css";

/** "Royal Perth Hospital Emergency Department" reads "Royal Perth"; the site code leads the row. */
const shortName = (name: string) =>
  name
    .replace(/ Emergency Department$/u, "")
    .replace(/ (Memorial |General )?(Hospital|Health Campus|Health Service)$/u, "");

const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** A wait as "7d 1h" or "4h 17m", or "none" when nobody is waiting. */
const waitText = (minutes: number | null) => (minutes === null ? "none" : durMinutes(Math.round(minutes)));

/** The long-wait lines in whole hours, from the named defaults rather than typed here. */
const LONG_HOURS = LONG_WAIT_MINUTES / 60;
const VERY_LONG_HOURS = VERY_LONG_WAIT_MINUTES / 60;

type EdSortKey = "name" | "waiting" | "unplaced" | "over24" | "over48" | "longest" | "median";

/**
 * ALL EMERGENCY DEPARTMENTS — the EDs index page (Statistics A, 9 Oct 2026).
 *
 * The roomy wait field across the full card width (Josh, 9 Oct 2026: the old field of dots was
 * messy), then every department in a table, each the way into its own page. Every figure is
 * `edWaitFigures` over the live movements: waiting is the open population, "no ward yet" is the
 * open movements no ward has accepted, and the long-wait counts OVERLAP (anyone past the second line
 * is past the first), so they are shown side by side and never summed.
 */
export function StatisticsEdsIndexScreen() {
  const section = statisticsSectionById("units");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'units' section");

  const live = useStatisticsLive();
  const { movements } = live.state;
  const now = live.now;

  const [sort, setSort] = useState<EdSortKey>("waiting");
  const [asc, setAsc] = useState(false);

  const departments = useMemo(
    () =>
      allEmergencyDepartments().map((department) => {
        const figures = edWaitFigures(movements, department.id, now);
        const waits = figures.waitingMovements.map((entry) => entry.waitMinutes);
        return {
          id: department.id,
          name: shortName(department.name),
          code: department.siteCode,
          service: siteByCode(department.siteCode)?.service,
          entries: figures.waitingMovements,
          waiting: figures.onTheList,
          unplaced: figures.unplaced,
          over24: figures.over24h,
          over48: figures.over48h,
          longest: figures.longestWait ? figures.longestWait.waitMinutes : null,
          median: median(waits),
          waits,
        };
      }),
    [movements, now],
  );
  type Row = (typeof departments)[number];

  const sorted = useMemo(() => {
    const value = (row: Row): number | string =>
      sort === "name" ? row.name : sort === "longest" || sort === "median" ? (row[sort] ?? -1) : row[sort];
    return [...departments].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      if (left < right) return asc ? -1 : 1;
      if (left > right) return asc ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [departments, sort, asc]);

  const onSort = (key: EdSortKey) => {
    if (key === sort) setAsc((value) => !value);
    else {
      setSort(key);
      setAsc(key === "name");
    }
  };

  const swarmRows = [...departments]
    .sort((a, b) => b.waiting - a.waiting || (b.longest ?? 0) - (a.longest ?? 0) || a.name.localeCompare(b.name))
    .map((row) => ({ id: row.id, name: row.name, href: edStatisticsHref(row.id), entries: row.entries }));

  const total = (pick: (row: Row) => number) => departments.reduce((sum, row) => sum + pick(row), 0);
  const waiting = total((row) => row.waiting);
  const over24 = total((row) => row.over24);
  const over48 = total((row) => row.over48);
  const unplaced = total((row) => row.unplaced);
  const longestRow = departments.reduce<Row | null>(
    (best, row) => (row.longest !== null && (best === null || (best.longest ?? 0) < row.longest) ? row : best),
    null,
  );
  const networkMedian = median(departments.flatMap((row) => row.waits));

  // Short column labels from the band floors ("<4h", "4-8h", "24h+"); the full name is the band's own.
  const bands = ED_WAIT_BANDS.map((band, position) => {
    const next = ED_WAIT_BANDS[position + 1]?.fromMinutes;
    const from = band.fromMinutes / 60;
    return {
      id: band.label,
      label: next === undefined ? `${from}h+` : position === 0 ? `<${next / 60}h` : `${from}-${next / 60}h`,
      value: departments.reduce((sum, row) => sum + (edWaitBands(movements, row.id, now)[position]?.count ?? 0), 0),
    };
  });

  return (
    <StatisticsPage
      section={section}
      navSection="ed"
      testId="ward-statistics-eds-index"
      eyebrowLabel={`Statistics · ${departments.length} EDs`}
      title="All emergency departments"
      now={now}
      paused={live.paused}
      onTogglePause={live.togglePause}
      tools={
        <HeroTool
          href={STATISTICS_COMPARE_HREF}
          icon={<ArrowLeftRight size={14} aria-hidden="true" />}
          testId="ward-statistics-eds-compare"
        >
          Compare EDs
        </HeroTool>
      }
      stats={
        <>
          <HeroStat value={waiting} label="Waiting" />
          <HeroStat
            value={waitText(longestRow?.longest ?? null)}
            label={longestRow ? `Longest, ${longestRow.code}` : "Longest"}
            tone={
              longestRow?.longest == null
                ? undefined
                : longestRow.longest >= VERY_LONG_WAIT_MINUTES
                  ? "danger"
                  : longestRow.longest >= LONG_WAIT_MINUTES
                    ? "warning"
                    : undefined
            }
          />
          <HeroStat value={waitText(networkMedian)} label="Median" />
          <HeroStat value={over24} label={`Past ${LONG_HOURS}h`} tone={over24 > 0 ? "warning" : undefined} />
          <HeroStat value={unplaced} label="No ward yet" />
        </>
      }
    >
      <StatCard
        icon={Users}
        id="everyone-waiting"
        className={index.anchorTarget}
        title="Everyone waiting, by ED"
        aside={
          <span
            className={cx(styles.muted, index.phoneHide)}
          >{`${waiting} waiting across ${departments.length} EDs`}</span>
        }
        data-testid="ward-statistics-eds-swarm-card"
      >
        <div className={index.swarmBody}>
          <StatisticsEdSwarm rows={swarmRows} labelWidth={176} testId="ward-statistics-eds-swarm" />
        </div>
        <CardFoot
          meta={`Each mark is one person. The ${LONG_HOURS} and ${VERY_LONG_HOURS} hour lines are local defaults, not legal limits. Open a row for that ED's page.`}
        />
      </StatCard>

      <FlushRow layout="lead3">
        <StatCard
          icon={Hospital}
          id="every-ed"
          className={index.anchorTarget}
          title="Every emergency department"
          aside={<span className={cx(styles.muted, index.phoneHide)}>Sort by any column</span>}
          data-testid="ward-statistics-eds-table-card"
        >
          <div
            className={index.tableScroll}
            tabIndex={0}
            role="region"
            aria-label="Every emergency department, scrollable"
          >
            <table className={cx(tableClasses.table, styles.table)} data-testid="ward-statistics-eds-table">
              <caption className={styles.srOnly}>
                Every emergency department: people waiting for a mental health bed, those with no ward yet, long waits,
                the longest and the median wait
              </caption>
              <thead>
                <tr>
                  <SortTh id="name" label="ED" sort={sort} asc={asc} onSort={onSort} />
                  <SortTh id="waiting" label="Waiting" sort={sort} asc={asc} onSort={onSort} numeric />
                  <SortTh id="unplaced" label="No ward yet" sort={sort} asc={asc} onSort={onSort} numeric />
                  <SortTh id="over24" label={`Past ${LONG_HOURS}h`} sort={sort} asc={asc} onSort={onSort} numeric />
                  <SortTh
                    id="over48"
                    label={`Past ${VERY_LONG_HOURS}h`}
                    sort={sort}
                    asc={asc}
                    onSort={onSort}
                    numeric
                  />
                  <SortTh id="longest" label="Longest" sort={sort} asc={asc} onSort={onSort} numeric />
                  <SortTh id="median" label="Median" sort={sort} asc={asc} onSort={onSort} numeric />
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      <span className={index.rowName}>
                        <Link href={edStatisticsHref(row.id)} className={index.rowLink}>
                          {row.name}
                        </Link>
                        <span className={index.rowSub}>
                          <ServiceDot service={row.service} />
                          {row.code}
                          {row.service ? ` · ${row.service}` : ""}
                        </span>
                      </span>
                    </th>
                    <td className={cx(styles.num, row.waiting === 0 && styles.zero)}>{row.waiting}</td>
                    <td className={cx(styles.num, row.unplaced === 0 && styles.zero)}>{row.unplaced}</td>
                    <td className={cx(styles.num, row.over24 === 0 && styles.zero)}>
                      <span className={styles.flagged}>
                        {row.over24 > 0 ? <StatusGlyph tone="warning" size={9} /> : null}
                        {row.over24}
                      </span>
                    </td>
                    <td className={cx(styles.num, row.over48 === 0 && styles.zero)}>
                      <span className={styles.flagged}>
                        {row.over48 > 0 ? <StatusGlyph tone="danger" size={9} /> : null}
                        {row.over48}
                      </span>
                    </td>
                    <td className={cx(styles.num, row.longest === null && styles.zero)}>{waitText(row.longest)}</td>
                    <td className={cx(styles.num, row.median === null && styles.zero)}>{waitText(row.median)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">All {departments.length} EDs</th>
                  <td className={styles.num}>{waiting}</td>
                  <td className={styles.num}>{unplaced}</td>
                  <td className={styles.num}>{over24}</td>
                  <td className={styles.num}>{over48}</td>
                  <td className={styles.num}>{waitText(longestRow?.longest ?? null)}</td>
                  <td className={styles.num}>{waitText(networkMedian)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <CardFoot
            meta={`Past ${VERY_LONG_HOURS}h is part of past ${LONG_HOURS}h, so the two are never added together.`}
          />
        </StatCard>

        <Follow>
          <StatCard
            icon={Clock}
            id="wait-bands"
            className={index.anchorTarget}
            title="Wait bands"
            aside={<span className={cx(styles.muted, index.phoneHide)}>Everyone waiting</span>}
            data-testid="ward-statistics-eds-bands"
          >
            <CardBody>
              <ColumnChart
                label="People waiting in an emergency department, by how long"
                columns={bands}
                height={220}
              />
            </CardBody>
            <CardFoot meta="The bands do not overlap: they add up to everyone waiting." />
          </StatCard>
        </Follow>
      </FlushRow>
    </StatisticsPage>
  );
}
