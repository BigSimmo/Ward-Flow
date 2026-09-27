/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral, ReferralDestination } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * 🔴 **FD-5 — A REFERRER TAKING A REFERRAL BACK. THERE WAS NO WAY TO RECORD IT, AND TWO FIGURES WERE
 * WRONG IN OPPOSITE DIRECTIONS BECAUSE OF IT.**
 *
 * The approved community drawing carries *"Withdrawn by the referrer before assessment: 0"* and
 * insists in its own prose that the nought is measured. It could only ever be nought: nothing could
 * write it. **And the same gap inflated the other end** — a referral the referrer had abandoned sat
 * `queued` for ever and went on being counted as awaiting the team's answer.
 *
 * 🔴 **O-17.11: A FIELD, NOT A FIFTH STATE — and the reason is this codebase's own weakness.** There
 * is exactly ONE switch over `addressing.state` in `src` and it carries no `never` guard, so a fifth
 * state would buy almost no compiler help: every `=== "queued"` comparison would silently keep its
 * old meaning and a withdrawn referral would go on counting as open, green all the way. **A field
 * changes nothing by default and makes each reader an explicit opt-in.**
 *
 * 🔴 **THREE EVENTS NOW LIVE IN THIS NEIGHBOURHOOD, AND I FOUND THE CLOSEST ONE ONLY BECAUSE THE
 * TYPECHECK MADE ME CLASSIFY MY NEW EVENT IN TWO TOTAL RECORDS.** My first note here named
 * `WITHDRAW_ACCEPTANCE` as the collision to avoid; the real neighbour is nearer than that:
 *
 *     WITHDRAW_ACCEPTANCE          a WARD takes back its own yes                      movementId
 *     WITHDRAW_REFERRAL            the REFERRER takes back a bed search for a person
 *                                  ALREADY INSIDE A DEPARTMENT                        movementId
 *     RECORD_REFERRER_WITHDRAWAL   the REFERRER takes back a REFERRAL, before any
 *                                  movement exists                                    referralId
 *
 * ⚠️ **The middle one and this one are the SAME ACT ON TWO SUBJECTS, and `ward-model.ts` says that
 * is deliberate:** *"One meaning on two subjects is not a duplicated concept; two different NAMES
 * for one meaning would be."* **That same comment predicted this event — it says FD-5 "has no event
 * yet".** 🔴 **The payload is the only thing keeping them apart at a call site; the names do not.**
 *
 * ⚠️ **AND `withdrawalRecordedBy`, NEVER `withdrawnBy`.** The person who withdrew is the REFERRER —
 * a GP, a crisis team, somebody outside this system whom it must not name. The role stored here is
 * whoever WROTE IT DOWN. `withdrawnBy` reads as the first and would be the second, which is the
 * one-word-two-subjects defect this project has already paid for twice.
 */

const SEED = seedWardFlowState();

/** A referral with at least one destination still waiting — the only kind that can be withdrawn. */
function firstWithdrawable(state: WardFlowState): Referral {
  const found = state.referrals.find((referral) =>
    referral.destinations.some((addressing) => addressing.state === "queued"),
  );
  expect(
    found,
    "the seed holds no referral with a queued destination, so this suite would assert nothing",
  ).toBeDefined();
  return found!;
}

function withdraw(state: WardFlowState, referralId: string, role = "coordinator" as const) {
  return wardFlowReducer(state, {
    type: "RECORD_REFERRER_WITHDRAWAL",
    role,
    now: NOW_ANCHOR,
    referralId,
  });
}

function referralIn(state: WardFlowState, id: string): Referral {
  const found = state.referrals.find((referral) => referral.id === id);
  expect(found, `referral ${id} vanished from the state`).toBeDefined();
  return found!;
}

describe("recording that a referrer withdrew their referral", () => {
  it("marks every destination that was still waiting, because the referrer took back the whole referral", () => {
    const before = firstWithdrawable(SEED);
    const queuedKinds = before.destinations
      .filter((addressing) => addressing.state === "queued")
      .map((addressing) => addressing.destination.kind);
    expect(queuedKinds.length, "no queued destination, so the assertion below would be vacuous").toBeGreaterThan(0);

    const after = referralIn(withdraw(SEED, before.id), before.id);

    for (const kind of queuedKinds) {
      const addressing = after.destinations.find((candidate) => candidate.destination.kind === kind);
      expect(addressing?.withdrawnAt, `${kind} was not marked withdrawn`).toBe(NOW_ANCHOR);
      expect(addressing?.withdrawalRecordedBy, `${kind} has no recorded-by role`).toBeTruthy();
    }
  });

  /**
   * 🔴 **THE WHOLE POINT OF O-17.11 IN ONE ASSERTION.** The state is untouched, so every existing
   * `=== "queued"` comparison behaves exactly as it did — no reader changes meaning by accident, and
   * each of the eight becomes a deliberate opt-in instead.
   */
  it("does NOT change the addressing's state — the field is additive and that is the ruling", () => {
    const before = firstWithdrawable(SEED);
    const statesBefore = before.destinations.map((addressing) => addressing.state);

    const after = referralIn(withdraw(SEED, before.id), before.id);

    expect(after.destinations.map((addressing) => addressing.state)).toEqual(statesBefore);
  });

  /**
   * ⚠️ **A destination that already ANSWERED is not withdrawn.** A ward that said no said no; the
   * referrer changing their mind afterwards does not unmake the refusal, and overwriting it would
   * destroy a recorded clinical decision.
   */
  it("leaves an already-answered destination alone", () => {
    const seeded = firstWithdrawable(SEED);
    const withDeclined: WardFlowState = {
      ...SEED,
      referrals: SEED.referrals.map((referral) =>
        referral.id !== seeded.id
          ? referral
          : {
              ...referral,
              destinations: referral.destinations.map((addressing, index) =>
                index === 0 ? { ...addressing, state: "declined" as const, decidedAt: NOW_ANCHOR - 60 } : addressing,
              ),
            },
      ),
    };

    const after = referralIn(withdraw(withDeclined, seeded.id), seeded.id);

    expect(after.destinations[0]?.state).toBe("declined");
    expect(after.destinations[0]?.withdrawnAt, "a declined destination was marked withdrawn").toBeUndefined();
  });

  it("refuses a referral that does not exist, rather than doing nothing quietly", () => {
    const after = withdraw(SEED, "no-such-referral");
    expect(after.rejections.length).toBe(SEED.rejections.length + 1);
    expect(after.rejections.at(-1)?.reason).toMatch(/no referral found/i);
  });

  /**
   * 🔴 **A REFERRAL SOMEBODY HAS ALREADY ACCEPTED IS NOT WITHDRAWABLE.** The person has a bed. A
   * record saying the referrer took it back would contradict an admission that is already happening.
   */
  it("refuses once a destination has accepted", () => {
    const seeded = firstWithdrawable(SEED);
    const withAccepted: WardFlowState = {
      ...SEED,
      referrals: SEED.referrals.map((referral) =>
        referral.id !== seeded.id
          ? referral
          : {
              ...referral,
              destinations: referral.destinations.map((addressing, index) =>
                index === 0 ? { ...addressing, state: "accepted" as const, decidedAt: NOW_ANCHOR - 60 } : addressing,
              ),
            },
      ),
    };

    const after = withdraw(withAccepted, seeded.id);
    expect(after.rejections.at(-1)?.reason).toMatch(/already been accepted/i);
  });

  it("refuses a second withdrawal rather than overwriting the first one's time", () => {
    const seeded = firstWithdrawable(SEED);
    const once = withdraw(SEED, seeded.id);
    const twice = withdraw(once, seeded.id);

    expect(twice.rejections.length).toBe(once.rejections.length + 1);
    expect(twice.rejections.at(-1)?.reason).toMatch(/already/i);
  });

  /**
   * ⚠️ **The anti-vacuity case.** Every refusal above would pass on a reducer that rejected
   * everything, which would be an event nobody can ever raise.
   */
  it("actually records something on the happy path", () => {
    const seeded = firstWithdrawable(SEED);
    const after = withdraw(SEED, seeded.id);
    expect(after.rejections.length, "the happy path was rejected").toBe(SEED.rejections.length);
    expect(referralIn(after, seeded.id).destinations.some((a) => a.withdrawnAt !== undefined)).toBe(true);
  });
});

/**
 * 🔴 **OWNER RULING 11 (2026-09-17): THE REFERRER MAY WITHDRAW JUST A LIVE COMMUNITY-TEAM ARM.**
 * "A referral normally doesn't go to a community team when a ward is sought. If it does, the
 * referrer may withdraw the community part alone; it's rare." Built off the exact fixture
 * `tests/ward-referral-reducer.test.ts` ("cancels every destination still waiting when the first
 * one accepts (FD-22)") already proves: a ward's acceptance does NOT cancel a live community arm
 * on the same referral.
 */
describe("recording that a referrer withdrew just a referral's community-team arm", () => {
  const WARD: ReferralDestination = {
    kind: "psychiatric_ward",
    sex: "Female",
    gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
    secureBedNeeded: false,
    involuntaryBedNeeded: false,
    highAcuityNursingNeeded: false,
  };
  const COMMUNITY: ReferralDestination = { kind: "community_team", teamName: "Inner City Clinic" };

  /** A referral with a psychiatric-ward arm already accepted and its community arm still queued —
   *  the one scenario owner ruling 11 names. */
  function acceptedWardPlusQueuedCommunity(): { state: WardFlowState; referralId: string } {
    const raised = wardFlowReducer(seedWardFlowState(), {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      ageBand: "Adult",
      destinations: [WARD, COMMUNITY],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "SCGH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    });
    expect(raised.rejections, "raising the fixture referral must not itself be refused").toEqual([]);
    const created = raised.referrals.at(-1)!;
    const accepted = wardFlowReducer(raised, {
      type: "ACCEPT_REFERRAL",
      role: "ward",
      now: NOW_ANCHOR + 5,
      referralId: created.id,
      destinationKind: "psychiatric_ward",
      unitId: "scgh-adult-open",
    });
    expect(accepted.rejections, "accepting the ward arm must not itself be refused").toEqual([]);
    return { state: accepted, referralId: created.id };
  }

  /**
   * `reason` has no default — a JS default parameter also applies when the CALLER passes `undefined`
   * explicitly, which is exactly the case the missing-reason test below needs to construct.
   */
  function withdrawCommunityArm(
    state: WardFlowState,
    referralId: string,
    role: "coordinator" | "ward" | "ed",
    reason: "referred_in_error" | undefined,
  ) {
    return wardFlowReducer(state, {
      type: "RECORD_REFERRER_WITHDRAWAL",
      role,
      now: NOW_ANCHOR + 10,
      referralId,
      destinationKind: "community_team",
      reason,
    });
  }

  it("withdraws only the community arm, leaving the ward's acceptance standing", () => {
    const { state, referralId } = acceptedWardPlusQueuedCommunity();
    const after = withdrawCommunityArm(state, referralId, "coordinator", "referred_in_error");
    expect(after.rejections.length, "the scoped withdrawal was refused").toBe(state.rejections.length);

    const decided = after.referrals.find((candidate) => candidate.id === referralId)!;
    const byKind = new Map(decided.destinations.map((addressing) => [addressing.destination.kind, addressing]));

    const community = byKind.get("community_team")!;
    expect(community.withdrawnAt).toBe(NOW_ANCHOR + 10);
    expect(community.withdrawalReason).toBe("referred_in_error");

    const ward = byKind.get("psychiatric_ward")!;
    expect(ward.state, "the ward's own acceptance must be untouched").toBe("accepted");
    expect(ward.acceptedUnitId).toBe("scgh-adult-open");
    expect(ward.withdrawnAt, "the ward arm was never queued, so it must never be marked withdrawn").toBeUndefined();
  });

  it("tells the community team", () => {
    const { state, referralId } = acceptedWardPlusQueuedCommunity();
    const after = withdrawCommunityArm(state, referralId, "coordinator", "referred_in_error");
    const notice = after.notices.find(
      (candidate) => candidate.kind === "community_referral_withdrawn" && candidate.about.referralId === referralId,
    );
    expect(notice, "no notice was raised to the community team").toBeDefined();
    expect(notice?.to.role).toBe("community");
    expect(notice?.to.placeId).toBeTruthy();
  });

  it("refuses a role that is not the referrer's own referral view", () => {
    const { state, referralId } = acceptedWardPlusQueuedCommunity();
    const after = withdrawCommunityArm(state, referralId, "ward", "referred_in_error");
    expect(after.rejections.length).toBe(state.rejections.length + 1);
  });

  it("refuses without a reason chosen from the fixed list", () => {
    const { state, referralId } = acceptedWardPlusQueuedCommunity();
    const after = withdrawCommunityArm(state, referralId, "coordinator", undefined);
    expect(after.rejections.at(-1)?.reason).toMatch(/WARD_REQUEST_WITHDRAWAL_REASONS/);
  });

  it("prior community arm withdrawal does not block unscoped withdrawal of remaining open psychiatric ward destination", () => {
    const raised = wardFlowReducer(seedWardFlowState(), {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      ageBand: "Adult",
      destinations: [WARD, COMMUNITY],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "SCGH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    });
    expect(raised.rejections).toEqual([]);
    const referralId = raised.referrals.at(-1)!.id;

    // First withdraw community arm
    const afterCommunityWithdrawal = withdrawCommunityArm(raised, referralId, "coordinator", "referred_in_error");
    expect(afterCommunityWithdrawal.rejections).toHaveLength(0);

    // Now perform unscoped withdrawal of the remaining open ward destination
    const afterUnscopedWithdrawal = wardFlowReducer(afterCommunityWithdrawal, {
      type: "RECORD_REFERRER_WITHDRAWAL",
      role: "coordinator",
      now: NOW_ANCHOR + 20,
      referralId,
    });
    expect(afterUnscopedWithdrawal.rejections).toHaveLength(0);

    const ref = afterUnscopedWithdrawal.referrals.find((r) => r.id === referralId)!;
    const wardArm = ref.destinations.find((d) => d.destination.kind === "psychiatric_ward")!;
    expect(wardArm.withdrawnAt).toBe(NOW_ANCHOR + 20);
  });
});
