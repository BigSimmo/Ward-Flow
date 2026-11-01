"use client";

// The summary's ward table: "Where the pressure is" across the network, or a site bed manager's own
// wards. Its sort, highlight and Show all state come from `useWardTable`, held by the summary view.

import { useMemo, useState } from "react";

import { Badge, Button, FilterChip, Segmented, cx, rowDim, tableClasses } from "@/components/wf";
import {
  Foot,
  MoreLink,
  Occ,
  StatCardR,
  Z,
  redesignStyles as redesign,
} from "@/components/ward-management/statistics/redesign/statistics-redesign-parts";
import { useCanOpenHref } from "../shell/ward-access";
import { BED_ALERT_THRESHOLD_PERCENT } from "../shell/ward-service-bed-alerts";
import { STATISTICS_COMPARE_HREF } from "./statistics-sections";
import type { SummaryWard } from "./statistics-network-cards";
import { exactStatisticsCount, type StatisticsCount } from "./statistics-small-numbers";
import { PRESSURE_ROWS, SortTh, type WardSortKey } from "./statistics-screen-parts";
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
  // Compare is linked only for a desk that may open it (access audit, 31 Oct 2026).
  const canCompare = useCanOpenHref()(STATISTICS_COMPARE_HREF);

  // The redesign's Wards and Hospitals switch (Q135): the same rows, grouped under each hospital.
  const [groupBy, setGroupBy] = useState<"wards" | "hospitals">("wards");
  const hospitals = groupBy === "hospitals" ? [...new Set(visibleWards.map((w) => w.hospital))].sort() : [];
  const wardRow = (w: SummaryWard) => {
    const percent = Math.round(w.occupancyRate * 100);
    const over = percent >= BED_ALERT_THRESHOLD_PERCENT;
    return (
      <tr key={w.id} {...rowDim(wardOverLine && !over)}>
        <th scope="row">
          <span className={redesign.name}>
            <span>
              {w.name}
              {w.ready === 0 && w.occupancyRate === 1 ? (
                <>
                  {" "}
                  <Badge variant="plain" tone="neutral" size="sm">
                    Full
                  </Badge>
                </>
              ) : null}
            </span>
            <small title={w.hospital}>
              {w.site}
              <span className="sr-only">, {w.hospital}</span>
            </small>
          </span>
        </th>
        <td className={cx(redesign.r, tableClasses.num)}>
          <Occ pct={percent} threshold={BED_ALERT_THRESHOLD_PERCENT} label={`${w.name} occupancy`} />
        </td>
        <td className={cx(redesign.r, tableClasses.num)}>
          <Z v={w.ready} />
          {w.pendingPreparation > 0 ? (
            <span className={styles.cellNote}>{w.pendingPreparation} being made ready</span>
          ) : null}
        </td>
        <td className={cx(redesign.r, tableClasses.num)}>
          <Z v={exactStatisticsCount(w.referred) === 0 ? 0 : small(w.referred)} />
        </td>
        <td className={cx(redesign.r, tableClasses.num)}>{w.beds}</td>
      </tr>
    );
  };

  return (
    <StatCardR
      id="pressure"
      title={siteName ? `${siteName} wards` : "Where the pressure is"}
      // Bed manager: the column heads say what the table shows, so the title stands alone.
      meta={
        siteName
          ? undefined
          : `${overLineCount} ${overLineCount === 1 ? "ward" : "wards"} at or over ${BED_ALERT_THRESHOLD_PERCENT}%`
      }
      aside={
        siteName ? undefined : (
          <Segmented
            size="sm"
            label="Group by"
            value={groupBy}
            onChange={setGroupBy}
            items={[
              { id: "wards", label: "Wards" },
              { id: "hospitals", label: "Hospitals" },
            ]}
          />
        )
      }
      data-testid="ward-statistics-pressure"
      foot={
        <Foot link={canCompare ? <MoreLink href={STATISTICS_COMPARE_HREF}>Compare wards</MoreLink> : undefined}>
          {filteredAndSortedWards.length > PRESSURE_ROWS ? (
            <Button size="sm" variant="ghost" onClick={() => setWardShowAll((value) => !value)}>
              {wardShowAll ? `Show top ${PRESSURE_ROWS}` : `Show all ${filteredAndSortedWards.length}`}
            </Button>
          ) : (
            "Highest occupancy first"
          )}
        </Foot>
      }
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
      <div
        className={redesign.tableWrap}
        tabIndex={0}
        role="region"
        aria-label="Inpatient mental health ward capacity and demand, scrollable table"
      >
        <table className={cx(tableClasses.table, redesign.table)} id="wardPressureTable">
          <caption className="sr-only">Inpatient mental health ward capacity and demand</caption>
          <thead>
            <tr>
              <SortTh id="name" label="Ward" sort={wardSortCol} asc={wardSortAsc} onSort={handleWardSort} />
              <SortTh id="occ" label="Occupancy" sort={wardSortCol} asc={wardSortAsc} onSort={handleWardSort} numeric />
              <SortTh id="ready" label="Ready" sort={wardSortCol} asc={wardSortAsc} onSort={handleWardSort} numeric />
              <SortTh id="ref" label="Awaiting" sort={wardSortCol} asc={wardSortAsc} onSort={handleWardSort} numeric />
              <SortTh id="beds" label="Beds" sort={wardSortCol} asc={wardSortAsc} onSort={handleWardSort} numeric />
            </tr>
          </thead>
          {groupBy === "hospitals" ? (
            hospitals.map((hospital) => (
              <tbody key={hospital}>
                <tr className={redesign.group}>
                  <th scope="rowgroup" colSpan={5}>
                    {hospital}
                  </th>
                </tr>
                {visibleWards.filter((w) => w.hospital === hospital).map(wardRow)}
              </tbody>
            ))
          ) : (
            <tbody>{visibleWards.map(wardRow)}</tbody>
          )}
        </table>
      </div>
    </StatCardR>
  );
}
