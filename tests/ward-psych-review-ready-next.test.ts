/**
 * Psychiatry review tracker, ward wait list and referral response timer (Josh, 9 Nov 2026).
 * Records times only: nothing here scores, ranks, re-orders or places anyone. Synthetic seed only.
 */
import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { psychReviewStage } from "@/components/ward-management/ed/ed-psych-review";
import { movementOfferNoReplyWaits, noReplyTimeLabel } from "@/components/ward-management/referrals/referral-no-reply";
import { wardWaitList } from "@/components/ward-management/ward/ward-wait-list";
import type { Movement } from "@/components/ward-management/ward-model";

const apply = (state: WardFlowState, event: WardFlowEvent) => wardFlowReducer(state, event);
const refusals = (before: WardFlowState, after: WardFlowState) =>
  after.rejections.slice(before.rejections.length).map((rejection) => rejection.reason);

function openMovement(state: WardFlowState): Movement {
  const movement = state.movements.find((candidate) => !candidate.closure && !candidate.psychReview);
  if (!movement) throw new Error("seed has no open movement without a review");
  return movement;
}

describe("psychiatry review tracker", () => {
  it("records the request, then the registrar and consultant, each once", () => {
    const seeded = seedWardFlowState();
    const movementId = openMovement(seeded).id;
    const asked = apply(seeded, { type: "REQUEST_PSYCH_REVIEW", role: "ed", now: NOW_ANCHOR, movementId });
    expect(refusals(seeded, asked)).toEqual([]);
    const again = apply(asked, { type: "REQUEST_PSYCH_REVIEW", role: "ed", now: NOW_ANCHOR + 1, movementId });
    expect(refusals(asked, again)).toEqual(["A psychiatric review is already asked for."]);

    const registrar = apply(asked, {
      type: "RECORD_PSYCH_REVIEW_SEEN",
      role: "coordinator",
      now: NOW_ANCHOR + 50,
      movementId,
      grade: "registrar",
    });
    expect(refusals(asked, registrar)).toEqual([]);
    const twice = apply(registrar, {
      type: "RECORD_PSYCH_REVIEW_SEEN",
      role: "ed",
      now: NOW_ANCHOR + 51,
      movementId,
      grade: "registrar",
    });
    expect(refusals(registrar, twice)).toEqual(["The registrar review is already recorded."]);
    const consultant = apply(registrar, {
      type: "RECORD_PSYCH_REVIEW_SEEN",
      role: "ed",
      now: NOW_ANCHOR + 90,
      movementId,
      grade: "consultant",
    });
    const review = consultant.movements.find((m) => m.id === movementId)!.psychReview;
    expect(review).toEqual({
      requestedAt: NOW_ANCHOR,
      registrarSeenAt: NOW_ANCHOR + 50,
      consultantSeenAt: NOW_ANCHOR + 90,
    });
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(consultant)))).toBe(true);
  });

  it("refuses a ward, an unasked review, an off-list grade and a closed movement", () => {
    const seeded = seedWardFlowState();
    const movementId = openMovement(seeded).id;
    const ward = apply(seeded, { type: "REQUEST_PSYCH_REVIEW", role: "ward", now: NOW_ANCHOR, movementId });
    expect(refusals(seeded, ward)[0]).toContain("requires role ed or coordinator");
    const unasked = apply(seeded, {
      type: "RECORD_PSYCH_REVIEW_SEEN",
      role: "ed",
      now: NOW_ANCHOR,
      movementId,
      grade: "consultant",
    });
    expect(refusals(seeded, unasked)).toEqual(["No psychiatric review has been asked for yet."]);
    const asked = apply(seeded, { type: "REQUEST_PSYCH_REVIEW", role: "ed", now: NOW_ANCHOR, movementId });
    const offList = apply(asked, {
      type: "RECORD_PSYCH_REVIEW_SEEN",
      role: "ed",
      now: NOW_ANCHOR,
      movementId,
      grade: "nurse" as never,
    });
    expect(refusals(asked, offList)).toEqual([`RECORD_PSYCH_REVIEW_SEEN grade must be "registrar" or "consultant"`]);
    const closed = seeded.movements.find((m) => m.closure)!;
    const onClosed = apply(seeded, {
      type: "REQUEST_PSYCH_REVIEW",
      role: "ed",
      now: NOW_ANCHOR,
      movementId: closed.id,
    });
    expect(refusals(seeded, onClosed)).toEqual(["This movement is closed."]);
  });

  it("is taken back by the ED step Undo", () => {
    const seeded = seedWardFlowState();
    const movementId = openMovement(seeded).id;
    const asked = apply(seeded, { type: "REQUEST_PSYCH_REVIEW", role: "ed", now: NOW_ANCHOR, movementId });
    const undone = apply(asked, { type: "UNDO_ED_STEP", role: "ed", now: NOW_ANCHOR + 1, movementId });
    expect(refusals(asked, undone)).toEqual([]);
    expect(undone.movements.find((m) => m.id === movementId)!.psychReview).toBeUndefined();
  });

  it("says the stage and times from the request, else from arrival", () => {
    const base = openMovement(seedWardFlowState());
    expect(psychReviewStage({ ...base, psychReview: undefined }, 600, 95)).toMatchObject({
      line: "Review not yet asked for",
      waitedMinutes: 95,
      from: "arrival",
      next: ["ask"],
    });
    const asked = psychReviewStage({ ...base, psychReview: { requestedAt: 550 } }, 675, 300);
    expect(asked.line).toBe("Registrar review asked 09:10 · waiting 2h 05m");
    expect(asked.waitedMinutes).toBe(125);
    expect(asked.next).toEqual(["registrar", "consultant"]);
    const registrar = psychReviewStage({ ...base, psychReview: { requestedAt: 550, registrarSeenAt: 600 } }, 675, 300);
    expect(registrar.line).toBe("Registrar seen · consultant pending · waiting 2h 05m");
    expect(registrar.next).toEqual(["consultant"]);
  });
});

describe("ward ready for next patient", () => {
  const unitId = "rph-adult-secure";

  it("marks and cancels, the ward only for itself", () => {
    const seeded = seedWardFlowState();
    const marked = apply(seeded, {
      type: "MARK_WARD_READY_FOR_NEXT",
      role: "ward",
      now: NOW_ANCHOR,
      unitId,
      actingUnitId: unitId,
    });
    expect(refusals(seeded, marked)).toEqual([]);
    expect(marked.units.find((u) => u.id === unitId)!.readyForNextAt).toBe(NOW_ANCHOR);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(marked)))).toBe(true);
    const twice = apply(marked, { type: "MARK_WARD_READY_FOR_NEXT", role: "coordinator", now: NOW_ANCHOR, unitId });
    expect(refusals(marked, twice)[0]).toContain("is already marked ready.");
    const cancelled = apply(marked, {
      type: "MARK_WARD_READY_FOR_NEXT",
      role: "coordinator",
      now: NOW_ANCHOR + 5,
      unitId,
      cancel: true,
    });
    expect(refusals(marked, cancelled)).toEqual([]);
    expect(cancelled.units.find((u) => u.id === unitId)!.readyForNextAt).toBeUndefined();

    const otherWard = apply(seeded, {
      type: "MARK_WARD_READY_FOR_NEXT",
      role: "ward",
      now: NOW_ANCHOR,
      unitId,
      actingUnitId: "fsh-older-adult",
    });
    expect(refusals(seeded, otherWard)[0]).toContain("a ward marks only itself");
    const ed = apply(seeded, { type: "MARK_WARD_READY_FOR_NEXT", role: "ed", now: NOW_ANCHOR, unitId });
    expect(refusals(seeded, ed)[0]).toContain("requires role ward or coordinator");
  });

  it("is cleared by a pull into that ward", () => {
    const seeded = seedWardFlowState();
    const accepted = seeded.movements.find(
      (m) => !m.closure && m.stage === "accepted_awaiting_bed" && m.acceptedUnitId === unitId,
    )!;
    const marked = apply(seeded, { type: "MARK_WARD_READY_FOR_NEXT", role: "coordinator", now: NOW_ANCHOR, unitId });
    const pulled = apply(marked, {
      type: "PULL_PATIENT",
      role: "coordinator",
      now: NOW_ANCHOR + 1,
      movementId: accepted.id,
      unitId,
    });
    expect(refusals(marked, pulled)).toEqual([]);
    expect(pulled.units.find((u) => u.id === unitId)!.readyForNextAt).toBeUndefined();
  });

  it("lists the ward's standing wait list answers, oldest referral first", () => {
    const seeded = seedWardFlowState();
    const list = wardWaitList(seeded.movements, unitId);
    expect(list.map((m) => m.id)).toEqual(["WF-017", "WF-022"]);
    expect(list.every((m) => (m.waitlistedUnitIds ?? []).includes(unitId))).toBe(true);
  });
});

describe("referral response timer", () => {
  const configuration = { referralDecisionTargetMinutes: 120 };
  const units = [{ id: "bty-adult-secure", name: "BTY Adult Secure" }];

  it("counts each ward still to answer against the one Settings limit", () => {
    const base = openMovement(seedWardFlowState());
    const movement: Movement = {
      ...base,
      acceptedUnitId: undefined,
      referredUnitIds: ["bty-adult-secure"],
      declines: [],
      waitlistedUnitIds: undefined,
      referredAt: 500,
      referralDecisionOpenedAt: undefined,
    };
    const inside = movementOfferNoReplyWaits(movement, 540, configuration, units);
    expect(inside).toHaveLength(1);
    expect(noReplyTimeLabel(inside[0]!)).toBe("1h 20m left");
    const past = movementOfferNoReplyWaits(movement, 660, configuration, units);
    expect(past[0]!.pastLimit).toBe(true);
    expect(noReplyTimeLabel(past[0]!)).toBe("Overdue 40m");
    // A ward that declined is answered: no timer.
    const declined = { ...movement, declines: [{ unitId: "bty-adult-secure", at: 600 }] };
    expect(movementOfferNoReplyWaits(declined, 660, configuration, units)).toEqual([]);
  });

  it("escalates only by a person's tap, through the bed meeting action", () => {
    const seeded = seedWardFlowState();
    const movement = seeded.movements.find((m) => !m.closure && m.referredUnitIds.length > 0)!;
    const escalated = apply(seeded, {
      type: "RECORD_BED_MEETING_ACTION",
      role: "coordinator",
      now: NOW_ANCHOR,
      subject: { kind: "movement", id: movement.id },
      action: "escalate_ward_answer",
      owner: "ward",
      unitId: movement.referredUnitIds[0]!,
      dueAt: NOW_ANCHOR + 60,
    });
    expect(refusals(seeded, escalated)).toEqual([]);
    const ward = apply(seeded, {
      type: "RECORD_BED_MEETING_ACTION",
      role: "ward",
      now: NOW_ANCHOR,
      subject: { kind: "movement", id: movement.id },
      action: "escalate_ward_answer",
      owner: "ward",
      unitId: movement.referredUnitIds[0]!,
      dueAt: NOW_ANCHOR + 60,
    });
    expect(refusals(seeded, ward)[0]).toContain("requires role coordinator");
  });
});
