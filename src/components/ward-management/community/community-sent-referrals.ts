/*
 * Fix plan item 17 (D-74): the wording for the referrals a community team sent, shared by the team
 * page's desktop Sent tab and its phone Sent list so the two never drift apart.
 */

import { MINUTES_PER_DAY, type Instant } from "../ward-clock";
import type { ReferralDestination, Unit } from "../ward-model";
import type { CommunitySentAddressing, CommunitySentReferral } from "../ward-referral-visibility";
import { referralDestinationLabel, referralPurposeLabel } from "../ward-referrals";
import { communityTeamSlug, type CommunityTeam } from "./community-derivations";
import { elapsedDaysPhrase } from "./community-elapsed";
import { unitName } from "./community-screen-helpers";

/**
 * `ward-access-scope.ts`'s `communityTeamKey`, in slug form. Importing that module here split the
 * shared bundle and cost every page about 0.25 KB (PR #564), so it is restated. Two names match
 * under one exactly when they match under the other. Keep the two in step.
 */
function sendingTeamKey(name: string): string {
  return communityTeamSlug(name).replace(/-community-team$/u, "");
}

/**
 * The referrals `team` sent, newest first, matched on the sending team's name the way the desk scope
 * matches it (`sendingTeamKey`), so this list and what a team desk may see agree. It lives here, not
 * in `community-derivations.ts`, so it loads with the team page rather than on every page.
 */
export function referralsSentByTeam(
  sent: readonly CommunitySentReferral[],
  team: CommunityTeam,
): CommunitySentReferral[] {
  const teamKey = sendingTeamKey(team.name);
  if (teamKey === "") return [];
  return sent
    .filter((referral) => sendingTeamKey(referral.sendingTeamName) === teamKey)
    .sort((a, b) => b.raisedAt - a.raisedAt);
}

/** How long ago a referral was sent, as elapsed time: the team page never prints a date or a clock face. */
export function sentAgo(raisedAt: Instant, now: Instant): string {
  const minutes = Math.max(0, now - raisedAt);
  if (minutes < 60) return "less than an hour ago";
  if (minutes < MINUTES_PER_DAY) {
    const hours = Math.floor(minutes / 60);
    return `${hours === 1 ? "1 hour" : `${hours} hours`} ago`;
  }
  return `${elapsedDaysPhrase(Math.floor(minutes / MINUTES_PER_DAY))} ago`;
}

/** A place the referral went. A ward is named from the unit list, never by its id. */
function sentPlaceName({ destination }: CommunitySentAddressing, units: readonly Unit[]): string {
  return destination.kind === "psychiatric_ward" && destination.unitId
    ? unitName(destination.unitId, units)
    : referralDestinationLabel(destination);
}

/** One place the referral went and its answer. */
export function sentPlaceLine(addressing: CommunitySentAddressing, units: readonly Unit[]): string {
  return `${sentPlaceName(addressing, units)}: ${addressing.answer}`;
}

/** D-77 group A: what one place was asked for. An ED arm always names its purpose, as
 *  `referralDestinationLabel` requires, so a review request never reads as a bed request. */
function askedFor(destination: ReferralDestination): string {
  switch (destination.kind) {
    case "psychiatric_ward":
      return destination.secureBedNeeded ? "Ward bed, secure" : "Ward bed";
    case "emergency_department":
      return `ED, ${referralPurposeLabel(destination.purpose).toLowerCase()}`;
    case "community_team":
      return "Community team";
  }
}

/** D-77 group A: what the referral asked for, once per kind of request. */
export function sentAskedFor(referral: CommunitySentReferral): string {
  return [...new Set(referral.addressings.map((addressing) => askedFor(addressing.destination)))].join(" and ");
}

/** D-77 group A: where it was sent, as one short line. */
export function sentToLine(referral: CommunitySentReferral, units: readonly Unit[]): string {
  const places = referral.addressings;
  if (places.length === 1) return `Asked ${sentPlaceName(places[0]!, units)}`;
  return places.every(({ destination }) => destination.kind === "psychiatric_ward" && destination.unitId)
    ? `Asked ${places.length} wards`
    : `Asked ${places.length} places`;
}

export type SentAnswerTone = "accepted" | "declined" | "waiting" | "withdrawn";

/** D-77 group A: the Answer column, in words and a tone. The place lines carry each place's own answer. */
export function sentAnswer(
  referral: CommunitySentReferral,
  units: readonly Unit[],
): { text: string; tone: SentAnswerTone } {
  if (referral.withdrawn) return { text: "Withdrawn.", tone: "withdrawn" };
  // The referral's own state decides, as the filters do: a community team's acceptance does not
  // settle a referral while a ward or ED arm is still open (`referralState`).
  const accepted =
    referral.state === "accepted"
      ? referral.addressings.find((addressing) => addressing.state === "accepted")
      : undefined;
  if (accepted) return { text: `${sentPlaceName(accepted, units)} accepted.`, tone: "accepted" };
  if (referral.state === "declined") return { text: "Declined everywhere it was sent.", tone: "declined" };
  const declined = referral.addressings.filter((addressing) => addressing.state === "declined").length;
  return declined > 0
    ? { text: `Declined by ${declined}. Waiting for the others.`, tone: "declined" }
    : { text: "Waiting for an answer.", tone: "waiting" };
}

export type SentFilter = "all" | "waiting" | "answered";

/** Waiting means no place has accepted and at least one is still to answer. Answered means accepted,
 *  or declined everywhere. A withdrawn referral shows under All only. */
export function sentMatches(referral: CommunitySentReferral, filter: SentFilter): boolean {
  if (filter === "all") return true;
  if (referral.withdrawn) return false;
  const answered = referral.state === "accepted" || referral.state === "declined";
  return filter === "answered" ? answered : !answered;
}

/** Older community referrals that record no sending team: counted, never guessed onto a team. */
export function unattributedSentLine(count: number): string {
  return count === 1
    ? "1 older community referral does not record which team sent it, so it is not listed here."
    : `${count} older community referrals do not record which team sent them, so they are not listed here.`;
}
