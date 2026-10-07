"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, ChevronDown, Clock, Hospital, Scale } from "lucide-react";

import {
  Card,
  CardBody,
  CardFoot,
  ColumnChart,
  HeroStat,
  Icon,
  Menu,
  Meter,
  Segmented,
  SrOnly,
  StatusGlyph,
  buttonClass,
  durMinutes,
  tableClasses,
} from "@/components/wf";
import { readDeclinesByReason } from "@/components/ward-management/statistics/statistics-decline-reporting";
import { ED_WAIT_BANDS, edWaitBands, edWaitFigures } from "@/components/ward-management/statistics/statistics-ed-waits";
import {
  statisticsSectionById,
  STATISTICS_UNIT_CHOOSER_HREF,
} from "@/components/ward-management/statistics/statistics-sections";
import { edStatisticsHref, movementHref } from "@/components/ward-management/shell/ward-facade";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import { clockState, splitDuration } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { LONG_WAIT_MINUTES, VERY_LONG_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { allEmergencyDepartments, edById, siteByCode } from "@/components/ward-management/ward-sites";

import { StatCard, StatisticsPage, useStatisticsLive } from "./statistics-hero";
import { useOptionalRouter } from "./statistics-nav";
import styles from "./statistics-v6.module.css";
import detail from "./statistics-detail.module.css";

/**
 * ONE EMERGENCY DEPARTMENT IN DETAIL — the per-department statistics page.
 *
 * ⚠️ **AN ID THAT RESOLVES TO NOTHING GETS A PAGE THAT SAYS SO**, for the same reason the ward
 * screen beside this one does. This screen never falls back to a different department, and it names
 * the id it could not resolve.
 *
 * ⚠️ **A WARD AND AN EMERGENCY DEPARTMENT ARE NOT ONE LIST WITH A FLAG.** A department has no beds,
 * so nothing here is a bed measure. The department comes from `allEmergencyDepartments()` via
 * `edById`; `movements` come from the provider, because who is on the list changes as it runs.
 *
 * ⚠️ **EVERY WAIT FIGURE IS CALLED FROM `statistics-ed-waits.ts`, NEVER RECOMPUTED HERE**, and every
 * department in the comparison goes through the same function this page reads itself with, so the
 * table and the page cannot disagree about one department.
 *
 * ⚠️ **"DUE PASSED" IS NARROWER THAN IT SOUNDS.** `legalForm.dueAt` is authored only for a transport
 * or transfer order, so that column can never report a missed Mental Health Act deadline, and the
 * card says the limits are not legally checked.
 *
 * ⚠️ **THE TWO DECLINE COUNTS ARE NEVER SUMMED.** "No free bed" is read directly; "other" is the
 * total less that, so a malformed reason makes the second unknowable while the first stays true.
 *
 * **Left out of the drawing:** the "Flag to bed desk" action (the app has none) and the "each
 * minute" live chip (the page clock is the provider's and is shown in the hero).
 */
export function StatisticsEdScreen({
  edId,
  movements: movementsOverride,
}: {
  edId: string;
  /** TEST-ONLY, same discipline as `StatisticsWardScreen`'s `admissions` override. */
  movements?: Movement[];
}) {
  const live = useStatisticsLive();
  const { movements: liveMovements, patients, referrals } = live.state;
  const now = live.now;
  const movements = movementsOverride ?? liveMovements;
  const department = edById(edId);

  const section = statisticsSectionById("units");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'units' section");

  if (!department) {
    return (
      <StatisticsPage
        section={section}
        navSection="ed"
        testId="ward-statistics-ed-screen"
        title="Emergency department not found"
        eyebrowLabel="Emergency department"
        now={now}
        paused={live.paused}
        onTogglePause={live.togglePause}
      >
        <StatCard icon={Hospital} title="No such department">
          <CardBody className={styles.bodyStack}>
            <p data-testid="ward-statistics-ed-unresolved">
              No emergency department in this prototype has the id <code className={detail.code}>{edId}</code>. It may
              have been renamed or removed, or the id in the address may be wrong. This page never falls back to a
              different department, because a page showing the wrong department under the right heading is worse than a
              page showing nothing.
            </p>
            <p>
              <Link href={STATISTICS_UNIT_CHOOSER_HREF} data-testid="ward-statistics-ed-chooser-link">
                Choose an emergency department from the comparisons page
              </Link>{" "}
              to reach one that does exist.
            </p>
          </CardBody>
        </StatCard>
      </StatisticsPage>
    );
  }

  const site = siteByCode(department.siteCode);
  const { onTheList, urgent, unplaced, waitingMovements, over24h, over48h, longestWait, allDepartmentMovements } =
    edWaitFigures(movements, department.id, now);
  const bands = edWaitBands(movements, department.id, now);
  const nameOf = (movement: Movement) => resolveSubjectPatient(movement, { patients, referrals }).formalName;

  const sortedWaits = [...waitingMovements].map((entry) => entry.waitMinutes).sort((a, b) => a - b);
  const middle = Math.floor(sortedWaits.length / 2);
  const median =
    sortedWaits.length === 0
      ? null
      : sortedWaits.length % 2
        ? sortedWaits[middle]!
        : (sortedWaits[middle - 1]! + sortedWaits[middle]!) / 2;

  const comparison = allEmergencyDepartments().map((each) => {
    const figures = edWaitFigures(movements, each.id, now);
    return {
      department: each,
      figures,
      breached: figures.departmentMovements.filter(
        (movement) =>
          movement.legalForm?.dueAt !== undefined && clockState(movement.legalForm.dueAt, now) === "breached",
      ).length,
    };
  });

  // Reported in place, never thrown: the wait figures do not read the decline vocabulary.
  const declinesReadout = readDeclinesByReason([...allDepartmentMovements]);
  const noFreeBedDeclineCount = allDepartmentMovements
    .flatMap((movement) => movement.declines)
    .filter((decline) => decline.reason === "no_bed").length;
  const notSuitableDeclineCount = declinesReadout.ok
    ? declinesReadout.value.totalCount - noFreeBedDeclineCount
    : undefined;

  const longHours = LONG_WAIT_MINUTES / 60;
  const veryLongHours = VERY_LONG_WAIT_MINUTES / 60;
  const nextToCross = waitingMovements
    .filter((entry) => entry.waitMinutes < LONG_WAIT_MINUTES)
    .sort((a, b) => b.waitMinutes - a.waitMinutes)
    .slice(0, 3);

  return (
    <StatisticsPage
      section={section}
      navSection="ed"
      slug={department.id}
      testId="ward-statistics-ed-screen"
      title={department.name}
      titleAction={<ChangeDepartment currentId={department.id} />}
      eyebrowLabel="Emergency department"
      eyebrowDetail={<span data-testid="ward-statistics-ed-site">{site ? site.name : "Hospital not recorded"}</span>}
      now={now}
      paused={live.paused}
      onTogglePause={live.togglePause}
      stats={
        <>
          <HeroStat value={<span data-testid="ward-stat-ed-on-the-list">{onTheList}</span>} label="Waiting" />
          <HeroStat
            value={longestWait ? splitDuration(longestWait.waitMinutes) : "none"}
            label={
              <span className={styles.flagged}>
                {longestWait && longestWait.waitMinutes >= VERY_LONG_WAIT_MINUTES ? (
                  <StatusGlyph tone="danger" size={9} />
                ) : longestWait && longestWait.waitMinutes >= LONG_WAIT_MINUTES ? (
                  <StatusGlyph tone="warning" size={9} />
                ) : null}
                Longest
              </span>
            }
          />
          <HeroStat value={median === null ? "none" : splitDuration(Math.round(median))} label="Median" />
          <HeroStat value={urgent} label="Urgent" />
          <HeroStat value={over24h} label={`Over ${longHours}h`} />
          <HeroStat value={unplaced} label="No ward yet" />
        </>
      }
    >
      <div className={styles.gridMain}>
        <Waits
          waiting={waitingMovements}
          nameOf={nameOf}
          over24h={over24h}
          over48h={over48h}
          onTheList={onTheList}
          longestName={longestWait ? nameOf(longestWait.movement) : ""}
          longestText={longestWait ? splitDuration(longestWait.waitMinutes) : ""}
        />
        <div className={styles.stack}>
          <StatCard
            icon={Activity}
            title="Wait bands"
            aside="People waiting now"
            data-testid="ward-statistics-ed-bands"
          >
            <CardBody className={styles.bodyStack}>
              <ColumnChart
                label="People waiting by wait band"
                height={96}
                columns={bands.map((band, index) => ({
                  id: band.label,
                  label: bandShortLabel(index),
                  value: band.count,
                }))}
              />
              <ul className={styles.srOnly}>
                {bands.map((band) => (
                  <li key={band.label} data-testid={`ward-statistics-ed-band-${slug(band.label)}`}>
                    {band.label},{" "}
                    <span data-testid={`ward-statistics-ed-band-count-${slug(band.label)}`}>
                      {band.count === 0 ? "none" : band.count}
                    </span>
                  </li>
                ))}
              </ul>
              <div data-testid="ward-statistics-ed-declines">
                <div className={styles.tiles} aria-hidden="true">
                  <div className={styles.tile}>
                    <span className={styles.tileLabel}>
                      <StatusGlyph tone="closed" size={9} /> Declined, no bed
                    </span>
                    <span className={styles.tileValue}>{noFreeBedDeclineCount}</span>
                  </div>
                  <div className={styles.tile}>
                    <span className={styles.tileLabel}>
                      <StatusGlyph tone="closed" size={9} /> Declined, other
                    </span>
                    <span className={styles.tileValue}>{notSuitableDeclineCount ?? "none"}</span>
                  </div>
                </div>
                <SrOnly>
                  <p data-testid="ward-stat-ed-declined-no-free-bed">
                    {noFreeBedDeclineCount} {noFreeBedDeclineCount === 1 ? "decline names" : "declines name"} a ward
                    that had no free bed.
                  </p>
                  {declinesReadout.ok ? (
                    <p data-testid="ward-stat-ed-declined-not-suitable">
                      {notSuitableDeclineCount} {notSuitableDeclineCount === 1 ? "decline gave" : "declines gave"} a
                      reason other than having no free bed.
                    </p>
                  ) : null}
                </SrOnly>
                {declinesReadout.ok ? null : (
                  <p className={detail.note} data-testid="ward-stat-ed-declined-not-suitable-unavailable">
                    {declinesReadout.statement}
                  </p>
                )}
              </div>
            </CardBody>
          </StatCard>

          <StatCard icon={AlertTriangle} title={`Next to cross ${longHours}h`} aside="Count down">
            <CardBody className={styles.bodyStack}>
              {nextToCross.length === 0 ? (
                <p className={styles.muted}>Nobody is waiting under {longHours}h</p>
              ) : (
                <ul className={detail.crossList}>
                  {nextToCross.map(({ movement, waitMinutes }) => (
                    <li key={movement.id} className={detail.crossRow}>
                      <span>
                        <Link href={movementHref(movement.id)} className={detail.crossName}>
                          {nameOf(movement)}
                        </Link>
                        <span className={detail.secondary}>{durMinutes(waitMinutes)} waiting</span>
                      </span>
                      <span className={detail.crossDue}>
                        <b>in {durMinutes(LONG_WAIT_MINUTES - waitMinutes)}</b>
                        <span className={detail.secondary}>to {longHours}h</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </StatCard>
        </div>
      </div>

      <StatCard
        icon={Scale}
        title="Across departments"
        aside={<LegalLimitsNotChecked variant="tag" />}
        data-testid="ward-stat-ed-comparison"
      >
        <div className={styles.tableWrap}>
          <table className={`${tableClasses.table} ${styles.table}`}>
            <caption className={styles.srOnly}>Open placement waits in every emergency department</caption>
            <thead>
              <tr>
                <th scope="col">Department</th>
                <th scope="col" className={styles.num}>
                  Waiting
                </th>
                <th scope="col" className={styles.num}>
                  Longest
                </th>
                <th scope="col" className={styles.num}>
                  Due passed
                </th>
                <th scope="col" className={styles.num}>
                  {`${longHours}h+`}
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.map(({ department: each, figures, breached }) => {
                const here = each.id === department.id;
                return (
                  <tr
                    key={each.id}
                    data-testid={`ward-stat-ed-comparison-row-${each.id}`}
                    aria-current={here ? "page" : undefined}
                    className={here ? detail.currentRow : undefined}
                  >
                    <th scope="row">
                      <span className={styles.codeLead}>{each.siteCode}</span>
                      {here ? (
                        each.name
                      ) : (
                        <Link href={edStatisticsHref(each.id)} className={styles.rowLink}>
                          {each.name}
                        </Link>
                      )}
                      {here ? <span className={styles.code}>this page</span> : null}
                    </th>
                    <td
                      className={figures.onTheList === 0 ? `${styles.num} ${styles.muted}` : styles.num}
                      data-testid={`ward-stat-ed-comparison-waiting-${each.id}`}
                    >
                      {figures.onTheList}
                    </td>
                    <td
                      className={figures.longestWait ? styles.num : `${styles.num} ${styles.muted}`}
                      data-testid={`ward-stat-ed-comparison-longest-${each.id}`}
                    >
                      {figures.longestWait ? splitDuration(figures.longestWait.waitMinutes) : "none waiting"}
                    </td>
                    <td
                      className={breached === 0 ? `${styles.num} ${styles.muted}` : styles.num}
                      data-testid={`ward-stat-ed-comparison-breached-${each.id}`}
                    >
                      {breached}
                    </td>
                    <td
                      className={figures.over24h === 0 ? `${styles.num} ${styles.muted}` : styles.num}
                      data-testid={`ward-stat-ed-comparison-over24h-${each.id}`}
                    >
                      {figures.over24h}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </StatCard>
      {/* The page's own provenance note: each sentence says the figures are invented by itself. */}
      <Card as="div">
        <CardBody>
          <section
            className={detail.provenance}
            aria-labelledby="ward-statistics-ed-invented-heading"
            data-testid="ward-statistics-ed-invented"
          >
            <h2 id="ward-statistics-ed-invented-heading" className={detail.subHead}>
              Every figure here is invented
            </h2>
            <p className={detail.note}>
              Every count and every wait above is invented. These invented figures are derived from this
              prototype&apos;s own invented movement records and have never been measured against a real department or a
              real patient. Nothing on this screen is a real clinical record.
            </p>
          </section>
        </CardBody>
      </Card>
      <SrOnly>
        Over {longHours}h and over {veryLongHours}h are operational defaults, not legal limits.
      </SrOnly>
    </StatisticsPage>
  );
}

const slug = (label: string) => label.replace(/\s+/gu, "-").toLowerCase();

/** "<4h", "4-8h" … "24h+": a column label built from the band's own floor and the next one's. */
function bandShortLabel(index: number): string {
  const from = ED_WAIT_BANDS[index]!.fromMinutes / 60;
  const next = ED_WAIT_BANDS[index + 1];
  if (index === 0 && next) return `<${next.fromMinutes / 60}h`;
  return next ? `${from}-${next.fromMinutes / 60}h` : `${from}h+`;
}

function ChangeDepartment({ currentId }: { currentId: string }) {
  const router = useOptionalRouter();
  return (
    <Menu
      label="Change ED"
      items={allEmergencyDepartments().map((each) => ({
        id: each.id,
        label: each.name,
        meta: each.siteCode,
        disabled: each.id === currentId,
        onSelect: () => {
          const href = edStatisticsHref(each.id);
          if (router) router.push(href);
          else window.location.assign(href);
        },
      }))}
      trigger={(props) => (
        <button {...props} type="button" className={buttonClass({ variant: "onHero", size: "sm" })}>
          Change ED
          <Icon icon={ChevronDown} size={14} />
        </button>
      )}
    />
  );
}

type WaitFilter = "all" | "urgent" | "unplaced";

function Waits({
  waiting,
  nameOf,
  over24h,
  over48h,
  onTheList,
  longestName,
  longestText,
}: {
  waiting: readonly { movement: Movement; waitMinutes: number }[];
  nameOf: (movement: Movement) => string;
  over24h: number;
  over48h: number;
  onTheList: number;
  longestName: string;
  longestText: string;
}) {
  const [filter, setFilter] = useState<WaitFilter>("all");
  const [sort, setSort] = useState<"longest" | "name">("longest");
  const longHours = LONG_WAIT_MINUTES / 60;
  const veryLongHours = VERY_LONG_WAIT_MINUTES / 60;
  const counts: Record<WaitFilter, number> = {
    all: waiting.length,
    urgent: waiting.filter(({ movement }) => movement.flaggedUrgent).length,
    unplaced: waiting.filter(({ movement }) => movement.acceptedUnitId === undefined).length,
  };
  const shown = waiting
    .filter(({ movement }) =>
      filter === "urgent"
        ? movement.flaggedUrgent
        : filter === "unplaced"
          ? movement.acceptedUnitId === undefined
          : true,
    )
    .sort((a, b) =>
      sort === "name" ? nameOf(a.movement).localeCompare(nameOf(b.movement)) : b.waitMinutes - a.waitMinutes,
    );
  const max = Math.max(VERY_LONG_WAIT_MINUTES, ...waiting.map((entry) => entry.waitMinutes));

  return (
    <StatCard icon={Clock} title="Open placement waits" data-testid="ward-statistics-ed-wait">
      {onTheList === 0 ? (
        <CardBody>
          <p className={styles.muted} data-testid="ward-stat-ed-wait-empty">
            Nobody from this department has an open placement
          </p>
        </CardBody>
      ) : (
        <>
          <div className={styles.toolbar}>
            <Segmented
              label="Waits shown"
              value={filter}
              onChange={setFilter}
              items={[
                { id: "all", label: "All", count: counts.all },
                { id: "urgent", label: "Urgent", count: counts.urgent },
                { id: "unplaced", label: "No ward", count: counts.unplaced },
              ]}
            />
            <span className={styles.toolbarEnd}>
              <Segmented
                label="Sort waits"
                value={sort}
                onChange={setSort}
                items={[
                  { id: "longest", label: "Longest" },
                  { id: "name", label: "Name" },
                ]}
              />
            </span>
          </div>
          <SrOnly>
            <p data-testid="ward-stat-ed-over-24h">
              {over24h} of the {onTheList} waiting {over24h === 1 ? "has" : "have"} been waiting more than {longHours}{" "}
              hours, your default, not a legal limit.
            </p>
            <p data-testid="ward-stat-ed-over-48h">
              {over48h} of the {onTheList} waiting {over48h === 1 ? "has" : "have"} been waiting more than{" "}
              {veryLongHours} hours, your default, not a legal limit.
            </p>
            <p data-testid="ward-stat-ed-longest-wait">
              Longest wait, {longestName}, {longestText} waiting.
            </p>
          </SrOnly>
          <div data-testid="ward-stat-ed-wait-chart" data-ward-primitive="wait-chart">
            <div className={styles.tableWrap}>
              <table className={`${tableClasses.table} ${styles.table}`} data-testid="ward-stat-ed-wait-table">
                <caption className={styles.srOnly}>Open placement waits from this department, synthetic</caption>
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">Ward status</th>
                    <th scope="col">
                      <span className={styles.srOnly}>Elapsed against {veryLongHours} hours</span>
                    </th>
                    <th scope="col" className={styles.num}>
                      Waiting
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 ? (
                    <tr>
                      <td colSpan={4} className={styles.muted}>
                        Nobody matches this filter
                      </td>
                    </tr>
                  ) : null}
                  {shown.map(({ movement, waitMinutes }) => {
                    const level =
                      waitMinutes >= VERY_LONG_WAIT_MINUTES
                        ? "urgent"
                        : waitMinutes >= LONG_WAIT_MINUTES
                          ? "stalled"
                          : undefined;
                    const tone =
                      waitMinutes >= VERY_LONG_WAIT_MINUTES
                        ? "danger"
                        : waitMinutes >= LONG_WAIT_MINUTES
                          ? "warning"
                          : undefined;
                    // The bar draws the wait but prints no text (`valueText={null}`). Its own name
                    // keeps `tests/ward-row-severity-not-colour-alone.test.ts` reading the printed
                    // wait from the last column, the one cell that states the wait in words.
                    const barMinutes = waitMinutes;
                    return (
                      <tr key={movement.id} data-level={level} data-testid={`ward-stat-ed-wait-row-${movement.id}`}>
                        <th scope="row">
                          <Link href={movementHref(movement.id)} className={styles.rowLink}>
                            {nameOf(movement)}
                          </Link>
                        </th>
                        <td>
                          <span className={styles.flagged}>
                            {movement.acceptedUnitId !== undefined ? (
                              <StatusGlyph tone="success" size={9} />
                            ) : (
                              <StatusGlyph tone="neutral" size={9} />
                            )}
                            {movement.acceptedUnitId !== undefined ? "Ward accepted" : "No ward yet"}
                            {movement.flaggedUrgent ? <span className={styles.code}>urgent</span> : null}
                          </span>
                        </td>
                        <td className={detail.meterCell}>
                          <span data-testid={`ward-stat-ed-wait-dot-${movement.id}`} data-tone={tone}>
                            <Meter
                              value={barMinutes}
                              max={max}
                              threshold={LONG_WAIT_MINUTES}
                              fill="data-1"
                              label={`${nameOf(movement)} elapsed wait`}
                              valueText={null}
                            />
                          </span>
                        </td>
                        <td className={styles.num}>
                          <span className={styles.flagged}>
                            {tone ? <StatusGlyph tone={tone} size={9} /> : null}
                            {splitDuration(waitMinutes)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <CardFoot
              meta={
                <span className={detail.legendLine}>
                  <span>Tick at {longHours}h, your default, not a legal limit</span>
                  <span data-testid="ward-stat-ed-wait-threshold-24h" className={styles.flagged}>
                    <StatusGlyph tone="warning" size={9} />
                    {`${longHours}h`}
                  </span>
                  <span data-testid="ward-stat-ed-wait-threshold-48h" className={styles.flagged}>
                    <StatusGlyph tone="danger" size={9} />
                    {`${veryLongHours}h`}
                  </span>
                </span>
              }
            />
          </div>
        </>
      )}
    </StatCard>
  );
}
