"use client";

import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import styles from "./statistics-third-edition.module.css";

interface StatewideAllocationHeadroomProps {
  units: Unit[];
  bedReleases: BedRelease[];
  capacityReady: number;
}

export function StatewideAllocationHeadroom({ units, bedReleases, capacityReady }: StatewideAllocationHeadroomProps) {
  const totalAuthorizedBeds = units.reduce((sum, u) => sum + u.beds, 0);
  const totalOccupiedBeds = units.reduce((sum, u) => sum + unitCapacity(u, bedReleases).occupied, 0);
  const preparingCount = units.reduce((sum, u) => sum + bedsPendingPreparation(u.id, bedReleases), 0);
  const occupancyPct = totalAuthorizedBeds > 0 ? ((totalOccupiedBeds / totalAuthorizedBeds) * 100).toFixed(1) : "0.0";

  return (
    <section className={styles.chartCard} aria-labelledby="kpiCapH" data-testid="ward-statistics-overview-headroom">
      <div className={styles.chartHeader}>
        <h2 id="kpiCapH" className={styles.chartTitle}>
          Statewide Allocation Headroom
        </h2>
        <span className={styles.chartCount}>{capacityReady} ready for intake</span>
      </div>
      <dl className={styles.band} id="capacityBand">
        <div className={styles.kpi} data-testid="headroom-authorized-beds">
          <dt>Authorized Inpatient Beds</dt>
          <dd>{totalAuthorizedBeds}</dd>
          <dd className={styles.kpiNote}>Across {units.length} inpatient psychiatric units in Western Australia.</dd>
        </div>
        <div className={styles.kpi} data-testid="headroom-occupied-beds">
          <dt>Currently Occupied Beds</dt>
          <dd>{totalOccupiedBeds}</dd>
          <dd className={styles.kpiNote}>{occupancyPct}% statewide occupancy across all configured beds.</dd>
        </div>
        <div className={styles.kpi} data-testid="headroom-ready-intake">
          <dt>Ready for Immediate Intake</dt>
          <dd>{capacityReady}</dd>
          <dd className={styles.kpiNote}>Confirmed allocatable and physically empty.</dd>
        </div>
        <div className={styles.kpi} data-testid="headroom-pending-preparation">
          <dt>Pending Preparation</dt>
          <dd>{preparingCount}</dd>
          <dd className={styles.kpiNote}>Requires cleaning or maintenance clearance before allocation.</dd>
        </div>
      </dl>
    </section>
  );
}
