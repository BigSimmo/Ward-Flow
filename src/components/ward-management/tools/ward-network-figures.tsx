"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useDueSoonThresholds, useWardFlowClock, useWardFlowSelect, useWardNetwork } from "../ward-flow-provider";
import { standingFigures } from "../ward-standing-strip";
import { capacityBreakdown, bedsPendingPreparation, openBedsNow } from "../ward-bed-availability";
import { occupancyPercent, occupiedBeds } from "../statistics/statistics-occupancy";
import { dayOf, formatInstant, minutesUntil, splitDuration, type Instant } from "../ward-clock";
import type { Movement } from "../ward-model";
import { isOpen } from "../ward-derivations";
import { edById, edShortName } from "../ward-sites";
import { StatusGlyph } from "@/components/wf";
import styles from "./ward-network-figures.module.css";

const root = "/ward-flow";

/**
 * Tools, All figures: the whole-network figures in three groups (beds, flow, waits), always counted
 * across the whole network whatever screen is open. Kept by the Tools review (15 Oct 2026) for a quick
 * look across the service; first under Look up since the Service now strip went (19 Oct 2026).
 */
export function NetworkFigures({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { units, admissions, movements, bedReleases, leaveBeds } = useWardFlowSelect(
    "units",
    "admissions",
    "movements",
    "bedReleases",
    "leaveBeds",
  );
  const now = useWardFlowClock();
  const thresholds = useDueSoonThresholds();
  const network = useWardNetwork();
  const [category, setCategory] = useState("all");
  const capacity = units.map((unit) => capacityBreakdown(unit, bedReleases, leaveBeds, now));
  const total = units.reduce((sum, unit) => sum + unit.beds, 0);
  const occupied = occupiedBeds(units, admissions, bedReleases, leaveBeds);
  const available = capacity.reduce((sum, value) => sum + value.availableNow, 0);
  const open = movements.filter(isOpen);
  const deadlines = standingFigures(
    {
      units,
      admissions,
      movements,
      bedReleases,
      leaveBeds,
      now,
      chromeRole: "coordinator",
    },
    thresholds,
    network,
  )
    .filter((figure) => ["passed", "within-hour", "longest"].includes(figure.key))
    .map((figure) => (figure.key === "longest" ? longestWait(open, now) : figure));
  const groups = [
    {
      id: "capacity",
      label: "Beds and capacity",
      short: "Beds",
      meta: `${units.length} wards`,
      figures: [
        { label: "Total beds", value: String(total), sub: `${units.length} wards` },
        {
          label: "Occupied",
          value: String(occupied.occupied),
          // Occupied + Pulled, the one occupancy figure every other page prints (L1, 12 Oct 2026).
          sub: total ? `${occupancyPercent(occupied)}% occupancy` : "—",
        },
        {
          label: "Ready",
          value: String(available),
          sub: total ? `${Math.round((available / total) * 100)}% of beds` : "—",
        },
        {
          label: "Open for placement",
          value: String(units.reduce((sum, unit) => sum + openBedsNow(unit, bedReleases), 0)),
          sub: "Can be pulled into",
        },
        {
          label: "Pending preparation",
          value: String(units.reduce((sum, unit) => sum + bedsPendingPreparation(unit.id, bedReleases), 0)),
          sub: "Free beds pending",
        },
        { label: "Pulled beds", value: String(occupied.pulled), sub: "Awaiting arrival" },
        {
          label: "Held beds",
          value: String(capacity.reduce((sum, value) => sum + value.held, 0)),
          sub: "Not allocatable",
        },
        {
          label: "On leave",
          value: String(capacity.reduce((sum, value) => sum + value.onLeave, 0)),
          sub: "Bed retained",
        },
      ],
    },
    {
      id: "flow",
      label: "Flow and discharges",
      short: "Flow",
      meta: "today",
      figures: [
        { label: "Open movements", value: String(open.length), sub: "Active placements" },
        {
          label: "From ED",
          value: String(open.filter((movement) => movement.originEdId !== undefined).length),
          sub: "Open placements",
        },
        {
          label: "Admissions today",
          value: String(
            admissions.filter((admission) => admission.arrivedAt !== null && dayOf(admission.arrivedAt) === dayOf(now))
              .length,
          ),
          sub: "Recorded arrivals",
        },
        {
          label: "Discharges today",
          value: String(
            admissions.filter((admission) => admission.leftAt !== null && dayOf(admission.leftAt) === dayOf(now))
              .length,
          ),
          sub: "Recorded departures",
        },
        {
          label: "Confirmed today",
          value: String(capacity.reduce((sum, value) => sum + value.confirmedToday, 0)),
          sub: "Not yet complete",
        },
        {
          label: "Expected today",
          value: String(capacity.reduce((sum, value) => sum + value.expectedToday, 0)),
          sub: "Unconfirmed",
        },
        {
          label: "Blocked today",
          value: String(capacity.reduce((sum, value) => sum + value.blockedToday, 0)),
          sub: "Discharge blockers",
        },
      ],
    },
    {
      id: "deadlines",
      label: "Waits and recorded limits",
      short: "Waits",
      meta: "live",
      figures: deadlines,
    },
  ];
  const figureCount = groups.reduce((sum, group) => sum + group.figures.length, 0);
  return (
    <div className={styles.workspace} data-testid="ward-stats-drawer-content">
      <div className={styles.meta}>
        <span className={styles.liveDot} aria-hidden="true" /> Whole network{" "}
        <span>Synthetic · {formatInstant(now)}</span>
      </div>
      <div className={styles.filters} role="group" aria-label="Figure categories">
        {[{ id: "all", short: "All figures", figures: { length: figureCount } }, ...groups].map((group) => (
          <button
            key={group.id}
            type="button"
            aria-pressed={category === group.id}
            onClick={() => setCategory(group.id)}
          >
            {group.short}
            <span className={styles.count} aria-hidden="true">
              {group.figures.length}
            </span>
          </button>
        ))}
      </div>
      {groups
        .filter((group) => category === "all" || category === group.id)
        .map((group) => (
          <section className={styles.surface} key={group.id}>
            <h3 className={styles.heading}>
              {group.label}
              <span className={styles.count} aria-hidden="true">
                {group.figures.length}
              </span>
              <small aria-hidden="true">{group.meta}</small>
            </h3>
            <dl className={styles.figures}>
              {group.figures.map((figure) => {
                const flagged = "flagged" in figure && figure.flagged === true;
                const tone = "key" in figure && figure.key === "passed" ? "danger" : "warning";
                return (
                  <div key={figure.label} data-flagged={flagged ? true : undefined}>
                    <dt>{figure.label}</dt>
                    <dd>
                      <span className={styles.value}>
                        {flagged ? <StatusGlyph tone={tone} size={8} /> : null}
                        {figure.value}
                      </span>
                      {figure.sub ? <small>{figure.sub}</small> : null}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      <Link className={styles.moreLink} href={`${root}/statistics`} onClick={onNavigate}>
        Open statistics <ArrowUpRight aria-hidden="true" strokeWidth={1.75} />
      </Link>
    </div>
  );
}

/**
 * The longest wait reads as a duration with the ED it started from. The shared strip's version carries
 * the movement's internal reference and the word "waiting", which cut the label off in this grid
 * (Tools polish, Josh approved 15 Oct 2026).
 */
function longestWait(open: readonly Movement[], now: Instant) {
  const worst = open.reduce<Movement | undefined>(
    (found, movement) => (found === undefined || movement.openedAt < found.openedAt ? movement : found),
    undefined,
  );
  return {
    key: "longest",
    label: "Longest wait",
    value: worst === undefined ? "—" : splitDuration(Math.max(minutesUntil(now, worst.openedAt), 0)),
    sub: worst === undefined ? undefined : `From ${edShortName(edById(worst.originEdId)) || "an unrecorded ED"}`,
  };
}
