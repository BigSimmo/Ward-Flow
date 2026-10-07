"use client";

import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import React from "react";
import Link from "next/link";
import styles from "./ward-telemetry-ribbon.module.css";
import type { Unit } from "@/components/ward-management/ward-model";
import { wardIntakeConstraintLabels } from "@/components/ward-management/ward-change-reasons";

interface WardTelemetryRibbonProps {
  unit: Unit;
  capacity: {
    available: number;
    occupied: number;
  };
  staffedSpecialling: number;
  acceptedCount: number;
  onOpenBedList?: () => void;
}

export function WardTelemetryRibbon({
  unit,
  capacity,
  staffedSpecialling,
  acceptedCount,
  onOpenBedList,
}: WardTelemetryRibbonProps) {
  const { bedReleases } = useWardFlow();
  const pendingPreparation = bedsPendingPreparation(unit.id, bedReleases);
  const occPercent = unit.beds > 0 ? Math.round((capacity.occupied / unit.beds) * 100) : 0;
  const constraints = unit.intakeConstraints ?? [];

  return (
    <div className={styles.ribbon} role="region" aria-label="Live Capacity Telemetry">
      <span className="sr-only">{pendingPreparation} being made ready</span>
      <div className={styles.cell} data-state="accent">
        <span className={styles.label}>Staffed beds</span>
        <span className={styles.mainVal}>{unit.beds}</span>
        <span className={styles.subRow}>Roster not recorded</span>
      </div>
      <div className={styles.cell} data-state={occPercent >= 90 ? "warn" : "accent"}>
        <span className={styles.label}>Occupancy</span>
        <span className={styles.mainVal}>
          {capacity.occupied}
          <span className={styles.unit}>/{unit.beds}</span>
        </span>
        <span className={styles.subRow}>
          {occPercent}% full · {acceptedCount} inbound
        </span>
      </div>
      <div className={styles.cell} data-state="good" data-testid="ward-hero" aria-labelledby="ward-hero-title">
        <span className={styles.label} id="ward-hero-title">
          Ready now
        </span>
        <span className={styles.mainVal} data-tone="good">
          <span data-testid="ward-hero-ready">{capacity.available}</span>
        </span>
        <Link
          className={styles.actionLink}
          href="#bed-capacity"
          data-testid="ward-hero-open-bed-list"
          onClick={(event) => {
            if (onOpenBedList) {
              event.preventDefault();
              onOpenBedList();
            }
          }}
        >
          Open bed list · {unit.beds} beds · {capacity.available} ready →
        </Link>
      </div>
      <div className={styles.cell} data-state={staffedSpecialling > 0 ? "warn" : undefined}>
        <span className={styles.label}>1:1 specialling</span>
        <span className={styles.mainVal} data-tone={staffedSpecialling > 0 ? "warn" : undefined}>
          {staffedSpecialling}
        </span>
        <span className={styles.subRow}>
          {constraints.length > 0
            ? constraints.map((constraint) => wardIntakeConstraintLabels[constraint] ?? constraint).join(", ")
            : staffedSpecialling > 0
              ? "Active watch"
              : "None recorded"}
        </span>
      </div>
      <div className={styles.cell} data-state={unit.lockedBeds > 0 ? "danger" : undefined}>
        <span className={styles.label}>Boundary</span>
        <span className={styles.mainVal} data-tone={unit.lockedBeds > 0 ? "danger" : undefined}>
          {unit.lockedBeds > 0 ? "Secure" : "Open"}
        </span>
        <span className={styles.subRow}>
          {unit.lockedBeds > 0 ? "Secure boundary · seclusion ready" : "Standard security boundary"}
        </span>
      </div>
    </div>
  );
}
