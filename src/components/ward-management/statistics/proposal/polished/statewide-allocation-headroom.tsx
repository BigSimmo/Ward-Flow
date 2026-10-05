"use client";

import type { Admission } from "@/components/ward-management/ward-admissions";
import type { BedRelease, LeaveBed, Unit } from "@/components/ward-management/ward-model";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { occupiedBeds } from "./polished-figures";
import styles from "../../statistics-third-edition.module.css";

interface StatewideAllocationHeadroomProps {
  units: Unit[];
  admissions: readonly Admission[];
  bedReleases: BedRelease[];
  leaveBeds: readonly LeaveBed[];
  capacityReady: number;
}

export function StatewideAllocationHeadroom({
  units,
  admissions,
  bedReleases,
  leaveBeds,
  capacityReady,
}: StatewideAllocationHeadroomProps) {
  const totalAuthorizedBeds = units.reduce((sum, u) => sum + u.beds, 0);
  const occupancy = occupiedBeds(units, admissions, bedReleases, leaveBeds);
  const totalOccupiedBeds = occupancy.occupied;
  const preparingCount = units.reduce((sum, u) => sum + bedsPendingPreparation(u.id, bedReleases), 0);
  const occupancyPct = totalAuthorizedBeds > 0 ? ((totalOccupiedBeds / totalAuthorizedBeds) * 100).toFixed(1) : "0.0";

  return (
    <section className={styles.chartCard} aria-labelledby="kpiCapH" data-testid="ward-statistics-overview-headroom">
      <div className={styles.chartHeader}>
        <h2 id="kpiCapH" className={styles.chartTitle}>
          Statewide beds
        </h2>
        <span className={styles.chartCount}>{capacityReady} ready now</span>
      </div>
      <dl className={styles.band} id="capacityBand">
        <div className={styles.kpi} data-testid="headroom-authorized-beds">
          <dt>Inpatient beds</dt>
          <dd>{totalAuthorizedBeds}</dd>
          <dd className={styles.kpiNote}>Across {units.length} inpatient psychiatric units in Western Australia.</dd>
        </div>
        <div className={styles.kpi} data-testid="headroom-occupied-beds">
          <dt>Occupied</dt>
          <dd>{totalOccupiedBeds}</dd>
          <dd className={styles.kpiNote}>
            {occupancyPct}% of all beds. {occupancy.pulled} more are pulled for people not yet arrived.
          </dd>
        </div>
        <div className={styles.kpi} data-testid="headroom-ready-intake">
          <dt>Ready now</dt>
          <dd>{capacityReady}</dd>
          <dd className={styles.kpiNote}>Empty and able to take a patient now.</dd>
        </div>
        <div className={styles.kpi} data-testid="headroom-pending-preparation">
          <dt>Being made ready</dt>
          <dd>{preparingCount}</dd>
          <dd className={styles.kpiNote}>Free, but being cleaned or checked before use.</dd>
        </div>
      </dl>
    </section>
  );
}
