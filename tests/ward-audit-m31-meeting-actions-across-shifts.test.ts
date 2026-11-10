import { describe, expect, it } from "vitest";

import {
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
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Master audit M31 (10 Nov 2026): bed meeting actions belong to a desk, not a person. An overdue
 * action, one whose ward closes or is renamed, a cover account and two desks marking it done at
 * once all leave a visible owner and one outcome. The database race for two desks is in
 * `backend/ward-flow/audit-m31-meeting-action-done-race.test.mjs`; this file holds the shift
 * boundary and the reducer's half of the double Mark done. Synthetic seed records only.
 */
const NOW = NOW_ANCHOR; // 10:42 on day 0
const DAY = 24 * 60;
const at = (hour: number, minute = 0, day = 0) => day * DAY + hour * 60 + minute;

function setup() {
  const state = seedWardFlowState();
  const admission = state.admissions.find((candidate) => candidate.state === "occupied")!;
  return { state, admission, ward: state.units.find((unit) => unit.id === admission.unitId)! };
}

function apply(state: WardFlowState, event: WardFlowEvent): WardFlowState {
  const next = wardFlowReducer(state, event);
  expect(next.rejections.slice(state.rejections.length)).toEqual([]);
  return next;
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

const rowFor = (state: WardFlowState, subject: BedMeetingSubject, now: number) =>
  taskItems(source(state), now).find((item) => item.id === meetingActionInboxId(subject, "chase_ndis"));

/** A ward-owned action agreed at the 14:00 meeting, due 14:30, so it is overdue at the 15:00 handover. */
function wardAction() {
  const { state, admission, ward } = setup();
  const subject: BedMeetingSubject = { kind: "admission", id: admission.id };
  const recorded = apply(state, {
    type: "RECORD_BED_MEETING_ACTION",
    role: "coordinator",
    now: NOW,
    subject,
    action: "chase_ndis",
    owner: "ward",
    unitId: ward.id,
    dueAt: at(14, 30),
  });
  return { recorded, subject, ward };
}

describe("M31: an open meeting action keeps its desk owner across shift boundaries", () => {
  it("is still listed for the same ward desk, overdue and amber, at every later handover", () => {
    const { recorded, subject, ward } = wardAction();
    // Day to evening (15:00), evening to night (23:00), night to day (07:00 next day), and a day later.
    for (const now of [at(14, 59), at(15, 1), at(23, 1), at(7, 1, 1), at(15, 1, 1)]) {
      const row = rowFor(recorded, subject, now);
      expect(row, `listed at minute ${now}`).toBeDefined();
      expect(row!.owner).toBe(ward.name);
      expect(row!.tone).toBe("warning");
      expect(row!.detail).toMatch(now > at(14, 30) ? /^Agreed at the bed meeting\. Was due / : /Due /);
      // The desk, not a person: the ward desk sees it on every shift, and nobody else's list.
      expect(inboxItemsForRole([row!], "ward", [ward.name])).toHaveLength(1);
      expect(inboxItemsForRole([row!], "ed")).toEqual([]);
      // Overdue is said, never escalated into act now.
      expect(activeActNowItems(source(recorded), now).some((item) => item.id === row!.id)).toBe(false);
    }
  });

  it("keeps its owner when the owning ward closes to admissions", () => {
    const { recorded, subject, ward } = wardAction();
    const closed = apply(recorded, {
      type: "CLOSE_WARD_TO_ADMISSIONS",
      role: "coordinator",
      now: NOW + 5,
      unitId: ward.id,
      reason: "staffing",
    });
    const row = rowFor(closed, subject, at(15, 1));
    expect(row?.owner).toBe(ward.name);
    expect(inboxItemsForRole([row!], "ward", [ward.name])).toHaveLength(1);
  });

  it("follows the ward by id when it is renamed, and falls back to the coordinator when the ward is gone", () => {
    const { recorded, subject, ward } = wardAction();
    const renamedName = `${ward.name} (renamed)`;
    const renamed: WardFlowState = {
      ...recorded,
      units: recorded.units.map((unit) => (unit.id === ward.id ? { ...unit, name: renamedName } : unit)),
    };
    const row = rowFor(renamed, subject, at(15, 1));
    expect(row?.owner).toBe(renamedName);
    expect(inboxItemsForRole([row!], "ward", [renamedName])).toHaveLength(1);

    // A ward no longer in the list still leaves a visible owner: the coordinator, never nobody.
    const gone: WardFlowState = { ...recorded, units: recorded.units.filter((unit) => unit.id !== ward.id) };
    const orphan = rowFor(gone, subject, at(15, 1));
    expect(orphan).toBeDefined();
    expect(orphan!.owner).toBe("Ward");
    expect(inboxItemsForRole([orphan!], "coordinator")).toHaveLength(1);
  });

  it("records a desk, never a person, when a cover account for the ward marks it done", () => {
    const { recorded, subject, ward } = wardAction();
    // A cover account works as the covered ward's desk, so it acts for that ward.
    const done = apply(recorded, {
      type: "COMPLETE_BED_MEETING_ACTION",
      role: "ward",
      now: at(15, 10),
      subject,
      action: "chase_ndis",
      actingUnitId: ward.id,
    });
    const action = done.admissions.find((row) => row.id === subject.id)!.meetingActions![0]!;
    expect(action.doneAt).toBe(at(15, 10));
    // The ward desk's role label ("Nurse in charge"), never an account or a person's name.
    expect(action.doneBy).toBe(WARD_FLOW_ROLE_LABELS.ward);
    expect(rowFor(done, subject, at(15, 11))).toBeUndefined();
  });

  it("leaves one outcome when two desks mark it done one after the other", () => {
    const { recorded, subject, ward } = wardAction();
    const byWard: WardFlowEvent = {
      type: "COMPLETE_BED_MEETING_ACTION",
      role: "ward",
      now: at(15, 2),
      subject,
      action: "chase_ndis",
      actingUnitId: ward.id,
    };
    const byChair: WardFlowEvent = {
      type: "COMPLETE_BED_MEETING_ACTION",
      role: "coordinator",
      now: at(15, 2),
      subject,
      action: "chase_ndis",
    };
    for (const [first, second] of [
      [byWard, byChair],
      [byChair, byWard],
    ] as const) {
      const once = apply(recorded, first);
      const twice = wardFlowReducer(once, second);
      expect(twice.rejections.slice(once.rejections.length)).toHaveLength(1);
      const actions = twice.admissions.find((row) => row.id === subject.id)!.meetingActions!;
      expect(actions).toHaveLength(1);
      expect(actions[0]!.doneBy).toBe(WARD_FLOW_ROLE_LABELS[first.role]);
    }
  });
});
