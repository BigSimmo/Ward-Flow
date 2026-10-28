"use client";

import {
  calendarDateOf,
  formatInstant,
  formatSheetMoment,
  MINUTES_PER_DAY,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { holidaysListedFor, WA_PUBLIC_HOLIDAYS_LAST_YEAR } from "@/components/ward-management/wa-public-holidays";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { Card } from "@/components/wf";
import {
  DISCHARGE_DEPENDENCY_KIND_LABELS,
  DISCHARGE_DEPENDENCY_OWNERS,
  DISCHARGE_DEPENDENCY_OWNER_LABELS,
  outstandingDependencies,
  type DischargeDependency,
} from "./discharge-dependencies";
import { CLOSURE_LOOKAHEAD_DAYS, nextNonWorkingClosure, type ServiceClosure } from "./discharge-service-hours";
import styles from "./discharge-logistics.module.css";

/**
 * Closing-the-loop package B (24 Oct 2026): before a weekend or public holiday, the outstanding
 * discharge arrangements whose owning service is about to close until after it. Coordinator-facing,
 * on the discharges board.
 *
 * Grouped by service in a fixed order, and within a service in the board's recorded order. It
 * ranks nobody and does nothing by itself: each row only opens that discharge. The hours are
 * synthetic reference data (`discharge-service-hours.ts`).
 */
export type WeekendPrepRow = { release: BedRelease; item: DischargeDependency };
export type WeekendPrepGroup = { closure: ServiceClosure; rows: WeekendPrepRow[] };

export function weekendPrepGroups(releases: readonly BedRelease[], now: Instant, dayZero: Date): WeekendPrepGroup[] {
  const groups: WeekendPrepGroup[] = [];
  for (const owner of DISCHARGE_DEPENDENCY_OWNERS) {
    const rows = releases.flatMap((release) =>
      release.state === "discharged"
        ? []
        : outstandingDependencies(release)
            .filter((item) => item.owner === owner)
            .map((item) => ({ release, item })),
    );
    if (rows.length === 0) continue;
    const closure = nextNonWorkingClosure(owner, now, dayZero);
    if (closure) groups.push({ closure, rows });
  }
  return groups;
}

function shortMoment(instant: Instant, dayZero: Date): string {
  const day = calendarDateOf(instant, dayZero).toLocaleDateString("en-AU", {
    weekday: "short",
    timeZone: "Australia/Perth",
  });
  return `${day} ${formatInstant(instant)}`;
}

export function closureFact(closure: ServiceClosure, dayZero: Date): string {
  const service = DISCHARGE_DEPENDENCY_OWNER_LABELS[closure.owner];
  const closes =
    closure.closesAt === null
      ? `${service} is closed now`
      : `${service} closes ${shortMoment(closure.closesAt, dayZero)}`;
  return `${closes}, reopens ${shortMoment(closure.reopensAt, dayZero)} (${closure.closedFor.join(", ")})`;
}

export function DischargeWeekendPrep({
  releases,
  units,
  nameFor,
  now,
  dayZero,
  onOpen,
}: {
  releases: readonly BedRelease[];
  units: readonly Unit[];
  nameFor: (release: BedRelease) => string | null;
  now: Instant;
  dayZero: Date;
  onOpen: (releaseId: string, opener: HTMLElement) => void;
}) {
  const groups = weekendPrepGroups(releases, now, dayZero);
  // H-0766: the look-ahead runs past the WA holiday list, so a holiday there would read as a working day.
  const pastHolidayList = !holidaysListedFor(calendarDateOf(now + CLOSURE_LOOKAHEAD_DAYS * MINUTES_PER_DAY, dayZero));
  return (
    <Card
      className={styles.prep}
      aria-labelledby="discharge-weekend-prep-heading"
      data-testid="ward-discharge-weekend-prep"
    >
      <h2 id="discharge-weekend-prep-heading" className={styles.groupTitle}>
        Before the weekend or public holiday
      </h2>
      <p className={styles.note}>
        Outstanding arrangements owned by a service that closes over the next weekend or public holiday. Opening hours
        are synthetic reference data to check.
      </p>
      {pastHolidayList ? (
        <p className={styles.note}>
          WA public holidays after {WA_PUBLIC_HOLIDAYS_LAST_YEAR} are not listed yet, so they are not marked.
        </p>
      ) : null}
      {groups.length === 0 ? (
        <p className={styles.note}>
          No outstanding arrangement belongs to a service closing over a weekend or holiday soon.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.closure.owner} className={styles.group} aria-label={closureFact(group.closure, dayZero)}>
            <h3 className={styles.groupTitle}>{closureFact(group.closure, dayZero)}</h3>
            <ul className={styles.list}>
              {group.rows.map(({ release, item }) => {
                const unit = units.find((candidate) => candidate.id === release.unitId);
                const name = nameFor(release);
                return (
                  <li key={`${release.id}-${item.kind}`}>
                    <button
                      type="button"
                      className={styles.rowButton}
                      onClick={(event) => onOpen(release.id, event.currentTarget)}
                    >
                      <span>{[unit?.name ?? "Ward not recorded", name].filter(Boolean).join(" · ")}</span>
                      <span className={styles.meta}>
                        {DISCHARGE_DEPENDENCY_KIND_LABELS[item.kind]} · expected out{" "}
                        {formatSheetMoment(release.expectedAt, dayZero)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </Card>
  );
}
