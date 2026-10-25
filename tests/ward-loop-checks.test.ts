import { describe, expect, it } from "vitest";

import {
  closureTransitionItems,
  currentAcceptanceConditions,
  currentRestrictionReview,
  outstandingAcceptanceConditions,
  restrictionReviewOverdue,
} from "@/components/ward-management/loop-checks/ward-loop-checks";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Closing the loop, package D (24 Oct 2026): records only, never an automatic change. */
const NOW = NOW_ANCHOR;
/** Any event, with `now` optional (distributes over the union). */
type EventInput = WardFlowEvent extends infer E
  ? E extends WardFlowEvent
    ? Omit<E, "now"> & { now?: number }
    : never
  : never;
const send = (state: WardFlowState, event: EventInput) =>
  wardFlowReducer(state, { now: NOW, ...event } as WardFlowEvent);
const movementOf = (state: WardFlowState, id: string) => state.movements.find((movement) => movement.id === id)!;
const unitOf = (state: WardFlowState, id: string) => state.units.find((unit) => unit.id === id)!;
/** What a save holds: a JSON copy, as the restore check reads it. */
const stored = (state: WardFlowState) => JSON.parse(JSON.stringify(state)) as WardFlowState;

describe("demo seed", () => {
  it("shows one of each record and still passes the restore check", () => {
    const state = seedWardFlowState();
    expect(movementOf(state, "WF-008").cancellationChecks).toHaveLength(2);
    expect(outstandingAcceptanceConditions(movementOf(state, "WF-003"))).toHaveLength(1);
    expect(currentAcceptanceConditions(movementOf(state, "WF-023"))[0]?.kind).toBe("bed_after_time");
    const closed = unitOf(state, "gry-older-adult");
    expect(closed.isClosed).toBe(true);
    const review = currentRestrictionReview(closed, "admissions_closure")!;
    expect(restrictionReviewOverdue(review, NOW)).toBe(true);
    expect(currentRestrictionReview(unitOf(state, "gry-adult-secure"), "intake_constraints")).toBeDefined();
    expect(closureTransitionItems(closed, state.movements, state.referrals, state.plannedAdmissions).length).toBe(1);
    expect(isValidStoredWardFlowState(stored(state))).toBe(true);
    // A mark outside the fixed lists is refused at restore.
    const bad = stored(state);
    bad.movements.find((movement) => movement.id === "WF-008")!.cancellationChecks![0]!.mark = "typed" as never;
    expect(isValidStoredWardFlowState(bad)).toBe(false);
  });
});

describe("MARK_CANCELLED_MOVE_CHECK", () => {
  it("records a mark on a cancelled move and changes nothing else", () => {
    const state = seedWardFlowState();
    const before = movementOf(state, "WF-008");
    const next = send(state, {
      type: "MARK_CANCELLED_MOVE_CHECK",
      role: "coordinator",
      movementId: "WF-008",
      item: "pulled_bed",
      mark: "not_applicable",
    });
    expect(next.rejections).toEqual([]);
    const after = movementOf(next, "WF-008");
    expect(after.cancellationChecks).toContainEqual({
      item: "pulled_bed",
      mark: "not_applicable",
      at: NOW,
      by: "Flow coordinator",
    });
    expect({ ...after, cancellationChecks: undefined }).toEqual({ ...before, cancellationChecks: undefined });
    expect(next.units).toEqual(state.units);
    // A later mark for the same item replaces it.
    const changed = send(next, {
      type: "MARK_CANCELLED_MOVE_CHECK",
      role: "coordinator",
      movementId: "WF-008",
      item: "pulled_bed",
      mark: "addressed",
    });
    expect(movementOf(changed, "WF-008").cancellationChecks!.filter((c) => c.item === "pulled_bed")).toHaveLength(1);
  });

  it("refuses a move that was not cancelled, and a ward that did not accept it", () => {
    const state = seedWardFlowState();
    const open = send(state, {
      type: "MARK_CANCELLED_MOVE_CHECK",
      role: "coordinator",
      movementId: "WF-003",
      item: "escort",
      mark: "addressed",
    });
    expect(open.rejections).toHaveLength(1);
    const otherWard = send(state, {
      type: "MARK_CANCELLED_MOVE_CHECK",
      role: "ward",
      actingUnitId: "rph-adult-secure",
      movementId: "WF-008",
      item: "escort",
      mark: "addressed",
    });
    expect(otherWard.rejections).toHaveLength(1);
  });

  it("will not mark a still-pulled bed addressed, and releases nothing itself", () => {
    const seeded = seedWardFlowState();
    const state: WardFlowState = {
      ...seeded,
      movements: seeded.movements.map((movement) =>
        movement.id === "WF-008" ? { ...movement, admissionId: "AD-synthetic-held" } : movement,
      ),
    };
    const next = send(state, {
      type: "MARK_CANCELLED_MOVE_CHECK",
      role: "coordinator",
      movementId: "WF-008",
      item: "pulled_bed",
      mark: "addressed",
    });
    expect(next.rejections).toHaveLength(1);
    expect(movementOf(next, "WF-008").admissionId).toBe("AD-synthetic-held");
  });
});

describe("acceptance conditions", () => {
  it("records a condition for the standing acceptance and marks it met, without changing placement", () => {
    const state = seedWardFlowState();
    const before = movementOf(state, "WF-004");
    const recorded = send(state, {
      type: "RECORD_ACCEPTANCE_CONDITION",
      role: "ward",
      actingUnitId: before.acceptedUnitId!,
      movementId: "WF-004",
      condition: "escort_required",
      agreedWith: "coordinator",
    });
    expect(recorded.rejections).toEqual([]);
    const after = movementOf(recorded, "WF-004");
    expect(outstandingAcceptanceConditions(after)).toHaveLength(1);
    expect(after.stage).toBe(before.stage);
    expect(after.acceptedUnitId).toBe(before.acceptedUnitId);

    const duplicate = send(recorded, {
      type: "RECORD_ACCEPTANCE_CONDITION",
      role: "coordinator",
      movementId: "WF-004",
      condition: "escort_required",
      agreedWith: "ed",
    });
    expect(duplicate.rejections).toHaveLength(1);

    const met = send(recorded, {
      type: "MARK_ACCEPTANCE_CONDITION_MET",
      role: "coordinator",
      movementId: "WF-004",
      condition: "escort_required",
    });
    expect(outstandingAcceptanceConditions(movementOf(met, "WF-004"))).toHaveLength(0);
    expect(currentAcceptanceConditions(movementOf(met, "WF-004"))[0]?.met).toEqual({ at: NOW, by: "Flow coordinator" });
  });

  it("needs a later bed-after time, and refuses a ward that did not accept", () => {
    const state = seedWardFlowState();
    const noTime = send(state, {
      type: "RECORD_ACCEPTANCE_CONDITION",
      role: "coordinator",
      movementId: "WF-004",
      condition: "bed_after_time",
      agreedWith: "ed",
    });
    expect(noTime.rejections).toHaveLength(1);
    const timed = send(state, {
      type: "RECORD_ACCEPTANCE_CONDITION",
      role: "coordinator",
      movementId: "WF-004",
      condition: "bed_after_time",
      agreedWith: "ed",
      readyAt: NOW + 120,
    });
    expect(timed.rejections).toEqual([]);
    const otherWard = send(state, {
      type: "RECORD_ACCEPTANCE_CONDITION",
      role: "ward",
      actingUnitId: "gry-adult-secure",
      movementId: "WF-004",
      condition: "escort_required",
      agreedWith: "ed",
    });
    expect(otherWard.rejections).toHaveLength(1);
  });
});

describe("RECORD_RESTRICTION_REVIEW", () => {
  it("sets a reviewer and time for a restriction in place, and never lifts it", () => {
    const state = seedWardFlowState();
    const next = send(state, {
      type: "RECORD_RESTRICTION_REVIEW",
      role: "coordinator",
      unitId: "gry-older-adult",
      restriction: "admissions_closure",
      reviewer: "nurse_unit_manager",
      expectedAt: NOW + 8 * 60,
    });
    expect(next.rejections).toEqual([]);
    const unit = unitOf(next, "gry-older-adult");
    expect(unit.isClosed).toBe(true);
    const review = currentRestrictionReview(unit, "admissions_closure")!;
    expect(review.reviewer).toBe("nurse_unit_manager");
    expect(restrictionReviewOverdue(review, NOW)).toBe(false);
    // Passing the review time reads as overdue; nothing else changes.
    expect(restrictionReviewOverdue(review, NOW + 8 * 60)).toBe(true);
  });

  it("refuses a restriction that is not in place and a time in the past", () => {
    const state = seedWardFlowState();
    expect(
      send(state, {
        type: "RECORD_RESTRICTION_REVIEW",
        role: "coordinator",
        unitId: "rph-adult-secure",
        restriction: "admissions_closure",
        reviewer: "nurse_unit_manager",
        expectedAt: NOW + 60,
      }).rejections,
    ).toHaveLength(1);
    expect(
      send(state, {
        type: "RECORD_RESTRICTION_REVIEW",
        role: "coordinator",
        unitId: "gry-adult-secure",
        restriction: "intake_constraints",
        reviewer: "nurse_unit_manager",
        expectedAt: NOW - 1,
      }).rejections,
    ).toHaveLength(1);
  });

  it("drops a closure's review when the ward is reopened and closed again", () => {
    const state = seedWardFlowState();
    const reopened = send(state, { type: "REOPEN_WARD_TO_ADMISSIONS", role: "coordinator", unitId: "gry-older-adult" });
    const closedAgain = send(reopened, {
      type: "CLOSE_WARD_TO_ADMISSIONS",
      role: "coordinator",
      unitId: "gry-older-adult",
      reason: "staffing",
      now: NOW + 5,
    });
    expect(currentRestrictionReview(unitOf(closedAgain, "gry-older-adult"), "admissions_closure")).toBeUndefined();
  });
});

describe("MARK_CLOSURE_TRANSITION_ITEM", () => {
  it("marks an item dealt with and moves, reassigns or releases nothing", () => {
    const state = seedWardFlowState();
    const unit = unitOf(state, "gry-older-adult");
    const [item] = closureTransitionItems(unit, state.movements, state.referrals, state.plannedAdmissions);
    expect(item).toBeDefined();
    const next = send(state, {
      type: "MARK_CLOSURE_TRANSITION_ITEM",
      role: "coordinator",
      unitId: unit.id,
      item: item!.kind,
      ...(item!.kind === "referral" ? { referralId: item!.recordId } : { movementId: item!.recordId }),
    });
    expect(next.rejections).toEqual([]);
    expect(unitOf(next, unit.id).admissionsClosure?.transitionMarks).toEqual([
      { ...item, at: NOW, by: "Flow coordinator" },
    ]);
    expect(next.movements).toEqual(state.movements);
    expect(next.referrals).toEqual(state.referrals);

    const again = send(next, {
      type: "MARK_CLOSURE_TRANSITION_ITEM",
      role: "coordinator",
      unitId: unit.id,
      item: item!.kind,
      ...(item!.kind === "referral" ? { referralId: item!.recordId } : { movementId: item!.recordId }),
    });
    expect(again.rejections).toHaveLength(1);
    expect(isValidStoredWardFlowState(stored(next))).toBe(true);
  });

  it("refuses an open ward, an item not pointed at the ward, and another ward acting", () => {
    const state = seedWardFlowState();
    expect(
      send(state, {
        type: "MARK_CLOSURE_TRANSITION_ITEM",
        role: "coordinator",
        unitId: "rph-adult-secure",
        item: "accepted",
        movementId: "WF-003",
      }).rejections,
    ).toHaveLength(1);
    expect(
      send(state, {
        type: "MARK_CLOSURE_TRANSITION_ITEM",
        role: "coordinator",
        unitId: "gry-older-adult",
        item: "accepted",
        movementId: "WF-003",
      }).rejections,
    ).toHaveLength(1);
    expect(
      send(state, {
        type: "MARK_CLOSURE_TRANSITION_ITEM",
        role: "ward",
        actingUnitId: "rph-adult-secure",
        unitId: "gry-older-adult",
        item: "bed_request",
        movementId: "WF-003",
      }).rejections,
    ).toHaveLength(1);
  });
});
