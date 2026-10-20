import { describe, expect, it } from "vitest";

import {
  BED_MEETING_AGENDA_HREF,
  meetingActionInboxId,
  type BedMeetingSubject,
} from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import {
  activeActNowItems,
  inboxItemsForRole,
  taskItems,
  type TaskSource,
} from "@/components/ward-management/ward-act-now-items";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Overall review (20 Oct 2026): actions agreed at the bed meeting reach the owner's Needs you. */
const NOW = NOW_ANCHOR;

function setup() {
  const state = seedWardFlowState();
  const movement = state.movements.find((candidate) => !candidate.closure && candidate.stage !== "arrived")!;
  const admission = state.admissions.find((candidate) => candidate.state === "occupied")!;
  return { state, movement, admission };
}

function apply(state: WardFlowState, event: WardFlowEvent): WardFlowState {
  const next = wardFlowReducer(state, event);
  expect(next.rejections.slice(state.rejections.length)).toEqual([]);
  return next;
}

function record(
  state: WardFlowState,
  subject: BedMeetingSubject,
  owner: "coordinator" | "ward" | "ed" | "community",
  extra: { unitId?: string; dueAt?: number; action?: "book_transport" | "chase_ndis" } = {},
) {
  return apply(state, {
    type: "RECORD_BED_MEETING_ACTION",
    role: "coordinator",
    now: NOW,
    subject,
    action: extra.action ?? "book_transport",
    owner,
    ...(extra.unitId !== undefined ? { unitId: extra.unitId } : {}),
    dueAt: extra.dueAt ?? NOW + 120,
  });
}

const source = (state: WardFlowState): TaskSource => ({
  movements: state.movements,
  units: state.units,
  configuration: state.configuration,
  inboxSnoozes: state.inboxSnoozes,
  admissions: state.admissions,
  patients: state.patients,
  referrals: state.referrals,
  leaveBeds: state.leaveBeds,
});

const meetingRows = (state: WardFlowState, now = NOW) =>
  taskItems(source(state), now).filter((item) => item.id.startsWith("meeting-action-"));

describe("bed meeting actions in Needs you", () => {
  it("puts the chair's own action in the coordinator's list, opening the agenda, and nobody else's", () => {
    const { state, movement } = setup();
    expect(meetingRows(state)).toEqual([]);
    const subject = { kind: "movement" as const, id: movement.id };
    const recorded = record(state, subject, "coordinator");
    const [row] = meetingRows(recorded);
    expect(row).toMatchObject({
      id: meetingActionInboxId(subject, "book_transport"),
      tone: "warning",
      kind: "fact",
      title: "Bed meeting action: Book transport",
      owner: "Bed coordinator",
      movementId: movement.id,
      href: BED_MEETING_AGENDA_HREF,
      dueAt: NOW + 120,
      since: NOW,
    });
    expect(inboxItemsForRole([row!], "coordinator")).toHaveLength(1);
    expect(inboxItemsForRole([row!], "ed")).toEqual([]);
    expect(inboxItemsForRole([row!], "ward")).toEqual([]);
  });

  it("gives the ED's action to the ED and a ward's action to that ward, by name", () => {
    const { state, movement, admission } = setup();
    const ward = state.units.find((unit) => unit.id === admission.unitId)!;
    let next = record(state, { kind: "movement", id: movement.id }, "ed");
    next = record(next, { kind: "admission", id: admission.id }, "ward", { unitId: ward.id, action: "chase_ndis" });
    const rows = meetingRows(next);
    const ed = rows.find((row) => row.owner === "ED team")!;
    expect(inboxItemsForRole([ed], "ed")).toHaveLength(1);
    expect(ed.href).toMatch(/^\/ward-flow\/movements\//);

    const wardRow = rows.find((row) => row.owner === ward.name)!;
    expect(wardRow.title).toBe("Bed meeting action: Chase NDIS");
    expect(wardRow.movementId).toBe("");
    expect(inboxItemsForRole([wardRow], "ward", [ward.name])).toHaveLength(1);
    expect(inboxItemsForRole([wardRow], "ed")).toEqual([]);
  });

  it("says an overdue action is overdue but never makes it an act-now alert", () => {
    const { state, movement } = setup();
    const recorded = record(state, { kind: "movement", id: movement.id }, "coordinator", { dueAt: NOW + 30 });
    const later = NOW + 90;
    const [row] = meetingRows(recorded, later);
    expect(row!.tone).toBe("warning");
    expect(row!.detail).toMatch(/^Agreed at the bed meeting\. Was due /);
    expect(activeActNowItems(source(recorded), later).some((item) => item.id === row!.id)).toBe(false);
  });

  it("leaves when the action is marked done, and takes a snooze while it is open", () => {
    const { state, movement } = setup();
    const subject = { kind: "movement" as const, id: movement.id };
    const recorded = record(state, subject, "coordinator");
    const id = meetingActionInboxId(subject, "book_transport");

    const taken = apply(recorded, {
      type: "TAKE_INBOX_ITEM_OWNERSHIP",
      role: "coordinator",
      now: NOW,
      inboxItemId: id,
    });
    expect(taken.inboxOwnership[id]).toHaveLength(1);
    apply(taken, {
      type: "SNOOZE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId: id,
      until: NOW + 60,
      reason: "awaiting_call_back",
    });

    const done = apply(recorded, {
      type: "COMPLETE_BED_MEETING_ACTION",
      role: "coordinator",
      now: NOW + 10,
      subject,
      action: "book_transport",
    });
    expect(meetingRows(done)).toEqual([]);
    const refused = wardFlowReducer(done, {
      type: "TAKE_INBOX_ITEM_OWNERSHIP",
      role: "coordinator",
      now: NOW + 11,
      inboxItemId: id,
    });
    expect(refused.rejections).toHaveLength(done.rejections.length + 1);
  });
});
