// tests/ward-re-referral-adds.test.ts
//
// RA1 (item 18, owner answer 18, 2026-09-17): "Re-referring adds wards; replacing one is a
// withdrawal with a fixed reason." Two defects this file exists to close, both measured against
// the reducer before this task:
//
//   - `REFER_TO_UNITS` REPLACED `referredUnitIds` wholesale with `event.unitIds` on every call, so
//     a re-referral that omitted a previously-referred ward dropped it with no record at all, and
//     rewrote `referredAt` every time — silently restarting the ED board's "time since referral"
//     clock on every addition.
//   - There was no way to take back ONE ward's live request without withdrawing every live
//     referral at once and closing the movement (`WITHDRAW_REFERRAL`) — a much bigger act.
//
// This file proves the fix from the reducer's own public API — no DOM, no shortlist panel.

import { describe, expect, it } from "vitest";

import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { WITHDRAWAL_REASONS } from "../src/components/ward-management/ward-change-reasons";

const NOW = NOW_ANCHOR;

// WF-009: seeded at `destination_review` with an EMPTY `referredUnitIds` and five declines already
// against the wider secure-adult network (`ward-movements.ts`) — a previously-declined ward still
// needs no recorded reason to be referred again (owner ruling 2026-09-02, `needsNoRecordedReason`),
// so re-referring to a declined unit here is not a defect in the fixture choice. All four units
// below are already proven eligible for WF-009 by `tests/ward-flow-reducer.test.ts`'s own referral
// tests, dispatched the same way.
const MOVEMENT_ID = "WF-009";
const UNIT_A = "rph-adult-secure";
const UNIT_B = "fsh-adult-secure";
const UNIT_C = "rgh-adult-secure";
const UNIT_D = "gry-adult-secure";

function seeded(): WardFlowState {
  const state = seedWardFlowState();
  // T11 (item 8, owner answer 17 September 2026): gender must be recorded before a referral can
  // reach a single-gender ward. `fsh-adult-secure` (UNIT_B) is the network's Male-only bed
  // (ward-sites.ts) and every test below refers to it, so the seed's WF-009 — which carries
  // `sex: "Male"` but no `gender` — is patched here, locally, to match. Scoped to this file's own
  // fixture rather than the shared seed, which dozens of other files also read.
  return {
    ...state,
    movements: state.movements.map((candidate) =>
      candidate.id === MOVEMENT_ID ? { ...candidate, gender: "Male" } : candidate,
    ),
  };
}

function movement(state: WardFlowState, id: string = MOVEMENT_ID) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

function referTo(state: WardFlowState, unitIds: string[], now: number) {
  return wardFlowReducer(state, {
    type: "REFER_TO_UNITS",
    role: "coordinator",
    now,
    movementId: MOVEMENT_ID,
    unitIds,
  });
}

function withdrawWardRequest(state: WardFlowState, unitId: string, reason: string, now: number) {
  return wardFlowReducer(state, {
    type: "WITHDRAW_WARD_REQUEST",
    role: "coordinator",
    now,
    movementId: MOVEMENT_ID,
    unitId,
    reason: reason as never,
  });
}

describe("re-referring adds wards and keeps the live ones (item 18)", () => {
  it("with A and B live, adding C gives A, B and C, and referredAt is unchanged", () => {
    const s0 = seeded();
    expect(movement(s0).referredUnitIds).toEqual([]);

    const s1 = referTo(s0, [UNIT_A, UNIT_B], NOW + 10);
    expect(s1.rejections).toHaveLength(s0.rejections.length);
    expect(movement(s1).referredUnitIds).toEqual([UNIT_A, UNIT_B]);
    expect(movement(s1).referredAt).toBe(NOW + 10);

    const s2 = referTo(s1, [UNIT_C], NOW + 20);
    expect(s2.rejections, "adding C must not be rejected").toHaveLength(s1.rejections.length);
    expect(movement(s2).referredUnitIds).toEqual([UNIT_A, UNIT_B, UNIT_C]);
    expect(
      movement(s2).referredAt,
      "referredAt must stay the FIRST referral's moment — a re-referral must never rewrite it",
    ).toBe(NOW + 10);
  });

  it("re-referring to a unit already live adds nothing new and does not duplicate it", () => {
    const s1 = referTo(seeded(), [UNIT_A], NOW + 10);
    const s2 = referTo(s1, [UNIT_A, UNIT_B], NOW + 20);
    expect(s2.rejections).toHaveLength(s1.rejections.length);
    expect(movement(s2).referredUnitIds).toEqual([UNIT_A, UNIT_B]);
    expect(movement(s2).referredAt).toBe(NOW + 10);
  });

  it("with A, B and C live, adding D is refused, naming the cap", () => {
    const s1 = referTo(seeded(), [UNIT_A, UNIT_B, UNIT_C], NOW + 10);
    expect(movement(s1).referredUnitIds).toEqual([UNIT_A, UNIT_B, UNIT_C]);

    const s2 = referTo(s1, [UNIT_D], NOW + 20);
    expect(s2.rejections.length).toBeGreaterThan(s1.rejections.length);
    const latest = s2.rejections[s2.rejections.length - 1];
    expect(latest.attempted).toBe("REFER_TO_UNITS");
    expect(latest.reason).toContain("parallel cap");
    // Nothing was dropped by the refused attempt — the live three stay exactly as they were.
    expect(movement(s2).referredUnitIds).toEqual([UNIT_A, UNIT_B, UNIT_C]);
    expect(movement(s2).referredAt).toBe(NOW + 10);
  });
});

describe("withdrawing one ward's request (item 18)", () => {
  function twoLive(now = NOW + 10) {
    return referTo(seeded(), [UNIT_A, UNIT_B], now);
  }

  it("withdrawing B with a reason removes only B, records the reason, and tells B", () => {
    const s1 = twoLive();
    const s2 = withdrawWardRequest(s1, UNIT_B, "bed_no_longer_available", NOW + 20);

    expect(s2.rejections, "a valid withdrawal must not be rejected").toHaveLength(s1.rejections.length);
    expect(movement(s2).referredUnitIds).toEqual([UNIT_A]);

    const entry = movement(s2).withdrawnReferrals.find((candidate) => candidate.unitId === UNIT_B);
    expect(entry, "the withdrawal must be recorded on withdrawnReferrals").toBeDefined();
    expect(entry?.at).toBe(NOW + 20);
    expect(WITHDRAWAL_REASONS).toContain(entry?.reason);
    expect(entry?.reason).toBe("coordinator_withdrew");
    expect(entry?.detail).toBe("bed_no_longer_available");

    const notice = s2.notices.at(-1)!;
    expect(notice.kind).toBe("ward_request_withdrawn");
    expect(notice.to).toEqual({ role: "ward", placeId: UNIT_B });
  });

  it("an unlisted reason is refused, and nothing changes", () => {
    const s1 = twoLive();
    const s2 = withdrawWardRequest(s1, UNIT_B, "not_a_real_reason", NOW + 20);

    expect(s2.rejections.length).toBeGreaterThan(s1.rejections.length);
    expect(movement(s2).referredUnitIds).toEqual([UNIT_A, UNIT_B]);
    expect(movement(s2).withdrawnReferrals).toEqual(movement(s1).withdrawnReferrals);
  });

  it("a ward that isn't live is refused, and nothing changes", () => {
    const s1 = twoLive();
    // UNIT_C was never referred to on this movement.
    const s2 = withdrawWardRequest(s1, UNIT_C, "bed_no_longer_available", NOW + 20);

    expect(s2.rejections.length).toBeGreaterThan(s1.rejections.length);
    expect(s2.rejections.at(-1)?.reason).toContain(UNIT_C);
    expect(movement(s2).referredUnitIds).toEqual([UNIT_A, UNIT_B]);
  });

  it("withdrawing an already-withdrawn ward again is refused", () => {
    const s1 = twoLive();
    const s2 = withdrawWardRequest(s1, UNIT_B, "bed_no_longer_available", NOW + 20);
    const s3 = withdrawWardRequest(s2, UNIT_B, "referred_in_error", NOW + 30);

    expect(s3.rejections.length).toBeGreaterThan(s2.rejections.length);
    // Only the one entry from the first, successful withdrawal — the second attempt wrote nothing.
    expect(movement(s3).withdrawnReferrals.filter((entry) => entry.unitId === UNIT_B)).toHaveLength(1);
  });

  it("withdrawing the last live ward sets the 'no ward is being asked' blocker", () => {
    const s1 = referTo(seeded(), [UNIT_A], NOW + 10);
    const s2 = withdrawWardRequest(s1, UNIT_A, "referred_in_error", NOW + 20);

    expect(s2.rejections).toHaveLength(s1.rejections.length);
    expect(movement(s2).referredUnitIds).toEqual([]);
    expect(movement(s2).blocker).toBe("No ward is being asked");
  });

  it("withdrawing one of several live wards leaves the standing blocker untouched", () => {
    const s1 = twoLive();
    const blockerBefore = movement(s1).blocker;
    const s2 = withdrawWardRequest(s1, UNIT_B, "bed_no_longer_available", NOW + 20);

    expect(movement(s2).referredUnitIds).toEqual([UNIT_A]);
    expect(movement(s2).blocker).toBe(blockerBefore);
  });
});
