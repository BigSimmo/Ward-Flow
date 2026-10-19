import { describe, expect, it } from "vitest";

import { pointedAtWard, wardClosedLine, wardReopeningDue } from "@/components/ward-management/capacity/ward-closure";
import { shortlistCandidates } from "@/components/ward-management/ward-derivations-shortlist";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardClosureReason } from "@/components/ward-management/capacity/ward-closure";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function setup() {
  const state = seedWardFlowState();
  const unit = state.units[0]!;
  return { state, unitId: unit.id };
}

const close = (state: WardFlowState, unitId: string, extra: { until?: number; reason?: string } = {}) =>
  wardFlowReducer(state, {
    type: "CLOSE_WARD_TO_ADMISSIONS",
    role: "coordinator",
    now: NOW,
    unitId,
    reason: (extra.reason ?? "infection_outbreak") as WardClosureReason,
    ...(extra.until !== undefined ? { until: extra.until } : {}),
  });

const unitOf = (state: WardFlowState, unitId: string) => state.units.find((unit) => unit.id === unitId)!;

describe("CLOSE_WARD_TO_ADMISSIONS and REOPEN_WARD_TO_ADMISSIONS", () => {
  it("closes a ward with a listed reason, moves no bed counts, and reopens only when a person asks", () => {
    const { state, unitId } = setup();
    const before = unitOf(state, unitId);
    const closed = close(state, unitId, { until: NOW + 240 });
    expect(closed.rejections).toEqual([]);
    const unit = unitOf(closed, unitId);
    expect(unit.isClosed).toBe(true);
    expect(unit.admissionsClosure).toEqual({
      reason: "infection_outbreak",
      at: NOW,
      by: expect.any(String),
      until: NOW + 240,
    });
    expect(unit.allocatable.value).toBe(before.allocatable.value);
    expect(unit.empty.value).toBe(before.empty.value);
    expect(wardClosedLine(unit)).toBe("Closed to admissions · Infection outbreak");

    // The expected time only prompts; the ward stays closed past it.
    expect(wardReopeningDue(unit, NOW + 239)).toBe(false);
    expect(wardReopeningDue(unit, NOW + 240)).toBe(true);

    expect(close(closed, unitId).rejections).toHaveLength(1);
    const reopened = wardFlowReducer(closed, {
      type: "REOPEN_WARD_TO_ADMISSIONS",
      role: "coordinator",
      now: NOW + 300,
      unitId,
    });
    expect(reopened.rejections).toEqual([]);
    expect(unitOf(reopened, unitId).isClosed).toBe(false);
    expect(unitOf(reopened, unitId).admissionsClosure).toBeUndefined();
    expect(wardClosedLine(unitOf(reopened, unitId))).toBeNull();
  });

  it("refuses an off-list reason, a reopening time in the past, another ward acting, and reopening an open ward", () => {
    const { state, unitId } = setup();
    expect(close(state, unitId, { reason: "typed words" }).rejections).toHaveLength(1);
    expect(close(state, unitId, { until: NOW }).rejections).toHaveLength(1);
    const otherWard = wardFlowReducer(state, {
      type: "CLOSE_WARD_TO_ADMISSIONS",
      role: "ward",
      now: NOW,
      unitId,
      actingUnitId: "some-other-ward",
      reason: "staffing",
    });
    expect(otherWard.rejections).toHaveLength(1);
    expect(unitOf(otherWard, unitId).isClosed).not.toBe(true);
    const ownWard = wardFlowReducer(state, {
      type: "CLOSE_WARD_TO_ADMISSIONS",
      role: "ward",
      now: NOW,
      unitId,
      actingUnitId: unitId,
      reason: "staffing",
    });
    expect(ownWard.rejections).toEqual([]);
    expect(
      wardFlowReducer(state, { type: "REOPEN_WARD_TO_ADMISSIONS", role: "coordinator", now: NOW, unitId }).rejections,
    ).toHaveLength(1);
    expect(
      wardFlowReducer(state, { type: "CLOSE_WARD_TO_ADMISSIONS", role: "ed", now: NOW, unitId, reason: "staffing" })
        .rejections,
    ).toHaveLength(1);
  });

  it("takes the ward off the shortlist, which already honours a closed ward", () => {
    const { state } = setup();
    const movement = state.movements.find((candidate) => !candidate.closure && candidate.stage !== "arrived")!;
    const offered = shortlistCandidates(movement, state.units, NOW).find((candidate) => candidate.verdict.eligible);
    expect(offered, "the seed offers an eligible ward").toBeDefined();
    const closed = close(state, offered!.unit.id);
    const after = shortlistCandidates(movement, closed.units, NOW).find(
      (candidate) => candidate.unit.id === offered!.unit.id,
    );
    expect(after?.verdict.eligible ?? false).toBe(false);
  });
});

describe("pointedAtWard", () => {
  it("lists open bed requests that asked or were accepted by the ward", () => {
    const { state } = setup();
    const asked = state.movements.find(
      (movement) => !movement.closure && movement.stage !== "arrived" && movement.referredUnitIds.length > 0,
    );
    expect(asked, "the seed has a request that asked a ward").toBeDefined();
    const unitId = asked!.referredUnitIds[0]!;
    const items = pointedAtWard(unitId, state.movements, state.referrals);
    expect(items).toContainEqual(expect.objectContaining({ kind: "bed_request", id: asked!.id }));
  });
});
