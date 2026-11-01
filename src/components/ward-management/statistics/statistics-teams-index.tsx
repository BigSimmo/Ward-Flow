"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";

import { HeroStat, PhoneListRow, Segmented, TextInput, cx, tableClasses, useIsPhone } from "@/components/wf";
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

import { communityFigures } from "./statistics-community-figures";
import { StatCard, StatisticsPage, useStatisticsLive } from "./statistics-hero";
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
  sumStatisticsCounts,
  type StatisticsCount,
} from "./statistics-small-numbers";
import {
  Foot,
  Glyph,
  Now,
  Strip,
  Tile,
  redesignStyles as redesign,
} from "@/components/ward-management/statistics/redesign/statistics-redesign-parts";

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
  const [listAll, setListAll] = useState(false);
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
  const groupLabel = (code: string) => GROUPS.find((option) => option.value === code)?.label ?? "Service not mapped";
  const tileGroups = [
    ...groups.map((group) => ({ key: group.option.value, name: group.service ?? group.option.label, ...group })),
    ...(otherTeams.length > 0
      ? [{ key: "other", name: "Service not mapped", service: undefined, teams: otherTeams }]
      : []),
  ];
  // In a bed: the busiest first. All: the same teams first, then every other team A to Z.
  const listed = listAll
    ? [
        ...active,
        ...teams.filter((entry) => !positive(entry.inBed)).sort((a, b) => a.team.name.localeCompare(b.team.name)),
      ]
    : active;

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
          <StatCard
            id="by-service"
            className={index.anchorTarget}
            title="Teams by service"
            meta={`${teams.length} ${plural(teams.length, "team", "teams")}`}
            data-testid="ward-statistics-teams-in-bed"
          >
            <Strip label="Teams by service" cols={4}>
              {tileGroups.map((group) => {
                const counted = group.teams.filter((entry) => entry.inBed !== null);
                const inBed = sumStatisticsCounts(counted.map((entry) => entry.inBed!));
                const withDate = sumStatisticsCounts(
                  group.teams.filter((entry) => entry.withDate !== null).map((entry) => entry.withDate!),
                );
                const busy = group.teams.filter((entry) => positive(entry.inBed));
                const nobody = exactStatisticsCount(inBed) === 0;
                return (
                  <Tile
                    key={group.key}
                    muted={nobody}
                    title={
                      <span className={redesign.nameSub}>
                        <ServiceDot service={group.service} />
                        {group.name}
                      </span>
                    }
                    now={<Now>{`${group.teams.length} ${plural(group.teams.length, "team", "teams")}`}</Now>}
                    fig={shown(inBed)}
                    unit="in a bed"
                    sub={
                      nobody
                        ? "Nobody in a bed"
                        : `${shown(withDate)} with a discharge date · ${busy.map((entry) => entry.team.name).join(", ")}`
                    }
                  />
                );
              })}
            </Strip>
            <Foot how={["A person counts for a team only when their referral named it."]}>
              {positive(noTeamInBed) ? <Glyph tone="warning" /> : null} <b>{shown(noTeamInBed)}</b> people in a bed have
              no team named
            </Foot>
          </StatCard>

          <StatCard
            id="all-teams"
            className={index.anchorTarget}
            title="Teams with someone in a bed"
            meta={`${active.length} of ${teams.length} teams`}
            action={
              <Segmented<"bed" | "all">
                label="Teams shown"
                value={listAll ? "all" : "bed"}
                onChange={(next) => setListAll(next === "all")}
                items={[
                  { id: "bed", label: "In a bed" },
                  { id: "all", label: `All ${teams.length}` },
                ]}
              />
            }
            data-testid="ward-statistics-teams-all"
          >
            {listed.length === 0 ? (
              <p className={redesign.empty}>No one in a bed has a named community team.</p>
            ) : (
              <div className={redesign.tableWrap} tabIndex={0} role="region" aria-label="Teams, scrollable">
                <table className={cx(tableClasses.table, redesign.table)} data-testid="ward-statistics-teams-table">
                  <caption className={styles.srOnly}>
                    Community teams: people in a bed, those with a discharge date and those due out within 7 days
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Team</th>
                      {["In a bed", "With a discharge date", "Due out within 7 days"].map((label) => (
                        <th key={label} scope="col" className={redesign.r}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listed.map((entry) => {
                      const num = (count: StatisticsCount | null) =>
                        cx(redesign.r, tableClasses.num, exact(count) !== null && exact(count) === 0 && redesign.zero);
                      return (
                        <tr key={entry.team.id}>
                          <th scope="row">
                            <span className={redesign.name}>
                              <TeamLink
                                href={entry.openable === false ? undefined : communityStatisticsHref(entry.team.id)}
                                className={redesign.nameLink}
                                data-testid={`ward-statistics-teams-link-${entry.team.id}`}
                              >
                                {entry.team.name}
                              </TeamLink>
                              <small>{groupLabel(entry.code)}</small>
                            </span>
                          </th>
                          <td className={num(entry.inBed)}>{shown(entry.inBed)}</td>
                          <td className={num(entry.withDate)}>{shown(entry.withDate)}</td>
                          <td className={num(entry.dueOutWeek)}>{shown(entry.dueOutWeek)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <Foot
              link={
                emptyTeams > 0 || unknown > 0 ? (
                  <button
                    type="button"
                    className={redesign.link}
                    aria-expanded={listAll}
                    onClick={() => setListAll((value) => !value)}
                    data-testid="ward-statistics-teams-show-empty"
                  >
                    {listAll ? "Show fewer" : `Show all ${teams.length}`}
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                ) : null
              }
            >
              {unknown > 0
                ? `${unknown} ${plural(unknown, "team", "teams")} show a dash: a referral on record cannot be found.`
                : `${emptyTeams} ${plural(emptyTeams, "team has", "teams have")} nobody in a bed`}
            </Foot>
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
