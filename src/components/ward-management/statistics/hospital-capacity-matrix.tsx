"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import styles from "./statistics-third-edition.module.css";

type SortColumn = "name" | "service" | "beds" | "occupied" | "rate" | "ready" | "held";
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
  held: number;
  statusLabel: "At Capacity" | "Near Limit" | "Open Intake";
  statusTone: "danger" | "warn" | "good";
}

export function HospitalCapacityMatrix({ units, bedReleases }: { units: Unit[]; bedReleases: BedRelease[] }) {
  const [filterText, setFilterText] = useState("");
  const [sortCol, setSortCol] = useState<SortColumn>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const searchInputId = useId();

  const rows: UnitCapacityRow[] = useMemo(() => {
    return units.map((u) => {
      const site = siteByCode(u.siteCode);
      const cap = unitCapacity(u, bedReleases);
      const beds = u.beds;
      const occupied = cap.occupied;
      const occRate = beds > 0 ? Math.round((occupied / beds) * 100) : 0;
      const ready = cap.available;
      const held = cap.held;

      let statusLabel: "At Capacity" | "Near Limit" | "Open Intake" = "Open Intake";
      let statusTone: "danger" | "warn" | "good" = "good";

      if (occRate >= 95) {
        statusLabel = "At Capacity";
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
        held,
        statusLabel,
        statusTone,
      };
    });
  }, [units, bedReleases]);

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
      } else if (sortCol === "held") {
        av = a.held;
        bv = b.held;
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
          Hospital &amp; Inpatient Unit Capacity Matrix
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
            Showing {filteredRows.length} of {units.length} units
          </span>
        </div>
      </div>

      <WardTable className={styles.dtable} testId="ward-statistics-overview-capacity-matrix" hasScrollThreshold>
        <thead>
          <tr>
            <th scope="col" aria-sort={getSortAria("name")}>
              <button type="button" className={styles.tableSortBtn} onClick={() => handleSort("name")}>
                Unit Name
                <span aria-hidden="true">{getSortIndicator("name")}</span>
              </button>
            </th>
            <th scope="col" aria-sort={getSortAria("service")}>
              <button type="button" className={styles.tableSortBtn} onClick={() => handleSort("service")}>
                Health Service
                <span aria-hidden="true">{getSortIndicator("service")}</span>
              </button>
            </th>
            <th scope="col" className={styles.n} aria-sort={getSortAria("beds")}>
              <button type="button" className={`${styles.tableSortBtn} ${styles.n}`} onClick={() => handleSort("beds")}>
                Total Beds
                <span aria-hidden="true">{getSortIndicator("beds")}</span>
              </button>
            </th>
            <th scope="col" className={styles.n} aria-sort={getSortAria("occupied")}>
              <button
                type="button"
                className={`${styles.tableSortBtn} ${styles.n}`}
                onClick={() => handleSort("occupied")}
              >
                Occupied
                <span aria-hidden="true">{getSortIndicator("occupied")}</span>
              </button>
            </th>
            <th scope="col" className={styles.n} aria-sort={getSortAria("rate")}>
              <button type="button" className={`${styles.tableSortBtn} ${styles.n}`} onClick={() => handleSort("rate")}>
                Occupancy %<span aria-hidden="true">{getSortIndicator("rate")}</span>
              </button>
            </th>
            <th scope="col" className={styles.n} aria-sort={getSortAria("ready")}>
              <button
                type="button"
                className={`${styles.tableSortBtn} ${styles.n}`}
                onClick={() => handleSort("ready")}
              >
                Ready
                <span aria-hidden="true">{getSortIndicator("ready")}</span>
              </button>
            </th>
            <th scope="col" className={styles.n} aria-sort={getSortAria("held")}>
              <button type="button" className={`${styles.tableSortBtn} ${styles.n}`} onClick={() => handleSort("held")}>
                Pending/Held
                <span aria-hidden="true">{getSortIndicator("held")}</span>
              </button>
            </th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={8} className={styles.emptyNote} style={{ textAlign: "center", padding: "1.5rem" }}>
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
                <td className={styles.n}>{r.occupied}</td>
                <td className={styles.n}>
                  <span className={styles.statusPill} data-tone={r.statusTone}>
                    {r.occRate}%
                  </span>
                </td>
                <td className={styles.n}>
                  {r.ready > 0 ? <strong>{r.ready}</strong> : <span className={styles.zero}>none</span>}
                </td>
                <td className={styles.n}>{r.held > 0 ? r.held : <span className={styles.zero}>none</span>}</td>
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
