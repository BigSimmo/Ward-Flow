"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  calendarDateOf,
  formatInstant,
  formatSheetMoment,
  MINUTES_PER_DAY,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { holidaysListedFor, WA_PUBLIC_HOLIDAYS_LAST_YEAR } from "@/components/ward-management/wa-public-holidays";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { Card, StatusGlyph } from "@/components/wf";
import {
  DISCHARGE_DEPENDENCY_KIND_LABELS,
  DISCHARGE_DEPENDENCY_OWNERS,
  DISCHARGE_DEPENDENCY_OWNER_LABELS,
  outstandingDependencies,
  type DischargeDependency,
} from "./discharge-dependencies";
import { CLOSURE_LOOKAHEAD_DAYS, nextNonWorkingClosure, type ServiceClosure } from "./discharge-service-hours";
import styles from "./discharge-weekend-prep.module.css";

/**
 * Closing-the-loop package B (24 Oct 2026): before a weekend or public holiday, the outstanding
 * discharge arrangements whose owning service is about to close until after it. Coordinator-facing,
 * on the discharges board.
 *
 * Grouped by service in a fixed order, and within a service in the board's recorded order. It
 * ranks nobody and does nothing by itself: each row only opens that discharge. The hours are
 * synthetic reference data (`discharge-service-hours.ts`).
 */
type WeekendPrepRow = { release: BedRelease; item: DischargeDependency };
export type WeekendPrepGroup = { closure: ServiceClosure; rows: WeekendPrepRow[] };

function weekendPrepGroups(releases: readonly BedRelease[], now: Instant, dayZero: Date): WeekendPrepGroup[] {
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

function closureFact(closure: ServiceClosure, dayZero: Date): string {
  const service = DISCHARGE_DEPENDENCY_OWNER_LABELS[closure.owner];
  const closes =
    closure.closesAt === null
      ? `${service} is closed now`
      : `${service} closes ${shortMoment(closure.closesAt, dayZero)}`;
  return `${closes}, reopens ${shortMoment(closure.reopensAt, dayZero)} (${closure.closedFor.join(", ")})`;
}

/**
 * Before the weekend or public holiday, as a compact notice above the list (Josh, 30 Oct: it was
 * buried under about 60 rows). The same groups as today's panel (`weekendPrepGroups`): outstanding
 * arrangements whose owning service closes over the next weekend or holiday. Each row leads with the
 * person, surname first, and opens that release on its barriers and arrangements. Nothing here acts by
 * itself. With nothing outstanding the notice is not shown. On a phone it folds to one line (the list
 * comes first there) and opens on a tap.
 */
export function DischargeWeekendPrep({
  releases,
  units,
  nameFor,
  now,
  dayZero,
  onOpen,
  foldable = false,
}: {
  releases: readonly BedRelease[];
  units: readonly Unit[];
  nameFor: (release: BedRelease) => string | null;
  now: Instant;
  dayZero: Date;
  onOpen: (releaseId: string, opener: HTMLElement) => void;
  /** Phone: starts folded to its heading and the number of arrangements. */
  foldable?: boolean;
}) {
  const [unfolded, setUnfolded] = useState(false);
  const groups = weekendPrepGroups(releases, now, dayZero);
  if (groups.length === 0) return null;
  // H-0766: the look-ahead runs past the WA holiday list, so a holiday there would read as a working day.
  const arrangements = groups.reduce((sum, group) => sum + group.rows.length, 0);
  const pastHolidayList = !holidaysListedFor(calendarDateOf(now + CLOSURE_LOOKAHEAD_DAYS * MINUTES_PER_DAY, dayZero));
  return (
    <Card
      as="section"
      className={styles.weekend}
      aria-labelledby="discharge-weekend-prep-heading"
      data-testid="ward-discharge-weekend-prep"
    >
      <header className={styles.weekendHead}>
        {foldable ? (
          <h2 id="discharge-weekend-prep-heading" className={styles.weekendFoldHeading}>
            <button
              type="button"
              className={styles.weekendFold}
              aria-expanded={unfolded}
              onClick={() => setUnfolded((open) => !open)}
            >
              <StatusGlyph tone="warning" size={10} />
              <span className={styles.weekendTitle}>Before the weekend or public holiday</span>
              <span className={styles.weekendCount}>
                {arrangements} {arrangements === 1 ? "arrangement" : "arrangements"}
              </span>
              {unfolded ? (
                <ChevronDown size={16} aria-hidden="true" className={styles.weekendChevron} />
              ) : (
                <ChevronRight size={16} aria-hidden="true" className={styles.weekendChevron} />
              )}
            </button>
          </h2>
        ) : (
          <>
            <StatusGlyph tone="warning" size={10} />
            <h2 id="discharge-weekend-prep-heading" className={styles.weekendTitle}>
              Before the weekend or public holiday
            </h2>
          </>
        )}
        <p className={styles.weekendNote} hidden={foldable && !unfolded}>
          Opening hours are synthetic reference data to check.
          {pastHolidayList
            ? ` WA public holidays after ${WA_PUBLIC_HOLIDAYS_LAST_YEAR} are not listed yet, so they are not marked.`
            : null}
        </p>
      </header>
      <div className={styles.weekendGroups} hidden={foldable && !unfolded}>
        {groups.map((group) => (
          <section
            key={group.closure.owner}
            className={styles.weekendGroup}
            aria-label={closureFact(group.closure, dayZero)}
          >
            <h3 className={styles.weekendGroupTitle}>{closureFact(group.closure, dayZero)}</h3>
            <ul className={styles.weekendList}>
              {group.rows.map(({ release, item }) => {
                const unit = units.find((candidate) => candidate.id === release.unitId);
                const ward = unit?.name ?? "Ward not recorded";
                const name = nameFor(release);
                return (
                  <li key={`${release.id}-${item.kind}`}>
                    <button
                      type="button"
                      className={styles.weekendRow}
                      onClick={(event) => onOpen(release.id, event.currentTarget)}
                    >
                      <span className={styles.weekendWho}>
                        <strong>{name ?? ward}</strong>
                        {name ? <span> · {ward}</span> : null}
                      </span>
                      <span className={styles.weekendMeta}>
                        {DISCHARGE_DEPENDENCY_KIND_LABELS[item.kind]} · out{" "}
                        {formatSheetMoment(release.expectedAt, dayZero)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Card>
  );
}
