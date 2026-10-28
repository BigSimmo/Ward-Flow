"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Activity, Filter, Network } from "lucide-react";

import { BarList, CardBody, Donut, Legend, Segmented, cx, tableClasses } from "@/components/wf";
import { useStatisticsCounts } from "@/components/ward-management/shell/ward-access";
import {
  admissionStagePosition,
  type AdmissionStagePosition,
} from "@/components/ward-management/statistics/statistics-derivations";
import { bedsPendingPreparation, openBedsNow } from "@/components/ward-management/ward-bed-availability";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { BED_STATE_LABELS, bedStates } from "@/components/ward-management/ward-bed-states";
import type { BedRelease, LeaveBed, Unit, DeclineReason } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";

import { StatCard } from "./statistics-hero";
import { FlushStack } from "./statistics-layout";
import { axisMax } from "./statistics-axis";
import {
  withheldBar,
  statisticsCountText,
  exactStatisticsCount,
  type StatisticsCount,
} from "./statistics-small-numbers";
import type { Instant } from "../ward-clock";
import type { ExecutiveReportingFoundation } from "./executive-statistics-contract";
import styles from "./statistics-v6.module.css";
import cards from "./statistics-network-cards.module.css";

/*
 * The three whole-network cards that only the Overview page used to carry (D-77, change 9, 21 Oct
 * 2026): Occupancy by health service, Empty to ready and Admission stages. Summary and Overview
 * became one Network page, so these cards now sit on the Statistics home above Where the pressure
 * is. Overview's other cards (Beds by ward, Declines by reason, Awaiting a decision) repeated what
 * the home page already shows, so they were not carried across. Every figure here is the same count
 * from the same derivation the Overview page printed; nothing was added or recomputed differently.
 */

/** The five services the network reports, in the order the overview has always shown them. */
const NETWORK_SERVICES = [
  { id: "NMHS", name: "North Metro", service: "North Metro" },
  { id: "SMHS", name: "South Metro", service: "South Metro" },
  { id: "EMHS", name: "East Metro", service: "East Metro" },
  { id: "WACHS", name: "Country (WACHS)", service: "WACHS" },
  { id: "PRIV", name: "Private", service: "Private" },
] as const;

const wardsWord = (n: number) => (n === 1 ? "ward" : "wards");

/** "Sir Charles Gairdner Hospital" reads "Sir Charles Gairdner" in a service's hospital list. */
function shortSite(name: string): string {
  return name.replace(/ (Memorial |General |Public )?(Hospital|Health Campus|Health Service)$/, "");
}

type UnitRow = { unit: Unit; states: ReturnType<typeof bedStates>; rate: number; service: string };

/** Each ward's bed states and in-use rate (Occupied + Pulled), with the service it reports to. */
export function networkUnitRows(
  units: Unit[],
  admissions: Admission[],
  bedReleases: BedRelease[],
  leaveBeds: LeaveBed[],
): UnitRow[] {
  return units.map((unit) => {
    const states = bedStates(unit, admissions, bedReleases, leaveBeds);
    const rate = unit.beds > 0 ? Math.round(((states.occupied + states.pulled) / unit.beds) * 100) : 0;
    return { unit, states, rate, service: siteByCode(unit.siteCode)?.service ?? "Other" };
  });
}

export type NetworkServiceRow = ReturnType<typeof networkServiceRows>[number];

/** One row per health service: beds, bed states, wards over the alert line and its hospitals. */
export function networkServiceRows(unitRows: UnitRow[]) {
  return NETWORK_SERVICES.map((entry) => {
    const rows = unitRows.filter((row) => row.service === entry.service);
    const sum = (pick: (row: UnitRow) => number) => rows.reduce((total, row) => total + pick(row), 0);
    const beds = sum((row) => row.unit.beds);
    const inUse = sum((row) => row.states.occupied + row.states.pulled);
    const ready = sum((row) => row.states.ready);
    const closed = sum((row) => row.states.closed);
    const sites = Array.from(
      new Set(rows.map((row) => shortSite(siteByCode(row.unit.siteCode)?.name ?? row.unit.siteCode))),
    );
    return {
      ...entry,
      beds,
      occupied: sum((row) => row.states.occupied),
      ready,
      pulled: sum((row) => row.states.pulled),
      closed,
      headroom: ready + closed,
      over: rows.filter((row) => row.rate >= BED_ALERT_THRESHOLD_PERCENT).length,
      share: beds > 0 ? inUse / beds : 0,
      hospitals: sites.length > 0 ? sites.join(", ") : "Regional units",
    };
  });
}

const ADMISSION_STAGE_LABELS: Record<AdmissionStagePosition, string> = {
  "no-bed-yet": "Admitted, no bed given yet",
  "bed-given-not-arrived": "Bed given, not yet arrived",
  "in-the-bed": "In the bed",
  ended: "Admission has ended",
};

/**
 * One row per admission stage, always all four — the same "every member of a closed vocabulary gets
 * a row, including nought" discipline `declinesByReason` (`statistics-derivations.ts`) already
 * documents, applied here to a network-wide count of admissions in each. Routed through
 * `admissionStagePosition` rather than a second read of `Admission.state`, so a stage renamed or
 * added there fails `tsc` on THIS file rather than quietly leaving a row uncounted here.
 *
 * `ADMISSION_STAGE_LABELS` is typed `Record<AdmissionStagePosition, string>` rather than a hand-
 * written list of the four members: TypeScript requires every key of the union to be present, so a
 * fifth stage added to that type fails this file to compile rather than silently missing a row.
 */
export function admissionStageTallies(
  admissions: Admission[],
): { position: AdmissionStagePosition; label: string; count: number }[] {
  const counts: Record<AdmissionStagePosition, number> = {
    "no-bed-yet": 0,
    "bed-given-not-arrived": 0,
    "in-the-bed": 0,
    ended: 0,
  };
  for (const admission of admissions) {
    counts[admissionStagePosition(admission)] += 1;
  }
  return (Object.keys(ADMISSION_STAGE_LABELS) as AdmissionStagePosition[]).map((position) => ({
    position,
    label: ADMISSION_STAGE_LABELS[position],
    count: counts[position],
  }));
}

/**
 * Ready, physically empty and confirmed-allocatable, summed across every unit in the network — the
 * whole-of-prototype capacity picture `unitCapacity` (`ward-derivations.ts`) makes possible per
 * unit. "Ready" here is exactly the owner's ruling of 2026-09-04: `min(allocatable, empty)`, never a
 * different number wearing the same word (see `statistics-screen.tsx`'s own note on that ruling).
 */
export function networkCapacity(
  units: Unit[],
  bedReleases: BedRelease[],
): { ready: number; empty: number; allocatable: number } {
  let ready = 0;
  let empty = 0;
  let allocatable = 0;
  for (const unit of units) {
    ready += unitCapacity(unit, bedReleases).available;
    empty += unit.empty.value;
    allocatable += unit.allocatable.value;
  }
  return { ready, empty, allocatable };
}

/**
 * Occupancy by health service. With `onServiceFilter` each service is a button that highlights its
 * wards in the ward table beside it. Without one (the Network page, which has no such table) the
 * services are plain figures and the card does not offer a selection it cannot act on.
 */
export function ServiceOccupancyCard({
  className,
  services,
  serviceFilter = null,
  onServiceFilter,
}: {
  className?: string;
  services: NetworkServiceRow[];
  serviceFilter?: string | null;
  onServiceFilter?: (service: string | null) => void;
}) {
  const body = (entry: NetworkServiceRow) => (
    <>
      <span className={styles.serviceTop}>
        <Donut value={entry.share} label={`${entry.name} occupancy`} />
        <span className={styles.serviceText}>
          <span className={styles.serviceName}>{entry.name}</span>
          <span className={styles.serviceBeds}>
            {entry.occupied}/{entry.beds} beds
          </span>
          <span className={styles.serviceOver}>
            {entry.over === 0
              ? `No ward at or over ${BED_ALERT_THRESHOLD_PERCENT}%`
              : `${entry.over} ${wardsWord(entry.over)} at or over ${BED_ALERT_THRESHOLD_PERCENT}%`}
          </span>
        </span>
      </span>
      <span className={styles.serviceFigures}>
        <span>
          <b>{entry.ready}</b>
          {BED_STATE_LABELS.ready}
        </span>
        <span>
          <b>{entry.pulled}</b>
          {BED_STATE_LABELS.pulled}
        </span>
        <span>
          <b>{entry.closed}</b>
          {BED_STATE_LABELS.closed}
        </span>
        <span>
          <b>{entry.headroom}</b>
          Headroom
        </span>
      </span>
      <span className={styles.serviceSites}>{entry.hospitals}</span>
    </>
  );
  return (
    <StatCard
      id="services"
      className={className}
      icon={Network}
      title="Occupancy by health service"
      aside={
        <span className={styles.muted}>
          {`${BED_ALERT_THRESHOLD_PERCENT}% line`}
          {onServiceFilter ? " · Select one to highlight its wards" : null}
        </span>
      }
    >
      <div className={styles.serviceGrid} data-testid="ward-statistics-overview-gauges">
        {services.map((entry) => {
          if (!onServiceFilter) {
            return (
              <div key={entry.id} className={cx(styles.serviceTile, cards.staticTile)}>
                {body(entry)}
              </div>
            );
          }
          const pressed = serviceFilter === entry.service;
          return (
            <button
              key={entry.id}
              type="button"
              className={styles.serviceTile}
              aria-pressed={pressed}
              onClick={() => onServiceFilter(pressed ? null : entry.service)}
            >
              {body(entry)}
            </button>
          );
        })}
      </div>
    </StatCard>
  );
}

/** Physically empty, allocatable and open for placement across the network, with the ready split. */
export function EmptyToReadyCard({
  capacity,
  openNow,
  closedTotal,
  preparingCount,
}: {
  capacity: { ready: number; empty: number; allocatable: number };
  openNow: number;
  closedTotal: number;
  preparingCount: number;
}) {
  return (
    <StatCard
      id="empty-to-ready"
      icon={Filter}
      title="Empty to ready"
      aside={<span className={styles.muted}>Feed vs ward</span>}
      data-testid="ward-statistics-overview-capacity-disclosure"
    >
      <CardBody className={styles.bodyStack} data-testid="ward-statistics-overview-capacity">
        <BarList
          label="Empty to ready, across the network"
          track
          labelWidth="9.5rem"
          max={Math.max(1, capacity.empty, capacity.allocatable, openNow)}
          rows={[
            {
              id: "empty",
              label: "Physically empty",
              value: capacity.empty,
              display: <span data-testid="ward-statistics-overview-capacity-empty">{capacity.empty}</span>,
            },
            {
              id: "allocatable",
              label: "Allocatable",
              value: capacity.allocatable,
              display: <span data-testid="ward-statistics-overview-capacity-allocatable">{capacity.allocatable}</span>,
            },
            { id: "open", label: "Open for placement", value: openNow },
          ]}
        />
        <Legend
          className={styles.legendEnd}
          items={[
            {
              id: "ready",
              fill: "ready",
              label: (
                <>
                  <span data-testid="ward-statistics-overview-capacity-ready">{capacity.ready}</span> ready
                </>
              ),
            },
            { id: "closed", fill: "closed", label: `${closedTotal} closed` },
            { id: "pending", fill: "data-1", label: `${preparingCount} pending` },
          ]}
        />
      </CardBody>
    </StatCard>
  );
}

/** Admissions in each of the four stages, as a chart or a table. Small counts follow executive mode. */
export function AdmissionStagesCard({ admissions }: { admissions: Admission[] }) {
  const stageTallies = useMemo(() => admissionStageTallies(admissions), [admissions]);
  return <AdmissionStagesCardView stageTallies={stageTallies} total={admissions.length} />;
}

function AdmissionStagesCardView({
  stageTallies,
  total,
}: {
  stageTallies: { position: AdmissionStagePosition; label: string; count: StatisticsCount }[];
  total: StatisticsCount;
}) {
  const { small, parts } = useStatisticsCounts();
  const [stagesView, setStagesView] = useState<"chart" | "data">("chart");
  // Executive: the stage parts add up to the total in the table's foot, so they hide together.
  const stagesShown = stageTallies.every((stage) => typeof stage.count === "number")
    ? parts(stageTallies.map((stage) => stage.count as number))
    : stageTallies.map((stage) => statisticsCountText(stage.count, small));
  return (
    <StatCard
      id="admission-stages"
      icon={Activity}
      title="Admission stages"
      action={
        <Segmented
          size="sm"
          label="Admission stages view"
          value={stagesView}
          onChange={setStagesView}
          items={[
            { id: "chart", label: "Chart" },
            { id: "data", label: "Data" },
          ]}
        />
      }
      data-testid="statistics-overview-stages-chart"
    >
      {stagesView === "chart" ? (
        <CardBody>
          <BarList
            label="Admissions by stage"
            axis
            max={axisMax(
              stageTallies.map(
                (stage, index) => withheldBar(exactStatisticsCount(stage.count) ?? 0, stagesShown[index]!).value,
              ),
            )}
            labelWidth="10.5rem"
            rows={stageTallies.map((stage, index) => ({
              id: stage.position,
              label: stage.label,
              ...withheldBar(exactStatisticsCount(stage.count) ?? 0, stagesShown[index]!),
            }))}
          />
        </CardBody>
      ) : (
        <div className={styles.tableWrap}>
          <table className={`${tableClasses.table} ${styles.table}`} data-testid="ward-statistics-overview-stage-table">
            <caption className={styles.srOnly}>Admissions by stage, synthetic</caption>
            <thead>
              <tr>
                <th scope="col">Stage</th>
                <th scope="col" className={styles.num}>
                  Admissions
                </th>
              </tr>
            </thead>
            <tbody>
              {stageTallies.map((tally, index) => (
                <tr key={tally.position}>
                  <th scope="row">{tally.label}</th>
                  <td className={styles.num} data-testid={`ward-statistics-overview-stage-${tally.position}`}>
                    {stagesShown[index]}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">All stages</th>
                <td className={styles.num}>{statisticsCountText(total, small)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </StatCard>
  );
}

/**
 * The Network page's share of the old Overview: the three cards, stacked, each figure computed from
 * the same live state the rest of the Statistics home reads.
 */
export function NetworkOverviewCards({
  units,
  admissions,
  bedReleases,
  leaveBeds,
}: {
  units: Unit[];
  admissions: Admission[];
  bedReleases: BedRelease[];
  leaveBeds: LeaveBed[];
}) {
  const unitRows = useMemo(
    () => networkUnitRows(units, admissions, bedReleases, leaveBeds),
    [units, admissions, bedReleases, leaveBeds],
  );
  const services = useMemo(() => networkServiceRows(unitRows), [unitRows]);
  const capacity = useMemo(() => networkCapacity(units, bedReleases), [units, bedReleases]);
  const openNow = useMemo(
    () => units.reduce((sum, unit) => sum + openBedsNow(unit, bedReleases), 0),
    [units, bedReleases],
  );
  const preparingCount = useMemo(
    () => units.reduce((sum, unit) => sum + bedsPendingPreparation(unit.id, bedReleases), 0),
    [units, bedReleases],
  );
  const closedTotal = unitRows.reduce((sum, row) => sum + row.states.closed, 0);
  return (
    <FlushStack data-testid="ward-statistics-network-cards">
      <ServiceOccupancyCard services={services} />
      <EmptyToReadyCard
        capacity={capacity}
        openNow={openNow}
        closedTotal={closedTotal}
        preparingCount={preparingCount}
      />
      <AdmissionStagesCard admissions={admissions} />
    </FlushStack>
  );
}

/** Public bed aggregates and already-released admission counts use the same three cards. */
export function ExecutiveNetworkOverviewCards({ data }: { data: ExecutiveReportingFoundation }) {
  const services: NetworkServiceRow[] = NETWORK_SERVICES.flatMap((entry) => {
    const service = data.services.find((candidate) => candidate.service === entry.service);
    if (!service) return [];
    const beds = service.beds;
    const sites = data.catalogue.sites
      .filter((site) => site.service === entry.service)
      .map((site) => shortSite(site.name));
    return [
      {
        ...entry,
        beds: beds.total,
        occupied: beds.occupied,
        ready: beds.ready,
        pulled: beds.pulled,
        closed: beds.closed,
        headroom: beds.ready + beds.closed,
        over: service.wardsOverOccupancyLine,
        share: beds.total > 0 ? beds.inUse / beds.total : 0,
        hospitals: sites.length ? sites.join(", ") : "Regional units",
      },
    ];
  });
  const stageTallies = (Object.keys(ADMISSION_STAGE_LABELS) as AdmissionStagePosition[]).map((position) => ({
    position,
    label: ADMISSION_STAGE_LABELS[position],
    count: data.network.admissionStages[position],
  }));
  return (
    <FlushStack data-testid="ward-statistics-network-cards">
      <ServiceOccupancyCard services={services} />
      <EmptyToReadyCard
        capacity={{
          ready: data.capacity.ready,
          empty: data.capacity.empty,
          allocatable: data.capacity.allocatable,
        }}
        openNow={data.capacity.openNow}
        closedTotal={data.network.beds.closed}
        preparingCount={data.capacity.pendingPreparation}
      />
      <AdmissionStagesCardView stageTallies={stageTallies} total={data.network.people.admissionsRecorded} />
    </FlushStack>
  );
}

type Counted<T, K extends keyof T> = Omit<T, K> & { [P in K]: StatisticsCount };
type SummaryWard = {
  id: string;
  name: string;
  site: string;
  hospital: string;
  beds: number;
  ready: number;
  occupancyRate: number;
  referred: StatisticsCount;
};
export type SummaryEd = {
  id: string;
  name: string;
  site: string;
  waiting: StatisticsCount;
  longest: number | null;
  median: number | null;
  over8: StatisticsCount;
  over24: StatisticsCount;
};
type SummaryDeclines = Omit<
  ReturnType<typeof import("./statistics-derivations").declinesByReason>,
  "totalCount" | "movementsWithDeclinesCount" | "movementCount" | "tallies"
> & {
  totalCount: StatisticsCount;
  movementsWithDeclinesCount: StatisticsCount;
  movementCount: StatisticsCount;
  tallies: { reason: DeclineReason; count: StatisticsCount }[];
};
export type SummaryModel = {
  executive: boolean;
  directory?: { services: string[]; teams: { id: string; name: string }[]; edIds: string[] };
  now: Instant;
  dayZero: Date;
  paused: boolean;
  togglePause: (() => void) | null;
  scopeLabel: string;
  refused: { count: StatisticsCount; openMovementCount: StatisticsCount; escalatedCount: StatisticsCount };
  preparingCount: number;
  totalBeds: number;
  occupiedCount: number;
  inUseCount: number;
  occupiedPct: number;
  availableNow: number;
  pendingPreparation: number;
  waitingCount: StatisticsCount;
  stillOpenCount: StatisticsCount;
  admissionsCount: StatisticsCount;
  dischargesCount: StatisticsCount;
  arrivals: Counted<
    ReturnType<typeof import("./statistics-derivations").pullToArrival>,
    "measuredCount" | "endedCount" | "awaitingArrivalCount" | "incoherentCount"
  >;
  declinesReadout: { ok: true; value: SummaryDeclines } | { ok: false; statement: string };
  blocked: Omit<
    ReturnType<typeof import("./statistics-derivations").blockedDischargesByReason>,
    "totalCount" | "admissionCount" | "tallies"
  > & {
    totalCount: StatisticsCount;
    admissionCount: StatisticsCount;
    tallies: { reason: string; count: StatisticsCount }[];
  };
  emergencyDepts: SummaryEd[];
  totalEdWaiting: StatisticsCount;
  networkMedianWait: number | null;
  totalEdOver8: StatisticsCount;
  totalEdOver24: StatisticsCount;
  allPressureWards: SummaryWard[];
  refRaised: StatisticsCount;
  refAccepted: StatisticsCount;
  refDeclined: StatisticsCount;
  refOpen: StatisticsCount;
  arrivalBands: { id: string; label: string; value: StatisticsCount }[];
  parallelReferralCap: number;
};
export type SummarySlots = {
  capacity: ReactNode;
  overview: ReactNode;
  journey: (onShowBoard: () => void) => ReactNode;
  map: ReactNode;
  operationalExtra: ReactNode;
};
