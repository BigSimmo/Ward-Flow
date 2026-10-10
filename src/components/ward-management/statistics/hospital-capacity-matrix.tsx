"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BedDouble, Check, ChevronDown, ChevronUp, Search } from "lucide-react";

import { Icon, Segmented, StatusGlyph, TextInput, tableClasses } from "@/components/wf";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { BED_STATE_DETAILS, BED_STATE_LABELS, bedStates } from "@/components/ward-management/ward-bed-states";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import type { BedRelease, LeaveBed, Unit } from "@/components/ward-management/ward-model";

import { StatCard } from "./statistics-hero";
import styles from "./statistics-v6.module.css";

type SortColumn = "name" | "beds" | "rate" | "ready" | "pulled" | "closed";
type SortDirection = "asc" | "desc";
type StatusKey = "none" | "near" | "has";
type StatusFilter = "all" | "near" | "none";

const STATUS_LABELS: Record<StatusKey, string> = {
  none: "None ready",
  near: "Near limit",
  has: "Has ready",
};

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
  status: StatusKey;
}

const COLUMN_LABELS: Record<SortColumn, string> = {
  name: "Ward",
  beds: "Beds",
  rate: "Occupancy",
  ready: BED_STATE_LABELS.ready,
  pulled: BED_STATE_LABELS.pulled,
  closed: BED_STATE_LABELS.closed,
};

/**
 * "Beds by ward": every unit's ruled boxes from `bedStates` — Ready · Pulled · Closed · Occupied
 * add up to its beds. Without `admissions` no pull can be told apart, so Pulled is 0 and a pulled
 * patient stays inside Occupied. `service`, when given, highlights that health service's wards and
 * dims the rest by colour; the status choice does the same. Neither hides a row (v10 filter rule).
 * Only the typed search narrows the list.
 */
export function HospitalCapacityMatrix({
  units,
  bedReleases,
  admissions = [],
  leaveBeds = [],
  service = null,
}: {
  units: Unit[];
  bedReleases: BedRelease[];
  admissions?: readonly Admission[];
  leaveBeds?: readonly LeaveBed[];
  service?: string | null;
}) {
  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortCol, setSortCol] = useState<SortColumn>("rate");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const rows: UnitCapacityRow[] = useMemo(() => {
    return units.map((u) => {
      const site = siteByCode(u.siteCode);
      const states = bedStates(u, admissions, bedReleases, leaveBeds);
      const occRate = u.beds > 0 ? Math.round((states.occupied / u.beds) * 100) : 0;
      const status: StatusKey = states.ready <= 0 ? "none" : occRate >= BED_ALERT_THRESHOLD_PERCENT ? "near" : "has";
      return {
        id: u.id,
        name: u.name,
        siteCode: u.siteCode,
        siteName: site?.name ?? u.siteCode,
        service: site?.service ?? "Other",
        beds: u.beds,
        occupied: states.occupied,
        occRate,
        ready: states.ready,
        pendingPreparation: bedsPendingPreparation(u.id, bedReleases),
        pulled: states.pulled,
        closed: states.closed,
        onLeave: states.onLeave,
        status,
      };
    });
  }, [units, bedReleases, admissions, leaveBeds]);

  const inService = (r: UnitCapacityRow) => !service || r.service === service;
  const counts = {
    all: rows.filter(inService).length,
    near: rows.filter((r) => inService(r) && r.status === "near").length,
    none: rows.filter((r) => inService(r) && r.status === "none").length,
  };
  const highlighting = service !== null || statusFilter !== "all";
  const isMatch = (r: UnitCapacityRow) => inService(r) && (statusFilter === "all" || r.status === statusFilter);

  const filteredRows = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return rows.filter(
      (r) =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.siteName.toLowerCase().includes(q) ||
        r.siteCode.toLowerCase().includes(q) ||
        r.service.toLowerCase().includes(q),
    );
  }, [rows, filterText]);
  const matchedCount = filteredRows.filter(isMatch).length;

  const sortedRows = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const value = (r: UnitCapacityRow): string | number =>
      sortCol === "name"
        ? r.name
        : sortCol === "beds"
          ? r.beds
          : sortCol === "ready"
            ? r.ready
            : sortCol === "pulled"
              ? r.pulled
              : sortCol === "closed"
                ? r.closed
                : r.occRate;
    return [...filteredRows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return a.name.localeCompare(b.name);
    });
  }, [filteredRows, sortCol, sortDir]);

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir(col === "name" ? "asc" : "desc");
    }
  };

  const header = (col: SortColumn, numeric: boolean, title?: string) => {
    const active = sortCol === col;
    return (
      <th
        scope="col"
        className={`${styles.sortTh} ${numeric ? styles.num : ""}`}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        title={title}
      >
        <button type="button" onClick={() => handleSort(col)}>
          {COLUMN_LABELS[col]}
          {active ? <Icon icon={sortDir === "asc" ? ChevronUp : ChevronDown} size={14} /> : null}
        </button>
      </th>
    );
  };

  return (
    <StatCard
      icon={BedDouble}
      title="Beds by ward"
      aside={
        <span className={styles.muted}>
          Sorted by <b>{COLUMN_LABELS[sortCol].toLowerCase()}</b>
        </span>
      }
      data-testid="ward-statistics-overview-capacity-matrix-card"
    >
      <div className={styles.toolbar}>
        <TextInput
          type="search"
          icon={Search}
          boxClassName={styles.search}
          placeholder="Filter wards or hospitals"
          aria-label="Filter capacity matrix"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          data-testid="ward-statistics-capacity-matrix-search"
        />
        <Segmented
          label="Ward status"
          value={statusFilter}
          onChange={setStatusFilter}
          items={[
            { id: "all", label: "All", count: counts.all },
            { id: "near", label: "Near limit", count: counts.near },
            { id: "none", label: "None ready", count: counts.none },
          ]}
        />
        <span className={styles.toolbarEnd} role="status" data-testid="ward-statistics-capacity-matrix-count">
          {highlighting ? (
            <>
              <b>{matchedCount}</b> of {filteredRows.length} highlighted{service ? ` in ${service}` : null}, all rows
              stay
            </>
          ) : (
            <>
              <b>{filteredRows.length}</b> of {rows.length}
            </>
          )}
        </span>
      </div>
      <div className={styles.tableWrap}>
        <table
          className={`${tableClasses.table} ${styles.table}`}
          data-testid="ward-statistics-overview-capacity-matrix"
        >
          <caption className={styles.srOnly}>Beds by ward, synthetic</caption>
          <thead>
            <tr>
              {header("name", false)}
              {header("beds", true)}
              {header("rate", true)}
              {header("ready", true)}
              {header("pulled", true, BED_STATE_DETAILS.pulled)}
              {header("closed", true, BED_STATE_DETAILS.closed)}
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.empty}>
                  No units match &ldquo;{filterText}&rdquo;
                </td>
              </tr>
            ) : (
              sortedRows.map((r) => (
                <tr key={r.id} data-dim={highlighting && !isMatch(r) ? "true" : undefined}>
                  <th scope="row" className={styles.wardCell}>
                    <Link href={wardStatisticsHref(r.id)} className={styles.rowLink} title={r.name}>
                      {r.name}
                    </Link>
                    <span className={styles.sub}>
                      <span title={r.siteName}>{r.siteCode}</span> · {r.occupied}{" "}
                      {BED_STATE_LABELS.occupied.toLowerCase()}
                      {r.onLeave > 0 ? `, ${r.onLeave} on leave` : null}
                      {r.pendingPreparation > 0 ? `, ${r.pendingPreparation} being made ready` : null}
                    </span>
                  </th>
                  <td className={styles.num}>{r.beds}</td>
                  <td className={styles.num}>
                    <span className={styles.occBar}>
                      <span className={styles.occTrack} aria-hidden="true">
                        <span className={styles.occFill} style={{ width: `${Math.min(100, r.occRate)}%` }} />
                        <span className={styles.occTick} style={{ left: `${BED_ALERT_THRESHOLD_PERCENT}%` }} />
                      </span>
                      <span className={styles.occValue}>{r.occRate}%</span>
                    </span>
                  </td>
                  <td className={`${styles.num} ${r.ready === 0 ? styles.zero : ""}`}>{r.ready}</td>
                  <td className={`${styles.num} ${r.pulled === 0 ? styles.zero : ""}`}>{r.pulled}</td>
                  <td className={`${styles.num} ${r.closed === 0 ? styles.zero : ""}`}>{r.closed}</td>
                  <td>
                    <span className={styles.statusCell}>
                      {r.status === "has" ? <Icon icon={Check} size={14} /> : <StatusGlyph tone="warning" size={9} />}
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </StatCard>
  );
}
