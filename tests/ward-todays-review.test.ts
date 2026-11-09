import { CircleAlert } from "lucide-react";
import { describe, expect, it } from "vitest";

import {
  overridesToReview,
  REPEAT_DECLINE_THRESHOLD,
  todaysReview,
  type TodaysReviewInput,
} from "@/components/ward-management/review/todays-review-derivations";
import type { AuditEvent, AuditReview } from "@/components/ward-management/ward-audit";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import type { DeclineEntry, InboxItem } from "@/components/ward-management/ward-derivations";
import { DECLINE_REASONS, type Rejection } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Today's review (Home notes 4, issue 4): every line is read from existing records, today only. */
const NOW = NOW_ANCHOR;
const YESTERDAY = NOW - MINUTES_PER_DAY;
const [A, B, C, D] = wardMovements;
const decline = (
  movement: typeof A,
  unitId: string,
  at: number,
  reason: (typeof DECLINE_REASONS)[number] = DECLINE_REASONS[0],
): DeclineEntry => ({
  movement: movement!,
  decline: { unitId, at, reason },
});
const override = (id: string, at: number | null, generation = 0): AuditEvent =>
  ({
    id,
    sequence: 1,
    generation,
    at,
    actor: { role: "coordinator" },
    subject: { kind: "movement", movementId: A!.id },
    outcome: "accepted",
    reasonCode: "accepted",
    origin: "captured-this-session",
    category: "override",
    action: "PULL_PATIENT",
    details: { reason: null, overrideFactRecorded: true, targets: [] },
  }) as unknown as AuditEvent;
const review = (
  eventId: string,
  generation = 0,
  decision: AuditReview["decision"] = "reviewed",
  id = `r-${eventId}`,
): AuditReview => ({ id, eventId, generation, at: NOW, byRole: "coordinator", decision }) as AuditReview;
const problem: InboxItem = {
  id: "p1",
  tone: "warning",
  icon: CircleAlert,
  title: "Transport awaiting departure",
  detail: "accepted",
  owner: "Coordinator",
  movementId: B!.id,
  kind: "fact",
};

function input(over: Partial<TodaysReviewInput> = {}): TodaysReviewInput {
  return {
    declines: [],
    auditEvents: [],
    auditReviews: [],
    rejections: [],
    problems: [],
    generation: 0,
    now: NOW,
    ...over,
  };
}

describe("todaysReview", () => {
  it("keeps today's lines only, newest first", () => {
    const rejection: Rejection = {
      id: "x1",
      at: NOW - 5,
      movementId: A!.id,
      attempted: "PULL_PATIENT",
      reason: "taken",
    };
    const result = todaysReview(
      input({
        declines: [decline(A, "u1", NOW - 30), decline(B, "u2", YESTERDAY)],
        auditEvents: [override("o1", NOW - 10), override("o2", YESTERDAY)],
        rejections: [rejection],
      }),
    );
    expect(result.events.map((event) => event.kind)).toEqual(["stopped", "override", "decline"]);
    expect(result.counts).toMatchObject({ all: 3, decline: 1, override: 1, stopped: 1, problem: 0 });
  });

  it("groups a ward's declines on one line keyed by ward, not by a patient link", () => {
    const result = todaysReview(
      input({ declines: [decline(A, "u1", NOW - 40), decline(B, "u1", NOW - 20), decline(C, "u2", NOW - 10)] }),
    );
    const grouped = result.events.find((event) => event.kind === "decline" && event.unitId === "u1");
    expect(grouped).toMatchObject({ id: `decline-u1-${NOW - 20}`, at: NOW - 20 });
    expect(grouped?.kind === "decline" && grouped.members.length).toBe(2);
    expect(result.counts.decline).toBe(2);
  });

  it("raises a ward's repeated declines for one recorded reason at the threshold", () => {
    const repeats = [A, B, C].map((movement, i) => decline(movement, "u1", NOW - 10 * (i + 1)));
    expect(repeats).toHaveLength(REPEAT_DECLINE_THRESHOLD);
    const raised = todaysReview(input({ declines: repeats })).todos;
    expect(raised).toEqual([expect.objectContaining({ kind: "repeat-declines", unitId: "u1", count: 3 })]);
    const mixed = [...repeats.slice(0, 2), decline(D, "u1", NOW - 5, DECLINE_REASONS[1])];
    expect(todaysReview(input({ declines: mixed })).todos).toEqual([]);
  });

  it("counts an override as done only when this generation's review says reviewed", () => {
    const events = [override("o1", NOW - 10), override("o2", NOW - 20)];
    const result = todaysReview(input({ auditEvents: events, auditReviews: [review("o1"), review("o2", 1)] }));
    expect(result.todos.map((todo) => todo.kind === "override" && todo.done)).toEqual([true, false]);
    expect(overridesToReview(result.todos)).toBe(1);
  });

  it("ignores overrides from an earlier generation and shows open problems once", () => {
    const result = todaysReview(
      input({ auditEvents: [override("old", NOW - 10, 0)], generation: 1, problems: [problem] }),
    );
    expect(result.counts.override).toBe(0);
    expect(result.todos).toEqual([{ kind: "open-problems", id: "todo-open-problems", count: 1 }]);
    expect(result.events.map((event) => event.id)).toEqual(["problem-p1"]);
  });

  it("leaves out a line timed later today than now", () => {
    const later: Rejection = { id: "x2", at: NOW + 5, movementId: A!.id, attempted: "PULL_PATIENT", reason: "taken" };
    const result = todaysReview(
      input({ declines: [decline(A, "u1", NOW + 5)], auditEvents: [override("o3", NOW + 5)], rejections: [later] }),
    );
    expect(result.events).toEqual([]);
    expect(result.todos).toEqual([]);
  });

  it("goes by the latest review decision, so a later follow-up un-ticks an override", () => {
    const reviews = [review("o1"), review("o1", 0, "follow-up-required", "r-o1-later")];
    const result = todaysReview(input({ auditEvents: [override("o1", NOW - 10)], auditReviews: reviews }));
    expect(overridesToReview(result.todos)).toBe(1);
  });
});
