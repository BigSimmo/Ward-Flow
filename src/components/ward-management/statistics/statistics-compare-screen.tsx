"use client";

import { useMemo, useState } from "react";
import { BedDouble, Download, MapPin, Pin, Search, Siren, X } from "lucide-react";

import {
  BarList,
  Button,
  CardBody,
  CardFoot,
  Field,
  FilterChip,
  HeroStat,
  Icon,
  Segmented,
  Select,
  SrOnly,
  StatusGlyph,
  TextInput,
  durMinutes,
  tableClasses,
  useIsPhone,
  type BarListRow,
} from "@/components/wf";
import { statisticsSectionById } from "./statistics-sections";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { readyBedsNow, totalReadyBedsNow } from "@/components/ward-management/ward-bed-states";
import { wardBedsInUse } from "@/components/ward-management/ward-occupancy";
import type { EmergencyDepartment, Unit } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import { allWardStatistics, wardStatistics, type WardStatistics } from "@/components/ward-management/ward-statistics";

import { axisMax } from "./statistics-axis";
import { useStatisticsCounts } from "@/components/ward-management/shell/ward-access";
import { downloadCsv } from "./statistics-csv";
import { formatSheetMoment } from "@/components/ward-management/ward-clock";
import { edWaitFigures } from "./statistics-ed-waits";
import { StatCard, StatisticsPage, useStatisticsLive } from "./statistics-hero";
import { FlushRow, FlushStack } from "./statistics-layout";
import { wardReferralTally } from "./statistics-ward-referrals";
import { PhoneBody, phoneBodyStyles as phone } from "./statistics-phone-parts";
import compare from "./statistics-compare.module.css";
import { CompareSheetRow } from "./statistics-compare-sheet-row";
import { FindUnitLink } from "./statistics-view-switch";
import { FIRST_ROWS, ShowAllRow } from "./statistics-compare-show-all";
import styles from "./statistics-v6.module.css";
import { useExecutiveStatistics, useExecutiveStatisticsControl } from "./executive-statistics-context";
import type { ExecutiveReportingFoundation } from "./executive-statistics-contract";
import {
  ExecutiveStatisticsUnavailable,
  exactStatisticsCount,
  releasedCountText,
  statisticsCountText,
  type StatisticsCount,
} from "./statistics-small-numbers";
import { useEffectiveWardAccess } from "../shell/ward-access-store";

/**
 * WARD AND ED COMPARISONS. The way into one unit's detail page is the one unit finder (D-91).
 *
 * **Two comparisons, never one.** Wards are set beside wards and departments beside departments:
 * a ward measure is about beds, and an emergency department in this model has no beds, so one
 * table would claim a shared measure set that does not exist. Each card draws its figures as a
 * bar list and keeps the exact table behind its Data view.
 *
 * **The Data tables keep the recorded order.** The chart sorts (Highest, Lowest, A to Z); the
 * table is the record, in the order the prototype records units, and never ranks them.
 *
 * **The chooser moved (D-91, Josh, 31 Oct 2026).** Compare had its own "Open a unit" (wards and EDs)
 * beside the Summary's (wards, EDs, services and teams). There is one now, the Summary's, and
 * "Open a unit" on this tab row links to it, already open.
 *
 * Operational wards come from the provider's live `units`, never a frozen fixture. Executive
 * figures come only from the host-bound aggregate; the common view contains public place
 * metadata and scalar measures. Public ED origin groups do not grant a detail route.
 */
type CompareScreenProps = { units?: Unit[]; emergencyDepartments?: EmergencyDepartment[]; admissions?: Admission[] };

export function StatisticsCompareScreen(props: CompareScreenProps = {}) {
  const control = useExecutiveStatisticsControl();
  const data = useExecutiveStatistics();
  const access = useEffectiveWardAccess();
  if (control.executive || access.role === "executive")
    return data ? (
      <ComparePresentation
        model={executiveComparisonModel(data)}
        paused={control.paused}
        onTogglePause={control.togglePause ?? undefined}
      />
    ) : (
      <ExecutiveStatisticsUnavailable />
    );
  return <OperationalCompareScreen {...props} />;
}

function OperationalCompareScreen({
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
  const { units: liveUnits, admissions: liveAdmissions, movements, bedReleases } = live.state;
  const now = live.now;
  const asAt = formatSheetMoment(now, live.state.dayZero, { includeYearAndZone: true });
  const admissions = admissionsOverride ?? liveAdmissions;
  const units = unitsOverride ?? liveUnits;
  const emergencyDepartments = edsOverride ?? allEmergencyDepartments();

  const totalBeds = units.reduce((sum, u) => sum + u.beds, 0);
  // Audit 6 (Josh, 20 Oct 2026): the one ready figure, leaving out beds pulled for an incoming patient.
  const readyBeds = totalReadyBedsNow(units, admissions, bedReleases);
  const pendingPreparationBeds = units.reduce((sum, u) => sum + bedsPendingPreparation(u.id, bedReleases), 0);

  const wardStats = allWardStatistics(units, admissions, now);
  const unitIds = new Set(units.map((unit) => unit.id));
  const pooledAdmissions = admissions
    .filter((admission) => unitIds.has(admission.unitId))
    .map((admission) => ({ ...admission, unitId: "pooled" }));
  const networkAvgStay = wardStatistics("pooled", pooledAdmissions, now).averageLengthOfStayDays;
  const totalBlockers = wardStats.reduce((s, { statistics }) => s + statistics.readyToLeaveCannot, 0);
  const totalLongStays = wardStats.reduce((s, { statistics }) => s + statistics.longStays, 0);

  const openMovements = movements.filter(isOpen);
  // Audit 6 (Josh, 20 Oct 2026): every open journey, in transit included, so it is "Still open",
  // not "Waiting for a bed"; "Waiting in ED" is the shared `waitingInEds` figure on Statistics.
  const stillOpenCount = openMovements.length;
  const urgentCount = openMovements.filter((m) => m.flaggedUrgent).length;
  const unplacedCount = openMovements.filter((m) => m.acceptedUnitId === undefined).length;

  const wardRows: WardRow[] = wardStats.map(({ unit, statistics }) => {
    return {
      unit: comparisonUnit(unit),
      statistics: comparisonStatistics(statistics),
      site: siteByCode(unit.siteCode),
      group: wardGroup(unit),
      // L1: the one occupancy count, Occupied + Pulled (`wardBedsInUse`, `ward-occupancy.ts`).
      occupancy: unit.beds > 0 ? Math.round((wardBedsInUse(unit, admissions, bedReleases) / unit.beds) * 100) : 0,
      readyNow: readyBedsNow(unit, admissions, bedReleases),
      awaitingAnswer: wardReferralTally(openMovements, unit.id).askedAndWaiting,
    };
  });

  const edRows: EdCompareRow[] = emergencyDepartments.map((department) => {
    const figures = edWaitFigures(movements, department.id, now);
    return {
      department: { id: department.id, name: department.name, siteCode: department.siteCode },
      row: { onTheList: figures.onTheList, urgent: figures.urgent, unplaced: figures.unplaced },
      longestMinutes: figures.longestWait?.waitMinutes ?? 0,
    };
  });

  return (
    <ComparePresentation
      model={{
        units: units.map(comparisonUnit),
        emergencyDepartments: emergencyDepartments.map((ed) => ({ id: ed.id, name: ed.name, siteCode: ed.siteCode })),
        totalBeds,
        readyBeds,
        pendingPreparationBeds,
        networkAvgStay,
        totalBlockers,
        totalLongStays,
        stillOpenCount,
        urgentCount,
        unplacedCount,
        wardRows,
        edRows,
        now,
        asAt,
      }}
      paused={live.paused}
      onTogglePause={live.togglePause}
    />
  );
}

type ComparisonUnit = Pick<Unit, "id" | "name" | "siteCode" | "beds" | "lockedBeds"> & { cohort: string };
type ComparisonDepartment = Pick<EmergencyDepartment, "id" | "name" | "siteCode"> & { openable?: boolean };
type ComparisonStatistics = {
  averageLengthOfStayDays: number | null;
  readyToLeaveCannot: StatisticsCount;
  longStays: StatisticsCount;
  dischargeDateOutcomes: { met: StatisticsCount; missed: StatisticsCount; consideredCount: StatisticsCount };
};
type ComparisonModel = {
  scopeLabel?: string;
  units: ComparisonUnit[];
  emergencyDepartments: ComparisonDepartment[];
  totalBeds: number;
  readyBeds: number;
  pendingPreparationBeds: number;
  networkAvgStay: number | null;
  totalBlockers: StatisticsCount;
  totalLongStays: StatisticsCount;
  stillOpenCount: StatisticsCount;
  urgentCount: StatisticsCount;
  unplacedCount: StatisticsCount;
  wardRows: WardRow[];
  edRows: EdCompareRow[];
  now: number;
  asAt: string;
};
const comparisonUnit = (unit: Unit): ComparisonUnit => ({
  id: unit.id,
  name: unit.name,
  siteCode: unit.siteCode,
  beds: unit.beds,
  cohort: unit.cohort,
  lockedBeds: unit.lockedBeds,
});
const comparisonStatistics = (statistics: WardStatistics): ComparisonStatistics => ({
  averageLengthOfStayDays: statistics.averageLengthOfStayDays,
  readyToLeaveCannot: statistics.readyToLeaveCannot,
  longStays: statistics.longStays,
  dischargeDateOutcomes: {
    met: statistics.dischargeDateOutcomes.met,
    missed: statistics.dischargeDateOutcomes.missed,
    consideredCount: statistics.dischargeDateOutcomes.consideredCount,
  },
});

function executiveComparisonModel(data: ExecutiveReportingFoundation): ComparisonModel {
  const units: ComparisonUnit[] = data.wards.map((ward) => ({
    id: ward.id,
    name: ward.name,
    siteCode: ward.siteCode,
    beds: ward.beds.total,
    cohort: ward.cohort,
    lockedBeds: ward.lockedBeds,
  }));
  const emergencyDepartments = data.emergencyDepartments.map((ed) => ({
    id: ed.id,
    name: ed.name,
    siteCode: ed.siteCode,
    openable: data.openableEmergencyDepartmentIds.includes(ed.id),
  }));
  return {
    scopeLabel: data.network.scope.kind === "service" ? data.network.scope.service : undefined,
    units,
    emergencyDepartments,
    totalBeds: data.network.beds.total,
    readyBeds: data.network.beds.ready,
    pendingPreparationBeds: data.capacity.pendingPreparation,
    networkAvgStay: data.networkDetails.pooledAverageStayDays,
    totalBlockers: data.networkDetails.blockedTotal,
    totalLongStays: data.networkDetails.longStayTotal,
    stillOpenCount: data.network.people.stillOpen,
    urgentCount: data.networkDetails.urgentOpen,
    unplacedCount: data.networkDetails.unplacedOpen,
    wardRows: data.wards.map((ward, index) => ({
      unit: units[index]!,
      statistics: {
        averageLengthOfStayDays: ward.statistics.averageLengthOfStayDays,
        readyToLeaveCannot: ward.statistics.readyToLeaveCannot,
        longStays: ward.statistics.longStays,
        dischargeDateOutcomes: {
          met: ward.statistics.dischargeDateOutcomes.met,
          missed: ward.statistics.dischargeDateOutcomes.missed,
          consideredCount: ward.statistics.dischargeDateOutcomes.consideredCount,
        },
      },
      site: data.catalogue.sites.find((site) => site.code === ward.siteCode),
      group: wardGroup(units[index]!),
      occupancy: ward.beds.total > 0 ? Math.round((ward.beds.inUse / ward.beds.total) * 100) : 0,
      readyNow: ward.beds.ready,
      awaitingAnswer: ward.awaitingAnswer,
    })),
    edRows: data.emergencyDepartments.map((ed, index) => ({
      department: emergencyDepartments[index]!,
      row: { onTheList: ed.onTheList, urgent: ed.urgent, unplaced: ed.unplaced },
      longestMinutes: ed.longestWaitMinutes,
    })),
    now: data.network.asAt.now,
    asAt: formatSheetMoment(data.network.asAt.now, new Date(data.network.asAt.dayZero), { includeYearAndZone: true }),
  };
}

function ComparePresentation({
  model,
  paused,
  onTogglePause,
}: {
  model: ComparisonModel;
  paused: boolean;
  onTogglePause?: () => void;
}) {
  const {
    units,
    emergencyDepartments,
    totalBeds,
    readyBeds,
    pendingPreparationBeds,
    networkAvgStay,
    totalBlockers,
    totalLongStays,
    stillOpenCount,
    urgentCount,
    unplacedCount,
    wardRows,
    edRows,
    now,
    asAt,
  } = model;
  const isPhone = useIsPhone();
  const readyPct = totalBeds > 0 ? ((readyBeds / totalBeds) * 100).toFixed(1) : "0.0";

  const section = statisticsSectionById("compare");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'compare' section");

  return (
    <StatisticsPage
      section={section}
      navSection="compare"
      testId="ward-statistics-compare-screen"
      title="Ward and ED comparisons"
      eyebrowLabel="Statistics"
      eyebrowDetail={model.scopeLabel}
      now={now}
      paused={paused}
      onTogglePause={onTogglePause}
      // D-91: one unit finder. This tab row's "Open a unit" opens the Summary's, already open.
      tools={<FindUnitLink testId="ward-statistics-compare-tool-open-unit" />}
      phone={{
        title: `${units.length} ${units.length === 1 ? "ward" : "wards"}, ${emergencyDepartments.length} EDs`,
        sub: `${statisticsCountText(totalLongStays)} ${totalLongStays === 1 ? "stay" : "stays"} over 3 months`,
        stats: (
          <>
            <HeroStat value={readyBeds} label="Ready" />
            <HeroStat
              value={networkAvgStay === null ? "Not recorded" : `${networkAvgStay.toFixed(1)} days`}
              label="Average stay"
            />
            <HeroStat value={statisticsCountText(totalBlockers)} label="Discharges held up" />
          </>
        ),
      }}
      stats={
        <>
          <HeroStat value={units.length} label="Wards" />
          {/* each figure names its noun first ("26 Ready · 8.6% of 304 beds"), and uses
              the words the other Statistics pages use. */}
          <HeroStat value={readyBeds} label={`Ready · ${readyPct}% of ${totalBeds} beds`} />
          {pendingPreparationBeds > 0 ? <HeroStat value={pendingPreparationBeds} label="Being made ready" /> : null}
          <HeroStat
            value={networkAvgStay === null ? "Not recorded" : `${networkAvgStay.toFixed(1)} days`}
            label="Average stay"
          />
          <HeroStat value={statisticsCountText(totalBlockers)} label="Discharges held up" />
          <HeroStat value={statisticsCountText(totalLongStays)} label="Stays over 3 months" />
          <HeroStat
            value={statisticsCountText(stillOpenCount)}
            label={
              <>
                {`Still open · ${statisticsCountText(urgentCount)} urgent, ${statisticsCountText(unplacedCount)} no ward`}
              </>
            }
          />
        </>
      }
    >
      {isPhone ? (
        <ComparePhone wardRows={wardRows} edRows={edRows} />
      ) : (
        <>
          {/* both charts list their first eight, so neither column scrolls inside. Pinned
              wards sits under the ward chart (Josh, 30 Oct 2026), so the two columns end together. */}
          <FlushRow layout="lead2" className={compare.grid}>
            <FlushStack>
              <WardComparison rows={wardRows} asAt={asAt} />
              <PinnedWards rows={wardRows} />
            </FlushStack>
            <FlushStack>
              <EdComparison rows={edRows} asAt={asAt} />
            </FlushStack>
          </FlushRow>
        </>
      )}
    </StatisticsPage>
  );
}

/**
 * Compare on a phone (v10 phone): wards or EDs, one measure at a time as chips, the bars against
 * the network mean, highest first. Two chosen wards open in a sheet beside the network.
 */
function ComparePhone({ wardRows, edRows }: { wardRows: WardRow[]; edRows: EdCompareRow[] }) {
  const [kind, setKind] = useState<"wards" | "eds">("wards");
  const [wardMetric, setWardMetric] = useState<WardMetric>("occupancy");
  const [edMetric, setEdMetric] = useState<EdMetric>("open");
  const [showAll, setShowAll] = useState(false);

  const wardMeasurements = wardRows.map((row) => wardMetricValue(row, wardMetric));
  const wardValues = knownValues(wardMeasurements);
  const wardReference = referenceMean(wardMeasurements);
  const wardReferenceProtected = protectedValue(wardReference);
  const wardMean = exactValue(wardReference);
  const flagAbove = wardMean === null ? null : wardMean + standardDeviation(wardValues);
  const wardSorted = sortRows(
    wardRows.map((row) => ({ row, name: row.unit.name, value: wardMetricValue(row, wardMetric) })),
    "high",
  ).filter((entry) => entry.value !== null);
  const edMeasurements = edRows.map((entry) => edMetricValue(entry, edMetric));
  const edValues = knownValues(edMeasurements);
  const edReference = referenceMean(edMeasurements, true);
  const edSorted = sortRows(
    edRows.map((entry) => ({ entry, name: entry.department.name, value: edMetricValue(entry, edMetric) })),
    "high",
  );
  // The two wards compared, kept in page state so closing the sheet keeps the choice (audit stats-7).
  const longestTwo = useMemo(
    () =>
      [...wardRows]
        .filter((row) => row.statistics.averageLengthOfStayDays !== null)
        .sort((a, b) => (b.statistics.averageLengthOfStayDays ?? 0) - (a.statistics.averageLengthOfStayDays ?? 0))
        .slice(0, 2)
        .map((row) => row.unit.id),
    [wardRows],
  );
  const [pair, setPair] = useState<[string | null, string | null] | null>(null);
  const [wardA, wardB] = pair ?? [longestTwo[0] ?? null, longestTwo[1] ?? null];
  // One recorded ward name on every device (UX audit 21 Oct 2026): a long name truncates, never renames.
  const pairNames = [wardA, wardB].flatMap((id) =>
    id === null ? [] : [wardRows.find((row) => row.unit.id === id)?.unit.name ?? id],
  );

  return (
    <PhoneBody testId="ward-statistics-compare-phone">
      <Segmented<"wards" | "eds">
        className={phone.seg}
        size="md"
        label="Compare"
        value={kind}
        onChange={setKind}
        items={[
          { id: "wards", label: "Wards" },
          { id: "eds", label: "EDs" },
        ]}
      />
      <div className={phone.chips} role="group" aria-label={kind === "wards" ? "Ward measure" : "Department measure"}>
        {kind === "wards"
          ? (Object.keys(WARD_METRICS) as WardMetric[]).map((id) => (
              <FilterChip key={id} pressed={wardMetric === id} onPressedChange={() => setWardMetric(id)}>
                {WARD_METRICS[id].label}
              </FilterChip>
            ))
          : (Object.keys(ED_METRICS) as EdMetric[]).map((id) => (
              <FilterChip key={id} pressed={edMetric === id} onPressedChange={() => setEdMetric(id)}>
                {ED_METRICS[id].label}
              </FilterChip>
            ))}
      </div>
      <div className={phone.chartCard} data-testid="ward-statistics-compare-phone-chart">
        {kind === "wards" ? (
          wardSorted.length === 0 ? (
            <p className={phone.note}>No wards recorded.</p>
          ) : (
            <>
              <BarList
                rows={(showAll ? wardSorted : wardSorted.slice(0, FIRST_ROWS)).map(({ row, value }) => ({
                  id: row.unit.id,
                  label: unitLabel(row.unit.name, row.unit.siteCode),
                  labelText: row.unit.name,
                  ...comparisonBar(value, wardMetricFormat(wardMetric)),
                  flag:
                    flagAbove !== null && exactValue(value) !== null && exactValue(value)! > flagAbove
                      ? "warning"
                      : undefined,
                }))}
                mean={wardMean ?? undefined}
                meanLabel="Mean of wards"
                track
                max={axisMax(wardValues)}
                label={WARD_METRICS[wardMetric].chart}
                labelWidth="9rem"
              />
              <ShowAllRow
                total={wardSorted.length}
                noun="wards"
                showAll={showAll}
                onToggle={() => setShowAll((all) => !all)}
              />
              <p className={phone.note}>
                <span className={phone.flagged}>
                  <StatusGlyph tone="warning" size={9} />
                  {wardReferenceProtected
                    ? "Some counts are not shown. Their bars, count order and network reference are not shown; A to Z is used."
                    : "Amber dot: well above the mean, by more than one standard deviation. Wards differ in case mix."}
                </span>
              </p>
            </>
          )
        ) : edSorted.length === 0 ? (
          <p className={phone.note}>No emergency departments recorded.</p>
        ) : (
          <>
            <BarList
              rows={(showAll ? edSorted : edSorted.slice(0, FIRST_ROWS)).map(({ entry, value }) => ({
                id: entry.department.id,
                label: shortDepartmentName(entry.department.name),
                labelText: entry.department.name,
                ...comparisonBar(
                  value,
                  edMetric === "longest" && entry.longestMinutes !== null && entry.longestMinutes > 0
                    ? () => durMinutes(entry.longestMinutes!)
                    : undefined,
                ),
              }))}
              mean={exactValue(edReference) ?? undefined}
              meanLabel="Mean of EDs"
              track
              max={axisMax(edValues)}
              label={ED_METRICS[edMetric].chart}
              labelWidth="8.5rem"
            />
            <ShowAllRow
              total={edSorted.length}
              noun="EDs"
              showAll={showAll}
              onToggle={() => setShowAll((all) => !all)}
            />
          </>
        )}
      </div>
      {/* The line names both wards, so it wraps in full (a local copy of the shared row). */}
      <CompareSheetRow
        icon={Pin}
        title="Compare two wards"
        sub={pairNames.length > 0 ? `${pairNames.join(" and ")} against the network` : "Choose two wards"}
        testId="ward-statistics-compare-phone-pinned"
      >
        <CompareTwoWards rows={wardRows} wardA={wardA} wardB={wardB} onChange={(a, b) => setPair([a, b])} />
      </CompareSheetRow>
    </PhoneBody>
  );
}

type WardGroup = "secure" | "open" | "older" | "youth";

/** Older adult and youth wards are their own groups; adult wards split on whether any bed locks. */
function wardGroup(unit: Pick<ComparisonUnit, "cohort" | "lockedBeds">): WardGroup {
  if (unit.cohort === "Youth") return "youth";
  if (unit.cohort === "Older adult") return "older";
  return unit.lockedBeds > 0 ? "secure" : "open";
}

const GROUP_LABELS: Record<WardGroup, string> = { secure: "Secure", open: "Open", older: "Older", youth: "Youth" };

type WardRow = {
  unit: ComparisonUnit;
  statistics: ComparisonStatistics;
  site: { name: string } | undefined;
  group: WardGroup;
  occupancy: number;
  readyNow: number;
  awaitingAnswer: StatisticsCount;
};

type SortOrder = "high" | "low" | "name";
type ComparisonValue = StatisticsCount | null;
const protectedValue = (value: ComparisonValue) =>
  value !== null && typeof value !== "number" && value.kind !== "exact";
const exactValue = (value: ComparisonValue) => (value === null ? null : exactStatisticsCount(value));
const knownValues = (values: readonly ComparisonValue[]) =>
  values.flatMap((value) => {
    const exact = exactValue(value);
    return exact === null ? [] : [exact];
  });
function referenceMean(values: readonly ComparisonValue[], strictUnknown = false): ComparisonValue {
  if (values.some(protectedValue)) return { kind: "withheld" };
  if (strictUnknown && values.some((value) => value === null)) return null;
  const recorded = knownValues(values);
  return recorded.length > 0 ? mean(recorded) : null;
}
function comparisonBar(
  value: ComparisonValue,
  format?: (value: number) => string,
): Pick<BarListRow, "value" | "valueText" | "display"> {
  if (value === null) return { value: 0, valueText: "Not recorded" };
  const exact = exactValue(value);
  return exact === null
    ? { value: 0, valueText: String(statisticsCountText(value)) }
    : { value: exact, display: format?.(exact) };
}

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

function sortRows<T extends { name: string; value: ComparisonValue }>(rows: T[], order: SortOrder): T[] {
  const protectedOrder = rows.some((row) => protectedValue(row.value));
  return [...rows].sort((a, b) => {
    if (order === "name" || protectedOrder) return a.name.localeCompare(b.name);
    const av = exactValue(a.value) ?? -Infinity;
    const bv = exactValue(b.value) ?? -Infinity;
    return order === "high" ? bv - av : av - bv;
  });
}

type View = "chart" | "data";

const VIEW_ITEMS: { id: View; label: string }[] = [
  { id: "chart", label: "Chart" },
  { id: "data", label: "Data" },
];

type WardMetric = "occupancy" | "stay" | "blocked" | "long";

// occupancy first, as on the main Statistics page (the L1 count already on each row).
const WARD_METRICS: Record<WardMetric, { label: string; chart: string; unit: string }> = {
  occupancy: { label: "Occupancy", chart: "Ward occupancy bar chart, percent of beds in use", unit: "percent" },
  stay: { label: "Stay", chart: "Ward average stay bar chart", unit: "days" },
  // the word the hero and All wards use for this count.
  blocked: { label: "Held up", chart: "Ward discharges held up bar chart", unit: "people" },
  long: { label: "Long stays", chart: "Ward long stays bar chart", unit: "people" },
};

function wardMetricValue({ statistics, occupancy }: WardRow, metric: WardMetric): ComparisonValue {
  if (metric === "occupancy") return occupancy;
  if (metric === "stay") return statistics.averageLengthOfStayDays;
  if (metric === "blocked") return statistics.readyToLeaveCannot;
  return statistics.longStays;
}

const wardMetricFormat = (metric: WardMetric): ((value: number) => string) | undefined =>
  metric === "stay" ? (value) => value.toFixed(1) : metric === "occupancy" ? (value) => `${value}%` : undefined;

function WardComparison({ rows, asAt }: { rows: WardRow[]; asAt: string }) {
  const words = useStatisticsCounts();
  const [view, setView] = useState<View>("chart");
  const [metric, setMetric] = useState<WardMetric>("occupancy");
  const [order, setOrder] = useState<SortOrder>("high");
  const [group, setGroup] = useState<WardGroup | "all">("all");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const needle = query.trim().toLowerCase();
  const shown = rows.filter(
    (row) =>
      (group === "all" || row.group === group) &&
      (!needle || `${row.unit.name} ${row.site?.name ?? ""} ${row.unit.siteCode}`.toLowerCase().includes(needle)),
  );

  // The mean and spread are the whole network's, so a filter never moves the line it is read against.
  const measurements = rows.map((row) => wardMetricValue(row, metric));
  const networkValues = knownValues(measurements);
  const networkReference = referenceMean(measurements);
  const referenceProtected = protectedValue(networkReference);
  const networkMean = exactValue(networkReference);
  const flagAbove = networkMean === null ? null : networkMean + standardDeviation(networkValues);

  const sorted = sortRows(
    shown.map((row) => ({ row, name: row.unit.name, value: wardMetricValue(row, metric) })),
    referenceProtected ? "name" : order,
  );
  const charted = sorted.filter((entry) => entry.value !== null);
  const unrecorded = sorted.filter((entry) => entry.value === null);
  const barRows: BarListRow[] = charted.map(({ row, value }) => ({
    id: row.unit.id,
    // a trailing short form ("(EMyU)") is left to the spoken label, so names keep to one line.
    label: unitLabel(row.unit.name.replace(/ \([^)]*\)$/, ""), row.unit.siteCode),
    labelText: row.unit.name,
    ...comparisonBar(value, wardMetricFormat(metric)),
    flag: flagAbove !== null && exactValue(value) !== null && exactValue(value)! > flagAbove ? "warning" : undefined,
  }));

  const counts = { all: rows.length } as Record<WardGroup | "all", number>;
  for (const key of Object.keys(GROUP_LABELS) as WardGroup[]) counts[key] = rows.filter((r) => r.group === key).length;

  function exportCsv() {
    downloadCsv(
      "ward-flow-synthetic-ward-comparison.csv",
      [
        ["Synthetic ward", "Site", ...WARD_COLUMNS.map((column) => column.header)],
        ...shown.map((row) => [
          row.unit.name,
          row.unit.siteCode,
          ...WARD_COLUMNS.map((column) => column.cell({ ...row.statistics, occupancy: row.occupancy }, words).text),
        ]),
      ],
      { asAt, scope: "Ward comparison; wards shown" },
    );
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
      <CardBody
        flush
        className={compare.chartBody}
        tabIndex={0}
        role="region"
        aria-label={view === "chart" ? "Ward comparison chart" : "Ward comparison table"}
      >
        {rows.length === 0 ? (
          <p className={styles.empty} data-testid="ward-statistics-compare-ward-chart-empty">
            No wards recorded.
          </p>
        ) : shown.length === 0 ? (
          <p className={styles.empty}>No wards match</p>
        ) : view === "chart" ? (
          <div className={compare.chart}>
            <BarList
              rows={showAll ? barRows : barRows.slice(0, FIRST_ROWS)}
              mean={networkMean ?? undefined}
              meanLabel="Mean of wards"
              axis={!referenceProtected}
              max={axisMax(networkValues)}
              label={WARD_METRICS[metric].chart}
              labelWidth="14rem"
            />
            <ShowAllRow
              total={barRows.length}
              noun="wards"
              showAll={showAll}
              onToggle={() => setShowAll((all) => !all)}
            />
            {unrecorded.length > 0 ? (
              <p className={compare.unrecorded} data-testid="ward-statistics-compare-ward-chart-unrecorded">
                {`Average stay not recorded for ${unrecorded.map((entry) => entry.name).join(", ")}`}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <CompareTable
              testId="ward-statistics-compare-wards"
              minWidthClass={compare.wardTable}
              caption="Ward measures, synthetic"
              rowHeader="Ward"
              columns={WARD_COLUMNS}
              words={words}
              rows={(showAll ? shown : shown.slice(0, FIRST_ROWS)).map((row) => ({
                id: row.unit.id,
                name: row.unit.name,
                code: row.unit.siteCode,
                row: { ...row.statistics, occupancy: row.occupancy },
              }))}
            />
            <div className={compare.chart}>
              <ShowAllRow
                total={shown.length}
                noun="wards"
                showAll={showAll}
                onToggle={() => setShowAll((all) => !all)}
              />
            </div>
          </>
        )}
      </CardBody>
      <CardFoot
        meta={
          referenceProtected ? (
            "Network reference not shown"
          ) : (
            <span className={styles.flagged}>
              <StatusGlyph tone="warning" size={9} />
              Over 1 SD above the mean
            </span>
          )
        }
      >
        {referenceProtected ? (
          <p className={compare.footNote}>
            Some counts are not shown. Their bars, count order and network reference are not shown; A to Z is used.
          </p>
        ) : null}
        <span className={compare.footNote}>Wards differ in case mix</span>
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

type EdCompareRow = { department: ComparisonDepartment; row: EdRow; longestMinutes: number | null };

/** "Armadale Hospital Emergency Department" reads "Armadale ED" on the chart; the full name stays in the accessible list. */
const shortDepartmentName = (name: string) =>
  name
    .replace(/ Emergency Department$/, " ED")
    .replace(/ (Memorial |General |Public )?(Hospital|Health Campus|Health Service) ED$/, " ED");

function edMetricValue(entry: EdCompareRow, metric: EdMetric): ComparisonValue {
  if (metric === "open") return entry.row.onTheList;
  if (metric === "urgent") return entry.row.urgent;
  if (metric === "unplaced") return entry.row.unplaced;
  return entry.longestMinutes === null ? null : Math.round((entry.longestMinutes / 60) * 10) / 10;
}

function EdComparison({ rows, asAt }: { rows: EdCompareRow[]; asAt: string }) {
  const words = useStatisticsCounts();
  const [view, setView] = useState<View>("chart");
  const [metric, setMetric] = useState<EdMetric>("open");
  const [order, setOrder] = useState<SortOrder>("high");
  const [showAll, setShowAll] = useState(false);

  const sorted = sortRows(
    rows.map((entry) => ({ entry, name: entry.department.name, value: edMetricValue(entry, metric) })),
    order,
  );
  const measurements = rows.map((entry) => edMetricValue(entry, metric));
  const values = knownValues(measurements);
  const reference = referenceMean(measurements, true);
  const referenceProtected = protectedValue(reference);
  // departments well above the mean of EDs are marked, as the ward chart marks wards.
  const edMean = exactValue(reference);
  const flagAbove = edMean === null ? null : edMean + standardDeviation(values);
  const barRows: BarListRow[] = sorted.map(({ entry, value }) => ({
    id: entry.department.id,
    // the card title says ED, so the chart drops it and long names keep to one line; the
    // spoken label keeps the full name.
    label: unitLabel(shortDepartmentName(entry.department.name).replace(/ ED$/, ""), entry.department.siteCode),
    labelText: entry.department.name,
    ...comparisonBar(
      value,
      metric === "longest" && entry.longestMinutes !== null && entry.longestMinutes > 0
        ? () => durMinutes(entry.longestMinutes!)
        : undefined,
    ),
    flag: flagAbove !== null && exactValue(value) !== null && exactValue(value)! > flagAbove ? "warning" : undefined,
  }));

  function exportCsv() {
    downloadCsv(
      "ward-flow-synthetic-ed-comparison.csv",
      [
        ["Synthetic department", "Site", ...ED_COLUMNS.map((column) => column.header), "Longest wait (minutes)"],
        ...rows.map((entry) => [
          entry.department.name,
          entry.department.siteCode,
          ...ED_COLUMNS.map((column) => column.cell(entry.row, words).text),
          entry.longestMinutes ?? "Not recorded",
        ]),
      ],
      { asAt, scope: "ED comparison; all departments in this view" },
    );
  }

  return (
    <StatCard
      id="eds"
      // the menu's ED icon; a clock is for time only.
      icon={Siren}
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
              rows={showAll ? barRows : barRows.slice(0, FIRST_ROWS)}
              mean={exactValue(reference) ?? undefined}
              meanLabel="Mean of EDs"
              axis={!referenceProtected}
              max={axisMax(values)}
              label={ED_METRICS[metric].chart}
              labelWidth="12rem"
            />
            <ShowAllRow
              total={barRows.length}
              noun="EDs"
              showAll={showAll}
              onToggle={() => setShowAll((all) => !all)}
            />
          </div>
        ) : (
          <>
            <CompareTable
              testId="ward-statistics-compare-eds"
              minWidthClass={compare.edTable}
              caption="Emergency department measures, synthetic"
              rowHeader="Department"
              columns={ED_COLUMNS}
              words={words}
              rows={(showAll ? rows : rows.slice(0, FIRST_ROWS)).map((entry) => ({
                id: entry.department.id,
                name: shortDepartmentName(entry.department.name),
                code: entry.department.siteCode,
                row: entry.row,
              }))}
            />
            <div className={compare.chart}>
              <ShowAllRow total={rows.length} noun="EDs" showAll={showAll} onToggle={() => setShowAll((all) => !all)} />
            </div>
          </>
        )}
      </CardBody>
      {referenceProtected ? (
        <CardFoot>
          <span className={compare.footNote}>
            Some counts are not shown. Their bars, count order and network reference are not shown; A to Z is used.
          </span>
        </CardFoot>
      ) : (
        <CardFoot
          meta={
            <span className={styles.flagged}>
              <StatusGlyph tone="warning" size={9} />
              Over 1 SD above the mean
            </span>
          }
        />
      )}
    </StatCard>
  );
}

const PIN_LIMIT = 3;

type PinnedMeasure = {
  id: string;
  label: string;
  value: (row: WardRow) => ComparisonValue;
  text: (value: number) => string;
  /** Mark a ward whose value sits above the network's per-ward figure. */
  markAbove: boolean;
};

const PINNED_MEASURES: PinnedMeasure[] = [
  {
    id: "stay",
    label: "Average stay",
    value: (row) => row.statistics.averageLengthOfStayDays,
    text: (v) => `${v.toFixed(1)} days`,
    markAbove: true,
  },
  {
    id: "blocked",
    label: "Discharges held up",
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

/** The mean of the wards' own values for one measure; `null` when no ward has a value. */
function networkMean(rows: readonly WardRow[], measure: PinnedMeasure): ComparisonValue {
  return referenceMean(rows.map((row) => measure.value(row)));
}

/** The network's per-ward figure for one measure, in that measure's own units. */
function networkText(measure: PinnedMeasure, reference: Exclude<ComparisonValue, null>): string {
  if (typeof reference !== "number") return String(releasedCountText(reference));
  if (measure.id === "stay") return `${reference.toFixed(1)} days`;
  if (measure.id === "occupancy") return `${Math.round(reference)}%`;
  return oneDecimal(Math.round(reference * 10) / 10);
}

/**
 * Compare two wards on a phone (audit stats-7, 13 Oct 2026): two pickers, then each measure on its
 * own line with its full label and the two wards' values beside the network's mean of wards. The
 * desktop pinned table is unchanged; this is the phone's own design.
 */
function CompareTwoWards({
  rows,
  wardA,
  wardB,
  onChange,
}: {
  rows: readonly WardRow[];
  wardA: string | null;
  wardB: string | null;
  onChange: (a: string | null, b: string | null) => void;
}) {
  const chosen = [wardA, wardB].map((id) => rows.find((row) => row.unit.id === id) ?? null);
  const picker = (which: 0 | 1) => (
    <Field label={which === 0 ? "Ward A" : "Ward B"} className={phone.pairField}>
      <Select
        value={(which === 0 ? wardA : wardB) ?? ""}
        onChange={(event) => {
          const value = event.target.value || null;
          if (which === 0) onChange(value, wardB);
          else onChange(wardA, value);
        }}
        data-testid={`ward-statistics-compare-pair-${which === 0 ? "a" : "b"}`}
      >
        <option value="">No ward</option>
        {rows.map((row) => (
          <option key={row.unit.id} value={row.unit.id}>
            {row.unit.name}
          </option>
        ))}
      </Select>
    </Field>
  );
  const heads = [...chosen.map((row) => (row ? row.unit.name : "No ward")), "Network"];
  return (
    <div className={phone.pair} data-testid="ward-statistics-compare-pair">
      <div className={phone.pairPickers}>
        {picker(0)}
        {picker(1)}
      </div>
      <div className={phone.pairHead} aria-hidden="true">
        {heads.map((head, index) => (
          <span key={index}>{head}</span>
        ))}
      </div>
      <ul className={phone.pairList} aria-label="Measures, ward A, ward B and the network mean of wards">
        {PINNED_MEASURES.map((measure) => {
          const reference = networkMean(rows, measure);
          return (
            <li key={measure.id} className={phone.pairRow} data-testid={`ward-statistics-compare-pair-${measure.id}`}>
              <span className={phone.pairLabel}>{measure.label}</span>
              <span className={phone.pairValues}>
                {chosen.map((row, index) => {
                  const value = row ? measure.value(row) : null;
                  const exact = exactValue(value);
                  const referenceExact = exactValue(reference);
                  const above =
                    measure.markAbove && exact !== null && referenceExact !== null && exact > referenceExact;
                  return (
                    <span key={index} className={phone.flagged}>
                      <SrOnly>{`${heads[index]}: `}</SrOnly>
                      {above ? (
                        <>
                          <StatusGlyph tone="warning" size={9} />
                          <SrOnly>above network, </SrOnly>
                        </>
                      ) : null}
                      {row === null
                        ? "none"
                        : value === null
                          ? "none arrived"
                          : typeof value === "number"
                            ? measure.text(value)
                            : releasedCountText(value)}
                    </span>
                  );
                })}
                <span>
                  <SrOnly>Network mean of wards: </SrOnly>
                  {reference === null ? "none arrived" : networkText(measure, reference)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className={phone.note}>
        <span className={phone.flagged}>
          <StatusGlyph tone="warning" size={9} />
          Above the network mean of wards
        </span>
      </p>
    </div>
  );
}

/** Up to three wards set beside the network's per-ward figure. Opens on the three longest stays. */
function PinnedWards({ rows }: { rows: WardRow[] }) {
  // Starts empty (UX audit 21 Oct 2026): three pinned wards nobody chose crowded the columns.
  const [pinnedIds, setChosen] = useState<string[]>([]);
  const pinned = pinnedIds.flatMap((id) => rows.find((row) => row.unit.id === id) ?? []);
  const unpinned = rows.filter((row) => !pinnedIds.includes(row.unit.id));

  const network = (measure: PinnedMeasure) => networkMean(rows, measure);

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
            <option value="">{pinned.length >= PIN_LIMIT ? "Three pinned. Unpin one to add" : "Pin a ward"}</option>
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
        // one line; the foot's "Pin up to three" said it again, so the foot waits for a pin.
        <p className={styles.empty}>Pin up to three wards to set beside the network.</p>
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
                    {/* The mean of the wards' own figures, not the network's one figure (audit stats-20). */}
                    <span className={styles.code}>mean of wards</span>
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
                      const exact = exactValue(value);
                      const referenceExact = exactValue(reference);
                      const above =
                        measure.markAbove && exact !== null && referenceExact !== null && exact > referenceExact;
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
                              {typeof value === "number" ? measure.text(value) : releasedCountText(value)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className={styles.num}>
                      {reference === null ? (
                        <span className={styles.muted}>none arrived</span>
                      ) : (
                        networkText(measure, reference)
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pinned.length === 0 ? null : (
        <CardFoot
          meta={
            <span className={styles.flagged}>
              <Icon icon={Pin} size={14} />
              Pin up to three
            </span>
          }
        >
          <span className={styles.flagged}>
            <StatusGlyph tone="warning" size={9} />
            <span className={compare.footNote}>Above network</span>
          </span>
        </CardFoot>
      )}
    </StatCard>
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

/**
 * Issue #618: the executive desk's small number rule, so the table and its CSV word a small count of
 * people the same way. Every other desk gets the counts back unchanged.
 */
type CountWords = Pick<ReturnType<typeof useStatisticsCounts>, "small" | "parts">;

type CompareColumn<Row> = {
  readonly header: string;
  readonly cell: (row: Row, words: CountWords) => CompareCell;
};

type CompareRow<Row> = { readonly id: string; readonly name: string; readonly code: string; readonly row: Row };

/** A measured count. Nought is a true and correct answer and renders as one — see `ward-statistics.ts`. */
function count(value: StatisticsCount, words: CountWords): CompareCell {
  return { text: String(statisticsCountText(value, words.small)) };
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
/** the Data view leads with occupancy, as the chart does. */
type WardColumnRow = ComparisonStatistics & { occupancy: number };
const WARD_COLUMNS: readonly CompareColumn<WardColumnRow>[] = [
  { header: "Occupancy", cell: ({ occupancy }) => ({ text: `${occupancy}%` }) },
  {
    header: "Average stay",
    // `lengthOfStayMinutes` returns null only when nobody has ARRIVED, so the absence says that.
    cell: (statistics) =>
      statistics.averageLengthOfStayDays === null
        ? cannotBeFormed("none arrived")
        : { text: `${statistics.averageLengthOfStayDays} days` },
  },
  // Both are genuine counts, so a nought is a measurement and renders as one.
  { header: "Held up", cell: (statistics, words) => count(statistics.readyToLeaveCannot, words) },
  { header: "Long stays", cell: (statistics, words) => count(statistics.longStays, words) },
  {
    // `consideredCount` is met + missed: 0 of 0 is undefined, not zero, so it keeps the absence wording.
    header: "Dates met",
    cell: ({ dischargeDateOutcomes }, words) => {
      if (exactStatisticsCount(dischargeDateOutcomes.consideredCount) === 0) return cannotBeFormed("none yet");
      // Met and missed add up to the total shown, so met is withheld when missed could be worked back.
      const { met, consideredCount } = dischargeDateOutcomes;
      if (typeof met !== "number" || typeof consideredCount !== "number")
        return { text: `${statisticsCountText(met)} of ${statisticsCountText(consideredCount)} met` };
      const [metShown] = words.parts([met, consideredCount - met]);
      return { text: `${metShown} of ${words.small(consideredCount)} met` };
    },
  },
];

type EdRow = {
  readonly onTheList: StatisticsCount;
  readonly urgent: StatisticsCount;
  readonly unplaced: StatisticsCount;
};

/** All three are lengths of a filtered list, so nought is a count and never an absence. */
const ED_COLUMNS: readonly CompareColumn<EdRow>[] = [
  { header: "On the list", cell: (row, words) => count(row.onTheList, words) },
  { header: "Marked urgent", cell: (row, words) => count(row.urgent, words) },
  { header: "No ward yet", cell: (row, words) => count(row.unplaced, words) },
];

/** One comparison table: the record, in the recorded order, with no sorting, totals or row markers. */
function CompareTable<Row>({
  testId,
  minWidthClass,
  caption,
  rowHeader,
  columns,
  words,
  rows,
}: {
  testId: string;
  /** The width below which the table scrolls sideways, with its row headers held in place. */
  minWidthClass: string;
  caption: string;
  rowHeader: string;
  columns: readonly CompareColumn<Row>[];
  words: CountWords;
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
                const cell = column.cell(row, words);
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
