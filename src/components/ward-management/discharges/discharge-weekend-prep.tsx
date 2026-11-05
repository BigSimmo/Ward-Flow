"use client";

import { useState } from "react";
import {
  BedSingle,
  CalendarClock,
  Car,
  ChevronDown,
  ChevronRight,
  HeartHandshake,
  Pill,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  calendarDateOf,
  formatInstant,
  MINUTES_PER_DAY,
  perthDayLabel,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { holidaysListedFor, WA_PUBLIC_HOLIDAYS_LAST_YEAR } from "@/components/ward-management/wa-public-holidays";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { Card, IconTile, Popover } from "@/components/wf";
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
  return `${perthDayLabel(instant, dayZero)} ${formatInstant(instant)}`;
}

function closureFact(closure: ServiceClosure, dayZero: Date): string {
  const service = DISCHARGE_DEPENDENCY_OWNER_LABELS[closure.owner];
  const closes =
    closure.closesAt === null
      ? `${service} is closed now`
      : `${service} closes ${shortMoment(closure.closesAt, dayZero)}`;
  return `${closes}, reopens ${shortMoment(closure.reopensAt, dayZero)} (${closure.closedFor.join(", ")})`;
}

/** The service's own icon, so each closed service reads at a glance. */
const OWNER_ICONS: Record<ServiceClosure["owner"], LucideIcon> = {
  ward: BedSingle,
  pharmacy: Pill,
  patient_transport: Car,
  social_work: HeartHandshake,
  community_team: Users,
};

/** "Closed now" or "Closes Fri 17:00", then when it reopens. */
function closureWhen(closure: ServiceClosure, dayZero: Date): string {
  const closes = closure.closesAt === null ? "Closed now" : `Closes ${shortMoment(closure.closesAt, dayZero)}`;
  return `${closes} · reopens ${shortMoment(closure.reopensAt, dayZero)}`;
}

/**
 * Closed this weekend (mock-up, 1 Nov 2026; replaces the grey "Before the weekend or public holiday"
 * notice). One card per closed service: its icon, name, when it reopens and how many people are due
 * out before then. Each person leads with their name, surname first, then what they are waiting on
 * and the ward; on the right their time out and whether it falls before the service reopens. A row
 * opens that release on its barriers and arrangements. Nothing here acts by itself. With nothing
 * outstanding the card is not shown. On a phone it folds to one line and opens on a tap; on a desk it
 * can be hidden.
 */
export function DischargeWeekendPrep({
  releases,
  units,
  nameFor,
  umrnFor,
  now,
  dayZero,
  onOpen,
  foldable = false,
}: {
  releases: readonly BedRelease[];
  units: readonly Unit[];
  nameFor: (release: BedRelease) => string | null;
  /** The person's UMRN, when the release links to one. */
  umrnFor?: (release: BedRelease) => string | null;
  now: Instant;
  dayZero: Date;
  onOpen: (releaseId: string, opener: HTMLElement) => void;
  /** Phone: starts folded to its heading and the number of arrangements. */
  foldable?: boolean;
}) {
  const [phoneOpen, setPhoneOpen] = useState(false);
  const groups = weekendPrepGroups(releases, now, dayZero);
  if (groups.length === 0) return null;
  // H-0766: the look-ahead runs past the WA holiday list, so a holiday there would read as a working day.
  const pastHolidayList = !holidaysListedFor(calendarDateOf(now + CLOSURE_LOOKAHEAD_DAYS * MINUTES_PER_DAY, dayZero));
  // Rows are per arrangement, so one person can appear under several services: count people once.
  const beforeReopen = new Set(
    groups.flatMap((group) =>
      group.rows.filter(({ release }) => release.expectedAt < group.closure.reopensAt).map(({ release }) => release.id),
    ),
  ).size;
  const holidays = [...new Set(groups.flatMap((group) => group.closure.closedFor))].filter((day) => day !== "Weekend");
  const title = holidays.length > 0 ? `Closed for ${holidays.join(" and ")}` : "Closed this weekend";
  const summary = `${groups.length} ${groups.length === 1 ? "service" : "services"} closed · ${beforeReopen} ${beforeReopen === 1 ? "discharge" : "discharges"} before ${groups.length === 1 ? "it reopens" : "they reopen"}`;
  const open = foldable ? phoneOpen : true;
  const toggle = () => setPhoneOpen((was) => !was);
  const rowsFor = (group: WeekendPrepGroup, close?: () => void) => (
    <ul className={styles.rows}>
      {group.rows.map(({ release, item }) => {
        const unit = units.find((candidate) => candidate.id === release.unitId);
        const ward = unit?.name ?? "Ward not recorded";
        const name = nameFor(release);
        const umrn = umrnFor?.(release) ?? null;
        const before = release.expectedAt < group.closure.reopensAt;
        return (
          <li key={`${release.id}-${item.kind}`}>
            <button
              type="button"
              className={styles.row}
              onClick={(event) => {
                const opener = event.currentTarget;
                close?.();
                onOpen(release.id, opener);
              }}
            >
              <span className={styles.rowMain}>
                <span className={styles.rowName}>{name ?? ward}</span>
                <span className={styles.rowMeta}>
                  {DISCHARGE_DEPENDENCY_KIND_LABELS[item.kind]}
                  {name ? ` · ${ward}` : null}
                  {umrn ? (
                    <>
                      {" · "}
                      <span className={styles.rowUmrn}>{umrn}</span>
                    </>
                  ) : null}
                </span>
              </span>
              <span className={styles.rowSide}>
                <span className={styles.rowOut}>Out {shortMoment(release.expectedAt, dayZero)}</span>
                {/* DC3 (3 Nov 2026): the heading already counts the discharges before it
                    reopens, so only the rare row after reopening says so. */}
                {before ? (
                  <span className="sr-only">Before reopening</span>
                ) : (
                  <span className={styles.rowAfter}>After reopening</span>
                )}
              </span>
              <ChevronRight size={16} aria-hidden="true" className={styles.rowChevron} />
            </button>
          </li>
        );
      })}
    </ul>
  );
  return (
    <Card
      as="section"
      className={styles.weekend}
      aria-labelledby="discharge-weekend-prep-heading"
      data-testid="ward-discharge-weekend-prep"
      data-open={(foldable && open) || undefined}
      data-strip={foldable ? undefined : ""}
    >
      <header className={styles.head}>
        {foldable ? (
          <h2 id="discharge-weekend-prep-heading" className={styles.foldHeading}>
            <button type="button" className={styles.fold} aria-expanded={open} onClick={toggle}>
              <IconTile icon={CalendarClock} className={styles.headTile} />
              <span className={styles.headText}>
                <span className={styles.title}>{title}</span>
                <span className={styles.summary}>{summary}</span>
              </span>
              <ChevronDown size={16} aria-hidden="true" className={styles.chevron} />
            </button>
          </h2>
        ) : (
          <>
            <IconTile icon={CalendarClock} className={styles.headTile} />
            <div className={styles.headText}>
              <h2 id="discharge-weekend-prep-heading" className={styles.title}>
                {title}
              </h2>
              <p className={styles.summary}>{summary}</p>
            </div>
            {/* DC3 round 2 (3 Nov 2026): on a desk the services sit in one line as pills, each
                opening its people in a popover, so the card stays one row tall and the list below
                stays in view. */}
            <ul className={styles.pills} aria-label="Closed services">
              {groups.map((group) => {
                const OwnerIcon = OWNER_ICONS[group.closure.owner];
                const service = DISCHARGE_DEPENDENCY_OWNER_LABELS[group.closure.owner];
                return (
                  <li key={group.closure.owner}>
                    <Popover
                      label={`${service}, ${group.rows.length} waiting`}
                      align="end"
                      panelClassName={styles.pillPanel}
                      trigger={(props) => (
                        <button
                          type="button"
                          {...props}
                          className={styles.pill}
                          aria-label={`${closureFact(group.closure, dayZero)}. ${group.rows.length} waiting`}
                          data-testid={`ward-discharge-weekend-${group.closure.owner}`}
                        >
                          <OwnerIcon size={14} strokeWidth={1.75} aria-hidden="true" className={styles.pillIcon} />
                          <span className={styles.pillName}>{service}</span>
                          <span className={styles.pillCount}>{group.rows.length}</span>
                          <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" className={styles.pillChevron} />
                        </button>
                      )}
                    >
                      {(close) => (
                        <div className={styles.pillBody}>
                          <p className={styles.pillWhen}>{closureWhen(group.closure, dayZero)}</p>
                          {rowsFor(group, () => close(false))}
                        </div>
                      )}
                    </Popover>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </header>
      {foldable ? (
        <div id="discharge-weekend-prep-services" className={styles.services} hidden={!open}>
          {groups.map((group) => {
            const OwnerIcon = OWNER_ICONS[group.closure.owner];
            return (
              <section
                key={group.closure.owner}
                className={styles.service}
                aria-label={closureFact(group.closure, dayZero)}
              >
                <header className={styles.serviceHead}>
                  <span className={styles.serviceIcon} aria-hidden="true">
                    <OwnerIcon size={16} aria-hidden="true" />
                  </span>
                  <span className={styles.serviceText}>
                    <h3 className={styles.serviceName}>{DISCHARGE_DEPENDENCY_OWNER_LABELS[group.closure.owner]}</h3>
                    <span className={styles.serviceWhen}>{closureWhen(group.closure, dayZero)}</span>
                  </span>
                  <span className={styles.serviceCount} aria-label={`${group.rows.length} waiting`}>
                    {group.rows.length}
                  </span>
                </header>
                {rowsFor(group)}
              </section>
            );
          })}
        </div>
      ) : null}
      {open && pastHolidayList ? (
        <p className={styles.note}>
          WA public holidays after {WA_PUBLIC_HOLIDAYS_LAST_YEAR} are not listed yet, so they are not marked.
        </p>
      ) : null}
    </Card>
  );
}
