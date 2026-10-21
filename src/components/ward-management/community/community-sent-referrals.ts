/*
 * Fix plan item 17 (D-74): the wording for the referrals a community team sent, shared by the team
 * page's desktop panel and its phone list so the two never drift apart.
 */

import { MINUTES_PER_DAY, type Instant } from "../ward-clock";
import type { Unit } from "../ward-model";
import type { CommunitySentAddressing, CommunitySentReferral } from "../ward-referral-visibility";
import { elapsedDaysPhrase } from "./community-elapsed";
import { unitName } from "./community-screen-helpers";

/** One line on where a sent referral stands, from its overall state. */
export function sentReferralSummary(referral: CommunitySentReferral): string {
  if (referral.withdrawn) return "Withdrawn.";
  if (referral.state === "accepted") return "Accepted.";
  if (referral.state === "declined") return "Declined everywhere it was sent.";
  return "Waiting for an answer.";
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

/** One place the referral went and its answer. A ward is named from the unit list, never by its id. */
export function sentPlaceLine(addressing: CommunitySentAddressing, units: readonly Unit[]): string {
  return `${addressing.unitId ? unitName(addressing.unitId, units) : addressing.label}: ${addressing.answer}`;
}

/** Older community referrals that record no sending team: counted, never guessed onto a team. */
export function unattributedSentLine(count: number): string {
  return count === 1
    ? "1 older community referral does not record which team sent it, so it is not listed here."
    : `${count} older community referrals do not record which team sent them, so they are not listed here.`;
}
