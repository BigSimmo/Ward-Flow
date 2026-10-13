/**
 * Regression tests for the permissions and ward-scoping findings of the 8 October 2026 review
 * (`docs/ward-flow/audit-2026-10-08-issue-list.md`), implemented to the owner's decisions of
 * 12 October 2026: strict ward scoping, the referrer rule for withdrawals, and the legal form
 * expiry role limit and audit. Synthetic data only.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-events";
import { COORDINATOR_DESK_ACKNOWLEDGER_ID } from "@/components/ward-management/alerts/ward-broadcast-model";
import { referralSenderRole } from "@/components/ward-management/ward-referrals";

const now = 642;
type WithoutNow<T> = T extends unknown ? Omit<T, "now"> : never;
type TestEvent = WithoutNow<WardFlowEvent>;

const HOME = "scgh-adult-open";
const OTHER = "fsh-older-adult";

function harness(initial: WardFlowState = seedWardFlowState()) {
  let state = initial;
  let t = now;
  const send = (event: TestEvent | Record<string, unknown>): string | null => {
    const before = state.rejections.length;
    state = wardFlowReducer(state, { now: t++, ...event } as WardFlowEvent);
    return state.rejections.length === before ? null : state.rejections.at(-1)!.reason;
  };
  const ok = (event: TestEvent | Record<string, unknown>) => {
    const refusal = send(event);
    if (refusal) throw new Error(`${(event as { type: string }).type} refused: ${refusal}`);
  };
  return {
    get state() {
      return state;
    },
    send,
    ok,
    get t() {
      return t;
    },
  };
}
type Harness = ReturnType<typeof harness>;

const draft = {
  cohort: "Adult",
  security: "Open",
  sex: "Female",
  gender: "Female",
  specialling: false,
  highAcuity: false,
  legalStatus: "Voluntary",
  urgency: 2,
  legalFormCode: null,
} as const;

/** A fresh ED journey from jhc-ed, referred to HOME. */
function referredMovement(h: Harness, umrn: string) {
  h.ok({
    type: "ADD_PATIENT",
    role: "coordinator",
    umrn,
    givenName: "Demo",
    familyName: "Scope",
    dateOfBirth: "1980-01-01",
  });
  const patient = h.state.patients.at(-1)!;
  h.ok({ type: "RAISE_REFERRAL", role: "ed", edId: "jhc-ed", patientId: patient.id, draft });
  const movement = h.state.movements.at(-1)!;
  h.ok({ type: "REFER_TO_UNITS", role: "coordinator", movementId: movement.id, unitIds: [HOME] });
  return movement.id;
}

/** Referred, accepted and pulled at HOME. */
function pulledMovement(h: Harness, umrn: string) {
  const movementId = referredMovement(h, umrn);
  h.ok({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId, unitId: HOME, actingUnitId: HOME });
  h.ok({ type: "PULL_PATIENT", role: "ward", movementId, unitId: HOME, actingUnitId: HOME });
  return movementId;
}

const book = (movementId: string, actingUnitId?: string) => ({
  type: "BOOK_TRANSPORT",
  role: "ward",
  movementId,
  ...(actingUnitId ? { actingUnitId } : {}),
  provider: "Ambulance service",
  escortRequired: false,
  cadNumber: "CAD-SCOPE-01",
  transportLegalStatus: "voluntary",
  estimatedAt: 900,
});

/** A front-door referral addressed to one named ward. */
function wardReferral(
  h: Harness,
  options: { role?: "community" | "ed" | "ward"; source?: string; originUnitId?: string; actingUnitId?: string } = {},
) {
  const role = options.role ?? "community";
  const source = options.source ?? "community";
  h.ok({
    type: "RECEIVE_REFERRAL",
    role,
    ...(options.actingUnitId ? { actingUnitId: options.actingUnitId } : {}),
    ageBand: "Adult",
    source,
    ...(options.originUnitId ? { originUnitId: options.originUnitId } : {}),
    originSiteCode: source === "ed_medical" ? "ARM" : "SCGH",
    urgency: 2,
    destinations: [
      {
        kind: "psychiatric_ward",
        unitId: HOME,
        sex: "Female",
        gender: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "unknown", reason: "not_known" },
    transportNeeded: false,
    history: "",
  });
  return h.state.referrals.at(-1)!;
}

describe("A1-1: a ward accepts and pulls only for itself", () => {
  it("refuses an acceptance for another ward, and one that names no ward", () => {
    const h = harness();
    const movementId = referredMovement(h, "SYN-SCOPE-001");
    expect(
      h.send({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId, unitId: HOME, actingUnitId: OTHER }),
    ).toMatch(/ward fsh-older-adult cannot accept a bed for scgh-adult-open/);
    expect(h.send({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId, unitId: HOME })).toMatch(
      /must state its actingUnitId/,
    );
    expect(h.state.movements.find((m) => m.id === movementId)?.acceptedUnitId).toBeUndefined();
    h.ok({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId, unitId: HOME, actingUnitId: HOME });
  });

  it("refuses a pull for another ward", () => {
    const h = harness();
    const movementId = referredMovement(h, "SYN-SCOPE-002");
    h.ok({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId, unitId: HOME, actingUnitId: HOME });
    expect(h.send({ type: "PULL_PATIENT", role: "ward", movementId, unitId: HOME, actingUnitId: OTHER })).toMatch(
      /cannot pull a bed/,
    );
    expect(h.state.movements.find((m) => m.id === movementId)?.stage).toBe("accepted_awaiting_bed");
  });

  it("audits a cross-ward override acceptance as a scope refusal (A1-12)", () => {
    const h = harness();
    const movementId = referredMovement(h, "SYN-SCOPE-003");
    h.send({
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      movementId,
      unitId: HOME,
      actingUnitId: OTHER,
      overrideReason: "Clinical urgency",
    });
    expect(h.state.auditEvents.at(-1)).toMatchObject({ outcome: "denied", reasonCode: "scope" });
  });
});

describe("A1-12: existing cross-ward refusals are audited as scope", () => {
  it("records FLAG_BED_RELEASE for another ward with reason code scope", () => {
    const h = harness();
    const stay = h.state.admissions.find((a) => a.state === "occupied" && a.unitId === HOME)!;
    h.send({
      type: "FLAG_BED_RELEASE",
      role: "ward",
      unitId: HOME,
      actingUnitId: OTHER,
      admissionId: stay.id,
      expectedAt: now + 60,
      waitingOn: "Nothing outstanding",
    });
    expect(h.state.auditEvents.at(-1)).toMatchObject({ outcome: "denied", reasonCode: "scope" });
  });
});

describe("A1-3: a ward declines or waitlists only for itself", () => {
  it("refuses a decline for another ward and leaves its referral live", () => {
    const h = harness();
    const movementId = referredMovement(h, "SYN-SCOPE-010");
    expect(
      h.send({
        type: "DECLINE",
        role: "ward",
        movementId,
        unitId: HOME,
        actingUnitId: OTHER,
        reason: "no_suitable_bed",
      }),
    ).toMatch(/cannot decline or waitlist/);
    expect(h.state.movements.find((m) => m.id === movementId)?.referredUnitIds).toEqual([HOME]);
  });
});

describe("S2-11: a ward answers a front-door referral only as itself", () => {
  it("refuses ACCEPT_REFERRAL and DECLINE_REFERRAL from another ward", () => {
    const h = harness();
    const referral = wardReferral(h);
    expect(
      h.send({
        type: "ACCEPT_REFERRAL",
        role: "ward",
        referralId: referral.id,
        destinationKind: "psychiatric_ward",
        unitId: HOME,
        actingUnitId: OTHER,
      }),
    ).toMatch(/cannot accept this referral/);
    expect(
      h.send({
        type: "DECLINE_REFERRAL",
        role: "ward",
        referralId: referral.id,
        destinationKind: "psychiatric_ward",
        unitId: HOME,
        actingUnitId: OTHER,
        reason: "no_suitable_bed",
      }),
    ).toMatch(/cannot decline this referral for scgh-adult-open/);
    expect(h.state.referrals.find((r) => r.id === referral.id)?.destinations[0].state).toBe("queued");
  });
});

describe("S2-10: a ward books or cancels transport only into or out of its own ward", () => {
  it("refuses an unrelated ward's booking, then lets the receiving ward book and refuses another's cancel", () => {
    const h = harness();
    const movementId = pulledMovement(h, "SYN-SCOPE-020");
    expect(h.send(book(movementId, OTHER))).toMatch(/cannot book transport/);
    expect(h.state.movements.find((m) => m.id === movementId)?.transport).toBeUndefined();
    h.ok(book(movementId, HOME));
    expect(
      h.send({ type: "CANCEL_TRANSPORT", role: "ward", movementId, actingUnitId: OTHER, reason: "no_longer_needed" }),
    ).toMatch(/cannot cancel transport/);
  });
});

describe("A1-8 and S2-5: arrival details", () => {
  it("lets only the destination ward set them, and refuses a community caller", () => {
    const h = harness();
    const movementId = pulledMovement(h, "SYN-SCOPE-030");
    const details = { movementId, arrivalMode: "mental_health_transport", estimatedArrivalAt: 900 };
    const held = h.state.movements.find((m) => m.id === movementId)!.pullExpiresAt;
    expect(h.send({ type: "SET_ARRIVAL_DETAILS", role: "ward", actingUnitId: OTHER, ...details })).toMatch(
      /cannot set arrival details/,
    );
    expect(h.send({ type: "SET_ARRIVAL_DETAILS", role: "community", ...details })).toMatch(/requires role/);
    expect(h.state.movements.find((m) => m.id === movementId)!.pullExpiresAt).toBe(held);
    h.ok({ type: "SET_ARRIVAL_DETAILS", role: "ward", actingUnitId: HOME, ...details });
  });

  it("refuses a closed movement and raises no late notices", () => {
    const h = harness();
    const movementId = pulledMovement(h, "SYN-SCOPE-031");
    h.ok({ type: "WITHDRAW_REFERRAL", role: "coordinator", movementId });
    const notices = h.state.notices.length;
    expect(
      h.send({
        type: "SET_ARRIVAL_DETAILS",
        role: "coordinator",
        movementId,
        arrivalMode: "mental_health_transport",
        estimatedArrivalAt: 0,
      }),
    ).toMatch(/closed movement/);
    expect(h.state.notices.length).toBe(notices);
    expect(h.state.movements.find((m) => m.id === movementId)!.arrivalDetails).toBeUndefined();
  });
});

describe("A1-10: a transport need is recorded only by the destination or sending ward", () => {
  it("refuses an unrelated ward", () => {
    const h = harness();
    const movementId = pulledMovement(h, "SYN-SCOPE-040");
    expect(
      h.send({ type: "RECORD_TRANSPORT_NEED", role: "ward", movementId, needed: false, actingUnitId: OTHER }),
    ).toMatch(/cannot record a transport need/);
    expect(h.state.movements.find((m) => m.id === movementId)!.transportNeed).toBeUndefined();
    h.ok({ type: "RECORD_TRANSPORT_NEED", role: "ward", movementId, needed: false, actingUnitId: HOME });
  });
});

describe("S1-12: a ward changing a stay names the stay's own ward", () => {
  it("refuses UPDATE_EXPECTED_DISCHARGE that names no ward", () => {
    const h = harness();
    const stay = h.state.admissions.find((a) => a.state === "occupied")!;
    const before = stay.expectedDischargeAt;
    expect(
      h.send({ type: "UPDATE_EXPECTED_DISCHARGE", role: "ward", admissionId: stay.id, expectedDischargeAt: 5000 }),
    ).toMatch(/must state its actingUnitId/);
    expect(h.state.admissions.find((a) => a.id === stay.id)!.expectedDischargeAt).toBe(before);
  });
});

describe("A1-13: an alert is acknowledged only as the caller's own desk", () => {
  function withAlert() {
    const h = harness();
    h.ok({
      type: "DISPATCH_BROADCAST_ALERT",
      role: "coordinator",
      title: "Synthetic directive",
      message: "Synthetic message",
      severity: "warning",
      category: "capacity_gridlock",
      targetScope: "all",
      targetScopeLabel: "All wards",
      durationMinutes: 60,
      dispatchedByName: "Synthetic desk",
    });
    return { h, alertId: h.state.broadcastAlerts.at(-1)!.id };
  }

  it("refuses a ward acknowledging as another ward or as the coordinator desk", () => {
    const { h, alertId } = withAlert();
    expect(
      h.send({ type: "ACKNOWLEDGE_BROADCAST_ALERT", role: "ward", alertId, unitId: OTHER, actingUnitId: HOME }),
    ).toMatch(/only as its own ward/);
    expect(
      h.send({
        type: "ACKNOWLEDGE_BROADCAST_ALERT",
        role: "ward",
        alertId,
        unitId: COORDINATOR_DESK_ACKNOWLEDGER_ID,
        actingUnitId: HOME,
      }),
    ).toMatch(/Only the coordinator/);
    expect(
      h.send({ type: "ACKNOWLEDGE_BROADCAST_ALERT", role: "ed", alertId, unitId: COORDINATOR_DESK_ACKNOWLEDGER_ID }),
    ).toMatch(/Only the coordinator/);
    expect(h.send({ type: "ACKNOWLEDGE_BROADCAST_ALERT", role: "officer", alertId, unitId: HOME })).toMatch(
      /no desk of its own/,
    );
    expect(h.state.broadcastAlerts.at(-1)!.acknowledgedUnits).toEqual([]);
    h.ok({ type: "ACKNOWLEDGE_BROADCAST_ALERT", role: "ward", alertId, unitId: HOME, actingUnitId: HOME });
    h.ok({
      type: "ACKNOWLEDGE_BROADCAST_ALERT",
      role: "coordinator",
      alertId,
      unitId: COORDINATOR_DESK_ACKNOWLEDGER_ID,
    });
    expect(h.state.broadcastAlerts.at(-1)!.acknowledgedUnits).toEqual([HOME, COORDINATOR_DESK_ACKNOWLEDGER_ID]);
  });

  it("S2-15: records the stand-down against the acting role and refuses a different claim", () => {
    const { h, alertId } = withAlert();
    expect(
      h.send({ type: "STAND_DOWN_BROADCAST_ALERT", role: "bed_manager", alertId, stoodDownByRole: "coordinator" }),
    ).toMatch(/cannot be recorded as stood down by coordinator/);
    h.ok({ type: "STAND_DOWN_BROADCAST_ALERT", role: "bed_manager", alertId });
    expect(h.state.broadcastAlerts.at(-1)!.stoodDownBy).toBe("bed_manager");
  });

  it("S2-15: the Alerts screen passes the viewer's role, not a fixed coordinator", () => {
    const source = readFileSync("src/components/ward-management/alerts/alerts-screen.tsx", "utf8");
    expect(source).not.toMatch(/stoodDownByRole:\s*"coordinator"/);
    expect(source).toMatch(/type: "STAND_DOWN_BROADCAST_ALERT",\s*role: viewerRole/);
  });
});

describe("A1-2: only the referrer or the coordinator withdraws a referral", () => {
  it("needs the ED to name itself as the movement's origin department", () => {
    const h = harness();
    const movementId = referredMovement(h, "SYN-SCOPE-050");
    expect(h.send({ type: "WITHDRAW_REFERRAL", role: "ed", movementId })).toMatch(/must state its actingPlaceId/);
    expect(h.send({ type: "WITHDRAW_REFERRAL", role: "ed", movementId, actingPlaceId: "rph-ed" })).toMatch(
      /cannot withdraw movement/,
    );
    expect(h.send({ type: "WITHDRAW_REFERRAL", role: "community", movementId })).toMatch(
      /not referred by a community service/,
    );
    expect(h.send({ type: "WITHDRAW_REFERRAL", role: "ward", movementId, actingUnitId: HOME })).toMatch(
      /cannot withdraw this referral/,
    );
    expect(h.state.movements.find((m) => m.id === movementId)!.closure).toBeUndefined();
    h.ok({ type: "WITHDRAW_REFERRAL", role: "ed", movementId, actingPlaceId: "jhc-ed" });
    expect(h.state.movements.find((m) => m.id === movementId)!.closure?.reason).toBe(
      "The referrer withdrew the referral",
    );
  });

  it("says the coordinator withdrew it when the coordinator did", () => {
    const h = harness();
    const movementId = referredMovement(h, "SYN-SCOPE-051");
    h.ok({ type: "WITHDRAW_REFERRAL", role: "coordinator", movementId });
    expect(h.state.movements.find((m) => m.id === movementId)!.closure?.reason).toBe(
      "The coordinator withdrew the referral",
    );
  });
});

describe("A1-5: the written legal form and its expiry", () => {
  it("is refused to a ward or community caller", () => {
    expect(EVENT_ROLE.RECORD_LEGAL_FORM_WRITTEN).toEqual(["ed", "coordinator"]);
    const h = harness();
    const movementId = referredMovement(h, "SYN-SCOPE-060");
    expect(
      h.send({
        type: "RECORD_LEGAL_FORM_WRITTEN",
        role: "ward",
        movementId,
        formCode: "1A",
        writtenAt: 600,
        paperExpiresAt: 651,
      }),
    ).toMatch(/requires role ed or coordinator/);
    expect(h.state.movements.find((m) => m.id === movementId)!.legalForm?.dueAt).toBeUndefined();
  });

  it("audits every change with the old and new expiry", () => {
    const h = harness();
    const movementId = referredMovement(h, "SYN-SCOPE-061");
    h.ok({
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "ed",
      movementId,
      formCode: "1A",
      writtenAt: 600,
      paperExpiresAt: 1645,
    });
    expect(h.state.auditEvents.at(-1)).toMatchObject({
      action: "RECORD_LEGAL_FORM_WRITTEN",
      outcome: "accepted",
      details: { operation: "written-recorded", previousDueAt: null, dueAt: 1645 },
    });
    h.ok({
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "coordinator",
      movementId,
      formCode: "1A",
      writtenAt: 600,
      paperExpiresAt: 651,
    });
    expect(h.state.auditEvents.at(-1)).toMatchObject({
      action: "RECORD_LEGAL_FORM_WRITTEN",
      details: { previousDueAt: 1645, dueAt: 651 },
    });
    expect(h.state.movements.find((m) => m.id === movementId)!.legalFormExpiryHistory?.map((e) => e.dueAt)).toEqual([
      1645, 651,
    ]);
  });

  // Codex on #268: the written-form audit row kept only selectable codes, so an accepted
  // continuation form was audited with no code (A1-4's rule, applied to this branch too).
  it("keeps a continuation form's code in the audit row", () => {
    const h = harness();
    const movementId = referredMovement(h, "SYN-SCOPE-062");
    const refusal = h.send({
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "coordinator",
      movementId,
      formCode: "5B",
      writtenAt: 600,
      paperExpiresAt: 1645,
    });
    expect(refusal, "fixture premise: the reducer accepts a 5B written form").toBeNull();
    expect(h.state.auditEvents.at(-1)).toMatchObject({
      action: "RECORD_LEGAL_FORM_WRITTEN",
      details: { operation: "written-recorded", formCode: "5B" },
    });
  });
});

describe("A1-9: the medical workup is recorded by the ED or the coordinator only", () => {
  it("refuses a community or ward caller", () => {
    expect(EVENT_ROLE.RECORD_MOVEMENT_MEDICAL_CLEARANCE).toEqual(["ed", "coordinator"]);
    const h = harness();
    const movementId = referredMovement(h, "SYN-SCOPE-070");
    expect(h.send({ type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE", role: "community", movementId, cleared: true })).toMatch(
      /requires role/,
    );
  });
});

describe("A1-14: only the sending side or the coordinator corrects a referral", () => {
  it("refuses an ED correcting a community referral", () => {
    const h = harness();
    const referral = wardReferral(h);
    expect(
      h.send({ type: "ADD_REFERRAL_CORRECTION", role: "ed", referralId: referral.id, note: "Synthetic note" }),
    ).toMatch(/sent by the community side, so role ed cannot correct it/);
    h.ok({ type: "ADD_REFERRAL_CORRECTION", role: "community", referralId: referral.id, note: "Synthetic note" });
    h.ok({ type: "ADD_REFERRAL_CORRECTION", role: "coordinator", referralId: referral.id, note: "Synthetic note" });
  });
});

describe("A1-7: a ward's own referral is recorded as from that ward", () => {
  it("raises as the ward, and only that ward withdraws or corrects it", () => {
    const h = harness();
    const origin = "kep-adult-open";
    const realOrigin = h.state.units.find((u) => u.id === origin)
      ? origin
      : h.state.units.find((u) => u.id !== HOME)!.id;
    expect(() => wardReferral(h, { role: "ward", source: "community", actingUnitId: realOrigin })).toThrow(
      /role ward must carry source psychiatric_ward/,
    );
    expect(() =>
      wardReferral(h, { role: "ward", source: "psychiatric_ward", originUnitId: realOrigin, actingUnitId: HOME }),
    ).toThrow(/cannot raise a referral/);
    const referral = wardReferral(h, {
      role: "ward",
      source: "psychiatric_ward",
      originUnitId: realOrigin,
      actingUnitId: realOrigin,
    });
    expect(referral.source).toBe("psychiatric_ward");
    expect(referralSenderRole(referral)).toBe("ward");
    expect(h.send({ type: "RECORD_REFERRER_WITHDRAWAL", role: "community", referralId: referral.id })).toMatch(
      /sent by the sending ward/,
    );
    expect(
      h.send({ type: "ADD_REFERRAL_CORRECTION", role: "ward", actingUnitId: HOME, referralId: referral.id, note: "x" }),
    ).toMatch(/cannot correct this referral/);
    h.ok({
      type: "ADD_REFERRAL_CORRECTION",
      role: "ward",
      actingUnitId: realOrigin,
      referralId: referral.id,
      note: "x",
    });
    h.ok({ type: "RECORD_REFERRER_WITHDRAWAL", role: "ward", actingUnitId: realOrigin, referralId: referral.id });
  });

  it("the ward screen raises its referral as the ward, naming itself", () => {
    const source = readFileSync("src/components/ward-management/ward/ward-screen.tsx", "utf8");
    expect(source).toMatch(/type: "RECEIVE_REFERRAL",\s*role: "ward",\s*actingUnitId: unit\.id/);
  });
});

describe("A1-15: the coordinator cockpit acts as the coordinator", () => {
  it("dispatches no event as a ward", () => {
    const source = readFileSync("src/components/ward-management/patients/patient-transit-operations.tsx", "utf8");
    expect(source).not.toMatch(/role: "ward"/);
  });
});

describe("Undo and bed placement follow the same ward scoping", () => {
  it("refuses another ward undoing an acceptance", () => {
    const h = harness();
    const movementId = referredMovement(h, "SYN-SCOPE-080");
    h.ok({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId, unitId: HOME, actingUnitId: HOME });
    expect(h.send({ type: "UNDO_ACCEPT_IN_PRINCIPLE", role: "ward", movementId, actingUnitId: OTHER })).toMatch(
      /Only the ward that made this decision/,
    );
    expect(h.send({ type: "UNDO_ACCEPT_IN_PRINCIPLE", role: "ward", movementId })).toMatch(
      /Only the ward that made this decision/,
    );
    expect(h.state.auditEvents.at(-1)).toMatchObject({ reasonCode: "scope" });
    h.ok({ type: "UNDO_ACCEPT_IN_PRINCIPLE", role: "ward", movementId, actingUnitId: HOME });
  });

  it("refuses another ward undoing a referral decision it did not make", () => {
    const h = harness();
    const referral = wardReferral(h);
    h.ok({
      type: "DECLINE_REFERRAL",
      role: "ward",
      referralId: referral.id,
      destinationKind: "psychiatric_ward",
      unitId: HOME,
      actingUnitId: HOME,
      reason: "no_suitable_bed",
    });
    expect(
      h.send({ type: "UNDO_REFERRAL_DECISION", role: "ward", referralId: referral.id, actingUnitId: OTHER }),
    ).toMatch(/Only the ward that made this decision/);
    h.ok({ type: "UNDO_REFERRAL_DECISION", role: "ward", referralId: referral.id, actingUnitId: HOME });
  });

  it("refuses a ward placing another ward's stay in a bed", () => {
    const h = harness();
    const stay = h.state.admissions.find((a) => a.state === "occupied" && a.unitId === HOME)!;
    expect(
      h.send({ type: "PLACE_IN_BED", role: "ward", admissionId: stay.id, bedNumber: 1, actingUnitId: OTHER }),
    ).toMatch(/only move patients between its own beds/);
  });
});
