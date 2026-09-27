import { describe, expect, it } from "vitest";

import { URGENT_MARK_REASONS, type UrgentMarkReason } from "../src/components/ward-management/ward-change-reasons";
import { EVENT_ROLE } from "../src/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { isFlaggedUrgent, queueOrder } from "../src/components/ward-management/ward-priority";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

// Any real member does for a test that is not about WHICH reason was chosen.
const A_REASON: UrgentMarkReason = "cannot_safely_prevent_leaving";

function movement(state: WardFlowState, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

function anOpenUnflagged(state: WardFlowState) {
  const found = state.movements.find(
    (candidate) => !candidate.closure && candidate.stage !== "arrived" && !candidate.flaggedUrgent,
  );
  if (!found) throw new Error("the seed contains no open, unflagged movement");
  return found;
}

describe("the urgent flag — the mechanism the owner asked for and nobody could reach", () => {
  /*
   * WHY THIS FILE EXISTS. `Movement.flaggedUrgent` was added on 2026-08-30 with a ranking rule
   * above it — `queueOrder` puts it ABOVE all three urgency tiers — and a "Flagged urgent" badge on
   * the coordinator queue below it. Its only writer was the literal `false` in `RAISE_REFERRAL`,
   * and exactly one hand-authored movement carried `true`. There was no flagging event among the
   * thirty-nine: the feature was fully built and entirely unreachable.
   *
   * Item 37 (2026-09-17) closed the part of the owner's "for many reasons… I will build on it
   * later" that this file used to pin as deliberately open: a flag now needs a reason chosen from
   * `URGENT_MARK_REASONS`, and records who raised it and when. Clearing still needs neither.
   */

  it("the fixture carries exactly two flagged movements, which is what made this invisible", () => {
    // Non-vacuity, and the audit's own figure re-measured rather than quoted: WF-018's seeded
    // `true` is why the badge and the ordering both LOOKED alive. WF-030 (2026-09-17 sample-data
    // addition) is the second, deliberately placed beside it. Flagged movements still lead: see
    // ward-priority.test.ts.
    expect(wardMovements.filter((candidate) => candidate.flaggedUrgent)).toHaveLength(2);
  });

  it("flags a patient, recording who did it, when, and the reason chosen", () => {
    const state = seedWardFlowState();
    const target = anOpenUnflagged(state);

    const next = wardFlowReducer(state, {
      type: "FLAG_MOVEMENT_URGENT",
      role: "coordinator",
      now: NOW,
      movementId: target.id,
      reason: A_REASON,
    });

    expect(next.rejections).toHaveLength(0);
    expect(movement(next, target.id).flaggedUrgent).toBe(true);
    expect(isFlaggedUrgent(movement(next, target.id))).toBe(true);
    expect(movement(next, target.id).urgentFlag).toEqual({ at: NOW, by: "coordinator", reason: A_REASON });
  });

  it("unflags them again, which is the half that would otherwise be a new permanent state", () => {
    const state = seedWardFlowState();
    const target = anOpenUnflagged(state);

    const flagged = wardFlowReducer(state, {
      type: "FLAG_MOVEMENT_URGENT",
      role: "coordinator",
      now: NOW,
      movementId: target.id,
      reason: A_REASON,
    });
    const cleared = wardFlowReducer(flagged, {
      type: "CLEAR_MOVEMENT_URGENT_FLAG",
      role: "coordinator",
      now: NOW + 60,
      movementId: target.id,
    });

    expect(cleared.rejections).toHaveLength(0);
    expect(movement(cleared, target.id).flaggedUrgent).toBe(false);
    // The provenance clears with the boolean — the two must never disagree about whether a flag
    // is live (see `Movement.urgentFlag`'s own doc comment in ward-model.ts).
    expect(movement(cleared, target.id).urgentFlag).toBeUndefined();
  });

  it("can clear the one the SEED flagged, which nothing could touch before", () => {
    const state = seedWardFlowState();
    const seededFlag = state.movements.find((candidate) => candidate.flaggedUrgent);
    if (!seededFlag) throw new Error("the seed flags nobody urgent");
    // Precondition: the seeded flag was hand-authored before this field existed and carries no
    // provenance — see `Movement.urgentFlag`'s own doc comment on WF-018.
    expect(seededFlag.urgentFlag).toBeUndefined();

    const cleared = wardFlowReducer(state, {
      type: "CLEAR_MOVEMENT_URGENT_FLAG",
      role: "coordinator",
      now: NOW,
      movementId: seededFlag.id,
    });

    expect(cleared.rejections).toHaveLength(0);
    expect(movement(cleared, seededFlag.id).flaggedUrgent).toBe(false);
    expect(movement(cleared, seededFlag.id).urgentFlag).toBeUndefined();
  });

  /**
   * ⚠️ THE ASSERTION THAT MAKES THE FEATURE REAL RATHER THAN MERELY STORED. The owner's words were
   * that a flag "outranks everything", so this walks the actual queue: a flagged patient in the
   * LEAST urgent tier must lead one in the most urgent tier. A test that only checked the boolean
   * would pass just as well against a flag nothing sorted on.
   */
  it("puts a flagged tier-3 patient ahead of an unflagged tier-1 patient", () => {
    const state = seedWardFlowState();
    const open = state.movements.filter((candidate) => !candidate.closure && candidate.stage !== "arrived");
    const leastUrgent = open.find((candidate) => candidate.urgency === 3 && !candidate.flaggedUrgent);
    const mostUrgent = open.find((candidate) => candidate.urgency === 1 && !candidate.flaggedUrgent);
    if (!leastUrgent || !mostUrgent) throw new Error("the seed lacks an open tier-1 and tier-3 pair");

    // Before: the tier does the ordering, and the tier-1 patient leads.
    const before = queueOrder(state.movements, NOW).map((candidate) => candidate.id);
    expect(before.indexOf(mostUrgent.id)).toBeLessThan(before.indexOf(leastUrgent.id));

    const flagged = wardFlowReducer(state, {
      type: "FLAG_MOVEMENT_URGENT",
      role: "coordinator",
      now: NOW,
      movementId: leastUrgent.id,
      reason: A_REASON,
    });
    expect(flagged.rejections).toHaveLength(0);

    const after = queueOrder(flagged.movements, NOW).map((candidate) => candidate.id);
    expect(after.indexOf(leastUrgent.id)).toBeLessThan(after.indexOf(mostUrgent.id));

    // And it goes back when the flag is removed — the ordering is not a one-way door either.
    const cleared = wardFlowReducer(flagged, {
      type: "CLEAR_MOVEMENT_URGENT_FLAG",
      role: "coordinator",
      now: NOW + 60,
      movementId: leastUrgent.id,
    });
    const restored = queueOrder(cleared.movements, NOW).map((candidate) => candidate.id);
    expect(restored.indexOf(mostUrgent.id)).toBeLessThan(restored.indexOf(leastUrgent.id));
  });

  it("refuses a second flag, rather than reporting a no-op as success", () => {
    const state = seedWardFlowState();
    const seededFlag = state.movements.find((candidate) => candidate.flaggedUrgent);
    if (!seededFlag) throw new Error("the seed flags nobody urgent");

    const next = wardFlowReducer(state, {
      type: "FLAG_MOVEMENT_URGENT",
      role: "coordinator",
      now: NOW,
      movementId: seededFlag.id,
      reason: A_REASON,
    });

    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0]?.reason).toContain("already flagged urgent");
  });

  it("refuses clearing a flag that is not there", () => {
    const state = seedWardFlowState();
    const target = anOpenUnflagged(state);

    const next = wardFlowReducer(state, {
      type: "CLEAR_MOVEMENT_URGENT_FLAG",
      role: "coordinator",
      now: NOW,
      movementId: target.id,
    });

    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0]?.reason).toContain("not flagged urgent");
  });

  it("refuses flagging a closed movement, which is not in the queue to be promoted within", () => {
    const state = seedWardFlowState();
    const closed = state.movements.find((candidate) => candidate.closure && !candidate.flaggedUrgent);
    if (!closed) throw new Error("the seed contains no closed unflagged movement");

    const next = wardFlowReducer(state, {
      type: "FLAG_MOVEMENT_URGENT",
      role: "coordinator",
      now: NOW,
      movementId: closed.id,
      reason: A_REASON,
    });

    expect(next.rejections).toHaveLength(1);
    expect(movement(next, closed.id).flaggedUrgent).toBe(false);
  });

  /**
   * ⚠️ The permission is not merely "some list" — it must be the SAME list as `CHANGE_URGENCY`.
   * The flag sits above all three tiers in `queueOrder`, so a role that may flag but may not move
   * a tier could put a patient above every tier 1 while being unable to move them to tier 1. This
   * asserts the two lists against each other rather than restating one of them.
   */
  it("permits exactly the roles that may already move an urgency tier, and no more", () => {
    expect([...EVENT_ROLE.FLAG_MOVEMENT_URGENT]).toEqual([...EVENT_ROLE.CHANGE_URGENCY]);
    expect([...EVENT_ROLE.CLEAR_MOVEMENT_URGENT_FLAG]).toEqual([...EVENT_ROLE.CHANGE_URGENCY]);
    expect([...EVENT_ROLE.FLAG_MOVEMENT_URGENT]).toEqual(["coordinator", "ed"]);

    const state = seedWardFlowState();
    const target = anOpenUnflagged(state);
    for (const role of ["ward", "officer", "community", "demo"] as const) {
      const next = wardFlowReducer(state, {
        type: "FLAG_MOVEMENT_URGENT",
        role,
        now: NOW,
        movementId: target.id,
        reason: A_REASON,
      });
      expect(next.rejections, `${role} was allowed to flag a patient urgent`).toHaveLength(1);
      expect(movement(next, target.id).flaggedUrgent).toBe(false);
    }
  });

  /**
   * ⚠️ **ITEM 37 (2026-09-17) REPLACES THE OLD DEFERRAL.** This file used to pin "records the
   * boolean and nothing else — no reason, no author, no instant" as the owner's explicit, provable
   * deferral. That deferral is now resolved: this is the assertion that a flag raised by different
   * roles at different times, for different reasons, is recorded DIFFERENTLY — proving the fields
   * are actually written rather than merely typed.
   */
  it("records who flagged it, when, and the reason — not the same record twice for different inputs", () => {
    const state = seedWardFlowState();
    const target = anOpenUnflagged(state);

    const byCoordinator = wardFlowReducer(state, {
      type: "FLAG_MOVEMENT_URGENT",
      role: "coordinator",
      now: NOW,
      movementId: target.id,
      reason: "cannot_safely_prevent_leaving",
    });
    const byEd = wardFlowReducer(state, {
      type: "FLAG_MOVEMENT_URGENT",
      role: "ed",
      now: NOW + 500,
      movementId: target.id,
      reason: "safety_of_others_in_this_setting",
    });

    expect(movement(byCoordinator, target.id).urgentFlag).toEqual({
      at: NOW,
      by: "coordinator",
      reason: "cannot_safely_prevent_leaving",
    });
    expect(movement(byEd, target.id).urgentFlag).toEqual({
      at: NOW + 500,
      by: "ed",
      reason: "safety_of_others_in_this_setting",
    });
    // The two records disagree in every field they can — proving none of the three is a fixed
    // stand-in for the others.
    expect(movement(byCoordinator, target.id)).not.toEqual(movement(byEd, target.id));
  });

  it("refuses an unlisted reason, rather than storing free text on a clinical record", () => {
    const state = seedWardFlowState();
    const target = anOpenUnflagged(state);

    const next = wardFlowReducer(state, {
      type: "FLAG_MOVEMENT_URGENT",
      role: "coordinator",
      now: NOW,
      movementId: target.id,
      reason: "not_a_real_reason" as never,
    });

    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0]?.reason).toContain("URGENT_MARK_REASONS");
    expect(movement(next, target.id).flaggedUrgent).toBe(false);
    expect(movement(next, target.id).urgentFlag).toBeUndefined();
  });

  it("accepts every member of URGENT_MARK_REASONS, so the runtime check is not silently narrower than the list", () => {
    const state = seedWardFlowState();
    for (const reason of URGENT_MARK_REASONS) {
      const target = anOpenUnflagged(state);
      const next = wardFlowReducer(state, {
        type: "FLAG_MOVEMENT_URGENT",
        role: "coordinator",
        now: NOW,
        movementId: target.id,
        reason,
      });
      expect(next.rejections, `${reason} was refused, and it is a real member of URGENT_MARK_REASONS`).toHaveLength(0);
      expect(movement(next, target.id).urgentFlag?.reason).toBe(reason);
    }
  });

  /**
   * Review fix-forward item 6, 2026-09-17: `urgentFlag` alone loses the record the moment a flag
   * is cleared — a coordinator reviewing the shift afterwards would have no way to see a patient
   * was flagged at all. `urgentFlagHistory` is the append-only log that survives.
   */
  it("keeps a history entry through a raise-then-clear cycle, closing it rather than dropping it", () => {
    const state = seedWardFlowState();
    const target = anOpenUnflagged(state);

    const flagged = wardFlowReducer(state, {
      type: "FLAG_MOVEMENT_URGENT",
      role: "coordinator",
      now: NOW,
      movementId: target.id,
      reason: "safety_of_others_in_this_setting",
    });
    expect(movement(flagged, target.id).urgentFlagHistory).toEqual([
      { raisedAt: NOW, raisedBy: "coordinator", reason: "safety_of_others_in_this_setting" },
    ]);

    const cleared = wardFlowReducer(flagged, {
      type: "CLEAR_MOVEMENT_URGENT_FLAG",
      role: "ed",
      now: NOW + 90,
      movementId: target.id,
    });
    // The live flag is gone, but the history row survives, closed rather than removed.
    expect(movement(cleared, target.id).urgentFlag).toBeUndefined();
    expect(movement(cleared, target.id).urgentFlagHistory).toEqual([
      {
        raisedAt: NOW,
        raisedBy: "coordinator",
        reason: "safety_of_others_in_this_setting",
        clearedAt: NOW + 90,
        clearedBy: "ed",
      },
    ]);
  });

  it("adds a SECOND history row on a second raise, and clearing touches only the open one", () => {
    const state = seedWardFlowState();
    const target = anOpenUnflagged(state);

    const firstFlag = wardFlowReducer(state, {
      type: "FLAG_MOVEMENT_URGENT",
      role: "coordinator",
      now: NOW,
      movementId: target.id,
      reason: "cannot_safely_prevent_leaving",
    });
    const firstClear = wardFlowReducer(firstFlag, {
      type: "CLEAR_MOVEMENT_URGENT_FLAG",
      role: "coordinator",
      now: NOW + 60,
      movementId: target.id,
    });
    const secondFlag = wardFlowReducer(firstClear, {
      type: "FLAG_MOVEMENT_URGENT",
      role: "ed",
      now: NOW + 500,
      movementId: target.id,
      reason: "escort_in_place_and_unsustainable",
    });

    const historyAfterSecondRaise = movement(secondFlag, target.id).urgentFlagHistory;
    expect(historyAfterSecondRaise).toHaveLength(2);
    // The first row is unchanged by everything that happened after it closed.
    expect(historyAfterSecondRaise?.[0]).toEqual({
      raisedAt: NOW,
      raisedBy: "coordinator",
      reason: "cannot_safely_prevent_leaving",
      clearedAt: NOW + 60,
      clearedBy: "coordinator",
    });
    expect(historyAfterSecondRaise?.[1]).toEqual({
      raisedAt: NOW + 500,
      raisedBy: "ed",
      reason: "escort_in_place_and_unsustainable",
    });

    const secondClear = wardFlowReducer(secondFlag, {
      type: "CLEAR_MOVEMENT_URGENT_FLAG",
      role: "coordinator",
      now: NOW + 700,
      movementId: target.id,
    });
    const historyAfterSecondClear = movement(secondClear, target.id).urgentFlagHistory;
    // The clear must land on the SECOND (newest, open) row, never re-touch the first, already
    // closed one — that is the failure mode a naive "find the first open entry" would produce.
    expect(historyAfterSecondClear?.[0]).toEqual(historyAfterSecondRaise?.[0]);
    expect(historyAfterSecondClear?.[1]).toEqual({
      raisedAt: NOW + 500,
      raisedBy: "ed",
      reason: "escort_in_place_and_unsustainable",
      clearedAt: NOW + 700,
      clearedBy: "coordinator",
    });
  });

  it("clearing the seeded WF-018 flag, which predates this history field, leaves the history absent rather than an invented empty log", () => {
    const state = seedWardFlowState();
    const seededFlag = state.movements.find((candidate) => candidate.flaggedUrgent);
    if (!seededFlag) throw new Error("the seed flags nobody urgent");
    expect(seededFlag.urgentFlagHistory, "precondition: the seed carries no history for this field").toBeUndefined();

    const cleared = wardFlowReducer(state, {
      type: "CLEAR_MOVEMENT_URGENT_FLAG",
      role: "coordinator",
      now: NOW,
      movementId: seededFlag.id,
    });
    expect(movement(cleared, seededFlag.id).urgentFlagHistory).toBeUndefined();
  });
});
