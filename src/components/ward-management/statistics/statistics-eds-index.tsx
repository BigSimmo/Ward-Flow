"use client";

import { openEdJourneys } from "@/components/ward-management/ward-shared-figures";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftRight, Users } from "lucide-react";

import {
  BarList,
  ColumnChart,
  HeroStat,
  PhoneListRow,
  Segmented,
  cx,
  durMinutes,
  tableClasses,
  useIsPhone,
} from "@/components/wf";
import { edStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { LONG_WAIT_MINUTES, VERY_LONG_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";

import {
  ED_WAIT_BANDS,
  edJourneyWaitBands as edWaitBands,
  edJourneyWaitFigures as edWaitFigures,
} from "./statistics-ed-waits";
import { StatisticsEdSwarm } from "./statistics-ed-swarm";
import { HeroTool } from "./statistics-hero-tools";
import { StatCard, StatisticsPage, useStatisticsLive } from "./statistics-hero";
import { STATISTICS_COMPARE_HREF, statisticsSectionById } from "./statistics-sections";
import { SortTh } from "./statistics-wards-index";
import { PhoneBody, PhoneGroup, PhoneList, PhoneSheetRow, phoneBodyStyles as phone } from "./statistics-phone-parts";
import styles from "./statistics-v6.module.css";
import index from "./statistics-index.module.css";
import { useExecutiveStatistics, useExecutiveStatisticsControl } from "./executive-statistics-context";
import { useEffectiveWardAccess } from "../shell/ward-access-store";
import {
  Foot,
  Glyph,
  Grid,
  redesignStyles as redesign,
} from "@/components/ward-management/statistics/redesign/statistics-redesign-parts";
import {
  ExecutiveStatisticsUnavailable,
  PeopleNotListed,
  statisticsCountText,
  exactStatisticsCount,
  withheldBar,
  type StatisticsCount,
} from "./statistics-small-numbers";
import type { HealthService } from "../ward-model";

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
/** Which open journeys the field of marks shows (the redesign's switch, Q135). */
type SwarmShow = "all" | "unplaced" | "over24";

/** "Under 4h", "4 to 8h" and "24h and over", from the band floors rather than typed here. */
function bandName(position: number): string {
  const from = ED_WAIT_BANDS[position]!.fromMinutes / 60;
  const next = ED_WAIT_BANDS[position + 1]?.fromMinutes;
  if (next === undefined) return `${from}h and over`;
  return position === 0 ? `Under ${next / 60}h` : `${from} to ${next / 60}h`;
}

/**
 * ALL EMERGENCY DEPARTMENTS — the EDs index page (Statistics A, 9 Oct 2026).
 *
 * The roomy wait field across the full card width (Josh, 9 Oct 2026: the old field of dots was
 * messy), then every department in a table, each the way into its own page. Every figure is
 * `edWaitFigures` over the live movements: waiting is the open population, "no ward yet" is the
 * open movements no ward has accepted, and the long-wait counts OVERLAP (anyone past the second line
 * is past the first), so they are shown side by side and never summed.
 */

type EdIndexRow = {
  id: string;
  name: string;
  code: string;
  service: HealthService | undefined;
  waiting: StatisticsCount;
  unplaced: StatisticsCount;
  over24: StatisticsCount;
  over48: StatisticsCount;
  urgent: StatisticsCount;
  longest: number | null;
  median: number | null;
  openable: boolean;
};
type EdIndexTotals = {
  waiting: StatisticsCount;
  over24: StatisticsCount;
  over48: StatisticsCount;
  unplaced: StatisticsCount;
  urgent: StatisticsCount;
  stillInEd: StatisticsCount;
  inTransit: StatisticsCount;
};
export function StatisticsEdsIndexScreen() {
  const control = useExecutiveStatisticsControl();
  const access = useEffectiveWardAccess();
  return control.executive || access.role === "executive" ? <ExecutiveEdsIndex /> : <OperationalEdsIndex />;
}
function ExecutiveEdsIndex() {
  const data = useExecutiveStatistics();
  const control = useExecutiveStatisticsControl();
  if (!data) return <ExecutiveStatisticsUnavailable />;
  const departments: EdIndexRow[] = data.emergencyDepartments.map((ed) => ({
    id: ed.id,
    name: shortName(ed.name),
    code: ed.siteCode,
    service: ed.service,
    waiting: ed.onTheList,
    unplaced: ed.unplaced,
    over24: ed.over24h,
    over48: ed.over48h,
    urgent: ed.urgent,
    longest: ed.longestWaitMinutes,
    median: ed.medianWaitMinutes,
    openable: data.openableEmergencyDepartmentIds.includes(ed.id),
  }));
  return (
    <EdsIndexView
      executive
      departments={departments}
      now={data.network.asAt.now}
      paused={control.paused}
      togglePause={control.togglePause}
      scopeLabel={data.network.scope.kind === "service" ? data.network.scope.service : undefined}
      totals={data.edIndex}
      networkMedian={data.networkDetails.medianWaitMinutes}
      bands={data.edIndex.bands.map((band, position) => {
        const from = ED_WAIT_BANDS[position]!.fromMinutes / 60;
        const next = ED_WAIT_BANDS[position + 1]?.fromMinutes;
        return {
          id: band.label,
          label: next === undefined ? `${from}h+` : position === 0 ? `<${next / 60}h` : `${from}-${next / 60}h`,
          value: band.count,
        };
      })}
      swarmRows={[...departments]
        .sort((a, b) => {
          const left = exactStatisticsCount(a.waiting),
            right = exactStatisticsCount(b.waiting);
          if (left === null || right === null)
            return left === right ? a.name.localeCompare(b.name) : left === null ? 1 : -1;
          return right - left || (b.longest ?? 0) - (a.longest ?? 0) || a.name.localeCompare(b.name);
        })
        .map((ed) => ({ id: ed.id }))}
      renderSwarm={() => <PeopleNotListed />}
    />
  );
}
function OperationalEdsIndex() {
  const live = useStatisticsLive();
  const { movements } = live.state;
  const now = live.now;
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
          urgent: figures.urgent,
          waits,
        };
      }),
    [movements, now],
  );
  type Row = (typeof departments)[number];
  const swarmRows = [...departments]
    .sort((a, b) => b.waiting - a.waiting || (b.longest ?? 0) - (a.longest ?? 0) || a.name.localeCompare(b.name))
    .map((row) => ({ id: row.id, name: row.name, href: edStatisticsHref(row.id), entries: row.entries }));

  const total = (pick: (row: Row) => number) => departments.reduce((sum, row) => sum + pick(row), 0);
  const waiting = total((row) => row.waiting);
  const edJourneys = openEdJourneys(movements, now);
  const over24 = total((row) => row.over24);
  const over48 = total((row) => row.over48);
  const unplaced = total((row) => row.unplaced);
  const urgent = total((row) => row.urgent);
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
    <EdsIndexView
      departments={departments.map(
        ({ id, name, code, service, waiting, unplaced, over24, over48, urgent, longest, median }) => ({
          id,
          name,
          code,
          service,
          waiting,
          unplaced,
          over24,
          over48,
          urgent,
          longest,
          median,
          openable: true,
        }),
      )}
      now={now}
      paused={live.paused}
      togglePause={live.togglePause}
      totals={{
        waiting,
        over24,
        over48,
        unplaced,
        urgent,
        stillInEd: edJourneys.stillInEd,
        inTransit: edJourneys.inTransit,
      }}
      networkMedian={networkMedian}
      bands={bands}
      swarmRows={swarmRows.map(({ id }) => ({ id }))}
      renderSwarm={(width, show = "all") => (
        <StatisticsEdSwarm
          rows={
            show === "all"
              ? swarmRows
              : swarmRows.map((row) => ({
                  ...row,
                  // The same tests `edWaitFigures` counts with: no ward accepted, or waiting past the long-wait line.
                  entries: row.entries.filter((entry) =>
                    show === "unplaced"
                      ? entry.movement.acceptedUnitId === undefined
                      : entry.waitMinutes >= LONG_WAIT_MINUTES,
                  ),
                }))
          }
          labelWidth={width}
          testId="ward-statistics-eds-swarm"
        />
      )}
    />
  );
}
function EdsIndexView({
  departments,
  now,
  paused,
  togglePause,
  scopeLabel,
  totals,
  networkMedian,
  bands,
  swarmRows,
  renderSwarm,
  executive = false,
}: {
  departments: EdIndexRow[];
  now: number;
  paused: boolean;
  togglePause: (() => void) | null;
  scopeLabel?: string;
  totals: EdIndexTotals;
  networkMedian: number | null;
  bands: { id: string; label: string; value: StatisticsCount }[];
  swarmRows: { id: string }[];
  renderSwarm: (width: number, show?: SwarmShow) => ReactNode;
  executive?: boolean;
}) {
  const section = statisticsSectionById("units");
  if (!section) throw new Error("Statistics units section is missing.");
  const shown = (count: StatisticsCount) => statisticsCountText(count);
  const positive = (count: StatisticsCount) => {
    const exact = exactStatisticsCount(count);
    return exact === null || exact > 0;
  };
  const { waiting, over24, over48, unplaced, urgent } = totals;
  const stillInEdShown = shown(totals.stillInEd),
    inTransitShown = shown(totals.inTransit);
  const longestRow = departments.reduce<EdIndexRow | null>(
    (best, row) => (row.longest !== null && (best === null || (best.longest ?? 0) < row.longest) ? row : best),
    null,
  );
  type Row = EdIndexRow;
  const [sort, setSort] = useState<EdSortKey>("waiting");
  const [asc, setAsc] = useState(false);
  const [show, setShow] = useState<SwarmShow>("all");
  const isPhone = useIsPhone();

  const sorted = useMemo(() => {
    const value = (row: Row): number | string | null =>
      sort === "name"
        ? row.name
        : sort === "longest" || sort === "median"
          ? (row[sort] ?? -1)
          : exactStatisticsCount(row[sort]);
    return [...departments].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      if (left === null || right === null)
        return left === right ? a.name.localeCompare(b.name) : left === null ? 1 : -1;
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

  return (
    <StatisticsPage
      section={section}
      navSection="ed"
      testId="ward-statistics-eds-index"
      eyebrowLabel={`Statistics · ${departments.length} EDs`}
      title="All emergency departments"
      eyebrowDetail={scopeLabel}
      now={now}
      paused={paused}
      onTogglePause={togglePause ?? undefined}
      tools={
        <HeroTool
          href={STATISTICS_COMPARE_HREF}
          icon={<ArrowLeftRight size={14} aria-hidden="true" />}
          testId="ward-statistics-eds-compare"
        >
          Compare EDs
        </HeroTool>
      }
      phone={{
        title: `${shown(waiting)} open ED journeys`,
        sub: `Longest ${waitText(longestRow?.longest ?? null)} · median ${waitText(networkMedian)}`,
        stats: (
          <>
            <HeroStat
              value={shown(over24)}
              label={`Past ${LONG_HOURS}h`}
              tone={positive(over24) ? "warning" : undefined}
            />
            <HeroStat value={shown(unplaced)} label="No ward yet" />
            <HeroStat value={shown(urgent)} label="Urgent" />
          </>
        ),
      }}
      stats={
        <>
          <HeroStat value={shown(waiting)} label="Open ED journeys" />
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
          <HeroStat
            value={shown(over24)}
            label={`Past ${LONG_HOURS}h`}
            tone={positive(over24) ? "warning" : undefined}
          />
          <HeroStat value={shown(unplaced)} label="No ward yet" />
        </>
      }
    >
      {isPhone ? (
        <PhoneBody testId="ward-statistics-eds-phone">
          <p className={styles.muted} data-testid="ward-statistics-eds-population">
            {stillInEdShown} still in ED · {inTransitShown} in transit or recorded departure. Times run from journey
            opening.
          </p>
          <PhoneList label="Emergency departments, busiest first">
            {swarmRows.map((swarm) => {
              const row = departments.find((each) => each.id === swarm.id)!;
              // No trend line on phone (audit stats-19, 13 Oct 2026): it had no visible span, and with
              // no closures in the seed every line rose, so it signalled worsening everywhere.
              return (
                <PhoneListRow
                  key={row.id}
                  as="li"
                  name={row.name}
                  meta={
                    <span className={phone.dotName}>
                      {exactStatisticsCount(row.waiting) === 0
                        ? "No one waiting"
                        : `${shown(row.unplaced)} no ward yet`}
                    </span>
                  }
                  value={shown(row.waiting)}
                  // Phone review F-24: "longest none" read as a wait; an empty ED reads "0 waiting".
                  time={row.longest === null ? "waiting" : `longest ${waitText(row.longest)}`}
                  href={row.openable ? edStatisticsHref(row.id) : undefined}
                />
              );
            })}
          </PhoneList>
          <PhoneGroup title="Time since opening" aside="Open ED journeys">
            <div className={phone.chartCard}>
              <ColumnChart
                label="Open ED journeys, by time since opening"
                columns={bands.map((band) => ({
                  ...band,
                  ...withheldBar(exactStatisticsCount(band.value) ?? 0, shown(band.value)),
                }))}
                height={160}
              />
            </div>
          </PhoneGroup>
          {executive ? (
            <PeopleNotListed />
          ) : (
            <PhoneSheetRow
              icon={Users}
              title="Open ED journeys, one mark each"
              sub={`Axis to ${VERY_LONG_HOURS * 1.5}h, longer waits on its last line`}
              testId="ward-statistics-eds-phone-swarm"
            >
              {renderSwarm(96)}
              <p className={phone.note}>
                {`The ${LONG_HOURS} and ${VERY_LONG_HOURS} hour lines are local defaults, not legal limits.`}
              </p>
            </PhoneSheetRow>
          )}
        </PhoneBody>
      ) : (
        <>
          <StatCard
            id="everyone-waiting"
            className={index.anchorTarget}
            title="Open ED journeys, by ED"
            meta={`${shown(waiting)} open across ${departments.length} EDs`}
            action={
              executive ? undefined : (
                <Segmented<SwarmShow>
                  label="Show"
                  value={show}
                  onChange={setShow}
                  items={[
                    { id: "all", label: "All" },
                    { id: "unplaced", label: "No ward yet", count: shown(unplaced) },
                    { id: "over24", label: `Past ${LONG_HOURS}h`, count: shown(over24) },
                  ]}
                />
              )
            }
            data-testid="ward-statistics-eds-swarm-card"
          >
            <div className={index.swarmBody}>{renderSwarm(176, show)}</div>
            <Foot
              how={
                executive
                  ? undefined
                  : [
                      "Each mark is one open ED journey. Times run from when the journey opened.",
                      `The ${LONG_HOURS} and ${VERY_LONG_HOURS} hour lines are local defaults, not legal limits.`,
                      "An open journey stays the ED’s until arrival.",
                    ]
              }
            >
              <span data-testid="ward-statistics-eds-population">
                {stillInEdShown} still in ED · {inTransitShown} in transit or recorded departure
              </span>
            </Foot>
          </StatCard>

          <Grid layout="wide">
            <StatCard
              id="every-ed"
              className={index.anchorTarget}
              title="Every emergency department"
              meta="Sort by any column"
              data-testid="ward-statistics-eds-table-card"
            >
              <div
                className={redesign.tableWrap}
                tabIndex={0}
                role="region"
                aria-label="Every emergency department, scrollable"
              >
                <table className={cx(tableClasses.table, redesign.table)} data-testid="ward-statistics-eds-table">
                  <caption className={styles.srOnly}>
                    Every emergency department: open ED journeys, including transit, those with no ward yet, long waits,
                    the longest and the median wait
                  </caption>
                  <thead>
                    <tr>
                      <SortTh id="name" label="ED" sort={sort} asc={asc} onSort={onSort} />
                      <SortTh id="waiting" label="Open" sort={sort} asc={asc} onSort={onSort} numeric />
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
                    {sorted.map((row) => {
                      const num = (zero: boolean) => cx(redesign.r, tableClasses.num, zero && redesign.zero);
                      return (
                        <tr key={row.id}>
                          <th scope="row">
                            <span className={redesign.name}>
                              {row.openable ? (
                                <Link href={edStatisticsHref(row.id)} className={redesign.nameLink}>
                                  {row.name}
                                </Link>
                              ) : (
                                row.name
                              )}
                              <small>
                                {row.code}
                                {row.service ? ` · ${row.service}` : ""}
                              </small>
                            </span>
                          </th>
                          <td className={num(exactStatisticsCount(row.waiting) === 0)}>{shown(row.waiting)}</td>
                          <td className={num(exactStatisticsCount(row.unplaced) === 0)}>{shown(row.unplaced)}</td>
                          <td className={num(exactStatisticsCount(row.over24) === 0)}>
                            <span className={redesign.gv}>
                              {positive(row.over24) ? <Glyph tone="warning" /> : null}
                              {shown(row.over24)}
                            </span>
                          </td>
                          <td className={num(exactStatisticsCount(row.over48) === 0)}>
                            <span className={redesign.gv}>
                              {positive(row.over48) ? <Glyph tone="danger" /> : null}
                              {shown(row.over48)}
                            </span>
                          </td>
                          <td className={num(row.longest === null)}>{waitText(row.longest)}</td>
                          <td className={num(row.median === null)}>{waitText(row.median)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className={redesign.total}>
                      <th scope="row">All {departments.length} EDs</th>
                      <td className={cx(redesign.r, tableClasses.num)}>{shown(waiting)}</td>
                      <td className={cx(redesign.r, tableClasses.num)}>{shown(unplaced)}</td>
                      <td className={cx(redesign.r, tableClasses.num)}>{shown(over24)}</td>
                      <td className={cx(redesign.r, tableClasses.num)}>{shown(over48)}</td>
                      <td className={cx(redesign.r, tableClasses.num)}>{waitText(longestRow?.longest ?? null)}</td>
                      <td className={cx(redesign.r, tableClasses.num)}>{waitText(networkMedian)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <Foot>{`Past ${VERY_LONG_HOURS}h is part of past ${LONG_HOURS}h, so the two are never added`}</Foot>
            </StatCard>

            <StatCard
              id="wait-bands"
              className={index.anchorTarget}
              title="Time since opening"
              meta={`${shown(waiting)} open`}
              data-testid="ward-statistics-eds-bands"
            >
              <div className={redesign.bars}>
                <BarList
                  label="Open ED journeys, by time since opening"
                  track
                  rows={bands.map((band, position) => ({
                    id: band.id,
                    label: bandName(position),
                    ...withheldBar(exactStatisticsCount(band.value) ?? 0, shown(band.value)),
                    flag: position === bands.length - 1 && positive(band.value) ? "warning" : undefined,
                  }))}
                />
              </div>
              <Foot>The bands add up to every open journey</Foot>
            </StatCard>
          </Grid>
        </>
      )}
    </StatisticsPage>
  );
}
