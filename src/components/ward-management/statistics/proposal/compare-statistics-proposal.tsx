"use client";

import { useMemo, useState } from "react";

import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";

import { Panel, ProposalHeader, proposalHref } from "./statistics-proposal-parts";
import { SERVICE_COLOUR, percent, type WardFigures } from "./statistics-proposal-figures";
import { useStatisticsProposal } from "./use-statistics-proposal";
import styles from "./statistics-proposal.module.css";

type Measure = "occupancy" | "ready" | "stay" | "asked";

const MEASURES: { id: Measure; label: string; question: string }[] = [
  { id: "occupancy", label: "Occupancy", question: "Occupied beds as a share of each ward's beds." },
  { id: "ready", label: "Ready beds", question: "Beds each ward can take a patient into now." },
  { id: "stay", label: "Average stay", question: "Average length of stay, in days. Case mix differs between wards." },
  { id: "asked", label: "Asked for a bed", question: "Open requests that name each ward." },
];

function valueOf(ward: WardFigures, measure: Measure): number | null {
  if (measure === "occupancy") return ward.occupancy;
  if (measure === "ready") return ward.ready;
  if (measure === "stay") return ward.averageStayDays;
  return ward.askedAndWaiting;
}

function label(value: number | null, measure: Measure): string {
  if (value === null) return "–";
  if (measure === "occupancy") return percent(value);
  if (measure === "stay") return `${value.toFixed(0)} days`;
  return String(value);
}

/**
 * Proposed compare screen: one measure at a time, every ward sorted by it, with the network
 * average drawn as a line. The current page lists wards in storage order, which reads as a ranking.
 */
export function CompareStatisticsProposal() {
  const { wards, asAt } = useStatisticsProposal();
  const [measure, setMeasure] = useState<Measure>("occupancy");
  const [service, setService] = useState<string>("all");

  const rows = useMemo(() => {
    const shown = service === "all" ? wards : wards.filter((ward) => ward.service === service);
    return shown
      .map((ward) => ({ ward, value: valueOf(ward, measure) }))
      .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  }, [wards, measure, service]);

  const values = wards.map((ward) => valueOf(ward, measure)).filter((value): value is number => value !== null);
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const max = measure === "occupancy" ? 1 : Math.max(1, ...values) * 1.1;
  const current = MEASURES.find((entry) => entry.id === measure) ?? MEASURES[0];

  return (
    <main id="main-content" className={styles.page} data-testid="statistics-proposal-compare">
      <ProposalHeader
        crumbs={[{ label: "Statistics", href: proposalHref("statewide") }, { label: "Compare" }]}
        title="Compare wards"
        asAt={asAt}
      />

      <div className={styles.header}>
        <div className={styles.segmented} role="group" aria-label="Measure">
          {MEASURES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={entry.id === measure}
              onClick={() => setMeasure(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <label className={styles.asAt}>
          Health service
          <select className={styles.select} value={service} onChange={(event) => setService(event.target.value)}>
            <option value="all">All services</option>
            {HEALTH_SERVICES.filter((name) => wards.some((ward) => ward.service === name)).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Panel
        title={current.label}
        question={current.question}
        meta={`${rows.length} wards · highest first`}
        foot={<span>Dashed line: average across wards ({label(average, measure)}).</span>}
      >
        <ul className={styles.hbars}>
          {rows.map(({ ward, value }) => (
            <li className={styles.hbar} key={ward.unit.id}>
              <span className={styles.rowName}>
                <a href={proposalHref("ward", ward.unit.id)}>{ward.unit.name}</a>
                <span className={styles.rowSub}>
                  <span
                    className={styles.swatch}
                    style={{
                      background: SERVICE_COLOUR[ward.service],
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      marginRight: 6,
                    }}
                    aria-hidden="true"
                  />
                  {ward.hospital}
                </span>
              </span>
              <span className={styles.hbarTrack}>
                <span className={styles.hbarFill} style={{ width: `${((value ?? 0) / max) * 100}%` }} />
                <span className={styles.hbarMarker} style={{ left: `${(average / max) * 100}%` }} />
              </span>
              <span className={styles.hbarValue}>{label(value, measure)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </main>
  );
}
