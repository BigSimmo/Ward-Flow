"use client";

import React, { useState } from "react";
import styles from "./ward-beds-matrix.module.css";
import type { Unit } from "@/components/ward-management/ward-model";

export interface BedItem {
  bedNumber: number | string;
  bedLabel: string;
  status: unknown;
  statusText: string;
  patientAlias?: string;
  umrn?: string;
  daysInBed?: number | string | null;
  podId?: string;
  isHdu?: boolean;
  isSpecialling?: boolean;
  [key: string]: unknown;
}

interface WardBedsMatrixProps {
  unit: Unit;
  bedsList: BedItem[];
  selectedBed: number | null;
  setSelectedBed: (bed: number | null) => void;
  selectedPod: string;
  setSelectedPod: (pod: string) => void;
  isMixed: boolean;
}

export function WardBedsMatrix({
  unit,
  bedsList,
  selectedBed,
  setSelectedBed,
  selectedPod,
  setSelectedPod,
  isMixed,
}: WardBedsMatrixProps) {
  const filteredBeds = selectedPod === "all" ? bedsList : bedsList.filter((bed) => bed.podId === selectedPod);

  const handleBedClick = (bed: BedItem) => {
    setSelectedBed(typeof bed.bedNumber === "number" ? bed.bedNumber : Number(bed.bedNumber) || null);
  };

  // Group beds into Bays (4 beds per bay)
  const bays: Array<{ title: string; beds: BedItem[] }> = [];
  for (let i = 0; i < filteredBeds.length; i += 4) {
    const bayNum = Math.floor(i / 4) + 1;
    const slice = filteredBeds.slice(i, i + 4);
    let title = `Bay ${bayNum} — Acute Inpatient (Beds ${slice[0]?.bedLabel ?? ""} – ${slice[slice.length - 1]?.bedLabel ?? ""})`;
    if (bayNum === 1)
      title = `Bay 1 — Male Acute (Beds ${slice[0]?.bedLabel ?? "01"} – ${slice[slice.length - 1]?.bedLabel ?? "04"})`;
    if (bayNum === 2)
      title = `Bay 2 — Female Acute (Beds ${slice[0]?.bedLabel ?? "05"} – ${slice[slice.length - 1]?.bedLabel ?? "08"})`;
    if (bayNum >= 3 && slice.some((b) => b.isHdu)) {
      title = `HDU High Acuity & Seclusion Suites (Beds ${slice[0]?.bedLabel ?? "13"} – ${slice[slice.length - 1]?.bedLabel ?? "16"})`;
    }
    bays.push({ title, beds: slice });
  }

  const readyCount = bedsList.filter((b) => b.status === "ready").length;
  const occupiedCount = bedsList.filter((b) => b.patientAlias).length;
  const leaveCount = bedsList.filter((b) => b.status === "leave").length;

  return (
    <div className={styles.matrixWrap}>
      {/* Header */}
      <div className={styles.matrixHead}>
        <div className={styles.headingGroup}>
          <h2 className={styles.title}>Interactive Bed Matrix &amp; Bay Roster</h2>
          <p className={styles.subtitle}>
            {unit.beds} Acute Inpatient Beds partitioned into clinical bays with telemetry, patient LOS, and active
            restrictions.
          </p>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <span
            className={styles.podFilterBtn}
            style={{ background: "var(--good-soft, rgba(34, 117, 80, 0.12))", color: "var(--good)" }}
          >
            {readyCount} Ready
          </span>
          <span className={styles.podFilterBtn}>{occupiedCount} Occupied</span>
          <span
            className={styles.podFilterBtn}
            style={{ background: "var(--warn-soft, rgba(130, 93, 16, 0.12))", color: "var(--warn)" }}
          >
            {leaveCount} On Leave
          </span>
        </div>
      </div>

      {/* Pod / Designation Filter Controls */}
      <div className={styles.matrixControls}>
        <div className={styles.podFilters} role="group" aria-label="Filter by designation">
          <button
            type="button"
            className={styles.podFilterBtn}
            aria-pressed={selectedPod === "all"}
            onClick={() => setSelectedPod("all")}
          >
            All beds ({unit.beds})
          </button>
          {isMixed ? (
            <>
              <button
                type="button"
                className={styles.podFilterBtn}
                aria-pressed={selectedPod === "locked"}
                onClick={() => setSelectedPod("locked")}
              >
                Locked ({bedsList.filter((b) => b.podId === "locked").length})
              </button>
              <button
                type="button"
                className={styles.podFilterBtn}
                aria-pressed={selectedPod === "open"}
                onClick={() => setSelectedPod("open")}
              >
                Open ({bedsList.filter((b) => b.podId === "open").length})
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Preserved test contract position caption */}
      <p className={styles.positionCaption} data-testid="ward-beds-position-caption">
        Bed numbers show position on this board; no bed number is recorded for anyone.
      </p>

      {/* Bays Container */}
      {bays.map((bay, idx) => (
        <div key={idx} className={styles.bayContainer}>
          <div className={styles.bayHeader}>
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="2" width="12" height="12" rx="2" />
            </svg>
            <span>{bay.title}</span>
          </div>
          <div className={styles.bayBedsGrid}>
            {bay.beds.map((bed) => (
              <button
                type="button"
                key={bed.bedNumber}
                className={styles.bedCard}
                data-state={bed.status}
                onClick={() => handleBedClick(bed)}
                aria-label={`${bed.bedLabel} ${bed.statusText} ${bed.patientAlias ?? ""}`.trim()}
              >
                <div className={styles.bedCardHead}>
                  <span className={styles.bedCardNumber}>{bed.bedLabel}</span>
                  <span className={styles.bedCardChip}>{bed.statusText}</span>
                </div>
                {bed.patientAlias ? (
                  <div>
                    <div className={styles.bedPatientName}>{bed.patientAlias}</div>
                    <div className={styles.bedPatientSub}>
                      {bed.umrn ? <span>{bed.umrn} &middot; </span> : null}
                      {bed.daysInBed ? <span>LOS {bed.daysInBed}d</span> : <span>Inpatient</span>}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div
                      className={styles.bedPatientName}
                      style={{ color: bed.status === "ready" ? "var(--good)" : "var(--muted)" }}
                    >
                      {bed.status === "ready" ? "Ready for Allocation" : bed.statusText}
                    </div>
                    <div className={styles.bedPatientSub}>
                      {bed.status === "ready" ? "Terminal Sanitize Complete" : "Unoccupied"}
                    </div>
                  </div>
                )}
                <div className={styles.bedCardFoot}>
                  <span>{bed.isHdu ? "HDU Suite" : bed.isSpecialling ? "1:1 Watch" : "Standard Bay"}</span>
                  <span style={{ fontWeight: 600, color: bed.status === "ready" ? "var(--good)" : "var(--ink-soft)" }}>
                    {bed.status === "ready" ? "Assign →" : "Inspect →"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
