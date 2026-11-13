import { describe, expect, it } from "vitest";
import { buildCensus } from "@/components/ward-management/search/patient-census";
import { matchesWait } from "@/components/ward-management/search/search-filters";
import { questionFor } from "@/components/ward-management/search/search-answers";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { CANCEL_TRANSPORT_REASONS } from "@/components/ward-management/ward-change-reasons";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";

const now = 4000;
function census(state: ReturnType<typeof seedWardFlowState>) {
  return buildCensus({
    ...state,
    now,
    thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
    dayZero: new Date("2026-10-01T00:00:00+08:00"),
  });
}
function occupiedFixture(): ReturnType<typeof seedWardFlowState> {
  const seed = seedWardFlowState();
  const stay = seed.admissions.find((a) => a.state === "occupied" && a.patientId !== null)!;
  return {
    ...seed,
    movements: [],
    referrals: [],
    admissions: [stay],
    patients: seed.patients.filter((p) => p.id === stay.patientId),
  };
}
describe("consolidated census contracts", () => {
  it("retains a new accepted referral after an unrelated historical stay", () => {
    const state = occupiedFixture();
    const template = seedWardFlowState().referrals.find((r) =>
      r.destinations.some((d) => d.destination.kind === "psychiatric_ward"),
    )!;
    const destination = template.destinations.find((d) => d.destination.kind === "psychiatric_ward")!;
    state.admissions[0] = { ...state.admissions[0]!, state: "departed", referralId: "earlier-episode" };
    state.referrals = [
      {
        ...template,
        id: "new-episode",
        patientId: state.patients[0]!.id,
        destinations: [{ ...destination, state: "accepted", acceptedUnitId: state.units[0]!.id }],
      },
    ];
    expect(census(state).rows.find((r) => r.key === "new-episode")?.group).toBe("found");
  });
  it("keeps the occupied location when a queued referral names another origin", () => {
    const state = occupiedFixture();
    const template = seedWardFlowState().referrals.find((r) => r.destinations.some((d) => d.state === "queued"))!;
    state.referrals = [{ ...template, patientId: state.patients[0]!.id }];
    const row = census(state).rows.find((r) => r.key === template.id)!;
    expect(row.where).toBe(state.units.find((u) => u.id === state.admissions[0]!.unitId)!.name);
    expect(row.timeline[0]?.text).toBe(
      `Referral raised at ${template.originSiteCode} ${template.source === "community" || /CMHT|Clinic/.test(template.originSiteCode ?? "") ? "Community" : "ED"}`,
    );
  });
  it("shows a source stay's ED absence on a pending return movement", () => {
    const state = occupiedFixture();
    const stay = { ...state.admissions[0]!, awayAtEmergencyDepartmentSince: now - 30 };
    state.admissions = [stay];
    state.movements = [
      {
        ...seedWardFlowState().movements[0]!,
        id: "WF-synthetic-return",
        patientId: state.patients[0]!.id,
        sourceAdmissionId: stay.id,
        stage: "placement_requested",
        closure: undefined,
        transport: undefined,
      },
    ];
    const row = census(state).rows.find((r) => r.key === "WF-synthetic-return")!;
    expect(row.where).toBe("At ED");
    expect(row.awayAtEd).toBe(true);
  });
  it("keeps held-bed context separate from recorded leave whereabouts", () => {
    const state = occupiedFixture();
    const stay = state.admissions[0]!;
    const template = seedWardFlowState().leaveBeds[0]!;
    state.leaveBeds = [{ ...template, admissionId: stay.id, absentWithoutLeave: undefined }];
    const row = census(state).rows.find((r) => r.kind === "admission")!;
    expect(row.where).toBe("On leave");
    expect(row.whereSub).toContain("bed kept");
    expect(row.onLeave).toBe(true);
  });
  it("keeps cancelled transport in the unbooked answer despite a different next-step label", () => {
    let state = seedWardFlowState();
    const template = state.movements.find((m) => m.transport && m.acceptedUnitId)!;
    state.movements = [
      {
        ...template,
        stage: "pulled",
        closure: undefined,
        pullExpiresAt: now + 120,
        transportNeed: { needed: true, at: now - 30 },
        transport: { ...template.transport!, collectedAt: undefined, arrivedAt: undefined, cancelledAt: undefined },
      },
    ];
    state = wardFlowReducer(state, {
      type: "CANCEL_TRANSPORT",
      role: "coordinator",
      now,
      movementId: template.id,
      reason: CANCEL_TRANSPORT_REASONS[0],
    });
    expect(state.rejections).toEqual([]);
    expect(state.movements[0]!.transport).toBeUndefined();
    const row = census(state).rows.find((r) => r.key === template.id)!;
    expect(row.next).not.toBe("Book transport");
    expect(row.transportNotBooked).toBe(true);
    expect(questionFor("transport not booked")?.test(row)).toBe(true);
  });
  it("says expected today for a discharge time on the same day", () => {
    const state = occupiedFixture();
    state.admissions[0] = { ...state.admissions[0]!, expectedDischargeAt: now + 15 };
    expect(census(state).rows.find((r) => r.kind === "admission")?.to).toContain("today");
  });
  it("uses referral raised time for the assistive wait band", () => {
    const referral = { ...seedWardFlowState().referrals[0]!, raisedAt: now - 1500 };
    expect(matchesWait({ kind: "referral", referral }, "over24", now)).toBe(true);
    expect(matchesWait({ kind: "referral", referral }, "under6", now)).toBe(false);
  });
  it("requires an actual reservation for the reserved-bed question", () => {
    const accepted = census(seedWardFlowState()).rows.find((r) => r.group === "found")!;
    expect(questionFor("bed reserved")?.test({ ...accepted, group: "found", bedReserved: false })).toBe(false);
    expect(questionFor("bed reserved")?.test({ ...accepted, group: "found", bedReserved: true })).toBe(true);
  });
});

import { unitReadyBedCount, searchWardFlow } from "@/components/ward-management/search/ward-smart-search";
import { movementInHandoverScope } from "@/components/ward-management/handover/handover-scope-rules";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import { meetingActionInboxId } from "@/components/ward-management/bed-meeting/bed-meeting-actions";
describe("consolidated capacity and scope joins", () => {
  it("subtracts reservations after a ward reconfirms all its empty beds as offered", () => {
    const seed = seedWardFlowState();
    const unit = {
      ...seed.units[0]!,
      isClosed: false,
      closedBeds: [],
      allocatable: { ...seed.units[0]!.allocatable, value: 2 },
      empty: { ...seed.units[0]!.empty, value: 2 },
    };
    const admissions = [
      { ...seed.admissions[0]!, state: "pulled" as const, unitId: unit.id, movementId: "WF-live-pull" as const },
    ];
    expect(unitReadyBedCount(unit, admissions, [])).toBe(1);
    const results = searchWardFlow({ query: "ready beds", units: [unit], movements: [], patients: [], admissions });
    expect(results.wards[0]?.readyBeds).toBe(1);
  });
  it("keeps outgoing ward journeys in the sending-ward handover", () => {
    const seed = seedWardFlowState();
    const source = seed.admissions[0]!;
    const movement = {
      ...seed.movements[0]!,
      sourceAdmissionId: source.id,
      referredUnitIds: [],
      acceptedUnitId: undefined,
      referralId: undefined,
    };
    expect(movementInHandoverScope(movement, { kind: "ward", id: source.unitId }, seed.units, [], [source])).toBe(true);
    expect(movementInHandoverScope(movement, { kind: "ward", id: "unrelated-ward" }, seed.units, [], [source])).toBe(
      false,
    );
  });
  it("preserves permitted meeting metadata and excludes metadata for other stays", () => {
    const state = occupiedFixture();
    const subject = { kind: "admission" as const, id: state.admissions[0]!.id };
    const allowedId = meetingActionInboxId(subject, "book_transport");
    const deniedId = meetingActionInboxId({ kind: "admission", id: "outside-stay" }, "book_transport");
    const snooze = [
      { at: now, by: "coordinator", kind: "snoozed" as const, until: now + 10, reason: "awaiting_call_back" as const },
    ];
    state.inboxSnoozes = { [allowedId]: snooze, [deniedId]: snooze };
    const projected = scopeWardFlowState(
      state,
      { role: "ward", scope: { kind: "ward", unitIds: [state.admissions[0]!.unitId] } },
      { now, places: wardPlaceLookup(state.units) },
    ).state;
    expect(projected.inboxSnoozes[allowedId]).toEqual(snooze);
    expect(projected.inboxSnoozes[deniedId]).toBeUndefined();
  });
});

describe("consistent exact record-number matching", () => {
  it("finds a queued referral from a spaced exact UMRN", () => {
    const seed = seedWardFlowState();
    const patient = seed.patients[0]!;
    const referral = {
      ...seed.referrals.find((r) => r.destinations.some((d) => d.state === "queued"))!,
      patientId: patient.id,
    };
    const query = `${patient.umrn.slice(0, 2)} ${patient.umrn.slice(2)}`;
    const results = searchWardFlow({
      query,
      units: seed.units,
      movements: [],
      referrals: [referral],
      patients: [patient],
    });
    expect(results.referrals.some((row) => row.referral.id === referral.id)).toBe(true);
  });
});
