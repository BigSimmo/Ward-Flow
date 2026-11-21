import { describe, expect, it } from "vitest";

import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import {
  expectReviewDue,
  expectReviewTag,
  expectReviewWaitWords,
} from "@/components/ward-management/ward-expect-review";
import type { Movement } from "@/components/ward-management/ward-model";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// D-275 (Josh, 21 Nov 2026): a person not arrived after the signed wait is flagged by itself for a
// plan review: voluntary 48 hours (VALUE-047), not voluntary 7 days (VALUE-048). Values unchanged.
const HOUR = 60;
const DAY = 24 * HOUR;
const NOW = NOW_ANCHOR;

type Row = Parameters<typeof expectReviewDue>[0];
const row = (over: Partial<Row>): Row => ({
  openedAt: NOW - HOUR,
  legalStatus: "Voluntary",
  stage: "placement_requested",
  closure: undefined,
  transport: undefined,
  expectFlag: undefined,
  expectFlagHistory: undefined,
  ...over,
});

describe("the signed waits are unchanged", () => {
  it("reads 48 hours and 7 days, both signed", () => {
    expect(CLINICAL_VALUES.expectFlagVoluntary.value).toBe(48 * HOUR);
    expect(CLINICAL_VALUES.expectFlagInvoluntary.value).toBe(7 * DAY);
    expect(CLINICAL_VALUES.expectFlagVoluntary.status).toBe("signed");
    expect(CLINICAL_VALUES.expectFlagInvoluntary.status).toBe("signed");
    expect(expectReviewWaitWords("voluntary_48h")).toBe("48 hours");
    expect(expectReviewWaitWords("involuntary_7d")).toBe("7 days");
  });
});

describe("expectReviewDue", () => {
  it("flags a voluntary person at 48 hours, not a minute before", () => {
    expect(expectReviewDue(row({ openedAt: NOW - 48 * HOUR + 1 }), NOW)).toBeNull();
    expect(expectReviewDue(row({ openedAt: NOW - 48 * HOUR }), NOW)).toEqual({
      kind: "voluntary_48h",
      since: NOW,
      automatic: true,
    });
  });

  it("flags a not-voluntary person at 7 days, not at 48 hours", () => {
    const involuntary = { legalStatus: "Involuntary inpatient" as const };
    expect(expectReviewDue(row({ ...involuntary, openedAt: NOW - 3 * DAY }), NOW)).toBeNull();
    expect(expectReviewDue(row({ ...involuntary, openedAt: NOW - 7 * DAY - 5 }), NOW)).toEqual({
      kind: "involuntary_7d",
      since: NOW - 5,
      automatic: true,
    });
  });

  it("uses the 48 hour wait when no legal status is recorded (the named not-voluntary rule)", () => {
    expect(expectReviewDue(row({ legalStatus: undefined, openedAt: NOW - 48 * HOUR }), NOW)?.kind).toBe(
      "voluntary_48h",
    );
  });

  it("never flags someone who has arrived, whose transport delivered them, or whose movement closed", () => {
    const old = NOW - 10 * DAY;
    expect(expectReviewDue(row({ openedAt: old, stage: "arrived" }), NOW)).toBeNull();
    expect(
      expectReviewDue(
        row({ openedAt: old, stage: "moving", transport: { arrivedAt: NOW - 1 } as Movement["transport"] }),
        NOW,
      ),
    ).toBeNull();
    expect(expectReviewDue(row({ openedAt: old, closure: { at: NOW - 1 } as Movement["closure"] }), NOW)).toBeNull();
  });

  it("shows a person's open flag at once, whatever the wait", () => {
    const review = expectReviewDue(row({ expectFlag: { raisedAt: NOW - 5, kind: "voluntary_48h" } }), NOW);
    expect(review).toEqual({ kind: "voluntary_48h", since: NOW - 5, automatic: false });
    expect(expectReviewTag(review!)).toBe("Review plan: flagged by staff");
  });

  it("starts the wait again from the last clear", () => {
    const cleared = row({
      openedAt: NOW - 10 * DAY,
      expectFlag: { raisedAt: NOW - 8 * DAY, kind: "voluntary_48h", clearedAt: NOW - 47 * HOUR },
    });
    expect(expectReviewDue(cleared, NOW)).toBeNull();
    expect(expectReviewDue(cleared, NOW + HOUR)?.since).toBe(NOW + HOUR);
  });

  it("words the automatic tag from the signed value", () => {
    expect(expectReviewTag({ kind: "voluntary_48h", since: NOW, automatic: true })).toBe(
      "Review plan: not arrived after 48 hours",
    );
    expect(expectReviewTag({ kind: "involuntary_7d", since: NOW, automatic: true })).toBe(
      "Review plan: not arrived after 7 days",
    );
  });
});

describe("clearing the automatic flag through the reducer", () => {
  function withWaitingVoluntary(): { state: WardFlowState; movementId: Movement["id"] } {
    const seeded = seedWardFlowState();
    const source = seeded.movements.find((m) => !m.closure && m.stage !== "arrived" && !m.expectFlag);
    if (!source) throw new Error("seed has no open movement without an expect flag");
    const waiting: Movement = {
      ...source,
      legalStatus: "Voluntary",
      openedAt: NOW - 50 * HOUR,
      expectFlag: undefined,
      expectFlagHistory: undefined,
    };
    return {
      state: { ...seeded, movements: seeded.movements.map((m) => (m.id === source.id ? waiting : m)) },
      movementId: source.id,
    };
  }

  it("records the review, keeps it on the record, and the flag goes", () => {
    const { state, movementId } = withWaitingVoluntary();
    const cleared = wardFlowReducer(state, { type: "CLEAR_EXPECT_FLAG", role: "coordinator", now: NOW, movementId });
    expect(cleared.rejections).toHaveLength(state.rejections.length);
    const after = cleared.movements.find((m) => m.id === movementId)!;
    expect(after.expectFlag).toEqual({
      raisedAt: NOW - 2 * HOUR,
      kind: "voluntary_48h",
      automatic: true,
      clearedAt: NOW,
      clearedBy: "coordinator",
    });
    expect(expectReviewDue(after, NOW)).toBeNull();
    expect(expectReviewDue(after, NOW + 48 * HOUR)?.automatic).toBe(true);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(cleared)))).toBe(true);
  });

  it("moves an earlier cleared flag to the history", () => {
    const { state, movementId } = withWaitingVoluntary();
    const earlier = { raisedAt: NOW - 49 * HOUR, kind: "voluntary_48h" as const, clearedAt: NOW - 48 * HOUR - 30 };
    const seeded: WardFlowState = {
      ...state,
      movements: state.movements.map((m) => (m.id === movementId ? { ...m, expectFlag: earlier } : m)),
    };
    const cleared = wardFlowReducer(seeded, { type: "CLEAR_EXPECT_FLAG", role: "ed", now: NOW, movementId });
    const after = cleared.movements.find((m) => m.id === movementId)!;
    expect(after.expectFlag?.automatic).toBe(true);
    expect(after.expectFlag?.raisedAt).toBe(NOW - 30);
    expect(after.expectFlagHistory).toEqual([earlier]);
  });

  it("still refuses a clear when nothing is flagged", () => {
    const { state, movementId } = withWaitingVoluntary();
    const fresh: WardFlowState = {
      ...state,
      movements: state.movements.map((m) => (m.id === movementId ? { ...m, openedAt: NOW - HOUR } : m)),
    };
    const refused = wardFlowReducer(fresh, { type: "CLEAR_EXPECT_FLAG", role: "coordinator", now: NOW, movementId });
    expect(refused.rejections).toHaveLength(fresh.rejections.length + 1);
    expect(refused.rejections.at(-1)?.reason).toMatch(/has no open expect flag to clear$/);
  });
});
