"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BedDouble, ChevronRight, Clock, Download, MapPin, Pin, Search, SquareArrowDown, X } from "lucide-react";

import {
  BarList,
  Button,
  CardBody,
  CardFoot,
  HeroStat,
  Icon,
  Segmented,
  Select,
  SrOnly,
  StatusGlyph,
  TextInput,
  durMinutes,
  tableClasses,
  type BarListRow,
} from "@/components/wf";
import {
  statisticsSectionById,
  STATISTICS_UNIT_CHOOSER_HREF,
  STATISTICS_UNIT_CHOOSER_ID,
} from "@/components/ward-management/statistics/statistics-sections";
import { edStatisticsHref, wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { isOpen, unitCapacity } from "@/components/ward-management/ward-derivations";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import type { EmergencyDepartment, Unit } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import { allWardStatistics, type WardStatistics } from "@/components/ward-management/ward-statistics";

import { axisMax } from "./statistics-axis";
import { csvCell } from "./statistics-csv";
import { edWaitFigures } from "./statistics-ed-waits";
import { StatCard, StatisticsPage, useStatisticsLive } from "./statistics-hero";
import { HeroTool } from "./statistics-hero-tools";
import { FlushRow, FlushStack, Follow } from "./statistics-layout";
import { wardReferralTally } from "./statistics-ward-referrals";
import compare from "./statistics-compare.module.css";
import detail from "./statistics-detail.module.css";
import styles from "./statistics-v6.module.css";

/**
 * WARD AND ED COMPARISONS — and the chooser that is the only way into the per-unit detail pages.
 *
 * **Two comparisons, never one.** Wards are set beside wards and departments beside departments:
 * a ward measure is about beds, and an emergency department in this model has no beds, so one
 * table would claim a shared measure set that does not exist. Each card draws its figures as a
 * bar list and keeps the exact table behind its Data view.
 *
 * **The Data tables keep the recorded order.** The chart sorts (Highest, Lowest, A to Z); the
 * table is the record, in the order the prototype records units, and never ranks them.
 *
 * **Why the chooser lives here.** The per-unit detail routes are dynamic — one route serving every
 * ward, one serving every emergency department — so this is the one page whose subject is the
 * whole set of units, and `STATISTICS_UNIT_CHOOSER_ID` is the anchor the hub links to.
 *
 * **Wards come from the provider's live `units`**, never from the frozen fixture, which is what
 * `tests/ward-flow-single-source.test.ts` requires. Emergency departments are identity, not
 * capacity, so they come from `allEmergencyDepartments()`.
 */
export function StatisticsCompareScreen({
  units: unitsOverride,
  emergencyDepartments: edsOverride,
  admissions: admissionsOverride,
}: {
  /** A testing seam only — nothing in the app passes any of them. The route renders this screen with
   *  no props: it exists so a test can render states the seeded network cannot produce, such as a
   *  unit whose site code resolves to nothing. */
  units?: Unit[];
  emergencyDepartments?: EmergencyDepartment[];
  /**
   * An empty admission list is the state that produces a null average, and the seed cannot
   * produce it. The route must never pass this: a route that pins a screen to a fixture silently
   * overrides live state.
   */
  admissions?: Admission[];
} = {}) {
  const live = useStatisticsLive();
  const { units: liveUnits, admissions: liveAdmissions, movements, bedReleases, leaveBeds } = live.state;
  const now = live.now;
  const admissions = admissionsOverride ?? liveAdmissions;
  const units = unitsOverride ?? liveUnits;
  const emergencyDepartments = edsOverride ?? allEmergencyDepartments();

  const totalBeds = units.reduce((sum, u) => sum + u.beds, 0);
  const readyBeds = units.reduce((sum, u) => sum + unitCapacity(u, bedReleases).available, 0);
  const pendingPreparationBeds = units.reduce((sum, u) => sum + bedsPendingPreparation(u.id, bedReleases), 0);
  const readyPct = totalBeds > 0 ? ((readyBeds / totalBeds) * 100).toFixed(1) : "0.0";

  const wardStats = allWardStatistics(units, admissions, now);
  const recordedStays = wardStats.flatMap(({ statistics }) =>
    statistics.averageLengthOfStayDays === null ? [] : [statistics.averageLengthOfStayDays],
  );
  const networkAvgStay = recordedStays.length > 0 ? mean(recordedStays) : null;
  const totalBlockers = wardStats.reduce((s, { statistics }) => s + statistics.readyToLeaveCannot, 0);
  const totalLongStays = wardStats.reduce((s, { statistics }) => s + statistics.longStays, 0);

  const openMovements = movements.filter(isOpen);
  const edWaitingCount = openMovements.length;
  const urgentCount = openMovements.filter((m) => m.flaggedUrgent).length;
  const unplacedCount = openMovements.filter((m) => m.acceptedUnitId === undefined).length;

  const wardRows: WardRow[] = wardStats.map(({ unit, statistics }) => {
    const states = bedStates(unit, admissions, bedReleases, leaveBeds);
    return {
      unit,
      statistics,
      site: siteByCode(unit.siteCode),
      group: wardGroup(unit),
      occupancy: unit.beds > 0 ? Math.round((states.occupied / unit.beds) * 100) : 0,
      readyNow: unitCapacity(unit, bedReleases).available,
      awaitingAnswer: wardReferralTally(openMovements, unit.id).askedAndWaiting,
    };
  });

  const edRows: EdCompareRow[] = emergencyDepartments.map((department) => {
    const figures = edWaitFigures(movements, department.id, now);
    return {
      department,
      row: { onTheList: figures.onTheList, urgent: figures.urgent, unplaced: figures.unplaced },
      longestMinutes: figures.longestWait?.waitMinutes ?? 0,
    };
  });

  const section = statisticsSectionById("compare");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'compare' section");

  return (
    <StatisticsPage
      section={section}
      navSection="compare"
      testId="ward-statistics-compare-screen"
      title="Ward and ED comparisons"
      eyebrowLabel="Statistics"
      now={now}
      paused={live.paused}
      onTogglePause={live.togglePause}
      tools={
        <HeroTool
          href={STATISTICS_UNIT_CHOOSER_HREF}
          icon={<SquareArrowDown size={14} aria-hidden="true" />}
          testId="ward-statistics-compare-tool-open-unit"
        >
          Open a unit
        </HeroTool>
      }
      stats={
        <>
          <HeroStat value={units.length} label="Wards" />
          <HeroStat value={readyBeds} label={`${readyPct}% of ${totalBeds} beds ready`} />
          {pendingPreparationBeds > 0 ? <HeroStat value={pendingPreparationBeds} label="Being made ready" /> : null}
          <HeroStat
            value={networkAvgStay === null ? "Not recorded" : `${networkAvgStay.toFixed(1)}d`}
            label="Mean stay"
          />
          <HeroStat value={totalBlockers} label="Blockers" />
          <HeroStat value={totalLongStays} label="Over 3 months" />
          <HeroStat
            value={edWaitingCount}
            label={
              <>
                <SrOnly>Waiting for a bed</SrOnly> {`${urgentCount} urgent, ${unplacedCount} no ward`}
              </>
            }
          />
        </>
      }
    >
      {/* The ward chart is the long column: it scrolls inside at the height the ED cards set. */}
      <FlushRow layout="lead2" className={compare.grid}>
        <Follow className={detail.followBody}>
          <WardComparison rows={wardRows} />
        </Follow>
        <FlushStack>
          <EdComparison rows={edRows} />
          <PinnedWards rows={wardRows} />
        </FlushStack>
      </FlushRow>
      <UnitChooser units={units} emergencyDepartments={emergencyDepartments} />
    </StatisticsPage>
  );
}

type WardGroup = "secure" | "open" | "older" | "youth";

/** Older adult and youth wards are their own groups; adult wards split on whether any bed locks. */
function wardGroup(unit: Unit): WardGroup {
  if (unit.cohort === "Youth") return "youth";
  if (unit.cohort === "Older adult") return "older";
  return unit.lockedBeds > 0 ? "secure" : "open";
}

const GROUP_LABELS: Record<WardGroup, string> = { secure: "Secure", open: "Open", older: "Older", youth: "Youth" };

type WardRow = {
  unit: Unit;
  statistics: WardStatistics;
  site: ReturnType<typeof siteByCode>;
  group: WardGroup;
  occupancy: number;
  readyNow: number;
  awaitingAnswer: number;
};

type SortOrder = "high" | "low" | "name";

const SORT_ITEMS: { id: SortOrder; label: string }[] = [
  { id: "high", label: "Highest" },
  { id: "low", label: "Lowest" },
  { id: "name", label: "A to Z" },
];

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - m) ** 2)));
}

/** A row label: the unit's name, then its site code in the muted mono style. */
function unitLabel(name: string, code: string | undefined) {
  return (
    <span className={compare.rowName}>
      <span className={compare.rowNameText}>{name}</span>
      {code ? <span className={styles.code}>{code}</span> : null}
    </span>
  );
}

function sortRows<T extends { name: string; value: number | null }>(rows: T[], order: SortOrder): T[] {
  return [...rows].sort((a, b) => {
    if (order === "name") return a.name.localeCompare(b.name);
    const av = a.value ?? -Infinity;
    const bv = b.value ?? -Infinity;
    return order === "high" ? bv - av : av - bv;
  });
}

function downloadCsv(filename: string, lines: (string | number)[][]) {
  const url = URL.createObjectURL(
    new Blob([lines.map((line) => line.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

type View = "chart" | "data";

const VIEW_ITEMS: { id: View; label: string }[] = [
  { id: "chart", label: "Chart" },
  { id: "data", label: "Data" },
];

type WardMetric = "stay" | "blocked" | "long";

const WARD_METRICS: Record<WardMetric, { label: string; chart: string; unit: string }> = {
  stay: { label: "Stay", chart: "Ward average length of stay bar chart", unit: "days" },
  blocked: { label: "Blockers", chart: "Ward discharge blockers bar chart", unit: "people" },
  long: { label: "Long stays", chart: "Ward long stays bar chart", unit: "people" },
};

function wardMetricValue(statistics: WardStatistics, metric: WardMetric): number | null {
  if (metric === "stay") return statistics.averageLengthOfStayDays;
  if (metric === "blocked") return statistics.readyToLeaveCannot;
  return statistics.longStays;
}

function WardComparison({ rows }: { rows: WardRow[] }) {
  const [view, setView] = useState<View>("chart");
  const [metric, setMetric] = useState<WardMetric>("stay");
  const [order, setOrder] = useState<SortOrder>("high");
  const [group, setGroup] = useState<WardGroup | "all">("all");
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const shown = rows.filter(
    (row) =>
      (group === "all" || row.group === group) &&
      (!needle || `${row.unit.name} ${row.site?.name ?? ""} ${row.unit.siteCode}`.toLowerCase().includes(needle)),
  );

  // The mean and spread are the whole network's, so a filter never moves the line it is read against.
  const networkValues = rows.flatMap((row) => {
    const value = wardMetricValue(row.statistics, metric);
    return value === null ? [] : [value];
  });
  const networkMean = networkValues.length > 0 ? mean(networkValues) : null;
  const flagAbove = networkMean === null ? null : networkMean + standardDeviation(networkValues);

  const sorted = sortRows(
    shown.map((row) => ({ row, name: row.unit.name, value: wardMetricValue(row.statistics, metric) })),
    order,
  );
  const charted = sorted.filter((entry) => entry.value !== null);
  const unrecorded = sorted.filter((entry) => entry.value === null);
  const barRows: BarListRow[] = charted.map(({ row, value }) => ({
    id: row.unit.id,
    label: unitLabel(row.unit.name, row.unit.siteCode),
    labelText: row.unit.name,
    value: value!,
    display: metric === "stay" ? value!.toFixed(1) : undefined,
    flag: flagAbove !== null && value! > flagAbove ? "warning" : undefined,
  }));

  const counts = { all: rows.length } as Record<WardGroup | "all", number>;
  for (const key of Object.keys(GROUP_LABELS) as WardGroup[]) counts[key] = rows.filter((r) => r.group === key).length;

  function exportCsv() {
    downloadCsv("ward-flow-synthetic-ward-comparison.csv", [
      ["Synthetic ward", "Site", ...WARD_COLUMNS.map((column) => column.header)],
      ...shown.map((row) => [
        row.unit.name,
        row.unit.siteCode,
        ...WARD_COLUMNS.map((column) => column.cell(row.statistics).text),
      ]),
    ]);
  }

  return (
    <StatCard
      id="wards"
      icon={BedDouble}
      title="Ward comparison"
      data-testid="statistics-compare-ward-chart"
      action={
        <span className={compare.headControls}>
          <Segmented label="Ward comparison view" value={view} onChange={setView} items={VIEW_ITEMS} />
          <Button size="sm" variant="ghost" icon={Download} onClick={exportCsv} disabled={shown.length === 0}>
            CSV
          </Button>
        </span>
      }
    >
      <div className={styles.toolbar}>
        <Segmented
          label="Ward measure"
          value={metric}
          onChange={setMetric}
          items={(Object.keys(WARD_METRICS) as WardMetric[]).map((id) => ({ id, label: WARD_METRICS[id].label }))}
        />
        <span className={styles.toolbarEnd}>
          <b>{shown.length}</b> of {rows.length}
        </span>
        <Segmented label="Sort wards" value={order} onChange={setOrder} items={SORT_ITEMS} />
      </div>
      <div className={compare.toolbarTight}>
        <TextInput
          type="search"
          icon={Search}
          boxClassName={compare.wardSearch}
          aria-label="Filter wards by name or hospital"
          placeholder="Name or site"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Segmented
          label="Ward group"
          value={group}
          onChange={setGroup}
          items={[
            { id: "all", label: "All", count: counts.all },
            ...(Object.keys(GROUP_LABELS) as WardGroup[]).map((id) => ({
              id,
              label: GROUP_LABELS[id],
              count: counts[id],
            })),
          ]}
        />
      </div>
      <CardBody flush className={`${compare.chartBody} ${detail.scrolls}`}>
        {rows.length === 0 ? (
          <p className={styles.empty} data-testid="ward-statistics-compare-ward-chart-empty">
            No wards recorded.
          </p>
        ) : shown.length === 0 ? (
          <p className={styles.empty}>No wards match</p>
        ) : view === "chart" ? (
          <div className={compare.chart}>
            <BarList
              rows={barRows}
              mean={networkMean ?? undefined}
              meanLabel="Mean"
              axis
              max={axisMax(networkValues)}
              label={WARD_METRICS[metric].chart}
              labelWidth="14rem"
            />
            {unrecorded.length > 0 ? (
              <p className={compare.unrecorded} data-testid="ward-statistics-compare-ward-chart-unrecorded">
                {`Average stay not recorded for ${unrecorded.map((entry) => entry.name).join(", ")}`}
              </p>
            ) : null}
          </div>
        ) : (
          <CompareTable
            testId="ward-statistics-compare-wards"
            minWidthClass={compare.wardTable}
            caption="Ward measures, synthetic"
            rowHeader="Ward"
            columns={WARD_COLUMNS}
            rows={shown.map((row) => ({
              id: row.unit.id,
              name: row.unit.name,
              code: row.unit.siteCode,
              row: row.statistics,
            }))}
          />
        )}
      </CardBody>
      <CardFoot
        meta={
          <span className={styles.flagged}>
            <StatusGlyph tone="warning" size={9} />
            Over 1 SD above the mean
          </span>
        }
      >
        <span className={compare.footNote}>Case mix differs</span>
      </CardFoot>
    </StatCard>
  );
}

type EdMetric = "open" | "urgent" | "unplaced" | "longest";

const ED_METRICS: Record<EdMetric, { label: string; chart: string }> = {
  open: { label: "Waiting", chart: "Emergency department open placements bar chart" },
  urgent: { label: "Urgent", chart: "Emergency department urgent placements bar chart" },
  unplaced: { label: "No ward", chart: "Emergency department placements with no ward bar chart" },
  longest: { label: "Longest", chart: "Emergency department longest wait bar chart, in hours" },
};

type EdCompareRow = { department: EmergencyDepartment; row: EdRow; longestMinutes: number };

/** "Armadale Hospital Emergency Department" reads "Armadale ED" on the chart; the full name stays in the accessible list. */
const shortDepartmentName = (name: string) =>
  name
    .replace(/ Emergency Department$/, " ED")
    .replace(/ (Memorial |General |Public )?(Hospital|Health Campus|Health Service) ED$/, " ED");

function edMetricValue(entry: EdCompareRow, metric: EdMetric): number {
  if (metric === "open") return entry.row.onTheList;
  if (metric === "urgent") return entry.row.urgent;
  if (metric === "unplaced") return entry.row.unplaced;
  return Math.round((entry.longestMinutes / 60) * 10) / 10;
}

function EdComparison({ rows }: { rows: EdCompareRow[] }) {
  const [view, setView] = useState<View>("chart");
  const [metric, setMetric] = useState<EdMetric>("open");
  const [order, setOrder] = useState<SortOrder>("high");

  const sorted = sortRows(
    rows.map((entry) => ({ entry, name: entry.department.name, value: edMetricValue(entry, metric) })),
    order,
  );
  const values = rows.map((entry) => edMetricValue(entry, metric));
  const barRows: BarListRow[] = sorted.map(({ entry, value }) => ({
    id: entry.department.id,
    label: unitLabel(shortDepartmentName(entry.department.name), entry.department.siteCode),
    labelText: entry.department.name,
    value: value ?? 0,
    display: metric === "longest" && entry.longestMinutes > 0 ? durMinutes(entry.longestMinutes) : undefined,
  }));

  function exportCsv() {
    downloadCsv("ward-flow-synthetic-ed-comparison.csv", [
      ["Synthetic department", "Site", ...ED_COLUMNS.map((column) => column.header), "Longest wait (minutes)"],
      ...rows.map((entry) => [
        entry.department.name,
        entry.department.siteCode,
        ...ED_COLUMNS.map((column) => column.cell(entry.row).text),
        entry.longestMinutes,
      ]),
    ]);
  }

  return (
    <StatCard
      id="eds"
      icon={Clock}
      title="ED comparison"
      data-testid="statistics-compare-ed-chart"
      action={
        <span className={compare.headControls}>
          <Segmented label="ED comparison view" value={view} onChange={setView} items={VIEW_ITEMS} />
          <Button size="sm" variant="ghost" icon={Download} onClick={exportCsv} disabled={rows.length === 0}>
            CSV
          </Button>
        </span>
      }
    >
      <div className={styles.toolbar}>
        <Segmented
          label="Department measure"
          value={metric}
          onChange={setMetric}
          items={(Object.keys(ED_METRICS) as EdMetric[]).map((id) => ({ id, label: ED_METRICS[id].label }))}
        />
        <Segmented label="Sort departments" value={order} onChange={setOrder} items={SORT_ITEMS} />
      </div>
      <CardBody flush className={compare.chartBody}>
        {rows.length === 0 ? (
          <p className={styles.empty} data-testid="ward-statistics-compare-ed-chart-empty">
            No emergency departments recorded.
          </p>
        ) : view === "chart" ? (
          <div className={compare.chart}>
            <BarList
              rows={barRows}
              mean={mean(values)}
              meanLabel="Mean"
              axis
              max={axisMax(values)}
              label={ED_METRICS[metric].chart}
              labelWidth="12rem"
            />
          </div>
        ) : (
          <CompareTable
            testId="ward-statistics-compare-eds"
            minWidthClass={compare.edTable}
            caption="Emergency department measures, synthetic"
            rowHeader="Department"
            columns={ED_COLUMNS}
            rows={rows.map((entry) => ({
              id: entry.department.id,
              name: shortDepartmentName(entry.department.name),
              code: entry.department.siteCode,
              row: entry.row,
            }))}
          />
        )}
      </CardBody>
    </StatCard>
  );
}

const PIN_LIMIT = 3;

type PinnedMeasure = {
  id: string;
  label: string;
  value: (row: WardRow) => number | null;
  text: (value: number) => string;
  /** Mark a ward whose value sits above the network's per-ward figure. */
  markAbove: boolean;
};

const PINNED_MEASURES: PinnedMeasure[] = [
  {
    id: "stay",
    label: "Average stay",
    value: (row) => row.statistics.averageLengthOfStayDays,
    text: (v) => `${v.toFixed(1)}d`,
    markAbove: true,
  },
  {
    id: "blocked",
    label: "Blockers",
    value: (row) => row.statistics.readyToLeaveCannot,
    text: String,
    markAbove: true,
  },
  { id: "long", label: "Over 3 months", value: (row) => row.statistics.longStays, text: String, markAbove: true },
  {
    id: "occupancy",
    label: "Occupancy",
    value: (row) => row.occupancy,
    text: (v) => `${Math.round(v)}%`,
    markAbove: true,
  },
  { id: "ready", label: "Ready now", value: (row) => row.readyNow, text: String, markAbove: false },
  { id: "awaiting", label: "Awaiting answer", value: (row) => row.awaitingAnswer, text: String, markAbove: false },
];

const oneDecimal = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/** Up to three wards set beside the network's per-ward figure. Opens on the three longest stays. */
function PinnedWards({ rows }: { rows: WardRow[] }) {
  const longest = useMemo(
    () =>
      [...rows]
        .filter((row) => row.statistics.averageLengthOfStayDays !== null)
        .sort((a, b) => (b.statistics.averageLengthOfStayDays ?? 0) - (a.statistics.averageLengthOfStayDays ?? 0))
        .slice(0, PIN_LIMIT)
        .map((row) => row.unit.id),
    [rows],
  );
  const [chosen, setChosen] = useState<string[] | null>(null);
  const pinnedIds = chosen ?? longest;
  const pinned = pinnedIds.flatMap((id) => rows.find((row) => row.unit.id === id) ?? []);
  const unpinned = rows.filter((row) => !pinnedIds.includes(row.unit.id));

  const network = (measure: PinnedMeasure) => {
    const values = rows.flatMap((row) => {
      const value = measure.value(row);
      return value === null ? [] : [value];
    });
    return values.length > 0 ? mean(values) : null;
  };

  return (
    <StatCard
      id="pinned"
      icon={MapPin}
      title="Pinned wards"
      data-testid="ward-statistics-compare-pinned"
      action={
        <span className={compare.headControls}>
          <Select
            aria-label="Pin a ward"
            boxClassName={compare.pinSelect}
            value=""
            disabled={pinned.length >= PIN_LIMIT || unpinned.length === 0}
            onChange={(event) => {
              if (event.target.value) setChosen([...pinnedIds, event.target.value]);
            }}
          >
            <option value="">{pinned.length >= PIN_LIMIT ? "Three pinned" : "Pin a ward"}</option>
            {unpinned.map((row) => (
              <option key={row.unit.id} value={row.unit.id}>
                {row.unit.name}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="ghost" onClick={() => setChosen([])} disabled={pinned.length === 0}>
            Clear
          </Button>
        </span>
      }
    >
      {pinned.length === 0 ? (
        <p className={styles.empty}>No ward pinned</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={`${tableClasses.table} ${styles.table} ${compare.pinTable}`}>
            <caption className={styles.srOnly}>Pinned wards beside the network per ward, synthetic</caption>
            <colgroup>
              <col className={compare.measureCol} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Measure</th>
                {pinned.map((row) => (
                  <th key={row.unit.id} scope="col" className={styles.num}>
                    <span className={compare.pinName}>
                      <button
                        type="button"
                        className={compare.unpin}
                        title={row.unit.name}
                        aria-label={`Unpin ${row.unit.name}`}
                        onClick={() => setChosen(pinnedIds.filter((id) => id !== row.unit.id))}
                      >
                        <span className={compare.rowNameText}>{row.unit.name}</span>
                        <Icon icon={X} size={14} />
                      </button>
                      <span className={styles.code}>{row.unit.siteCode}</span>
                    </span>
                  </th>
                ))}
                <th scope="col" className={styles.num}>
                  <span className={compare.pinName}>
                    <span>Network</span>
                    <span className={styles.code}>per ward</span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {PINNED_MEASURES.map((measure) => {
                const reference = network(measure);
                return (
                  <tr key={measure.id}>
                    <th scope="row">{measure.label}</th>
                    {pinned.map((row) => {
                      const value = measure.value(row);
                      const above = measure.markAbove && value !== null && reference !== null && value > reference;
                      return (
                        <td key={row.unit.id} className={styles.num}>
                          {value === null ? (
                            <span className={styles.muted}>none arrived</span>
                          ) : (
                            <span className={styles.flagged}>
                              {above ? (
                                <>
                                  <StatusGlyph tone="warning" size={9} />
                                  <SrOnly>above network, </SrOnly>
                                </>
                              ) : null}
                              {measure.text(value)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className={styles.num}>
                      {reference === null ? (
                        <span className={styles.muted}>none arrived</span>
                      ) : measure.id === "stay" ? (
                        `${reference.toFixed(1)}d`
                      ) : measure.id === "occupancy" ? (
                        `${Math.round(reference)}%`
                      ) : (
                        oneDecimal(Math.round(reference * 10) / 10)
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <CardFoot
        meta={
          <span className={styles.flagged}>
            <Icon icon={Pin} size={14} />
            Pin up to three
          </span>
        }
      >
        {pinned.length > 0 ? (
          <span className={styles.flagged}>
            <StatusGlyph tone="warning" size={9} />
            <span className={compare.footNote}>Above network</span>
          </span>
        ) : null}
      </CardFoot>
    </StatCard>
  );
}

type ChooserKind = "ward" | "ed";

/** "Open a unit": every ward and every department, each a link to its own detail page. */
function UnitChooser({ units, emergencyDepartments }: { units: Unit[]; emergencyDepartments: EmergencyDepartment[] }) {
  const [kind, setKind] = useState<ChooserKind>("ward");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matches = (name: string, code: string) => !needle || `${name} ${code}`.toLowerCase().includes(needle);

  const unitLink = (id: string, name: string, siteCode: string, href: string) => {
    const site = siteByCode(siteCode);
    return (
      <li key={id} hidden={!matches(name, siteCode) || undefined}>
        <Link href={href} className={compare.chooserLink}>
          <span className={compare.rowNameText}>{name}</span>
          <span className={site ? styles.code : compare.noSite}>{site ? siteCode : "matches no site"}</span>
          <Icon icon={ChevronRight} size={14} />
        </Link>
      </li>
    );
  };

  return (
    <div id={STATISTICS_UNIT_CHOOSER_ID} className={compare.chooserAnchor} tabIndex={-1}>
      <StatCard
        icon={Search}
        title="Open a unit"
        data-testid="ward-statistics-compare-chooser"
        aside={<span className={compare.footNote}>{units.length + emergencyDepartments.length} units</span>}
      >
        <div className={styles.toolbar}>
          <Segmented
            label="Unit kind"
            value={kind}
            onChange={setKind}
            items={[
              { id: "ward", label: "Wards", count: units.length },
              { id: "ed", label: "EDs", count: emergencyDepartments.length },
            ]}
          />
          <TextInput
            type="search"
            icon={Search}
            boxClassName={compare.chooserSearch}
            aria-label="Find a ward or ED"
            placeholder="Find a ward or ED"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div hidden={kind !== "ward"}>
          {units.length === 0 ? (
            <p className={styles.empty} data-testid="ward-statistics-compare-no-wards">
              No ward is recorded in this prototype, so there is none to choose.
            </p>
          ) : (
            <ul className={compare.chooserGrid} aria-label="Wards" data-testid="ward-statistics-compare-ward-list">
              {units.map((unit) => unitLink(unit.id, unit.name, unit.siteCode, wardStatisticsHref(unit.id)))}
            </ul>
          )}
        </div>
        <div hidden={kind !== "ed"}>
          {emergencyDepartments.length === 0 ? (
            <p className={styles.empty} data-testid="ward-statistics-compare-no-eds">
              No emergency department is recorded in this prototype, so there is none to choose.
            </p>
          ) : (
            <ul
              className={compare.chooserGrid}
              aria-label="Emergency departments"
              data-testid="ward-statistics-compare-ed-list"
            >
              {emergencyDepartments.map((department) =>
                unitLink(department.id, department.name, department.siteCode, edStatisticsHref(department.id)),
              )}
            </ul>
          )}
        </div>
      </StatCard>
    </div>
  );
}

/**
 * One cell, as the page will actually read it.
 *
 * ⚠️ **`text` IS THE CELL, NOT A LABEL BESIDE IT.** Every cell on both tables is text, and the only
 * decoration is whether that text is an absence, so the uniform-column check below asks its
 * question of the thing the reader sees.
 */
type CompareCell = { readonly text: string; readonly unmeasured?: boolean };

type CompareColumn<Row> = { readonly header: string; readonly cell: (row: Row) => CompareCell };

type CompareRow<Row> = { readonly id: string; readonly name: string; readonly code: string; readonly row: Row };

/** A measured count. Nought is a true and correct answer and renders as one — see `ward-statistics.ts`. */
function count(value: number): CompareCell {
  return { text: String(value) };
}

/** A figure that cannot be FORMED, worded rather than flattened. Never a nought and never a dash. */
function cannotBeFormed(words: string): CompareCell {
  return { text: words, unmeasured: true };
}

/*
 * 🔴 `Empty-bed time` IS NOT A COLUMN HERE: the seed sets every pull-to-arrival gap to
 * `PULL_TO_ARRIVAL_MINUTES`, so the average is that constant for every ward, and on a comparison
 * screen a constant reads as a measured sameness. It comes back when the seed varies
 * pull-to-arrival per admission; it stays on the per-ward screen, where one figure invites no
 * cross-ward inference. `ward-statistics-compare-two-tables.dom.test.tsx` fails on any column
 * that gives every unit the same answer.
 */
const WARD_COLUMNS: readonly CompareColumn<WardStatistics>[] = [
  {
    header: "Average stay",
    // `lengthOfStayMinutes` returns null only when nobody has ARRIVED, so the absence says that.
    cell: (statistics) =>
      statistics.averageLengthOfStayDays === null
        ? cannotBeFormed("none arrived")
        : { text: `${statistics.averageLengthOfStayDays}d` },
  },
  // Both are genuine counts, so a nought is a measurement and renders as one.
  { header: "Blockers", cell: (statistics) => count(statistics.readyToLeaveCannot) },
  { header: "Long stays", cell: (statistics) => count(statistics.longStays) },
  {
    // `consideredCount` is met + missed: 0 of 0 is undefined, not zero, so it keeps the absence wording.
    header: "Dates met",
    cell: ({ dischargeDateOutcomes }) =>
      dischargeDateOutcomes.consideredCount === 0
        ? cannotBeFormed("none yet")
        : { text: `${dischargeDateOutcomes.met} of ${dischargeDateOutcomes.consideredCount} met` },
  },
];

type EdRow = { readonly onTheList: number; readonly urgent: number; readonly unplaced: number };

/** All three are lengths of a filtered list, so nought is a count and never an absence. */
const ED_COLUMNS: readonly CompareColumn<EdRow>[] = [
  { header: "On the list", cell: (row) => count(row.onTheList) },
  { header: "Marked urgent", cell: (row) => count(row.urgent) },
  { header: "No ward yet", cell: (row) => count(row.unplaced) },
];

/** One comparison table: the record, in the recorded order, with no sorting, totals or row markers. */
function CompareTable<Row>({
  testId,
  minWidthClass,
  caption,
  rowHeader,
  columns,
  rows,
}: {
  testId: string;
  /** The width below which the table scrolls sideways, with its row headers held in place. */
  minWidthClass: string;
  caption: string;
  rowHeader: string;
  columns: readonly CompareColumn<Row>[];
  rows: readonly CompareRow<Row>[];
}) {
  return (
    <div className={styles.tableWrap} data-testid={testId} data-ward-primitive="table">
      <table className={`${tableClasses.table} ${styles.table} ${minWidthClass}`}>
        <caption className={styles.srOnly}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={compare.stickyCell}>
              {rowHeader}
            </th>
            {columns.map((column) => (
              <th key={column.header} scope="col" className={styles.num}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ id, name, code, row }) => (
            <tr key={id}>
              <th scope="row" className={`${styles.wardCell} ${compare.stickyCell}`}>
                {unitLabel(name, code)}
              </th>
              {columns.map((column) => {
                const cell = column.cell(row);
                return (
                  <td key={column.header} className={styles.num}>
                    {cell.unmeasured ? <span className={styles.muted}>{cell.text}</span> : cell.text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
