import { describe, expect, it } from "vitest";
import {
  meetingActionInboxId,
  type BedMeetingSubject,
} from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { commandScopeRefusal, scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { currentInboxOwner, partitionSnoozed } from "@/components/ward-management/ward-inbox-snooze";
import { STATEWIDE_COORDINATOR, type WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;
const action = "book_transport" as const;
function apply(state: WardFlowState, event: WardFlowEvent) {
  const next = wardFlowReducer(state, event);
  expect(next.rejections.slice(state.rejections.length)).toEqual([]);
  return next;
}
function record(
  state: WardFlowState,
  subject: BedMeetingSubject,
  owner: "coordinator" | "ed" = "coordinator",
  now = NOW,
) {
  return apply(state, {
    type: "RECORD_BED_MEETING_ACTION",
    role: "coordinator",
    now,
    subject,
    action,
    owner,
    dueAt: now + 120,
  });
}
function review(state: WardFlowState, subject: BedMeetingSubject) {
  const inboxItemId = meetingActionInboxId(subject, action);
  const events: WardFlowEvent[] = [
    { type: "ACKNOWLEDGE_INBOX_ITEM", role: "coordinator", now: NOW, inboxItemId },
    { type: "TAKE_INBOX_ITEM_OWNERSHIP", role: "coordinator", now: NOW, inboxItemId },
    {
      type: "SNOOZE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId,
      until: NOW + 60,
      reason: "awaiting_call_back",
    },
  ];
  return { state: events.reduce(apply, state), events, inboxItemId };
}

describe("WF-FIG-010 meeting metadata in service snapshots", () => {
  for (const kind of ["movement", "admission"] as const) {
    it(`keeps authorised ${kind} metadata and excludes foreign and malformed subjects`, () => {
      const initial = seedWardFlowState();
      const access: WardAccess = { role: "coordinator", scope: { kind: "service", service: "East Metro" } };
      const options = { now: NOW, places: wardPlaceLookup(initial.units) };
      const visible = scopeWardFlowState(initial, access, options).state;
      const collection = kind === "movement" ? "movements" : "admissions";
      const own = visible[collection][0]!;
      expect(own).toBeDefined();
      const foreign = initial[collection].find((item) => !visible[collection].some((seen) => seen.id === item.id))!;
      expect(foreign).toBeDefined();
      const subject = { kind, id: own.id };
      const foreignSubject = { kind, id: foreign.id };
      let full = record(record(initial, subject), foreignSubject);
      const reviewed = review(full, subject);
      full = review(reviewed.state, foreignSubject).state;
      for (const event of reviewed.events) expect(commandScopeRefusal(full, access, event, options)).toBeNull();
      const malformed = "meeting-action-not_a_kind-movement-" + own.id;
      full = { ...full, inboxSnoozes: { ...full.inboxSnoozes, [malformed]: full.inboxSnoozes[reviewed.inboxItemId]! } };
      const projected = scopeWardFlowState(full, access, options).state;
      const foreignId = meetingActionInboxId(foreignSubject, action);
      for (const key of ["inboxAcknowledgements", "inboxSnoozes", "inboxOwnership"] as const) {
        expect(projected[key][reviewed.inboxItemId]).toEqual(full[key][reviewed.inboxItemId]);
        expect(projected[key][foreignId]).toBeUndefined();
        expect(projected[key][malformed]).toBeUndefined();
      }
      expect(partitionSnoozed([{ id: reviewed.inboxItemId, since: NOW }], projected.inboxSnoozes, NOW)).toEqual({
        active: [],
        snoozed: [{ id: reviewed.inboxItemId, since: NOW }],
      });
      expect(scopeWardFlowState(full, STATEWIDE_COORDINATOR, options).state).toBe(full);
    });
  }
});

describe("WF-FIG-011 meeting occurrences sharing a minute", () => {
  for (const kind of ["movement", "admission"] as const) {
    for (const delay of [0, 1]) {
      it(`retires the old ${kind} snooze and taken owner for a new occurrence after ${delay} minutes`, () => {
        const initial = seedWardFlowState();
        const id = (kind === "movement" ? initial.movements : initial.admissions)[0]!.id;
        const subject = { kind, id };
        const reviewed = review(record(initial, subject), subject);
        const done = apply(reviewed.state, {
          type: "COMPLETE_BED_MEETING_ACTION",
          role: "coordinator",
          now: NOW,
          subject,
          action,
        });
        const undone = apply(done, { type: "UNDO_BED_MEETING_ACTION", role: "coordinator", now: NOW, subject, action });
        expect(undone.inboxSnoozes).toEqual(reviewed.state.inboxSnoozes);
        expect(undone.inboxOwnership).toEqual(reviewed.state.inboxOwnership);
        const replacement = record(done, subject, "ed", NOW + delay);
        const row = { id: reviewed.inboxItemId, since: NOW + delay };
        expect(partitionSnoozed([row], replacement.inboxSnoozes, NOW + delay)).toEqual({ active: [row], snoozed: [] });
        expect(currentInboxOwner(replacement.inboxOwnership[row.id], row.since)).toBeUndefined();
        expect(replacement.inboxSnoozes[row.id]!.slice(0, -1)).toEqual(reviewed.state.inboxSnoozes[row.id]);
        expect(replacement.inboxOwnership[row.id]!.slice(0, -1)).toEqual(reviewed.state.inboxOwnership[row.id]);
        expect(reviewed.state.inboxSnoozes[row.id]!.at(-1)!.kind).toBe("snoozed");
        const refused = wardFlowReducer(replacement, {
          type: "RECORD_BED_MEETING_ACTION",
          role: "coordinator",
          now: NOW + delay,
          subject,
          action,
          owner: "ed",
          dueAt: NOW + 120,
        });
        expect(refused.rejections).toHaveLength(1);
        expect(refused.inboxSnoozes).toEqual(replacement.inboxSnoozes);
        expect(refused.inboxOwnership).toEqual(replacement.inboxOwnership);
      });
    }
  }
});
