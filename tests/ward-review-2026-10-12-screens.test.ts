/**
 * Regression tests for the screen and audit findings of the 8 Oct 2026 core-engine review, fixed
 * 13 Oct 2026 (docs/ward-flow/audit-2026-10-08-core-engine-review.md). Each test fails on the
 * pre-fix derivations. Ward callers always name their own ward.
 */
import { describe, expect, it } from "vitest";

import { bedKindGaps } from "@/components/ward-management/capacity/capacity-derivations";
import { delayGroups, lastRecordedActivity } from "@/components/ward-management/delays/delays-derivations";
import { onHandover } from "@/components/ward-management/handover/handover-model";
import { TRANSPORT_WHEREABOUTS } from "@/components/ward-management/ward-change-reasons";
import {
  buildActionInbox,
  declinedByEveryReferredWard,
  handoverSnapshot,
  livePullExpiresAt,
} from "@/components/ward-management/ward-derivations";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { movementHasBedHold } from "@/components/ward-management/ward-movement-bed-hold";
import {
  decidedReferrals,
  referralQueueOrder,
  referralWithdrawable,
} from "@/components/ward-management/ward-referrals";

const now = 642;
type WithoutNow<T> = T extends unknown ? Omit<T, "now"> : never;
type TestEvent = WithoutNow<WardFlowEvent>;

function harness(initial: WardFlowState = seedWardFlowState()) {
  let state = initial;
  let t = now;
  const send = (event: TestEvent | Record<string, unknown>) => {
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
    get t() {
      return t;
    },
    send,
    ok,
  };
}
type H = ReturnType<typeof harness>;

const DRAFT = {
  cohort: "Adult",
  security: "Open",
  sex: "Female",
  gender: "Female",
  specialling: false,
  highAcuity: false,
  legalStatus: "Voluntary",
  urgency: 2,
  legalFormCode: null,
};

function raise(h: H, umrn: string) {
  h.ok({
    type: "ADD_PATIENT",
    role: "coordinator",
    umrn,
    givenName: "Demo",
    familyName: "Review",
    dateOfBirth: "1980-01-01",
  });
  const patient = h.state.patients.at(-1)!;
  h.ok({ type: "RAISE_REFERRAL", role: "ed", edId: "jhc-ed", patientId: patient.id, draft: DRAFT });
  return { patient, movement: h.state.movements.at(-1)! };
}
const mv = (h: H, id: string) => h.state.movements.find((m) => m.id === id)!;
const accept = (h: H, movementId: string, unitId: string) =>
  h.ok({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId, unitId, actingUnitId: unitId });
const pull = (h: H, movementId: string, unitId: string) =>
  h.ok({ type: "PULL_PATIENT", role: "ward", movementId, unitId, actingUnitId: unitId });

describe("review 2026-10-08 screen fixes", () => {
  it("A3-2: a collected patient is not shown as an expired bed pull", () => {
    const h = harness();
    const { movement } = raise(h, "SYN-SCR-001");
    h.ok({ type: "REFER_TO_UNITS", role: "coordinator", movementId: movement.id, unitIds: ["scgh-adult-open"] });
    accept(h, movement.id, "scgh-adult-open");
    pull(h, movement.id, "scgh-adult-open");
    const pulled = mv(h, movement.id);
    const collected = {
      ...pulled,
      stage: "moving" as const,
      transport: { ...(pulled.transport ?? {}), collectedAt: h.t },
    };
    expect(livePullExpiresAt(collected as typeof pulled)).toBeUndefined();
    const late = pulled.pullExpiresAt! + 60;
    const snapshot = handoverSnapshot([collected as typeof pulled], h.state.units, late);
    expect(snapshot.pulledBeds.filter((row) => row.expired)).toEqual([]);
  });

  it("A3-10: a bed still held after transport is stopped stays visible as held", () => {
    const h = harness();
    h.ok({
      type: "STOP_TRANSPORT",
      role: "coordinator",
      movementId: "WF-006",
      reason: "The referral was withdrawn",
      whereabouts: TRANSPORT_WHEREABOUTS[1],
    });
    const stopped = mv(h, "WF-006");
    expect(stopped.closure, "fixture premise: the journey is closed").toBeDefined();
    expect(
      h.send({ type: "RELEASE_HELD_BED", role: "coordinator", movementId: "WF-006" }),
      "premise: bed still held",
    ).toBeNull();
    // Judged on the state before the release above.
    expect(movementHasBedHold(stopped, h.state.admissions)).toBe(true);
    expect(onHandover(stopped)).toBe(true);
    expect(handoverSnapshot([stopped], h.state.units, h.t).pulledBeds.map((row) => row.movement.id)).toContain(
      "WF-006",
    );
  });

  it("A3-1: a pulled patient is not counted as still waiting for a bed", () => {
    const h = harness();
    const { movement } = raise(h, "SYN-SCR-002");
    h.ok({ type: "REFER_TO_UNITS", role: "coordinator", movementId: movement.id, unitIds: ["scgh-adult-open"] });
    accept(h, movement.id, "scgh-adult-open");
    const waitingBefore = bedKindGaps(h.state.movements, h.state.units, h.t).reduce((n, row) => n + row.waiting, 0);
    pull(h, movement.id, "scgh-adult-open");
    const waitingAfter = bedKindGaps(h.state.movements, h.state.units, h.t).reduce((n, row) => n + row.waiting, 0);
    expect(waitingAfter).toBe(waitingBefore - 1);
  });

  it("A3-8: a fully withdrawn referral moves to the decided list instead of vanishing", () => {
    const h = harness();
    const queued = h.state.referrals.find((r) =>
      r.destinations.every((d) => d.state === "queued" && d.withdrawnAt === undefined),
    )!;
    h.ok({ type: "RECORD_REFERRER_WITHDRAWAL", role: "coordinator", referralId: queued.id });
    const id = queued.id;
    expect(referralQueueOrder(h.state.referrals).map((r) => r.id)).not.toContain(id);
    expect(decidedReferrals(h.state.referrals).map((r) => r.id)).toContain(id);
  });

  it("A3-6 / A3-9: waitlist answers are not declines, so 'declined by all' needs real declines", () => {
    const h = harness();
    const { movement } = raise(h, "SYN-SCR-003");
    h.ok({ type: "REFER_TO_UNITS", role: "coordinator", movementId: movement.id, unitIds: ["scgh-adult-open"] });
    h.ok({
      type: "DECLINE",
      role: "ward",
      movementId: movement.id,
      unitId: "scgh-adult-open",
      actingUnitId: "scgh-adult-open",
      reason: "no_bed",
    });
    const m = mv(h, movement.id);
    expect(declinedByEveryReferredWard(m)).toBe(false);
    const inbox = buildActionInbox(h.state.movements, h.t, h.state.units);
    expect(JSON.stringify(inbox)).not.toMatch(new RegExp(`${movement.id} · \\d+ destinations have declined`));
  });

  it("A3-11: accepting and pulling count as recorded activity", () => {
    const h = harness();
    const { movement } = raise(h, "SYN-SCR-004");
    h.ok({ type: "REFER_TO_UNITS", role: "coordinator", movementId: movement.id, unitIds: ["scgh-adult-open"] });
    accept(h, movement.id, "scgh-adult-open");
    pull(h, movement.id, "scgh-adult-open");
    const latest = lastRecordedActivity(mv(h, movement.id), h.t + 600);
    expect(latest?.what).toBe("a bed was pulled");
  });

  it("A1-6: an audit row for a walk-in journey keeps the patient", () => {
    const h = harness();
    const walkIn = h.state.movements.find(
      (m) => m.referralId === undefined && m.patientId !== undefined && !m.closure,
    )!;
    h.ok({
      type: "CHANGE_LEGAL_STATUS",
      role: "coordinator",
      movementId: walkIn.id,
      legalStatus: walkIn.legalStatus === "Voluntary" ? "Involuntary" : "Voluntary",
      reason: "recorded_by_treating_team",
    });
    const row = h.state.auditEvents.at(-1) as unknown as { subject?: { kind?: string; patientId?: unknown } };
    expect(row.subject?.kind).toBe("movement");
    expect(row.subject?.patientId).toBeTruthy();
  });
  it("S2-14: Withdraw is not offered while a linked journey is already collected", () => {
    const h = harness();
    const referral = h.state.referrals.find((r) =>
      r.destinations.every((d) => d.state === "queued" && d.withdrawnAt === undefined),
    )!;
    const base = h.state.movements[0]!;
    const collected = {
      ...base,
      referralId: referral.id,
      closure: undefined,
      transport: { ...(base.transport ?? {}), collectedAt: now },
    };
    expect(referralWithdrawable(referral, [collected as typeof base])).toBe(false);
    expect(referralWithdrawable(referral, [])).toBe(true);
  });

  it("A3-12: a revoked-examination held bed is routed to the coordinator, not Transport", () => {
    const h = harness();
    h.ok({ type: "RECORD_EXAMINATION", role: "ed", movementId: "WF-005", outcome: "revoked" });
    const groups = delayGroups(h.state.movements, h.state.units, h.t);
    const causeOf = groups.find((g) => g.movements.some((m) => m.id === "WF-005"))?.cause;
    expect(causeOf).toBe("awaiting_coordinator");
  });
});
