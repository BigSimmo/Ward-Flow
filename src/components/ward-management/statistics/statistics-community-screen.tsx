"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, ChevronDown, FileText, LayoutList, PhoneCall, Search, Users } from "lucide-react";

import {
  BarList,
  Button,
  CardBody,
  CardFoot,
  HeroStat,
  Icon,
  Menu,
  Meter,
  PhoneListRow,
  Segmented,
  SrOnly,
  StatusGlyph,
  TextInput,
  buttonClass,
  tableClasses,
  useIsPhone,
} from "@/components/wf";
import { useCanOpenHref, useStatisticsCounts } from "@/components/ward-management/shell/ward-access";
import { MINUTES_PER_DAY, formatSheetMoment } from "@/components/ward-management/ward-clock";
import type { Admission } from "@/components/ward-management/ward-admissions";
import {
  admissionsWithNoCommunityTeam,
  communityHubLists,
  communityMembershipResolution,
  communityTeamById,
  COMMUNITY_TEAM_PAGES,
  type CommunityTeam,
} from "@/components/ward-management/community/community-derivations";
import { communityStatisticsHref, communityTeamHref } from "@/components/ward-management/shell/ward-facade";
import {
  statisticsSectionById,
  STATISTICS_COMMUNITY_CHOOSER_HREF,
  STATISTICS_TEAMS_HREF,
} from "@/components/ward-management/statistics/statistics-sections";

import { figureText as operationalFigureText, type StatisticsFigure } from "./statistics-absence";
import {
  ExecutiveStatisticsUnavailable,
  statisticsCountText,
  exactStatisticsCount,
  type StatisticsCount,
  PeopleNotListed,
  withheldBar,
} from "./statistics-small-numbers";
import { countAxisMax } from "./statistics-axis";
import { communityFigures, type CommunityFigures } from "./statistics-community-figures";
import { downloadCsv } from "./statistics-csv";
import { dateOf, fromToday, isPastDate } from "./statistics-dates";
import { StatCard, StatisticsPage, useStatisticsLive } from "./statistics-hero";
import { HeroTool, UnitStepper } from "./statistics-hero-tools";
import { FlushRow, FlushStack, Follow } from "./statistics-layout";
import { useOptionalRouter } from "./statistics-nav";
import { PhoneBody, PhoneFacts, PhoneGroup, PhoneList, phoneBodyStyles as phone } from "./statistics-phone-parts";
import styles from "./statistics-v6.module.css";
import detail from "./statistics-detail.module.css";

import { useExecutiveStatistics, useExecutiveStatisticsControl } from "./executive-statistics-context";
import { useEffectiveWardAccess } from "../shell/ward-access-store";
import type { ExecutiveReportingFoundation } from "./executive-statistics-contract";

type CountFigure = { kind: "measured"; value: StatisticsCount } | Exclude<StatisticsFigure, { kind: "measured" }>;
type CountFigures = Record<keyof CommunityFigures, CountFigure>;
type CommunityModel = {
  team: CommunityTeam;
  openTeams: CommunityTeam[];
  allTeams: { team: CommunityTeam; figures: CountFigures }[];
  figures: CountFigures;
  noDischargeDate: CountFigure;
  dueOutWeek: CountFigure;
  pastDate: CountFigure;
  followUpArranged: CountFigure;
  notArranged: CountFigure;
  unseenCount: StatisticsCount;
  admissionCount: StatisticsCount;
  wholeNetwork: boolean;
  countsOnly: boolean;
  executive: boolean;
  now: number;
  dayZero: Date;
  paused: boolean;
  togglePause: (() => void) | null;
  scopeLabel?: string;
};
type CommunitySlots = { phone: ReactNode; followUp: ReactNode; dueOut: ReactNode };
const small = (count: StatisticsCount) => statisticsCountText(count);
const figureText = (figure: CountFigure) =>
  figure.kind === "measured" ? String(small(figure.value)) : operationalFigureText(figure);
const isUnmeasured = (figure: CountFigure) => figure.kind !== "measured";
const countText = (figure: CountFigure) => (figure.kind === "measured" ? small(figure.value) : figureText(figure));
const measuredValue = (figure: CountFigure) => (figure.kind === "measured" ? figure.value : null);
const positive = (count: StatisticsCount | null) => count !== null && exactStatisticsCount(count) !== 0;
type Availability = ExecutiveReportingFoundation["teams"][number]["figures"]["admitted"];
const publicFigure = (figure: Availability): CountFigure =>
  figure.kind === "measured" ? { kind: "measured", value: figure.count } : figure;
const publicFigures = (figures: ExecutiveReportingFoundation["teams"][number]["figures"]): CountFigures => ({
  admitted: publicFigure(figures.admitted),
  expected: publicFigure(figures.expected),
  discharged: publicFigure(figures.discharged),
  other: publicFigure(figures.other),
});
export function StatisticsCommunityScreen({ teamId }: { teamId: string }) {
  const control = useExecutiveStatisticsControl(),
    access = useEffectiveWardAccess();
  return control.executive || access.role === "executive" ? (
    <ExecutiveCommunityScreen teamId={teamId} />
  ) : (
    <OperationalCommunityScreen teamId={teamId} />
  );
}
function ExecutiveCommunityScreen({ teamId }: { teamId: string }) {
  const data = useExecutiveStatistics(),
    control = useExecutiveStatisticsControl();
  const selected = data?.teams.find((team) => team.id === teamId);
  const team = communityTeamById(teamId);
  if (!data || !selected || !team || !data.openableCommunityTeamIds.includes(teamId))
    return <ExecutiveStatisticsUnavailable />;
  const allowed = new Set(data.openableCommunityTeamIds);
  const openTeams = COMMUNITY_TEAM_PAGES.filter((candidate) => candidate.id === teamId || allowed.has(candidate.id));
  const model: CommunityModel = {
    team,
    openTeams,
    allTeams: openTeams.flatMap((candidate) => {
      const row = data.teams.find((row) => row.id === candidate.id);
      return row ? [{ team: candidate, figures: publicFigures(row.figures) }] : [];
    }),
    figures: publicFigures(selected.figures),
    noDischargeDate: publicFigure(selected.noDischargeDate),
    dueOutWeek: publicFigure(selected.dueOutWeek),
    pastDate: publicFigure(selected.pastDate),
    followUpArranged: publicFigure(selected.followUpArranged),
    notArranged: publicFigure(selected.followUpNotArranged),
    unseenCount: data.community.unlinkedAdmissions,
    admissionCount: data.community.admissionsRecorded,
    wholeNetwork: true,
    countsOnly: true,
    executive: true,
    now: data.network.asAt.now,
    dayZero: new Date(data.network.asAt.dayZero),
    paused: control.paused,
    togglePause: control.togglePause,
    scopeLabel: data.network.scope.kind === "service" ? data.network.scope.service : undefined,
  };
  return (
    <CommunityView
      model={model}
      slots={{
        phone: (
          <TeamPhone
            people={null}
            peopleCount={countText(model.figures.admitted)}
            peopleMeasured={!isUnmeasured(model.figures.admitted)}
            unitName={(id) => data.wards.find((ward) => ward.id === id)?.name ?? id}
            now={model.now}
            dayZero={model.dayZero}
            inBedText={figureText(model.figures.admitted)}
            inBedMeasured={!isUnmeasured(model.figures.admitted)}
            followUp={
              model.figures.discharged.kind !== "measured"
                ? { text: figureText(model.figures.discharged) }
                : {
                    discharged: countText(model.figures.discharged),
                    arranged: countText(model.followUpArranged),
                    notArranged: countText(model.notArranged),
                    flagged: positive(measuredValue(model.notArranged)),
                  }
            }
            dueOutText={countText(model.dueOutWeek)}
            pastDate={measuredValue(model.pastDate)}
            pastDateText={countText(model.pastDate)}
          />
        ),
        followUp: <PeopleNotListed testId="ward-statistics-community-follow-up-not-listed" />,
        dueOut: (
          <CardBody>
            <PeopleNotListed testId="ward-statistics-community-due-out-not-listed" />
          </CardBody>
        ),
      }}
    />
  );
}

/**
 * ONE COMMUNITY TEAM, IN FIGURES — and deliberately NOT a second copy of its operational page.
 *
 * 🔴 **`/ward-flow/community/[teamId]` ALREADY SHOWS THIS TEAM'S LISTS.** This page carries
 * COUNTS and a CROSS-TEAM COMPARISON — the question the operational hub cannot answer, because it
 * only ever shows one team — and links to that hub for the work. The two short lists here (who is
 * due out, and follow-up for those discharged) are read from the same `communityHubLists`, never
 * re-derived.
 *
 * ⚠️ **A SLUG THAT RESOLVES TO NOTHING GETS A PAGE THAT SAYS SO.** `communityTeamById` returns `null`
 * rather than guessing, and this screen never falls back to a different team.
 *
 * ⚠️ **AN EMPTY TEAM IS NOT AUTOMATICALLY A MEASURED ABSENCE.** `communityMembershipResolution`
 * separates "we looked and found nobody" from "we cannot look at all", and every figure here,
 * including every row of the comparison, carries that state through `communityFigures`. An
 * unmeasured figure is left out of the bars and said in words, never drawn as a nought.
 *
 * ⚠️ **"With a discharge date" is a subset of the people holding a bed**, never a count over everyone
 * this team has had; the card says so.
 *
 * **Left out of the drawing:** the handover Sent/Not sent column and its Ask action, and the "seen
 * within 7 days" follow-up figure. The record keeps neither a handover message nor a contact date.
 */
function OperationalCommunityScreen({ teamId }: { teamId: string }) {
  const live = useStatisticsLive();
  const { countsOnly, small, parts } = useStatisticsCounts();
  // Role view (community clinician, D-80): the team's own page as counts.
  const ownTeamDesk = useEffectiveWardAccess().role === "community";
  const canOpen = useCanOpenHref();
  const { admissions, referrals, units } = live.state;
  const now = live.now;
  const { dayZero } = live.state;

  const section = statisticsSectionById("community");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'community' section");

  const team = communityTeamById(teamId);

  if (!team) {
    return (
      <StatisticsPage
        section={section}
        navSection="community"
        testId="ward-statistics-community-screen"
        title="Community team not found"
        eyebrowLabel="Community team"
        now={now}
        paused={live.paused}
        onTogglePause={live.togglePause}
      >
        <StatCard icon={Users} title="No such team">
          <CardBody className={styles.bodyStack}>
            <p data-testid="ward-statistics-community-unresolved">
              No community team has the address <code className={detail.code}>{teamId}</code>.
            </p>
            <p>
              <Link href={STATISTICS_COMMUNITY_CHOOSER_HREF} data-testid="ward-statistics-community-chooser-link">
                Choose a community team from the statistics hub
              </Link>{" "}
              to reach one that does exist.
            </p>
          </CardBody>
        </StatCard>
      </StatisticsPage>
    );
  }

  const lists = communityHubLists(admissions, team, referrals);
  const figures = communityFigures(lists, communityMembershipResolution(admissions, team, referrals));
  const unseen = admissionsWithNoCommunityTeam(admissions, referrals);
  // D-80: a team desk's copy holds only its own people, so other teams are left out rather than
  // shown as empty, and the network-wide coverage line goes with them.
  const openTeams = COMMUNITY_TEAM_PAGES.filter(
    (each) => each.id === team.id || canOpen(communityStatisticsHref(each.id)),
  );
  const wholeNetwork = canOpen(STATISTICS_TEAMS_HREF);
  const allTeams = openTeams.map((candidate) => ({
    team: candidate,
    figures: communityFigures(
      communityHubLists(admissions, candidate, referrals),
      communityMembershipResolution(admissions, candidate, referrals),
    ),
  }));
  const unitName = (unitId: string) => units.find((unit) => unit.id === unitId)?.name ?? unitId;
  const notArranged = lists.dischargedIntoTheArea.filter((admission) => admission.followUp?.state !== "arranged");
  const dueOut = [...lists.expectedBack].sort(
    (a, b) => (a.expectedDischargeAt ?? Number.POSITIVE_INFINITY) - (b.expectedDischargeAt ?? Number.POSITIVE_INFINITY),
  );

  // Still in a bed past the planned date: counted on their own so the 7-day count hides nobody.
  const pastDate = lists.expectedBack.filter(
    (admission) => admission.expectedDischargeAt !== null && isPastDate(admission.expectedDischargeAt, now),
  ).length;
  const dueOutWeek = lists.expectedBack.filter(
    (admission) =>
      admission.expectedDischargeAt !== null &&
      admission.expectedDischargeAt >= now &&
      admission.expectedDischargeAt < now + 7 * MINUTES_PER_DAY,
  ).length;
  const dueOutText = figures.expected.kind === "measured" ? small(dueOutWeek) : figureText(figures.expected);
  const pastDateText = figures.expected.kind === "measured" ? small(pastDate) : figureText(figures.expected);
  return (
    <CommunityView
      model={{
        team,
        openTeams,
        allTeams,
        figures,
        noDischargeDate:
          figures.admitted.kind === "measured" && figures.expected.kind === "measured"
            ? { kind: "measured", value: figures.admitted.value - figures.expected.value }
            : figures.expected,
        dueOutWeek: figures.expected.kind === "measured" ? { kind: "measured", value: dueOutWeek } : figures.expected,
        pastDate: figures.expected.kind === "measured" ? { kind: "measured", value: pastDate } : figures.expected,
        followUpArranged:
          figures.discharged.kind === "measured"
            ? { kind: "measured", value: lists.dischargedIntoTheArea.length - notArranged.length }
            : figures.discharged,
        notArranged:
          figures.discharged.kind === "measured" ? { kind: "measured", value: notArranged.length } : figures.discharged,
        unseenCount: unseen.length,
        admissionCount: admissions.length,
        wholeNetwork,
        countsOnly,
        executive: false,
        now,
        dayZero,
        paused: live.paused,
        togglePause: live.togglePause,
      }}
      slots={{
        phone: (
          <TeamPhone
            people={countsOnly ? null : lists.currentlyAdmitted}
            peopleCount={countText(figures.admitted)}
            peopleMeasured={figures.admitted.kind === "measured"}
            unitName={unitName}
            now={now}
            dayZero={dayZero}
            inBedText={figureText(figures.admitted)}
            inBedMeasured={figures.admitted.kind === "measured"}
            followUp={(() => {
              if (figures.discharged.kind !== "measured") return { text: figureText(figures.discharged) };
              // Arranged and not arranged add up to the discharged count beside them, so they hide together.
              const [arranged, notYet] = parts([
                lists.dischargedIntoTheArea.length - notArranged.length,
                notArranged.length,
              ]);
              return {
                discharged: small(lists.dischargedIntoTheArea.length),
                arranged: arranged!,
                notArranged: notYet!,
                flagged: notArranged.length > 0,
              };
            })()}
            dueOutText={dueOutText}
            pastDate={pastDate}
            pastDateText={pastDateText}
            otherText={figures.other.kind === "measured" ? small(figures.other.value) : figureText(figures.other)}
            noDateText={
              figures.admitted.kind === "measured" && figures.expected.kind === "measured"
                ? small(figures.admitted.value - figures.expected.value)
                : figureText(figures.expected)
            }
          />
        ),
        followUp: countsOnly ? (
          <PeopleNotListed testId="ward-statistics-community-follow-up-not-listed" />
        ) : lists.dischargedIntoTheArea.length === 0 ? (
          <p className={styles.muted}>
            {figures.discharged.kind === "measured"
              ? "Nobody has been discharged into this area"
              : figureText(figures.discharged)}
          </p>
        ) : (
          <ul className={detail.crossList}>
            {lists.dischargedIntoTheArea.map((admission) => (
              <li key={admission.id} className={detail.crossRow}>
                <span>
                  <span className={detail.primary}>{admission.id}</span>
                  <span className={detail.secondary}>
                    {unitName(admission.unitId)}
                    {admission.leftAt === null ? "" : `, left ${dateOf(admission.leftAt, dayZero)}`}
                  </span>
                </span>
                <span className={styles.flagged}>
                  {admission.followUp?.state === "arranged" ? (
                    <>
                      <StatusGlyph tone="success" size={9} />
                      Arranged
                    </>
                  ) : (
                    <>
                      <StatusGlyph tone="warning" size={9} />
                      {admission.followUp ? "Not arranged" : "Not recorded"}
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ),
        dueOut:
          countsOnly && ownTeamDesk ? (
            // Role view (community clinician): every figure the hero does not lead with, in one row of
            // tiles (the Statistics family's card figures). Discharged here, Left another way and No
            // follow-up yet moved here from the hero, so the follow-up measure sits in one place and
            // the hero keeps the two that lead.
            <CardBody className={styles.bodyStack}>
              <dl className={styles.tiles} aria-label="Coming back to the team">
                {[
                  { id: "due", label: "Due out within 7 days", value: dueOutText, flag: false },
                  { id: "past", label: "Past discharge date", value: pastDateText, flag: pastDate > 0 },
                  {
                    id: "nodate",
                    label: "No discharge date",
                    value:
                      figures.admitted.kind === "measured" && figures.expected.kind === "measured"
                        ? small(figures.admitted.value - figures.expected.value)
                        : figureText(figures.expected),
                    flag: false,
                  },
                  {
                    id: "discharged",
                    label: "Discharged here",
                    value:
                      figures.discharged.kind === "measured"
                        ? small(figures.discharged.value)
                        : figureText(figures.discharged),
                    flag: false,
                  },
                  {
                    id: "other",
                    label: "Left another way",
                    value: figures.other.kind === "measured" ? small(figures.other.value) : figureText(figures.other),
                    flag: false,
                  },
                  {
                    id: "nofollow",
                    label: "No follow-up yet",
                    value:
                      figures.discharged.kind === "measured"
                        ? small(notArranged.length)
                        : figureText(figures.discharged),
                    flag: figures.discharged.kind === "measured" && notArranged.length > 0,
                  },
                ].map((fact) => (
                  <div key={fact.id} className={styles.tile}>
                    <dt className={styles.tileLabel}>
                      {fact.flag ? <StatusGlyph tone="warning" size={9} /> : null}
                      {fact.label}
                    </dt>
                    <dd className={styles.tileValue}>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          ) : countsOnly ? (
            <CardBody>
              <PeopleNotListed testId="ward-statistics-community-due-out-not-listed" />
            </CardBody>
          ) : (
            <div className={styles.tableWrap}>
              <table className={`${tableClasses.table} ${styles.table}`}>
                <caption className={styles.srOnly}>Admissions referred to {team.name} with a discharge date</caption>
                <thead>
                  <tr>
                    <th scope="col">Admission</th>
                    <th scope="col">Ward</th>
                    <th scope="col">Discharge</th>
                  </tr>
                </thead>
                <tbody>
                  {dueOut.length === 0 ? (
                    <tr>
                      <td colSpan={3} className={styles.muted}>
                        {figures.expected.kind === "measured"
                          ? "Nobody in a bed has a discharge date written down"
                          : figureText(figures.expected)}
                      </td>
                    </tr>
                  ) : null}
                  {dueOut.map((admission) => (
                    <tr key={admission.id}>
                      <th scope="row">
                        <span className={detail.primary}>{admission.id}</span>
                      </th>
                      <td>{unitName(admission.unitId)}</td>
                      <td>
                        {admission.expectedDischargeAt === null ? (
                          <span className={styles.muted}>No date</span>
                        ) : (
                          <span className={styles.flagged}>
                            {isPastDate(admission.expectedDischargeAt, now) ? (
                              <StatusGlyph tone="warning" size={9} />
                            ) : null}
                            {dateOf(admission.expectedDischargeAt, dayZero)}{" "}
                            <span className={styles.muted}>
                              {fromToday(admission.expectedDischargeAt, now)}
                              {isPastDate(admission.expectedDischargeAt, now) ? ", past date" : ""}
                            </span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
      }}
    />
  );
}
function CommunityView({ model, slots }: { model: CommunityModel; slots: CommunitySlots }) {
  const {
    team,
    openTeams,
    allTeams,
    figures,
    noDischargeDate,
    dueOutWeek,
    notArranged,
    unseenCount,
    admissionCount,
    wholeNetwork,
    countsOnly,
    executive,
    now,
    dayZero,
    paused,
    togglePause,
    scopeLabel,
  } = model;
  const section = statisticsSectionById("community")!;
  const isPhone = useIsPhone();
  // Role view (community clinician, D-80): this desk sees its own team only, so no network-wide
  // wording and no one-row team comparison.
  const ownTeamDesk = useEffectiveWardAccess().role === "community";
  const inBedCount = measuredValue(figures.admitted);
  const phoneParts = { withDate: countText(figures.expected), noDate: countText(noDischargeDate) };
  const figureRows: { key: keyof CommunityFigures; label: string; figure: CountFigure }[] = [
    { key: "admitted", label: "In a bed, or with one pulled", figure: figures.admitted },
    { key: "expected", label: "With a discharge date", figure: figures.expected },
    { key: "discharged", label: "Discharged into the area", figure: figures.discharged },
    { key: "other", label: "Left the ward another way", figure: figures.other },
  ];
  const measuredMax = Math.max(
    1,
    ...figureRows.map((row) => (row.figure.kind === "measured" ? (exactStatisticsCount(row.figure.value) ?? 0) : 0)),
  );
  const dueOutText = countText(dueOutWeek);
  const notArrangedText = countText(notArranged);
  return (
    <StatisticsPage
      section={section}
      navSection="community"
      slug={team.id}
      testId="ward-statistics-community-screen"
      title={team.name}
      titleAction={
        openTeams.length > 1 ? (
          <>
            <ChangeTeam teams={openTeams} currentId={team.id} />
            <UnitStepper
              items={openTeams.map((each) => ({
                id: each.id,
                href: communityStatisticsHref(each.id),
                label: each.name,
              }))}
              currentId={team.id}
              noun="team"
            />
          </>
        ) : undefined
      }
      tools={
        wholeNetwork ? (
          <HeroTool
            href={STATISTICS_TEAMS_HREF}
            icon={<LayoutList size={14} aria-hidden="true" />}
            testId="ward-statistics-community-tool-teams"
          >
            All teams
          </HeroTool>
        ) : undefined
      }
      // Role view (community clinician): the eyebrow says where this is and that the desk reads
      // counts only, as on the ED desk; the card no longer repeats "Counts only".
      eyebrowLabel={ownTeamDesk ? "Statistics" : "Community team"}
      eyebrowDetail={
        ownTeamDesk ? (
          <span data-testid="ward-statistics-people-not-listed">
            Community team · Counts only<SrOnly>, so people are not listed</SrOnly>
          </span>
        ) : (
          <span>
            {COMMUNITY_TEAM_PAGES.length} teams in the network{scopeLabel ? " · " + scopeLabel : ""}
          </span>
        )
      }
      now={now}
      paused={paused}
      onTogglePause={togglePause ?? undefined}
      exportFigures={{
        stem: team.id,
        scope: team.name,
        figures: () => [
          ...figureRows.map(
            (row) =>
              [
                HERO_LABELS[row.key],
                row.figure.kind === "measured" ? small(row.figure.value) : figureText(row.figure),
              ] as const,
          ),
          ["No follow-up yet", notArrangedText],
        ],
      }}
      phone={{
        // Role view (community clinician): the due-out count sits in the card below, so not here too.
        sub: ownTeamDesk
          ? undefined
          : figures.expected.kind === "measured"
            ? `${dueOutText} due out in the next 7 days`
            : `Due out in the next 7 days: ${dueOutText}`,
        stats: (
          <>
            <HeroStat value={inBedCount === null ? figureText(figures.admitted) : small(inBedCount)} label="In a bed" />
            <HeroStat value={phoneParts.withDate} label="With a date" />
            {/* Role view (community clinician): No discharge date is in the card below. */}
            {ownTeamDesk ? null : <HeroStat value={phoneParts.noDate} label="No date" />}
          </>
        ),
      }}
      stats={
        <>
          {/* Role view (community clinician): the hero leads with In a bed and With a discharge date;
              the outcome counts are in the card, so three noughts no longer fill the header. */}
          {(ownTeamDesk ? figureRows.slice(0, 2) : figureRows).map((row) => (
            <HeroStat
              key={row.key}
              value={
                <span
                  data-testid={`ward-statistics-community-kpi-${row.key}`}
                  data-unmeasured={isUnmeasured(row.figure) || undefined}
                >
                  {row.figure.kind === "measured" ? small(row.figure.value) : figureText(row.figure)}
                </span>
              }
              label={
                ownTeamDesk && row.key === "admitted" ? (
                  <>
                    In a bed<SrOnly>, or with one pulled</SrOnly>
                  </>
                ) : (
                  HERO_LABELS[row.key]
                )
              }
            />
          ))}
          {ownTeamDesk ? null : (
            <HeroStat
              value={notArrangedText}
              label={
                <span className={styles.flagged}>
                  {figures.discharged.kind === "measured" && positive(measuredValue(notArranged)) ? (
                    <StatusGlyph tone="warning" size={9} />
                  ) : null}
                  No follow-up yet
                </span>
              }
            />
          )}
        </>
      }
    >
      {isPhone ? (
        slots.phone
      ) : ownTeamDesk ? (
        // Role view (community clinician): the hero already gives in a bed, with a date, discharged,
        // left another way and no follow-up, so the handover table and the follow-up card (which
        // repeated them) give way to one card of what is still to come back to the team.
        <StatCard
          id="due-out"
          className={detail.anchor}
          icon={CalendarClock}
          title="Coming back to the team"
          // Role view (community clinician): the way to the caseload sits in the card head, not
          // alone in a footer strip.
          action={
            <Link
              href={communityTeamHref(team)}
              className={buttonClass({ variant: "sec", size: "sm" })}
              data-testid="ward-statistics-community-operational-link"
            >
              Open caseload
            </Link>
          }
        >
          {slots.dueOut}
        </StatCard>
      ) : (
        <>
          <FlushRow layout="lead2">
            <Follow className={detail.followBody}>
              <TeamComparison
                current={team}
                rows={allTeams}
                countsOnly={countsOnly}
                asAt={formatSheetMoment(now, dayZero, { includeYearAndZone: true })}
              />
            </Follow>
            <FlushStack>
              <StatCard
                id="handover"
                icon={FileText}
                title="Community handover"
                aside="Current snapshot"
                data-testid="statistics-community-handover-chart"
              >
                <div className={styles.tableWrap}>
                  <table
                    className={`${tableClasses.table} ${styles.table}`}
                    data-testid="ward-statistics-community-figures-table"
                  >
                    <caption className={styles.srOnly}>Community handover figures for {team.name}, synthetic</caption>
                    <thead>
                      <tr>
                        <th scope="col">Figure</th>
                        <th scope="col">
                          <span className={styles.srOnly}>Bar</span>
                        </th>
                        <th scope="col" className={styles.num}>
                          People
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {figureRows.map((row) => (
                        <tr key={row.key} data-testid={`ward-statistics-community-row-${row.key}`}>
                          <th scope="row">{row.label}</th>
                          <td className={detail.meterCell}>
                            {row.figure.kind === "measured" &&
                            (exactStatisticsCount(row.figure.value) ?? 0) > 0 &&
                            typeof small(row.figure.value) === "number" ? (
                              <Meter
                                value={exactStatisticsCount(row.figure.value) ?? 0}
                                max={measuredMax}
                                fill="data-1"
                                label={row.label}
                                valueText={null}
                              />
                            ) : null}
                          </td>
                          <td
                            className={row.figure.kind === "measured" ? styles.num : `${styles.num} ${styles.muted}`}
                            data-testid={`ward-statistics-community-value-${row.key}`}
                            data-unmeasured={isUnmeasured(row.figure) || undefined}
                          >
                            {row.figure.kind === "measured" ? small(row.figure.value) : figureText(row.figure)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <SrOnly>
                  <p
                    data-testid="ward-statistics-community-in-hospital-count"
                    data-unmeasured={isUnmeasured(figures.admitted) || undefined}
                  >
                    {countText(figures.admitted)} referred to this team and in a bed, or with one pulled, now.
                  </p>
                  <p
                    data-testid="ward-statistics-community-in-hospital-with-date"
                    data-unmeasured={isUnmeasured(figures.expected) || undefined}
                  >
                    {countText(figures.expected)} of those have a discharge date written down.
                  </p>
                  <p
                    data-testid="ward-statistics-community-hospital-discharges-count"
                    data-unmeasured={isUnmeasured(figures.discharged) || undefined}
                  >
                    {countText(figures.discharged)} discharged into the area this team serves.
                  </p>
                  <p
                    data-testid="ward-statistics-community-other-departures-count"
                    data-unmeasured={isUnmeasured(figures.other) || undefined}
                  >
                    {countText(figures.other)} left a ward another way.
                  </p>
                </SrOnly>
                <CardFoot meta="Discharge dates are a subset of people in a bed or with one pulled">
                  {executive ? null : (
                    <Link
                      href={communityTeamHref(team)}
                      className={buttonClass({ variant: "sec", size: "sm" })}
                      data-testid="ward-statistics-community-operational-link"
                    >
                      Open caseload
                    </Link>
                  )}
                </CardFoot>
              </StatCard>

              <StatCard id="follow-up" icon={PhoneCall} title="Follow-up" aside="Discharged here">
                <CardBody className={styles.bodyStack}>{slots.followUp}</CardBody>
                <CardFoot
                  meta={
                    wholeNetwork
                      ? `${small(unseenCount)} of ${small(admissionCount)} admissions have no community team`
                      : undefined
                  }
                >
                  {wholeNetwork ? (
                    <span data-testid="ward-statistics-community-unseen" className={styles.srOnly}>
                      {small(unseenCount)} of {small(admissionCount)} admissions without a community team
                    </span>
                  ) : null}
                  {executive ? null : (
                    <Link
                      href={communityTeamHref(team)}
                      className={styles.footLink}
                      data-testid="ward-statistics-community-coverage-link"
                    >
                      Open {team.name}
                    </Link>
                  )}
                </CardFoot>
              </StatCard>
            </FlushStack>
          </FlushRow>

          <StatCard
            id="due-out"
            className={detail.anchor}
            icon={CalendarClock}
            title="Due out to this team"
            aside="With a discharge date"
          >
            {slots.dueOut}
          </StatCard>
        </>
      )}
    </StatisticsPage>
  );
}

/**
 * One community team on a phone (v10 phone): the people referred to this team who hold a bed now,
 * soonest discharge first, then the follow-up figures for those discharged into its area.
 */
function TeamPhone({
  people,
  peopleCount,
  peopleMeasured,
  unitName,
  now,
  dayZero,
  inBedText,
  inBedMeasured,
  followUp,
  dueOutText,
  pastDate,
  pastDateText,
  otherText,
  noDateText,
}: {
  /** Null on the executive desk, where people are not listed. */
  people: readonly Admission[] | null;
  peopleCount: number | string;
  /** False when the team cannot be linked, so the count is its words, never a nought. */
  peopleMeasured: boolean;
  unitName: (unitId: string) => string;
  now: number;
  dayZero: Date;
  inBedText: string;
  inBedMeasured: boolean;
  /** The figures, or the words for an unmeasured follow-up count. */
  followUp:
    | { discharged: number | string; arranged: number | string; notArranged: number | string; flagged: boolean }
    | { text: string };
  dueOutText: number | string;
  pastDate: StatisticsCount | null;
  pastDateText: number | string;
  /** Role view (community clinician): Left another way and No discharge date, for the one card. */
  otherText?: number | string;
  noDateText?: number | string;
}) {
  // Role view (community clinician): the hero's In a bed figure is the handover count, so the group
  // that would only say "people are not listed" is left out.
  const ownTeamDesk = useEffectiveWardAccess().role === "community";
  const sorted = [...(people ?? [])].sort(
    (a, b) => (a.expectedDischargeAt ?? Number.POSITIVE_INFINITY) - (b.expectedDischargeAt ?? Number.POSITIVE_INFINITY),
  );
  return (
    <PhoneBody testId="ward-statistics-community-phone">
      {ownTeamDesk && people === null ? null : (
        <PhoneGroup
          title="Community handover"
          aside={peopleMeasured ? `${peopleCount} ${peopleCount === 1 ? "person" : "people"}` : String(peopleCount)}
        >
          {people === null ? (
            <PeopleNotListed testId="ward-statistics-community-phone-not-listed" />
          ) : sorted.length === 0 ? (
            <p className={phone.note}>
              {inBedMeasured
                ? "Nobody referred to this team is in a bed or has one pulled now."
                : `In a bed: ${inBedText}`}
            </p>
          ) : (
            <PhoneList label="Referred to this team, in a bed now">
              {sorted.map((admission) => {
                const days =
                  admission.arrivedAt === null || admission.arrivedAt > now
                    ? null
                    : Math.floor((now - admission.arrivedAt) / MINUTES_PER_DAY);
                return (
                  <PhoneListRow
                    key={admission.id}
                    as="li"
                    name={admission.id}
                    meta={
                      admission.expectedDischargeAt !== null && isPastDate(admission.expectedDischargeAt, now)
                        ? `${unitName(admission.unitId)} · past date`
                        : unitName(admission.unitId)
                    }
                    value={
                      days === null ? (
                        "none"
                      ) : (
                        <>
                          {days} <small className={phone.unit}>d</small>
                        </>
                      )
                    }
                    time={
                      admission.expectedDischargeAt === null ? (
                        "no date"
                      ) : isPastDate(admission.expectedDischargeAt, now) ? (
                        <span className={phone.flagged}>
                          <StatusGlyph tone="warning" size={9} />
                          {dateOf(admission.expectedDischargeAt, dayZero)}
                        </span>
                      ) : (
                        dateOf(admission.expectedDischargeAt, dayZero)
                      )
                    }
                  />
                );
              })}
            </PhoneList>
          )}
        </PhoneGroup>
      )}
      {/* Role view (community clinician): the same name as the desktop card. */}
      {/* Role view (community clinician): the desktop card's six figures in its order; "Counts only"
          is in the eyebrow. */}
      <PhoneGroup
        title={ownTeamDesk ? "Coming back to the team" : "Follow-up"}
        aside={ownTeamDesk ? undefined : "discharged here"}
      >
        {ownTeamDesk ? (
          <PhoneFacts
            label="Coming back to the team"
            facts={[
              { id: "due", label: "Due out within 7 days", value: dueOutText },
              {
                id: "past",
                label: (
                  <>
                    {positive(pastDate) ? <StatusGlyph tone="warning" size={9} /> : null}
                    Past discharge date
                  </>
                ),
                value: pastDateText,
                testId: "ward-statistics-community-past-date",
              },
              { id: "nodate", label: "No discharge date", value: noDateText ?? "" },
              {
                id: "discharged",
                label: "Discharged here",
                value: "text" in followUp ? followUp.text : followUp.discharged,
              },
              { id: "other", label: "Left another way", value: otherText ?? "" },
              {
                id: "not",
                label: (
                  <>
                    {"flagged" in followUp && followUp.flagged ? <StatusGlyph tone="warning" size={9} /> : null}
                    No follow-up yet
                  </>
                ),
                value: "text" in followUp ? followUp.text : followUp.notArranged,
              },
            ]}
          />
        ) : (
          <PhoneFacts
            label="Follow-up for people discharged into this area"
            facts={[
              {
                id: "discharged",
                label: "Discharged here",
                value: "text" in followUp ? followUp.text : followUp.discharged,
              },
              {
                id: "arranged",
                label: "Follow-up arranged",
                value: "text" in followUp ? followUp.text : followUp.arranged,
              },
              {
                id: "not",
                label: (
                  <>
                    {"flagged" in followUp && followUp.flagged ? <StatusGlyph tone="warning" size={9} /> : null}
                    No follow-up yet
                  </>
                ),
                value: "text" in followUp ? followUp.text : followUp.notArranged,
              },
              { id: "due", label: "Due out within 7 days", value: dueOutText },
              {
                id: "past",
                label: (
                  <>
                    {positive(pastDate) ? <StatusGlyph tone="warning" size={9} /> : null}
                    Past date
                  </>
                ),
                value: pastDateText,
                testId: "ward-statistics-community-past-date",
              },
            ]}
          />
        )}
      </PhoneGroup>
    </PhoneBody>
  );
}

const HERO_LABELS: Record<keyof CommunityFigures, string> = {
  admitted: "In a bed, or with one pulled",
  expected: "With a discharge date",
  discharged: "Discharged here",
  other: "Left another way",
};

function ChangeTeam({ teams, currentId }: { teams: readonly CommunityTeam[]; currentId: string }) {
  const router = useOptionalRouter();
  return (
    <Menu
      label="Change team"
      items={teams.map((each) => ({
        id: each.id,
        label: each.name,
        disabled: each.id === currentId,
        onSelect: () => {
          const href = communityStatisticsHref(each.id);
          if (router) router.push(href);
          else window.location.assign(href);
        },
      }))}
      trigger={(props) => (
        <button {...props} type="button" className={buttonClass({ variant: "onHero", size: "sm" })}>
          Change team
          <Icon icon={ChevronDown} size={14} />
        </button>
      )}
    />
  );
}

type Measure = keyof CommunityFigures;
const MEASURES: { id: Measure; label: string; chart: string }[] = [
  { id: "admitted", label: "In beds", chart: "People in a bed or with one pulled, by team" },
  { id: "expected", label: "With date", chart: "People with a discharge date, by team" },
  { id: "discharged", label: "Discharged", chart: "People discharged into the area, by team" },
  { id: "other", label: "Left", chart: "People who left the ward another way, by team" },
];
const TOP = 12;

function TeamComparison({
  current,
  rows,
  asAt,
  countsOnly,
}: {
  current: CommunityTeam;
  rows: { team: CommunityTeam; figures: CountFigures }[];
  asAt: string;
  countsOnly: boolean;
}) {
  const [view, setView] = useState<"chart" | "data">("chart");
  const [measure, setMeasure] = useState<Measure>("admitted");
  const [sort, setSort] = useState<"highest" | "name">("highest");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const needle = query.trim().toLowerCase();
  const matching = rows.filter((row) => !needle || row.team.name.toLowerCase().includes(needle));
  const measured = matching.filter((row) => row.figures[measure].kind === "measured");
  const valueOf = (row: { figures: CountFigures }) => {
    const figure = row.figures[measure];
    return figure.kind === "measured" ? figure.value : 0;
  };
  const shownOf = (row: { figures: CountFigures }) => small(valueOf(row));
  // Protected counts sort after exact counts, alphabetically, without a hidden numeric rank.
  const sortValue = (row: { figures: CountFigures }) => exactStatisticsCount(valueOf(row));
  const cellText = (figure: CountFigure) => (figure.kind === "measured" ? small(figure.value) : figureText(figure));
  const sorted = [...measured].sort((a, b) =>
    sort === "name"
      ? a.team.name.localeCompare(b.team.name)
      : (() => {
          const x = sortValue(a),
            y = sortValue(b);
          return x === null
            ? y === null
              ? a.team.name.localeCompare(b.team.name)
              : 1
            : y === null
              ? -1
              : y - x || a.team.name.localeCompare(b.team.name);
        })(),
  );
  // A team with nobody on this measure folds into the footer count until Show all (UX audit 21 Oct
  // 2026): the top twelve used to be one bar and eleven noughts.
  const withSome = sorted.filter((row) => positive(valueOf(row)));
  const zeroTeams = sorted.length - withSome.length;
  const shown = showAll || needle ? sorted : withSome.slice(0, TOP);
  const unlinked = matching.length - measured.length;
  // The mean would give a hidden team's count back by subtraction, so the executive desk has none.
  const mean =
    measured.length === 0 || countsOnly
      ? undefined
      : measured.reduce((sum, row) => sum + (exactStatisticsCount(valueOf(row)) ?? 0), 0) / measured.length;
  const chart = MEASURES.find((entry) => entry.id === measure)!;

  function exportCsv() {
    const lines = [
      ["Team", "In a bed", "With a discharge date", "Discharged into the area", "Left another way"],
      ...matching.map((row) => [
        row.team.name,
        String(cellText(row.figures.admitted)),
        String(cellText(row.figures.expected)),
        String(cellText(row.figures.discharged)),
        String(cellText(row.figures.other)),
      ]),
    ];
    downloadCsv("ward-flow-synthetic-community-teams.csv", lines, {
      asAt,
      scope: `Team comparison from ${current.name}; matching teams`,
    });
  }

  return (
    <StatCard
      id="comparison"
      icon={Users}
      title="Team comparison"
      action={
        <Segmented
          label="Team comparison view"
          value={view}
          onChange={setView}
          items={[
            { id: "chart", label: "Chart" },
            { id: "data", label: "Data" },
          ]}
        />
      }
      data-testid="ward-statistics-community-comparison"
    >
      <div className={styles.toolbar}>
        <Segmented
          label="Team comparison measure"
          value={measure}
          onChange={setMeasure}
          items={MEASURES.map((entry) => ({ id: entry.id, label: entry.label }))}
        />
        <Segmented
          label="Sort teams"
          value={sort}
          onChange={setSort}
          items={[
            { id: "highest", label: "Highest" },
            { id: "name", label: "A to Z" },
          ]}
        />
        <TextInput
          type="search"
          icon={Search}
          boxClassName={styles.search}
          aria-label="Search Team comparison"
          placeholder="Find a team"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {view === "chart" ? (
        <CardBody
          className={`${styles.bodyStack} ${detail.scrolls}`}
          tabIndex={0}
          role="region"
          aria-label="Team comparison chart"
          data-testid="statistics-community-comparison-chart"
        >
          {shown.length === 0 ? (
            <p className={styles.muted}>{needle ? "No team matches" : `No team has anyone on this measure`}</p>
          ) : (
            <BarList
              label={chart.chart}
              axis
              max={countAxisMax(shown.map((row) => sortValue(row) ?? 0))}
              mean={mean}
              meanLabel="Mean per team"
              labelWidth="12rem"
              rows={shown.map((row) => ({
                id: row.team.id,
                label: row.team.name,
                sub: row.team.id === current.id ? "this team" : undefined,
                ...withheldBar(exactStatisticsCount(valueOf(row)) ?? 0, shownOf(row)),
                display: String(shownOf(row)),
              }))}
            />
          )}
          {/*
           * The bar labels sit inside the chart's drawing, which is hidden from assistive technology,
           * so a link there could be tabbed to but never named. A search names the teams a reader
           * is after, so their pages are offered here as real links; the Data view links every team.
           */}
          {needle && shown.length > 0 ? (
            <ul className={detail.teamLinks} aria-label="Open a team's statistics">
              {shown.map((row) => (
                <li key={row.team.id}>
                  <Link href={communityStatisticsHref(row.team.id)} className={styles.rowLink}>
                    {row.team.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {unlinked > 0 ? (
            <p className={detail.note}>
              {unlinked} {unlinked === 1 ? "team is" : "teams are"} not linked, so left out of the bars
            </p>
          ) : null}
        </CardBody>
      ) : (
        <div
          className={`${styles.tableWrap} ${detail.scrolls}`}
          tabIndex={0}
          role="region"
          aria-label="Team comparison table"
        >
          <table
            className={`${tableClasses.table} ${styles.table}`}
            data-testid="ward-statistics-community-comparison-table"
          >
            <caption className={styles.srOnly}>Every community team&apos;s figures, synthetic</caption>
            <thead>
              <tr>
                <th scope="col">Team</th>
                <th scope="col" className={styles.num}>
                  In a bed
                </th>
                <th scope="col" className={styles.num}>
                  With date
                </th>
                <th scope="col" className={styles.num}>
                  Discharged
                </th>
                <th scope="col" className={styles.num}>
                  Left
                </th>
              </tr>
            </thead>
            <tbody>
              {matching.map((row) => (
                <tr
                  key={row.team.id}
                  data-testid={`ward-statistics-community-compare-row-${row.team.id}`}
                  aria-current={row.team.id === current.id ? "true" : undefined}
                  className={row.team.id === current.id ? detail.currentRow : undefined}
                >
                  <th scope="row">
                    {row.team.id === current.id ? (
                      <span data-testid="ward-statistics-community-compare-self">{row.team.name}</span>
                    ) : (
                      <Link href={communityStatisticsHref(row.team.id)} className={styles.rowLink}>
                        {row.team.name}
                      </Link>
                    )}
                  </th>
                  {(["admitted", "expected", "discharged", "other"] as const).map((key) => (
                    <td
                      key={key}
                      className={isUnmeasured(row.figures[key]) ? `${styles.num} ${styles.muted}` : styles.num}
                      data-unmeasured={isUnmeasured(row.figures[key]) || undefined}
                    >
                      {cellText(row.figures[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <CardFoot
        meta={
          view === "chart" ? (
            <>
              Showing <b>{shown.length}</b> of {measured.length} teams
              {!showAll && !needle && zeroTeams > 0 ? `, ${zeroTeams} with none` : ""}
            </>
          ) : (
            <>
              <b>{matching.length}</b> of {rows.length} teams
            </>
          )
        }
      >
        {view === "chart" && !needle && (showAll || sorted.length > shown.length) ? (
          <Button size="sm" variant="ghost" onClick={() => setShowAll((value) => !value)}>
            {showAll ? "Show fewer" : `Show all ${sorted.length}`}
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={exportCsv}>
          CSV
        </Button>
      </CardFoot>
    </StatCard>
  );
}
