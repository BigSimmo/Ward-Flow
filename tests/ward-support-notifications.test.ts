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
import type { Movement, Referral } from "@/components/ward-management/ward-model";

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

/**
 * WF-300 as an involuntary inpatient, whatever the seed says, so the arrival cases keep their
 * subject if the seed's statuses change.
 */
function involuntarySeed(): WardFlowState {
  const state = seedWardFlowState();
  return {
    ...state,
    movements: state.movements.map((movement): Movement =>
      movement.id === "WF-300" ? { ...movement, legalStatus: "Involuntary inpatient" } : movement,
    ),
  };
}

/** WF-321 as an arrival referred for examination rather than an involuntary inpatient. */
function referredSeed(): WardFlowState {
  const state = seedWardFlowState();
  return {
    ...state,
    movements: state.movements.map((movement): Movement =>
      movement.id === "WF-321" ? { ...movement, legalStatus: "Referred for psychiatric examination" } : movement,
    ),
  };
}

function lastRejection(state: WardFlowState): string | undefined {
  return state.rejections.at(-1)?.reason;
}

describe("which moves the checklist covers", () => {
  it("covers involuntary arrivals and discharges only, not a referral for examination", () => {
    const seed = seedWardFlowState();
    expect(
      supportNotificationSubjects(seed)
        .map((subject) => `${subject.occasion}:${subject.subjectId}`)
        .sort(),
    ).toEqual(["admission:WF-300", "admission:WF-321", "discharge:AD-LEFT-01"]);
    for (const subject of supportNotificationSubjects(seed).filter((entry) => entry.occasion !== "discharge")) {
      expect(seed.movements.find((movement) => movement.id === subject.subjectId)?.legalStatus).toBe(
        "Involuntary inpatient",
      );
    }
    // The same arrival referred for examination is not covered: that status is not involuntary.
    const referred = referredSeed();
    expect(supportNotificationSubjects(referred).some((subject) => subject.subjectId === "WF-321")).toBe(false);
  });

  it("calls an arrival from a ward a transfer", () => {
    const state = involuntarySeed();
    const movements = state.movements.map((movement): Movement =>
      movement.id === "WF-300" ? { ...movement, sourceAdmissionId: "AD-ANY" } : movement,
    );
    const subject = supportNotificationSubjects({ ...state, movements }).find((entry) => entry.subjectId === "WF-300");
    expect(subject?.occasion).toBe("transfer");
  });

  it("calls a psychiatric-ward referral's arrival a transfer when it names the sending ward", () => {
    const state = involuntarySeed();
    const transferReferral = {
      ...state.referrals[0]!,
      id: "RF-TRANSFER-TEST",
      source: "psychiatric_ward" as const,
      originUnitId: state.units[0]!.id,
    };
    const movements = state.movements.map((movement): Movement =>
      movement.id === "WF-300"
        ? { ...movement, referralId: transferReferral.id, sourceAdmissionId: undefined }
        : movement,
    );
    const occasionWith = (referral: Referral) =>
      supportNotificationSubjects({ ...state, movements, referrals: [...state.referrals, referral] }).find(
        (entry) => entry.subjectId === "WF-300",
      )?.occasion;
    expect(occasionWith(transferReferral)).toBe("transfer");
    const withoutSendingWard: Referral = { ...transferReferral };
    delete withoutSendingWard.originUnitId;
    expect(occasionWith(withoutSendingWard)).toBe("admission");
  });

  it("never treats a ward-to-ward departure as a discharge", () => {
    const state = seedWardFlowState();
    expect(supportNotificationSubjects(state).some((subject) => subject.subjectId === "AD-LEFT-02")).toBe(false);
  });

  it("reads involuntary legal status the same wide way the discharge guard does", () => {
    expect(legalStatusTextIsInvoluntary("Involuntary patient (recorded)")).toBe(true);
    expect(legalStatusTextIsInvoluntary("Detained awaiting examination")).toBe(true);
    expect(legalStatusTextIsInvoluntary("Voluntary")).toBe(false);
    expect(legalStatusTextIsInvoluntary("Referred for psychiatric examination")).toBe(false);
    expect(legalStatusTextIsInvoluntary(undefined)).toBe(false);
  });
});

describe("RECORD_SUPPORT_NOTIFICATION", () => {
  it("records who was told and when, defaulting the time to now", () => {
    const next = wardFlowReducer(involuntarySeed(), told());
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
    let state = wardFlowReducer(involuntarySeed(), told({ party: "mhas", who: "Advocate on duty" }));
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
      involuntarySeed(),
      told({ occasion: "discharge", movementId: undefined, admissionId: "AD-LEFT-01", contactedAt: NOW - 30 }),
    );
    expect(next.rejections).toHaveLength(0);
    expect(next.supportNotifications?.[0]).toMatchObject({ subjectId: "AD-LEFT-01", contactedAt: NOW - 30 });
  });

  it("refuses a role outside ward and coordinator", () => {
    const next = wardFlowReducer(involuntarySeed(), told({ role: "ed" }));
    expect(next.supportNotifications).toBeUndefined();
    expect(lastRejection(next)).toMatch(/requires role ward or coordinator/);
  });

  it("refuses a voluntary or unfinished move, and the wrong occasion", () => {
    const state = involuntarySeed();
    const voluntary = state.movements.find(
      (movement) => movement.stage === "arrived" && movement.legalStatus === "Voluntary",
    );
    expect(voluntary).toBeDefined();
    expect(lastRejection(wardFlowReducer(state, told({ movementId: voluntary!.id })))).toMatch(
      /not a completed arrival/,
    );
    expect(lastRejection(wardFlowReducer(state, told({ movementId: "WF-001" })))).toMatch(/not a completed arrival/);
    // Referred for examination is not an involuntary status.
    expect(lastRejection(wardFlowReducer(referredSeed(), told({ movementId: "WF-321" })))).toMatch(
      /not a completed arrival/,
    );
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
    const state = involuntarySeed();
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
    const state = involuntarySeed();
    const na = (overrides: Partial<NotificationEvent>) =>
      told({ outcome: "not_applicable", who: undefined, reason: "Synthetic", ...overrides });
    expect(lastRejection(wardFlowReducer(state, na({ reason: " " })))).toBe("say why it does not apply");
    expect(lastRejection(wardFlowReducer(state, na({ who: "Someone" })))).toMatch(/names nobody/);
    expect(
      lastRejection(wardFlowReducer(state, na({ reason: "x".repeat(SUPPORT_NOTIFICATION_REASON_MAX_CHARACTERS + 1) }))),
    ).toMatch(/limit is/);
  });

  it("refuses an off-list party, occasion or outcome", () => {
    const state = involuntarySeed();
    const bad = (overrides: Record<string, unknown>) => ({ ...told(), ...overrides }) as unknown as WardFlowEvent;
    expect(lastRejection(wardFlowReducer(state, bad({ party: "gp" })))).toMatch(/party must be/);
    expect(lastRejection(wardFlowReducer(state, bad({ occasion: "leave" })))).toMatch(/occasion/);
    expect(lastRejection(wardFlowReducer(state, bad({ outcome: "maybe" })))).toMatch(/outcome must be/);
  });

  it("is a typed-text event, kept out of browser storage and scenario files", () => {
    expect(WARD_FLOW_TYPED_TEXT_EVENT_TYPES.has("RECORD_SUPPORT_NOTIFICATION")).toBe(true);
    const recorded = wardFlowReducer(involuntarySeed(), told());
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
    let state = involuntarySeed();
    const ids = supportNotificationInboxItems(state, NOW).map((item) => item.id);
    expect(ids).toContain(supportNotificationTaskId("admission", "WF-300"));
    // A discharge row is keyed by its stay, which has no movement here, and opens by admission id.
    const discharge = supportNotificationInboxItems(state, NOW).find(
      (item) => item.id === supportNotificationTaskId("discharge", "AD-LEFT-01"),
    );
    expect(discharge).toMatchObject({ admissionId: "AD-LEFT-01", movementId: "" });
    // An arrival row has no admission id, so it opens its movement.
    expect(
      supportNotificationInboxItems(state, NOW).find(
        (item) => item.id === supportNotificationTaskId("admission", "WF-300"),
      )?.admissionId,
    ).toBeUndefined();

    for (const party of ["carer", "personal_support_person", "mhas"] as const) {
      state = wardFlowReducer(state, told({ party }));
    }
    const after = supportNotificationInboxItems(state, NOW);
    expect(after.map((item) => item.id)).not.toContain(supportNotificationTaskId("admission", "WF-300"));
    expect(after.find((item) => item.admissionId === "AD-LEFT-01")?.detail).toContain("Carer, PSP, MHAS not recorded");
  });

  it("looks back a set window only, as a display default", () => {
    const state = involuntarySeed();
    const later = NOW + SUPPORT_NOTIFICATION_TASK_LOOKBACK_MINUTES + 60;
    expect(supportNotificationInboxItems(state, later)).toEqual([]);
  });

  it("joins the action inbox when the caller hands it the records, and the ids acknowledge", () => {
    const state = involuntarySeed();
    const withRecords = buildActionInbox(state.movements.filter(isOpen), NOW, state.units, [], state);
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
    // A discharge row acknowledges by its stay's admission id, and only that.
    const ackDischarge = (inboxItemId: string) =>
      wardFlowReducer(state, { type: "ACKNOWLEDGE_INBOX_ITEM", role: "coordinator", now: NOW, inboxItemId });
    expect(ackDischarge(supportNotificationTaskId("discharge", "AD-LEFT-01")).rejections).toHaveLength(0);
    expect(ackDischarge(supportNotificationTaskId("discharge", "WF-300")).rejections).toHaveLength(1);
  });
});
