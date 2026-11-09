"use client";

import { useId, useMemo } from "react";

import type { Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { expectedOccupancy, occupancyPercent, type OccupancyAt, type OccupancyRow } from "./expected-occupancy";
import styles from "./capacity-expected-occupancy.module.css";

/**
 * Feature 21 (Josh, 9 Nov 2026): Expected occupancy. A ward per row, the next 24, 48 and 72 hours
 * as columns, and the network total last. Each cell is the likely beds taken out of the ward's beds,
 * with the percentage; the range (only confirmed discharges leave, to everything on record leaves)
 * is read out and shown on hover. A plain table, so a phone scrolls it sideways inside the card.
 * Loaded after the page (`capacity-expected-occupancy-lazy.tsx`): the Capacity route has little
 * phone script headroom, and the table sits at the foot of the forecast card.
 */
export function ExpectedOccupancyTable({
  units,
  bedReleases,
  now,
  stacked = false,
}: {
  /** The wards the forecast covers (a site bed manager's own site). */
  units: readonly Unit[];
  bedReleases: readonly BedRelease[];
  now: Instant;
  stacked?: boolean;
}) {
  const { admissions, plannedAdmissions } = useWardFlowSelect("admissions", "plannedAdmissions");
  const occupancy = useMemo(
    () => expectedOccupancy(units, bedReleases, admissions, now, plannedAdmissions ?? []),
    [units, bedReleases, admissions, now, plannedAdmissions],
  );
  // The forecast draws twice (the desk card and the phone sheet), so the heading id is per copy.
  const titleId = useId();
  const hours = occupancy.total.horizons.map((horizon) => horizon.hours);
  if (occupancy.rows.length === 0) return null;
  return (
    <section className={styles.wrap} aria-labelledby={titleId} data-stacked={stacked || undefined}>
      <h3 id={titleId} className={styles.title}>
        Expected occupancy
      </h3>
      <div className={styles.scroll} role="region" aria-labelledby={titleId} tabIndex={0}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Ward</th>
              <th scope="col" className={styles.num}>
                Now
              </th>
              {hours.map((h) => (
                <th key={h} scope="col" className={styles.num}>
                  {h} h
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {occupancy.rows.map((row) => (
              <Row key={row.unitId} row={row} />
            ))}
          </tbody>
          <tfoot>
            <Row row={occupancy.total} total />
          </tfoot>
        </table>
      </div>
      <p className={styles.note}>
        Likely beds taken: beds taken now, less recorded discharges, plus booked admissions. People waiting without a
        ward are not counted.
      </p>
    </section>
  );
}

function Row({ row, total = false }: { row: OccupancyRow; total?: boolean }) {
  return (
    <tr className={total ? styles.total : undefined}>
      <th scope="row">{row.name}</th>
      <td className={styles.num}>
        <Cell taken={row.takenNow} beds={row.beds} />
      </td>
      {row.horizons.map((horizon) => (
        <td key={horizon.hours} className={styles.num} title={rangeText(horizon, row.beds)}>
          <Cell taken={horizon.likely} beds={row.beds} />
          <span className="sr-only">, {rangeText(horizon, row.beds)}</span>
        </td>
      ))}
    </tr>
  );
}

function Cell({ taken, beds }: { taken: number; beds: number }) {
  return (
    <span className={styles.cell}>
      <span className={styles.figure}>
        {taken}/{beds}
      </span>
      <span className={styles.percent}>{occupancyPercent(taken, beds)}</span>
    </span>
  );
}

function rangeText(horizon: OccupancyAt, beds: number): string {
  if (horizon.low === horizon.high) return `could be ${horizon.low} of ${beds}`;
  return `could be ${horizon.low} to ${horizon.high} of ${beds}`;
}
