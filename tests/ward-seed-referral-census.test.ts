// tests/ward-seed-referral-census.test.ts
/**
 * K1 (build plan `2026-09-17-build-plan-screens.md` §4, item 56 census).
 *
 * Pins a census of `seedWardFlowState().referrals` — counts by source and by `referralState`,
 * the queued-id list, per-community-team counts as the community hub (`community-screen.tsx`)
 * derives them, the `wardNavCounts` referrals figure, and the statistics referral-to-bed figures
 * (`statistics-screen.tsx`, via `referralToBedJoin`) — so K2's rewrite of `history:` strings and
 * K3's later additions have a green catcher: if either changes anything about WHO is referred,
 * WHAT they are referred for, or WHOM they are referred to, this file goes red first.
 *
 * Every literal below was read off one run of the real seed, never hand-derived — each has its
 * own comment naming what it counts. This file makes NO claim about which figures are "right",
 * only about what the seed currently produces.
 */
import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { isAwaitingTeamAnswer } from "../src/components/ward-management/community/community-derivations";
import { referralToBedJoin } from "../src/components/ward-management/statistics/statistics-derivations";
import { wardNavCounts } from "../src/components/ward-management/ward-nav-counts";
import {
  REFERRAL_SOURCES,
  REFERRAL_STATES,
  type Referral,
  type ReferralSource,
} from "../src/components/ward-management/ward-model";
import { referralState } from "../src/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/** The team a `community_team` addressing on `referral` names, or `undefined` if none does. */
function communityAddressingFor(referral: Referral, teamName: string) {
  return referral.destinations.find(
    (addressing) => addressing.destination.kind === "community_team" && addressing.destination.teamName === teamName,
  );
}

describe("K1 — seedWardFlowState() referral census (2026-09-17 pin)", () => {
  const seeded = seedWardFlowState();
  const { referrals } = seeded;

  it("seeds exactly 31 referrals — 21 literal RF- rows plus the nine Midland demonstration rows plus RF-RD06", () => {
    // 24 -> 30 (2026-09-17 sample-data pass, K3, build plan §4 task 2, owner request "add more
    // sample data" answering the plan's own Q2 "new example referrals": yes): RF-016..RF-021
    // added, six already-decided referrals, none queued.
    // 30 -> 31 (2026-09-25 seed growth, audit follow-up): RF-RD06 added, a new queued referral
    // sourced psychiatric_ward (a new source with no prior referral of this kind).
    expect(referrals.length).toBe(31);
  });

  it("counts referrals by source", () => {
    const bySource: Record<ReferralSource, number> = {
      community: 0,
      crisis_service: 0,
      police: 0,
      ambulance: 0,
      inter_hospital: 0,
      ed_medical: 0,
      gp: 0,
      psychiatric_ward: 0,
    };
    for (const referral of referrals) bySource[referral.source] += 1;

    // K3 (2026-09-17): community 11->12 (RF-017), crisis_service 2->3 (RF-020), police 3->4
    // (RF-018), ambulance 5->6 (RF-019), inter_hospital 3->4 (RF-021), gp 0->1 (RF-016 — this
    // fixture's first "gp"-sourced referral; the source was added by owner answer 25, 17 Sept
    // 2026, and nothing here had used it until now). ed_medical stays 0.
    // 2026-09-25: psychiatric_ward 0->1 (RF-RD06, this fixture's first psychiatric_ward-sourced
    // referral).
    expect(bySource).toEqual<Record<ReferralSource, number>>({
      community: 12, // includes all nine Midland demonstration rows, whose `source` is "community"
      crisis_service: 3,
      police: 4,
      ambulance: 6,
      inter_hospital: 4, // includes RF-010 (the Inner City Clinic referral)
      ed_medical: 0, // no seeded referral currently reports this source
      gp: 1, // RF-016, this fixture's first
      psychiatric_ward: 1, // RF-RD06, this fixture's first
    });
    // Anti-vacuity: every referral was bucketed exactly once, none dropped and none double-counted.
    expect(Object.values(bySource).reduce((sum, count) => sum + count, 0)).toBe(referrals.length);
    expect(REFERRAL_SOURCES.length).toBe(8); // the source list this breakdown must stay exhaustive over
  });

  it("counts referrals by referralState (queued/accepted/declined, derived from destinations)", () => {
    const byState: Record<(typeof REFERRAL_STATES)[number], number> = { queued: 0, accepted: 0, declined: 0 };
    for (const referral of referrals) byState[referralState(referral)] += 1;

    // K3 (2026-09-17): accepted 17->22 (RF-016, RF-017, RF-019, RF-020, RF-021 — five of the six
    // new rows), declined 1->2 (RF-018, the one new decline). queued is UNCHANGED at 6: K3's own
    // brief requires "none queued", so the queue this file's own next test pins is untouched.
    // 2026-09-25: queued 6->7 (RF-RD06, the new referral, is queued).
    expect(byState).toEqual({
      queued: 7,
      accepted: 22, // includes all nine Midland rows and RF-010, each accepted to its one community team
      declined: 2,
    });
    // Anti-vacuity: the three states partition every referral with none left over.
    expect(byState.queued + byState.accepted + byState.declined).toBe(referrals.length);
  });

  it("pins the sorted list of queued referral ids", () => {
    const queuedIds = referrals
      .filter((referral) => referralState(referral) === "queued")
      .map((referral) => referral.id)
      .sort();

    // Lexicographic sort equals numeric sort here: every queued id shares the "RF-0" prefix and a
    // fixed-width three-digit suffix. The same six ids are pinned in referral-urgency order by
    // `tests/ward-referral-model.test.ts:1289` (["RF-001","RF-009","RF-005","RF-015","RF-014","RF-011"]) —
    // this is the same set, sorted a different way, for a different purpose (a stable census, not a
    // display order).
    // 2026-09-25: RF-RD06 (the new referral) joins the queue, sorting last (lexicographic "RF-0"
    // < "RF-R").
    expect(queuedIds).toEqual(["RF-001", "RF-005", "RF-009", "RF-011", "RF-014", "RF-015", "RF-RD06"]);
    expect(queuedIds.length).toBeGreaterThan(0); // anti-vacuity: the queue is not empty
  });

  it("pins per-community-team counts, derived the way the community hub (community-screen.tsx) derives them", () => {
    // The hub's `referralsWaitingOnTeam` reads each referral's own addressing to the named team and
    // asks `isAwaitingTeamAnswer` of it — never the referral's overall `referralState`, because FD-24
    // means a referral can be queued to one destination while another has already been decided.
    // `isAwaitingTeamAnswer` is exported and used verbatim below; `communityAddressingFor` above
    // mirrors the hub's own same-named, unexported helper exactly.
    const teamNames = [
      ...new Set(
        referrals.flatMap((referral) =>
          referral.destinations
            .filter((addressing) => addressing.destination.kind === "community_team")
            .map((addressing) => (addressing.destination as { teamName: string }).teamName),
        ),
      ),
    ].sort();

    // Closed enumeration: exactly two teams are named on any seeded referral. If a future seed
    // change names a third, this line goes red before the per-team figures below could silently
    // stop being exhaustive.
    expect(teamNames).toEqual(["Inner City Clinic", "Midland"]);

    const teamFigures = teamNames.map((teamName) => {
      const named = referrals.filter((referral) => communityAddressingFor(referral, teamName) !== undefined);
      const waiting = named.filter((referral) => isAwaitingTeamAnswer(communityAddressingFor(referral, teamName)));
      return { teamName, namedCount: named.length, waitingCount: waiting.length };
    });

    expect(teamFigures).toEqual([
      // RF-010, accepted 2026-09 — the referral's ONE addressing to this team is already decided.
      { teamName: "Inner City Clinic", namedCount: 1, waitingCount: 0 },
      // The nine Midland demonstration rows, every one accepted — none is still awaiting an answer.
      { teamName: "Midland", namedCount: 9, waitingCount: 0 },
    ]);
    // Anti-vacuity: the population each team is drawn from is non-empty, even though the hub's own
    // "still waiting" figure happens to be nought for both — a nought here is a measured fact (every
    // addressing to a community team in this seed has already been decided), not an unexercised path.
    const namedTotal = teamFigures.reduce((sum, team) => sum + team.namedCount, 0);
    expect(namedTotal).toBeGreaterThan(0);
    expect(namedTotal).toBe(10); // 1 Inner City Clinic + 9 Midland
  });

  it("pins the wardNavCounts referrals figure", () => {
    const counts = wardNavCounts({
      movements: seeded.movements,
      units: seeded.units,
      referrals: seeded.referrals,
      bedReleases: seeded.bedReleases,
      leaveBeds: seeded.leaveBeds,
      now: NOW_ANCHOR, // seedWardFlowState() carries clockOffsetMinutes: 0, so "now" is the anchor itself
    });

    // Queued AND still genuinely awaiting an answer (WF-13: excludes a withdrawn destination). No
    // seeded referral carries `withdrawnAt`, so this equals the queued count pinned above (7,
    // 2026-09-25: was 6 before RF-RD06).
    expect(counts.referrals).toEqual({ value: 7, noun: "awaiting a decision", urgent: false });
    expect(counts.referrals?.value).toBeGreaterThan(0); // anti-vacuity
  });

  it("pins the statistics referral-to-bed figures (referralToBedJoin, statistics-screen.tsx)", () => {
    const join = referralToBedJoin(seeded.admissions, seeded.referrals);

    expect(join).toEqual({
      withReferralIdCount: 10, // admissions carrying a non-null referralId
      joinedCount: 10, // of those, every id resolves to a referral on record (zero dangling)
      chronologicallyCoherentCount: 10, // and every resolved pair has the admission arriving no earlier than the referral was raised
      // 24 -> 30 (K3, 2026-09-17): the population searched grows with the referral census above;
      // no admission's referralId names any of the six new rows, so the other three figures are
      // untouched.
      // 30 -> 31 (2026-09-25): RF-RD06 joins the searched population; no admission references it,
      // so the other three figures stay untouched.
      referralsSearchedCount: 31, // the full seeded referral population, i.e. this file's own total above
    });
    expect(join.referralsSearchedCount).toBe(referrals.length); // ties this figure to the census total, not a second hand-typed 24
    expect(join.withReferralIdCount).toBeGreaterThan(0); // anti-vacuity
  });
});
