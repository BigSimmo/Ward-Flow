"use client";

import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import React from "react";
import Link from "next/link";
import styles from "./ward-telemetry-ribbon.module.css";
import type { Unit } from "@/components/ward-management/ward-model";
import type { BedStateCounts } from "@/components/ward-management/ward-bed-states";
import { wardIntakeConstraintLabels } from "@/components/ward-management/ward-change-reasons";

interface WardTelemetryRibbonProps {
  unit: Unit;
  capacity: {
    available: number;
    occupied: number;
  };
  /** Polish: one source for the bed figures (bedStates). */
  states: BedStateCounts;
  staffedSpecialling: number;
  acceptedCount: number;
  onOpenBedList?: () => void;
}

export function WardTelemetryRibbon({
  unit,
  capacity,
  states,
  staffedSpecialling,
  acceptedCount,
  onOpenBedList,
}: WardTelemetryRibbonProps) {
  const { bedReleases } = useWardFlow();
  const pendingPreparation = bedsPendingPreparation(unit.id, bedReleases);
  // Polish: occupied beds (people on leave included) over all beds; a pulled bed is not occupied.
  const occPercent = unit.beds > 0 ? Math.round((states.occupied / unit.beds) * 100) : 0;
  const constraints = unit.intakeConstraints ?? [];

  return (
    <div className={styles.ribbon} role="region" aria-label="Live Capacity Telemetry">
      <span className="sr-only">{pendingPreparation} being made ready</span>
      {/* 1. Staffed Beds */}
      <div className={styles.cell} data-state="accent">
        <div className={styles.topRow}>
          <span className={styles.label}>Staffed Beds</span>
          <span className={styles.badge}>Budgeted</span>
        </div>
        <div className={styles.valueRow}>
          <span className={styles.mainVal}>{unit.beds}</span>
          <span className={styles.unit}>Beds</span>
        </div>
        <div className={styles.subRow}>
          <span>Roster not recorded</span>
        </div>
      </div>

      {/* 2. Occupancy */}
      <div className={styles.cell} data-state={occPercent >= 90 ? "warn" : "accent"}>
        <div className={styles.topRow}>
          <span className={styles.label}>Occupancy</span>
          <span className={styles.badge} data-tone={occPercent >= 90 ? "warn" : "accent"}>
            {occPercent}% Full
          </span>
        </div>
        <div className={styles.valueRow}>
          <span className={styles.mainVal}>{states.occupied}</span>
          <span className={styles.unit}>/ {unit.beds} beds occupied</span>
        </div>
        <div className={styles.subRow}>
          <span>
            {states.occupied - states.onLeave} in bed &middot; {states.onLeave} on leave &middot; {states.pulled} pulled
            &middot; {acceptedCount} coming in
          </span>
        </div>
      </div>

      {/* 3. Ready Bed Now (Preserves all ward-hero test IDs) */}
      <div className={styles.cell} data-state="good" data-testid="ward-hero" aria-labelledby="ward-hero-title">
        <div className={styles.topRow}>
          <span className={styles.label} id="ward-hero-title">
            ready bed{capacity.available === 1 ? "" : "s"} on this ward right now
          </span>
          <span className={styles.badge} data-tone="good">
            Recorded ready count
          </span>
        </div>
        <div className={styles.valueRow}>
          <span className={styles.mainVal} style={{ color: "var(--good)" }}>
            <span data-testid="ward-hero-ready">{capacity.available}</span>
          </span>
          <span className={styles.unit}>Ready Vacant</span>
        </div>
        <div className={styles.subRow}>
          <Link
            className={styles.actionLink}
            href="#bed-capacity"
            data-testid="ward-hero-open-bed-list"
            onClick={(e) => {
              if (onOpenBedList) {
                e.preventDefault();
                onOpenBedList();
              }
            }}
          >
            <span>
              Open bed list &middot; {unit.beds} beds &middot; {capacity.available} ready &rarr;
            </span>
          </Link>
        </div>
      </div>

      {/* 4. 1:1 Specialling */}
      <div className={styles.cell} data-state={staffedSpecialling > 0 ? "warn" : undefined}>
        <div className={styles.topRow}>
          <span className={styles.label}>1:1 Specialling</span>
          <span className={styles.badge} data-tone={staffedSpecialling > 0 ? "warn" : undefined}>
            {staffedSpecialling > 0 ? "Active Watch" : "None recorded"}
          </span>
        </div>
        <div className={styles.valueRow}>
          <span className={styles.mainVal} style={{ color: staffedSpecialling > 0 ? "var(--warn)" : "var(--ink)" }}>
            {staffedSpecialling}
          </span>
          <span className={styles.unit}>Active Watch</span>
        </div>
        <div className={styles.subRow}>
          <span>
            {constraints.length > 0
              ? `Limits: ${constraints.map((c) => wardIntakeConstraintLabels[c] ?? c).join(", ")}`
              : "Staffing envelope allows intake"}
          </span>
        </div>
      </div>

      {/* 5. HDU & Boundary */}
      <div className={styles.cell} data-state={unit.lockedBeds > 0 ? "warn" : undefined}>
        <div className={styles.topRow}>
          <span className={styles.label}>HDU &amp; Boundary</span>
          <span className={styles.badge}>Recorded</span>
        </div>
        <div className={styles.valueRow}>
          <span className={styles.mainVal} style={{ color: "var(--ink)", fontSize: "16px" }}>
            {unit.lockedBeds === unit.beds
              ? "All beds locked"
              : unit.lockedBeds === 0
                ? "All beds open"
                : `${unit.lockedBeds} locked · ${unit.beds - unit.lockedBeds} open`}
          </span>
        </div>
        <div className={styles.subRow}>
          <span>Seclusion and HDU status not recorded in this prototype</span>
        </div>
      </div>
    </div>
  );
}
