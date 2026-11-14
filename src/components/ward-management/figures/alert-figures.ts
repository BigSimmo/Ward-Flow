/**
 * Figure dictionary rows: ALERTS, DECISIONS AND REFERRALS (figures spec 2.5, 2.6 and 3.2, D-220).
 * Each row references its function in its home module; see `figure-row.ts`.
 *
 * Home's three honest figures, named so the words can say how they relate (Q260, A9-04):
 * Act now (6 on the seed), Needs you = act now + referrals to decide (12), and the bell's Open
 * alerts = act now + waiting (16).
 *
 * The Late area (D-221) adds Late and diverted to Act now and the bell, and a `late` row here, when
 * it lands; coordinate this file.
 */
import { teamReferralsToAnswer } from "@/components/ward-management/community/team-2026/team-referral-count";
import { needsYouCount, referralsAwaitingDecision } from "@/components/ward-management/figures/decision-counts";
import { defineFigure } from "@/components/ward-management/figures/figure-row";
import { alertsNowFigures } from "@/components/ward-management/ward-alerts-figures";

export const ACT_NOW_FIGURE = defineFigure({
  id: "act-now",
  name: "Act now",
  rule: "Act-now task rows that are not snoozed, plus accepted referrals with no bed pulled.",
  window: "now",
  windowId: "now",
  population: "The desk's open task rows",
  scope: "desk",
  status: "built",
  compute: alertsNowFigures,
  home: "`alertsNowFigures(...).actNow` (`ward-alerts-figures.ts`)",
  how: ["Task rows due now or overdue.", "A ward's acceptance with no bed pulled counts here too."],
  basis: "Q260, A9-04",
});

export const NEEDS_YOU_FIGURE = defineFigure({
  id: "needs-you",
  name: "Needs you",
  rule: "Act now plus the referrals awaiting a decision.",
  window: "now",
  windowId: "now",
  population: "The desk's act-now rows and referral queue",
  scope: "desk",
  status: "built",
  compute: needsYouCount,
  home: "`needsYouCount` (`figures/decision-counts.ts`)",
  how: ["Act now, plus each referral still waiting on a decision."],
  basis: "A9-04 (a sum already ruled, now named)",
});

export const OPEN_ALERTS_FIGURE = defineFigure({
  id: "open-alerts",
  name: "Open alerts",
  rule: "Act now plus waiting task rows; running countdowns are listed, not counted.",
  window: "now",
  windowId: "now",
  population: "The desk's open task rows",
  scope: "desk",
  status: "built",
  compute: alertsNowFigures,
  home: "`alertsNowFigures(...).outstanding` (`ward-alerts-figures.ts`)",
  how: ["Act now plus the rows waiting on somebody else.", "A countdown still running is not yet late."],
  basis: "Q260",
});

export const REFERRALS_AWAITING_FIGURE = defineFigure({
  id: "referrals-awaiting",
  name: "Awaiting a decision",
  rule: "Referrals no destination has accepted, not all declined, with a destination still awaiting an answer.",
  window: "now",
  windowId: "now",
  population: "Shared referrals",
  scope: "desk",
  status: "built",
  compute: referralsAwaitingDecision,
  home: "`referralsAwaitingDecision` (`figures/decision-counts.ts`)",
  how: ["A referral whose destinations were all withdrawn is not counted (O-17.11)."],
  basis: "O-17.11",
  rail: { id: "referrals" },
});

export const TEAM_REFERRALS_TO_ANSWER_FIGURE = defineFigure({
  id: "team-referrals-to-answer",
  name: "Referrals to answer",
  rule: "The team's referrals not yet answered.",
  window: "now",
  windowId: "now",
  population: "The community team's referral list",
  scope: "team",
  status: "built",
  compute: teamReferralsToAnswer,
  home: "`teamReferralsToAnswer` (`community/team-2026/team-referral-count.ts`)",
  how: ["The team's referral list less the answers already recorded."],
  basis: "R-STRUCT-24; D-220",
  rail: { id: "referrals", desk: "team" },
});
