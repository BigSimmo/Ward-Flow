"use client";

import { usePathname } from "next/navigation";
import { useWardFlow, useWardFlowClock } from "../ward-flow-provider";
import { communityTeamById } from "../community/community-derivations";
import { edById, siteByCode } from "../ward-sites";
import { occupiedBeds } from "./statistics-occupancy";
import { generateDemonstrationSeries } from "./statistics-demonstration";
import { DemonstrationChart } from "./statistics-demonstration-chart";
import { useStatisticsSamples } from "./statistics-samples";
import styles from "./statistics-samples.module.css";

export function StatisticsSampleFigures() {
  const enabled = useStatisticsSamples();
  const pathname = usePathname() || "";
  const state = useWardFlow();
  const now = useWardFlowClock();
  if (!enabled) return null;
  const [mode, encodedId] = pathname.split("/statistics")[1]?.split("/").slice(1) ?? [];
  const id = encodedId ? decodeURIComponent(encodedId) : undefined;
  const ward = mode === "ward" ? state.units.find((unit) => unit.id === id) : undefined;
  const ed = mode === "ed" && id ? edById(id) : undefined;
  const team = mode === "community" && id ? communityTeamById(id) : undefined;
  const scopedUnits = ward
    ? [ward]
    : mode === "service" && id
      ? state.units.filter((unit) => siteByCode(unit.siteCode)?.service === id)
      : state.units;
  if (
    (mode === "ward" && !ward) ||
    (mode === "ed" && !ed) ||
    (mode === "community" && !team) ||
    (mode === "service" && scopedUnits.length === 0)
  )
    return null;
  const scope = ward?.name ?? ed?.name ?? team?.name ?? (mode === "service" ? id : "Whole network");
  const capacity = occupiedBeds(scopedUnits, state.admissions, state.bedReleases, state.leaveBeds);
  const occupancy = capacity.beds ? (capacity.occupied / capacity.beds) * 100 : 0;
  const metrics =
    mode === "ed"
      ? [
          { label: "Daily arrivals", baseline: 12, unit: "people" },
          { label: "Median wait", baseline: 6, unit: "hours" },
          { label: "Awaiting placement", baseline: 8, unit: "people" },
        ]
      : mode === "community"
        ? [
            { label: "Active caseload", baseline: 120, unit: "people" },
            { label: "Weekly referrals", baseline: 18, unit: "referrals" },
            { label: "7-day follow-up", baseline: 92, unit: "%" },
          ]
        : [
            { label: "Occupancy", baseline: occupancy, unit: "%" },
            { label: "Daily admissions", baseline: Math.max(1, Math.round(capacity.beds / 30)), unit: "people" },
            { label: "Daily discharges", baseline: Math.max(1, Math.round(capacity.beds / 35)), unit: "people" },
          ];
  return (
    <section
      className={styles.sampleFigures}
      aria-labelledby="statistics-sample-heading"
      data-testid="statistics-sample-figures"
    >
      <header className={styles.sectionHeader}>
        <h2 id="statistics-sample-heading">
          Sample statistics <span>· {scope}</span>
        </h2>
        <span className={styles.badge}>Invented data · 30 days</span>
      </header>
      <div className={styles.grid}>
        {metrics.map((metric) => (
          <DemonstrationChart
            key={metric.label}
            testId={"statistics-sample-" + metric.label.toLowerCase().replaceAll(" ", "-")}
            unit={metric.unit}
            series={generateDemonstrationSeries(
              state.scenario,
              now,
              {
                label: metric.label + " · " + scope,
                whatItWouldMeasure: metric.label + " over 30 days for " + scope,
                whyItIsNotReal: "No daily history is recorded. These values are invented for preview.",
              },
              {
                baseline: metric.baseline,
                volatility: Math.max(1, metric.baseline * 0.08),
                minValue: 0,
                ...(metric.unit === "%" ? { maxValue: 100 } : {}),
              },
            )}
          />
        ))}
      </div>
    </section>
  );
}
