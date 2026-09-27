import { describe, expect, it } from "vitest";

import { WITHDRAWAL_REASONS } from "../src/components/ward-management/ward-change-reasons";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function seeded() {
  return seedWardFlowState();
}

function movement(state: ReturnType<typeof seeded>, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

/** A movement with live referrals and no acceptance — chosen FROM state, so a seed change cannot
 *  quietly make this file test a movement that is already settled. */
function anOpenReferral(state: ReturnType<typeof seeded>) {
  const found = state.movements.find(
    (candidate) => candidate.referredUnitIds.length > 0 && !candidate.acceptedUnitId && !candidate.closure,
  );
  if (!found) throw new Error("the seed contains no movement with a live, unaccepted referral");
  return found;
}

describe("a referrer taking its referral back", () => {
  /*
   * WHY THIS EXISTS. Until `WITHDRAW_REFERRAL` the only writer of `withdrawnReferrals` was
   * `ACCEPT_IN_PRINCIPLE`, so the ONLY way a referral ever ended was another unit winning it. A
   * patient who improved, went home or went somewhere else left the request sitting live in every
   * receiving ward's list, and nobody in the model could say it was over. That is a flow gap
   * rather than a missing screen: the state had no way to exist.
   */

  it("withdraws every live referral at once, because that is what the referrer is saying", () => {
    const state = seeded();
    const open = anOpenReferral(state);
    const referredBefore = [...open.referredUnitIds];
    expect(referredBefore.length).toBeGreaterThan(0);

    const next = wardFlowReducer(state, {
      type: "WITHDRAW_REFERRAL",
      role: "ed",
      now: NOW,
      movementId: open.id,
    });

    expect(next.rejections).toHaveLength(0);
    const after = movement(next, open.id);
    expect(after.referredUnitIds).toHaveLength(0);
    // Every unit that held a live referral now holds a withdrawal, and nothing else was invented.
    const withdrawnUnits = after.withdrawnReferrals.slice(open.withdrawnReferrals.length).map((w) => w.unitId);
    expect(withdrawnUnits.sort()).toEqual(referredBefore.sort());
  });

  it("records the cause as the referrer's own, not as another unit accepting", () => {
    /*
     * `WITHDRAWAL_REASONS`' own comment warned that "another unit accepted" was true of every entry
     * ONLY because acceptance was the sole writer, and that a second path with a different cause
     * would make that label quietly wrong on a ward screen. This is that second path, so it carries
     * its own code rather than inheriting a false one.
     */
    const state = seeded();
    const open = anOpenReferral(state);

    const next = wardFlowReducer(state, {
      type: "WITHDRAW_REFERRAL",
      role: "community",
      now: NOW,
      movementId: open.id,
    });

    const added = movement(next, open.id).withdrawnReferrals.slice(open.withdrawnReferrals.length);
    expect(added.length).toBeGreaterThan(0);
    for (const entry of added) {
      expect(entry.reason).toBe("referrer_withdrew");
      expect(entry.at).toBe(NOW);
    }
  });

  it("closes the movement as one that did not proceed", () => {
    const state = seeded();
    const open = anOpenReferral(state);

    const next = wardFlowReducer(state, {
      type: "WITHDRAW_REFERRAL",
      role: "ward",
      now: NOW,
      movementId: open.id,
    });

    const closure = movement(next, open.id).closure;
    expect(closure?.outcome).toBe("did_not_proceed");
    expect(closure?.at).toBe(NOW);
  });

  it("names no place in anything a ward can read", () => {
    /*
     * The defect this vocabulary exists to prevent: a LOSING ward reading the WINNING ward's name
     * out of the record of its own loss. A withdrawal by the referrer has no winner at all, so
     * there is nothing to leak — asserted anyway, because the previous leak passed every shape
     * guard by carrying a forbidden VALUE in a permitted field.
     */
    const state = seeded();
    const open = anOpenReferral(state);
    const unitNames = state.units.map((unit) => unit.name);

    const next = wardFlowReducer(state, {
      type: "WITHDRAW_REFERRAL",
      role: "ed",
      now: NOW,
      movementId: open.id,
    });

    const added = movement(next, open.id).withdrawnReferrals.slice(open.withdrawnReferrals.length);
    for (const entry of added) {
      expect(WITHDRAWAL_REASONS).toContain(entry.reason);
      for (const name of unitNames) {
        expect(entry.reason).not.toContain(name);
      }
    }
  });

  describe("what it refuses", () => {
    /*
     * 🔴 CORRECTED 2026-09-15 under WLQ-38 (owner). Until this ruling, EVERY role was refused here
     * once `acceptedUnitId` was set. His words: *"This should also be the referring doctors
     * responsibility as well to be able to revoke the transport as well as referral in addition to
     * the coordinator."* `ed` (the referrer) and `coordinator` may now withdraw an accepted
     * referral — see the "withdrawing an accepted referral" describe block below for those cases,
     * which used to be this test before the ruling. `community` and `ward` remain refused, which is
     * what this test now proves instead.
     */
    it("still refuses a ward or a community team to undo an acceptance", () => {
      const state = seeded();
      const open = anOpenReferral(state);
      const accepted = wardFlowReducer(state, {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now: NOW,
        movementId: open.id,
        unitId: open.referredUnitIds[0],
      });
      expect(accepted.rejections).toHaveLength(0);

      for (const role of ["ward", "community"] as const) {
        const next = wardFlowReducer(accepted, {
          type: "WITHDRAW_REFERRAL",
          role,
          now: NOW + 10,
          movementId: open.id,
        });

        expect(next.rejections, `${role} was not refused`).toHaveLength(1);
        expect(next.rejections[0].reason).toMatch(/only the referrer or the coordinator/i);
        expect(movement(next, open.id).acceptedUnitId).toBe(open.referredUnitIds[0]);
      }
    });

    it("refuses a movement holding no live referral", () => {
      const state = seeded();
      const open = anOpenReferral(state);
      const once = wardFlowReducer(state, {
        type: "WITHDRAW_REFERRAL",
        role: "ed",
        now: NOW,
        movementId: open.id,
      });

      // A second withdrawal has nothing left to withdraw — and the movement is closed by the first,
      // so it is refused on the earlier guard rather than silently appending an empty record.
      const twice = wardFlowReducer(once, {
        type: "WITHDRAW_REFERRAL",
        role: "ed",
        now: NOW + 5,
        movementId: open.id,
      });

      expect(twice.rejections).toHaveLength(1);
      expect(movement(twice, open.id).withdrawnReferrals).toEqual(movement(once, open.id).withdrawnReferrals);
    });

    it("refuses an unknown movement", () => {
      const state = seeded();
      const next = wardFlowReducer(state, {
        type: "WITHDRAW_REFERRAL",
        role: "ed",
        now: NOW,
        movementId: "MV-NOT-A-REAL-ONE",
      });

      expect(next.rejections).toHaveLength(1);
      expect(next.rejections[0].reason).toMatch(/no movement found/i);
      expect(next.movements).toEqual(state.movements);
    });

    it("refuses a role that never refers", () => {
      /*
       * Whoever referred may un-refer, so the role list mirrors RAISE_REFERRAL's rather than
       * narrowing it. `officer` is not on it: a transport officer moves people and does not decide
       * whether a bed is still wanted.
       */
      const state = seeded();
      const open = anOpenReferral(state);
      const next = wardFlowReducer(state, {
        type: "WITHDRAW_REFERRAL",
        role: "officer",
        now: NOW,
        movementId: open.id,
      });

      expect(next.rejections).toHaveLength(1);
      expect(movement(next, open.id).referredUnitIds).toEqual(open.referredUnitIds);
    });
  });
});

/**
 * 🔴 WLQ-38 (owner, 2026-09-15), verbatim: *"This should also be the referring doctors
 * responsibility as well to be able to revoke the transport as well as referral in addition to the
 * coordinator."*
 *
 * Before this ruling, `WITHDRAW_REFERRAL` refused every role once `acceptedUnitId` was set. Now the
 * referrer (`ed`) and the coordinator may revoke an ACCEPTED referral, once, up until the patient is
 * collected — see `tests/ward-stop-transport.test.ts` for the case after collection.
 */
describe("withdrawing an accepted referral — WLQ-38 (owner, 2026-09-15)", () => {
  /**
   * A live, unaccepted referral at a unit that can actually be PULLED — `anOpenReferral`'s own first
   * match (`WF-002` at `fsh-older-adult`, measured) carries a stale capacity-freshness gate AND a
   * unit with zero allocatable beds, so accepting or pulling it needs an override reason for the
   * gate and still fails PULL_PATIENT's own bed-count guard. This test's own subject needs a unit
   * with room, found rather than assumed.
   */
  function anOpenReferralWithCapacity(state: WardFlowState) {
    const found = state.movements.find(
      (candidate) =>
        candidate.referredUnitIds.length > 0 &&
        !candidate.acceptedUnitId &&
        !candidate.closure &&
        (state.units.find((unit) => unit.id === candidate.referredUnitIds[0])?.allocatable.value ?? 0) > 0,
    );
    if (!found) throw new Error("the seed contains no live, unaccepted referral at a unit with room to pull");
    return found;
  }

  /** Accepts the first live referral on an open movement, at the first unit that referred it. An
   *  override reason is supplied unconditionally so a stale capacity-freshness gate (unrelated to
   *  what this describe block tests) cannot make the helper itself flaky. */
  function accept(state: WardFlowState, movement: ReturnType<typeof anOpenReferralWithCapacity>) {
    const unitId = movement.referredUnitIds[0]!;
    const accepted = wardFlowReducer(state, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW,
      movementId: movement.id,
      unitId,
      overrideReason: "The bed information is known to be out of date",
    });
    expect(accepted.rejections, "ACCEPT_IN_PRINCIPLE was itself refused, so nothing below holds").toHaveLength(0);
    return { state: accepted, movementId: movement.id, unitId };
  }

  /** Accepts, then pulls the bed — a genuine `PULL_PATIENT` dispatch, so `admissionId` is set and
   *  the unit's `allocatable` is genuinely decremented (unlike the hand-authored seed's own `pulled`
   *  movements, which carry neither). */
  function acceptAndPull(state: WardFlowState) {
    const open = anOpenReferralWithCapacity(state);
    const { state: accepted, movementId, unitId } = accept(state, open);
    const pulled = wardFlowReducer(accepted, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW + 1,
      movementId,
      unitId,
    });
    expect(pulled.rejections, "PULL_PATIENT was itself refused, so nothing below holds").toHaveLength(0);
    return { state: pulled, movementId, unitId };
  }

  /** Accepts, pulls, books transport and drives it through to collection. */
  function acceptPullAndCollect(state: WardFlowState) {
    const { state: pulled, movementId, unitId } = acceptAndPull(state);
    const booked = wardFlowReducer(pulled, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: NOW + 2,
      movementId,
      provider: "Ambulance service",
      escortRequired: false,
      cadNumber: "CAD-STUB-0001",
      transportLegalStatus: "voluntary",
      estimatedAt: 0,
    });
    expect(booked.rejections, "BOOK_TRANSPORT was itself refused, so nothing below holds").toHaveLength(0);
    const ready = wardFlowReducer(booked, { type: "HANDOVER_READY", role: "ed", now: NOW + 3, movementId });
    expect(ready.rejections, "HANDOVER_READY was itself refused, so nothing below holds").toHaveLength(0);
    const transportAccepted = wardFlowReducer(ready, {
      type: "TRANSPORT_ACCEPTED",
      role: "officer",
      now: NOW + 4,
      movementId,
    });
    expect(transportAccepted.rejections, "TRANSPORT_ACCEPTED was itself refused").toHaveLength(0);
    const enRoute = wardFlowReducer(transportAccepted, {
      type: "TRANSPORT_EN_ROUTE",
      role: "officer",
      now: NOW + 5,
      movementId,
    });
    expect(enRoute.rejections, "TRANSPORT_EN_ROUTE was itself refused").toHaveLength(0);
    const collected = wardFlowReducer(enRoute, {
      type: "PATIENT_COLLECTED",
      role: "officer",
      now: NOW + 6,
      movementId,
    });
    expect(collected.rejections, "PATIENT_COLLECTED was itself refused, so nothing below holds").toHaveLength(0);
    return { state: collected, movementId, unitId };
  }

  describe.each(["ed", "coordinator"] as const)("%s withdraws after acceptance and pull", (role) => {
    it("refunds the bed exactly once, deletes the admission, cancels transport, closes the movement, and notifies the accepting ward", () => {
      const { state: pulled, movementId, unitId } = acceptAndPull(seedWardFlowState());
      const unitBefore = pulled.units.find((candidate) => candidate.id === unitId)!;
      // Captured AFTER the pull, which created one admission — WITHDRAW_REFERRAL must delete
      // exactly that one, so the count afterwards is one FEWER than this, not equal to it.
      const admissionsAfterPull = pulled.admissions.length;

      const booked = wardFlowReducer(pulled, {
        type: "BOOK_TRANSPORT",
        role: "ed",
        now: NOW + 2,
        movementId,
        provider: "Ambulance service",
        escortRequired: false,
        cadNumber: "CAD-STUB-0001",
        transportLegalStatus: "voluntary",
        estimatedAt: 0,
      });
      expect(booked.rejections, "BOOK_TRANSPORT was itself refused, so nothing below holds").toHaveLength(0);
      const ready = wardFlowReducer(booked, { type: "HANDOVER_READY", role: "ed", now: NOW + 3, movementId });
      expect(ready.rejections, "HANDOVER_READY was itself refused, so nothing below holds").toHaveLength(0);

      const withdrawn = wardFlowReducer(ready, {
        type: "WITHDRAW_REFERRAL",
        role,
        now: NOW + 4,
        movementId,
      });

      expect(withdrawn.rejections, `${role} was refused: ${withdrawn.rejections.at(-1)?.reason}`).toHaveLength(0);
      const after = movement(withdrawn, movementId);
      const unitAfter = withdrawn.units.find((candidate) => candidate.id === unitId)!;

      // Bed refunded exactly once.
      expect(unitAfter.allocatable.value).toBe(unitBefore.allocatable.value + 1);
      // No orphan admission — exactly the one PULL_PATIENT created is gone, and nothing else.
      expect(withdrawn.admissions.length).toBe(admissionsAfterPull - 1);
      expect(after.admissionId).toBeUndefined();
      // Transport cancelled.
      expect(after.transport?.cancelledAt).toBe(NOW + 4);
      // Movement closed as not proceeding.
      expect(after.closure?.outcome).toBe("did_not_proceed");
      expect(after.closure?.at).toBe(NOW + 4);
      // The accepting ward is notified.
      const notice = withdrawn.notices.find((candidate) => candidate.kind === "referral_revoked_ward");
      expect(notice, "no notice reached the accepting ward").toBeDefined();
      expect(notice?.to).toEqual({ role: "ward", placeId: unitId });
      expect(notice?.about.movementId).toBe(movementId);

      // Applying it a second time is a no-op on the unit — the movement is closed now, so a repeat
      // is refused rather than refunding the bed a second time.
      const twice = wardFlowReducer(withdrawn, { type: "WITHDRAW_REFERRAL", role, now: NOW + 5, movementId });
      expect(twice.rejections.length).toBeGreaterThan(withdrawn.rejections.length);
      expect(twice.units.find((candidate) => candidate.id === unitId)?.allocatable.value).toBe(
        unitAfter.allocatable.value,
      );
    });
  });

  it("refuses the accepting ward, even after a pull, leaving the bed and admission untouched", () => {
    const { state: pulled, movementId, unitId } = acceptAndPull(seedWardFlowState());
    const unitBefore = pulled.units.find((candidate) => candidate.id === unitId)!;

    const next = wardFlowReducer(pulled, { type: "WITHDRAW_REFERRAL", role: "ward", now: NOW + 2, movementId });

    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0]?.reason).toMatch(/only the referrer or the coordinator/i);
    expect(movement(next, movementId).closure).toBeUndefined();
    expect(next.units.find((candidate) => candidate.id === unitId)?.allocatable.value).toBe(
      unitBefore.allocatable.value,
    );
  });

  it("permits ed to withdraw an accepted-but-not-yet-pulled referral, with nothing to release", () => {
    // Before any pull, no bed is held for this movement yet — the happy path this test exists to
    // pin is that WITHDRAW_REFERRAL still succeeds and closes the movement even though there is
    // nothing to refund.
    const seed = seedWardFlowState();
    const { state: accepted, movementId } = accept(seed, anOpenReferralWithCapacity(seed));
    const next = wardFlowReducer(accepted, { type: "WITHDRAW_REFERRAL", role: "ed", now: NOW + 1, movementId });

    expect(next.rejections, `ed was refused: ${next.rejections.at(-1)?.reason}`).toHaveLength(0);
    const after = movement(next, movementId);
    expect(after.closure?.outcome).toBe("did_not_proceed");
    expect(after.admissionId).toBeUndefined();
  });

  it("refuses everyone once the patient has been collected, pointing at STOP_TRANSPORT instead", () => {
    const { state: collected, movementId } = acceptPullAndCollect(seedWardFlowState());

    for (const role of ["ed", "coordinator"] as const) {
      const next = wardFlowReducer(collected, { type: "WITHDRAW_REFERRAL", role, now: NOW + 7, movementId });
      expect(next.rejections, `${role} was not refused`).toHaveLength(1);
      expect(next.rejections[0]?.reason).toMatch(/collected.*STOP_TRANSPORT/i);
      expect(movement(next, movementId).closure).toBeUndefined();
    }
  });

  /*
   * ⚠️ THE POSITIVE CONTROL. Before acceptance, WITHDRAW_REFERRAL's behaviour is exactly what it
   * was before WLQ-38 — proven here rather than assumed, because the branch added above runs before
   * the pre-existing `referredUnitIds.length === 0` guard and a wiring mistake there could silently
   * change the pre-acceptance path too.
   */
  it("before acceptance, every referring role still withdraws exactly as it did before WLQ-38", () => {
    const state = seedWardFlowState();
    const open = anOpenReferral(state);

    const next = wardFlowReducer(state, {
      type: "WITHDRAW_REFERRAL",
      role: "community",
      now: NOW,
      movementId: open.id,
    });

    expect(next.rejections).toHaveLength(0);
    const after = movement(next, open.id);
    expect(after.referredUnitIds).toHaveLength(0);
    expect(after.closure?.reason).toBe("The referrer withdrew the referral");
  });
});
