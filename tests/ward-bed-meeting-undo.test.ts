// H-0150 (26 Oct 2026): a bed meeting action marked done by mistake comes back from its toast's
// Undo, exactly, under the same rules as every step undo. Synthetic seed data only.
import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { stepUndoFor, undoStepSubjectId } from "@/components/ward-management/ward-undo";

const NOW = NOW_ANCHOR;
const run = (state: WardFlowState, ...events: WardFlowEvent[]) => events.reduce(wardFlowReducer, state);

function withTwoOpenActions() {
  const seeded = seedWardFlowState();
  const movement = seeded.movements.find((candidate) => !candidate.closure && candidate.stage !== "arrived")!;
  const subject = { kind: "movement" as const, id: movement.id };
  const recordAction = (action: "book_transport" | "chase_ndis"): WardFlowEvent => ({
    type: "RECORD_BED_MEETING_ACTION",
    role: "coordinator",
    now: NOW,
    subject,
    action,
    owner: "coordinator",
    dueAt: NOW + 120,
  });
  const state = run(seeded, recordAction("book_transport"), recordAction("chase_ndis"));
  expect(state.rejections).toEqual([]);
  return { state, subject, movementId: movement.id };
}

describe("UNDO_BED_MEETING_ACTION", () => {
  it("reopens the action marked done, exactly, and refuses a second Undo", () => {
    const { state, subject, movementId } = withTwoOpenActions();
    const done = wardFlowReducer(state, {
      type: "COMPLETE_BED_MEETING_ACTION",
      role: "coordinator",
      now: NOW + 30,
      subject,
      action: "book_transport",
    });
    expect(done.rejections).toEqual([]);
    const undo: WardFlowEvent = {
      type: "UNDO_BED_MEETING_ACTION",
      role: "coordinator",
      now: NOW + 31,
      subject,
      action: "book_transport",
    };
    const undone = wardFlowReducer(done, undo);
    expect(undone.rejections).toEqual([]);
    const actions = (s: WardFlowState) => s.movements.find((candidate) => candidate.id === movementId)!.meetingActions;
    expect(actions(undone)).toEqual(actions(state));
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify({ ...undone, rejections: [] })))).toBe(true);
    expect(undone.auditEvents.at(-1)).toMatchObject({
      action: "UNDO_BED_MEETING_ACTION",
      outcome: "accepted",
      subject: { kind: "movement", movementId },
    });
    expect(wardFlowReducer(undone, { ...undo, now: NOW + 32 }).rejections.at(-1)?.reason).toBe(
      "There is no bed meeting action marked done here to undo",
    );
  });

  it("keeps an Undo for each action kind on one person, and refuses a stale toast's record number", () => {
    const { state, subject } = withTwoOpenActions();
    const complete = (action: "book_transport" | "chase_ndis", now: number): WardFlowEvent => ({
      type: "COMPLETE_BED_MEETING_ACTION",
      role: "coordinator",
      now,
      subject,
      action,
    });
    const both = run(state, complete("book_transport", NOW + 30), complete("chase_ndis", NOW + 31));
    const recordFor = (action: string) =>
      stepUndoFor(both.undoRecords, "UNDO_BED_MEETING_ACTION", undoStepSubjectId({ subject, action }));
    const transport = recordFor("book_transport");
    expect(transport).toBeDefined();
    expect(recordFor("chase_ndis")).toBeDefined();
    const stale = wardFlowReducer(both, {
      type: "UNDO_BED_MEETING_ACTION",
      role: "coordinator",
      now: NOW + 32,
      subject,
      action: "book_transport",
      recordSeq: (transport?.seq ?? 0) + 1000,
    });
    expect(stale.rejections.at(-1)?.reason).toBe("A later step replaced this one, so this Undo no longer applies");
    // The newer completion changed the same record, so the older one is refused rather than
    // undone over it; the newer one still undoes.
    const older = wardFlowReducer(both, {
      type: "UNDO_BED_MEETING_ACTION",
      role: "coordinator",
      now: NOW + 32,
      subject,
      action: "book_transport",
      recordSeq: transport?.seq,
    });
    expect(older.rejections.at(-1)?.reason).toBe("This has changed since, so it cannot be undone");
    const newer = wardFlowReducer(both, {
      type: "UNDO_BED_MEETING_ACTION",
      role: "coordinator",
      now: NOW + 32,
      subject,
      action: "chase_ndis",
      recordSeq: recordFor("chase_ndis")?.seq,
    });
    expect(newer.rejections).toEqual([]);
  });
});
