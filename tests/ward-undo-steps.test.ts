// v10 pass 3 (Josh, 10 Oct 2026): the step undos (`UNDO_STEP_ACTIONS`, `ward-undo.ts`), the
// Bed board's numbered acceptance (`ACCEPT_IN_PRINCIPLE.bedNumber`) and the override's second
// sign-off. Each undo: role gates, exact restoration, the window, "unchanged since", the audit
// entry and storage. Synthetic data only.
import { describe, expect, it } from "vitest";

import type { WardFlowEvent, WardFlowRole } from "../src/components/ward-management/ward-flow-events";
import {
  WARD_FLOW_TEXT_SAFE_EVENT_TYPES,
  eventCarriesTypedTextPayload,
} from "../src/components/ward-management/ward-flow-persistence-classification";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "../src/components/ward-management/ward-flow-storage-validation";
import { numberedBedKindRefusal } from "../src/components/ward-management/ward-bed-designation";
import { OVERRIDE_REASONS, URGENCY_CHANGE_REASONS } from "../src/components/ward-management/ward-change-reasons";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import {
  UNDO_STEP_ACTIONS,
  UNDO_STEP_TYPES,
  UNDO_WINDOW_MINUTES,
  type UndoStepType,
} from "../src/components/ward-management/ward-undo";

import { applyFirstAccepted, undoComparableWorld, undoOf } from "./helpers/ward-legal-figure-sweep";

const NOW = NOW_ANCHOR;
const stored = (state: WardFlowState) => JSON.parse(JSON.stringify({ ...state, rejections: [] })) as unknown;

const world = undoComparableWorld;

/** The first candidate of `type` the reducer accepts on `state`, as the sweep builds it. */
function step(state: WardFlowState, type: WardFlowEvent["type"]) {
  const result = applyFirstAccepted(type, state, NOW);
  expect(result, `no seeded subject accepts ${type}`).toBeDefined();
  return result!;
}

function undoEventFor(event: WardFlowEvent, role: WardFlowRole, now = NOW + 1, actingUnitId?: string) {
  const undoType = (Object.keys(UNDO_STEP_ACTIONS) as UndoStepType[]).find((type) =>
    (UNDO_STEP_ACTIONS[type] as readonly string[]).includes(event.type),
  )!;
  const fields = event as { movementId?: string; referralId?: string; admissionId?: string };
  return {
    type: undoType,
    role,
    now,
    ...(fields.movementId ? { movementId: fields.movementId } : {}),
    ...(fields.referralId ? { referralId: fields.referralId } : {}),
    ...(fields.admissionId ? { admissionId: fields.admissionId } : {}),
    ...(actingUnitId ? { actingUnitId } : {}),
    ...(event.type === "COMPLETE_BED_MEETING_ACTION" ? { subject: event.subject, action: event.action } : {}),
  } as WardFlowEvent;
}

const lastRefusal = (before: WardFlowState, after: WardFlowState) =>
  after.rejections.length > before.rejections.length ? after.rejections.at(-1)!.reason : undefined;

/** Steps a seeded movement needs first before it accepts `type` (master plan 5.2). */
const PREREQUISITES: Partial<Record<WardFlowEvent["type"], readonly WardFlowEvent["type"][]>> = {
  HANDOVER_READY: ["BOOK_TRANSPORT"],
  TRANSPORT_ACCEPTED: ["BOOK_TRANSPORT", "HANDOVER_READY"],
  PATIENT_COLLECTED: ["TRANSPORT_EN_ROUTE"],
  COMPLETE_BED_MEETING_ACTION: ["RECORD_BED_MEETING_ACTION"],
};

/** Accept a step, take it back as `role`, and expect the world exactly as before the step. */
function expectExactUndo(type: WardFlowEvent["type"], undoRole: WardFlowRole, actingUnitId?: string) {
  const before = (PREREQUISITES[type] ?? []).reduce((state, prior) => step(state, prior).applied, seedWardFlowState());
  const { applied, event } = step(before, type);
  expect(world(applied)).not.toEqual(world(before));
  // A typed-text step (a repatriation's CAD number) locks storage anyway; every other step, and
  // its undo record, must still load from a save.
  if (WARD_FLOW_TEXT_SAFE_EVENT_TYPES.has(type)) expect(isValidStoredWardFlowState(stored(applied))).toBe(true);
  const undone = wardFlowReducer(applied, undoEventFor(event, undoRole, NOW + 1, actingUnitId));
  expect(lastRefusal(applied, undone)).toBeUndefined();
  expect(world(undone)).toEqual(world(before));
  // Only the step's own record goes; a record the step replaced (one Undo per subject) stays gone.
  const prior = before.undoRecords ?? [];
  expect(undone.undoRecords ?? []).toEqual((applied.undoRecords ?? []).filter((record) => prior.includes(record)));
  expect(isValidStoredWardFlowState(stored(undone))).toBe(true);
  const entry = undone.auditEvents.at(-1)!;
  expect(entry).toMatchObject({ category: "undo", action: undoEventFor(event, undoRole).type, outcome: "accepted" });
  expect(entry.details).toEqual({ undoneAction: event.type, decidedAt: NOW });
  return { before, applied, event, undone };
}

describe("step undos restore exactly, by the role that acted or the coordinator", () => {
  it("UNDO_REFER_TO_UNITS takes back Home's Offer, and only the coordinator holds it", () => {
    expectExactUndo("REFER_TO_UNITS", "coordinator");
    const { applied, event } = step(seedWardFlowState(), "REFER_TO_UNITS");
    for (const role of ["ward", "ed", "officer", "community"] as const) {
      const refused = wardFlowReducer(applied, undoEventFor(event, role));
      expect(lastRefusal(applied, refused), role).toMatch(/requires role coordinator/);
    }
  });

  it("UNDO_ACCEPT_IN_PRINCIPLE: the ward that accepted, never another ward; the coordinator always", () => {
    const { applied, event } = step(seedWardFlowState(), "ACCEPT_IN_PRINCIPLE");
    expect(event.role).toBe("ward");
    const unitId = (event as Extract<WardFlowEvent, { type: "ACCEPT_IN_PRINCIPLE" }>).unitId;
    const otherWard = wardFlowReducer(applied, undoEventFor(event, "ward", NOW + 1, "not-this-ward"));
    expect(lastRefusal(applied, otherWard)).toBe(
      "Only the ward that made this decision, or the coordinator, can undo it",
    );
    const ed = wardFlowReducer(applied, undoEventFor(event, "ed"));
    expect(lastRefusal(applied, ed)).toMatch(/requires role ward or coordinator/);
    expectExactUndo("ACCEPT_IN_PRINCIPLE", "ward", unitId);
    expectExactUndo("ACCEPT_IN_PRINCIPLE", "coordinator");
  });

  it("UNDO_TRANSPORT_STEP: another permitted role that did not act is refused with a reason", () => {
    const { applied, event } = step(seedWardFlowState(), "TRANSPORT_EN_ROUTE");
    expect(event.role).toBe("officer");
    const ward = wardFlowReducer(applied, undoEventFor(event, "ward"));
    expect(lastRefusal(applied, ward)).toBe("Only the role that made this decision, or the coordinator, can undo it");
    expectExactUndo("TRANSPORT_EN_ROUTE", "officer");
    expectExactUndo("PATIENT_ARRIVED", "officer");
  });

  it("UNDO_TRANSPORT_STEP takes back an arrival exactly, the stay it created with it", () => {
    const { applied } = expectExactUndo("PATIENT_ARRIVED", "coordinator");
    expect(applied.admissions.length).toBeGreaterThanOrEqual(seedWardFlowState().admissions.length);
  });

  it.each([
    ["RECORD_LEGAL_FORM_RECEIVED"],
    ["RECORD_LEGAL_FORM_WRITTEN"],
    ["RECORD_REPATRIATION"],
    ["RECORD_HANDOVER_SIGN_OFF"],
    ["RECORD_EXAMINATION"],
    ["RECORD_ARRIVED_IN_DEPARTMENT"],
    ["RECORD_TRANSPORT_NEED"],
  ] as const)("%s is undone exactly by the role that recorded it and by the coordinator", (type) => {
    const { event } = step(seedWardFlowState(), type);
    expectExactUndo(type, event.role);
    expectExactUndo(type, "coordinator");
  });

  // Master plan 5.2 (15 Oct 2026): every undo action, by name, against every step it takes back.
  it.each(
    UNDO_STEP_TYPES.flatMap((undoType) =>
      UNDO_STEP_ACTIONS[undoType]
        .filter((type) => type !== "RECORD_SUPPORT_NOTIFICATION")
        .map((type) => [undoType, type] as const),
    ),
  )("%s takes back %s exactly, by the role that acted and by the coordinator", (undoType, type) => {
    const { event, undone } = expectExactUndo(type, "coordinator");
    expect(undone.auditEvents.at(-1)!.action).toBe(undoType);
    const actingUnitId =
      event.type === "ACCEPT_IN_PRINCIPLE" && event.role === "ward"
        ? event.unitId
        : "actingUnitId" in event
          ? event.actingUnitId
          : undefined;
    expectExactUndo(type, event.role, actingUnitId);
  });

  it("UNDO_SUPPORT_NOTIFICATION takes back a Tell record exactly", () => {
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
    const undone = undoOf(event, recorded, NOW + 1);
    expect(undone?.type).toBe("UNDO_SUPPORT_NOTIFICATION");
    expect(undone!.state.supportNotifications ?? []).toEqual(before.supportNotifications ?? []);
    // Master plan 5.2: the whole world comes back, by the role that acted and by the coordinator.
    for (const role of ["ward", "coordinator"] as const) {
      const taken = wardFlowReducer(recorded, undoEventFor(event, role));
      expect(lastRefusal(recorded, taken), role).toBeUndefined();
      // The undo leaves an empty list where the seed had none, which means the same.
      const tells = (state: WardFlowState) => ({
        ...world(state),
        supportNotifications: state.supportNotifications ?? [],
      });
      expect(tells(taken), role).toEqual(tells(before));
      expect(taken.undoRecords ?? [], role).toEqual(before.undoRecords ?? []);
      expect(taken.auditEvents.at(-1)!.action, role).toBe("UNDO_SUPPORT_NOTIFICATION");
    }
  });
});

describe("the three undo rules hold for every step", () => {
  it("refuses outside the window, with a reason", () => {
    const { applied, event } = step(seedWardFlowState(), "REFER_TO_UNITS");
    const late = wardFlowReducer(applied, undoEventFor(event, "coordinator", NOW + UNDO_WINDOW_MINUTES + 1));
    expect(lastRefusal(applied, late)).toBe(
      `Undo is only possible within ${UNDO_WINDOW_MINUTES} minutes of the decision`,
    );
    expect(world(late)).toEqual(world(applied));
  });

  it("refuses once something has changed the subject since, never overwriting a later change", () => {
    const { applied, event } = step(seedWardFlowState(), "REFER_TO_UNITS");
    const movementId = (event as Extract<WardFlowEvent, { type: "REFER_TO_UNITS" }>).movementId;
    const urgency = applied.movements.find((movement) => movement.id === movementId)!.urgency;
    const changed = wardFlowReducer(applied, {
      type: "CHANGE_URGENCY",
      role: "coordinator",
      now: NOW,
      movementId,
      urgency: urgency === 1 ? 2 : 1,
      reason: URGENCY_CHANGE_REASONS[0],
    } as WardFlowEvent);
    expect(changed.rejections.length).toBe(applied.rejections.length);
    const undo = wardFlowReducer(changed, undoEventFor(event, "coordinator"));
    expect(lastRefusal(changed, undo)).toBe("This has changed since, so it cannot be undone");
  });

  it("refuses with a reason when there is nothing of that kind to undo, and audits the refusal", () => {
    const state = seedWardFlowState();
    const refused = wardFlowReducer(state, { type: "UNDO_HANDOVER_SIGN_OFF", role: "coordinator", now: NOW });
    expect(lastRefusal(state, refused)).toBe("There is no handover sign-off to undo");
    expect(refused.auditEvents.at(-1)).toMatchObject({
      action: "UNDO_HANDOVER_SIGN_OFF",
      outcome: "denied",
      details: { undoneAction: null, decidedAt: null },
    });
  });

  it("only the newest step on a subject is undoable, and an undo cannot be repeated", () => {
    const { applied, event } = step(seedWardFlowState(), "TRANSPORT_EN_ROUTE");
    const once = wardFlowReducer(applied, undoEventFor(event, "coordinator"));
    const twice = wardFlowReducer(once, undoEventFor(event, "coordinator"));
    expect(lastRefusal(once, twice)).toBe("There is no transport step on this journey to undo");
  });
});

describe("ACCEPT_IN_PRINCIPLE with a bed number (the ward Bed board)", () => {
  function destinationReview() {
    const state = seedWardFlowState();
    const { event } = step(state, "ACCEPT_IN_PRINCIPLE");
    return { state, event: event as Extract<WardFlowEvent, { type: "ACCEPT_IN_PRINCIPLE" }> };
  }

  it("holds the numbered bed on the movement, and Undo clears it with the acceptance", () => {
    const review = destinationReview();
    const { event } = review;
    // PR #675: a numbered bed is held only while that kind of bed is free, so give the seeded
    // (full) ward one free bed, and choose a bed of the kind the open/locked rule allows next.
    const state = {
      ...review.state,
      units: review.state.units.map((candidate) =>
        candidate.id === event.unitId
          ? { ...candidate, allocatable: { ...candidate.allocatable, value: candidate.allocatable.value + 1 } }
          : candidate,
      ),
    };
    const unit = state.units.find((candidate) => candidate.id === event.unitId)!;
    const secure = state.movements.find((movement) => movement.id === event.movementId)!.security === "Secure";
    const bedNumber = Array.from({ length: unit.beds }, (_, index) => index + 1).find(
      (candidate) => numberedBedKindRefusal(unit, candidate, secure) === null,
    );
    expect(bedNumber).toBeDefined();
    const accepted = wardFlowReducer(state, { ...event, bedNumber: bedNumber! });
    expect(accepted.rejections).toEqual([]);
    expect(accepted.movements.find((movement) => movement.id === event.movementId)!.heldBedNumber).toBe(bedNumber);
    expect(isValidStoredWardFlowState(stored(accepted))).toBe(true);
    const undone = wardFlowReducer(accepted, undoEventFor(event, "ward", NOW + 1, event.unitId));
    expect(lastRefusal(accepted, undone)).toBeUndefined();
    expect(world(undone)).toEqual(world(state));
    expect(undone.movements.find((movement) => movement.id === event.movementId)).not.toHaveProperty("heldBedNumber");
  });

  it("refuses a bed out of range, and a bed already held for another movement", () => {
    const { state, event } = destinationReview();
    const unitBeds = state.units.find((unit) => unit.id === event.unitId)!.beds;
    const outOfRange = wardFlowReducer(state, { ...event, bedNumber: unitBeds + 1 });
    expect(lastRefusal(state, outOfRange)).toMatch(/is not one of/);
    const other = state.movements.find(
      (movement) => movement.id !== event.movementId && movement.closure === undefined,
    )!;
    const held = {
      ...state,
      movements: state.movements.map((m) =>
        m.id === other.id ? { ...m, acceptedUnitId: event.unitId, heldBedNumber: 2 } : m,
      ),
    };
    const taken = wardFlowReducer(held, { ...event, bedNumber: 2 });
    expect(lastRefusal(held, taken)).toMatch(/is already pulled for someone/);
  });
});

describe("override second sign-off", () => {
  const reason = OVERRIDE_REASONS[0];

  it("is stored on the override and its audit entry, and marks the dispatch as typed text", () => {
    const state = seedWardFlowState();
    const { event } = step(state, "REFER_TO_UNITS");
    const withSignOff = {
      ...event,
      overrideReason: reason,
      overrideSignOff: { role: "coordinator", name: "  J. Synthetic " },
    } as WardFlowEvent;
    expect(eventCarriesTypedTextPayload(withSignOff)).toBe(true);
    expect(eventCarriesTypedTextPayload(event)).toBe(false);
    const next = wardFlowReducer(state, withSignOff);
    expect(next.rejections).toEqual([]);
    const movementId = (event as Extract<WardFlowEvent, { type: "REFER_TO_UNITS" }>).movementId;
    expect(next.movements.find((movement) => movement.id === movementId)!.overrides.at(-1)!.secondSignOff).toEqual({
      role: "coordinator",
      name: "J. Synthetic",
    });
    expect(next.auditEvents.at(-1)!.details).toMatchObject({
      secondSignOff: { role: "coordinator", name: "J. Synthetic" },
    });
    expect(isValidStoredWardFlowState(stored(next))).toBe(true);
  });

  it("is optional, and old overrides without one still load", () => {
    const state = seedWardFlowState();
    const { applied } = step(state, "REFER_TO_UNITS");
    expect(applied.movements.flatMap((movement) => movement.overrides).some((o) => "secondSignOff" in o)).toBe(false);
  });

  it.each([
    [{ role: "coordinator", name: "   " }, /needs a name or initials/],
    [{ role: "coordinator", name: "x".repeat(61) }, /needs a name or initials/],
    [{ role: "nobody", name: "JS" }, /must name the role/],
  ])("refuses a malformed sign-off %j whole", (signOff, refusal) => {
    const state = seedWardFlowState();
    const { event } = step(state, "REFER_TO_UNITS");
    const next = wardFlowReducer(state, {
      ...event,
      overrideReason: reason,
      overrideSignOff: signOff,
    } as WardFlowEvent);
    expect(lastRefusal(state, next)).toMatch(refusal);
    expect(world(next)).toEqual(world(state));
  });

  it("refuses a sign-off sent without an override reason", () => {
    const state = seedWardFlowState();
    const { event } = step(state, "REFER_TO_UNITS");
    const next = wardFlowReducer(state, { ...event, overrideSignOff: { role: "ward", name: "JS" } } as WardFlowEvent);
    expect(lastRefusal(state, next)).toBe("A second sign-off is recorded only with an override reason");
  });
});

describe("an older Undo cannot take back a newer step", () => {
  // Gitar and Qodo review on PR #242: two steps on one subject inside the toast window, often in the
  // same whole minute. Each record carries its own rising number, and an Undo naming an older one
  // is refused rather than taking back the newer step.
  it("refuses an older step's Undo within the same minute by its record number", () => {
    const { applied, event } = step(seedWardFlowState(), "REFER_TO_UNITS");
    const record = applied.undoRecords?.find((row) => row.kind === "step");
    expect(record?.kind === "step" && typeof record.seq === "number").toBe(true);
    const seq = record?.kind === "step" ? (record.seq ?? 0) : 0;
    const base = undoEventFor(event, "coordinator", NOW + 2);
    const stale = { ...base, recordSeq: seq - 1 } as WardFlowEvent;
    expect(lastRefusal(applied, wardFlowReducer(applied, stale))).toBe(
      "A later step replaced this one, so this Undo no longer applies",
    );
    const undone = wardFlowReducer(applied, { ...base, recordSeq: seq } as WardFlowEvent);
    expect(lastRefusal(applied, undone)).toBeUndefined();
    expect(world(undone)).toEqual(world(seedWardFlowState()));
  });
});
