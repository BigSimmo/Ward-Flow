import { describe, expect, it } from "vitest";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { referralWithdrawn } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  applyStepUndo,
  diffForStepUndo,
  stepChangedSince,
  type StepUndo,
} from "@/components/ward-management/ward-undo";

/**
 * Audit 2 (20 Oct 2026): recorded times are never rewritten, and records say what happened.
 * E-11, E-12, E-13, E-15 and E-16 (Josh's decision 5). Synthetic seed data only.
 */
function send(state: WardFlowState, now: number, event: Record<string, unknown>) {
  const next = wardFlowReducer(state, { now, ...event } as WardFlowEvent);
  const refused = next.rejections.length > state.rejections.length;
  return { next, refused, reason: refused ? (next.rejections.at(-1)?.reason ?? "") : "" };
}

describe("E-11: making a vacated bed ready keeps the departure time", () => {
  it("leaves a discharged release's confirmedAt alone", () => {
    let state = seedWardFlowState();
    const stay = state.admissions.find(
      (admission) =>
        admission.state === "occupied" && !state.bedReleases.some((release) => release.admissionId === admission.id),
    )!;
    state = send(state, NOW_ANCHOR, {
      type: "RECORD_LEAVING",
      role: "ward",
      admissionId: stay.id,
      actingUnitId: stay.unitId,
      leavingDestination: LEAVING_DESTINATIONS[0].id,
    }).next;
    const release = state.bedReleases.find((candidate) => candidate.admissionId === stay.id)!;
    expect(release.state).toBe("discharged");
    const departedAt = release.confirmedAt;
    for (const [offset, preparing] of [
      [95, true],
      [135, false],
    ] as const) {
      const step = send(state, NOW_ANCHOR + offset, {
        type: "SET_BED_PREPARATION",
        role: "ward",
        releaseId: release.id,
        actingUnitId: release.unitId,
        preparing,
      });
      expect(step.refused).toBe(false);
      state = step.next;
    }
    expect(state.bedReleases.find((candidate) => candidate.id === release.id)!.confirmedAt).toBe(departedAt);
  });
});

describe("E-12: a withdrawn referral reads as withdrawn", () => {
  it("is withdrawn once the referrer withdraws it, and not before", () => {
    const seeded = seedWardFlowState();
    const referral = seeded.referrals.find((candidate) => candidate.id === "RF-RD06")!;
    expect(referralWithdrawn(referral)).toBe(false);
    const step = send(seeded, NOW_ANCHOR, {
      type: "RECORD_REFERRER_WITHDRAWAL",
      role: "coordinator",
      referralId: "RF-RD06",
      reason: "referred_in_error",
    });
    expect(step.refused).toBe(false);
    expect(referralWithdrawn(step.next.referrals.find((candidate) => candidate.id === "RF-RD06")!)).toBe(true);
  });
});

describe("E-13: arrival details need an accepting ward and keep the hold timer", () => {
  it("refuses arrival details before any ward accepts", () => {
    const seeded = seedWardFlowState();
    const unaccepted = seeded.movements.find((movement) => !movement.closure && movement.acceptedUnitId === undefined)!;
    const step = send(seeded, NOW_ANCHOR, {
      type: "SET_ARRIVAL_DETAILS",
      role: "coordinator",
      movementId: unaccepted.id,
      arrivalMode: "self",
      estimatedArrivalAt: NOW_ANCHOR + 30,
    });
    expect(step.refused).toBe(true);
    expect(step.reason).toMatch(/once a ward has accepted/);
  });

  it("keeps pullExpiresAt when arrival details are recorded for a held bed", () => {
    const seeded = seedWardFlowState();
    const held = seeded.movements.find(
      (movement) => !movement.closure && movement.stage === "pulled" && movement.pullExpiresAt !== undefined,
    )!;
    const step = send(seeded, NOW_ANCHOR, {
      type: "SET_ARRIVAL_DETAILS",
      role: "coordinator",
      movementId: held.id,
      arrivalMode: "self",
      estimatedArrivalAt: NOW_ANCHOR + 30,
    });
    expect(step.refused).toBe(false);
    expect(step.next.movements.find((movement) => movement.id === held.id)!.pullExpiresAt).toBe(held.pullExpiresAt);
  });
});

describe("E-15 and E-16: legal form records keep their history", () => {
  const start = () => {
    const seeded = seedWardFlowState();
    const movement = seeded.movements.find((candidate) => !candidate.closure)!;
    const fiveA = send(seeded, NOW_ANCHOR, {
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "coordinator",
      movementId: movement.id,
      formCode: "5A",
      writtenAt: NOW_ANCHOR - 60,
    });
    expect(fiveA.refused).toBe(false);
    return { state: fiveA.next, id: movement.id };
  };
  const form = (state: WardFlowState, id: string) =>
    state.movements.find((candidate) => candidate.id === id)!.legalForm!;

  it("refuses the same 5B twice and keeps an earlier 5B when a later one is recorded", () => {
    const { state, id } = start();
    const first = send(state, NOW_ANCHOR + 10, {
      type: "RECORD_LEGAL_FORM_CONTINUATION",
      role: "coordinator",
      movementId: id,
      formCode: "5B",
      startedAt: NOW_ANCHOR,
    });
    expect(first.refused).toBe(false);
    const recorded = form(first.next, id).continuedBy!;

    const again = send(first.next, NOW_ANCHOR + 20, {
      type: "RECORD_LEGAL_FORM_CONTINUATION",
      role: "coordinator",
      movementId: id,
      formCode: "5B",
      startedAt: NOW_ANCHOR,
    });
    expect(again.refused).toBe(true);
    expect(form(again.next, id).continuedBy).toEqual(recorded);

    const later = send(first.next, NOW_ANCHOR + 200, {
      type: "RECORD_LEGAL_FORM_CONTINUATION",
      role: "coordinator",
      movementId: id,
      formCode: "5B",
      startedAt: NOW_ANCHOR + 150,
    });
    expect(later.refused).toBe(false);
    expect(form(later.next, id).earlierContinuations).toEqual([recorded]);
    expect(form(later.next, id).continuedBy?.startedAt).toBe(NOW_ANCHOR + 150);
  });

  it("keeps a replaced form as history and computes no expiry", () => {
    const { state, id } = start();
    const before = state.movements.find((candidate) => candidate.id === id)!;
    const replaced = send(state, NOW_ANCHOR + 300, {
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "coordinator",
      movementId: id,
      formCode: "1A",
      writtenAt: NOW_ANCHOR + 290,
    });
    expect(replaced.refused).toBe(false);
    const current = form(replaced.next, id);
    expect(current.code).toBe("1A");
    expect(current.dueAt).toBeUndefined();
    // Whatever the seed held before the 5A stays first; the 5A is added after it.
    expect(current.earlierForms).toHaveLength((before.legalForm?.earlierForms?.length ?? 0) + 1);
    const earlier = current.earlierForms!.at(-1)!;
    expect(earlier).toMatchObject({ code: "5A", writtenAt: before.formedAt, at: NOW_ANCHOR + 300, by: "coordinator" });
    expect(earlier.dueAt).toBe(before.legalForm?.dueAt);
  });
});

describe("undo of a step that created a list", () => {
  const x = { id: "x", subject: "A" };
  const y = { id: "y", subject: "B" };

  it("removes the list when the undo empties it", () => {
    const before = { movements: [] as unknown[] };
    const after = { ...before, supportNotifications: [x] };
    const record = { changes: diffForStepUndo(before, after) } as StepUndo;
    expect(applyStepUndo(after, record)).toEqual(before);
  });

  it("is not blocked by another subject's row added later, and keeps that row", () => {
    const before = { movements: [] as unknown[] };
    const afterA = { ...before, supportNotifications: [x] };
    const record = { changes: diffForStepUndo(before, afterA) } as StepUndo;
    const afterB = { ...afterA, supportNotifications: [x, y] };
    expect(stepChangedSince(afterB, record)).toBe(false);
    expect(applyStepUndo(afterB, record)).toEqual({ movements: [], supportNotifications: [y] });
  });
});
