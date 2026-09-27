import { describe, expect, it } from "vitest";
import { readAuditEvents, readAuditReviews, type AuditEvent } from "@/components/ward-management/ward-audit";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import {
  BED_RELEASE_BLOCKERS,
  BED_PREPARATION_NOTES,
  OVERRIDE_REASONS,
} from "@/components/ward-management/ward-change-reasons";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardRecordActor } from "@/components/ward-management/ward-discharge-records";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { COHORTS } from "@/components/ward-management/ward-model";
import { SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";

const coordinator = { role: "coordinator" } as const;
const legalEvent = {
  type: "CHANGE_LEGAL_STATUS",
  role: "coordinator",
  now: NOW_ANCHOR,
  movementId: "WF-009",
  legalStatus: "Voluntary",
  reason: "recorded_by_treating_team",
} as const;
function review(eventId: string, expectedReviewCount = 0): Extract<WardFlowEvent, { type: "REVIEW_AUDIT_EVENT" }> {
  return {
    type: "REVIEW_AUDIT_EVENT",
    role: "coordinator",
    now: NOW_ANCHOR,
    eventId,
    expectedGeneration: 0,
    expectedReviewCount,
    decision: "reviewed",
  };
}

describe("session audit capture and review", () => {
  it.each([
    { patch: { now: NaN }, reason: "invalid-payload" },
    { patch: { role: "ward" }, reason: "role" },
  ])("never attaches a replacement audit event when an earlier refusal wins: $reason", ({ patch, reason }) => {
    const first = wardFlowReducer(seedWardFlowState(), legalEvent);
    const oldReview = review(first.auditEvents[0].id);
    const reset = wardFlowReducer(first, { type: "RESET_SCENARIO", role: "demo", now: NOW_ANCHOR });
    const recreated = wardFlowReducer(reset, legalEvent);
    expect(recreated.auditEvents[0].id).toBe(oldReview.eventId);
    const refused = wardFlowReducer(recreated, { ...oldReview, ...patch } as WardFlowEvent);
    expect(refused.auditReviews).toBe(recreated.auditReviews);
    expect(refused.movements).toBe(recreated.movements);
    expect(refused.units).toBe(recreated.units);
    expect(refused.auditEvents.at(-1)).toMatchObject({
      outcome: "denied",
      reasonCode: reason,
      subject: { kind: "unresolved" },
    });
    if (reason === "invalid-payload") expect(refused.auditEvents.at(-1)?.at).toBeNull();
  });
  it("captures a selected legal form as initial capture and sanitizes an invalid selection", () => {
    const state = seedWardFlowState();
    const event: Extract<WardFlowEvent, { type: "RAISE_REFERRAL" }> = {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW_ANCHOR,
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Male",
        specialling: false,
        highAcuity: false,
        legalStatus: "Voluntary",
        urgency: 3,
        legalFormCode: SELECTABLE_LEGAL_FORMS[0].code,
      },
    };
    const next = wardFlowReducer(state, event);
    expect(next.auditEvents[0]).toMatchObject({
      category: "legal-form",
      outcome: "accepted",
      details: {
        operation: "initial-capture",
        formCode: SELECTABLE_LEGAL_FORMS[0].code,
      },
    });
    const invalid = wardFlowReducer(state, {
      ...event,
      draft: { ...event.draft, legalFormCode: "private-unlisted-code" },
    });
    expect(invalid.movements).toBe(state.movements);
    expect(invalid.auditEvents[0]).toMatchObject({
      category: "legal-form",
      outcome: "denied",
      details: { formCode: null },
    });
    expect(JSON.stringify(invalid.auditEvents)).not.toContain("private-unlisted-code");
  });

  it("records flag planning, confirmation, reversal and release facts on the anonymous lifecycle", () => {
    const state = seedWardFlowState();
    const unit = state.units[0];
    // A bed release names the occupant whose stay it belongs to: one with no live release yet.
    const occupant = state.admissions.find(
      (a) =>
        a.unitId === unit.id &&
        a.state === "occupied" &&
        !state.bedReleases.some((r) => r.admissionId === a.id && r.state !== "discharged"),
    );
    if (!occupant) throw new Error(`the seed has no occupant without a live release on ${unit.id}`);
    const flagged = wardFlowReducer(state, {
      type: "FLAG_BED_RELEASE",
      role: "ward",
      now: NOW_ANCHOR,
      unitId: unit.id,
      actingUnitId: unit.id,
      admissionId: occupant.id,
      expectedAt: NOW_ANCHOR + 60,
      waitingOn: "Nothing outstanding",
    });
    const release = flagged.bedReleases.at(-1)!;
    expect(flagged.auditEvents[0]).toMatchObject({
      subject: { kind: "bed-release", releaseId: release.id, unitId: unit.id },
      details: {
        before: null,
        requested: { expectedAt: NOW_ANCHOR + 60, waitingOn: "Nothing outstanding" },
        after: { state: "expected" },
      },
    });
    const confirmed = wardFlowReducer(flagged, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now: NOW_ANCHOR,
      releaseId: release.id,
      actingUnitId: unit.id,
    });
    const reverted = wardFlowReducer(confirmed, {
      type: "REVERT_BED_RELEASE",
      role: "ward",
      now: NOW_ANCHOR,
      releaseId: release.id,
      actingUnitId: unit.id,
      waitingOn: "Nothing outstanding",
    });
    // CHANGED 25 September 2026 (owner decision): RELEASE_BED refuses while the named person is
    // still in the bed; a release completes when the ward records that they have left. So the
    // lifecycle's last step is RECORD_LEAVING, audited as a departure, and the release's own
    // completion is checked on the release itself.
    const released = wardFlowReducer(reverted, {
      type: "RECORD_LEAVING",
      role: "ward",
      now: NOW_ANCHOR,
      admissionId: occupant.id,
      actingUnitId: unit.id,
      leavingDestination: "discharged-to-the-community",
    });
    expect(released.auditEvents.map((row) => row.outcome)).toEqual(["accepted", "accepted", "accepted", "accepted"]);
    expect(released.auditEvents.at(-1)).toMatchObject({
      category: "discharge",
      action: "RECORD_LEAVING",
      details: {
        kind: "departure",
        before: "occupied",
        after: "departed",
        requestedDestination: "discharged-to-the-community",
        recordedDestination: "discharged-to-the-community",
      },
    });
    expect(released.admissions.find((admission) => admission.id === occupant.id)).toMatchObject({
      state: "departed",
      leftAt: NOW_ANCHOR,
      leavingDestination: "discharged-to-the-community",
    });
    const completed = released.bedReleases.find((candidate) => candidate.id === release.id);
    expect(completed).toMatchObject({ state: "discharged", waitingOn: null, blocker: null, blockedBy: null });
    expect(completed).not.toHaveProperty("patientId");
  });
  it.each(["accepted", "partial", "denied"] as const)(
    "captures %s ordinary referral outcomes at each existing destination decision",
    (outcome) => {
      const state = seedWardFlowState();
      const movement = state.movements.find((row) => row.id === "WF-009")!;
      // T11 (item 8, owner answer 17 September 2026): fsh-adult-secure is the network's
      // Male-only bed, so gender must be recorded before referring to it, or the accepted case
      // sees an unwanted gender_designation denial and misreports as "partial". Matches WF-009's
      // own `sex`.
      movement.gender = "Male";
      const ids = ["rph-adult-secure", "fsh-adult-secure"];
      const differentCohort = COHORTS.find((cohort) => cohort !== movement.cohort)!;
      if (outcome === "partial" || outcome === "denied")
        state.units.find((unit) => unit.id === ids[1])!.cohort = differentCohort;
      if (outcome === "denied") state.units.find((unit) => unit.id === ids[0])!.cohort = differentCohort;
      const next = wardFlowReducer(state, {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        now: NOW_ANCHOR,
        movementId: movement.id,
        unitIds: ids,
      });
      expect(next.auditEvents).toHaveLength(1);
      const event = next.auditEvents[0];
      expect(event).toMatchObject({
        category: "referral",
        outcome,
        details: { reason: null, overrideFactRecorded: false },
      });
      if (event.category !== "referral") throw new Error("Ordinary referral incorrectly classified");
      expect(event.details.targets.map((target) => [target.unitId, target.outcome])).toEqual([
        [ids[0], outcome === "denied" ? "denied" : "accepted"],
        [ids[1], outcome === "accepted" ? "accepted" : "denied"],
      ]);
      expect(next.movements.find((row) => row.id === movement.id)?.referredUnitIds).toEqual(
        outcome === "accepted" ? ids : outcome === "partial" ? [ids[0]] : [],
      );
    },
  );
  it("does not synthesize audit or review rows from seeded historical facts", () => {
    const state = seedWardFlowState();
    expect(state.admissions.some((admission) => admission.state === "departed" && admission.leftAt !== null)).toBe(
      true,
    );
    expect(state.auditEvents).toEqual([]);
    expect(state.auditReviews).toEqual([]);
    expect(state.auditSequence).toBe(0);
    const next = wardFlowReducer(state, legalEvent);
    expect(next.auditEvents).toHaveLength(1);
    expect(next.auditEvents[0]).toMatchObject({
      id: "audit-1",
      sequence: 1,
      generation: 0,
      origin: "captured-this-session",
      outcome: "accepted",
      actor: { role: "coordinator", attribution: "declared-prototype-role" },
    });
  });

  it("appends administrative reviews without changing clinical records or the original event", () => {
    const state = wardFlowReducer(seedWardFlowState(), legalEvent);
    const original = structuredClone(state.auditEvents[0]);
    const first = wardFlowReducer(state, review("audit-1"));
    expect(first.auditReviews).toEqual([
      {
        id: "audit-review-1",
        eventId: "audit-1",
        generation: 0,
        at: NOW_ANCHOR,
        byRole: "coordinator",
        decision: "reviewed",
      },
    ]);
    const second = wardFlowReducer(first, { ...review("audit-1", 1), decision: "follow-up-required" });
    expect(second.auditReviews).toHaveLength(2);
    expect(second.auditEvents[0]).toEqual(original);
    expect(second.movements).toBe(state.movements);
    expect(second.units).toBe(state.units);
    expect(second.admissions).toBe(state.admissions);
    expect(second.bedReleases).toBe(state.bedReleases);
    expect(second.referrals).toBe(state.referrals);
    const stale = wardFlowReducer(second, review("audit-1", 1));
    expect(stale.auditReviews).toBe(second.auditReviews);
    expect(stale.auditEvents.at(-1)).toMatchObject({ category: "review", outcome: "stale", reasonCode: "revision" });
  });

  it.each([
    { role: "ward" },
    { role: "ed" },
    { role: "unknown-private-text" },
    { eventId: "missing-private-text" },
    { decision: "approve-private-text" },
    { expectedReviewCount: -1 },
    { expectedReviewCount: 0.5 },
    { expectedReviewCount: Infinity },
    { expectedGeneration: -1 },
    { now: NaN },
  ])("denies malformed or unauthorized review %j and never copies submitted text", (patch) => {
    const state = wardFlowReducer(seedWardFlowState(), legalEvent);
    const next = wardFlowReducer(state, { ...review("audit-1"), ...patch } as WardFlowEvent);
    expect(next.auditReviews).toEqual([]);
    expect(next.movements).toBe(state.movements);
    expect(next.auditEvents.at(-1)?.outcome).toBe("denied");
    expect(JSON.stringify(next.auditEvents)).not.toContain("private-text");
    expect(JSON.stringify(next.rejections)).not.toContain("private-text");
  });

  it("refuses duplicate subjects and review-of-review; reset cannot reuse an old review command", () => {
    const state = wardFlowReducer(seedWardFlowState(), legalEvent);
    const duplicate = { ...state, auditEvents: [...state.auditEvents, structuredClone(state.auditEvents[0])] };
    expect(wardFlowReducer(duplicate, review("audit-1")).auditReviews).toEqual([]);
    const reviewed = wardFlowReducer(state, review("audit-1"));
    const refused = wardFlowReducer(reviewed, review("audit-2"));
    expect(refused.auditReviews).toHaveLength(1);
    expect(refused.auditEvents.at(-1)?.outcome).toBe("denied");
    const reset = wardFlowReducer(reviewed, { type: "RESET_SCENARIO", role: "demo", now: NOW_ANCHOR });
    const recreated = wardFlowReducer(reset, legalEvent);
    expect(recreated.auditEvents[0].id).toBe("audit-1");
    const stale = wardFlowReducer(recreated, review("audit-1"));
    expect(stale.auditReviews).toEqual([]);
    expect(stale.auditEvents.at(-1)).toMatchObject({
      outcome: "stale",
      reasonCode: "generation",
      subject: { kind: "unresolved" },
    });
  });

  it("guards audit reads and detaches all nested data", () => {
    const state = wardFlowReducer(seedWardFlowState(), {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: "WF-009",
      unitIds: ["rph-adult-secure"],
      overrideReason: OVERRIDE_REASONS[0],
    });
    for (const actor of [
      { role: "ward", actingUnitId: "rph-adult-secure" },
      { role: "ed" },
      { role: "officer" },
      { role: "community" },
      { role: "demo" },
      { role: "unknown" },
      { role: "coordinator", actingUnitId: "extra" },
    ]) {
      expect(readAuditEvents(state, actor as WardRecordActor)).toEqual({ status: "denied" });
      expect(readAuditReviews(state, actor as WardRecordActor)).toEqual({ status: "denied" });
    }
    const events = readAuditEvents(state, coordinator);
    if (events.status !== "allowed") throw new Error("Coordinator denied");
    const snapshot = structuredClone(state.auditEvents);
    const row = events.value[0];
    row.actor.role = null;
    if (row.category !== "override") throw new Error("Expected override capture");
    row.details.targets[0].unitId = "mutated";
    row.subject.kind = "unresolved";
    expect(state.auditEvents).toEqual(snapshot);
    const reviewed = wardFlowReducer(state, review("audit-1"));
    const result = readAuditReviews(reviewed, coordinator);
    if (result.status !== "allowed") throw new Error("Coordinator denied");
    result.value[0].decision = "follow-up-required";
    expect(reviewed.auditReviews[0].decision).toBe("reviewed");
  });

  it("captures immutable blocker and preparation facts even when lifecycle state is unchanged", () => {
    const state = seedWardFlowState();
    const release = state.bedReleases.find((row) => row.state !== "discharged")!;
    const blocked = wardFlowReducer(state, {
      type: "BLOCK_BED_RELEASE",
      role: "ward",
      now: NOW_ANCHOR,
      releaseId: release.id,
      actingUnitId: release.unitId,
      blocker: BED_RELEASE_BLOCKERS[0],
    });
    const first = structuredClone(blocked.auditEvents[0]);
    expect(first).toMatchObject({
      outcome: "accepted",
      details: {
        kind: "bed-release",
        before: { state: release.state },
        after: { state: release.state, blocker: BED_RELEASE_BLOCKERS[0] },
        requested: { action: "BLOCK_BED_RELEASE", blocker: BED_RELEASE_BLOCKERS[0] },
      },
    });
    const cleared = wardFlowReducer(blocked, {
      type: "CLEAR_BED_RELEASE_BLOCK",
      role: "ward",
      now: NOW_ANCHOR,
      releaseId: release.id,
      actingUnitId: release.unitId,
    });
    const prepared = wardFlowReducer(cleared, {
      type: "SET_BED_PREPARATION",
      role: "ward",
      now: NOW_ANCHOR,
      releaseId: release.id,
      actingUnitId: release.unitId,
      preparing: true,
      note: BED_PREPARATION_NOTES[0],
    });
    expect(prepared.auditEvents[0]).toEqual(first);
    expect(prepared.auditEvents.at(-1)).toMatchObject({
      outcome: "accepted",
      details: {
        requested: { action: "SET_BED_PREPARATION", preparing: true, note: BED_PREPARATION_NOTES[0] },
        after: { preparing: true, preparationNote: BED_PREPARATION_NOTES[0] },
      },
    });
  });

  it("sanitizes malformed legacy enum values and time without changing legacy decisions", () => {
    const state = seedWardFlowState();
    const next = wardFlowReducer(state, {
      ...legalEvent,
      legalStatus: "secret-free-prose",
      now: NaN,
    } as unknown as WardFlowEvent);
    expect(next.movements.find((movement) => movement.id === "WF-009")?.legalStatus).toBe("secret-free-prose");
    expect(next.auditEvents[0]).toMatchObject({
      outcome: "accepted",
      at: null,
      details: { requested: null, after: null },
    });
    expect(JSON.stringify(next.auditEvents)).not.toContain("secret-free-prose");
  });

  it("distinguishes a recorded override fact from a supplied reason on acceptance and pull", () => {
    const state = seedWardFlowState();
    const referred = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: "WF-009",
      unitIds: ["rph-adult-secure"],
      overrideReason: OVERRIDE_REASONS[0],
    });
    expect(referred.auditEvents[0]).toMatchObject({ outcome: "accepted", details: { overrideFactRecorded: true } });
    const accepted = wardFlowReducer(referred, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW_ANCHOR,
      movementId: "WF-009",
      unitId: "rph-adult-secure",
      overrideReason: OVERRIDE_REASONS[0],
    });
    expect(accepted.auditEvents.at(-1)).toMatchObject({
      outcome: "accepted",
      details: { reason: OVERRIDE_REASONS[0], overrideFactRecorded: false },
    });
    // Fixture only: ensure the existing physical guards have resources; the test does not bypass them.
    const unit = accepted.units.find((row) => row.id === "rph-adult-secure")!;
    unit.allocatable.value = Math.max(1, unit.allocatable.value);
    const pulled = wardFlowReducer(accepted, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW_ANCHOR,
      movementId: "WF-009",
      unitId: unit.id,
      overrideReason: OVERRIDE_REASONS[0],
    });
    expect(pulled.auditEvents.at(-1)).toMatchObject({ outcome: "accepted", details: { overrideFactRecorded: false } });
    const recorded = pulled.auditEvents.at(-1) as AuditEvent;
    expect(recorded).not.toHaveProperty("bypassedGate");
  });
});
