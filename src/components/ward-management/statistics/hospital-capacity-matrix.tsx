"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { BED_STATE_DETAILS, BED_STATE_LABELS, bedStates } from "@/components/ward-management/ward-bed-states";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import type { BedRelease, LeaveBed, Unit } from "@/components/ward-management/ward-model";
import styles from "./statistics-third-edition.module.css";

type SortColumn = "name" | "service" | "beds" | "occupied" | "rate" | "ready" | "pulled" | "closed";
type SortDirection = "asc" | "desc";

interface UnitCapacityRow {
  id: string;
  name: string;
  siteCode: string;
  siteName: string;
  service: string;
  beds: number;
  occupied: number;
  occRate: number;
  ready: number;
  pendingPreparation: number;
  pulled: number;
  closed: number;
  onLeave: number;
  statusLabel: "No ready beds" | "Near Limit" | "Ready beds recorded";
  statusTone: "danger" | "warn" | "good";
}

/**
 * Bed figures are the ruled boxes from `bedStates` — Ready · Pulled · Closed · Occupied add up to
 * each unit's beds. Without `admissions` no pull can be told apart, so Pulled is 0 and a pulled
 * patient stays inside Occupied.
 */
export function HospitalCapacityMatrix({
  units,
  bedReleases,
  admissions = [],
  leaveBeds = [],
}: {
  units: Unit[];
  bedReleases: BedRelease[];
  admissions?: readonly Admission[];
  leaveBeds?: readonly LeaveBed[];
}) {
  const [filterText, setFilterText] = useState("");
  const [sortCol, setSortCol] = useState<SortColumn>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const searchInputId = useId();

  const rows: UnitCapacityRow[] = useMemo(() => {
    return units.map((u) => {
      const site = siteByCode(u.siteCode);
      const states = bedStates(u, admissions, bedReleases, leaveBeds);
      const beds = u.beds;
      const occupied = states.occupied;
      const occRate = beds > 0 ? Math.round((occupied / beds) * 100) : 0;
      const ready = states.ready;
      const pendingPreparation = bedsPendingPreparation(u.id, bedReleases);

      let statusLabel: "No ready beds" | "Near Limit" | "Ready beds recorded" = "Ready beds recorded";
      let statusTone: "danger" | "warn" | "good" = "good";

      if (ready <= 0) {
        statusLabel = "No ready beds";
        statusTone = "danger";
      } else if (occRate >= 85) {
        statusLabel = "Near Limit";
        statusTone = "warn";
      }

      return {
        id: u.id,
        name: u.name,
        siteCode: u.siteCode,
        siteName: site?.name ?? u.siteCode,
        service: site?.service ?? "Other",
        beds,
        occupied,
        occRate,
        ready,
        pendingPreparation,
        pulled: states.pulled,
        closed: states.closed,
        onLeave: states.onLeave,
        statusLabel,
        statusTone,
      };
    });
  }, [units, bedReleases, admissions, leaveBeds]);

  const filteredRows = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.siteName.toLowerCase().includes(q) ||
        r.siteCode.toLowerCase().includes(q) ||
        r.service.toLowerCase().includes(q),
    );
  }, [rows, filterText]);

  const sortedRows = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;

      if (sortCol === "name") {
        av = a.name;
        bv = b.name;
      } else if (sortCol === "service") {
        av = a.service;
        bv = b.service;
      } else if (sortCol === "beds") {
        av = a.beds;
        bv = b.beds;
      } else if (sortCol === "occupied") {
        av = a.occupied;
        bv = b.occupied;
      } else if (sortCol === "rate") {
        av = a.occRate;
        bv = b.occRate;
      } else if (sortCol === "ready") {
        av = a.ready;
        bv = b.ready;
      } else if (sortCol === "pulled") {
        av = a.pulled;
        bv = b.pulled;
      } else if (sortCol === "closed") {
        av = a.closed;
        bv = b.closed;
      }

      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return a.name.localeCompare(b.name);
    });
  }, [filteredRows, sortCol, sortDir]);

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const getSortAria = (col: SortColumn) => {
    if (sortCol !== col) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  };

  const getSortIndicator = (col: SortColumn) => {
    if (sortCol !== col) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  return (
    <section
      className={styles.chartCard}
      aria-labelledby="matrixH"
      data-testid="ward-statistics-overview-capacity-matrix-card"
    >
      <div className={styles.chartHeader}>
        <h2 id="matrixH" className={styles.chartTitle}>
          Beds by hospital and ward
        </h2>
        <span className={styles.chartCount}>{units.length} wards</span>
      </div>

      <div className={styles.tableTools}>
        <input
          id={searchInputId}
          type="search"
          className={styles.tableSearch}
          placeholder="Filter by hospital, ward or service..."
          aria-label="Filter capacity matrix"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          data-testid="ward-statistics-capacity-matrix-search"
        />
        <div className={styles.toolsAction}>
          <span className={styles.note} aria-live="polite">
            Showing {filteredRows.length} of {units.length} synthetic units
          </span>
        </div>
      </div>

      <WardTable className={styles.dtable} testId="ward-statistics-overview-capacity-matrix" hasScrollThreshold>
        <thead>
          <tr>
            <th scope="col" aria-sort={getSortAria("name")}>
              <button type="button" className={styles.tableSortBtn} onClick={() => handleSort("name")}>
                Ward
                <span aria-hidden="true">{getSortIndicator("name")}</span>
              </button>
            </th>
            <th scope="col" aria-sort={getSortAria("service")}>
              <button type="button" className={styles.tableSortBtn} onClick={() => handleSort("service")}>
                Health service
                <span aria-hidden="true">{getSortIndicator("service")}</span>
              </button>
            </th>
            <th scope="col" className={styles.n} aria-sort={getSortAria("beds")}>
              <button type="button" className={`${styles.tableSortBtn} ${styles.n}`} onClick={() => handleSort("beds")}>
                Beds
                <span aria-hidden="true">{getSortIndicator("beds")}</span>
              </button>
            </th>
            <th scope="col" className={styles.n} aria-sort={getSortAria("occupied")}>
              <button
                type="button"
                className={`${styles.tableSortBtn} ${styles.n}`}
                onClick={() => handleSort("occupied")}
              >
                {BED_STATE_LABELS.occupied}
                <span aria-hidden="true">{getSortIndicator("occupied")}</span>
              </button>
            </th>
            <th scope="col" className={styles.n} aria-sort={getSortAria("rate")}>
              <button type="button" className={`${styles.tableSortBtn} ${styles.n}`} onClick={() => handleSort("rate")}>
                Occupancy<span aria-hidden="true">{getSortIndicator("rate")}</span>
              </button>
            </th>
            <th scope="col" className={styles.n} aria-sort={getSortAria("ready")}>
              <button
                type="button"
                className={`${styles.tableSortBtn} ${styles.n}`}
                onClick={() => handleSort("ready")}
              >
                {BED_STATE_LABELS.ready}
                <span aria-hidden="true">{getSortIndicator("ready")}</span>
              </button>
            </th>
            <th scope="col" className={styles.n} aria-sort={getSortAria("pulled")} title={BED_STATE_DETAILS.pulled}>
              <button
                type="button"
                className={`${styles.tableSortBtn} ${styles.n}`}
                onClick={() => handleSort("pulled")}
              >
                {BED_STATE_LABELS.pulled}
                <span aria-hidden="true">{getSortIndicator("pulled")}</span>
              </button>
            </th>
            <th scope="col" className={styles.n} aria-sort={getSortAria("closed")} title={BED_STATE_DETAILS.closed}>
              <button
                type="button"
                className={`${styles.tableSortBtn} ${styles.n}`}
                onClick={() => handleSort("closed")}
              >
                {BED_STATE_LABELS.closed}
                <span aria-hidden="true">{getSortIndicator("closed")}</span>
              </button>
            </th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={9} className={styles.emptyNote} style={{ textAlign: "center", padding: "1.5rem" }}>
                No units match &ldquo;{filterText}&rdquo;
              </td>
            </tr>
          ) : (
            sortedRows.map((r) => (
              <tr key={r.id}>
                <th scope="row">
                  <Link href={wardStatisticsHref(r.id)} style={{ color: "inherit", textDecoration: "none" }}>
                    <strong>{r.name}</strong>{" "}
                    <span
                      style={{
                        color: "var(--muted)",
                        fontSize: "var(--t-0)",
                        fontWeight: "normal",
                      }}
                    >
                      ({r.siteName})
                    </span>
                  </Link>
                </th>
                <td>{r.service}</td>
                <td className={styles.n}>{r.beds}</td>
                <td className={styles.n}>
                  {r.occupied}
                  {r.onLeave > 0 ? <span className={styles.note}> · {r.onLeave} on leave</span> : null}
                </td>
                <td className={styles.n}>
                  <span className={styles.statusPill} data-tone={r.statusTone}>
                    {r.occRate}%
                  </span>
                </td>
                <td className={styles.n}>
                  {r.ready > 0 ? <strong>{r.ready}</strong> : <span className={styles.zero}>none</span>}
                  {r.pendingPreparation > 0 ? (
                    <span className={styles.note}> · {r.pendingPreparation} being made ready (not deducted)</span>
                  ) : null}
                </td>
                <td className={styles.n}>{r.pulled > 0 ? r.pulled : <span className={styles.zero}>none</span>}</td>
                <td className={styles.n}>{r.closed > 0 ? r.closed : <span className={styles.zero}>none</span>}</td>
                <td>
                  <span className={styles.statusPill} data-tone={r.statusTone}>
                    {r.statusLabel}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </WardTable>
    </section>
  );
}
