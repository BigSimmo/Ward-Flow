import { describe, expect, it } from "vitest";

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  COMMUNITY_DECLINE_REASONS,
  ED_DECLINE_REASONS,
  REFERRAL_DECLINE_REASONS,
  type ReferralDestination,
} from "@/components/ward-management/ward-model";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";
/**
 * WHO MAY ANSWER WHICH DESTINATION — and it is a NARROWING and a widening at once.
 *
 * `FD-3` was superseded by the owner: *"every referral is declinable, and NO CODE PATH MAY RENDER
 * A REFERRAL WITH NO DECLINE AFFORDANCE."* But `ACCEPT_REFERRAL` and `DECLINE_REFERRAL` permitted
 * only `["ward", "coordinator"]`, while the ED hub acts as `ed` — so an ED could not answer a
 * referral addressed to it, and the reducer's own else-branch for "an ED, a medical ward and a
 * community team are answered by a person or a team" was unreachable by the role that would use it.
 *
 * ⚠️ **AND THE AVAILABLE WORKAROUND WAS FOUND AND REFUSED, WHICH IS WHY THIS FILE EXISTS.**
 * Dispatching as `"ward"` or `"coordinator"` from the ED screen compiles, works, and writes a false
 * `decidedBy` — the reducer records `WARD_FLOW_ROLE_LABELS[event.role]`, so the record would say a
 * ward refused a patient that an emergency department refused. That is the exact defect
 * `decidedBy` exists to prevent, and nothing would have failed.
 *
 * ⚠️ **THE WIDENING ALONE WOULD HAVE BEEN TOO WIDE, WHICH IS THE HALF WORTH GUARDING.** Adding `ed`
 * to those two lists lets an emergency department accept a PSYCHIATRIC WARD destination — deciding
 * on a bed in a ward it has nothing to do with. A permission is never widened by accident, so the
 * role now has to match the destination it is answering: a ward answers ward destinations, an
 * emergency department answers emergency-department destinations, and the coordinator — the only
 * role that sees the whole picture — answers any of them.
 */
const NOW = NOW_ANCHOR;
const ED_ID = "peel-ed";
const WARD_DESTINATION: ReferralDestination = {
  kind: "psychiatric_ward",
  sex: "Female",
  gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
  secureBedNeeded: false,
  involuntaryBedNeeded: false,
  highAcuityNursingNeeded: false,
};
/**
 * A REAL team name, taken from the seed rather than invented: `community_team` destinations are
 * associated by the team NAMED ON THE REFERRAL (owner, 2026-08-31), not by home region, so an
 * invented name would be a destination no team owns.
 */
const COMMUNITY_DESTINATION: ReferralDestination = {
  kind: "community_team",
  teamName: COMMUNITY_TEAM_PAGES[0].name,
};

const ED_DESTINATION: ReferralDestination = {
  kind: "emergency_department",
  edId: ED_ID,
  purpose: "psychiatric_review",
};

function referralAddressedTo(destinations: ReferralDestination[]): { state: WardFlowState; referralId: string } {
  const state = wardFlowReducer(seedWardFlowState(), {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW,
    source: "community",
    originSiteCode: "RPH",
    ageBand: "Adult",
    homeRegion: "Perth Metropolitan",
    // A real suburb: `RECEIVE_REFERRAL` resolves it against the catchment table, so an invented
    // name would be refused before the rule this file is actually testing was ever reached.
    suburb: { kind: "named", name: "Armadale" },
    urgency: 2,
    ...FIXTURE_HISTORY,
    destinations,
  } as never);
  const referral = state.referrals[state.referrals.length - 1];
  return { state, referralId: referral.id };
}

/**
 * A reason genuinely valid for `destinationKind`, engine fix 2026-09-17: `DECLINE_REFERRAL`'s
 * membership check is now scoped to the destination that is answering (O-16.6), so a fixed
 * `"no_suitable_bed"` regardless of kind is refused outright for `emergency_department` (a
 * bed-shaped reason) and for `community_team` (a different vocabulary entirely, zero overlap in
 * meaning). This file is about WHO may answer WHICH destination, never about the reason
 * vocabulary, so every case here — permitted or refused — gets a reason its own destination kind
 * would actually accept; the role/destination-kind ownership check this file exists to prove
 * always runs before the reason check anyway, so a "refused" case here is refused for the reason
 * this file names, not a coincidentally-wrong reason.
 */
function declineReasonFor(destinationKind: string): string {
  if (destinationKind === "community_team") return COMMUNITY_DECLINE_REASONS[0];
  if (destinationKind === "emergency_department") return ED_DECLINE_REASONS[0];
  return REFERRAL_DECLINE_REASONS[0];
}

function decline(state: WardFlowState, referralId: string, role: string, destinationKind: string) {
  return wardFlowReducer(state, {
    type: "DECLINE_REFERRAL",
    role,
    now: NOW,
    referralId,
    destinationKind,
    reason: declineReasonFor(destinationKind),
  } as never);
}

// `unitId` matters only for `psychiatric_ward` — required there to reach `referralEligibility`,
// and rejected outright ("cannot name a unit") for the other kinds, so callers answering the ED
// destination simply omit it.
function accept(state: WardFlowState, referralId: string, role: string, destinationKind: string, unitId?: string) {
  return wardFlowReducer(state, {
    type: "ACCEPT_REFERRAL",
    role,
    now: NOW,
    referralId,
    destinationKind,
    unitId,
  } as never);
}

// A real unit that passes every `referralEligibility` gate against `WARD_DESTINATION` (Adult,
// Female, no secure/involuntary bed needed) at `NOW_ANCHOR`: `scgh-adult-open` is an Adult, Open,
// Undesignated, authorised, non-forensic unit with Female occupants already and fresh capacity —
// see `ward-referral-reducer.test.ts`, which accepts the same referral shape into this same unit.
const MATCHING_WARD_UNIT_ID = "scgh-adult-open";

describe("a role may only answer the destination it is", () => {
  const { state, referralId } = referralAddressedTo([WARD_DESTINATION, ED_DESTINATION]);

  it("built a referral carrying BOTH destinations, or nothing below discriminates", () => {
    // ⚠️ The canary. With one destination, "the ED may not answer the ward's" and "the ED may
    // answer its own" cannot both be observed, and a rule that permits everything would pass.
    expect(state.rejections, "the referral must have been accepted").toEqual([]);
    const referral = state.referrals.find((candidate) => candidate.id === referralId);
    expect(referral?.destinations.map((addressing) => addressing.destination.kind).sort()).toEqual([
      "emergency_department",
      "psychiatric_ward",
    ]);
  });

  it("permits ed, ward, coordinator and community to both ACCEPT and DECLINE", () => {
    /*
     * 🔴 THESE TWO LINES NO LONGER DIFFER — RB5 (item 16), 2026-09-17, SUPERSEDING THE RULING BELOW.
     *
     * Owner, 2026-09-06: a community team may DECLINE a referral addressed to it, and at the time he
     * did not say it may accept one — this test used to pin that asymmetry deliberately, down to a
     * comment warning that adding `community` to both lists "because they are adjacent" would be "a
     * decision no one took".
     *
     * The owner has since taken it: "a community team may accept, for follow-up only" (RB5, item
     * 16). Accepting still commits a service to taking the patient, but a COMMUNITY acceptance
     * commits it to FOLLOW-UP, never to a bed — see `referralState`'s own doc comment
     * (`ward-referrals.ts`) for how that distinction is kept once both lists agree here.
     */
    expect([...EVENT_ROLE.DECLINE_REFERRAL].sort()).toEqual(["community", "coordinator", "ed", "ward"]);
    expect([...EVENT_ROLE.ACCEPT_REFERRAL].sort()).toEqual(["community", "coordinator", "ed", "ward"]);
  });

  // ⚠️ Was missing until the `answerableBy` fail-safe-guard fix: every other decline case here
  // (ed↔ed, ed→ward, ward→ed, coordinator↔both) was covered, but a ward answering its OWN
  // destination never had a permitted case alongside its refused one (below).
  it("lets a WARD decline the destination addressed to IT", () => {
    const after = decline(state, referralId, "ward", "psychiatric_ward");
    expect(after.rejections).toEqual([]);
    const addressing = after.referrals
      .find((candidate) => candidate.id === referralId)
      ?.destinations.find((entry) => entry.destination.kind === "psychiatric_ward");
    expect(addressing?.state).toBe("declined");
  });

  it("lets an emergency department decline the destination addressed to IT", () => {
    const after = decline(state, referralId, "ed", "emergency_department");
    expect(after.rejections).toEqual([]);
    const addressing = after.referrals
      .find((candidate) => candidate.id === referralId)
      ?.destinations.find((entry) => entry.destination.kind === "emergency_department");
    expect(addressing?.state).toBe("declined");
    expect(
      addressing?.decidedBy,
      "the record must say an emergency department decided, not a ward — that is what decidedBy is for",
    ).toMatch(/emergency|ED/i);
  });

  it("⚠️ REFUSES AN EMERGENCY DEPARTMENT DECIDING ON A PSYCHIATRIC WARD'S BED", () => {
    const after = decline(state, referralId, "ed", "psychiatric_ward");
    expect(
      after.rejections.length,
      "an emergency department refused a bed in a ward it has nothing to do with. Widening the " +
        "role list without scoping it to the destination is what permits this, and the resulting " +
        "record reads as a legitimate refusal.",
    ).toBe(1);
    const addressing = after.referrals
      .find((candidate) => candidate.id === referralId)
      ?.destinations.find((entry) => entry.destination.kind === "psychiatric_ward");
    expect(addressing?.state, "the ward destination must be untouched").toBe("queued");
  });

  it("REFUSES A WARD DECIDING ON AN EMERGENCY DEPARTMENT'S REFERRAL — the same rule, mirrored", () => {
    // Stated in both directions, because a rule that only stopped `ed` would leave the original
    // over-wide permission in place for the role that already had it.
    const after = decline(state, referralId, "ward", "emergency_department");
    expect(after.rejections.length).toBe(1);
    const addressing = after.referrals
      .find((candidate) => candidate.id === referralId)
      ?.destinations.find((entry) => entry.destination.kind === "emergency_department");
    expect(addressing?.state).toBe("queued");
  });

  it("lets the COORDINATOR answer either, because it is the only role that sees the whole picture", () => {
    for (const kind of ["psychiatric_ward", "emergency_department"]) {
      const after = decline(state, referralId, "coordinator", kind);
      expect(after.rejections, `the coordinator must be able to answer ${kind}`).toEqual([]);
    }
  });

  /*
   * ACCEPT_REFERRAL mirrors every case above — same `answerableBy` guard, same five assertions,
   * proved separately because `ACCEPT_REFERRAL` takes a different path through the reducer (a
   * `psychiatric_ward` acceptance runs `referralEligibility` against a real unit; `DECLINE_REFERRAL`
   * never does). This is the pre/post-change behaviour-preservation proof for the fail-safe-guard
   * fix: `answerableBy` changed from a `Partial` record (a role absent from it passed unconditionally)
   * to a TOTAL record with an explicit `"any"` entry, and these five cases must read identically
   * before and after that change.
   */
  it("lets a WARD accept the destination addressed to IT", () => {
    const after = accept(state, referralId, "ward", "psychiatric_ward", MATCHING_WARD_UNIT_ID);
    expect(after.rejections).toEqual([]);
    const addressing = after.referrals
      .find((candidate) => candidate.id === referralId)
      ?.destinations.find((entry) => entry.destination.kind === "psychiatric_ward");
    expect(addressing?.state).toBe("accepted");
  });

  it("⚠️ REFUSES A WARD ACCEPTING AN EMERGENCY DEPARTMENT'S REFERRAL", () => {
    const after = accept(state, referralId, "ward", "emergency_department");
    expect(after.rejections.length).toBe(1);
    const addressing = after.referrals
      .find((candidate) => candidate.id === referralId)
      ?.destinations.find((entry) => entry.destination.kind === "emergency_department");
    expect(addressing?.state, "the ED destination must be untouched").toBe("queued");
  });

  it("lets an EMERGENCY DEPARTMENT accept the destination addressed to IT", () => {
    const after = accept(state, referralId, "ed", "emergency_department");
    expect(after.rejections).toEqual([]);
    const addressing = after.referrals
      .find((candidate) => candidate.id === referralId)
      ?.destinations.find((entry) => entry.destination.kind === "emergency_department");
    expect(addressing?.state).toBe("accepted");
  });

  it("⚠️ REFUSES AN EMERGENCY DEPARTMENT ACCEPTING A PSYCHIATRIC WARD'S BED", () => {
    const after = accept(state, referralId, "ed", "psychiatric_ward", MATCHING_WARD_UNIT_ID);
    expect(
      after.rejections.length,
      "an emergency department must not be able to decide on a bed in a ward it has nothing to do with",
    ).toBe(1);
    const addressing = after.referrals
      .find((candidate) => candidate.id === referralId)
      ?.destinations.find((entry) => entry.destination.kind === "psychiatric_ward");
    expect(addressing?.state, "the ward destination must be untouched").toBe("queued");
  });

  it("lets the COORDINATOR accept either, because it is the only role that sees the whole picture", () => {
    const wardAfter = accept(state, referralId, "coordinator", "psychiatric_ward", MATCHING_WARD_UNIT_ID);
    expect(wardAfter.rejections, "the coordinator must be able to accept psychiatric_ward").toEqual([]);
    const edAfter = accept(state, referralId, "coordinator", "emergency_department");
    expect(edAfter.rejections, "the coordinator must be able to accept emergency_department").toEqual([]);
  });
});

/**
 * 🔴 A COMMUNITY TEAM MAY DECLINE ITS OWN DESTINATION — owner ruling 2026-09-06 — AND NOTHING ELSE.
 *
 * Its own referral, carrying a community destination alongside a ward one, so "may answer its own"
 * and "may not answer the ward's" can both be observed. A single-destination fixture would let a
 * rule that permits everything pass.
 */
describe("a community team answers its own destination and no other", () => {
  const { state, referralId } = referralAddressedTo([WARD_DESTINATION, COMMUNITY_DESTINATION]);

  it("built a referral carrying BOTH destinations, or nothing below discriminates", () => {
    expect(state.rejections, "the referral must have been accepted").toEqual([]);
    const referral = state.referrals.find((candidate) => candidate.id === referralId);
    expect(referral?.destinations.map((addressing) => addressing.destination.kind).sort()).toEqual([
      "community_team",
      "psychiatric_ward",
    ]);
  });

  it("lets a COMMUNITY TEAM decline the destination addressed to IT", () => {
    const after = decline(state, referralId, "community", "community_team");
    expect(after.rejections, "a community team must be able to decline its own destination").toEqual([]);
    const addressing = after.referrals
      .find((candidate) => candidate.id === referralId)
      ?.destinations.find((entry) => entry.destination.kind === "community_team");
    expect(addressing?.state).toBe("declined");
  });

  it("⚠️ REFUSES A COMMUNITY TEAM DECLINING A PSYCHIATRIC WARD'S BED", () => {
    /*
     * 🔴 THE HOLE THE ROLE CHANGE WOULD HAVE OPENED ON ITS OWN. `answerableBy.community` was `"any"`,
     * and `"any"` skips the ownership check entirely — so permitting `community` to raise
     * `DECLINE_REFERRAL` without scoping the map would have let a community team refuse a bed in a
     * psychiatric ward it has nothing to do with, recorded as a legitimate refusal.
     */
    const after = decline(state, referralId, "community", "psychiatric_ward");
    expect(
      after.rejections.length,
      "a community team must not be able to refuse a bed in a ward it has nothing to do with",
    ).toBe(1);
    const addressing = after.referrals
      .find((candidate) => candidate.id === referralId)
      ?.destinations.find((entry) => entry.destination.kind === "psychiatric_ward");
    expect(addressing?.state, "the ward destination must be untouched").toBe("queued");
  });

  it("lets a COMMUNITY TEAM accept the destination addressed to IT — RB5 (item 16), 2026-09-17", () => {
    /*
     * 🔴 THE RULING TAKEN. Owner, 2026-09-17: "a community team may accept, for follow-up only" —
     * superseding this test's own earlier pin of a refusal here (see the DECLINE_REFERRAL/
     * ACCEPT_REFERRAL parity test above for that history). Accepting still commits a service to
     * taking the patient, but a COMMUNITY acceptance commits it to FOLLOW-UP, never to a bed:
     * `referralState` (`ward-referrals.ts`) is the one place that distinction is kept, proved over
     * the reducer directly in `tests/ward-referral-reducer.test.ts` ("RB5 — a community team's own
     * acceptance..."), not repeated here.
     */
    const own = accept(state, referralId, "community", "community_team");
    expect(own.rejections, "a community team must be able to accept its own destination").toEqual([]);
    const addressing = own.referrals
      .find((candidate) => candidate.id === referralId)
      ?.destinations.find((entry) => entry.destination.kind === "community_team");
    expect(addressing?.state).toBe("accepted");
  });

  it("⚠️ REFUSES A COMMUNITY TEAM ACCEPTING A PSYCHIATRIC WARD'S BED", () => {
    /*
     * 🔴 THE HOLE THE ROLE CHANGE WOULD HAVE OPENED ON ITS OWN, THE SAME SHAPE AS THE DECLINE CASE
     * ABOVE. `answerableBy.community` is `"community_team"`, never `"any"`, in BOTH the accept and
     * decline handlers — widening `EVENT_ROLE.ACCEPT_REFERRAL` to `community` without that map
     * holding would have let a community team decide a bed in a ward it has nothing to do with.
     */
    const ward = accept(state, referralId, "community", "psychiatric_ward", MATCHING_WARD_UNIT_ID);
    expect(
      ward.rejections.length,
      "a community team must not be able to decide on a bed in a ward it has nothing to do with",
    ).toBe(1);
    const addressing = ward.referrals
      .find((candidate) => candidate.id === referralId)
      ?.destinations.find((entry) => entry.destination.kind === "psychiatric_ward");
    expect(addressing?.state, "the ward destination must be untouched").toBe("queued");
  });
});
