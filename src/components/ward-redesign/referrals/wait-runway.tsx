"use client";
// Referrals redesign: WaitRunway copied from src/components/ward-management/referrals/referral-board-parts.tsx
// (30 October 2026). Changed: the chart is headed "Since referral", the queue column's own words,
// and the last tick reads "72h all tiers" instead of "72h any due".

import { useLayoutEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";

import type { Instant } from "@/components/ward-management/ward-clock";
import type { Referral } from "@/components/ward-management/ward-model";
import { referralClocks } from "@/components/ward-management/ward-referrals";
import {
  OVERDUE_AFTER_ANY_TIER_MINUTES,
  OVERDUE_AFTER_MINUTES_BY_TIER,
} from "@/components/ward-management/ward-operational-defaults";
import {
  isOverdue,
  runwayGapPercent,
  runwayLanes,
  runwayMarkerPercent,
} from "@/components/ward-management/referrals/referral-board-parts";
import { cx, durMinutes } from "@/components/wf";
import styles from "@/components/ward-management/referrals/referral-board.module.css";

/** Piecewise axis: each tier's due time takes an equal share, so a 3 day wait and a 20 minute wait
 *  can sit on one line without the short ones collapsing into a dot. */
const RUNWAY_STOPS: readonly (readonly [number, number])[] = [
  [0, 0],
  [OVERDUE_AFTER_MINUTES_BY_TIER[1], 25],
  [OVERDUE_AFTER_MINUTES_BY_TIER[2], 50],
  [OVERDUE_AFTER_MINUTES_BY_TIER[3], 75],
  [OVERDUE_AFTER_ANY_TIER_MINUTES, 100],
];

function runwayPercent(minutes: number): number {
  const m = Math.max(0, minutes);
  for (let index = 1; index < RUNWAY_STOPS.length; index += 1) {
    const [fromMinutes, fromPercent] = RUNWAY_STOPS[index - 1]!;
    const [toMinutes, toPercent] = RUNWAY_STOPS[index]!;
    if (m <= toMinutes)
      return fromPercent + ((m - fromMinutes) / (toMinutes - fromMinutes)) * (toPercent - fromPercent);
  }
  return 100;
}

function hoursLabel(minutes: number): string {
  return `${Math.round(minutes / 60)}h`;
}

export function WaitRunway({
  queued,
  now,
  selectedId,
  isHighlighted,
  nameOf,
  onSelect,
  compact = false,
}: {
  queued: Referral[];
  now: Instant;
  selectedId: string | undefined;
  isHighlighted: (referral: Referral) => boolean;
  nameOf: (referral: Referral) => string;
  onSelect: (referralId: string) => void;
  compact?: boolean;
}) {
  // Markers are kept apart in real pixels, so measure the track rather than assume its width.
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackPx, setTrackPx] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (track === null) return;
    const measure = () => {
      if (track.clientWidth > 0) setTrackPx(track.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => {
      observer.disconnect();
    };
  }, []);
  // Shortest wait first, so the lanes stack upward from the left the way the eye reads them.
  const sorted = [...queued]
    .sort((a, b) => b.raisedAt - a.raisedAt)
    .map((referral) => {
      const minutes = referralClocks(referral, now).sinceReferral;
      return { referral, minutes, x: runwayMarkerPercent(runwayPercent(minutes), trackPx, compact) };
    });
  const laneOf = runwayLanes(
    sorted.map((entry) => entry.x),
    runwayGapPercent(trackPx, compact),
  );
  const placed = sorted.map((entry, index) => ({ ...entry, lane: laneOf[index] ?? 0 }));
  const lanes = Math.max(1, ...placed.map((entry) => entry.lane + 1));
  const ticks = [
    { at: 0, label: "0", tier: "" },
    { at: OVERDUE_AFTER_MINUTES_BY_TIER[1], label: hoursLabel(OVERDUE_AFTER_MINUTES_BY_TIER[1]), tier: "T1" },
    { at: OVERDUE_AFTER_MINUTES_BY_TIER[2], label: hoursLabel(OVERDUE_AFTER_MINUTES_BY_TIER[2]), tier: "T2" },
    { at: OVERDUE_AFTER_MINUTES_BY_TIER[3], label: hoursLabel(OVERDUE_AFTER_MINUTES_BY_TIER[3]), tier: "T3" },
    { at: OVERDUE_AFTER_ANY_TIER_MINUTES, label: hoursLabel(OVERDUE_AFTER_ANY_TIER_MINUTES), tier: "all" },
  ];
  return (
    <div className={cx(styles.runway, compact && styles.runwayCompact)} data-testid="ward-referral-runway">
      <div className={styles.bandHead}>
        <span className={styles.bandEyebrow}>Since referral</span>
        <span className={styles.bandKey}>
          <TriangleAlert size={12} aria-hidden="true" />
          overdue
        </span>
      </div>
      <div
        ref={trackRef}
        className={styles.runwayTrack}
        style={{ height: `calc(${lanes} * 1.625rem + 0.5rem)` }}
        role="group"
        aria-label="Waiting time against each tier's decision window"
      >
        {[0, 25, 50, 75].map((left) => (
          <span key={left} className={styles.runwaySeg} style={{ left: `${left}%` }} aria-hidden="true" />
        ))}
        {placed.map(({ referral, x, lane, minutes }) => {
          const overdue = isOverdue(referral, now);
          const name = nameOf(referral);
          return (
            <button
              key={referral.id}
              type="button"
              className={cx(
                styles.runwayMarker,
                overdue && styles.runwayMarkerOverdue,
                selectedId === referral.id && styles.runwayMarkerOn,
                isHighlighted(referral) && styles.runwayMarkerHl,
              )}
              style={{ left: `${x}%`, bottom: `calc(${lane} * 1.625rem + 0.375rem)` }}
              title={`${name}, tier ${referral.urgency}, waiting ${durMinutes(minutes)}${overdue ? ", overdue" : ""}`}
              aria-label={`${name}, tier ${referral.urgency}, waiting ${durMinutes(minutes)}${overdue ? ", overdue" : ""}`}
              aria-pressed={selectedId === referral.id}
              onClick={() => onSelect(referral.id)}
            >
              {/* Audit 11 Oct 2026: "T2", as the tier chip reads, so a mark is not read as a count. */}
              {overdue ? <TriangleAlert size={12} aria-hidden="true" /> : `T${referral.urgency}`}
            </button>
          );
        })}
      </div>
      <div className={styles.runwayAxis} aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick.label} style={{ left: `${runwayPercent(tick.at)}%` }}>
            <b>{tick.label}</b>
            {tick.tier && !compact ? (
              <span className={styles.tickTier}> {tick.tier === "all" ? "all tiers" : `${tick.tier} due`}</span>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}
