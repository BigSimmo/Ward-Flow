"use client";
// Two of one ward's statistics cards, split out of statistics-ward-screen.tsx to keep it under the
// line cap. The coordinator and the ward desk lay them out differently (statistics-ward-screen.tsx).

import { BedDouble, Users } from "lucide-react";

import { CardBody, SrOnly, StatusGlyph, cx, durMinutes } from "@/components/wf";
import { splitDuration } from "@/components/ward-management/ward-clock";
import type { WardDetailModel } from "./statistics-wards-index";
import { StatCard } from "./statistics-hero";
import { exactStatisticsCount, statisticsCountText } from "./statistics-small-numbers";
import styles from "./statistics-v6.module.css";
import compact from "./statistics-ward-compact.module.css";
import ward from "./statistics-ward.module.css";

const positive = (count: Parameters<typeof exactStatisticsCount>[0]) => exactStatisticsCount(count) !== 0;

/**
 * Referrals into the ward, and the pull to arrival times. `halfWidth` lays the four pull to arrival
 * tiles as two rows of two, for the half-width slot beside Length of stay.
 */
export function ReferralsCard({
  referrals,
  statistics,
  halfWidth = false,
}: {
  referrals: WardDetailModel["referrals"];
  statistics: WardDetailModel["statistics"];
  halfWidth?: boolean;
}) {
  const small = statisticsCountText;
  const excludedShown = small(statistics.emptyBedIncoherentCount);
  return (
    <StatCard
      icon={Users}
      title="Referrals into ward"
      id="ward-referrals"
      data-testid="ward-statistics-ward-referrals-panel"
    >
      <CardBody className={styles.bodyStack}>
        <section data-testid="ward-stat-referrals" aria-label="Referrals into this ward">
          <dl className={styles.figures}>
            <div className={styles.figure}>
              <dd className={styles.figureValue} data-testid="ward-stat-referrals-asked">
                {small(referrals.askedAndWaiting)}
              </dd>
              <dt className={styles.figureLabel}>Asking now</dt>
            </div>
            <div className={styles.figure}>
              <dd className={styles.figureValue} data-testid="ward-stat-referrals-accepted">
                {small(referrals.everAccepted)}
              </dd>
              {/* Not "Accepted" alone: that reads as waiting to arrive, and an acceptance stands after the
                  person arrives (tests/ward-statistics-ward-referrals-section.dom.test.tsx). */}
              <dt className={styles.figureLabel}>Acceptances still standing</dt>
            </div>
            <div className={styles.figure}>
              <dd className={styles.figureValue} data-testid="ward-stat-referrals-declined">
                {small(referrals.everDeclined)}
              </dd>
              <dt className={styles.figureLabel}>
                <StatusGlyph tone="closed" size={9} />
                Ever declined
              </dt>
            </div>
          </dl>
          <SrOnly>
            Asking now counts referrals waiting on this ward right now. Acceptances still standing includes arrivals,
            but excludes withdrawn acceptances. Ever declined counts recorded declines. One movement can appear in both
            accepted and declined counts, so the three do not add up.
          </SrOnly>
        </section>
        {statistics.averageEmptyBedMinutes !== null || positive(statistics.emptyBedIncoherentCount) ? (
          <div data-testid="ward-statistics-ward-admissions-discharges">
            <h3 className={ward.subHead}>Pull to arrival</h3>
            <div className={cx(styles.tiles, halfWidth && compact.tilesTwoRows)}>
              <div className={styles.tile} data-testid="ward-stat-empty-bed-minutes">
                <span className={styles.tileLabel}>Average</span>
                {statistics.averageEmptyBedMinutes === null ? (
                  <span className={styles.tileValue}>
                    <span aria-hidden="true">none</span>
                    <SrOnly>No bed has a pull and a later arrival to average.</SrOnly>
                  </span>
                ) : (
                  <span className={styles.tileValue}>{splitDuration(statistics.averageEmptyBedMinutes)}</span>
                )}
              </div>
              <div className={styles.tile}>
                <span className={styles.tileLabel}>Shortest</span>
                <span className={styles.tileValue} data-testid="ward-stat-empty-bed-shortest">
                  {statistics.emptyBedMinutesShortest === null
                    ? "none"
                    : splitDuration(statistics.emptyBedMinutesShortest)}
                </span>
              </div>
              <div className={styles.tile}>
                <span className={styles.tileLabel}>Longest</span>
                <span className={styles.tileValue} data-testid="ward-stat-empty-bed-longest">
                  {statistics.emptyBedMinutesLongest === null
                    ? "none"
                    : splitDuration(statistics.emptyBedMinutesLongest)}
                </span>
              </div>
              <div className={styles.tile} data-testid="ward-stat-empty-bed-incoherent">
                <span className={styles.tileLabel}>Excluded</span>
                <span className={styles.tileValue}>{excludedShown}</span>
                <SrOnly>
                  {excludedShown === 1 ? "admission on this ward records" : "admissions on this ward record"} an arrival
                  earlier than the bed was given away.
                  {positive(statistics.emptyBedIncoherentCount)
                    ? ` That cannot be true, so ${excludedShown === 1 ? "it is" : "they are"} excluded from the average and counted here instead.`
                    : ""}
                </SrOnly>
              </div>
            </div>
          </div>
        ) : null}
      </CardBody>
    </StatCard>
  );
}

/**
 * Beds now: the bed figures found nowhere else on the page (UX audit 21 Oct 2026). Ready, pulled and
 * closed are in the hero and the bed map legend.
 */
export function BedsNowCard({
  model,
}: {
  model: Pick<
    WardDetailModel,
    "unit" | "emptyBeds" | "allocatableBeds" | "openBeds" | "pendingPreparation" | "oldestPulled"
  >;
}) {
  const { unit, emptyBeds, allocatableBeds, openBeds, pendingPreparation, oldestPulled } = model;
  return (
    <StatCard
      icon={BedDouble}
      title="Beds now"
      aside={`${unit.beds} beds`}
      id="ward-beds"
      data-testid="ward-statistics-ward-beds-now"
    >
      <CardBody className={styles.bodyStack}>
        <dl className={styles.tiles} aria-label="Current bed figures">
          <div className={styles.tile}>
            <dt className={styles.tileLabel}>Empty</dt>
            <dd className={styles.tileValue} data-testid="ward-stat-capacity-empty">
              {emptyBeds}
            </dd>
          </div>
          <div className={styles.tile}>
            <dt className={styles.tileLabel}>Allocatable</dt>
            <dd className={styles.tileValue} data-testid="ward-stat-capacity-allocatable">
              {allocatableBeds}
              {allocatableBeds === 0 && <small>no free bed</small>}
            </dd>
          </div>
          <div className={styles.tile}>
            <dt className={styles.tileLabel}>Open now</dt>
            <dd className={styles.tileValue}>{openBeds}</dd>
          </div>
          <div className={styles.tile}>
            <dt className={styles.tileLabel}>Pending</dt>
            <dd className={styles.tileValue} data-testid="ward-stat-capacity-pending-preparation">
              {pendingPreparation}
            </dd>
          </div>
        </dl>
        {oldestPulled === null ? null : (
          <p className={ward.factLine}>
            <span className={styles.flagged}>
              <StatusGlyph tone="warning" size={9} />
              Oldest pulled bed
            </span>
            <span>
              <b>{durMinutes(oldestPulled)}</b> not arrived
            </span>
          </p>
        )}
      </CardBody>
    </StatCard>
  );
}
