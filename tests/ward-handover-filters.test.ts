// tests/ward-handover-filters.test.ts
//
// Owner ruling 2026-09-09 (docs/ward-flow/owner-decisions-2026-09-09.md): the handover page is
// fully filterable by Service, Ward, ED or Community team, and — unlike every other Ward Flow
// screen — the filter EXCLUDES. Three conditions came with that ruling and each has its own
// section below: the scope resolves to a real name, the join that decides what is "in scope" is
// exercised on real and constructed data, and — the safety-critical piece — a breach outside the
// filter is still found.
//
// ⚠️ WHY THIS DRIVES THE EXPORTED FUNCTIONS RATHER THAN MIRRORING THEM. A test that re-implements
// the join it is checking guards nothing: revert the component and every assertion stays green,
// because the assertions exercise the copy of the logic living in the test file. Same reasoning
// tests/ward-handover-destination-truthfulness.test.ts already gives for driving `destinationCell`
// directly instead of copying its rule.

import { describe, expect, it } from "vitest";

import {
  handoverScopeLabel,
  handoverScopeValue,
  movementInHandoverScope,
  movementIsUrgent,
  parseHandoverScope,
  urgentMovementsOutsideScope,
  type HandoverScope,
} from "../src/components/ward-management/handover/handover-page";
import { COMMUNITY_TEAM_PAGES } from "../src/components/ward-management/community/community-derivations";
import { handoverSnapshot, isOpen } from "../src/components/ward-management/ward-derivations";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import type { Movement, Referral } from "../src/components/ward-management/ward-model";

const { movements, units, referrals } = seedWardFlowState();
const openMovements = movements.filter(isOpen);

/** A complete, minimal open movement — every required field, nothing optional set unless a test
 *  needs it. Copied from the real fixture's own minimal shape (WF-018) rather than invented, so a
 *  future required field added to `Movement` fails this file loudly instead of silently omitting
 *  it from every constructed fixture below. */
function baseMovement(overrides: Partial<Movement> & { id: string; originEdId: string }): Movement {
  return {
    openedAt: NOW_ANCHOR - 40,
    flaggedUrgent: false,
    urgency: 3,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    specialling: false,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "placement_requested",
    owner: "ED mental health team",
    referredUnitIds: [],
    declines: [],
    blocker: "Test fixture",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    ...overrides,
  };
}

describe("parseHandoverScope / handoverScopeValue round-trip", () => {
  it("round-trips the whole network", () => {
    expect(parseHandoverScope(handoverScopeValue({ kind: "network" }))).toEqual({ kind: "network" });
  });

  it("round-trips a service, a ward, an ED and a community team", () => {
    const cases: HandoverScope[] = [
      { kind: "service", id: "South Metro" },
      { kind: "ward", id: "rph-adult-secure" },
      { kind: "ed", id: "rph-ed" },
      { kind: "team", id: "some-team-slug" },
    ];
    for (const scope of cases) {
      expect(parseHandoverScope(handoverScopeValue(scope))).toEqual(scope);
    }
  });

  it("falls back to the whole network for a value its own <select> would never produce", () => {
    // The safe reading: an unrecognised value must show MORE than a broken filter would hide,
    // never less — so it resolves to network, never to an empty or arbitrary scope.
    expect(parseHandoverScope("nonsense")).toEqual({ kind: "network" });
    expect(parseHandoverScope("ward-with-no-colon")).toEqual({ kind: "network" });
    expect(parseHandoverScope("service:Not A Real Service")).toEqual({ kind: "network" });
  });
});

describe("handoverScopeLabel", () => {
  it("names the whole network", () => {
    expect(handoverScopeLabel({ kind: "network" }, units)).toBe("Whole network");
  });

  it("names a real ward, ED, service and community team", () => {
    const someUnit = units[0];
    expect(handoverScopeLabel({ kind: "ward", id: someUnit.id }, units)).toBe(someUnit.name);
    expect(handoverScopeLabel({ kind: "ed", id: "rph-ed" }, units)).toBe("Royal Perth Hospital Emergency Department");
    expect(handoverScopeLabel({ kind: "service", id: "East Metro" }, units)).toBe("East Metro");
  });

  it("resolves undefined for an id that names nothing real — never a guessed name", () => {
    expect(handoverScopeLabel({ kind: "ward", id: "no-such-ward" }, units)).toBeUndefined();
    expect(handoverScopeLabel({ kind: "ed", id: "no-such-ed" }, units)).toBeUndefined();
    expect(handoverScopeLabel({ kind: "team", id: "no-such-team" }, units)).toBeUndefined();
  });
});

describe("movementInHandoverScope — network", () => {
  it("the whole network scope includes every open movement in the real fixture", () => {
    // MUTATION TARGET: replacing `case "network": return true;` with `return false` (or with any
    // conditional) turns this red immediately — it is what proves the default filter changes
    // nothing, at the join level rather than only at the rendered page.
    for (const movement of openMovements) {
      expect(movementInHandoverScope(movement, { kind: "network" }, units, referrals)).toBe(true);
    }
  });

  it("the default (whole-network) filtered population is byte-identical to the unfiltered open population", () => {
    const filtered = openMovements.filter((movement) =>
      movementInHandoverScope(movement, { kind: "network" }, units, referrals),
    );
    expect(filtered).toEqual(openMovements);

    // And feeding that population through the same `handoverSnapshot` this page renders from
    // reproduces exactly what the page showed before this filter existed — the four sections'
    // population is untouched by the whole-network scope.
    const snapshotAtNetworkScope = handoverSnapshot(filtered, units, NOW_ANCHOR);
    const snapshotUnfiltered = handoverSnapshot(movements, units, NOW_ANCHOR);
    expect(snapshotAtNetworkScope.longestWaits.map((entry) => entry.movement.id)).toEqual(
      snapshotUnfiltered.longestWaits.map((entry) => entry.movement.id),
    );
    expect(snapshotAtNetworkScope.pulledBeds.map((entry) => entry.movement.id)).toEqual(
      snapshotUnfiltered.pulledBeds.map((entry) => entry.movement.id),
    );
    expect(snapshotAtNetworkScope.inTransit.map((entry) => entry.movement.id)).toEqual(
      snapshotUnfiltered.inTransit.map((entry) => entry.movement.id),
    );
    expect(snapshotAtNetworkScope.placementGoneWrong.map((entry) => entry.movement.id)).toEqual(
      snapshotUnfiltered.placementGoneWrong.map((entry) => entry.movement.id),
    );
  });
});

describe("movementInHandoverScope — ED", () => {
  it("matches exactly the origin department, real fixture", () => {
    // WF-018 (real, seeded) opens at scgh-ed.
    const wf018 = movements.find((movement) => movement.id === "WF-018");
    if (wf018 === undefined) throw new Error("WF-018 missing from the seeded fixture — this test's precondition");
    expect(movementInHandoverScope(wf018, { kind: "ed", id: "scgh-ed" }, units, referrals)).toBe(true);
    expect(movementInHandoverScope(wf018, { kind: "ed", id: "rph-ed" }, units, referrals)).toBe(false);
  });
});

describe("movementInHandoverScope — ward", () => {
  const acceptedElsewhere = baseMovement({
    id: "WF-TEST-ACCEPTED",
    originEdId: "rph-ed",
    acceptedUnitId: "fsh-adult-secure",
  });
  const askedNotAccepted = baseMovement({
    id: "WF-TEST-ASKED",
    originEdId: "rph-ed",
    referredUnitIds: ["fsh-adult-secure"],
  });
  const untouched = baseMovement({ id: "WF-TEST-UNTOUCHED", originEdId: "rph-ed" });

  it("matches a ward that accepted the movement", () => {
    expect(movementInHandoverScope(acceptedElsewhere, { kind: "ward", id: "fsh-adult-secure" }, units, referrals)).toBe(
      true,
    );
  });

  it("matches a ward that was asked but has not yet accepted — a handover needs to see who is being chased", () => {
    expect(movementInHandoverScope(askedNotAccepted, { kind: "ward", id: "fsh-adult-secure" }, units, referrals)).toBe(
      true,
    );
  });

  it("does not match a ward the movement has neither been referred to nor accepted at", () => {
    expect(movementInHandoverScope(untouched, { kind: "ward", id: "fsh-adult-secure" }, units, referrals)).toBe(false);
  });
});

describe("movementInHandoverScope — service", () => {
  // rph-ed sits at Royal Perth Hospital, service East Metro (ward-sites.ts).
  const fromRphEd = baseMovement({ id: "WF-TEST-SVC-ORIGIN", originEdId: "rph-ed" });
  // sjgs-adult-secure sits at St John of God Subiaco, service Private — reached only via the
  // WARD half of the join, never the origin ED, proving the two halves are actually both wired.
  const acceptedAtPrivateWard = baseMovement({
    id: "WF-TEST-SVC-WARD",
    originEdId: "rph-ed",
    acceptedUnitId: "sjgs-adult-secure",
  });

  it("matches via the origin department's own service", () => {
    expect(movementInHandoverScope(fromRphEd, { kind: "service", id: "East Metro" }, units, referrals)).toBe(true);
    expect(movementInHandoverScope(fromRphEd, { kind: "service", id: "Private" }, units, referrals)).toBe(false);
  });

  it("matches via an accepted ward's service, even when the origin ED belongs to a different one", () => {
    // MUTATION TARGET: dropping the ward half of the service join (returning only the origin-ED
    // comparison) leaves this red — the movement opened at an East Metro ED but was accepted at
    // a Private ward, and only the ward half can find that.
    expect(movementInHandoverScope(acceptedAtPrivateWard, { kind: "service", id: "Private" }, units, referrals)).toBe(
      true,
    );
    expect(
      movementInHandoverScope(acceptedAtPrivateWard, { kind: "service", id: "East Metro" }, units, referrals),
    ).toBe(true);
    expect(
      movementInHandoverScope(acceptedAtPrivateWard, { kind: "service", id: "South Metro" }, units, referrals),
    ).toBe(false);
  });
});

describe("movementInHandoverScope — community team", () => {
  const teamName = "Fixture Community Team";
  const referralToTeam: Referral = {
    id: "WF-TEST-REFERRAL-TEAM",
    destinations: [{ destination: { kind: "community_team", teamName }, state: "queued" }],
    ageBand: "Adult",
    homeRegion: "Perth Metropolitan",
    suburb: { status: "known", suburb: "Test Suburb", region: "Perth Metropolitan" } as unknown as Referral["suburb"],
    source: "community",
    history: "",
    raisedAt: NOW_ANCHOR - 100,
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
  };
  const unlinkedMovement = baseMovement({ id: "WF-TEST-TEAM-UNLINKED", originEdId: "rph-ed" });
  const testReferrals = [...referrals, referralToTeam];

  it("never matches a movement carrying no referralId at all — the ordinary case for most movements", () => {
    expect(movementInHandoverScope(unlinkedMovement, { kind: "team", id: "any-team" }, units, testReferrals)).toBe(
      false,
    );
  });

  it("never matches a scope id that resolves to no real community team", () => {
    const linkedMovement = baseMovement({
      id: "WF-TEST-TEAM-LINKED",
      originEdId: "rph-ed",
      referralId: "WF-TEST-REFERRAL-TEAM",
    });
    // A `<select>` can only ever offer ids `communityTeamById` resolves, but the join must still
    // fail closed (never guess a match) for an id that names nothing real.
    expect(movementInHandoverScope(linkedMovement, { kind: "team", id: "no-such-team" }, units, testReferrals)).toBe(
      false,
    );
  });

  it("matches against a real seeded community team once a movement's referral is linked to it", () => {
    const realTeam = COMMUNITY_TEAM_PAGES[0];
    if (realTeam === undefined) throw new Error("no seeded community team — this test's precondition");
    const referralToRealTeam: Referral = {
      ...referralToTeam,
      id: "WF-TEST-REFERRAL-REAL-TEAM",
      destinations: [{ destination: { kind: "community_team", teamName: realTeam.name }, state: "queued" }],
    };
    const linkedToReal = baseMovement({
      id: "WF-TEST-TEAM-LINKED-REAL",
      originEdId: "rph-ed",
      referralId: "WF-TEST-REFERRAL-REAL-TEAM",
    });
    expect(
      movementInHandoverScope(linkedToReal, { kind: "team", id: realTeam.id }, units, [
        ...referrals,
        referralToRealTeam,
      ]),
    ).toBe(true);
    // A movement whose referral names a DIFFERENT destination kind (an ED, never a team) must
    // never be mistaken for a community-team match.
    const referralToEd: Referral = {
      ...referralToTeam,
      id: "WF-TEST-REFERRAL-ED",
      destinations: [
        { destination: { kind: "emergency_department", edId: "rph-ed", purpose: "bed" }, state: "queued" },
      ],
    };
    const linkedToEdInstead = baseMovement({
      id: "WF-TEST-TEAM-LINKED-ED",
      originEdId: "rph-ed",
      referralId: "WF-TEST-REFERRAL-ED",
    });
    expect(
      movementInHandoverScope(linkedToEdInstead, { kind: "team", id: realTeam.id }, units, [
        ...referrals,
        referralToEd,
      ]),
    ).toBe(false);
  });
});

describe("movementIsUrgent", () => {
  const flaggedOnly = baseMovement({ id: "WF-TEST-FLAGGED", originEdId: "rph-ed", flaggedUrgent: true });
  const breachedOnly = baseMovement({
    id: "WF-TEST-BREACHED",
    originEdId: "rph-ed",
    legalForm: { code: "4A", dueAt: NOW_ANCHOR - 10 },
  });
  const dueButNotBreached = baseMovement({
    id: "WF-TEST-DUE",
    originEdId: "rph-ed",
    legalForm: { code: "4A", dueAt: NOW_ANCHOR + 500 },
  });
  const neither = baseMovement({ id: "WF-TEST-NEITHER", originEdId: "rph-ed" });

  it("is urgent when flaggedUrgent is set, with no legal form at all", () => {
    // MUTATION TARGET: dropping the `if (movement.flaggedUrgent) return true;` branch leaves this
    // red, because this fixture has no legalForm for the breach check to fall back on.
    expect(movementIsUrgent(flaggedOnly, NOW_ANCHOR)).toBe(true);
  });

  it("is urgent when the legal deadline has already passed, with flaggedUrgent false", () => {
    // MUTATION TARGET: dropping the legal-breach branch (or comparing the wrong clock state)
    // leaves this red, because this fixture is not flagged.
    expect(movementIsUrgent(breachedOnly, NOW_ANCHOR)).toBe(true);
  });

  it("is not urgent for a legal deadline that has not yet passed", () => {
    expect(movementIsUrgent(dueButNotBreached, NOW_ANCHOR)).toBe(false);
  });

  it("is not urgent with neither signal present", () => {
    expect(movementIsUrgent(neither, NOW_ANCHOR)).toBe(false);
  });
});

describe("urgentMovementsOutsideScope — the safety-critical join", () => {
  // CONSTRUCTED, not hoped-for: a movement flagged urgent, opened at an ED that is definitely
  // outside the chosen ward filter (no accepted or referred unit anywhere near it), sitting
  // alongside an ordinary, non-urgent movement that is ALSO outside the filter (to prove the
  // urgent one is picked out specifically, not merely "something outside the filter reappears").
  const urgentElsewhere = baseMovement({
    id: "WF-TEST-URGENT-ELSEWHERE",
    originEdId: "scgh-ed",
    flaggedUrgent: true,
  });
  const ordinaryElsewhere = baseMovement({
    id: "WF-TEST-ORDINARY-ELSEWHERE",
    originEdId: "scgh-ed",
  });
  const insideTheFilter = baseMovement({
    id: "WF-TEST-INSIDE",
    originEdId: "rph-ed",
    acceptedUnitId: "rph-adult-secure",
    flaggedUrgent: true,
  });
  const pool = [urgentElsewhere, ordinaryElsewhere, insideTheFilter];
  const wardScope: HandoverScope = { kind: "ward", id: "rph-adult-secure" };

  it("names the urgent movement outside the filter, and nothing else", () => {
    const result = urgentMovementsOutsideScope(pool, wardScope, units, referrals, NOW_ANCHOR);
    expect(result.map((movement) => movement.id)).toEqual(["WF-TEST-URGENT-ELSEWHERE"]);
  });

  it("never names an urgent movement that the filter itself already includes", () => {
    // MUTATION TARGET: removing the `!movementInHandoverScope(...)` half of the predicate (so it
    // reads only `movementIsUrgent`) would wrongly include WF-TEST-INSIDE here even though the
    // filter already shows it — this is the assertion that catches exactly that mutation.
    const result = urgentMovementsOutsideScope(pool, wardScope, units, referrals, NOW_ANCHOR);
    expect(result.map((movement) => movement.id)).not.toContain("WF-TEST-INSIDE");
  });

  it("names nothing when the excluded population has no urgent movement", () => {
    const result = urgentMovementsOutsideScope(
      [ordinaryElsewhere, insideTheFilter],
      wardScope,
      units,
      referrals,
      NOW_ANCHOR,
    );
    expect(result).toEqual([]);
  });

  it("real fixture: filtering to an ED that WF-018 is not at surfaces it as urgent-outside-filter", () => {
    const scope: HandoverScope = { kind: "ed", id: "rph-ed" };
    const result = urgentMovementsOutsideScope(openMovements, scope, units, referrals, NOW_ANCHOR);
    expect(result.map((movement) => movement.id)).toContain("WF-018");
  });
});
