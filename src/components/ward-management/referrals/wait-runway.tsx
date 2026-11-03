"use client";
// Referrals redesign: WaitRunway copied from src/components/ward-management/referrals/referral-board-parts.tsx
// (30 October 2026). Changed: the chart is headed "Since referral", the queue column's own words,
// and the last tick reads "72h all tiers" instead of "72h any due".
// RQ6 (Josh, 3 Nov 2026): markers that would touch are grouped into one count, so a busy morning
// stays one tidy line instead of a tower of stacked lanes. Every marker and group has a hover card
// with the core facts (who, tier, wait, from, asking for), and a group's card lists its people.

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";

import type { Instant } from "@/components/ward-management/ward-clock";
import type { Referral } from "@/components/ward-management/ward-model";
import { referralClocks } from "@/components/ward-management/ward-referrals";
import {
  OVERDUE_AFTER_ANY_TIER_MINUTES,
  OVERDUE_AFTER_MINUTES_BY_TIER,
} from "@/components/ward-management/ward-operational-defaults";
import { askingForShort, isOverdue, runwayGapPercent, runwayMarkerPercent, waitWords } from "./referral-board-parts";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { OverlayPortal, cx, durMinutes } from "@/components/wf";
import styles from "./referral-board.module.css";

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

/** One marker or a group of markers that would overlap at this width. */
type RunwayEntry = { referral: Referral; minutes: number; x: number };
type RunwayGroup = { key: string; x: number; entries: RunwayEntry[] };

/** Groups positions (sorted left to right) so no two marks sit closer than `gapPercent`. A group
 *  sits at the mean of its members, so it stays inside the stretch of wait it stands for. A new
 *  group only starts a full gap past the last group's mean, and that mean only moves right as the
 *  group grows, so no two groups end up within the gap. */
export function runwayGroups(entries: readonly RunwayEntry[], gapPercent: number): RunwayGroup[] {
  const sorted = [...entries].sort((a, b) => a.x - b.x || b.referral.raisedAt - a.referral.raisedAt);
  const groups: RunwayGroup[] = [];
  for (const entry of sorted) {
    const last = groups[groups.length - 1];
    if (last && entry.x - last.x < gapPercent) {
      last.entries.push(entry);
      last.x = last.entries.reduce((sum, item) => sum + item.x, 0) / last.entries.length;
      continue;
    }
    groups.push({ key: entry.referral.id, x: entry.x, entries: [entry] });
  }
  return groups;
}

export function WaitRunway({
  queued,
  now,
  selectedId,
  isHighlighted,
  nameOf,
  umrnOf,
  onSelect,
  compact = false,
}: {
  queued: Referral[];
  now: Instant;
  selectedId: string | undefined;
  isHighlighted: (referral: Referral) => boolean;
  nameOf: (referral: Referral) => string;
  /** The UMRN for the hover card. Left out, the card shows the name alone. */
  umrnOf?: (referral: Referral) => string;
  onSelect: (referralId: string) => void;
  compact?: boolean;
}) {
  // Markers are kept apart in real pixels, so measure the track rather than assume its width.
  const trackRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [trackPx, setTrackPx] = useState<number | undefined>(undefined);
  // The card shown: by hover or focus (peek), or held open by a tap on a group (pinned).
  const [peek, setPeek] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const cardId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<number | undefined>(undefined);
  // The card is portalled above the page (the dark band clips anything that leaves it), so it is
  // placed from the marker's own box and kept up for a moment while the pointer crosses to it.
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  const show = (key: string, target: HTMLElement) => {
    window.clearTimeout(leaveTimer.current);
    const rect = target.getBoundingClientRect();
    setAnchor({ left: rect.left + rect.width / 2, top: rect.bottom + 8 });
    setPeek(key);
  };
  const hideSoon = () => {
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setPeek(null), 140);
  };
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);
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
  // A pinned group card closes on Escape or a press outside the chart.
  useEffect(() => {
    if (pinned === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPinned(null);
    };
    const onPress = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || cardRef.current?.contains(target)) return;
      setPinned(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPress);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPress);
    };
  }, [pinned]);
  const entries: RunwayEntry[] = queued.map((referral) => {
    const minutes = referralClocks(referral, now).sinceReferral;
    return { referral, minutes, x: runwayMarkerPercent(runwayPercent(minutes), trackPx, compact) };
  });
  const groups = runwayGroups(entries, runwayGapPercent(trackPx, compact));
  const shownKey = pinned ?? peek;
  const shown = groups.find((group) => group.key === shownKey);
  const ticks = [
    { at: 0, label: "0", tier: "" },
    { at: OVERDUE_AFTER_MINUTES_BY_TIER[1], label: hoursLabel(OVERDUE_AFTER_MINUTES_BY_TIER[1]), tier: "T1" },
    { at: OVERDUE_AFTER_MINUTES_BY_TIER[2], label: hoursLabel(OVERDUE_AFTER_MINUTES_BY_TIER[2]), tier: "T2" },
    { at: OVERDUE_AFTER_MINUTES_BY_TIER[3], label: hoursLabel(OVERDUE_AFTER_MINUTES_BY_TIER[3]), tier: "T3" },
    { at: OVERDUE_AFTER_ANY_TIER_MINUTES, label: hoursLabel(OVERDUE_AFTER_ANY_TIER_MINUTES), tier: "all" },
  ];
  const facts = (referral: Referral) => {
    const { waited, due, overdue } = waitWords(referral, now);
    const site = siteByCode(referral.originSiteCode)?.name ?? referral.originSiteCode;
    return { waited, due, overdue, site, asking: askingForShort(referral) };
  };
  const spoken = (entry: RunwayEntry) => {
    const overdue = isOverdue(entry.referral, now);
    return `${nameOf(entry.referral)}, tier ${entry.referral.urgency}, waiting ${durMinutes(entry.minutes)}${overdue ? ", overdue" : ""}`;
  };
  const card =
    shown && anchor ? (
      <div
        ref={cardRef}
        id={cardId}
        role={shown.entries.length > 1 ? "region" : "tooltip"}
        aria-label={shown.entries.length > 1 ? `${shown.entries.length} referrals at this wait` : undefined}
        className={cx(
          styles.runwayCard,
          compact && styles.runwayCardInline,
          !compact && anchor.left < 190 && styles.runwayCardStart,
          !compact && typeof window !== "undefined" && anchor.left > window.innerWidth - 190 && styles.runwayCardEnd,
        )}
        style={compact ? undefined : { left: anchor.left, top: anchor.top }}
        data-testid="ward-referral-runway-card"
        onMouseEnter={() => window.clearTimeout(leaveTimer.current)}
        onMouseLeave={hideSoon}
      >
        {shown.entries.length > 1 ? (
          <p className={styles.runwayCardHead}>
            <b>{shown.entries.length} referrals</b> at about this wait
          </p>
        ) : null}
        <ul>
          {[...shown.entries]
            .sort((a, b) => b.minutes - a.minutes)
            .map((entry) => {
              const f = facts(entry.referral);
              const umrn = umrnOf?.(entry.referral);
              const body = (
                <>
                  <span className={styles.runwayCardTier}>T{entry.referral.urgency}</span>
                  <span className={styles.runwayCardMain}>
                    <b>{nameOf(entry.referral)}</b>
                    {umrn ? <span className={styles.runwayCardMono}>{umrn}</span> : null}
                    <span>
                      {f.site} · {f.asking}
                    </span>
                  </span>
                  <span className={cx(styles.runwayCardWait, f.overdue && styles.runwayCardOver)}>
                    <b className={styles.runwayCardMono}>{f.waited}</b>
                    <span>{f.due}</span>
                  </span>
                </>
              );
              return (
                <li key={entry.referral.id}>
                  {shown.entries.length > 1 ? (
                    <button
                      type="button"
                      className={styles.runwayCardRow}
                      aria-pressed={selectedId === entry.referral.id}
                      onClick={() => {
                        setPinned(null);
                        setPeek(null);
                        onSelect(entry.referral.id);
                      }}
                    >
                      {body}
                    </button>
                  ) : (
                    <div className={styles.runwayCardRow}>{body}</div>
                  )}
                </li>
              );
            })}
        </ul>
      </div>
    ) : null;
  return (
    <div
      ref={rootRef}
      className={cx(styles.runway, compact && styles.runwayCompact)}
      data-testid="ward-referral-runway"
    >
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
        role="group"
        aria-label="Waiting time against each tier's decision window"
      >
        {[0, 25, 50, 75].map((left) => (
          <span key={left} className={styles.runwaySeg} style={{ left: `${left}%` }} aria-hidden="true" />
        ))}
        {groups.map((group) => {
          const many = group.entries.length > 1;
          const first = group.entries[0]!;
          const anyOverdue = group.entries.some((entry) => isOverdue(entry.referral, now));
          const anySelected = group.entries.some((entry) => entry.referral.id === selectedId);
          const anyHl = group.entries.some((entry) => isHighlighted(entry.referral));
          const topTier = Math.min(...group.entries.map((entry) => entry.referral.urgency));
          const open = shownKey === group.key;
          const label = many
            ? `${group.entries.length} referrals, tier ${topTier} the most urgent, waiting ${durMinutes(
                Math.min(...group.entries.map((entry) => entry.minutes)),
              )} to ${durMinutes(Math.max(...group.entries.map((entry) => entry.minutes)))}${
                anyOverdue ? ", one or more overdue" : ""
              }. Show them`
            : spoken(first);
          return (
            <button
              key={group.key}
              type="button"
              className={cx(
                styles.runwayMarker,
                many && styles.runwayMarkerGroup,
                anyOverdue && styles.runwayMarkerOverdue,
                anySelected && styles.runwayMarkerOn,
                anyHl && styles.runwayMarkerHl,
              )}
              style={{ left: `${group.x}%` }}
              aria-label={label}
              aria-pressed={many ? undefined : selectedId === first.referral.id}
              aria-expanded={many ? pinned === group.key : undefined}
              aria-controls={many && open ? cardId : undefined}
              aria-describedby={!many && open ? cardId : undefined}
              data-testid={many ? `ward-referral-runway-group-${group.key}` : undefined}
              data-count={many ? group.entries.length : undefined}
              onMouseEnter={(event) => show(group.key, event.currentTarget)}
              onMouseLeave={hideSoon}
              onFocus={(event) => show(group.key, event.currentTarget)}
              onBlur={() => setPeek((key) => (key === group.key ? null : key))}
              onClick={(event) => {
                if (many) {
                  show(group.key, event.currentTarget);
                  setPinned((key) => (key === group.key ? null : group.key));
                } else onSelect(first.referral.id);
              }}
            >
              {many ? (
                <>
                  {anyOverdue ? <TriangleAlert size={11} aria-hidden="true" /> : null}
                  <span>{group.entries.length}</span>
                </>
              ) : isOverdue(first.referral, now) ? (
                <TriangleAlert size={12} aria-hidden="true" />
              ) : (
                // Audit 11 Oct 2026: "T2", as the tier chip reads, so a mark is not read as a count.
                `T${first.referral.urgency}`
              )}
            </button>
          );
        })}
        {shown && anchor ? (
          // In the phone sheet the card stays inside the sheet, so its rows are live and in the
          // sheet's Tab cycle; a portal there would land under the modal layer and be inerted.
          compact ? (
            card
          ) : (
            <OverlayPortal layer="popover" name="referral-runway-card">
              {card}
            </OverlayPortal>
          )
        ) : null}
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
