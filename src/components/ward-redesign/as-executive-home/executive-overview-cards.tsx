// Source: src/components/ward-management/statistics/statistics-network-cards.tsx (ExecutiveNetworkOverviewCards, AdmissionStagesCardView)
"use client";

import { useState } from "react";
import { Activity } from "lucide-react";

import { BarList, CardBody, Segmented, SrOnly, tableClasses } from "@/components/wf";
import { useStatisticsCounts } from "@/components/ward-management/shell/ward-access";
import type { AdmissionStagePosition } from "@/components/ward-management/statistics/statistics-derivations";
import { StatCard } from "@/components/ward-management/statistics/statistics-hero";
import { FlushStack } from "@/components/ward-management/statistics/statistics-layout";
import { axisMax } from "@/components/ward-management/statistics/statistics-axis";
import {
  withheldBar,
  statisticsCountText,
  exactStatisticsCount,
  type StatisticsCount,
} from "@/components/ward-management/statistics/statistics-small-numbers";
import type { ExecutiveReportingFoundation } from "@/components/ward-management/statistics/executive-statistics-contract";
import {
  EmptyToReadyCard,
  ServiceOccupancyCard,
  type NetworkServiceRow,
} from "@/components/ward-redesign/statistics/statistics-network-cards-redesign";
import styles from "@/components/ward-management/statistics/statistics-v6.module.css";

import { noCountReleased } from "./count-list";

/** The five services the network reports, in the order the overview has always shown them. */
const NETWORK_SERVICES = [
  { id: "NMHS", name: "North Metro", service: "North Metro" },
  { id: "SMHS", name: "South Metro", service: "South Metro" },
  { id: "EMHS", name: "East Metro", service: "East Metro" },
  { id: "WACHS", name: "Country (WACHS)", service: "WACHS" },
  { id: "PRIV", name: "Private", service: "Private" },
] as const;

const ADMISSION_STAGE_LABELS: Record<AdmissionStagePosition, string> = {
  "no-bed-yet": "Admitted, no bed given yet",
  "bed-given-not-arrived": "Bed given, not yet arrived",
  "in-the-bed": "In the bed",
  ended: "Admission has ended",
};

/** "Sir Charles Gairdner Hospital" reads "Sir Charles Gairdner" in a service's hospital list. */
function shortSite(name: string): string {
  return name.replace(/ (Memorial |General |Public )?(Hospital|Health Campus|Health Service)$/, "");
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
  // Role view (executive): when the small number rule holds back every stage, a chart is four empty
  // bars on a 0 to 1 axis. The stages are listed as words instead, and the Chart/Data switch goes.
  const allHeld = noCountReleased(stageTallies.map((stage) => stage.count));
  return (
    <StatCard
      id="admission-stages"
      icon={Activity}
      title="Admission stages"
      action={
        allHeld ? undefined : (
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
        )
      }
      data-testid="statistics-overview-stages-chart"
    >
      {allHeld ? (
        // Redesign: when every stage is held back, a list of four "not shown" rows says one thing,
        // so it is one line, counted live; the stages stay in the spoken label.
        <CardBody>
          <p className={styles.muted} data-testid="ward-statistics-overview-stages-held">
            {`${stageTallies.length} ${stageTallies.length === 1 ? "stage" : "stages"} not shown under the small number rule`}
            <SrOnly>{`: ${stageTallies.map((stage) => stage.label).join(", ")}`}</SrOnly>
          </p>
        </CardBody>
      ) : stagesView === "chart" ? (
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
