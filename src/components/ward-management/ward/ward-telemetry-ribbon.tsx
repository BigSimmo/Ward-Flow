"use client";

import { HeroStat, durMinutes } from "@/components/wf";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { dayShiftEndInstant } from "@/components/ward-management/ward-board-time-features";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";

import styles from "./ward-telemetry-ribbon.module.css";

interface WardTelemetryRibbonProps {
  unit: Unit;
  capacity: {
    available: number;
    occupied: number;
  };
  staffedSpecialling: number;
  now: Instant;
}

/**
 * The ward's counts on the v6 hero band (design/pages-v6/Ward.png): Ready now, Occupied, 1:1
 * specialling, ready by the end of the day shift, and how long since the figure was confirmed.
 * Every value is derived from the record; the ready-bed figure carries how many of those beds are
 * still being made ready, for a screen reader, as every ready figure on this screen does.
 */
export function WardTelemetryRibbon({ unit, capacity, staffedSpecialling, now }: WardTelemetryRibbonProps) {
  const { bedReleases } = useWardFlow();
  const pendingPreparation = bedsPendingPreparation(unit.id, bedReleases);
  const shiftEnd = dayShiftEndInstant(now);
  const freeingByShiftEnd = bedReleases.filter(
    (release) => release.unitId === unit.id && release.state !== "discharged" && release.expectedAt <= shiftEnd,
  ).length;
  const confirmedByWard = unit.allocatable.source === "ward";

  return (
    <div className={styles.ribbon} role="region" aria-label="Live Capacity Telemetry">
      <span className={styles.srOnly}>{pendingPreparation} being made ready</span>
      <div className={styles.cell} data-testid="ward-hero" aria-labelledby="ward-hero-title">
        <HeroStat
          value={<span data-testid="ward-hero-ready">{capacity.available}</span>}
          label={<span id="ward-hero-title">Ready now</span>}
          tone="success"
        />
      </div>
      <HeroStat value={capacity.occupied} label="Occupied" />
      <HeroStat value={staffedSpecialling} label="1:1 specialling" />
      <HeroStat
        value={capacity.available + freeingByShiftEnd}
        label={`Ready by ${formatInstantWithDay(shiftEnd, now)}`}
      />
      <HeroStat
        value={durMinutes(Math.max(0, now - unit.allocatable.confirmedAt))}
        label={confirmedByWard ? "since confirmed" : "since last figure"}
      />
    </div>
  );
}
