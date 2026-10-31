"use client";

// The summary's ward table: "Where the pressure is" across the network, or a site bed manager's own
// wards. Its sort, highlight and Show all state come from `useWardTable`, held by the summary view.

import { useMemo, useState } from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";

import { Badge, Button, CardFoot, FilterChip, StatusGlyph, rowDim, tableClasses } from "@/components/wf";
import { BED_ALERT_THRESHOLD_PERCENT } from "../shell/ward-service-bed-alerts";
import { StatCard } from "./statistics-hero";
import { STATISTICS_COMPARE_HREF } from "./statistics-sections";
import type { SummaryWard } from "./statistics-network-cards";
import { exactStatisticsCount, type StatisticsCount } from "./statistics-small-numbers";
import { PRESSURE_ROWS, SiteCodeKey, SortTh, type WardSortKey } from "./statistics-screen-parts";
import styles from "./statistics-v6.module.css";

/**
 * The ward table's sort, highlight and Show all state. The summary view holds it, so the table keeps
 * its state when the window crosses the phone width and back; the phone skips the sort.
 */
export function useWardTable(allPressureWards: readonly SummaryWard[], isPhone: boolean) {
  const [wardOverLine, setWardOverLine] = useState(false);
  const [wardShowAll, setWardShowAll] = useState(false);
  const [wardSortCol, setWardSortCol] = useState<WardSortKey>("occ");
  const [wardSortAsc, setWardSortAsc] = useState(false);

  const handleWardSort = (col: WardSortKey) => {
    if (wardSortCol === col) setWardSortAsc((prev) => !prev);
    else {
      setWardSortCol(col);
      setWardSortAsc(col === "name");
    }
  };

  const filteredAndSortedWards = useMemo(() => {
    if (isPhone) return [];
    const list = allPressureWards.slice();
    const value = (w: (typeof list)[number]): number | string | null =>
      wardSortCol === "name"
        ? w.name
        : wardSortCol === "beds"
          ? w.beds
          : wardSortCol === "ready"
            ? w.ready
            : wardSortCol === "ref"
              ? exactStatisticsCount(w.referred)
              : w.occupancyRate;
    list.sort((a, b) => {
      const vA = value(a);
      const vB = value(b);
      if (vA === null || vB === null) return vA === vB ? a.name.localeCompare(b.name) : vA === null ? 1 : -1;
      if (vA < vB) return wardSortAsc ? -1 : 1;
      if (vA > vB) return wardSortAsc ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [isPhone, allPressureWards, wardSortCol, wardSortAsc]);

  return {
    wardOverLine,
    setWardOverLine,
    wardShowAll,
    setWardShowAll,
    wardSortCol,
    wardSortAsc,
    handleWardSort,
    filteredAndSortedWards,
  };
}

export function StatisticsWardsCard({
  wards: allPressureWards,
  table,
  siteName,
  small,
}: {
  wards: readonly SummaryWard[];
  table: ReturnType<typeof useWardTable>;
  /** Set for a site bed manager: its own site's wards, titled with the site's name. */
  siteName?: string;
  small: (count: StatisticsCount) => number | string;
}) {
  const {
    wardOverLine,
    setWardOverLine,
    wardShowAll,
    setWardShowAll,
    wardSortCol,
    wardSortAsc,
    handleWardSort,
    filteredAndSortedWards,
  } = table;
  const overLineCount = allPressureWards.filter(
    (w) => Math.round(w.occupancyRate * 100) >= BED_ALERT_THRESHOLD_PERCENT,
  ).length;
  const visibleWards = wardShowAll ? filteredAndSortedWards : filteredAndSortedWards.slice(0, PRESSURE_ROWS);

  return (
    <StatCard
      icon={TrendingUp}
      title={siteName ? `${siteName} wards` : "Where the pressure is"}
      // Bed manager: the column heads say what the table shows, so the title stands alone.
      meta={siteName ? undefined : "Occupancy, awaiting answer"}
      data-testid="ward-statistics-pressure"
    >
      {/* Bed manager: with three wards or fewer the highlight chip and count cannot change what
        is read, so the toolbar goes. */}
      {siteName && allPressureWards.length <= 3 ? null : (
        <div className={styles.toolbar}>
          <FilterChip pressed={wardOverLine} onPressedChange={setWardOverLine} tone="warning" count={overLineCount}>
            {`At or over ${BED_ALERT_THRESHOLD_PERCENT}%`}
          </FilterChip>
          <span className={styles.toolbarEnd} id="wardFilterCount" role="status">
            {wardOverLine ? (
              <>
                <b>{overLineCount}</b> of {filteredAndSortedWards.length}{" "}
                <span className={styles.srOnly}>synthetic rows</span> highlighted, all rows stay
              </>
            ) : (
              <>
                <b>{allPressureWards.length}</b> {allPressureWards.length === 1 ? "ward" : "wards"}{" "}
                <span className={styles.srOnly}>synthetic rows</span>
              </>
            )}
          </span>
        </div>
      )}
      <div className={styles.tableWrap}>
        <table className={`${tableClasses.table} ${styles.table}`} id="wardPressureTable">
          <caption className={styles.srOnly}>Inpatient mental health ward capacity and demand</caption>
          <thead>
            <tr>
              <SortTh id="name" label="Ward" sort={wardSortCol} asc={wardSortAsc} onSort={handleWardSort} />
              <SortTh id="beds" label="Beds" sort={wardSortCol} asc={wardSortAsc} onSort={handleWardSort} numeric />
              <SortTh id="ready" label="Ready" sort={wardSortCol} asc={wardSortAsc} onSort={handleWardSort} numeric />
              <SortTh id="occ" label="Occupancy" sort={wardSortCol} asc={wardSortAsc} onSort={handleWardSort} numeric />
              <SortTh id="ref" label="Awaiting" sort={wardSortCol} asc={wardSortAsc} onSort={handleWardSort} numeric />
            </tr>
          </thead>
          <tbody>
            {visibleWards.map((w) => {
              const percent = Math.round(w.occupancyRate * 100);
              const over = percent >= BED_ALERT_THRESHOLD_PERCENT;
              return (
                <tr key={w.id} {...rowDim(wardOverLine && !over)}>
                  <th scope="row">
                    {w.name}
                    <span className={styles.code} title={w.hospital}>
                      {w.site}
                      <span className={styles.srOnly}>, {w.hospital}</span>
                    </span>
                    {w.ready === 0 && w.occupancyRate === 1 ? (
                      <Badge variant="plain" tone="neutral" size="sm">
                        Full
                      </Badge>
                    ) : null}
                  </th>
                  <td className={styles.num}>{w.beds}</td>
                  <td className={`${styles.num} ${w.ready === 0 ? styles.zero : ""}`}>{w.ready}</td>
                  <td className={styles.num}>
                    <span className={styles.occBar}>
                      <span className={styles.occTrack} aria-hidden="true">
                        <span className={styles.occFill} style={{ width: `${Math.min(100, percent)}%` }} />
                        <span className={styles.occTick} style={{ left: `${BED_ALERT_THRESHOLD_PERCENT}%` }} />
                      </span>
                      <span className={styles.occValue}>
                        {over ? <StatusGlyph tone="warning" size={9} /> : null}
                        {percent}%
                      </span>
                    </span>
                  </td>
                  <td className={`${styles.num} ${exactStatisticsCount(w.referred) === 0 ? styles.zero : ""}`}>
                    {small(w.referred)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Bed manager: one site needs no key; the card title already names it. */}
      {siteName ? null : <SiteCodeKey sites={visibleWards.map((w) => ({ code: w.site, name: w.hospital }))} />}
      {/* Bed manager: Compare is not one of its statistics sections, so it is not linked, and a
        foot with nothing in it is not drawn. */}
      {siteName && filteredAndSortedWards.length <= PRESSURE_ROWS ? null : (
        <CardFoot
          meta={
            filteredAndSortedWards.length > PRESSURE_ROWS ? (
              <Button size="sm" variant="ghost" onClick={() => setWardShowAll((value) => !value)}>
                {wardShowAll ? `Show top ${PRESSURE_ROWS}` : `Show all ${filteredAndSortedWards.length}`}
              </Button>
            ) : undefined
          }
        >
          {siteName ? null : (
            <Link href={STATISTICS_COMPARE_HREF} className={styles.footLink}>
              Compare wards
            </Link>
          )}
        </CardFoot>
      )}
    </StatCard>
  );
}
