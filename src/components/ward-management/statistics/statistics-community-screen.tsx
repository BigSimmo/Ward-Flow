"use client";

import { downloadBlob } from "@/lib/download-blob";

import { useState } from "react";
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
import { useStatisticsCounts } from "@/components/ward-management/shell/ward-access";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
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
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";

import { figureText, isUnmeasured, type StatisticsFigure } from "./statistics-absence";
import { PeopleNotListed, withheldBar } from "./statistics-small-numbers";
import { countAxisMax } from "./statistics-axis";
import { communityFigures, type CommunityFigures } from "./statistics-community-figures";
import { csvCell } from "./statistics-csv";
import { dateOf, fromToday, isPastDate } from "./statistics-dates";
import { StatCard, StatisticsPage, useStatisticsLive } from "./statistics-hero";
import { HeroTool, UnitStepper } from "./statistics-hero-tools";
import { FlushRow, FlushStack, Follow } from "./statistics-layout";
import { useOptionalRouter } from "./statistics-nav";
import { PhoneBody, PhoneFacts, PhoneGroup, PhoneList, phoneBodyStyles as phone } from "./statistics-phone-parts";
import styles from "./statistics-v6.module.css";
import detail from "./statistics-detail.module.css";

/**
 * ONE COMMUNITY TEAM, IN FIGURES — and deliberately NOT a second copy of its operational page.
 *
 * 🔴 **`/mockups/ward-flow/community/[teamId]` ALREADY SHOWS THIS TEAM'S LISTS.** This page carries
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
export function StatisticsCommunityScreen({ teamId }: { teamId: string }) {
  const live = useStatisticsLive();
  const { countsOnly, small, parts } = useStatisticsCounts();
  const { admissions, referrals, units } = live.state;
  const now = live.now;
  const { dayZero } = useWardFlowSelect("dayZero");
  const isPhone = useIsPhone();

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
              No community team in this prototype has the address <code className={detail.code}>{teamId}</code>. The
              teams here are exactly those the referral form can name — {COMMUNITY_TEAM_PAGES.length} of them — so a
              team that exists in the real world and not in that list has no page. This page never falls back to a
              different team, because a page showing one team&apos;s patients under another team&apos;s name is worse
              than a page showing nothing.
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
  const allTeams = COMMUNITY_TEAM_PAGES.map((candidate) => ({
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
  const measuredValue = (figure: StatisticsFigure) => (figure.kind === "measured" ? figure.value : null);
  const inBedCount = measuredValue(figures.admitted);
  const withDateCount = measuredValue(figures.expected);
  // The two parts add up to the bed count, so they are hidden together, or a hidden one could be
  // worked back from the total (reviews on PR #345 and #354).
  const phoneParts = (() => {
    if (inBedCount === null || withDateCount === null) {
      return { withDate: figureText(figures.expected), noDate: figureText(figures.expected) };
    }
    const [withDate, noDate] = parts([withDateCount, inBedCount - withDateCount]);
    return { withDate: withDate!, noDate: noDate! };
  })();

  const figureRows: { key: keyof CommunityFigures; label: string; figure: StatisticsFigure }[] = [
    { key: "admitted", label: "In a bed, or holding one", figure: figures.admitted },
    { key: "expected", label: "With a discharge date", figure: figures.expected },
    { key: "discharged", label: "Discharged into the area", figure: figures.discharged },
    { key: "other", label: "Left the ward another way", figure: figures.other },
  ];
  const measuredMax = Math.max(1, ...figureRows.map((row) => (row.figure.kind === "measured" ? row.figure.value : 0)));
  // The due out and past date counts read the "with a discharge date" list, so when that figure is
  // not measured they take its words, never a nought counted from an empty list.
  const dueOutText = figures.expected.kind === "measured" ? small(dueOutWeek) : figureText(figures.expected);
  const pastDateText = figures.expected.kind === "measured" ? small(pastDate) : figureText(figures.expected);
  const countText = (figure: StatisticsFigure) =>
    figure.kind === "measured" ? small(figure.value) : figureText(figure);
  const notArrangedText =
    figures.discharged.kind === "measured" ? small(notArranged.length) : figureText(figures.discharged);

  return (
    <StatisticsPage
      section={section}
      navSection="community"
      slug={team.id}
      testId="ward-statistics-community-screen"
      title={team.name}
      titleAction={
        <>
          <ChangeTeam currentId={team.id} />
          <UnitStepper
            items={COMMUNITY_TEAM_PAGES.map((each) => ({
              id: each.id,
              href: communityStatisticsHref(each.id),
              label: each.name,
            }))}
            currentId={team.id}
            noun="team"
          />
        </>
      }
      tools={
        <HeroTool
          href={STATISTICS_TEAMS_HREF}
          icon={<LayoutList size={14} aria-hidden="true" />}
          testId="ward-statistics-community-tool-teams"
        >
          All teams
        </HeroTool>
      }
      eyebrowLabel="Community team"
      eyebrowDetail={<span>{COMMUNITY_TEAM_PAGES.length} teams in the network</span>}
      now={now}
      paused={live.paused}
      onTogglePause={live.togglePause}
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
        sub:
          figures.expected.kind === "measured"
            ? `${dueOutText} due out in the next 7 days`
            : `Due out in the next 7 days: ${dueOutText}`,
        stats: (
          <>
            <HeroStat value={inBedCount === null ? figureText(figures.admitted) : small(inBedCount)} label="In a bed" />
            <HeroStat value={phoneParts.withDate} label="With a date" />
            <HeroStat value={phoneParts.noDate} label="No date" />
          </>
        ),
      }}
      stats={
        <>
          {figureRows.map((row) => (
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
              label={HERO_LABELS[row.key]}
            />
          ))}
          <HeroStat
            value={notArrangedText}
            label={
              <span className={styles.flagged}>
                {figures.discharged.kind === "measured" && notArranged.length > 0 ? (
                  <StatusGlyph tone="warning" size={9} />
                ) : null}
                No follow-up yet
              </span>
            }
          />
        </>
      }
    >
      {isPhone ? (
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
        />
      ) : (
        <>
          <FlushRow layout="lead2">
            <Follow className={detail.followBody}>
              <TeamComparison current={team} rows={allTeams} />
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
                            {row.figure.kind === "measured" && typeof small(row.figure.value) === "number" ? (
                              <Meter
                                value={row.figure.value}
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
                    {countText(figures.admitted)} referred to this team and occupying or holding a bed now.
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
                <CardFoot meta="Discharge dates are a subset of people holding a bed">
                  <Link
                    href={communityTeamHref(team)}
                    className={buttonClass({ variant: "sec", size: "sm" })}
                    data-testid="ward-statistics-community-operational-link"
                  >
                    Open caseload
                  </Link>
                </CardFoot>
              </StatCard>

              <StatCard id="follow-up" icon={PhoneCall} title="Follow-up" aside="Discharged here">
                <CardBody className={styles.bodyStack}>
                  {countsOnly ? (
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
                  )}
                </CardBody>
                <CardFoot
                  meta={`${small(unseen.length)} of ${small(admissions.length)} admissions have no community team`}
                >
                  <span data-testid="ward-statistics-community-unseen" className={styles.srOnly}>
                    {small(unseen.length)} of {small(admissions.length)} admissions without a community team
                  </span>
                  <Link
                    href={communityTeamHref(team)}
                    className={styles.footLink}
                    data-testid="ward-statistics-community-coverage-link"
                  >
                    Open {team.name}
                  </Link>
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
            {countsOnly ? (
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
            )}
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
  pastDate: number;
  pastDateText: number | string;
}) {
  const sorted = [...(people ?? [])].sort(
    (a, b) => (a.expectedDischargeAt ?? Number.POSITIVE_INFINITY) - (b.expectedDischargeAt ?? Number.POSITIVE_INFINITY),
  );
  return (
    <PhoneBody testId="ward-statistics-community-phone">
      <PhoneGroup
        title="Community handover"
        aside={peopleMeasured ? `${peopleCount} ${peopleCount === 1 ? "person" : "people"}` : String(peopleCount)}
      >
        {people === null ? (
          <PeopleNotListed testId="ward-statistics-community-phone-not-listed" />
        ) : sorted.length === 0 ? (
          <p className={phone.note}>
            {inBedMeasured ? "Nobody referred to this team holds a bed now." : `In a bed: ${inBedText}`}
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
      <PhoneGroup title="Follow-up" aside="discharged here">
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
                  {pastDate > 0 ? <StatusGlyph tone="warning" size={9} /> : null}
                  Past date
                </>
              ),
              value: pastDateText,
              testId: "ward-statistics-community-past-date",
            },
          ]}
        />
      </PhoneGroup>
    </PhoneBody>
  );
}

const HERO_LABELS: Record<keyof CommunityFigures, string> = {
  admitted: "In a bed or holding",
  expected: "With a discharge date",
  discharged: "Discharged here",
  other: "Left another way",
};

function ChangeTeam({ currentId }: { currentId: string }) {
  const router = useOptionalRouter();
  return (
    <Menu
      label="Change team"
      items={COMMUNITY_TEAM_PAGES.map((each) => ({
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
  { id: "admitted", label: "In beds", chart: "People in a bed or holding one, by team" },
  { id: "expected", label: "With date", chart: "People with a discharge date, by team" },
  { id: "discharged", label: "Discharged", chart: "People discharged into the area, by team" },
  { id: "other", label: "Left", chart: "People who left the ward another way, by team" },
];
const TOP = 12;

function TeamComparison({
  current,
  rows,
}: {
  current: CommunityTeam;
  rows: { team: CommunityTeam; figures: CommunityFigures }[];
}) {
  const [view, setView] = useState<"chart" | "data">("chart");
  const [measure, setMeasure] = useState<Measure>("admitted");
  const [sort, setSort] = useState<"highest" | "name">("highest");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const { countsOnly, small } = useStatisticsCounts();
  const needle = query.trim().toLowerCase();
  const matching = rows.filter((row) => !needle || row.team.name.toLowerCase().includes(needle));
  const measured = matching.filter((row) => row.figures[measure].kind === "measured");
  const valueOf = (row: { figures: CommunityFigures }) => {
    const figure = row.figures[measure];
    return figure.kind === "measured" ? figure.value : 0;
  };
  const shownOf = (row: { figures: CommunityFigures }) => small(valueOf(row));
  // On the executive desk a worded team sorts as nought, so the bar order cannot rank the hidden ones.
  const sortValue = (row: { figures: CommunityFigures }) => {
    const shownValue = shownOf(row);
    return typeof shownValue === "number" ? shownValue : 0;
  };
  const cellText = (figure: StatisticsFigure) =>
    figure.kind === "measured" ? small(figure.value) : figureText(figure);
  const sorted = [...measured].sort((a, b) =>
    sort === "name"
      ? a.team.name.localeCompare(b.team.name)
      : sortValue(b) - sortValue(a) || a.team.name.localeCompare(b.team.name),
  );
  const shown = showAll || needle ? sorted : sorted.slice(0, TOP);
  const unlinked = matching.length - measured.length;
  // The mean would give a hidden team's count back by subtraction, so the executive desk has none.
  const mean =
    measured.length === 0 || countsOnly
      ? undefined
      : measured.reduce((sum, row) => sum + valueOf(row), 0) / measured.length;
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
    downloadBlob(
      new Blob([lines.map((line) => line.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }),
      "ward-flow-synthetic-community-teams.csv",
    );
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
            <p className={styles.muted}>No team matches</p>
          ) : (
            <BarList
              label={chart.chart}
              axis
              max={countAxisMax(shown.map(sortValue))}
              mean={mean}
              meanLabel="Mean per team"
              labelWidth="12rem"
              rows={shown.map((row) => ({
                id: row.team.id,
                label: row.team.name,
                sub: row.team.id === current.id ? "this team" : undefined,
                ...withheldBar(valueOf(row), shownOf(row)),
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
            </>
          ) : (
            <>
              <b>{matching.length}</b> of {rows.length} teams
            </>
          )
        }
      >
        {view === "chart" && !needle && sorted.length > TOP ? (
          <Button size="sm" variant="ghost" onClick={() => setShowAll((value) => !value)}>
            {showAll ? `Top ${TOP}` : `Show all ${sorted.length}`}
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={exportCsv}>
          CSV
        </Button>
      </CardFoot>
    </StatCard>
  );
}
