/**
 * The community team's "Referrals to answer" figure, in a leaf the rail can read (R-STRUCT-24,
 * figures spec 3.6, D-220).
 *
 * The team page counts its fixed demo list (`REFERRALS`, `midland-demo.ts`, about 24 KB) less the
 * answers kept in this browser (`openReferrals`, `midland-decisions.ts`). The rail counted shared
 * referrals instead, so the team desk read "Referrals 0" beside a page that said 3. This file holds
 * only the referral ids, so the rail can count what the page counts without loading the demo data.
 * `tests/figure-team-referral-count.test.ts` pins the ids to the demo list.
 *
 * The list is fixed demo data. A signed-in team desk needs a real source for the page itself later
 * (figures spec 7.6); this figure follows the page whatever its source becomes.
 *
 * The rail (`use-desk-nav-counts.ts`) and the team page (`team-home.tsx`) both read it.
 */

/** The ids of the team's demo referrals, in the page's order (`REFERRALS` in `midland-demo.ts`). */
export const TEAM_REFERRAL_IDS = ["r1", "r2", "r3"] as const;

/** Referrals the team still has to answer: the demo list less the answers recorded in this browser. */
export function teamReferralsToAnswer(decided: Readonly<Record<string, unknown>>): number {
  return TEAM_REFERRAL_IDS.filter((id) => !decided[id]).length;
}
