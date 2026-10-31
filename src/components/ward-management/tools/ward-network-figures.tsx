"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useDueSoonThresholds, useWardFlowClock, useWardFlowSelect, useWardNetwork } from "../ward-flow-provider";
import { standingFigures } from "../ward-standing-strip";
import { capacityBreakdown, bedsPendingPreparation, openBedsNow } from "../ward-bed-availability";
import { totalReadyBedsNow } from "../ward-bed-states";
import { CAPACITY_FIGURE_LABELS } from "../ward-morning-rollup";
import { confirmedHeldUpNote } from "../capacity/capacity-derivations";
import { occupancyPercent, occupiedBeds } from "../statistics/statistics-occupancy";
import { dayOf, formatInstant, minutesUntil, splitDuration, type Instant } from "../ward-clock";
import type { Movement } from "../ward-model";
import { isOpen } from "../ward-derivations";
import { edById, edShortName } from "../ward-sites";
import { StatusGlyph } from "@/components/wf";
import { useCanOpenHref } from "../shell/ward-access";
import styles from "./ward-network-figures.module.css";
import { useExecutiveStatistics, useExecutiveStatisticsControl } from "../statistics/executive-statistics-context";
import { releasedCountText } from "../statistics/statistics-small-numbers";

const root = "/ward-flow";

/**
 * Tools, All figures: the whole-network figures in three groups (beds, flow, waits), always counted
 * across the whole network whatever screen is open. Kept by the Tools review (15 Oct 2026) for a quick
 * look across the service; first under Look up since the Service now strip went (19 Oct 2026).
 */
export function NetworkFigures({ onNavigate }: { onNavigate?: () => void } = {}) {
  return useExecutiveStatisticsControl().executive ? (
    <ExecutiveNetworkFigures onNavigate={onNavigate} />
  ) : (
    <OperationalNetworkFigures onNavigate={onNavigate} />
  );
}
type FigureGroup = {
  id: string;
  label: string;
  short: string;
  meta: string;
  figures: { label: string; value: string; sub?: string; key?: string; flagged?: boolean }[];
};
function ExecutiveNetworkFigures({ onNavigate }: { onNavigate?: () => void }) {
  const report = useExecutiveStatistics();
  if (!report) return <p role="status">Figures are unavailable until this report is ready.</p>;
  const beds = report.network.beds;
  const groups: FigureGroup[] = [
    {
      id: "capacity",
      label: "Beds and capacity",
      short: "Beds",
      meta: `${report.wards.length} wards`,
      figures: [
        { label: "Total beds", value: String(beds.total) },
        { label: "Occupied", value: String(beds.occupied) },
        { label: "Ready", value: String(beds.ready) },
        { label: "Open for placement", value: String(report.capacity.openNow) },
        { label: "Pending preparation", value: String(report.capacity.pendingPreparation) },
        { label: "Pulled beds", value: String(beds.pulled) },
        { label: "Closed", value: String(beds.closed) },
        { label: "On leave", value: String(beds.onLeave) },
      ],
    },
    {
      id: "flow",
      label: "Flow and discharges",
      short: "Flow",
      meta: "today",
      figures: [
        {
          label: "Open movements",
          value: String(releasedCountText(report.network.people.stillOpen)),
          sub: "Active placements",
        },
        {
          label: "From ED",
          value: "Not shown",
          sub: "This breakdown is unavailable for this desk",
        },
        {
          label: "Admissions today",
          value: String(releasedCountText(report.network.people.admissionsArrivedToday)),
          sub: "Recorded arrivals",
        },
        {
          label: "Discharges today",
          value: String(releasedCountText(report.network.people.admissionsEndedToday)),
          sub: "Recorded departures",
        },
        ...[
          CAPACITY_FIGURE_LABELS.confirmedToday,
          CAPACITY_FIGURE_LABELS.expectedToday,
          CAPACITY_FIGURE_LABELS.blockedToday,
        ].map((label) => ({
          label,
          value: "Not shown",
          sub: "Individual release figures are unavailable for this desk",
        })),
      ],
    },
    {
      id: "deadlines",
      label: "Waits and recorded limits",
      short: "Waits",
      meta: "live",
      figures: [
        { label: "Waiting in ED", value: String(releasedCountText(report.network.people.waitingInEd)) },
        { label: "Over 24 hours", value: String(releasedCountText(report.edIndex.over24)) },
      ],
    },
  ];
  return (
    <NetworkFiguresView
      groups={groups}
      now={report.network.asAt.now}
      scopeLabel={report.network.scope.kind === "service" ? report.network.scope.service : "Whole network"}
      onNavigate={onNavigate}
    />
  );
}
function OperationalNetworkFigures({ onNavigate }: { onNavigate?: () => void }) {
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
  const capacity = units.map((unit) => capacityBreakdown(unit, bedReleases, leaveBeds, now));
  const total = units.reduce((sum, unit) => sum + unit.beds, 0);
  const occupied = occupiedBeds(units, admissions, bedReleases, leaveBeds);
  // Audit 24-4 NA2-06: the one ready figure Home and Capacity print (`readyBedsNow`).
  const available = totalReadyBedsNow(units, admissions, bedReleases);
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
          label: "Closed",
          value: String(capacity.reduce((sum, value) => sum + value.held, 0)),
          sub: "Not allocatable",
        },
        {
          label: "On leave",
          value: String(capacity.reduce((sum, value) => sum + value.onLeave, 0)),
          sub: "Bed held for their return",
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
          label: CAPACITY_FIGURE_LABELS.confirmedToday,
          value: String(capacity.reduce((sum, value) => sum + value.confirmedToday, 0)),
          // NA3-06 (decision 16, 26 Oct 2026): name the overlap with held up, as Capacity does.
          sub: [
            "Not yet complete",
            confirmedHeldUpNote(
              0,
              capacity.reduce((sum, value) => sum + value.confirmedHeldUpToday, 0),
            ),
          ]
            .filter(Boolean)
            .join(" "),
        },
        {
          label: CAPACITY_FIGURE_LABELS.expectedToday,
          value: String(capacity.reduce((sum, value) => sum + value.expectedToday, 0)),
          sub: "Unconfirmed",
        },
        {
          // Decision 15 (26 Oct 2026): the release count's one name. "Blocked today" also covered
          // tomorrow, and "Blocked" is not the owner's word for a delay.
          label: CAPACITY_FIGURE_LABELS.blockedToday,
          value: String(capacity.reduce((sum, value) => sum + value.blockedToday, 0)),
          sub: "Part of confirmed and expected",
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
  return <NetworkFiguresView groups={groups} now={now} scopeLabel="Whole network" onNavigate={onNavigate} />;
}
function NetworkFiguresView({
  groups,
  now,
  scopeLabel,
  onNavigate,
}: {
  groups: FigureGroup[];
  now: number;
  scopeLabel: string;
  onNavigate?: () => void;
}) {
  const [category, setCategory] = useState("all");
  // Access audit (31 Oct 2026): Open statistics only for a desk that may open the statistics hub.
  // A ward, ED or team desk opens only its own place's page, and an officer or admin none (D-80).
  const canOpen = useCanOpenHref();
  const figureCount = groups.reduce((sum, group) => sum + group.figures.length, 0);
  return (
    <div className={styles.workspace} data-testid="ward-stats-drawer-content">
      <div className={styles.meta}>
        <span className={styles.liveDot} aria-hidden="true" /> {scopeLabel}{" "}
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
      {canOpen(`${root}/statistics`) ? (
        <Link className={styles.moreLink} href={`${root}/statistics`} onClick={onNavigate}>
          Open statistics <ArrowUpRight aria-hidden="true" strokeWidth={1.75} />
        </Link>
      ) : null}
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
