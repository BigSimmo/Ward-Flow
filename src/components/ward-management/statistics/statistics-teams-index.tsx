"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, LayoutGrid, Search, Users } from "lucide-react";

import {
  BarList,
  Button,
  CardBody,
  CardFoot,
  HeroStat,
  PhoneListRow,
  Segmented,
  TextInput,
  cx,
  useIsPhone,
} from "@/components/wf";
import { communityStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { COMMUNITY_SERVICE_OPTIONS } from "@/components/ward-management/community/community-index";
import {
  COMMUNITY_TEAM_PAGES,
  admissionsWithNoCommunityTeam,
  communityHubLists,
  communityMembershipResolution,
} from "@/components/ward-management/community/community-derivations";
import { bedIsOccupied } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import type { HealthService } from "@/components/ward-management/ward-model";
import { mapClinicToServiceAndHospital } from "@/components/ward-management/tools/ward-catchment-mapping";

import { countAxisMax } from "./statistics-axis";
import { communityFigures } from "./statistics-community-figures";
import { StatCard, StatisticsPage, useStatisticsLive } from "./statistics-hero";
import { FlushRow } from "./statistics-layout";
import { statisticsSectionById } from "./statistics-sections";
import { ServiceDot } from "./statistics-services-index";
import { PhoneBody, PhoneList, PhoneShowAll, phoneBodyStyles as phone } from "./statistics-phone-parts";
import styles from "./statistics-v6.module.css";
import index from "./statistics-index.module.css";

import { useExecutiveStatistics, useExecutiveStatisticsControl } from "./executive-statistics-context";
import { useEffectiveWardAccess } from "../shell/ward-access-store";
import {
  ExecutiveStatisticsUnavailable,
  statisticsCountText,
  exactStatisticsCount,
  withheldBar,
  type StatisticsCount,
} from "./statistics-small-numbers";

/** The community index's service codes, as the health services whose colour each one wears. */
const CODE_SERVICE: Record<string, HealthService> = {
  NMHS: "North Metro",
  SMHS: "South Metro",
  EMHS: "East Metro",
  WACHS: "WACHS",
};

const GROUPS = COMMUNITY_SERVICE_OPTIONS.filter((option) => option.value !== "all");

const plural = (count: StatisticsCount, one: string, many: string) => (count === 1 ? one : many);

/**
 * ALL COMMUNITY TEAMS — the Teams index page (Statistics A, 9 Oct 2026).
 *
 * Every team the catchment table names, grouped by health service the way the community index
 * groups them (`mapClinicToServiceAndHospital`), each the way into that team's own page. A person
 * belongs to a team only when their admission's referral named it (the owner's 2026-08-31 ruling),
 * so the counts here are `communityHubLists` and `communityFigures` exactly as each team's page reads
 * them. Where the join cannot run for a team, the team shows no count rather than a nought.
 */
type TeamIndexRow = {
  team: { id: string; name: string };
  code: string;
  inBed: StatisticsCount | null;
  withDate: StatisticsCount | null;
  dueOutWeek: StatisticsCount | null;
  openable?: boolean;
};
const shown = (count: StatisticsCount | null, missing = "�") => (count === null ? missing : statisticsCountText(count));
const exact = (count: StatisticsCount | null) => (count === null ? null : exactStatisticsCount(count));
const positive = (count: StatisticsCount | null) => count !== null && exact(count) !== 0;
export function StatisticsTeamsIndexScreen() {
  const control = useExecutiveStatisticsControl();
  const access = useEffectiveWardAccess();
  return control.executive || access.role === "executive" ? <ExecutiveTeamsIndex /> : <OperationalTeamsIndex />;
}
function ExecutiveTeamsIndex() {
  const data = useExecutiveStatistics();
  const control = useExecutiveStatisticsControl();
  if (!data) return <ExecutiveStatisticsUnavailable />;
  const count = (figure: (typeof data.teams)[number]["figures"]["admitted"]) =>
    figure.kind === "measured" ? figure.count : null;
  return (
    <TeamsIndexView
      teams={data.teams.map((team) => ({
        team: { id: team.id, name: team.name },
        code: team.code,
        inBed: count(team.figures.admitted),
        withDate: count(team.figures.expected),
        dueOutWeek: count(team.dueOutWeek),
        openable: data.openableCommunityTeamIds.includes(team.id),
      }))}
      inBedTotal={data.community.admitted}
      withDateTotal={data.community.expected}
      dueOutWeekTotal={data.community.dueOutWeek}
      noTeamInBed={data.community.noTeamInBed}
      activeCount={data.community.activeTeams}
      unknown={data.community.unknownTeams}
      emptyTeams={data.community.emptyTeams}
      now={data.network.asAt.now}
      paused={control.paused}
      togglePause={control.togglePause}
      scopeLabel={data.network.scope.kind === "service" ? data.network.scope.service : undefined}
    />
  );
}
function OperationalTeamsIndex() {
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
      dueOutWeek: lists.expectedBack.filter(
        (admission) =>
          admission.expectedDischargeAt !== null &&
          admission.expectedDischargeAt >= now &&
          admission.expectedDischargeAt < now + 7 * MINUTES_PER_DAY,
      ).length,
    };
  });

  return (
    <TeamsIndexView
      teams={teams}
      inBedTotal={teams.reduce((total, entry) => total + (entry.inBed ?? 0), 0)}
      withDateTotal={teams.reduce((total, entry) => total + (entry.withDate ?? 0), 0)}
      dueOutWeekTotal={teams.reduce((total, entry) => total + entry.dueOutWeek, 0)}
      activeCount={teams.filter((entry) => (entry.inBed ?? 0) > 0).length}
      unknown={teams.filter((entry) => entry.inBed === null).length}
      emptyTeams={teams.filter((entry) => entry.inBed === 0).length}
      noTeamInBed={admissionsWithNoCommunityTeam(admissions, referrals).filter(bedIsOccupied).length}
      now={now}
      paused={live.paused}
      togglePause={live.togglePause}
    />
  );
}
function TeamsIndexView({
  teams,
  inBedTotal,
  withDateTotal,
  dueOutWeekTotal,
  noTeamInBed,
  activeCount,
  unknown,
  emptyTeams,
  now,
  paused,
  togglePause,
  scopeLabel,
}: {
  teams: TeamIndexRow[];
  inBedTotal: StatisticsCount;
  withDateTotal: StatisticsCount;
  dueOutWeekTotal: StatisticsCount;
  noTeamInBed: StatisticsCount;
  activeCount: number;
  unknown: number;
  emptyTeams: number;
  now: number;
  paused: boolean;
  togglePause: (() => void) | null;
  scopeLabel?: string;
}) {
  const section = statisticsSectionById("community");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'community' section");
  const isPhone = useIsPhone();
  const [phoneView, setPhoneView] = useState<"active" | "all">("active");
  const [phoneQuery, setPhoneQuery] = useState("");
  const [phoneShowAll, setPhoneShowAll] = useState(false);
  const [showEmptyTeams, setShowEmptyTeams] = useState(false);
  const active = teams
    .filter((entry) => positive(entry.inBed))
    .sort((a, b) => {
      const x = exact(a.inBed),
        y = exact(b.inBed);
      return x === null ? (y === null ? a.team.name.localeCompare(b.team.name) : 1) : y === null ? -1 : y - x;
    });
  const groups = GROUPS.map((option) => ({
    option,
    service: CODE_SERVICE[option.value],
    teams: teams.filter((entry) => entry.code === option.value).sort((a, b) => a.team.name.localeCompare(b.team.name)),
  })).filter((group) => group.teams.length > 0);
  const otherTeams = teams.filter((entry) => !GROUPS.some((option) => option.value === entry.code));

  // Phone: the teams with someone in a bed (busiest first) or every team A to Z, narrowed by name.
  const needle = phoneQuery.trim().toLowerCase();
  const phoneTeams = (
    phoneView === "active" ? active : [...teams].sort((a, b) => a.team.name.localeCompare(b.team.name))
  ).filter((entry) => !needle || entry.team.name.toLowerCase().includes(needle));
  const PHONE_TEAMS_SHOWN = 12;
  const phoneShown = phoneShowAll || needle ? phoneTeams : phoneTeams.slice(0, PHONE_TEAMS_SHOWN);

  return (
    <StatisticsPage
      section={section}
      navSection="community"
      testId="ward-statistics-teams-index"
      eyebrowLabel={`Statistics · ${teams.length} teams`}
      title="Community teams"
      eyebrowDetail={scopeLabel}
      now={now}
      paused={paused}
      onTogglePause={togglePause ?? undefined}
      phone={{
        title: `${shown(inBedTotal)} team ${plural(inBedTotal, "patient", "patients")} in a bed`,
        sub: `${shown(noTeamInBed)} more in a bed with no team named`,
        stats: (
          <>
            <HeroStat value={shown(withDateTotal)} label="With a date" />
            <HeroStat value={activeCount} label="Teams with a patient in a bed" />
            <HeroStat value={shown(dueOutWeekTotal)} label="Due out within 7 days" />
          </>
        ),
      }}
      stats={
        <>
          <HeroStat value={shown(inBedTotal)} label="Team patients in a bed" />
          <HeroStat value={shown(withDateTotal)} label="With a discharge date" />
          <HeroStat value={activeCount} label="Teams with a patient in" />
          <HeroStat value={shown(noTeamInBed)} label="In a bed, no team named" />
        </>
      }
    >
      {isPhone ? (
        <PhoneBody testId="ward-statistics-teams-phone">
          <TextInput
            type="search"
            icon={Search}
            boxClassName={phone.search}
            aria-label="Find a team"
            placeholder="Find a team"
            value={phoneQuery}
            onChange={(event) => setPhoneQuery(event.target.value)}
            onClear={() => setPhoneQuery("")}
          />
          <Segmented<"active" | "all">
            className={phone.seg}
            size="md"
            label="Teams shown"
            value={phoneView}
            onChange={setPhoneView}
            items={[
              { id: "active", label: "With patients", count: active.length },
              { id: "all", label: "All teams", count: teams.length },
            ]}
          />
          {phoneTeams.length === 0 ? (
            <p className={phone.note}>{needle ? "No team matches this name." : "No team has anyone in a bed."}</p>
          ) : (
            <PhoneList label={phoneView === "active" ? "Teams with patients in a bed" : "All teams"}>
              {phoneShown.map((entry) => {
                const group = GROUPS.find((option) => option.value === entry.code);
                return (
                  <PhoneListRow
                    key={entry.team.id}
                    as="li"
                    name={entry.team.name}
                    meta={
                      <span className={phone.dotName}>
                        {`${group?.label ?? "Service not mapped"} · ${shown(entry.withDate, "none")} with a date`}
                      </span>
                    }
                    value={shown(entry.inBed)}
                    time="in a bed"
                    href={entry.openable === false ? undefined : communityStatisticsHref(entry.team.id)}
                    data-testid={`ward-statistics-teams-link-${entry.team.id}`}
                  />
                );
              })}
              {!needle && phoneTeams.length > PHONE_TEAMS_SHOWN ? (
                <PhoneShowAll
                  total={phoneTeams.length}
                  open={phoneShowAll}
                  onToggle={() => setPhoneShowAll((value) => !value)}
                />
              ) : null}
            </PhoneList>
          )}
        </PhoneBody>
      ) : (
        <>
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
                    label="People in a bed, or with one pulled, by the community team their referral named"
                    track
                    axis
                    max={countAxisMax(active.map((entry) => exact(entry.inBed) ?? 0))}
                    labelWidth="13rem"
                    rows={active.map((entry) => ({
                      id: entry.team.id,
                      label: entry.team.name,
                      sub: GROUPS.find((option) => option.value === entry.code)?.label,
                      ...withheldBar(exact(entry.inBed) ?? 0, shown(entry.inBed)),
                    }))}
                  />
                )}
              </CardBody>
              <CardFoot
                meta={`A person counts for a team only when their referral named it. ${shown(noTeamInBed)} in a bed have no team named.`}
              />
            </StatCard>

            <StatCard
              icon={CalendarClock}
              id="discharge-dates"
              className={index.anchorTarget}
              title="With a discharge date"
              aside={<span className={cx(styles.muted, index.phoneHide)}>{shown(withDateTotal)} in all</span>}
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
                      ...withheldBar(exact(entry.withDate) ?? 0, shown(entry.withDate)),
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
                  {group.teams.every((entry) => exact(entry.inBed) === 0) && !showEmptyTeams ? (
                    <p className={index.cardNote}>Nobody in a bed</p>
                  ) : null}
                  <ul className={index.teamList}>
                    {group.teams
                      .filter((entry) => showEmptyTeams || exact(entry.inBed) !== 0)
                      .map((entry) => (
                        <li key={entry.team.id}>
                          <TeamLink
                            href={entry.openable === false ? undefined : communityStatisticsHref(entry.team.id)}
                            className={index.teamChip}
                            data-testid={`ward-statistics-teams-link-${entry.team.id}`}
                            aria-label={
                              entry.inBed === null
                                ? `${entry.team.name}, count not available`
                                : `${entry.team.name}, ${shown(entry.inBed)} in a bed`
                            }
                          >
                            <span className={index.teamName}>{entry.team.name}</span>
                            <span
                              className={cx(index.teamCount, exact(entry.inBed) === 0 && index.teamCountZero)}
                              aria-hidden="true"
                            >
                              {shown(entry.inBed)}
                            </span>
                          </TeamLink>
                        </li>
                      ))}
                  </ul>
                </section>
              ))}
            </div>
            <CardFoot
              meta={
                unknown > 0
                  ? `${unknown} ${plural(unknown, "team", "teams")} show a dash: a referral on record cannot be found, so an empty count would not be a measurement.`
                  : `${emptyTeams} ${plural(emptyTeams, "team has", "teams have")} nobody in a bed`
              }
            >
              {emptyTeams > 0 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowEmptyTeams((value) => !value)}
                  data-testid="ward-statistics-teams-show-empty"
                >
                  {showEmptyTeams ? "Hide teams with nobody in a bed" : `Show ${emptyTeams} with nobody in a bed`}
                </Button>
              ) : null}
            </CardFoot>
          </StatCard>
        </>
      )}
    </StatisticsPage>
  );
}

function TeamLink({ href, children, ...props }: Omit<React.ComponentProps<"a">, "href"> & { href?: string }) {
  return href ? (
    <Link href={href} {...props}>
      {children}
    </Link>
  ) : (
    <span {...props}>{children}</span>
  );
}
