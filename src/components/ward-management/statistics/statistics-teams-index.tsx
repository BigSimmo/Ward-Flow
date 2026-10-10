"use client";

import Link from "next/link";
import { CalendarClock, LayoutGrid, Users } from "lucide-react";

import { BarList, CardBody, CardFoot, HeroStat, cx } from "@/components/wf";
import { communityStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { COMMUNITY_SERVICE_OPTIONS } from "@/components/ward-management/community/community-index";
import {
  COMMUNITY_TEAM_PAGES,
  admissionsWithNoCommunityTeam,
  communityHubLists,
  communityMembershipResolution,
} from "@/components/ward-management/community/community-derivations";
import { bedIsOccupied } from "@/components/ward-management/ward-admissions";
import type { HealthService } from "@/components/ward-management/ward-model";
import { mapClinicToServiceAndHospital } from "@/components/ward-management/tools/ward-catchment-resolver";

import { communityFigures } from "./statistics-community-figures";
import { StatCard, StatisticsPage, useStatisticsLive } from "./statistics-hero";
import { FlushRow } from "./statistics-layout";
import { statisticsSectionById } from "./statistics-sections";
import { ServiceDot } from "./statistics-services-index";
import styles from "./statistics-v6.module.css";
import index from "./statistics-index.module.css";

/** The community index's service codes, as the health services whose colour each one wears. */
const CODE_SERVICE: Record<string, HealthService> = {
  NMHS: "North Metro",
  SMHS: "South Metro",
  EMHS: "East Metro",
  WACHS: "WACHS",
};

const GROUPS = COMMUNITY_SERVICE_OPTIONS.filter((option) => option.value !== "all");

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/**
 * ALL COMMUNITY TEAMS — the Teams index page (Statistics A, 9 Oct 2026).
 *
 * Every team the catchment table names, grouped by health service the way the community index
 * groups them (`mapClinicToServiceAndHospital`), each the way into that team's own page. A person
 * belongs to a team only when their admission's referral named it (the owner's 2026-08-31 ruling),
 * so the counts here are `communityHubLists` and `communityFigures` exactly as each team's page reads
 * them. Where the join cannot run for a team, the team shows no count rather than a nought.
 */
export function StatisticsTeamsIndexScreen() {
  const section = statisticsSectionById("community");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'community' section");

  const live = useStatisticsLive();
  const { admissions, referrals } = live.state;
  const now = live.now;

  const teams = COMMUNITY_TEAM_PAGES.map((team) => {
    const lists = communityHubLists(admissions, team, referrals);
    const figures = communityFigures(lists, communityMembershipResolution(admissions, team, referrals));
    const code = mapClinicToServiceAndHospital(team.name).code;
    return {
      team,
      code,
      inBed: figures.admitted.kind === "measured" ? figures.admitted.value : null,
      withDate: figures.expected.kind === "measured" ? figures.expected.value : null,
    };
  });

  const inBedTotal = teams.reduce((total, entry) => total + (entry.inBed ?? 0), 0);
  const withDateTotal = teams.reduce((total, entry) => total + (entry.withDate ?? 0), 0);
  const active = teams.filter((entry) => (entry.inBed ?? 0) > 0).sort((a, b) => (b.inBed ?? 0) - (a.inBed ?? 0));
  const unknown = teams.filter((entry) => entry.inBed === null).length;
  const noTeamInBed = admissionsWithNoCommunityTeam(admissions, referrals).filter(bedIsOccupied).length;

  const groups = GROUPS.map((option) => ({
    option,
    service: CODE_SERVICE[option.value],
    teams: teams.filter((entry) => entry.code === option.value).sort((a, b) => a.team.name.localeCompare(b.team.name)),
  })).filter((group) => group.teams.length > 0);
  const otherTeams = teams.filter((entry) => !GROUPS.some((option) => option.value === entry.code));

  return (
    <StatisticsPage
      section={section}
      navSection="community"
      testId="ward-statistics-teams-index"
      eyebrowLabel={`Statistics · ${teams.length} teams`}
      title="Community teams"
      now={now}
      paused={live.paused}
      onTogglePause={live.togglePause}
      stats={
        <>
          <HeroStat value={inBedTotal} label="Team patients in a bed" />
          <HeroStat value={withDateTotal} label="With a discharge date" />
          <HeroStat value={active.length} label="Teams with a patient in" />
          <HeroStat value={noTeamInBed} label="In a bed, no team named" />
        </>
      }
    >
      <FlushRow layout="lead2">
        <StatCard
          icon={Users}
          id="in-a-bed"
          className={index.anchorTarget}
          title="Patients in a bed, by team"
          aside={<span className={cx(styles.muted, index.phoneHide)}>Teams with someone in</span>}
          data-testid="ward-statistics-teams-in-bed"
        >
          <CardBody>
            {active.length === 0 ? (
              <p className={index.cardNote}>No admission in a bed has a referral that names a community team.</p>
            ) : (
              <BarList
                label="People in a bed, or holding one, by the community team their referral named"
                track
                axis
                labelWidth="13rem"
                rows={active.map((entry) => ({
                  id: entry.team.id,
                  label: entry.team.name,
                  sub: GROUPS.find((option) => option.value === entry.code)?.label,
                  value: entry.inBed ?? 0,
                }))}
              />
            )}
          </CardBody>
          <CardFoot
            meta={`A person counts for a team only when their referral named it. ${noTeamInBed} in a bed have no team named.`}
          />
        </StatCard>

        <StatCard
          icon={CalendarClock}
          id="discharge-dates"
          className={index.anchorTarget}
          title="With a discharge date"
          aside={<span className={cx(styles.muted, index.phoneHide)}>{withDateTotal} in all</span>}
          data-testid="ward-statistics-teams-with-date"
        >
          <CardBody>
            {active.length === 0 ? (
              <p className={index.cardNote}>No team has anyone in a bed.</p>
            ) : (
              <BarList
                label="Of each team's people in a bed, those with an expected discharge date"
                track
                labelWidth="10rem"
                rows={active.map((entry) => ({
                  id: entry.team.id,
                  label: entry.team.name,
                  value: entry.withDate ?? 0,
                }))}
              />
            )}
          </CardBody>
        </StatCard>
      </FlushRow>

      <StatCard
        icon={LayoutGrid}
        id="all-teams"
        className={index.anchorTarget}
        title={`All ${teams.length} teams`}
        aside={<span className={cx(styles.muted, index.phoneHide)}>Grouped by service · in a bed now</span>}
        data-testid="ward-statistics-teams-all"
      >
        <div className={index.teamColumns}>
          {[
            ...groups.map((group) => ({ key: group.option.value, label: group.option.label, ...group })),
            ...(otherTeams.length > 0
              ? [{ key: "other", label: "Service not mapped", service: undefined, teams: otherTeams }]
              : []),
          ].map((group) => (
            <section
              key={group.key}
              className={index.teamGroup}
              aria-labelledby={`team-group-${group.key}`}
              id={`teams-${group.key.toLowerCase()}`}
            >
              <h3 className={index.teamGroupHead} id={`team-group-${group.key}`}>
                <ServiceDot service={group.service} />
                {group.label}
                <span className={styles.muted}>{group.teams.length}</span>
              </h3>
              <ul className={index.teamList}>
                {group.teams.map((entry) => (
                  <li key={entry.team.id}>
                    <Link
                      href={communityStatisticsHref(entry.team.id)}
                      className={index.teamChip}
                      data-testid={`ward-statistics-teams-link-${entry.team.id}`}
                      aria-label={
                        entry.inBed === null
                          ? `${entry.team.name}, count not available`
                          : `${entry.team.name}, ${entry.inBed} in a bed`
                      }
                    >
                      <span className={index.teamName}>{entry.team.name}</span>
                      <span
                        className={cx(index.teamCount, (entry.inBed ?? 0) === 0 && index.teamCountZero)}
                        aria-hidden="true"
                      >
                        {entry.inBed ?? "–"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        {unknown > 0 ? (
          <CardFoot
            meta={`${unknown} ${plural(unknown, "team", "teams")} show a dash: a referral on record cannot be found, so an empty count would not be a measurement.`}
          />
        ) : null}
      </StatCard>
    </StatisticsPage>
  );
}
