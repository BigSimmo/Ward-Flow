import { describe, expect, it } from "vitest";

import { bedMeetingAgenda, meetingActionSummary } from "@/components/ward-management/bed-meeting/bed-meeting-agenda";
import type { BedMeetingSubject } from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { selectPatientHistory } from "@/components/ward-management/ward-history";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveWardScreenTitle } from "@/components/ward-management/ward-nav";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function setup() {
  const state = seedWardFlowState();
  const movement = state.movements.find((candidate) => !candidate.closure && candidate.stage !== "arrived")!;
  const admission = state.admissions.find((candidate) => candidate.state === "occupied")!;
  return { state, movement, admission };
}

const record = (
  state: WardFlowState,
  subject: BedMeetingSubject,
  extra: Partial<{ owner: string; unitId: string; dueAt: number; action: string; role: string }> = {},
) =>
  wardFlowReducer(state, {
    type: "RECORD_BED_MEETING_ACTION",
    role: (extra.role ?? "coordinator") as "coordinator",
    now: NOW,
    subject,
    action: (extra.action ?? "book_transport") as "book_transport",
    owner: (extra.owner ?? "coordinator") as "coordinator",
    ...(extra.unitId !== undefined ? { unitId: extra.unitId } : {}),
    dueAt: extra.dueAt ?? NOW + 120,
  });

describe("RECORD_BED_MEETING_ACTION and COMPLETE_BED_MEETING_ACTION", () => {
  it("keeps the action on the bed request, changes nothing else, and marks it done", () => {
    const { state, movement } = setup();
    const subject = { kind: "movement" as const, id: movement.id };
    const recorded = record(state, subject);
    expect(recorded.rejections).toEqual([]);
    const after = recorded.movements.find((candidate) => candidate.id === movement.id)!;
    expect(after.meetingActions).toEqual([
      { kind: "book_transport", owner: "coordinator", dueAt: NOW + 120, recordedAt: NOW },
    ]);
    expect({ ...after, meetingActions: undefined }).toEqual({ ...movement, meetingActions: undefined });

    // One open action of a kind per person.
    expect(record(recorded, subject).rejections).toHaveLength(1);

    const done = wardFlowReducer(recorded, {
      type: "COMPLETE_BED_MEETING_ACTION",
      role: "coordinator",
      now: NOW + 30,
      subject,
      action: "book_transport",
    });
    expect(done.rejections).toEqual([]);
    expect(done.movements.find((candidate) => candidate.id === movement.id)!.meetingActions![0]).toMatchObject({
      doneAt: NOW + 30,
      doneBy: "Bed coordinator",
    });
    expect(
      wardFlowReducer(done, {
        type: "COMPLETE_BED_MEETING_ACTION",
        role: "coordinator",
        now: NOW + 31,
        subject,
        action: "book_transport",
      }).rejections,
    ).toHaveLength(1);
  });

  it("lets a ward complete only its own action, and refuses off-list, past-due and unknown records", () => {
    const { state, admission } = setup();
    const subject = { kind: "admission" as const, id: admission.id };
    const recorded = record(state, subject, { action: "chase_ndis", owner: "ward", unitId: admission.unitId });
    expect(recorded.rejections).toEqual([]);
    const complete = (actingUnitId: string) =>
      wardFlowReducer(recorded, {
        type: "COMPLETE_BED_MEETING_ACTION",
        role: "ward",
        now: NOW + 10,
        subject,
        action: "chase_ndis",
        actingUnitId,
      });
    expect(complete("some-other-ward").rejections).toHaveLength(1);
    expect(complete(admission.unitId).rejections).toEqual([]);

    expect(record(state, subject, { action: "typed words" }).rejections).toHaveLength(1);
    expect(record(state, subject, { dueAt: NOW }).rejections).toHaveLength(1);
    expect(record(state, subject, { owner: "ward" }).rejections).toHaveLength(1);
    expect(record(state, { kind: "movement", id: "no-such-request" }).rejections).toHaveLength(1);
    expect(record(state, subject, { role: "ward" }).rejections).toHaveLength(1);
  });
});

describe("a saved bed meeting action", () => {
  type Row = Record<string, unknown>;
  const saved = (action: Row) => {
    const { state, movement } = setup();
    // A saved state is plain JSON, so it is edited as JSON.
    const stored = JSON.parse(JSON.stringify(state)) as { movements: Row[] };
    stored.movements = stored.movements.map((row) =>
      row.id === movement.id ? { ...row, meetingActions: [action] } : row,
    );
    return stored;
  };
  const base = { kind: "book_transport", owner: "coordinator", dueAt: NOW + 120, recordedAt: NOW };

  it("restores an action chosen from the fixed lists, open or done", () => {
    const { state } = setup();
    expect(isValidStoredWardFlowState(saved(base))).toBe(true);
    expect(isValidStoredWardFlowState(saved({ ...base, doneAt: NOW + 60, doneBy: "Coordinator" }))).toBe(true);
    expect(isValidStoredWardFlowState(saved({ ...base, owner: "ward", ownerUnitId: state.units[0]!.id }))).toBe(true);
  });

  it("refuses typed text, a ward owner with no ward, and a half-recorded completion", () => {
    expect(isValidStoredWardFlowState(saved({ ...base, note: "typed" }))).toBe(false);
    expect(isValidStoredWardFlowState(saved({ ...base, owner: "ward" }))).toBe(false);
    expect(isValidStoredWardFlowState(saved({ ...base, ownerUnitId: "some-ward" }))).toBe(false);
    expect(isValidStoredWardFlowState(saved({ ...base, doneAt: NOW + 60 }))).toBe(false);
    expect(isValidStoredWardFlowState(saved({ ...base, doneBy: "Coordinator" }))).toBe(false);
  });
});

describe("bed meeting actions in the record's history", () => {
  it("lists a recorded and a completed action under the bed request they name", () => {
    const { movement } = setup();
    const subject = { kind: "movement" as const, id: movement.id };
    const events: WardFlowEvent[] = [
      {
        type: "RECORD_BED_MEETING_ACTION",
        role: "coordinator",
        now: NOW,
        subject,
        action: "book_transport",
        owner: "coordinator",
        dueAt: NOW + 120,
      },
      { type: "COMPLETE_BED_MEETING_ACTION", role: "coordinator", now: NOW + 30, subject, action: "book_transport" },
    ];
    const history = selectPatientHistory(events, movement.id, NOW + 60);
    expect(history.map((entry) => entry.summary)).toEqual([
      expect.any(String),
      expect.stringContaining("Bed meeting action recorded"),
      expect.stringContaining("Bed meeting action done"),
    ]);
    expect(selectPatientHistory(events, "someone-else", NOW + 60)).toHaveLength(1);
  });
});

describe("bed meeting agenda and action summary", () => {
  it("builds its sections from fixed rules over the seed", () => {
    const { state } = setup();
    const sections = bedMeetingAgenda(state, NOW);
    expect(sections.map((section) => section.id)).toEqual(["ed-waits", "holds", "stranded", "out-of-area"]);
    const waits = sections[0]!.items;
    expect(waits.length).toBeGreaterThan(0);
    expect(waits.length).toBeLessThanOrEqual(5);
    const opened = waits.map((item) => state.movements.find((movement) => movement.id === item.subject.id)!.openedAt);
    expect(opened).toEqual([...opened].sort((a, b) => a - b));
  });

  it("counts done, overdue and open actions without escalating anything", () => {
    const { state, movement, admission } = setup();
    let next = record(state, { kind: "movement", id: movement.id }, { dueAt: NOW + 60 });
    next = record(next, { kind: "admission", id: admission.id }, { action: "chase_ndis", dueAt: NOW + 240 });
    next = wardFlowReducer(next, {
      type: "COMPLETE_BED_MEETING_ACTION",
      role: "coordinator",
      now: NOW + 10,
      subject: { kind: "admission", id: admission.id },
      action: "chase_ndis",
    });
    next = record(next, { kind: "admission", id: admission.id }, { action: "review_step_down", dueAt: NOW + 480 });
    const summary = meetingActionSummary(next.movements, next.admissions, NOW + 120);
    expect(summary.doneLastDay).toBe(1);
    expect(summary.overdue.map((row) => row.action.kind)).toEqual(["book_transport"]);
    expect(summary.open.map((row) => row.action.kind)).toEqual(["review_step_down"]);
  });
});

describe("bed meeting agenda title", () => {
  it("names the agenda in the shell, not Home", () => {
    expect(resolveWardScreenTitle("/ward-flow/bed-meeting/agenda")).toBe("Bed meeting agenda");
  });
});
