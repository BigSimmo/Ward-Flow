"use client";

import { HeroStat, durMinutes } from "@/components/wf";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { dayShiftEndInstant, releasesDueByShiftEnd } from "@/components/ward-management/ward-board-time-features";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";

import styles from "./ward-telemetry-ribbon.module.css";

/** The bed board filters a hero pill can switch on. */
export type WardBedFilter = "all" | "look" | "leaving" | "free" | "occupied" | "shift-end";

interface WardTelemetryRibbonProps {
  unit: Unit;
  capacity: {
    available: number;
    occupied: number;
  };
  staffedSpecialling: number;
  now: Instant;
  /** The bed board's current filter, so the matching pill shows pressed. */
  filter?: WardBedFilter;
  /** Switches the bed board's filter. Without it the figures are plain counts. */
  onFilter?: (filter: WardBedFilter) => void;
  /** Items in This shift's Act now column. Shown only with `onActNow`. */
  actNow?: number;
  /** Opens This shift's to do list. */
  onActNow?: () => void;
}

/**
 * The ward's counts on the hero band (Ward Hub, 9 Oct 2026). Each figure is a pill that filters
 * the bed board below: Ready now, Occupied and Ready by the end of the day shift, then Act now,
 * which opens the shift's to do list. Every value is derived from the record; the ready-bed figure
 * carries how many of those beds are still being made ready, for a screen reader, as every ready
 * figure on this screen does. Specialling sits on each bed, and the figure's age in the foot line.
 */
export function WardTelemetryRibbon({
  unit,
  capacity,
  staffedSpecialling,
  now,
  filter = "all",
  onFilter,
  actNow = 0,
  onActNow,
}: WardTelemetryRibbonProps) {
  const { bedReleases } = useWardFlow();
  const pendingPreparation = bedsPendingPreparation(unit.id, bedReleases);
  const shiftEnd = dayShiftEndInstant(now);
  const freeingByShiftEnd = releasesDueByShiftEnd(bedReleases, unit.id, now).length;
  const confirmedByWard = unit.allocatable.source === "ward";

  if (onFilter) {
    const pick = (next: WardBedFilter) => {
      onFilter(filter === next && next !== "all" ? "all" : next);
    };
    return (
      <div className={styles.pills} role="region" aria-label="Live Capacity Telemetry">
        <span className={styles.srOnly}>{pendingPreparation} being made ready</span>
        <div className={styles.cell} data-testid="ward-hero" aria-labelledby="ward-hero-title">
          <HeroStat
            inline
            value={<span data-testid="ward-hero-ready">{capacity.available}</span>}
            label={<span id="ward-hero-title">Ready now</span>}
            tone="success"
            pressed={filter === "free"}
            onToggle={() => {
              pick("free");
            }}
          />
        </div>
        <HeroStat
          inline
          value={capacity.occupied}
          label="Occupied"
          pressed={filter === "occupied"}
          onToggle={() => {
            pick("occupied");
          }}
        />
        <HeroStat
          inline
          value={capacity.available + freeingByShiftEnd}
          label={`Ready by ${formatInstantWithDay(shiftEnd, now)}`}
          pressed={filter === "shift-end"}
          onToggle={() => {
            pick("shift-end");
          }}
        />
        {onActNow ? (
          <HeroStat
            inline
            value={actNow}
            label="Act now"
            tone={actNow > 0 ? "danger" : "success"}
            command
            onToggle={onActNow}
          />
        ) : null}
        <span className={styles.srOnly}>
          {staffedSpecialling} on 1:1 specialling. {durMinutes(Math.max(0, now - unit.allocatable.confirmedAt))}{" "}
          {confirmedByWard ? "since confirmed" : "since last figure"}.
        </span>
      </div>
    );
  }

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
