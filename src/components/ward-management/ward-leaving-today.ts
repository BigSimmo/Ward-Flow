import { dayOf, type Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease } from "@/components/ward-management/ward-model";
import { isFreeingToday } from "@/components/ward-management/ward-releases-expected-to-free";

/*
 * R-FIGS-12 (D-216, Josh 14 Nov 2026): "Discharges today" was one word for two figures. A
 * coordinator plans beds on the expected ones and reports on the ones that happened, so each has its
 * own name and its own rule. A leaf module, so any screen can read it without the derivations.
 */

/** What happened: stays recorded as ended since 12:00 am today. */
export const LEFT_TODAY_LABEL = "Left today";
/** What is expected: a planned discharge still to happen later today. */
export const EXPECTED_TO_LEAVE_TODAY_LABEL = "Expected to leave today";

/** The fields `leftToday` reads, so a count-only row can be counted too. */
type EndedStay = { readonly leftAt: Instant | null };

/** Stays recorded as ended on the board's day, from 12:00 am to now (`dayOf`). */
export function leftToday<T extends EndedStay>(stays: readonly T[], now: Instant): T[] {
  return stays.filter((stay) => stay.leftAt !== null && dayOf(stay.leftAt) === dayOf(now));
}

/**
 * Planned discharges still to happen today: the one "freeing today" rule (`isFreeingToday`) that
 * Capacity, the meeting sheet and the TV read. A time already passed is overdue, not expected.
 */
export function expectedToLeaveToday(releases: readonly BedRelease[], now: Instant): BedRelease[] {
  return releases.filter((release) => isFreeingToday(release, now));
}
