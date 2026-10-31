"use client";
// Fork of src/components/ward-management/statistics/statistics-ed-screen.tsx (role view: as ED clinician).

import { edJourneySummaries } from "@/components/ward-management/ed/ed-home-derivations";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, ChevronDown, Clock, Hospital, ListOrdered, Scale, Users, X } from "lucide-react";

import {
  Card,
  CardBody,
  CardFoot,
  ColumnChart,
  HeroStat,
  Icon,
  Menu,
  Meter,
  PhoneListRow,
  Segmented,
  SrOnly,
  StatusGlyph,
  buttonClass,
  cx,
  durMinutes,
  tableClasses,
  useIsPhone,
} from "@/components/wf";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { useCanOpenHref, useStatisticsCounts } from "@/components/ward-management/shell/ward-access";
import { readDeclinesByReason } from "@/components/ward-management/statistics/statistics-decline-reporting";
import {
  ED_WAIT_BANDS,
  edJourneyWaitBands as edWaitBands,
  edJourneyWaitFigures as edWaitFigures,
} from "@/components/ward-management/statistics/statistics-ed-waits";
import {
  statisticsSectionById,
  STATISTICS_COMPARE_HREF,
  STATISTICS_EDS_HREF,
} from "@/components/ward-management/statistics/statistics-sections";
// D-91: the one unit finder, on the Summary page.
import { STATISTICS_UNIT_FINDER_HREF } from "@/components/ward-redesign/statistics/statistics-view-switch";
import { edStatisticsHref, movementHref } from "@/components/ward-management/shell/ward-facade";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import { isClockBreached, splitDuration } from "@/components/ward-management/ward-clock";
import type { EmergencyDepartment, Movement } from "@/components/ward-management/ward-model";
import { LONG_WAIT_MINUTES, VERY_LONG_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { allEmergencyDepartments, edById, siteByCode } from "@/components/ward-management/ward-sites";

import { StatisticsEdSwarm } from "@/components/ward-management/statistics/statistics-ed-swarm";
import {
  PeopleNotListed,
  withheldBar,
  ExecutiveStatisticsUnavailable,
  statisticsCountText,
  exactStatisticsCount,
  type StatisticsCount,
} from "@/components/ward-management/statistics/statistics-small-numbers";
import {
  useExecutiveStatistics,
  useExecutiveStatisticsControl,
} from "@/components/ward-management/statistics/executive-statistics-context";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { StatCard, StatisticsPage, useStatisticsLive } from "@/components/ward-management/statistics/statistics-hero";
import { HeroTool, UnitStepper } from "@/components/ward-management/statistics/statistics-hero-tools";
import { FlushRow, FlushStack, Follow } from "@/components/ward-management/statistics/statistics-layout";
import { useOptionalRouter } from "@/components/ward-management/statistics/statistics-nav";
import {
  PhoneBody,
  PhoneList,
  phoneBodyStyles as phone,
} from "@/components/ward-management/statistics/statistics-phone-parts";
import styles from "@/components/ward-management/statistics/statistics-v6.module.css";
import detail from "@/components/ward-management/statistics/statistics-detail.module.css";
import ed from "@/components/ward-management/statistics/statistics-ed-third-edition.module.css";
import redesign from "./ed-statistics-redesign.module.css";

/**
 * ONE EMERGENCY DEPARTMENT IN DETAIL — the per-department statistics page.
 *
 * ⚠️ **AN ID THAT RESOLVES TO NOTHING GETS A PAGE THAT SAYS SO**, for the same reason the ward
 * screen beside this one does. This screen never falls back to a different department, and it names
 * the id it could not resolve.
 *
 * ⚠️ **A WARD AND AN EMERGENCY DEPARTMENT ARE NOT ONE LIST WITH A FLAG.** A department has no beds,
 * so nothing here is a bed measure. The department comes from `allEmergencyDepartments()` via
 * `edById`; operational rows come from the provider and executive figures from the released report.
 *
 * Wait selectors are shared with the aggregate projector. The common view accepts public place
 * references and scalar measures only; individual rows belong to the operational wrapper.
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
function OperationalStatisticsEdScreen({
  edId,
  movements: movementsOverride,
}: {
  edId: string;
  /** TEST-ONLY, same discipline as `StatisticsWardScreen`'s `admissions` override. */
  movements?: Movement[];
}) {
  const live = useStatisticsLive();
  // Only operational desks reach this provider-backed branch.
  const { countsOnly, small } = useStatisticsCounts();
  const canOpen = useCanOpenHref();
  const { movements: liveMovements, units } = live.state;
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
              <Link href={STATISTICS_UNIT_FINDER_HREF} data-testid="ward-statistics-ed-chooser-link">
                Choose an emergency department with Open a unit
              </Link>{" "}
              to reach one that does exist.
            </p>
          </CardBody>
        </StatCard>
      </StatisticsPage>
    );
  }

  const { onTheList, urgent, unplaced, waitingMovements, over24h, over48h, longestWait, allDepartmentMovements } =
    edWaitFigures(movements, department.id, now);
  const bands = edWaitBands(movements, department.id, now);
  const edJourneys = edJourneySummaries(movements, now).find((summary) => summary.ed.id === department.id)!;

  // Statistics shows AD- admission numbers only, no names or UMRN (Josh, 13 Oct 2026), and never a
  // WF- journey id (D-39). A person waiting in ED has no admission yet, so the row names their
  // recorded urgency tier, not eight rows of "Not yet admitted" (UX audit 21 Oct 2026), and links to
  // the live movement, where the name is shown.
  const nameOf = (movement: Movement): string => urgencyTierLabel(movement.urgency);

  const sortedWaits = [...waitingMovements].map((entry) => entry.waitMinutes).sort((a, b) => a - b);
  const middle = Math.floor(sortedWaits.length / 2);
  const median =
    sortedWaits.length === 0
      ? null
      : sortedWaits.length % 2
        ? sortedWaits[middle]!
        : (sortedWaits[middle - 1]! + sortedWaits[middle]!) / 2;

  // D-80: an ED desk's copy holds only its own journeys, so other departments are left out rather
  // than shown as empty.
  const departments = allEmergencyDepartments().filter(
    (each) => each.id === department.id || canOpen(edStatisticsHref(each.id)),
  );
  const comparison = departments.map((each) => {
    const figures = edWaitFigures(movements, each.id, now);
    return {
      department: each,
      figures,
      breached: figures.departmentMovements.filter(
        (movement) => movement.legalForm?.dueAt !== undefined && isClockBreached(movement.legalForm.dueAt, now),
      ).length,
    };
  });

  // This department first, then the others busiest first: the swarm gives every one a full-width line.
  const swarmRows = [
    ...comparison.filter(({ department: each }) => each.id === department.id),
    ...comparison
      .filter(({ department: each }) => each.id !== department.id)
      .sort((a, b) => b.figures.onTheList - a.figures.onTheList || a.department.name.localeCompare(b.department.name)),
  ].map(({ department: each, figures }) => ({
    id: each.id,
    name: shortName(each.name),
    href: each.id === department.id ? undefined : edStatisticsHref(each.id),
    entries: figures.waitingMovements,
  }));

  // Reported in place, never thrown: the wait figures do not read the decline vocabulary.
  const declinesReadout = readDeclinesByReason([...allDepartmentMovements]);
  const noFreeBedDeclineCount = allDepartmentMovements
    .flatMap((movement) => movement.declines)
    .filter((decline) => decline.reason === "no_suitable_bed").length;
  const notSuitableDeclineCount =
    declinesReadout.ok && declinesReadout.value.totalCount >= noFreeBedDeclineCount
      ? declinesReadout.value.totalCount - noFreeBedDeclineCount
      : null;

  const longHours = LONG_WAIT_MINUTES / 60;
  const nextToCross = waitingMovements
    .filter((entry) => entry.waitMinutes < LONG_WAIT_MINUTES)
    .sort((a, b) => b.waitMinutes - a.waitMinutes)
    .slice(0, 3);

  return (
    <EdPresentation
      model={{
        department,
        departments,
        comparison: comparison.map(({ department: each, figures, breached }) => ({
          department: each,
          figures: {
            onTheList: figures.onTheList,
            over24h: figures.over24h,
            longestWaitMinutes: figures.longestWait?.waitMinutes ?? null,
          },
          breached,
        })),
        now,
        paused: live.paused,
        togglePause: live.togglePause,
        executive: false,
        canOpenAllEds: canOpen(STATISTICS_EDS_HREF),
        canOpenCompare: canOpen(STATISTICS_COMPARE_HREF),
        onTheList,
        urgent,
        unplaced,
        over24h,
        longestWaitMinutes: longestWait?.waitMinutes ?? null,
        median,
        stillInEd: edJourneys.stillInEd,
        inTransit: edJourneys.inTransit,
        bands,
        noFreeBedDeclineCount,
        notSuitableDeclineCount,
        declineStatement: !declinesReadout.ok
          ? declinesReadout.statement
          : notSuitableDeclineCount === null
            ? inconsistentDeclines
            : undefined,
      }}
      personPhone={
        <EdPhone
          waiting={waitingMovements}
          nameOf={nameOf}
          wardName={(unitId) => units.find((unit) => unit.id === unitId)?.name ?? "Ward accepted"}
          next={nextToCross[0] ?? null}
        />
      }
      personWaiting={
        <Waits
          waiting={waitingMovements}
          nameOf={nameOf}
          over24h={over24h}
          over48h={over48h}
          onTheList={onTheList}
          waitingText={small(onTheList)}
          countsOnly={countsOnly}
          longestName={longestWait ? nameOf(longestWait.movement) : ""}
          longestText={longestWait ? splitDuration(longestWait.waitMinutes) : ""}
        />
      }
      personNext={
        <>
          {countsOnly ? (
            <PeopleNotListed testId="ward-statistics-ed-next-not-listed" />
          ) : nextToCross.length === 0 ? (
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
        </>
      }
      personSwarm={
        <>
          {countsOnly ? (
            <PeopleNotListed testId="ward-statistics-ed-everyone-not-listed" />
          ) : (
            <>
              <StatisticsEdSwarm
                rows={swarmRows}
                labelWidth={176}
                label={`Each open ED journey, by time since opening, ${department.name} first`}
              />
              <p className={detail.note}>
                {department.name} is the first row. {LONG_WAIT_MINUTES / 60}h and {VERY_LONG_WAIT_MINUTES / 60}h lines
                are your defaults, not legal limits.
              </p>
            </>
          )}
        </>
      }
    />
  );
}

type PublicEd = Pick<EmergencyDepartment, "id" | "name" | "siteCode">;
type EdComparison = {
  department: PublicEd;
  figures: { onTheList: StatisticsCount; over24h: StatisticsCount; longestWaitMinutes: number | null };
  breached: StatisticsCount;
};
type EdPresentationModel = {
  department: PublicEd;
  departments: readonly PublicEd[];
  comparison: EdComparison[];
  now: number;
  paused: boolean;
  togglePause?: () => void;
  executive: boolean;
  canOpenAllEds: boolean;
  canOpenCompare: boolean;
  onTheList: StatisticsCount;
  urgent: StatisticsCount;
  unplaced: StatisticsCount;
  over24h: StatisticsCount;
  longestWaitMinutes: number | null;
  median: number | null;
  stillInEd: StatisticsCount;
  inTransit: StatisticsCount;
  bands: readonly { label: string; count: StatisticsCount }[];
  noFreeBedDeclineCount: StatisticsCount;
  notSuitableDeclineCount: StatisticsCount | null;
  declineStatement?: string;
};
const inconsistentDeclines =
  "The other-reasons subtotal is unknown because these answer groups do not form a consistent breakdown.";

export function AsEdStatisticsEdScreen(props: { edId: string; movements?: Movement[] }) {
  const control = useExecutiveStatisticsControl();
  const data = useExecutiveStatistics();
  const access = useEffectiveWardAccess();
  if (control.executive || access.role === "executive") {
    const current = data?.emergencyDepartments.find((item) => item.id === props.edId);
    if (!data || !current || !data.openableEmergencyDepartmentIds.includes(props.edId))
      return <ExecutiveStatisticsUnavailable />;
    return (
      <EdPresentation
        model={{
          department: current,
          departments: data.emergencyDepartments.filter((item) =>
            data.openableEmergencyDepartmentIds.includes(item.id),
          ),
          comparison: data.emergencyDepartments.map((item) => ({
            department: item,
            figures: { onTheList: item.onTheList, over24h: item.over24h, longestWaitMinutes: item.longestWaitMinutes },
            breached: item.legalClockBreachedCount,
          })),
          now: data.network.asAt.now,
          paused: control.paused,
          togglePause: control.togglePause ?? undefined,
          executive: true,
          canOpenAllEds: true,
          canOpenCompare: true,
          onTheList: current.onTheList,
          urgent: current.urgent,
          unplaced: current.unplaced,
          over24h: current.over24h,
          longestWaitMinutes: current.longestWaitMinutes,
          median: current.medianWaitMinutes,
          stillInEd: current.stillInEd,
          inTransit: current.inTransit,
          bands: current.bands,
          noFreeBedDeclineCount: current.declines.noFreeBed,
          notSuitableDeclineCount: current.declines.notSuitable,
          declineStatement: current.declines.notSuitable === null ? inconsistentDeclines : undefined,
        }}
      />
    );
  }
  return <OperationalStatisticsEdScreen {...props} />;
}

function EdPresentation({
  model,
  personPhone,
  personWaiting,
  personNext,
  personSwarm,
}: {
  model: EdPresentationModel;
  personPhone?: ReactNode;
  personWaiting?: ReactNode;
  personNext?: ReactNode;
  personSwarm?: ReactNode;
}) {
  const {
    department,
    departments,
    comparison,
    now,
    paused,
    togglePause,
    onTheList,
    urgent,
    unplaced,
    over24h,
    longestWaitMinutes,
    median,
    bands,
    noFreeBedDeclineCount,
    notSuitableDeclineCount,
    declineStatement,
  } = model;
  const accessCounts = useStatisticsCounts();
  const countsOnly = model.executive || accessCounts.countsOnly;
  const small = (count: StatisticsCount) => statisticsCountText(count, accessCounts.small);
  const [stillInEdShown, inTransitShown] = model.executive
    ? [small(model.stillInEd), small(model.inTransit)]
    : accessCounts.parts([model.stillInEd as number, model.inTransit as number]);
  const bandShown = model.executive
    ? bands.map((band) => small(band.count))
    : accessCounts.parts(bands.map((band) => band.count as number));
  const noFreeBedShown = small(noFreeBedDeclineCount);
  const notSuitableShown = notSuitableDeclineCount === null ? undefined : small(notSuitableDeclineCount);
  const isPhone = useIsPhone();
  const site = siteByCode(department.siteCode);
  const section = statisticsSectionById("units")!;
  const longHours = LONG_WAIT_MINUTES / 60;
  const veryLongHours = VERY_LONG_WAIT_MINUTES / 60;
  // Role view (as ED clinician): an ED desk reads counts only (D-80), so the cards that would list
  // people (Open ED journeys, Next to cross, by ED) are left out and the counts lead instead.
  const edCountsDesk = useEffectiveWardAccess().role === "ed" && countsOnly;
  const bandsCard = (
    <StatCard
      icon={Activity}
      title="Time since opening"
      // Role view (as ED clinician): the aside splits the chart's journeys where they are; it
      // repeated the hero's "Open ED journeys" and the split floated above the cards.
      aside={
        edCountsDesk ? (
          <span data-testid="ward-statistics-ed-population">
            <span aria-hidden="true">
              {stillInEdShown} still in ED · {inTransitShown} in transit
            </span>
            <SrOnly>
              {stillInEdShown} still in ED, {inTransitShown} in transit or recorded departure
            </SrOnly>
          </span>
        ) : (
          "Open ED journeys"
        )
      }
      id="ed-bands"
      data-testid="ward-statistics-ed-bands"
    >
      <CardBody className={styles.bodyStack}>
        <ColumnChart
          label="Open ED journeys by time since opening"
          height={96}
          columns={bands.map((band, index) => ({
            id: band.label,
            label: bandShortLabel(index),
            ...withheldBar(exactStatisticsCount(band.count) ?? 0, bandShown[index]!),
          }))}
        />
        <ul className={styles.srOnly}>
          {bands.map((band, index) => (
            <li key={band.label} data-testid={`ward-statistics-ed-band-${slug(band.label)}`}>
              {band.label},{" "}
              <span data-testid={`ward-statistics-ed-band-count-${slug(band.label)}`}>
                {bandShown[index] === 0 ? "none" : bandShown[index]}
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </StatCard>
  );
  const declinesCard = (
    // Role view (as ED clinician): the decline cross, as on the network page's Declines by reason;
    // the tiles stack in the side column and drop the "Declined" the title already says.
    <StatCard icon={edCountsDesk ? X : Users} title="Declines" aside="Referrals from here" id="ed-declines">
      <CardBody className={styles.bodyStack}>
        <div data-testid="ward-statistics-ed-declines">
          <div className={cx(styles.tiles, edCountsDesk && redesign.stackTiles)} aria-hidden="true">
            <div className={styles.tile}>
              <span className={styles.tileLabel}>
                <StatusGlyph tone="closed" size={9} /> {edCountsDesk ? "No suitable bed" : "Declined, no suitable bed"}
              </span>
              <span className={styles.tileValue}>{noFreeBedShown}</span>
            </div>
            <div className={styles.tile}>
              <span className={styles.tileLabel}>
                <StatusGlyph tone="closed" size={9} /> {edCountsDesk ? "Other" : "Declined, other"}
              </span>
              <span className={styles.tileValue}>{notSuitableShown ?? "unknown"}</span>
            </div>
          </div>
          <SrOnly>
            <p data-testid="ward-stat-ed-declined-no-free-bed">
              {noFreeBedShown} {noFreeBedShown === 1 ? "decline names" : "declines name"} a ward that had no suitable
              bed.
            </p>
            {notSuitableDeclineCount !== null ? (
              <p data-testid="ward-stat-ed-declined-not-suitable">
                {notSuitableShown} {notSuitableShown === 1 ? "decline gave" : "declines gave"} a reason other than
                having no suitable bed.
              </p>
            ) : null}
          </SrOnly>
          {notSuitableDeclineCount !== null ? null : (
            <p className={detail.note} data-testid="ward-stat-ed-declined-not-suitable-unavailable">
              {declineStatement}
            </p>
          )}
        </div>
      </CardBody>
    </StatCard>
  );
  return (
    <StatisticsPage
      section={section}
      navSection="ed"
      slug={department.id}
      testId="ward-statistics-ed-screen"
      title={department.name}
      titleAction={
        departments.length > 1 ? (
          <span className={ed.titleTools}>
            <ChangeDepartment departments={departments} currentId={department.id} />
            <UnitStepper
              noun="ED"
              currentId={department.id}
              items={departments.map((each) => ({ id: each.id, href: edStatisticsHref(each.id), label: each.name }))}
            />
          </span>
        ) : undefined
      }
      tools={
        <>
          {model.canOpenAllEds ? (
            <HeroTool
              href={STATISTICS_EDS_HREF}
              icon={<ListOrdered size={14} aria-hidden="true" />}
              testId="ward-statistics-ed-all-eds"
            >
              All EDs
            </HeroTool>
          ) : null}
          {model.canOpenCompare ? (
            <HeroTool
              href={STATISTICS_COMPARE_HREF}
              icon={<Scale size={14} aria-hidden="true" />}
              testId="ward-statistics-ed-compare"
            >
              Compare
            </HeroTool>
          ) : null}
        </>
      }
      // Role view (as ED clinician): the eyebrow says where this is in the app and that the desk
      // reads counts only; the title already names the site, so the eyebrow no longer repeats it.
      eyebrowLabel={edCountsDesk ? "Statistics" : "Emergency department"}
      eyebrowDetail={
        edCountsDesk ? (
          <span data-testid="ward-statistics-people-not-listed">
            {site ? `${site.service} · ` : ""}Counts only
            <SrOnly>, so people are not listed</SrOnly>
          </span>
        ) : (
          <span data-testid="ward-statistics-ed-site">{site ? site.name : "Hospital not recorded"}</span>
        )
      }
      now={now}
      paused={paused}
      onTogglePause={togglePause}
      exportFigures={{
        stem: department.id,
        scope: department.name,
        figures: () => [
          ["Open ED journeys", small(onTheList)],
          ["Still in ED", stillInEdShown],
          ["In transit or recorded departure", inTransitShown],
          ["Longest wait", longestWaitMinutes !== null ? splitDuration(longestWaitMinutes) : "none"],
          ["Median wait", median === null ? "none" : splitDuration(Math.round(median))],
          ["Urgent", small(urgent)],
          [`Over ${longHours}h`, small(over24h)],
          ["No ward yet", small(unplaced)],
        ],
      }}
      phone={{
        eyebrow:
          (site ? `${department.siteCode} · ${site.service}` : department.siteCode) +
          (edCountsDesk ? " · Counts only" : ""),
        title: `${shortName(department.name)} ED`,
        sub: `Median ${median === null ? "none" : splitDuration(Math.round(median))} · ${small(urgent)} urgent`,
        stats: (
          <>
            <HeroStat
              value={<span data-testid="ward-stat-ed-on-the-list">{small(onTheList)}</span>}
              label="Open ED journeys"
            />
            <HeroStat
              value={longestWaitMinutes !== null ? splitDuration(longestWaitMinutes) : "none"}
              label="Longest"
              tone={
                longestWaitMinutes !== null && longestWaitMinutes >= VERY_LONG_WAIT_MINUTES
                  ? "danger"
                  : longestWaitMinutes !== null && longestWaitMinutes >= LONG_WAIT_MINUTES
                    ? "warning"
                    : undefined
              }
            />
            <HeroStat value={small(unplaced)} label="No ward yet" />
          </>
        ),
      }}
      stats={
        <>
          <HeroStat
            value={<span data-testid="ward-stat-ed-on-the-list">{small(onTheList)}</span>}
            label="Open ED journeys"
          />
          <HeroStat
            value={longestWaitMinutes !== null ? splitDuration(longestWaitMinutes) : "none"}
            label={
              <span className={styles.flagged}>
                {longestWaitMinutes !== null && longestWaitMinutes >= VERY_LONG_WAIT_MINUTES ? (
                  <StatusGlyph tone="danger" size={9} />
                ) : longestWaitMinutes !== null && longestWaitMinutes >= LONG_WAIT_MINUTES ? (
                  <StatusGlyph tone="warning" size={9} />
                ) : null}
                Longest
              </span>
            }
          />
          <HeroStat value={median === null ? "none" : splitDuration(Math.round(median))} label="Median" />
          <HeroStat value={small(urgent)} label="Urgent" />
          {/* Role view (as ED clinician): marked as Longest is, since it counts the same long waits. */}
          <HeroStat
            value={small(over24h)}
            label={
              <span className={styles.flagged}>
                {edCountsDesk && exactStatisticsCount(over24h) !== 0 ? <StatusGlyph tone="warning" size={9} /> : null}
                {`Over ${longHours}h`}
              </span>
            }
          />
          {/* Five figures at most (v10). No ward yet is the wait list's own No ward filter count,
              so the hero leaves it out; the export still carries it. */}
        </>
      }
    >
      {/* Role view (as ED clinician): the split is Time since opening's aside, so no loose line here. */}
      {edCountsDesk ? null : (
        <p className={styles.muted} data-testid="ward-statistics-ed-population">
          {stillInEdShown} still in ED · {inTransitShown} in transit
          <span className="sr-only"> or with a recorded departure</span>. Open journeys retain ED accountability until
          arrival. The physical split includes recorded ED outcomes; times run from journey opening.
        </p>
      )}
      {isPhone && countsOnly ? (
        <PhoneBody testId="ward-statistics-ed-phone">
          {edCountsDesk ? bandsCard : null}
          {edCountsDesk ? declinesCard : null}
          {/* Role view (as ED clinician): "Counts only" is in the eyebrow, once. */}
          {edCountsDesk ? null : <PeopleNotListed testId="ward-statistics-ed-phone-not-listed" />}
        </PhoneBody>
      ) : isPhone ? (
        personPhone
      ) : edCountsDesk ? (
        <>
          {/* Role view (as ED clinician): the chart leads and Declines is the side column, so the two
              cards end level; "Counts only" moved to the eyebrow. */}
          <FlushRow layout="lead2">
            {bandsCard}
            {declinesCard}
          </FlushRow>
        </>
      ) : (
        <>
          {/* Direction A: the cards on the right set the row's height; the wait list follows it and
          scrolls inside, so both columns end on the same line however many people are waiting. */}
          <FlushRow layout="lead2">
            <Follow>
              {personWaiting ?? (
                <StatCard icon={Clock} title="Open ED journeys" id="ed-waiting" data-testid="ward-statistics-ed-wait">
                  <CardBody>
                    <PeopleNotListed testId="ward-statistics-ed-wait-not-listed" />
                  </CardBody>
                </StatCard>
              )}
            </Follow>
            <FlushStack>
              <StatCard icon={AlertTriangle} title={`Next to cross ${longHours}h`} aside="Count down" id="ed-next">
                <CardBody className={styles.bodyStack}>
                  {personNext ?? <PeopleNotListed testId="ward-statistics-ed-next-not-listed" />}
                </CardBody>
              </StatCard>
              {bandsCard}
              {declinesCard}
            </FlushStack>
          </FlushRow>

          <StatCard
            icon={Activity}
            title="Open ED journeys, by ED"
            aside={countsOnly ? undefined : "One mark per person"}
            id="ed-everyone"
            data-testid="ward-statistics-ed-everyone"
          >
            <CardBody className={styles.bodyStack}>
              {/* One mark per person is a list of people, so the executive desk gets the note instead. */}
              {personSwarm ?? <PeopleNotListed testId="ward-statistics-ed-everyone-not-listed" />}
            </CardBody>
          </StatCard>

          {comparison.length > 1 ? (
            <StatCard
              icon={Scale}
              title="Across departments"
              id="ed-departments"
              aside={<LegalLimitsNotChecked variant="tag" />}
              data-testid="ward-stat-ed-comparison"
            >
              <div className={styles.tableWrap}>
                <table className={`${tableClasses.table} ${styles.table}`}>
                  <caption className={styles.srOnly}>Open ED journeys from every emergency department</caption>
                  <thead>
                    <tr>
                      <th scope="col">Department</th>
                      <th scope="col" className={styles.num}>
                        Open journeys
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
                            {here || !departments.some((item) => item.id === each.id) ? (
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
                            {small(figures.onTheList)}
                          </td>
                          <td
                            className={
                              figures.longestWaitMinutes !== null ? styles.num : `${styles.num} ${styles.muted}`
                            }
                            data-testid={`ward-stat-ed-comparison-longest-${each.id}`}
                          >
                            {figures.longestWaitMinutes !== null
                              ? splitDuration(figures.longestWaitMinutes)
                              : "none waiting"}
                          </td>
                          <td
                            className={breached === 0 ? `${styles.num} ${styles.muted}` : styles.num}
                            data-testid={`ward-stat-ed-comparison-breached-${each.id}`}
                          >
                            {small(breached)}
                          </td>
                          <td
                            className={figures.over24h === 0 ? `${styles.num} ${styles.muted}` : styles.num}
                            data-testid={`ward-stat-ed-comparison-over24h-${each.id}`}
                          >
                            {small(figures.over24h)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </StatCard>
          ) : null}
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
                  prototype&apos;s own invented movement records and have never been measured against a real department
                  or a real patient. Nothing on this screen is a real clinical record.
                </p>
              </section>
            </CardBody>
          </Card>
        </>
      )}
      <SrOnly>
        Over {longHours}h and over {veryLongHours}h are operational defaults, not legal limits.
      </SrOnly>
    </StatisticsPage>
  );
}

type EdPhoneFilter = "all" | "unplaced" | "long";

/**
 * One ED on a phone (v10 phone): the next person to cross the long-wait line, then everyone
 * waiting, longest first, behind All, No ward and Past 24h. A wait past the very long line is act
 * now: a thin red edge, never a fill.
 */
function EdPhone({
  waiting,
  nameOf,
  wardName,
  next,
}: {
  waiting: readonly { movement: Movement; waitMinutes: number }[];
  nameOf: (movement: Movement) => string;
  wardName: (unitId: string) => string;
  next: { movement: Movement; waitMinutes: number } | null;
}) {
  const [filter, setFilter] = useState<EdPhoneFilter>("all");
  const longHours = LONG_WAIT_MINUTES / 60;
  const counts: Record<EdPhoneFilter, number> = {
    all: waiting.length,
    unplaced: waiting.filter(({ movement }) => movement.acceptedUnitId === undefined).length,
    long: waiting.filter(({ waitMinutes }) => waitMinutes >= LONG_WAIT_MINUTES).length,
  };
  const shown = waiting
    .filter(({ movement, waitMinutes }) =>
      filter === "unplaced"
        ? movement.acceptedUnitId === undefined
        : filter === "long"
          ? waitMinutes >= LONG_WAIT_MINUTES
          : true,
    )
    .slice()
    .sort((a, b) => b.waitMinutes - a.waitMinutes);

  return (
    <PhoneBody testId="ward-statistics-ed-phone">
      {next ? (
        <div className={phone.next} data-testid="ward-statistics-ed-phone-next">
          <span className={phone.ring0} aria-hidden="true" />
          <span className={phone.nextText}>
            <b>{`Next to cross ${longHours}h`}</b>
            <span>
              <b>{splitDuration(LONG_WAIT_MINUTES - next.waitMinutes)}</b> left
            </span>
          </span>
        </div>
      ) : null}
      {waiting.length === 0 ? (
        <p className={phone.note}>Nobody from this department has an open placement</p>
      ) : (
        <>
          <Segmented<EdPhoneFilter>
            className={phone.seg}
            size="md"
            label="Waits shown"
            value={filter}
            onChange={setFilter}
            items={[
              { id: "all", label: "All", count: counts.all },
              { id: "unplaced", label: "No ward", count: counts.unplaced },
              { id: "long", label: `Past ${longHours}h`, count: counts.long },
            ]}
          />
          {shown.length === 0 ? (
            <p className={phone.note}>Nobody matches this filter</p>
          ) : (
            <PhoneList label="Open ED journeys, longest first">
              {shown.map(({ movement, waitMinutes }) => {
                const tone =
                  waitMinutes >= VERY_LONG_WAIT_MINUTES
                    ? "danger"
                    : waitMinutes >= LONG_WAIT_MINUTES
                      ? "warning"
                      : undefined;
                return (
                  <PhoneListRow
                    key={movement.id}
                    as="li"
                    // No stripe or tinted fill (audit stats-8): the red triangle on the wait carries the tone.
                    leading={
                      movement.atsCategory === undefined ? undefined : (
                        <span className={phone.tier}>{`T${movement.atsCategory}`}</span>
                      )
                    }
                    name={nameOf(movement)}
                    meta={
                      <span className={phone.dotName}>
                        <StatusGlyph tone={movement.acceptedUnitId === undefined ? "neutral" : "success"} size={9} />
                        {movement.acceptedUnitId === undefined ? "No ward yet" : wardName(movement.acceptedUnitId)}
                      </span>
                    }
                    value={
                      <span className={phone.flagged}>
                        {tone ? <StatusGlyph tone={tone} size={9} /> : null}
                        {splitDuration(waitMinutes)}
                      </span>
                    }
                    time="waited"
                    href={movementHref(movement.id)}
                    data-testid={`ward-stat-ed-phone-row-${movement.id}`}
                  />
                );
              })}
            </PhoneList>
          )}
        </>
      )}
    </PhoneBody>
  );
}

/** "Royal Perth Hospital Emergency Department" reads "Royal Perth", as on the all-EDs page. */
const shortName = (name: string) =>
  name
    .replace(/ Emergency Department$/u, "")
    .replace(/ (Memorial |General )?(Hospital|Health Campus|Health Service)$/u, "");

const slug = (label: string) => label.replace(/\s+/gu, "-").toLowerCase();

/** "<4h", "4-8h" … "24h+": a column label built from the band's own floor and the next one's. */
function bandShortLabel(index: number): string {
  const from = ED_WAIT_BANDS[index]!.fromMinutes / 60;
  const next = ED_WAIT_BANDS[index + 1];
  if (index === 0 && next) return `<${next.fromMinutes / 60}h`;
  return next ? `${from}-${next.fromMinutes / 60}h` : `${from}h+`;
}

function ChangeDepartment({ departments, currentId }: { departments: readonly PublicEd[]; currentId: string }) {
  const router = useOptionalRouter();
  return (
    <Menu
      label="Change ED"
      items={departments.map((each) => ({
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
  waitingText,
  countsOnly,
  longestName,
  longestText,
}: {
  waiting: readonly { movement: Movement; waitMinutes: number }[];
  nameOf: (movement: Movement) => string;
  over24h: number;
  over48h: number;
  onTheList: number;
  /** The card's waiting count as the desk shows it ("fewer than 5" on the executive desk). */
  waitingText: number | string;
  /** The executive desk: keep the card and its title, leave the people out. */
  countsOnly: boolean;
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
      sort === "name"
        ? a.movement.urgency - b.movement.urgency || b.waitMinutes - a.waitMinutes
        : b.waitMinutes - a.waitMinutes,
    );
  const max = Math.max(VERY_LONG_WAIT_MINUTES, ...waiting.map((entry) => entry.waitMinutes));

  return (
    <StatCard
      icon={Clock}
      title="Open ED journeys"
      aside={onTheList === 0 ? undefined : `${waitingText} open ED journeys`}
      id="ed-waiting"
      data-testid="ward-statistics-ed-wait"
    >
      {onTheList === 0 ? (
        <CardBody>
          <p className={styles.muted} data-testid="ward-stat-ed-wait-empty">
            Nobody from this department has an open ED journey
          </p>
        </CardBody>
      ) : countsOnly ? (
        <CardBody>
          <PeopleNotListed testId="ward-statistics-ed-wait-not-listed" />
        </CardBody>
      ) : (
        <div className={ed.waitBody}>
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
                  { id: "name", label: "Urgency" },
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
              Longest wait, {longestName.toLowerCase()}, {longestText} waiting.
            </p>
          </SrOnly>
          <div className={ed.waitChart} data-testid="ward-stat-ed-wait-chart" data-ward-primitive="wait-chart">
            <div className={cx(styles.tableWrap, ed.waitScroll)}>
              <table className={`${tableClasses.table} ${styles.table}`} data-testid="ward-stat-ed-wait-table">
                <caption className={styles.srOnly}>Open ED journeys from this department, synthetic</caption>
                <thead>
                  <tr>
                    <th scope="col">Urgency</th>
                    <th scope="col">Ward status</th>
                    <th scope="col">
                      <span className={styles.srOnly}>Elapsed against {veryLongHours} hours</span>
                    </th>
                    <th scope="col" className={styles.num}>
                      Time since opening
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
                          <span className={ed.who}>
                            <Link href={movementHref(movement.id)} className={styles.rowLink}>
                              {nameOf(movement)}
                            </Link>
                          </span>
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
        </div>
      )}
    </StatCard>
  );
}
