/**
 * Community redesign proposal (5 October 2026): every figure the proposed hub and team pages show.
 *
 * Pure functions over the shared Ward Flow state, built only from the exported community
 * derivations, so the hub, the team page and the current screens count people the same way.
 * Nothing here reads the hand-written demonstration cohort.
 */

import {
  admissionsWithNoCommunityTeam,
  communityHubLists,
  isAwaitingTeamAnswer,
  type CommunityTeam,
} from "@/components/ward-management/community/community-derivations";
import { daysInBed, type Admission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Referral, ReferralAddressing } from "@/components/ward-management/ward-model";

/** How a team is named on a referral: the one join every list below depends on. */
export function addressingForTeam(referral: Referral, team: CommunityTeam): ReferralAddressing | undefined {
  return referral.destinations.find(
    (addressing) => addressing.destination.kind === "community_team" && addressing.destination.teamName === team.name,
  );
}

export type TeamFigures = {
  team: CommunityTeam;
  /** Referrals naming this team that still need its accept-or-decline answer. */
  waiting: Referral[];
  /** In a bed, or with a bed pulled for them, under a referral naming this team. */
  inBed: Admission[];
  /** Of `inBed`, those whose ward has set an expected discharge date. */
  expectedBack: Admission[];
  /** Of `expectedBack`, those whose expected date has already passed. */
  pastExpected: Admission[];
  /** Of `inBed`, those with a bed pulled who have not arrived. */
  pulledNotArrived: Admission[];
  /** Of `inBed`, those currently away at an emergency department. */
  atEd: Admission[];
  /** Referrals this team has accepted (for follow-up). */
  accepted: Referral[];
  /** Left the ward to the community, and every other recorded departure. */
  dischargedToArea: Admission[];
  otherDepartures: Admission[];
};

export function teamFigures(
  team: CommunityTeam,
  admissions: readonly Admission[],
  referrals: readonly Referral[],
  now: Instant,
): TeamFigures {
  const lists = communityHubLists(admissions, team, referrals);
  const waiting = referrals.filter((referral) => isAwaitingTeamAnswer(addressingForTeam(referral, team)));
  const accepted = referrals.filter((referral) => addressingForTeam(referral, team)?.state === "accepted");
  return {
    team,
    waiting,
    inBed: lists.currentlyAdmitted,
    expectedBack: lists.expectedBack,
    pastExpected: lists.expectedBack.filter(
      (admission) => admission.expectedDischargeAt !== null && admission.expectedDischargeAt < now,
    ),
    pulledNotArrived: lists.currentlyAdmitted.filter((admission) => admission.state === "pulled"),
    atEd: lists.currentlyAdmitted.filter((admission) => admission.awayAtEmergencyDepartmentSince !== null),
    accepted,
    dischargedToArea: lists.dischargedIntoTheArea,
    otherDepartures: lists.otherDepartures,
  };
}

/** True when anything at all is matched to the team: the test for "active" on the hub. */
export function teamHasPeople(figures: TeamFigures): boolean {
  return (
    figures.waiting.length +
      figures.inBed.length +
      figures.accepted.length +
      figures.dischargedToArea.length +
      figures.otherDepartures.length >
    0
  );
}

export type HubFigures = {
  teams: TeamFigures[];
  active: TeamFigures[];
  waiting: number;
  inBed: number;
  accepted: number;
  /** Admissions this prototype can match to no team at all. */
  unmatched: number;
};

export function hubFigures(
  teams: readonly CommunityTeam[],
  admissions: readonly Admission[],
  referrals: readonly Referral[],
  now: Instant,
): HubFigures {
  const all = teams.map((team) => teamFigures(team, admissions, referrals, now));
  const active = all
    .filter(teamHasPeople)
    .sort(
      (a, b) =>
        b.waiting.length - a.waiting.length ||
        b.inBed.length - a.inBed.length ||
        a.team.name.localeCompare(b.team.name),
    );
  return {
    teams: all,
    active,
    waiting: all.reduce((sum, figures) => sum + figures.waiting.length, 0),
    inBed: all.reduce((sum, figures) => sum + figures.inBed.length, 0),
    accepted: all.reduce((sum, figures) => sum + figures.accepted.length, 0),
    unmatched: admissionsWithNoCommunityTeam(admissions, referrals).length,
  };
}

/** Days since the bed began, or null for a pulled bed nobody has arrived in yet. */
export function stayDays(admission: Admission, now: Instant): number | null {
  return daysInBed(admission, now);
}

/** The team's accepted date compared with the bed's start: "before the bed" or "during the stay". */
export function acceptedRelativeToBed(
  admission: Admission,
  referrals: readonly Referral[],
  team: CommunityTeam,
): "before" | "during" | "not-accepted" {
  const referral = referrals.find((candidate) => candidate.id === admission.referralId);
  const addressing = referral ? addressingForTeam(referral, team) : undefined;
  if (addressing?.state !== "accepted" || addressing.decidedAt === undefined) return "not-accepted";
  if (admission.arrivedAt === null || addressing.decidedAt <= admission.arrivedAt) return "before";
  return "during";
}
