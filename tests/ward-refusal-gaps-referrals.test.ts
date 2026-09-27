// tests/ward-refusal-gaps-referrals.test.ts
//
// REFUSALS NO TEST HAD EVER REACHED — the front door's gender-placement gate on ACCEPT_REFERRAL,
// and the community-team-scoped branch of RECORD_REFERRER_WITHDRAWAL (owner ruling 11,
// 2026-09-17).
//
// ACCEPT_REFERRAL's gender-placement gate (T12, item 9) has three refusals in sequence: a
// non-coordinator role is refused outright (already covered, `ward-non-binary-placement.test.ts`);
// a coordinator missing either the reason or the tick is refused with the same
// `GENDER_PLACEMENT_REFUSAL` wording (never reached by any existing test — every existing
// ACCEPT_REFERRAL coordinator fixture supplies both fields or neither); and a coordinator
// supplying a `genderPlacementReason` that is not one of `GENDER_PLACEMENT_REASONS` is refused with
// its own, differently-worded message (also never reached).
//
// RECORD_REFERRER_WITHDRAWAL's `destinationKind: "community_team"` branch has three checks of its
// own, each guarding a fact the unscoped path never has to ask about because it acts on every
// destination at once: whether a community_team destination exists on the referral at all, whether
// it was already withdrawn, and whether it already answered (accepted or declined). None had ever
// been reached — every existing withdrawal fixture either withdraws the whole referral (no
// `destinationKind`) or withdraws a single, still-queued community arm exactly once.
//
// 🔴 EVERY CASE CARRIES ITS CONTROL: the same event, from the same state, with the one offending
// field or prior step made valid, asserting the named refusal is ABSENT. Without the control, a
// missing referral or the wrong movement stage would make the test green while proving nothing
// about the guard under test.
import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import {
  GENDER_PLACEMENT_REASONS,
  GENDER_PLACEMENT_REFUSAL,
  WARD_REQUEST_WITHDRAWAL_REASONS,
} from "../src/components/ward-management/ward-change-reasons";
import { COMMUNITY_DECLINE_REASONS } from "../src/components/ward-management/ward-model";
import type { ReferralDestination, WardReferralDestination } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

const NOW = NOW_ANCHOR;
const REASON = GENDER_PLACEMENT_REASONS[0];
/** As in the sibling gap files: the cast IS the test, so it is named rather than inlined. */
const OFF_LIST = "not-a-value-this-model-knows";

function added(before: WardFlowState, after: WardFlowState) {
  return after.rejections.slice(before.rejections.length).map((rejection) => rejection.reason);
}

const wardDestination: WardReferralDestination = {
  kind: "psychiatric_ward",
  sex: "Female",
  gender: "Non-binary",
  secureBedNeeded: true,
  involuntaryBedNeeded: false,
  highAcuityNursingNeeded: false,
};

/**
 * A front-door referral whose ward arm carries a `Non-binary` gender, addressed to
 * `rph-adult-secure` (a real, Undesignated, non-forensic Adult Secure unit) so an ACCEPT_REFERRAL
 * into it reaches the gender-placement gate rather than some other eligibility refusal first.
 */
function nonBinaryReferralState(destinations: ReferralDestination[] = [wardDestination]): WardFlowState {
  const seeded = seedWardFlowState();
  const after = wardFlowReducer(seeded, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW,
    ageBand: "Adult",
    destinations,
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  } as never);
  expect(added(seeded, after), "the fixture referral itself was refused, so no test below is meaningful").toEqual([]);
  return after;
}

describe("ACCEPT_REFERRAL's gender-placement gate refuses a coordinator's incomplete record (line 5878)", () => {
  it("refuses a coordinator supplying the tick but no reason", () => {
    const received = nonBinaryReferralState();
    const referral = received.referrals.at(-1)!;
    const after = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      destinationKind: "psychiatric_ward",
      unitId: "rph-adult-secure",
      genderPlacementChecked: true,
      // genderPlacementReason deliberately omitted
    } as never);
    expect(added(received, after)).toEqual([GENDER_PLACEMENT_REFUSAL]);
    expect(after.referrals.find((candidate) => candidate.id === referral.id)!.genderPlacements).toBeUndefined();

    // CONTROL: the identical event, with the missing reason supplied, is accepted — proving the
    // refusal above was genuinely about the missing reason and not some other eligibility gate.
    const control = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      destinationKind: "psychiatric_ward",
      unitId: "rph-adult-secure",
      genderPlacementChecked: true,
      genderPlacementReason: REASON,
    } as never);
    expect(added(received, control)).toEqual([]);
  });

  it("refuses a coordinator supplying the reason but no tick", () => {
    const received = nonBinaryReferralState();
    const referral = received.referrals.at(-1)!;
    const after = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      destinationKind: "psychiatric_ward",
      unitId: "rph-adult-secure",
      genderPlacementReason: REASON,
      // genderPlacementChecked deliberately omitted
    } as never);
    expect(added(received, after)).toEqual([GENDER_PLACEMENT_REFUSAL]);

    // CONTROL: the identical event, with the tick supplied, is accepted.
    const control = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      destinationKind: "psychiatric_ward",
      unitId: "rph-adult-secure",
      genderPlacementReason: REASON,
      genderPlacementChecked: true,
    } as never);
    expect(added(received, control)).toEqual([]);
  });
});

describe("ACCEPT_REFERRAL's gender-placement gate refuses a reason outside GENDER_PLACEMENT_REASONS (line 5881)", () => {
  it("refuses an off-list reason even with the tick set", () => {
    const received = nonBinaryReferralState();
    const referral = received.referrals.at(-1)!;
    const after = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      destinationKind: "psychiatric_ward",
      unitId: "rph-adult-secure",
      genderPlacementReason: OFF_LIST,
      genderPlacementChecked: true,
    } as never);
    expect(added(received, after)).toEqual([
      "ACCEPT_REFERRAL genderPlacementReason must be chosen from GENDER_PLACEMENT_REASONS",
    ]);
    expect(after.referrals.find((candidate) => candidate.id === referral.id)!.genderPlacements).toBeUndefined();

    // CONTROL: the identical event with an on-list reason is accepted — proving the refusal above
    // is genuinely about list membership and not, say, the unit or the referral.
    const control = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      destinationKind: "psychiatric_ward",
      unitId: "rph-adult-secure",
      genderPlacementReason: REASON,
      genderPlacementChecked: true,
    } as never);
    expect(added(received, control)).toEqual([]);
  });
});

describe("RECORD_REFERRER_WITHDRAWAL scoped to community_team refuses a referral with no community arm (line 6360)", () => {
  it("refuses when the referral was never addressed to a community team", () => {
    // Ward-only destinations: no community_team arm exists for the scoped branch to find.
    const received = nonBinaryReferralState([wardDestination]);
    const referral = received.referrals.at(-1)!;
    const after = wardFlowReducer(received, {
      type: "RECORD_REFERRER_WITHDRAWAL",
      role: "coordinator",
      now: NOW + 10,
      referralId: referral.id,
      destinationKind: "community_team",
      reason: WARD_REQUEST_WITHDRAWAL_REASONS[0],
    });
    expect(added(received, after)).toEqual([`referral ${referral.id} was not addressed to a community team`]);

    // CONTROL: the identical event against a referral that DOES carry a community_team arm is
    // accepted — proving the refusal above is genuinely about the missing arm.
    const withCommunity = nonBinaryReferralState([
      wardDestination,
      { kind: "community_team", teamName: "Armadale Community Mental Health" },
    ]);
    const communityReferral = withCommunity.referrals.at(-1)!;
    const control = wardFlowReducer(withCommunity, {
      type: "RECORD_REFERRER_WITHDRAWAL",
      role: "coordinator",
      now: NOW + 10,
      referralId: communityReferral.id,
      destinationKind: "community_team",
      reason: WARD_REQUEST_WITHDRAWAL_REASONS[0],
    });
    expect(added(withCommunity, control)).toEqual([]);
  });
});

describe("RECORD_REFERRER_WITHDRAWAL scoped to community_team refuses a second withdrawal of the same arm (line 6363)", () => {
  it("refuses withdrawing an already-withdrawn community arm", () => {
    const received = nonBinaryReferralState([
      wardDestination,
      { kind: "community_team", teamName: "Armadale Community Mental Health" },
    ]);
    const referral = received.referrals.at(-1)!;
    const withdrawEvent = {
      type: "RECORD_REFERRER_WITHDRAWAL" as const,
      role: "coordinator" as const,
      now: NOW + 10,
      referralId: referral.id,
      destinationKind: "community_team" as const,
      reason: WARD_REQUEST_WITHDRAWAL_REASONS[0],
    };

    // CONTROL FIRST: the first withdrawal of a still-queued arm is accepted, proving the state this
    // test builds is reachable through real events rather than hand-assembled.
    const firstWithdrawal = wardFlowReducer(received, withdrawEvent);
    expect(added(received, firstWithdrawal)).toEqual([]);

    // The second withdrawal of the SAME arm is refused with the "already withdrawn" wording.
    const secondWithdrawal = wardFlowReducer(firstWithdrawal, { ...withdrawEvent, now: NOW + 20 });
    expect(added(firstWithdrawal, secondWithdrawal)).toEqual([
      `the community team on referral ${referral.id} was already withdrawn`,
    ]);
  });
});

describe("RECORD_REFERRER_WITHDRAWAL scoped to community_team refuses an arm that already answered (line 6372)", () => {
  it("refuses withdrawing a community arm the team already declined", () => {
    const received = nonBinaryReferralState([
      wardDestination,
      { kind: "community_team", teamName: "Armadale Community Mental Health" },
    ]);
    const referral = received.referrals.at(-1)!;
    const declined = wardFlowReducer(received, {
      type: "DECLINE_REFERRAL",
      role: "community",
      now: NOW + 5,
      referralId: referral.id,
      destinationKind: "community_team",
      reason: COMMUNITY_DECLINE_REASONS[0],
    });
    expect(added(received, declined), "the fixture decline itself was refused").toEqual([]);

    const after = wardFlowReducer(declined, {
      type: "RECORD_REFERRER_WITHDRAWAL",
      role: "coordinator",
      now: NOW + 10,
      referralId: referral.id,
      destinationKind: "community_team",
      reason: WARD_REQUEST_WITHDRAWAL_REASONS[0],
    });
    expect(added(declined, after)).toEqual([
      `the community team on referral ${referral.id} has already answered (declined), so its arm cannot be withdrawn`,
    ]);

    // CONTROL: the identical withdrawal against the STILL-QUEUED arm (before the decline above) is
    // accepted — proving the refusal is genuinely about the prior answer, not the referral or role.
    const control = wardFlowReducer(received, {
      type: "RECORD_REFERRER_WITHDRAWAL",
      role: "coordinator",
      now: NOW + 10,
      referralId: referral.id,
      destinationKind: "community_team",
      reason: WARD_REQUEST_WITHDRAWAL_REASONS[0],
    });
    expect(added(received, control)).toEqual([]);
  });
});
