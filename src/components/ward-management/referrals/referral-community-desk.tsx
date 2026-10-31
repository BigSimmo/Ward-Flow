"use client";
// Desk views (Josh, 31 Oct 2026): the community clinician's differences on the one Referrals board,
// kept here so `referral-board.tsx` stays readable. Every piece is for `access.role === "community"`
// only; the coordinator and the other desks never reach it.
//
// Permissions are unchanged. On /ward-flow/referrals today a community desk takes a referral for
// itself, logs a call, adds a correction and withdraws a referral it sent (all in its own role),
// and answers a referral's community arm. Those stay; this file adds wording and a link only.

import Link from "next/link";

import { communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { homeHrefFor } from "@/components/ward-management/ward-role-access";
import { buttonClass, cx } from "@/components/wf";

export type CommunityDesk = {
  /** "Midland team", or the name as given when it already says team. Undefined when unscoped. */
  teamLabel: string | undefined;
  /** The team's own page, where its Waiting list is. */
  teamHref: string;
};

/** The community clinician's team and its page; `undefined` at every other desk. */
export function useCommunityDesk(): CommunityDesk | undefined {
  const access = useEffectiveWardAccess();
  if (access.role !== "community") return undefined;
  const teamName = access.scope.kind === "team" ? access.scope.teamName : undefined;
  return {
    teamLabel: teamName ? (/\bteam\b/i.test(teamName) ? teamName : `${teamName} team`) : undefined,
    teamHref: homeHrefFor(access, communityTeamSlug),
  };
}

/** The page names the team, never "statewide". */
export function communityEyebrow(desk: CommunityDesk): string {
  return desk.teamLabel ? `Referrals · ${desk.teamLabel}` : "Referrals";
}

/** An empty list reads as a state, as on the team page. */
export function communityQueueTitle(count: number): string {
  return count === 0 ? "Nothing waiting on the team" : `${count} waiting on the team`;
}

/**
 * The way to the team page's Waiting list. It stands where the coordinator's Next overdue and Bed
 * meeting list sit: the bed meeting list is not a screen this desk opens.
 */
export function CommunityTeamLink({
  desk,
  phone = false,
  className,
}: {
  desk: CommunityDesk;
  /** The phone hero's pill size (Home's hero pills), not the desktop hero's small tool. */
  phone?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={desk.teamHref}
      className={cx(buttonClass({ variant: "onHero", size: phone ? "md" : "sm" }), className)}
      data-testid="ward-referral-team-page"
    >
      Open the team&rsquo;s Waiting list
    </Link>
  );
}
