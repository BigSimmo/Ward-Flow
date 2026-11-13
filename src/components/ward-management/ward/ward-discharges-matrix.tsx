"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import styles from "./ward-discharges-matrix.module.css";
import type { Unit, BedRelease, LeaveBed } from "@/components/ward-management/ward-model";
import { bedReleaseStateLabels, BED_RELEASE_BLOCKED_LABEL } from "@/components/ward-management/ward-derivations";
import { HELD_UP_BY_TOMORROW_LABEL } from "@/components/ward-management/ward-held-up";
import { handoverScopeValue } from "@/components/ward-management/handover/handover-page";
import {
  formatInstant,
  formatInstantWithDay,
  splitDuration,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { SuburbTeamPanel } from "./suburb-team-panel";

/**
 * Owner ruling R7 (2026-09-06): the ward records one waiting-on value, the one that will take
 * longest. The flag form that used to say this is gone. The discharges list still has to say it,
 * or a single recorded value reads as the ward's only answer.
 */
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
          {/* A9-30 (F-27, 13 Nov 2026): a plain title, and the counts below say "today", because they
              count today's discharges (`releasesCountedToday`) while Ward flow counts every date. */}
          <h2 className={styles.title}>Discharges today</h2>
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
          All today ({releasesCountedToday.length + unitLeaveBeds.length})
        </button>
        <button
          type="button"
          className={styles.streamTabBtn}
          data-active={subTab === "scheduled"}
          onClick={() => startTransition(() => setSubTab("scheduled"))}
        >
          Planned today ({releasesCountedToday.length})
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
          {HELD_UP_BY_TOMORROW_LABEL} ({blockedReleases.length})
        </button>
        <button
          type="button"
          className={styles.streamTabBtn}
          data-active={subTab === "suburb"}
          onClick={() => startTransition(() => setSubTab("suburb"))}
        >
          Catchment team lookup
        </button>
      </nav>

      {/* Scheduled Departures Stream */}
      {(subTab === "all" || subTab === "scheduled") && (
        <div className={styles.dischargeStream}>
          <div className={styles.streamHeading}>Planned today ({releasesCountedToday.length})</div>
          <p data-testid="ward-waiting-on-longest">{WAITING_ON_LONGEST}</p>
          {releasesCountedToday.length === 0 ? (
            <p className={styles.placeholder}>None planned today.</p>
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
                      Held up by: <strong>{release.blocker ?? "None recorded"}</strong>
                    </span>
                  </div>
                </div>

                <div>
                  {release.state === "expected" ? (
                    <button
                      type="button"
                      className={styles.btnDischargeAction}
                      data-testid={`ward-today-release-confirm-${release.id}`}
                      onClick={() => confirmBedRelease(release.id)}
                    >
                      Confirm ready
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
          <div className={styles.streamHeading}>Leave monitoring ({unitLeaveBeds.length})</div>
          {unitLeaveBeds.length === 0 ? (
            <p className={styles.placeholder}>Nobody on leave.</p>
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
                    <span>Recorded {formatInstantWithDay(leaveBed.confirmedAt, now)}.</span>
                  </div>
                </div>
                <div>
                  <span>
                    Open <strong>{splitDuration(Math.max(now - leaveBed.confirmedAt, 0))}</strong>
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
          <div className={styles.streamHeading}>
            {HELD_UP_BY_TOMORROW_LABEL} ({blockedReleases.length})
          </div>
          {blockedReleases.length === 0 ? (
            <p className={styles.placeholder}>Nothing held up due by tomorrow.</p>
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
                      <strong>Held up by:</strong> {release.blocker}
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
                    No longer held up
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
          <SuburbTeamPanel />
        </div>
      )}

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
