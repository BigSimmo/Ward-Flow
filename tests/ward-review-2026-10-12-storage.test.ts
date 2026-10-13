/**
 * Regression tests for the saving-and-loading findings (A2-3 to A2-15) of the 8 October 2026 review
 * (`docs/ward-flow/audit-2026-10-08-issue-list.md`). Synthetic data only.
 */
import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { eventCarriesTypedTextPayload } from "@/components/ward-management/ward-flow-persistence-classification";
import {
  changesSinceLastLook,
  parseLastLookSnapshot,
  takeLastLookSnapshot,
} from "@/components/ward-management/coordinator/since-last-look";

const now = 642;
type Json = Record<string, unknown>;

/** The stored form of a state: a JSON round trip, as browser storage and files produce. */
function stored(state: WardFlowState = seedWardFlowState()): WardFlowState {
  return JSON.parse(JSON.stringify(state));
}

function send(state: WardFlowState, event: Record<string, unknown>): { state: WardFlowState; refusal: string | null } {
  const before = state.rejections.length;
  const next = wardFlowReducer(state, { now, ...event } as WardFlowEvent);
  return { state: next, refusal: next.rejections.length === before ? null : next.rejections.at(-1)!.reason };
}

function occupiedAdmission(state: WardFlowState) {
  return state.admissions.find(
    (admission) =>
      admission.state === "occupied" &&
      admission.awayAtEmergencyDepartmentSince === null &&
      !state.leaveBeds.some((bed) => bed.admissionId === admission.id),
  )!;
}

describe("A2-3: safe-listed events cannot store caller text", () => {
  it("refuses a RECORD_LEAVE_BED kind that is not one of the two fixed kinds", () => {
    const seed = seedWardFlowState();
    const admission = occupiedAdmission(seed);
    const leave = {
      type: "RECORD_LEAVE_BED",
      role: "ward",
      unitId: admission.unitId,
      actingUnitId: admission.unitId,
      admissionId: admission.id,
      expectedReturn: now + 120,
    };
    const typed = send(seed, { ...leave, kind: "Synthetic typed note" });
    expect(typed.refusal).toMatch(/kind/);
    expect(typed.state.leaveBeds).toHaveLength(seed.leaveBeds.length);
    const fixed = send(seed, { ...leave, kind: "medical_trip" });
    expect(fixed.refusal).toBeNull();
    expect(fixed.state.leaveBeds.at(-1)!.kind).toBe("medical_trip");
  });

  it("refuses a step-down flag that is not a boolean", () => {
    const seed = seedWardFlowState();
    const admission = occupiedAdmission(seed);
    const event = { type: "SET_STEP_DOWN_CANDIDATE", role: "coordinator", admissionId: admission.id };
    const typed = send(seed, { ...event, stepDownCandidate: "Synthetic typed note" });
    expect(typed.refusal).toMatch(/stepDownCandidate/);
    expect(typed.state.admissions.find((a) => a.id === admission.id)!.stepDownCandidate).toBeUndefined();
    expect(send(seed, { ...event, stepDownCandidate: true }).refusal).toBeNull();
  });

  it("locks persistence for an off-list value on a safe-listed event", () => {
    const off = (event: Record<string, unknown>) =>
      eventCarriesTypedTextPayload({ role: "coordinator", now, ...event } as unknown as WardFlowEvent);
    expect(off({ type: "RECORD_LEAVE_BED", kind: "Synthetic typed note" })).toBe(true);
    expect(off({ type: "RECORD_LEAVE_BED", kind: "off_ward" })).toBe(false);
    expect(off({ type: "RECORD_LEAVE_BED" })).toBe(false);
    expect(off({ type: "RECORD_ED_OUTCOME", outcome: "Synthetic typed note" })).toBe(true);
    expect(off({ type: "RECORD_ED_OUTCOME", outcome: "for_discharge" })).toBe(false);
    expect(off({ type: "SET_STEP_DOWN_CANDIDATE", stepDownCandidate: "yes" })).toBe(true);
    expect(off({ type: "SET_STEP_DOWN_CANDIDATE", stepDownCandidate: false })).toBe(false);
    expect(off({ type: "STAND_DOWN_BROADCAST_ALERT", stoodDownByRole: "Synthetic name" })).toBe(true);
    expect(off({ type: "STAND_DOWN_BROADCAST_ALERT", stoodDownByRole: "executive" })).toBe(false);
    expect(off({ type: "CHANGE_LEGAL_STATUS", legalStatus: "Synthetic typed note" })).toBe(true);
    expect(off({ type: "CHANGE_LEGAL_STATUS", legalStatus: "Voluntary" })).toBe(false);
    expect(off({ type: "STEP_BACK_STAGE", to: "Synthetic typed note" })).toBe(true);
    expect(off({ type: "RECORD_EXAMINATION", outcome: "Synthetic typed note" })).toBe(true);
    expect(off({ type: "CHANGE_URGENCY", urgency: "Synthetic typed note" })).toBe(true);
    expect(off({ type: "CHANGE_URGENCY", urgency: 2 })).toBe(false);
  });
});

describe("A2-4: a null time loads only where the model allows one", () => {
  it("refuses a null legal due time and a null pull expiry", () => {
    const legal = stored();
    const movement = legal.movements.find((m) => m.legalForm?.dueAt !== undefined)!;
    (movement.legalForm as unknown as Json).dueAt = null;
    expect(isValidStoredWardFlowState(legal)).toBe(false);

    const pull = stored();
    (pull.movements.find((m) => m.pullExpiresAt !== undefined) as unknown as Json).pullExpiresAt = null;
    expect(isValidStoredWardFlowState(pull)).toBe(false);
  });

  it("still loads the admission and audit times the model types as nullable", () => {
    const state = stored();
    expect(state.admissions.some((admission) => admission.arrivedAt === null)).toBe(true);
    expect(isValidStoredWardFlowState(state)).toBe(true);
  });
});

describe("A2-5 / A2-13: closed-list fields are checked against their constants on load", () => {
  const corruptions: [string, (state: WardFlowState) => void][] = [
    ["admission sex", (s) => ((s.admissions[0] as unknown as Json).sex = "Synthetic typed note")],
    ["admission home region", (s) => ((s.admissions[0] as unknown as Json).homeRegion = "Synthetic typed note")],
    ["movement legal status", (s) => ((s.movements[0] as unknown as Json).legalStatus = "Synthetic typed note")],
    [
      "closure outcome",
      (s) => ((s.movements.find((m) => m.closure)!.closure as unknown as Json).outcome = "Synthetic typed note"),
    ],
    [
      "examination outcome",
      (s) =>
        ((s.movements.find((m) => m.examination)!.examination as unknown as Json).outcome = "Synthetic typed note"),
    ],
    ["ED outcome", (s) => ((s.movements[0] as unknown as Json).edOutcome = "Synthetic typed note")],
    ["leave-bed kind", (s) => ((s.leaveBeds[0] as unknown as Json).kind = "Synthetic typed note")],
    ["bed-release waitingOn", (s) => ((s.bedReleases[0] as unknown as Json).waitingOn = "Synthetic typed note")],
    ["intake constraint", (s) => ((s.units[0] as unknown as Json).intakeConstraints = ["Synthetic typed note"])],
    ["referral age band", (s) => ((s.referrals[0] as unknown as Json).ageBand = "Synthetic typed note")],
    ["referral source", (s) => ((s.referrals[0] as unknown as Json).source = "Synthetic typed note")],
    ["referral home region", (s) => ((s.referrals[0] as unknown as Json).homeRegion = "Synthetic typed note")],
    ["referral site", (s) => ((s.referrals[0] as unknown as Json).originSiteCode = "Synthetic typed note")],
    [
      "destination sex",
      (s) =>
        ((
          s.referrals.flatMap((r) => r.destinations).find((d) => d.destination.kind === "psychiatric_ward")!
            .destination as unknown as Json
        ).sex = "Synthetic typed note"),
    ],
    [
      "destination unit",
      (s) =>
        ((
          s.referrals.flatMap((r) => r.destinations).find((d) => d.destination.kind === "psychiatric_ward")!
            .destination as unknown as Json
        ).unitId = "Synthetic typed note"),
    ],
    [
      "buzz message",
      (s) =>
        s.refreshRequests.push({
          unitId: s.units[0].id,
          at: now,
          byRole: "coordinator",
          message: "Synthetic typed note",
        }),
    ],
  ];
  it.each(corruptions)("refuses an off-list %s", (_label, corrupt) => {
    const state = stored();
    expect(isValidStoredWardFlowState(state)).toBe(true);
    corrupt(state);
    expect(isValidStoredWardFlowState(state)).toBe(false);
  });

  it("checks broadcast alerts against the model's constants", () => {
    const seed = seedWardFlowState();
    const dispatched = send(seed, {
      type: "DISPATCH_BROADCAST_ALERT",
      role: "coordinator",
      title: "Synthetic alert",
      message: "Synthetic message",
      severity: "warning",
      category: "ed_surge",
      targetScope: "all",
      targetScopeLabel: "All",
      durationMinutes: 60,
      dispatchedByName: "Synthetic coordinator",
    });
    expect(dispatched.refusal).toBeNull();
    const state = stored(dispatched.state);
    expect(isValidStoredWardFlowState(state)).toBe(true);
    (state.broadcastAlerts[0] as unknown as Json).category = "Synthetic typed note";
    expect(isValidStoredWardFlowState(state)).toBe(false);
  });
});

describe("A2-10: 'Since last look' does not compare across a reset or scenario load", () => {
  it("treats a picture from another world generation as no previous look", () => {
    const state = seedWardFlowState();
    const world = { ...state, worldGeneration: 0 };
    const before = takeLastLookSnapshot(world, now);
    const parsed = parseLastLookSnapshot(JSON.stringify(before))!;
    expect(changesSinceLastLook(parsed, takeLastLookSnapshot(world, now), world)).toBeDefined();
    const reset = { ...state, worldGeneration: 1 };
    expect(changesSinceLastLook(parsed, takeLastLookSnapshot(reset, now), reset)).toBeUndefined();
  });
});
