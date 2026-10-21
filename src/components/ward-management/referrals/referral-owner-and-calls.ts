/**
 * REFERRAL OWNER AND CALL LOG (fix plan item 4, Josh "yes to all", 21 Oct 2026).
 *
 * Who is chasing a front-door referral, and every call made about it: which ward, team or referrer
 * was rung, when, by which desk, and what they said. Both are closed lists, chosen and never typed,
 * so nothing here stops device saving (D-18). Owners and callers are DESKS, never people, the same
 * rule `decidedBy` and the action-list claims follow.
 *
 * This file holds only the closed lists and their types, with no imports, so `ward-model.ts` can
 * name them without pulling screen code into the model's import graph. The selectors are in
 * `referral-owner-and-calls-model.ts`.
 *
 * Neither record answers the referral. A ward saying yes on the phone is a call outcome; the
 * ward's answer is still recorded on its own copy (`ACCEPT_REFERRAL` or `DECLINE_REFERRAL`), and
 * the decision clock keeps running until it is. No ward is suggested from either record (D-71).
 */

/** The desks a referral can be assigned to. The coordinator assigns to any; the others take it themselves. */
export const REFERRAL_OWNER_DESKS = ["coordinator", "ed", "community"] as const;
export type ReferralOwnerDesk = (typeof REFERRAL_OWNER_DESKS)[number];

/** What the person rung said. A call never answers the referral: see this file's header. */
export const REFERRAL_CONTACT_OUTCOMES = [
  { id: "said_yes", label: "Said yes" },
  { id: "said_no", label: "Said no" },
  { id: "call_back", label: "Call back later" },
  { id: "no_answer", label: "No answer" },
] as const;
export type ReferralContactOutcome = (typeof REFERRAL_CONTACT_OUTCOMES)[number]["id"];

/** Runtime id list for the reducer's membership check. */
export const REFERRAL_CONTACT_OUTCOME_IDS: readonly ReferralContactOutcome[] = REFERRAL_CONTACT_OUTCOMES.map(
  (entry) => entry.id,
);

export function referralContactOutcomeLabel(outcome: ReferralContactOutcome): string {
  return REFERRAL_CONTACT_OUTCOMES.find((entry) => entry.id === outcome)?.label ?? "Outcome not recorded";
}

/** Who was rung: a ward by id, a community team by id, or the referrer (a person outside this system). */
export type ReferralContactTarget =
  { kind: "psychiatric_ward"; unitId: string } | { kind: "community_team"; teamId: string } | { kind: "referrer" };

export const REFERRAL_CONTACT_TARGET_KINDS: readonly ReferralContactTarget["kind"][] = [
  "psychiatric_ward",
  "community_team",
  "referrer",
];
