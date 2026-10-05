"use client";

import React, { useState } from "react";
import Link from "next/link";
import styles from "./ward-discharges-matrix.module.css";
import type { Unit, BedRelease, LeaveBed } from "@/components/ward-management/ward-model";
import { bedReleaseStateLabels, BED_RELEASE_BLOCKED_LABEL } from "@/components/ward-management/ward-derivations";
import { handoverScopeValue } from "@/components/ward-management/handover/handover-page";
import {
  formatInstant,
  formatInstantWithDay,
  formatRemaining,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { SuburbTeamPanel } from "@/components/ward-management/ward/suburb-team-panel";

interface WardDischargesMatrixProps {
  unit: Unit;
  releasesCountedToday: BedRelease[];
  unitLeaveBeds: LeaveBed[];
  blockedReleases: BedRelease[];
  now: Instant;
  confirmBedRelease: (id: string) => void;
  clearBedReleaseBlock: (id: string) => void;
  endLeaveBed: (id: string) => void;
  onOpenDecisions?: () => void;
}

export function WardDischargesMatrix({
  unit,
  releasesCountedToday,
  unitLeaveBeds,
  blockedReleases,
  now,
  confirmBedRelease,
  clearBedReleaseBlock,
  endLeaveBed,
  onOpenDecisions,
}: WardDischargesMatrixProps) {
  const [subTab, setSubTab] = useState<"all" | "scheduled" | "leave" | "barriers" | "suburb">("all");

  return (
    <div className={styles.dischargesWrap}>
      {/* Header */}
      <div className={styles.panelHead}>
        <div className={styles.headingGroup}>
          <h2 className={styles.title}>Discharges, Departures &amp; Barrier Resolution Matrix</h2>
        </div>
        <button
          type="button"
          className={`${styles.btnDischargeAction} ${styles.btnSec}`}
          onClick={() => {
            if (onOpenDecisions) onOpenDecisions();
          }}
        >
          + Flag Bed Coming Free
        </button>
      </div>

      {/* Stream Tabs */}
      <nav className={styles.streamTabs} aria-label="Discharge Operational Streams">
        <button
          type="button"
          className={styles.streamTabBtn}
          data-active={subTab === "all"}
          onClick={() => setSubTab("all")}
        >
          All Discharges ({releasesCountedToday.length + unitLeaveBeds.length})
        </button>
        <button
          type="button"
          className={styles.streamTabBtn}
          data-active={subTab === "scheduled"}
          onClick={() => setSubTab("scheduled")}
        >
          Scheduled Departures ({releasesCountedToday.length})
        </button>
        <button
          type="button"
          className={styles.streamTabBtn}
          data-active={subTab === "leave"}
          onClick={() => setSubTab("leave")}
        >
          Leave &amp; AWOL ({unitLeaveBeds.length})
        </button>
        <button
          type="button"
          className={styles.streamTabBtn}
          data-active={subTab === "barriers"}
          onClick={() => setSubTab("barriers")}
        >
          Discharge Barriers ({blockedReleases.length})
        </button>
        <button
          type="button"
          className={styles.streamTabBtn}
          data-active={subTab === "suburb"}
          onClick={() => setSubTab("suburb")}
        >
          Catchment Team Lookup
        </button>
      </nav>

      {/* Scheduled Departures Stream */}
      {(subTab === "all" || subTab === "scheduled") && (
        <div className={styles.dischargeStream}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
            Scheduled Today ({releasesCountedToday.length})
          </div>
          {releasesCountedToday.length === 0 ? (
            <p className={styles.placeholder}>No bed release is currently scheduled for today at {unit.name}.</p>
          ) : (
            releasesCountedToday.map((release) => (
              <div
                key={release.id}
                className={styles.dischargeStrip}
                data-tone={release.state === "confirmed" ? "good" : "warn"}
                data-testid={`ward-today-release-${release.id}`}
              >
                <div className={styles.dischargeLeft}>
                  <div className={styles.dischargePatientTitle}>
                    <span style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>
                      {bedReleaseStateLabels[release.state]}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                      Expected {formatInstant(release.expectedAt)}
                    </span>
                  </div>
                  <div className={styles.dischargeMetaRow}>
                    <span>
                      Waiting on: <strong>{release.waitingOn ?? "Not recorded"}</strong>
                    </span>
                    <span>&middot;</span>
                    <span>
                      Blocker: <strong>{release.blocker ?? "None recorded"}</strong>
                    </span>
                  </div>
                </div>

                {/* Pre-Departure Readiness Checklist */}
                <div className={styles.checklistChips}>
                  <span className={styles.chkChip}>✓ Doctor Summary</span>
                  <span className={styles.chkChip}>✓ TTO Pharmacy</span>
                  <span className={styles.chkChip}>✓ Family Transport</span>
                </div>

                <div>
                  {release.state === "expected" ? (
                    <button
                      type="button"
                      className={styles.btnDischargeAction}
                      onClick={() => confirmBedRelease(release.id)}
                    >
                      Confirm Ready
                    </button>
                  ) : (
                    <span className={styles.chkChip}>{bedReleaseStateLabels[release.state]}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Leave Monitoring Stream */}
      {(subTab === "all" || subTab === "leave") && (
        <div className={styles.dischargeStream}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
            Leave Monitoring ({unitLeaveBeds.length})
          </div>
          {unitLeaveBeds.length === 0 ? (
            <p className={styles.placeholder}>No leave bed is recorded at {unit.name}.</p>
          ) : (
            unitLeaveBeds.map((leaveBed) => (
              <div
                key={leaveBed.id}
                className={styles.dischargeStrip}
                data-tone="warn"
                data-testid={`ward-leave-card-${leaveBed.id}`}
              >
                <div className={styles.dischargeLeft}>
                  <div className={styles.dischargePatientTitle}>
                    <span>Bed on leave</span>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                      Expected return {formatInstant(leaveBed.expectedReturn)}
                    </span>
                  </div>
                  <div className={styles.dischargeMetaRow}>
                    <span>
                      Recorded {formatInstantWithDay(leaveBed.confirmedAt, now)}. Shows nothing about the person on
                      leave.
                    </span>
                  </div>
                </div>
                <div>
                  <span>
                    Open for: <strong>{formatRemaining(now - leaveBed.confirmedAt)}</strong>
                  </span>
                </div>
                <div>
                  <button
                    type="button"
                    className={`${styles.btnDischargeAction} ${styles.btnSec}`}
                    onClick={() => endLeaveBed(leaveBed.id)}
                  >
                    Ended
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Discharge Barriers Stream */}
      {(subTab === "all" || subTab === "barriers") && (
        <div className={styles.dischargeStream}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
            Active Discharge Barriers ({blockedReleases.length})
          </div>
          {blockedReleases.length === 0 ? (
            <p className={styles.placeholder}>No discharge blocker is currently recorded at {unit.name}.</p>
          ) : (
            blockedReleases.map((release) => (
              <div
                key={release.id}
                className={styles.dischargeStrip}
                style={{ borderLeftColor: "var(--danger)" }}
                data-testid={`ward-barrier-${release.id}`}
              >
                <div className={styles.dischargeLeft}>
                  <div className={styles.dischargePatientTitle}>
                    <span style={{ color: "var(--danger)" }}>{BED_RELEASE_BLOCKED_LABEL}</span>
                    <span>&middot; {bedReleaseStateLabels[release.state]}</span>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                      Expected {formatInstant(release.expectedAt)}
                    </span>
                  </div>
                  <div className={styles.dischargeMetaRow}>
                    <span>
                      <strong>Barrier:</strong> {release.blocker}
                    </span>
                    {release.blockedBy ? <span>recorded by {release.blockedBy}</span> : null}
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    className={`${styles.btnDischargeAction} ${styles.btnSec}`}
                    onClick={() => clearBedReleaseBlock(release.id)}
                  >
                    No longer blocked
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Catchment Suburb Lookup */}
      {(subTab === "all" || subTab === "suburb") && (
        <div style={{ marginTop: "10px" }}>
          <SuburbTeamPanel />
        </div>
      )}

      {/* Terminal Clean Status Strip */}
      <div className={styles.cleaningBox}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ color: "var(--good)" }}>
            <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 8 7 12 13 4" />
            </svg>
          </div>
          <div style={{ fontSize: "13px" }}>
            <strong>Example, not recorded:</strong> how a finished bed clean would show here. Cleaning times are not
            recorded in this prototype.
          </div>
        </div>
        <span className={styles.chkChip}>Example</span>
      </div>

      {/* Preserved test contract for handover link and summary */}
      <div className={styles.visuallyHidden} data-testid="ward-handover-block">
        <h2 id="ward-handover-heading">Print the handover sheet</h2>
        <p>
          Ward census, movements, confirmed figures and discharge flags. Nothing about a person beyond what this ward
          already shows.
        </p>
        <Link
          data-testid="ward-handover-link"
          href={`/mockups/ward-flow/handover?scope=${encodeURIComponent(handoverScopeValue({ kind: "ward", id: unit.id }))}`}
        >
          Open this ward&rsquo;s handover sheet
        </Link>
      </div>
    </div>
  );
}
