// M23 (master audit list, 10 Nov 2026): correction and undo safety. For every undo kind the engine
// keeps (`UNDO_STEP_ACTIONS` in ward-undo.ts, plus the referral decision and bed move records), a
// colleague's later save lands on the same subject first, then the original desk presses Undo. The
// Undo must be refused with a reason, leave the colleague's change exactly as it is, keep the undo
// record, and write a denied audit row naming the undo. The colleague's save is applied the way a
// sync from another desk arrives: the newer record replaces the one this desk last saw (the same
// shape the existing "changed since" tests use). Synthetic data only.
import { describe, expect, it } from "vitest";

import type { WardFlowEvent, WardFlowRole } from "../src/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import {
  UNDO_STEP_ACTIONS,
  UNDO_STEP_TYPES,
  type StepUndo,
  type UndoStepType,
} from "../src/components/ward-management/ward-undo";

import { applyFirstAccepted, undoComparableWorld } from "./helpers/ward-legal-figure-sweep";

const NOW = NOW_ANCHOR;
const world = undoComparableWorld;

function step(state: WardFlowState, type: WardFlowEvent["type"]) {
  const result = applyFirstAccepted(type, state, NOW);
  expect(result, `no seeded subject accepts ${type}`).toBeDefined();
  return result!;
}

/** Same prerequisites as tests/ward-undo-steps.test.ts. */
const PREREQUISITES: Partial<Record<WardFlowEvent["type"], readonly WardFlowEvent["type"][]>> = {
  HANDOVER_READY: ["BOOK_TRANSPORT"],
  TRANSPORT_ACCEPTED: ["BOOK_TRANSPORT", "HANDOVER_READY"],
  PATIENT_COLLECTED: ["TRANSPORT_EN_ROUTE"],
  COMPLETE_BED_MEETING_ACTION: ["RECORD_BED_MEETING_ACTION"],
  END_COMMUNITY_TREATMENT_ORDER: ["RECORD_COMMUNITY_TREATMENT_ORDER"],
};

function undoEventFor(event: WardFlowEvent, undoType: UndoStepType, role: WardFlowRole, recordSeq?: number) {
  const fields = event as {
    movementId?: string;
    referralId?: string;
    admissionId?: string;
    leaveBedId?: string;
    unitId?: string;
    bedNumber?: number;
    plannedAdmissionId?: string;
    releaseId?: string;
    patientId?: string;
  };
  return {
    type: undoType,
    role,
    now: NOW + 1,
    ...(recordSeq === undefined ? {} : { recordSeq }),
    ...(fields.movementId ? { movementId: fields.movementId } : {}),
    ...(fields.referralId ? { referralId: fields.referralId } : {}),
    ...(fields.admissionId ? { admissionId: fields.admissionId } : {}),
    ...(undoType === "UNDO_BED_STEP"
      ? fields.leaveBedId
        ? { leaveBedId: fields.leaveBedId }
        : { unitId: fields.unitId, bedNumber: fields.bedNumber }
      : {}),
    ...(undoType === "UNDO_RELEASE_STEP" && fields.plannedAdmissionId
      ? { plannedAdmissionId: fields.plannedAdmissionId }
      : {}),
    // M37 (D-129): a discharge sign-off's Undo names its bed release, as in tests/ward-undo-steps.test.ts.
    ...(undoType === "UNDO_RELEASE_STEP" && fields.releaseId ? { releaseId: fields.releaseId } : {}),
    ...(undoType === "UNDO_PATIENT_RECORD" ? { patientId: fields.patientId } : {}),
    ...(event.type === "COMPLETE_BED_MEETING_ACTION" || event.type === "RECORD_BED_MEETING_ACTION"
      ? { subject: event.subject, action: event.action }
      : {}),
    ...(event.type === "RECORD_SITE_HANDOVER_SIGN_OFF" ? { siteCode: event.siteCode } : {}),
  } as WardFlowEvent;
}

const COLLEAGUE_MARK = "later change by another desk (synthetic)";

/**
 * Another desk's later save to one of the records the step changed: the record now differs from
 * what this desk's step left. Returns undefined when the step changed nothing a colleague could edit.
 */
function colleagueSaves(state: WardFlowState, record: StepUndo): WardFlowState | undefined {
  const slices = state as unknown as Record<string, unknown>;
  const edit = (row: unknown) => ({ ...(row as object), colleagueEdit: COLLEAGUE_MARK });
  // A step that only removed a record (End leave): the colleague records a fresh leave for the same stay.
  const removed = record.changes.find(
    (change) => change.mode === "id" && change.slice === "leaveBeds" && change.after === null,
  );
  if (
    removed &&
    removed.mode === "id" &&
    record.changes.every((change) => change.mode === "id" && change.after === null)
  )
    return {
      ...state,
      leaveBeds: [
        ...state.leaveBeds,
        { ...(removed.before as object), id: "leave-colleague-m23", note: COLLEAGUE_MARK },
      ],
    } as WardFlowState;
  for (const change of record.changes) {
    const value = slices[change.slice];
    if (change.mode === "id" && change.after !== null && change.slice !== "notices" && Array.isArray(value)) {
      const list = value.map((row) => ((row as { id?: string }).id === change.id ? edit(row) : row));
      return { ...state, [change.slice]: list } as WardFlowState;
    }
    if (change.mode === "append" && Array.isArray(value) && change.rows.length > 0) {
      const at = value.findIndex(
        (row) => row === change.rows[0] || JSON.stringify(row) === JSON.stringify(change.rows[0]),
      );
      if (at < 0) continue;
      const list = [...value];
      list[at] = typeof list[at] === "object" && list[at] !== null ? edit(list[at]) : COLLEAGUE_MARK;
      return { ...state, [change.slice]: list } as WardFlowState;
    }
    if (change.mode === "whole" && change.after !== null && typeof change.after === "object") {
      return { ...state, [change.slice]: edit(change.after) } as WardFlowState;
    }
  }
  return undefined;
}

const CASES = UNDO_STEP_TYPES.flatMap((undoType) =>
  UNDO_STEP_ACTIONS[undoType]
    // The same seeded-subject exclusions as the exact-undo sweep (tests/ward-undo-steps.test.ts):
    // these need a hand-built chain that no seeded candidate offers.
    .filter(
      (type) => type !== "RECORD_SUPPORT_NOTIFICATION" && type !== "RELEASE_HELD_BED" && type !== "ARCHIVE_PATIENT",
    )
    .map((type) => [undoType, type] as const),
);

describe("M23: every step undo is refused after a colleague's later save, and never erases it", () => {
  it("covers every undo kind in the undo-kinds list", () => {
    // UNDO_SUPPORT_NOTIFICATION needs a hand-built Tell record and has its own case below.
    const covered = new Set<string>([...CASES.map(([undoType]) => undoType), "UNDO_SUPPORT_NOTIFICATION"]);
    expect([...covered].sort()).toEqual([...UNDO_STEP_TYPES].sort());
  });

  it.each(CASES)("%s after a competing save on %s", (undoType, type) => {
    const before = (PREREQUISITES[type] ?? []).reduce(
      (state, prior) => step(state, prior).applied,
      seedWardFlowState(),
    );
    const { applied, event } = step(before, type);
    const record = (applied.undoRecords ?? []).findLast(
      (candidate): candidate is StepUndo => candidate.kind === "step" && candidate.undoType === undoType,
    );
    expect(record, `${type} kept no undo record`).toBeDefined();
    const changed = colleagueSaves(applied, record!);
    expect(changed, `${type} changed nothing a colleague could edit`).toBeDefined();

    // Site sign-offs are taken back only by the site bed manager (Q75); everything else by the coordinator.
    const role: WardFlowRole = undoType === "UNDO_SITE_HANDOVER_SIGN_OFF" ? event.role : "coordinator";
    const undone = wardFlowReducer(changed!, undoEventFor(event, undoType, role, record!.seq));

    expect(undone.rejections.length).toBe(changed!.rejections.length + 1);
    expect(undone.rejections.at(-1)!.reason).toBe(
      type === "END_LEAVE_BED"
        ? "A newer leave or absence conflicts with this step, so it cannot be undone"
        : "This has changed since, so it cannot be undone",
    );
    // The colleague's change stands exactly, and this desk's Undo stays on record.
    expect(world(undone)).toEqual(world(changed!));
    expect(JSON.stringify(undone)).toContain(COLLEAGUE_MARK);
    expect(undone.undoRecords).toEqual(changed!.undoRecords);
    // One denied audit row names the refused undo.
    expect(undone.auditEvents.length).toBe(changed!.auditEvents.length + 1);
    expect(undone.auditEvents.at(-1)).toMatchObject({ category: "undo", action: undoType, outcome: "denied" });
  });
});

describe("M23: a Tell record's Undo after a colleague's later save", () => {
  it("refuses UNDO_SUPPORT_NOTIFICATION once another desk changed the Tell record", () => {
    const before = seedWardFlowState();
    const arrival = before.movements.find(
      (movement) =>
        (movement.legalStatus === "Involuntary inpatient" ||
          movement.legalStatus === "Detained awaiting examination") &&
        (movement.closure?.outcome === "arrived" || movement.stage === "arrived"),
    )!;
    const event: WardFlowEvent = {
      type: "RECORD_SUPPORT_NOTIFICATION",
      role: "ward",
      now: NOW,
      occasion: arrival.sourceAdmissionId !== undefined ? "transfer" : "admission",
      movementId: arrival.id,
      party: "carer",
      outcome: "told",
      who: "Synthetic carer",
      contactedAt: NOW,
    };
    const recorded = wardFlowReducer(before, event);
    expect(recorded.rejections).toEqual([]);
    const record = (recorded.undoRecords ?? []).findLast((r): r is StepUndo => r.kind === "step")!;
    const changed = colleagueSaves(recorded, record)!;
    expect(changed).toBeDefined();
    const undone = wardFlowReducer(
      changed,
      undoEventFor(event, "UNDO_SUPPORT_NOTIFICATION", "coordinator", record.seq),
    );
    expect(undone.rejections.at(-1)!.reason).toBe("This has changed since, so it cannot be undone");
    expect(world(undone)).toEqual(world(changed));
    expect(undone.auditEvents.at(-1)).toMatchObject({ action: "UNDO_SUPPORT_NOTIFICATION", outcome: "denied" });
  });
});

describe("M23: a bed meeting action's older Undo after a colleague's newer step on the same action", () => {
  it("refuses the older toast's Undo by its record number and keeps the colleague's completion", () => {
    const recorded = step(seedWardFlowState(), "RECORD_BED_MEETING_ACTION");
    const firstSeq = (recorded.applied.undoRecords ?? []).findLast((r) => r.kind === "step")!.seq;
    const completed = step(recorded.applied, "COMPLETE_BED_MEETING_ACTION");
    expect(world(completed.applied)).not.toEqual(world(recorded.applied));

    const undone = wardFlowReducer(
      completed.applied,
      undoEventFor(recorded.event, "UNDO_BED_MEETING_ACTION", "coordinator", firstSeq),
    );
    expect(undone.rejections.at(-1)!.reason).toBe("A later step replaced this one, so this Undo no longer applies");
    expect(world(undone)).toEqual(world(completed.applied));
    expect(undone.auditEvents.at(-1)).toMatchObject({ action: "UNDO_BED_MEETING_ACTION", outcome: "denied" });
  });
});

describe("M23: referral decision and bed move undos after a colleague's later save", () => {
  it("refuses a referral decision Undo once another desk changed the referral, keeping its notices", () => {
    const accepted = step(seedWardFlowState(), "ACCEPT_REFERRAL");
    const referralId = (accepted.event as Extract<WardFlowEvent, { type: "ACCEPT_REFERRAL" }>).referralId;
    const changed: WardFlowState = {
      ...accepted.applied,
      referrals: accepted.applied.referrals.map((referral) =>
        referral.id === referralId ? { ...referral, urgency: referral.urgency === 1 ? 2 : 1 } : referral,
      ),
    };
    const undone = wardFlowReducer(changed, {
      type: "UNDO_REFERRAL_DECISION",
      role: "coordinator",
      now: NOW + 1,
      referralId,
    } as WardFlowEvent);
    expect(undone.rejections.at(-1)!.reason).toBe(
      "This referral has changed since the decision, so it cannot be undone",
    );
    expect(undone.referrals).toEqual(changed.referrals);
    // Alerts the decision raised stay with it; nothing is half-withdrawn.
    expect(undone.notices).toEqual(changed.notices);
    expect(undone.undoRecords).toEqual(changed.undoRecords);
    expect(undone.auditEvents.at(-1)).toMatchObject({ action: "UNDO_REFERRAL_DECISION", outcome: "denied" });
  });

  it("refuses a bed move Undo once another desk moved the stay again, keeping the newer bed", () => {
    const seed = seedWardFlowState();
    const unitId = "scgh-adult-open";
    const admissionId = seed.admissions.find((a) => a.unitId === unitId && a.state === "occupied")!.id;
    const placed = wardFlowReducer(seed, {
      type: "PLACE_IN_BED",
      role: "ward",
      now: NOW,
      admissionId,
      bedNumber: 4,
      actingUnitId: unitId,
    } as WardFlowEvent);
    expect(placed.rejections).toEqual([]);
    // Another desk moves the same stay on to bed 7 (the reducer replaces this desk's undo record).
    const changed: WardFlowState = {
      ...placed,
      admissions: placed.admissions.map((admission) =>
        admission.id === admissionId ? { ...admission, bedNumber: 7 } : admission,
      ),
    };
    const undone = wardFlowReducer(changed, {
      type: "UNDO_PLACE_IN_BED",
      role: "coordinator",
      now: NOW + 1,
      admissionId,
    } as WardFlowEvent);
    expect(undone.rejections.at(-1)!.reason).toBe("This stay has changed since the bed move, so it cannot be undone");
    expect(undone.admissions).toEqual(changed.admissions);
    expect(undone.auditEvents.at(-1)).toMatchObject({ action: "UNDO_PLACE_IN_BED", outcome: "denied" });
  });
});
