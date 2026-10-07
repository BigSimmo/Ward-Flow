"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, ChevronDown, FileText, PhoneCall, Search, Users } from "lucide-react";

import {
  BarList,
  Button,
  CardBody,
  CardFoot,
  HeroStat,
  Icon,
  Menu,
  Meter,
  Segmented,
  SrOnly,
  StatusGlyph,
  TextInput,
  buttonClass,
  tableClasses,
} from "@/components/wf";
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
} from "@/components/ward-management/statistics/statistics-sections";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";

import { figureText, isUnmeasured, type StatisticsFigure } from "./statistics-absence";
import { countAxisMax } from "./statistics-axis";
import { communityFigures, type CommunityFigures } from "./statistics-community-figures";
import { csvCell } from "./statistics-csv";
import { dateOf, fromToday } from "./statistics-dates";
import { StatCard, StatisticsPage, useStatisticsLive } from "./statistics-hero";
import { useOptionalRouter } from "./statistics-nav";
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
  const { admissions, referrals, units } = live.state;
  const now = live.now;
  const { dayZero } = useWardFlow();

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

  const figureRows: { key: keyof CommunityFigures; label: string; figure: StatisticsFigure }[] = [
    { key: "admitted", label: "In a bed, or holding one", figure: figures.admitted },
    { key: "expected", label: "With a discharge date", figure: figures.expected },
    { key: "discharged", label: "Discharged into the area", figure: figures.discharged },
    { key: "other", label: "Left the ward another way", figure: figures.other },
  ];
  const measuredMax = Math.max(1, ...figureRows.map((row) => (row.figure.kind === "measured" ? row.figure.value : 0)));

  return (
    <StatisticsPage
      section={section}
      navSection="community"
      slug={team.id}
      testId="ward-statistics-community-screen"
      title={team.name}
      titleAction={<ChangeTeam currentId={team.id} />}
      eyebrowLabel="Community team"
      eyebrowDetail={<span>{COMMUNITY_TEAM_PAGES.length} teams in the network</span>}
      now={now}
      paused={live.paused}
      onTogglePause={live.togglePause}
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
                  {row.figure.kind === "measured" ? row.figure.value : "none"}
                </span>
              }
              label={HERO_LABELS[row.key]}
            />
          ))}
          <HeroStat
            value={figures.discharged.kind === "measured" ? notArranged.length : "none"}
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
      <div className={styles.gridMain}>
        <TeamComparison current={team} rows={allTeams} />
        <div className={styles.stack}>
          <StatCard
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
                        {row.figure.kind === "measured" ? (
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
                        {figureText(row.figure)}
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
                {figureText(figures.admitted)} referred to this team and occupying or holding a bed now.
              </p>
              <p
                data-testid="ward-statistics-community-in-hospital-with-date"
                data-unmeasured={isUnmeasured(figures.expected) || undefined}
              >
                {figureText(figures.expected)} of those have a discharge date written down.
              </p>
              <p
                data-testid="ward-statistics-community-hospital-discharges-count"
                data-unmeasured={isUnmeasured(figures.discharged) || undefined}
              >
                {figureText(figures.discharged)} discharged into the area this team serves.
              </p>
              <p
                data-testid="ward-statistics-community-other-departures-count"
                data-unmeasured={isUnmeasured(figures.other) || undefined}
              >
                {figureText(figures.other)} left a ward another way.
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

          <StatCard icon={PhoneCall} title="Follow-up" aside="Discharged here">
            <CardBody className={styles.bodyStack}>
              {lists.dischargedIntoTheArea.length === 0 ? (
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
            <CardFoot meta={`${unseen.length} of ${admissions.length} admissions have no community team`}>
              <span data-testid="ward-statistics-community-unseen" className={styles.srOnly}>
                {unseen.length} of {admissions.length} admissions without a community team
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
        </div>
      </div>

      <StatCard icon={CalendarClock} title="Due out to this team" aside="With a discharge date">
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
                      <>
                        {dateOf(admission.expectedDischargeAt, dayZero)}{" "}
                        <span className={styles.muted}>{fromToday(admission.expectedDischargeAt, now)}</span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StatCard>
    </StatisticsPage>
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
  const needle = query.trim().toLowerCase();
  const matching = rows.filter((row) => !needle || row.team.name.toLowerCase().includes(needle));
  const measured = matching.filter((row) => row.figures[measure].kind === "measured");
  const valueOf = (row: { figures: CommunityFigures }) => {
    const figure = row.figures[measure];
    return figure.kind === "measured" ? figure.value : 0;
  };
  const sorted = [...measured].sort((a, b) =>
    sort === "name"
      ? a.team.name.localeCompare(b.team.name)
      : valueOf(b) - valueOf(a) || a.team.name.localeCompare(b.team.name),
  );
  const shown = showAll || needle ? sorted : sorted.slice(0, TOP);
  const unlinked = matching.length - measured.length;
  const mean =
    measured.length === 0 ? undefined : measured.reduce((sum, row) => sum + valueOf(row), 0) / measured.length;
  const chart = MEASURES.find((entry) => entry.id === measure)!;

  function exportCsv() {
    const lines = [
      ["Team", "In a bed", "With a discharge date", "Discharged into the area", "Left another way"],
      ...matching.map((row) => [
        row.team.name,
        figureText(row.figures.admitted),
        figureText(row.figures.expected),
        figureText(row.figures.discharged),
        figureText(row.figures.other),
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([lines.map((line) => line.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "ward-flow-synthetic-community-teams.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <StatCard
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
        <CardBody className={styles.bodyStack} data-testid="statistics-community-comparison-chart">
          {shown.length === 0 ? (
            <p className={styles.muted}>No team matches</p>
          ) : (
            <BarList
              label={chart.chart}
              axis
              max={countAxisMax(shown.map(valueOf))}
              mean={mean}
              meanLabel="Mean per team"
              labelWidth="12rem"
              rows={shown.map((row) => ({
                id: row.team.id,
                label: (
                  <Link href={communityStatisticsHref(row.team.id)} className={styles.rowLink}>
                    {row.team.name}
                  </Link>
                ),
                labelText: row.team.name,
                sub: row.team.id === current.id ? "this team" : undefined,
                value: valueOf(row),
                display: String(valueOf(row)),
              }))}
            />
          )}
          {unlinked > 0 ? (
            <p className={detail.note}>
              {unlinked} {unlinked === 1 ? "team is" : "teams are"} not linked, so left out of the bars
            </p>
          ) : null}
        </CardBody>
      ) : (
        <div className={styles.tableWrap}>
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
                      {figureText(row.figures[key])}
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
