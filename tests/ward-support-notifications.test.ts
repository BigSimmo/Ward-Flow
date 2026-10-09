// Advisory carer, personal support person and MHAS notification checklist (9 Oct 2026, stream B).
import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { WARD_FLOW_TYPED_TEXT_EVENT_TYPES } from "@/components/ward-management/ward-flow-persistence-classification";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { buildScenarioFile } from "@/components/ward-management/ward-flow-scenario-file";
import { eventLogEntryFor } from "@/components/ward-management/ward-event-log";
import { buildHistoryEntry } from "@/components/ward-management/ward-history";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import {
  SUPPORT_NOTIFICATION_REASON_MAX_CHARACTERS,
  SUPPORT_NOTIFICATION_TASK_LOOKBACK_MINUTES,
  SUPPORT_NOTIFICATION_WHO_MAX_CHARACTERS,
  legalStatusTextIsInvoluntary,
  outstandingSupportParties,
  supportNotificationChecklist,
  supportNotificationInboxItems,
  supportNotificationSubjects,
  supportNotificationTaskId,
} from "@/components/ward-management/ward-support-notifications";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Movement } from "@/components/ward-management/ward-model";

const NOW = NOW_ANCHOR;

type NotificationEvent = Extract<WardFlowEvent, { type: "RECORD_SUPPORT_NOTIFICATION" }>;

function told(overrides: Partial<NotificationEvent> = {}): NotificationEvent {
  return {
    type: "RECORD_SUPPORT_NOTIFICATION",
    role: "ward",
    now: NOW,
    occasion: "admission",
    movementId: "WF-300",
    party: "carer",
    outcome: "told",
    who: "Synthetic carer",
    ...overrides,
  };
}

function lastRejection(state: WardFlowState): string | undefined {
  return state.rejections.at(-1)?.reason;
}

describe("which moves the checklist covers", () => {
  it("lists the seed's involuntary arrivals and its involuntary discharge, and skips voluntary moves", () => {
    const state = seedWardFlowState();
    const subjects = supportNotificationSubjects(state);
    expect(subjects.map((subject) => `${subject.occasion}:${subject.subjectId}`).sort()).toEqual([
      "admission:WF-300",
      "admission:WF-321",
      "discharge:AD-LEFT-01",
    ]);
    for (const subject of subjects.filter((entry) => entry.occasion !== "discharge")) {
      const status = state.movements.find((movement) => movement.id === subject.subjectId)?.legalStatus;
      expect(status === "Involuntary inpatient" || status === "Detained awaiting examination").toBe(true);
    }
  });

  it("calls an arrival from a ward a transfer", () => {
    const state = seedWardFlowState();
    const movements = state.movements.map((movement): Movement =>
      movement.id === "WF-300" ? { ...movement, sourceAdmissionId: "AD-ANY" } : movement,
    );
    const subject = supportNotificationSubjects({ ...state, movements }).find((entry) => entry.subjectId === "WF-300");
    expect(subject?.occasion).toBe("transfer");
  });

  it("never treats a ward-to-ward departure as a discharge", () => {
    const state = seedWardFlowState();
    expect(supportNotificationSubjects(state).some((subject) => subject.subjectId === "AD-LEFT-02")).toBe(false);
  });

  it("reads involuntary legal status the same wide way the discharge guard does", () => {
    expect(legalStatusTextIsInvoluntary("Involuntary patient (recorded)")).toBe(true);
    expect(legalStatusTextIsInvoluntary("Detained awaiting examination")).toBe(true);
    expect(legalStatusTextIsInvoluntary("Voluntary")).toBe(false);
    expect(legalStatusTextIsInvoluntary(undefined)).toBe(false);
  });
});

describe("RECORD_SUPPORT_NOTIFICATION", () => {
  it("records who was told and when, defaulting the time to now", () => {
    const next = wardFlowReducer(seedWardFlowState(), told());
    expect(next.rejections).toHaveLength(0);
    expect(next.supportNotifications).toEqual([
      {
        id: "SN-1",
        occasion: "admission",
        subjectId: "WF-300",
        party: "carer",
        outcome: "told",
        who: "Synthetic carer",
        contactedAt: NOW,
        at: NOW,
        by: "ward",
      },
    ]);
  });

  it("records not applicable with a reason, and the latest record per party is the one shown", () => {
    let state = wardFlowReducer(seedWardFlowState(), told({ party: "mhas", who: "Advocate on duty" }));
    state = wardFlowReducer(
      state,
      told({ party: "mhas", outcome: "not_applicable", who: undefined, reason: "Synthetic reason" }),
    );
    const checklist = supportNotificationChecklist(state.supportNotifications, "admission", "WF-300");
    expect(checklist.mhas).toMatchObject({ outcome: "not_applicable", reason: "Synthetic reason" });
    expect(outstandingSupportParties(checklist)).toEqual(["carer", "personal_support_person"]);
  });

  it("records a discharge against the admission", () => {
    const next = wardFlowReducer(
      seedWardFlowState(),
      told({ occasion: "discharge", movementId: undefined, admissionId: "AD-LEFT-01", contactedAt: NOW - 30 }),
    );
    expect(next.rejections).toHaveLength(0);
    expect(next.supportNotifications?.[0]).toMatchObject({ subjectId: "AD-LEFT-01", contactedAt: NOW - 30 });
  });

  it("refuses a role outside ward and coordinator", () => {
    const next = wardFlowReducer(seedWardFlowState(), told({ role: "ed" }));
    expect(next.supportNotifications).toBeUndefined();
    expect(lastRejection(next)).toMatch(/requires role ward or coordinator/);
  });

  it("refuses a voluntary or unfinished move, and the wrong occasion", () => {
    const state = seedWardFlowState();
    const voluntary = state.movements.find(
      (movement) => movement.stage === "arrived" && movement.legalStatus === "Voluntary",
    );
    expect(voluntary).toBeDefined();
    expect(lastRejection(wardFlowReducer(state, told({ movementId: voluntary!.id })))).toMatch(
      /not a completed arrival/,
    );
    expect(lastRejection(wardFlowReducer(state, told({ movementId: "WF-001" })))).toMatch(/not a completed arrival/);
    expect(lastRejection(wardFlowReducer(state, told({ occasion: "transfer" })))).toMatch(
      /is a admission, not a transfer/,
    );
    expect(
      lastRejection(
        wardFlowReducer(state, told({ occasion: "discharge", movementId: undefined, admissionId: "AD-LEFT-02" })),
      ),
    ).toMatch(/not a completed discharge/);
    expect(lastRejection(wardFlowReducer(state, told({ movementId: "WF-NOPE" })))).toMatch(/no movement found/);
    expect(lastRejection(wardFlowReducer(state, told({ admissionId: "AD-LEFT-01" })))).toMatch(/names the movement/);
  });

  it("refuses a blank or over-long name, a future time, and a reason on a told record", () => {
    const state = seedWardFlowState();
    expect(lastRejection(wardFlowReducer(state, told({ who: "   " })))).toBe("say who was told");
    expect(
      lastRejection(wardFlowReducer(state, told({ who: "x".repeat(SUPPORT_NOTIFICATION_WHO_MAX_CHARACTERS + 1) }))),
    ).toMatch(/limit is/);
    expect(
      wardFlowReducer(state, told({ who: "x".repeat(SUPPORT_NOTIFICATION_WHO_MAX_CHARACTERS) })).rejections,
    ).toHaveLength(0);
    expect(lastRejection(wardFlowReducer(state, told({ contactedAt: NOW + 1 })))).toMatch(/no later than now/);
    expect(lastRejection(wardFlowReducer(state, told({ reason: "x" })))).toMatch(/no not-applicable reason/);
  });

  it("refuses not applicable without a reason, with a name, or over the length limit", () => {
    const state = seedWardFlowState();
    const na = (overrides: Partial<NotificationEvent>) =>
      told({ outcome: "not_applicable", who: undefined, reason: "Synthetic", ...overrides });
    expect(lastRejection(wardFlowReducer(state, na({ reason: " " })))).toBe("say why it does not apply");
    expect(lastRejection(wardFlowReducer(state, na({ who: "Someone" })))).toMatch(/names nobody/);
    expect(
      lastRejection(wardFlowReducer(state, na({ reason: "x".repeat(SUPPORT_NOTIFICATION_REASON_MAX_CHARACTERS + 1) }))),
    ).toMatch(/limit is/);
  });

  it("refuses an off-list party, occasion or outcome", () => {
    const state = seedWardFlowState();
    const bad = (overrides: Record<string, unknown>) => ({ ...told(), ...overrides }) as unknown as WardFlowEvent;
    expect(lastRejection(wardFlowReducer(state, bad({ party: "gp" })))).toMatch(/party must be/);
    expect(lastRejection(wardFlowReducer(state, bad({ occasion: "leave" })))).toMatch(/occasion/);
    expect(lastRejection(wardFlowReducer(state, bad({ outcome: "maybe" })))).toMatch(/outcome must be/);
  });

  it("is a typed-text event, kept out of browser storage and scenario files", () => {
    expect(WARD_FLOW_TYPED_TEXT_EVENT_TYPES.has("RECORD_SUPPORT_NOTIFICATION")).toBe(true);
    const recorded = wardFlowReducer(seedWardFlowState(), told());
    expect(isValidStoredWardFlowState(recorded)).toBe(false);
    // An empty list changes nothing about whether a stored session is acceptable.
    const plain = { ...recorded, rejections: [] };
    delete (plain as Partial<WardFlowState>).supportNotifications;
    expect(isValidStoredWardFlowState({ ...plain, supportNotifications: [] })).toBe(isValidStoredWardFlowState(plain));
    expect(buildScenarioFile(recorded, NOW, 6, new Date(0)).ok).toBe(false);
  });

  it("reaches the event log and history linked to its movement, with no typed name copied", () => {
    const event = told();
    const entry = eventLogEntryFor(event, true);
    expect(entry).toMatchObject({ type: "RECORD_SUPPORT_NOTIFICATION", movementId: "WF-300", accepted: true });
    expect(JSON.stringify(entry)).not.toContain("Synthetic carer");
    const history = buildHistoryEntry(event, NOW);
    expect(history.summary).toBe("Carer, PSP or MHAS notification recorded");
    expect(history.relatedLinks.movementId).toBe("WF-300");
  });
});

describe("outstanding notifications as tasks", () => {
  it("lists one task per recent move with a party unrecorded, and drops it once all three are recorded", () => {
    let state = seedWardFlowState();
    const ids = supportNotificationInboxItems(state, NOW).map((item) => item.id);
    expect(ids).toContain(supportNotificationTaskId("admission", "WF-300"));
    expect(ids).toContain(supportNotificationTaskId("admission", "WF-321"));
    // The seeded discharge has no movement to open, so it stays on the discharges board only.
    expect(ids.some((id) => id.includes("AD-LEFT-01"))).toBe(false);

    for (const party of ["carer", "personal_support_person", "mhas"] as const) {
      state = wardFlowReducer(state, told({ party }));
    }
    const after = supportNotificationInboxItems(state, NOW);
    expect(after.map((item) => item.id)).not.toContain(supportNotificationTaskId("admission", "WF-300"));
    expect(after.find((item) => item.movementId === "WF-321")?.detail).toContain("Carer, PSP, MHAS not recorded");
  });

  it("looks back a set window only, as a display default", () => {
    const state = seedWardFlowState();
    const later = NOW + SUPPORT_NOTIFICATION_TASK_LOOKBACK_MINUTES + 60;
    expect(supportNotificationInboxItems(state, later)).toEqual([]);
  });

  it("joins the action inbox when the caller hands it the records, and the ids acknowledge", () => {
    const state = seedWardFlowState();
    const withRecords = buildActionInbox(state.movements.filter(isOpen), NOW, state.units, state);
    expect(withRecords.some((item) => item.id === supportNotificationTaskId("admission", "WF-300"))).toBe(true);
    expect(
      buildActionInbox(state.movements.filter(isOpen), NOW, state.units).some((item) => item.id.startsWith("notify-")),
    ).toBe(false);
    const acked = wardFlowReducer(state, {
      type: "ACKNOWLEDGE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId: supportNotificationTaskId("admission", "WF-300"),
    });
    expect(acked.rejections).toHaveLength(0);
  });
});
