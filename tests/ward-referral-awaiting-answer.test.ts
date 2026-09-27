/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  edArrivedFor,
  edExpectsFor,
  edReferralsFor,
  isAwaitingAnswer,
  referralAddressingStateLabel,
  referralQueueOrder,
} from "@/components/ward-management/ward-referrals";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral, ReferralAddressing } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * WF-13 — THE READERS THAT IGNORED `withdrawnAt`.
 *
 * `RECORD_REFERRER_WITHDRAWAL` stamps `withdrawnAt` on every destination still `queued` at that
 * moment and deliberately leaves `state` untouched (O-17.11). Every reader that decides "is this
 * still open" from `state === "queued"` alone therefore keeps a withdrawn addressing exactly as
 * open as a live one — on the ED hub's Expects and Referrals lists, and on the coordinator's queue.
 *
 * This file proves the fix through the real event, not by hand-stamping `withdrawnAt` on a
 * fixture: every scenario below calls `wardFlowReducer` with `RECORD_REFERRER_WITHDRAWAL`, so a
 * regression in the reducer's own withdrawal logic would show up here too.
 */

const RPH_ED = "rph-ed";
const FSH_ED = "fsh-ed";
const PURPOSE = "psychiatric_review" as const;

/**
 * `RF-014` — one of the two SEEDED EXPECTS (`ward-movements.ts`): a single ED-addressed, queued
 * destination at `rph-ed` for psychiatric review, carrying neither `triagedAt` nor
 * `inDepartmentAt`. That absence is what makes it an expect rather than an arrival
 * (`hasArrivedInDepartment`), and it is the only reason `edExpectsFor` has anything to show at
 * all — see that fixture's own comment. Chosen over `RF-009`/`RF-015` (both triaged, both already
 * "arrived") precisely so the baseline assertion below is not vacuous: a referral that never
 * appeared in `edExpectsFor` cannot prove anything by later being absent from it.
 */
const EXPECT_REFERRAL_ID = "RF-014";

/** `RF-011` — the one seeded referral with two destinations: a psychiatric ward and `fsh-ed`. */
const TWO_DESTINATION_REFERRAL_ID = "RF-011";

/** `RF-012` — accepted at `fsh-ed`, already triaged. The control: nothing here withdraws it. */
const ACCEPTED_CONTROL_ID = "RF-012";

function withdraw(state: WardFlowState, referralId: string): WardFlowState {
  return wardFlowReducer(state, {
    type: "RECORD_REFERRER_WITHDRAWAL",
    role: "coordinator",
    now: NOW_ANCHOR,
    referralId,
  });
}

function referralIn(state: WardFlowState, id: string): Referral {
  const found = state.referrals.find((referral) => referral.id === id);
  expect(found, `referral ${id} vanished from the state`).toBeDefined();
  return found!;
}

function edAddressing(referral: Referral, edId: string): ReferralAddressing {
  const found = referral.destinations.find(
    (addressing) => addressing.destination.kind === "emergency_department" && addressing.destination.edId === edId,
  );
  expect(found, `${referral.id} carries no addressing to ${edId}`).toBeDefined();
  return found!;
}

describe("isAwaitingAnswer — one rule, at the destination level", () => {
  it("is true for a queued addressing with no withdrawnAt", () => {
    const seed = seedWardFlowState();
    const addressing = edAddressing(referralIn(seed, EXPECT_REFERRAL_ID), RPH_ED);
    expect(addressing.state).toBe("queued");
    expect(addressing.withdrawnAt).toBeUndefined();
    expect(isAwaitingAnswer(addressing)).toBe(true);
  });

  it("is false once withdrawnAt is set, even though state stays 'queued'", () => {
    const seed = seedWardFlowState();
    const after = withdraw(seed, EXPECT_REFERRAL_ID);
    const addressing = edAddressing(referralIn(after, EXPECT_REFERRAL_ID), RPH_ED);

    // O-17.11: withdrawal never touches `state`.
    expect(addressing.state).toBe("queued");
    expect(addressing.withdrawnAt).toBeDefined();
    expect(isAwaitingAnswer(addressing)).toBe(false);
  });
});

describe("WF-13 — a withdrawn referral leaves the ED hub's live lists", () => {
  it("baseline: before withdrawal, the expect sits in edExpectsFor, edReferralsFor and referralQueueOrder", () => {
    const seed = seedWardFlowState();
    expect(
      edExpectsFor(seed.referrals, RPH_ED, PURPOSE).some((result) => result.referral.id === EXPECT_REFERRAL_ID),
      "the fixture no longer seeds this expect, so the removal assertion below would be vacuous",
    ).toBe(true);
    expect(
      edReferralsFor(seed.referrals, RPH_ED, PURPOSE).some((result) => result.referral.id === EXPECT_REFERRAL_ID),
    ).toBe(true);
    expect(referralQueueOrder(seed.referrals).some((referral) => referral.id === EXPECT_REFERRAL_ID)).toBe(true);
  });

  it("removes the referral from edExpectsFor, edArrivedFor and edReferralsFor once withdrawn", () => {
    const seed = seedWardFlowState();
    const after = withdraw(seed, EXPECT_REFERRAL_ID);
    expect(after.rejections.length, "the withdrawal itself was rejected").toBe(seed.rejections.length);

    expect(edExpectsFor(after.referrals, RPH_ED, PURPOSE).some((r) => r.referral.id === EXPECT_REFERRAL_ID)).toBe(
      false,
    );
    expect(edArrivedFor(after.referrals, RPH_ED, PURPOSE).some((r) => r.referral.id === EXPECT_REFERRAL_ID)).toBe(
      false,
    );
    expect(edReferralsFor(after.referrals, RPH_ED, PURPOSE).some((r) => r.referral.id === EXPECT_REFERRAL_ID)).toBe(
      false,
    );
  });

  it("removes the referral from referralQueueOrder once withdrawn", () => {
    const seed = seedWardFlowState();
    const after = withdraw(seed, EXPECT_REFERRAL_ID);
    expect(referralQueueOrder(after.referrals).some((referral) => referral.id === EXPECT_REFERRAL_ID)).toBe(false);
  });

  it("labels the withdrawn addressing 'Withdrawn by the referrer.'", () => {
    const seed = seedWardFlowState();
    const after = withdraw(seed, EXPECT_REFERRAL_ID);
    const addressing = edAddressing(referralIn(after, EXPECT_REFERRAL_ID), RPH_ED);

    expect(referralAddressingStateLabel(addressing)).toBe("Withdrawn by the referrer.");
  });
});

describe("WF-13 — a sibling addressing that already answered is untouched", () => {
  /**
   * `RF-011` carries a ward destination and an `fsh-ed` destination, both seeded `queued`. Here the
   * ward destination is set `declined` BEFORE the withdrawal is recorded — mirroring the reducer's
   * own "leaves an already-answered destination alone" fixture in
   * `tests/ward-referrer-withdrawal.test.ts` — so `RECORD_REFERRER_WITHDRAWAL` only touches the
   * still-queued ED destination, exactly as O-17.11 requires.
   */
  it("keeps the sibling's 'Declined — …' label, and still withdraws the live destination", () => {
    const seed = seedWardFlowState();
    const before = referralIn(seed, TWO_DESTINATION_REFERRAL_ID);
    const declinedWard: WardFlowState = {
      ...seed,
      referrals: seed.referrals.map((referral) =>
        referral.id !== TWO_DESTINATION_REFERRAL_ID
          ? referral
          : {
              ...referral,
              destinations: referral.destinations.map((addressing) =>
                addressing.destination.kind === "psychiatric_ward"
                  ? {
                      ...addressing,
                      state: "declined" as const,
                      decidedAt: NOW_ANCHOR - 30,
                      declineReason: "no_suitable_bed" as const,
                    }
                  : addressing,
              ),
            },
      ),
    };
    expect(before.destinations).toHaveLength(2);

    const after = withdraw(declinedWard, TWO_DESTINATION_REFERRAL_ID);
    expect(after.rejections.length, "the withdrawal itself was rejected").toBe(seed.rejections.length);

    const referral = referralIn(after, TWO_DESTINATION_REFERRAL_ID);
    const wardAddressing = referral.destinations.find(
      (addressing) => addressing.destination.kind === "psychiatric_ward",
    );
    const edAddr = edAddressing(referral, FSH_ED);

    expect(wardAddressing?.withdrawnAt, "an already-declined destination must not be marked withdrawn").toBeUndefined();
    expect(referralAddressingStateLabel(wardAddressing!)).toBe("Declined — No suitable bed.");
    expect(referralAddressingStateLabel(edAddr)).toBe("Withdrawn by the referrer.");

    // Nothing left awaiting an answer, so the referral drops out of the ED hub's lists and the
    // coordinator's queue too — the same rule proved above, now over a referral with a sibling.
    expect(
      edReferralsFor(after.referrals, FSH_ED, PURPOSE).some((r) => r.referral.id === TWO_DESTINATION_REFERRAL_ID),
    ).toBe(false);
    expect(referralQueueOrder(after.referrals).some((r) => r.id === TWO_DESTINATION_REFERRAL_ID)).toBe(false);
  });
});

describe("WF-13 — an accepted control is unchanged", () => {
  /**
   * `RF-012` is already `accepted` at `fsh-ed`, and nothing in this test withdraws it — an
   * unrelated referral (`RF-014`) is withdrawn instead. This proves the rewritten `edArrivedFor`
   * condition (`state !== "accepted" && !isAwaitingAnswer(addressing)`) still admits an accepted
   * addressing exactly as before, rather than accidentally narrowing to `isAwaitingAnswer` alone.
   */
  it("stays in edArrivedFor and keeps its 'Accepted.' label after an unrelated withdrawal", () => {
    const seed = seedWardFlowState();
    const control = edAddressing(referralIn(seed, ACCEPTED_CONTROL_ID), FSH_ED);
    expect(control.state).toBe("accepted");

    const after = withdraw(seed, EXPECT_REFERRAL_ID);

    expect(
      edArrivedFor(after.referrals, FSH_ED, PURPOSE).some((r) => r.referral.id === ACCEPTED_CONTROL_ID),
      "the accepted control fell out of edArrivedFor",
    ).toBe(true);

    const afterAddressing = edAddressing(referralIn(after, ACCEPTED_CONTROL_ID), FSH_ED);
    expect(afterAddressing.withdrawnAt).toBeUndefined();
    expect(isAwaitingAnswer(afterAddressing)).toBe(false);
    expect(referralAddressingStateLabel(afterAddressing)).toBe("Accepted.");
  });
});
