"use client";

import { useMemo, useState } from "react";

import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { allWardStatistics } from "@/components/ward-management/ward-statistics";

import { ExportCsvButton, Panel, ProposalHeader, Verdict, proposalHref } from "./statistics-proposal-parts";
import {
  SERVICE_COLOUR,
  edShort,
  hoursLabel,
  percent,
  releasesToday,
  type EdRow,
  type WardFigures,
} from "./statistics-proposal-figures";
import { useStatisticsProposal } from "./use-statistics-proposal";
import styles from "./statistics-proposal.module.css";

type Measure = "occupancy" | "ready" | "free" | "closed" | "stay" | "asked" | "blocked" | "long";
type EdMeasure = "waiting" | "urgent" | "unplaced" | "over24h" | "longest" | "median";
type View = "wards" | "eds";

const ED_MEASURES: { id: EdMeasure; label: string; question: string; hours?: boolean }[] = [
  { id: "waiting", label: "Waiting", question: "People in each emergency department waiting for a psychiatric bed." },
  { id: "urgent", label: "Marked urgent", question: "Waiting people the department has marked urgent." },
  { id: "unplaced", label: "No ward yet", question: "Waiting people with no ward that has accepted them." },
  { id: "over24h", label: "Over 24 hours", question: "Waiting people whose wait has passed 24 hours." },
  {
    id: "longest",
    label: "Longest wait",
    question: "The longest current wait in each department, from the time the request was raised.",
    hours: true,
  },
  {
    id: "median",
    label: "Middle wait",
    question: "The middle (median) current wait in each department. Half wait longer, half shorter.",
    hours: true,
  },
];

function edValue(ed: EdRow, measure: EdMeasure): number {
  if (measure === "longest") return ed.longestMinutes;
  if (measure === "median") return ed.medianMinutes;
  return ed[measure];
}

type Row = {
  id: string;
  name: string;
  sub: string;
  service: string | null;
  colour?: string;
  href?: string;
  value: number | null;
};

const MEASURES: { id: Measure; label: string; question: string }[] = [
  { id: "occupancy", label: "Occupancy", question: "Occupied beds as a share of each ward's beds." },
  { id: "ready", label: "Ready beds", question: "Beds each ward can take a patient into now." },
  { id: "free", label: "Free today", question: "Beds each ward expects to come free before midnight." },
  { id: "closed", label: "Closed beds", question: "Empty beds each ward is not offering." },
  { id: "stay", label: "Average stay", question: "Average length of stay, in days. Case mix differs between wards." },
  { id: "asked", label: "Asked for a bed", question: "Open requests that name each ward." },
  {
    id: "blocked",
    label: "Discharge blockers",
    question: "Patients on each ward with a recorded reason they cannot leave yet.",
  },
  {
    id: "long",
    label: "Stays over 3 months",
    question: "Patients on each ward who have stayed more than three months.",
  },
];

type Extra = { blocked: number; long: number };

function valueOf(ward: WardFigures, measure: Measure, extra?: Extra): number | null {
  if (measure === "blocked") return extra?.blocked ?? null;
  if (measure === "long") return extra?.long ?? null;
  if (measure === "occupancy") return ward.occupancy;
  if (measure === "ready") return ward.ready;
  if (measure === "stay") return ward.averageStayDays;
  if (measure === "free") return releasesToday(ward.releases);
  if (measure === "closed") return ward.closed;
  return ward.askedAndWaiting;
}

/**
 * Proposed compare screen: wards or emergency departments, one measure at a time, sorted by it,
 * with the network average drawn as a line. Keeps both of the current page's comparison charts
 * (every ward and ED measure) and adds the bed measures.
 */
export function CompareStatisticsProposal() {
  const { wards, eds, world, now, asAt } = useStatisticsProposal();
  const [view, setView] = useState<View>("wards");
  const [measure, setMeasure] = useState<Measure>("occupancy");
  const [edMeasure, setEdMeasure] = useState<EdMeasure>("waiting");
  const [service, setService] = useState<string>("all");

  const extras = useMemo(() => {
    const map = new Map<string, Extra>();
    for (const { unit, statistics } of allWardStatistics(world.units, world.admissions, now)) {
      map.set(unit.id, { blocked: statistics.readyToLeaveCannot, long: statistics.longStays });
    }
    return map;
  }, [world.units, world.admissions, now]);

  const edCurrent = ED_MEASURES.find((entry) => entry.id === edMeasure) ?? ED_MEASURES[0];
  const wardCurrent = MEASURES.find((entry) => entry.id === measure) ?? MEASURES[0];
  const current = view === "wards" ? wardCurrent : edCurrent;
  const isHours = view === "eds" && Boolean(edCurrent.hours);
  const isShare = view === "wards" && measure === "occupancy";

  const format = (value: number | null): string => {
    if (value === null) return "–";
    if (isShare) return percent(value);
    if (view === "wards" && measure === "stay") return `${value.toFixed(0)} days`;
    if (isHours) return hoursLabel(value);
    return String(value);
  };

  const allRows: Row[] = useMemo(() => {
    if (view === "wards") {
      return wards.map((ward) => ({
        id: ward.unit.id,
        name: ward.unit.name,
        sub: ward.hospital,
        colour: SERVICE_COLOUR[ward.service],
        href: proposalHref("ward", ward.unit.id),
        service: ward.service,
        value: valueOf(ward, measure, extras.get(ward.unit.id)),
      }));
    }
    return eds.map((ed) => ({
      id: ed.id,
      name: edShort(ed.name),
      sub: ed.service ?? "Health service not recorded",
      colour: ed.service ? SERVICE_COLOUR[ed.service] : undefined,
      href: proposalHref("ed", ed.id),
      service: ed.service,
      value: edValue(ed, edMeasure),
    }));
  }, [view, wards, eds, measure, edMeasure, extras]);

  const rows = useMemo(
    () =>
      allRows
        .filter((row) => service === "all" || row.service === service)
        .sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || a.name.localeCompare(b.name)),
    [allRows, service],
  );

  const values = allRows.map((row) => row.value).filter((value): value is number => value !== null);
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const max = isShare ? 1 : Math.max(1, ...values) * 1.1;
  const top = rows[0];
  const aboveAverage = rows.filter((row) => row.value !== null && row.value > average).length;
  const noun = view === "wards" ? "wards" : "emergency departments";
  const measures = view === "wards" ? MEASURES : ED_MEASURES;
  const activeId = view === "wards" ? measure : edMeasure;

  return (
    <main id="main-content" className={styles.page} data-testid="statistics-proposal-compare">
      <ProposalHeader
        crumbs={[{ label: "Statistics", href: proposalHref("statewide") }, { label: "Compare" }]}
        title={view === "wards" ? "Compare wards" : "Compare emergency departments"}
        asAt={asAt}
      />

      {top && top.value !== null && top.value > 0 ? (
        <Verdict>
          <strong>
            {top.name} is highest on {current.label.toLowerCase()} at {format(top.value)}
          </strong>
          . {aboveAverage} of {rows.length} {noun} are above the network average of {format(average)}.
        </Verdict>
      ) : (
        <Verdict>
          <strong>
            No {noun} have any {current.label.toLowerCase()} right now.
          </strong>
        </Verdict>
      )}

      <div className={styles.header}>
        <div className={styles.segmented} role="group" aria-label="Compare">
          <button type="button" aria-pressed={view === "wards"} onClick={() => setView("wards")}>
            Wards
          </button>
          <button type="button" aria-pressed={view === "eds"} onClick={() => setView("eds")}>
            Emergency departments
          </button>
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

      <div className={styles.segmented} role="group" aria-label="Measure">
        {measures.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={entry.id === activeId}
            onClick={() => (view === "wards" ? setMeasure(entry.id as Measure) : setEdMeasure(entry.id as EdMeasure))}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <Panel
        title={current.label}
        question={current.question}
        meta={`${rows.length} ${noun} · highest first`}
        foot={
          <>
            <span>Dashed line: network average ({format(average)}).</span>
            <ExportCsvButton
              filename={`ward-flow-synthetic-compare-${view}-${activeId}.csv`}
              rows={[
                [view === "wards" ? "Ward" : "Emergency department", "Hospital", current.label],
                ...rows.map((row) => [row.name, row.sub, format(row.value)]),
              ]}
            />
          </>
        }
      >
        <ul className={styles.hbars}>
          {rows.map((row) => (
            <li className={styles.hbar} key={row.id}>
              <span className={styles.rowName}>
                {row.href ? <a href={row.href}>{row.name}</a> : row.name}
                <span className={styles.rowSub}>
                  {row.colour ? (
                    <span
                      className={styles.swatch}
                      style={{
                        background: row.colour,
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        marginRight: 6,
                      }}
                      aria-hidden="true"
                    />
                  ) : null}
                  {row.sub}
                </span>
              </span>
              <span className={styles.hbarTrack}>
                <span className={styles.hbarFill} style={{ width: `${((row.value ?? 0) / max) * 100}%` }} />
                <span className={styles.hbarMarker} style={{ left: `${(average / max) * 100}%` }} />
              </span>
              <span className={styles.hbarValue}>{format(row.value)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </main>
  );
}
