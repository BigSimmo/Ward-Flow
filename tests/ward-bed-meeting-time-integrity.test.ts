import { describe, expect, it } from "vitest";
import type { BedMeetingSubject } from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function fixture(kind: BedMeetingSubject["kind"]) {
  const state = seedWardFlowState();
  const id =
    kind === "movement"
      ? state.movements.find((movement) => !movement.closure && movement.stage !== "arrived")!.id
      : state.admissions.find((admission) => admission.state === "occupied")!.id;
  return { state, subject: { kind, id } };
}

function record(subject: BedMeetingSubject, dueAt: unknown, now = NOW_ANCHOR): WardFlowEvent {
  return {
    type: "RECORD_BED_MEETING_ACTION",
    role: "coordinator",
    now,
    subject,
    action: "book_transport",
    owner: "coordinator",
    dueAt: dueAt as number,
  };
}

function expectSafeRefusal(before: WardFlowState, next: WardFlowState) {
  expect(next.rejections).toHaveLength(before.rejections.length + 1);
  expect(next.movements).toBe(before.movements);
  expect(next.admissions).toBe(before.admissions);
  // Device copies exclude refusals. An unsuccessful edit must not poison that saved world.
  expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify({ ...next, rejections: [] })))).toBe(true);
}

describe.each(["movement", "admission"] as const)("bed-meeting times on a %s", (kind) => {
  it.each([NaN, Infinity, -Infinity, "1000", null, undefined, [1000], {}])(
    "refuses malformed due time %j without changing the record or its reloadability",
    (dueAt) => {
      const { state, subject } = fixture(kind);
      expectSafeRefusal(state, wardFlowReducer(state, record(subject, dueAt)));
    },
  );

  it.each([NaN, Infinity, -Infinity])("refuses a nonfinite recording time %s", (now) => {
    const { state, subject } = fixture(kind);
    expectSafeRefusal(state, wardFlowReducer(state, record(subject, NOW_ANCHOR + 120, now)));
  });

  it.each([NaN, Infinity, -Infinity])("refuses a nonfinite completion time %s", (now) => {
    const { state, subject } = fixture(kind);
    const recorded = wardFlowReducer(state, record(subject, NOW_ANCHOR + 120));
    expectSafeRefusal(
      recorded,
      wardFlowReducer(recorded, {
        type: "COMPLETE_BED_MEETING_ACTION",
        role: "coordinator",
        now,
        subject,
        action: "book_transport",
      }),
    );
  });

  it("preserves finite fractional times through recording, completion and JSON reload", () => {
    const { state, subject } = fixture(kind);
    const recorded = wardFlowReducer(state, record(subject, NOW_ANCHOR + 120.5, NOW_ANCHOR + 0.25));
    expect(recorded.rejections).toEqual(state.rejections);
    const done = wardFlowReducer(recorded, {
      type: "COMPLETE_BED_MEETING_ACTION",
      role: "coordinator",
      now: NOW_ANCHOR + 1.75,
      subject,
      action: "book_transport",
    });
    expect(done.rejections).toEqual(state.rejections);
    const collection = kind === "movement" ? done.movements : done.admissions;
    expect(collection.find((item) => item.id === subject.id)?.meetingActions?.at(-1)).toMatchObject({
      dueAt: NOW_ANCHOR + 120.5,
      recordedAt: NOW_ANCHOR + 0.25,
      doneAt: NOW_ANCHOR + 1.75,
    });
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify({ ...done, rejections: [] })))).toBe(true);
  });
});
