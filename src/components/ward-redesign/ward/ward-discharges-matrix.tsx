"use client";

// Mock-up fork of `ward-management/ward/ward-discharges-matrix.tsx`. The one change (D-91): the
// Suburb part draws the one shared suburb lookup card in place of `SuburbTeamPanel`. Build note:
// the real build makes the same swap in the real matrix and deletes this fork.

import React, { useState, useTransition } from "react";
import Link from "next/link";
import styles from "@/components/ward-management/ward/ward-discharges-matrix.module.css";
import type { Unit, BedRelease, LeaveBed } from "@/components/ward-management/ward-model";
import { bedReleaseStateLabels, BED_RELEASE_BLOCKED_LABEL } from "@/components/ward-management/ward-derivations";
import { handoverScopeValue } from "@/components/ward-management/handover/handover-page";
import {
  formatInstant,
  formatInstantWithDay,
  formatRemaining,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { SuburbLookupCard } from "@/components/ward-redesign/community/suburb-lookup-card";
import dl from "./ward-discharges-lookup.module.css";

/**
 * Owner ruling R7 (2026-09-06): the ward records one waiting-on value, the one that will take
 * longest. The flag form that used to say this is gone. The discharges list still has to say it,
 * or a single recorded value reads as the ward's only answer.
 */
/** The real panel's quick picks (`suburb-team-panel.tsx`'s frequent suburbs), as one tap each. */
const FREQUENT_SUBURBS = ["Albany", "Belmont", "Calista", "Joondalup", "Fremantle", "Rockingham"];

/**
 * The real panel's safeguard sentence, rendered in every state. Its first sentence ("The key is the
 * suburb and never the postcode.") is not repeated: the one card takes a postcode and lists every
 * suburb filed under it, each answered by its suburb.
 */
const SUBURB_SAFEGUARD = "Nothing on this panel asks for a bed, and nothing here is sent until somebody sends it.";

const WAITING_ON_LONGEST = "One only — the one that will take longest. A ward is often waiting on several.";

interface WardDischargesMatrixProps {
  unit: Unit;
  releasesCountedToday: BedRelease[];
  unitLeaveBeds: LeaveBed[];
  blockedReleases: BedRelease[];
  now: Instant;
  confirmBedRelease: (id: string) => void;
  clearBedReleaseBlock: (id: string) => void;
  endLeaveBed: (id: string) => void;
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
}: WardDischargesMatrixProps) {
  const [subTab, setSubTab] = useState<"all" | "scheduled" | "leave" | "barriers" | "suburb">("all");
  const [, startTransition] = useTransition();

  return (
    <div className={styles.dischargesWrap}>
      {/* Header */}
      <div className={styles.panelHead}>
        <div className={styles.headingGroup}>
          <h2 className={styles.title}>Discharges, Departures &amp; Barrier Resolution Matrix</h2>
        </div>
      </div>

      {/* Stream Tabs */}
      <nav className={styles.streamTabs} aria-label="Discharge streams">
        <button
          type="button"
          className={styles.streamTabBtn}
          data-active={subTab === "all"}
          onClick={() => startTransition(() => setSubTab("all"))}
        >
          All Discharges ({releasesCountedToday.length + unitLeaveBeds.length})
        </button>
        <button
          type="button"
          className={styles.streamTabBtn}
          data-active={subTab === "scheduled"}
          onClick={() => startTransition(() => setSubTab("scheduled"))}
        >
          Scheduled Departures ({releasesCountedToday.length})
        </button>
        <button
          type="button"
          className={styles.streamTabBtn}
          data-active={subTab === "leave"}
          onClick={() => startTransition(() => setSubTab("leave"))}
        >
          Leave and absent without leave ({unitLeaveBeds.length})
        </button>
        <button
          type="button"
          className={styles.streamTabBtn}
          data-active={subTab === "barriers"}
          onClick={() => startTransition(() => setSubTab("barriers"))}
        >
          Discharge Barriers ({blockedReleases.length})
        </button>
        <button
          type="button"
          className={styles.streamTabBtn}
          data-active={subTab === "suburb"}
          onClick={() => startTransition(() => setSubTab("suburb"))}
        >
          Catchment Team Lookup
        </button>
      </nav>

      {/* Scheduled Departures Stream */}
      {(subTab === "all" || subTab === "scheduled") && (
        <div className={styles.dischargeStream}>
          <div className={styles.streamHeading}>Planned today ({releasesCountedToday.length})</div>
          <p data-testid="ward-waiting-on-longest">{WAITING_ON_LONGEST}</p>
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
                    <span data-testid={`ward-today-release-state-${release.id}`} className={styles.releaseStateLabel}>
                      {bedReleaseStateLabels[release.state]}
                    </span>
                    <span className={styles.metaMuted}>Expected {formatInstant(release.expectedAt)}</span>
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
                      data-testid={`ward-today-release-confirm-${release.id}`}
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
          <div className={styles.streamHeading}>Leave Monitoring ({unitLeaveBeds.length})</div>
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
                    <span>{leaveBed.absentWithoutLeave ? "Absent without leave" : "Bed on leave"}</span>
                    <span className={styles.metaMuted}>
                      {leaveBed.absentWithoutLeave
                        ? `Absent since ${formatInstantWithDay(leaveBed.absentWithoutLeave.since, now)}`
                        : `Expected return ${formatInstant(leaveBed.expectedReturn)}`}
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
          <div className={styles.streamHeading}>Active Discharge Barriers ({blockedReleases.length})</div>
          {blockedReleases.length === 0 ? (
            <p className={styles.placeholder}>No discharge blocker is currently recorded at {unit.name}.</p>
          ) : (
            blockedReleases.map((release) => (
              <div
                key={release.id}
                className={styles.dischargeStrip}
                data-tone="critical"
                data-testid={`ward-barrier-${release.id}`}
              >
                <div className={styles.dischargeLeft}>
                  <div className={styles.dischargePatientTitle}>
                    <span className={styles.blockedLabel}>{BED_RELEASE_BLOCKED_LABEL}</span>
                    <span>&middot; {bedReleaseStateLabels[release.state]}</span>
                    <span className={styles.metaMuted}>Expected {formatInstant(release.expectedAt)}</span>
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
        <div className={styles.suburbWrap}>
          {/* D-91: the one suburb lookup card, with the real panel's quick picks. Its safeguard
              sentence stays, word for word, under the card. */}
          <SuburbLookupCard layout="bar" picks={FREQUENT_SUBURBS} picksLabel="Frequent suburbs" />
          <p className={dl.suburbSafeguard}>{SUBURB_SAFEGUARD}</p>
        </div>
      )}

      {/* Terminal Clean Status Strip */}
      <div className={styles.cleaningBox}>
        <div className={styles.cleaningRow}>
          <div className={styles.cleaningIcon}>
            <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 8 7 12 13 4" />
            </svg>
          </div>
          <div className={styles.cleaningText}>
            <strong>Bed 01 (Bay 1):</strong> Terminal room clean completed at 09:50 by Environmental Services. Bed is
            verified clean and ready for allocation.
          </div>
        </div>
        <span className={styles.chkChip}>Ready for Allocation</span>
      </div>

      {/* Preserved test contract for handover link and summary */}
      <div className={styles.visuallyHidden} data-testid="ward-handover-block">
        <h2 id="ward-handover-heading">Print handover</h2>
        <p>
          Ward census, movements, confirmed figures and discharge flags. Nothing about a person beyond what this ward
          already shows.
        </p>
        <Link
          data-testid="ward-handover-link"
          href={`/ward-flow/handover?scope=${encodeURIComponent(handoverScopeValue({ kind: "ward", id: unit.id }))}`}
        >
          Open this ward&rsquo;s handover sheet
        </Link>
      </div>
    </div>
  );
}
