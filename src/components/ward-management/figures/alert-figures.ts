/**
 * Figure dictionary rows: ALERTS, DECISIONS AND REFERRALS (figures spec 2.5, 2.6 and 3.2, D-220).
 * Each row references its function in its home module; see `figure-row.ts`.
 *
 * Home's three honest figures, named so the words can say how they relate (Q260, A9-04):
 * Act now (7 on the seed), Needs you = act now + referrals to decide (13), and the bell's Open
 * alerts = act now + waiting (16).
 *
 * D-221 (14 Nov 2026): a late arrival and a diverted transport are act-now rows, so they count in Act
 * now and the bell. On the seed WF-015 reads late, which moved its row from waiting (the old booking
 * estimate row) to Act now: Act now 6 to 7, Needs you 12 to 13, Open alerts still 16. The `late` row
 * below is the one rule those rows are raised from.
 */
import { teamReferralsToAnswer } from "@/components/ward-management/community/team-2026/team-referral-count";
import { needsYouCount, referralsAwaitingDecision } from "@/components/ward-management/figures/decision-counts";
import { defineFigure } from "@/components/ward-management/figures/figure-row";
import { alertsNowFigures } from "@/components/ward-management/ward-alerts-figures";
import { arrivalTiming } from "@/components/ward-management/ward-arrival-timing";

export const ACT_NOW_FIGURE = defineFigure({
  id: "act-now",
  name: "Act now",
  rule: "Act-now task rows that are not snoozed, including late arrivals and diverted transport, plus accepted referrals with no bed pulled.",
  window: "now",
  windowId: "now",
  population: "The desk's open task rows",
  scope: "desk",
  status: "built",
  compute: alertsNowFigures,
  home: "`alertsNowFigures(...).actNow` (`ward-alerts-figures.ts`)",
  how: [
    "Task rows due now or overdue.",
    "A late arrival or a diverted transport counts here (D-221).",
    "A ward's acceptance with no bed pulled counts here too.",
  ],
  basis: "Q260, A9-04, D-221",
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
  how: [
    "Act now plus the rows waiting on somebody else.",
    "Late arrivals and diverted transport are in Act now, so the bell counts them (D-221).",
    "A countdown still running is not yet late.",
  ],
  basis: "Q260, D-221",
});

export const LATE_FIGURE = defineFigure({
  id: "late",
  name: "Late arrival",
  rule: "An open journey not yet arrived, more than the signed 1 hour past its expected arrival time.",
  window: "now",
  windowId: "now",
  population: "Open journeys with an expected arrival time",
  scope: "patient",
  status: "built",
  compute: arrivalTiming,
  home: '`arrivalTiming(...).state === "late"` (`ward-arrival-timing.ts`)',
  how: [
    "The expected time is the ward's ETA, else the booking estimate.",
    "From 10 minutes past it reads Past ETA, a review row; after the signed hour it is late, an act-now row.",
    "A diverted journey, or one transport has marked arrived, is not late.",
  ],
  basis: "D-221",
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
