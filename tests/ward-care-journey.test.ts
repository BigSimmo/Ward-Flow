import { describe, it, expect } from "vitest";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  validCareChange,
  validCareJourney,
  emptyCareJourney,
  separationHandoff,
  type CareChange,
  CARE_PLAN_ITEMS,
  CARE_DOCUMENTS,
} from "@/components/ward-management/ward-care-journey";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { selectDischargeRecord } from "@/components/ward-management/ward-discharge-records";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
function fixture() {
  const state = seedWardFlowState();
  const admission = state.admissions.find((a) => a.state === "occupied" && a.patientId)!;
  return { state, admission };
}
function command(state: WardFlowState, admissionId: string, change: CareChange, patch: object = {}) {
  const a = state.admissions.find((a) => a.id === admissionId)!;
  return {
    type: "RECORD_ADMISSION_CARE",
    role: "coordinator",
    now: NOW_ANCHOR,
    admissionId,
    patientId: a.patientId!,
    expectedGeneration: state.worldGeneration,
    expectedRevision: state.dischargeRevisions[admissionId] ?? 0,
    change,
    ...patch,
  } as WardFlowEvent;
}
const appointment: CareChange = {
  kind: "follow_up",
  contactId: "demo-adult-clinician",
  serviceId: COMMUNITY_TEAM_PAGES[0].id,
  appointmentAt: NOW_ANCHOR,
  mode: "telephone",
};
describe("complete guarded local care journey", () => {
  it("records responsibility, appointment and contact separately with persistence and audit", () => {
    const { state, admission } = fixture();
    const arranged = wardFlowReducer(state, command(state, admission.id, appointment));
    expect(arranged.rejections).toEqual([]);
    expect(arranged.admissions.find((a) => a.id === admission.id)?.followUp?.state).toBe("arranged");
    expect(arranged.units).toBe(state.units);
    const completed = wardFlowReducer(
      arranged,
      command(arranged, admission.id, { kind: "contact", outcome: "completed", contactedAt: NOW_ANCHOR }),
    );
    expect(completed.admissions.find((a) => a.id === admission.id)?.careJourney?.contacts.at(-1)?.outcome).toBe(
      "completed",
    );
    expect(completed.auditEvents.at(-1)).toMatchObject({
      outcome: "accepted",
      details: { kind: "care", operation: "contact" },
    });
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(completed)))).toBe(true);
  });
  it("cannot complete an unknown or future appointment", () => {
    const { state, admission } = fixture();
    const unknown = wardFlowReducer(
      state,
      command(state, admission.id, { kind: "contact", outcome: "completed", contactedAt: NOW_ANCHOR }),
    );
    expect(unknown.admissions).toBe(state.admissions);
    const future = wardFlowReducer(
      state,
      command(state, admission.id, { ...appointment, appointmentAt: NOW_ANCHOR + 1 }),
    );
    const completed = wardFlowReducer(
      future,
      command(future, admission.id, { kind: "contact", outcome: "completed", contactedAt: NOW_ANCHOR }),
    );
    expect(completed.admissions).toBe(future.admissions);
  });
  it.each(CARE_PLAN_ITEMS)("records %s planning with attribution, without changing beds", (item) => {
    const { state, admission } = fixture();
    const next = wardFlowReducer(state, command(state, admission.id, { kind: "plan", item, status: "completed" }));
    expect(next.rejections).toEqual([]);
    expect(next.units).toBe(state.units);
    expect(next.admissions.find((a) => a.id === admission.id)?.careJourney?.plan[item]).toMatchObject({
      status: "completed",
      recordedBy: "Flow coordinator",
    });
  });
  it.each(CARE_DOCUMENTS)("tracks adult %s documentation", (document) => {
    const { state, admission } = fixture();
    const next = wardFlowReducer(
      state,
      command(state, admission.id, { kind: "document", cohort: "adult", document, status: "in_progress" }),
    );
    expect(next.rejections).toEqual([]);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(next)))).toBe(true);
  });
  it("keeps CAMHS documentation separate and rejects adult-only forms", () => {
    expect(validCareChange({ kind: "document", cohort: "camhs", document: "physical", status: "completed" })).toBe(
      false,
    );
    expect(validCareChange({ kind: "document", cohort: "camhs", document: "appearance", status: "completed" })).toBe(
      false,
    );
    expect(validCareChange({ kind: "document", cohort: "camhs", document: "risk", status: "completed" })).toBe(true);
  });
  it.each([
    { expectedGeneration: 99 },
    { expectedRevision: 99 },
    { patientId: "PT-wrong" },
    { role: "ward" },
    { role: "ward", actingUnitId: "other" },
    { role: "officer" },
    { role: "community" },
    { now: NaN },
  ])("fails closed for stale identity, role, scope and time %j", (patch) => {
    const { state, admission } = fixture();
    const next = wardFlowReducer(state, command(state, admission.id, appointment, patch));
    expect(next.admissions).toBe(state.admissions);
    expect(next.units).toBe(state.units);
    expect(next.auditEvents.at(-1)?.outcome).not.toBe("accepted");
  });
  it("rejects unknown or narrative properties both at command and restore boundaries", () => {
    expect(validCareChange({ ...appointment, notes: "not allowed" })).toBe(false);
    expect(validCareChange({ ...appointment, contactId: "unregistered-clinician" })).toBe(false);
    expect(validCareJourney({ ...emptyCareJourney(), notes: "not allowed" })).toBe(false);
    const { state, admission } = fixture();
    const next = wardFlowReducer(
      state,
      command(state, admission.id, { ...appointment, notes: "not allowed" } as CareChange),
    );
    expect(next.admissions).toBe(state.admissions);
  });
  it("records administrative code 50 without discharging or changing occupancy", () => {
    const { state, admission } = fixture();
    const next = wardFlowReducer(
      state,
      command(state, admission.id, { kind: "episode", episodeType: "rehabilitation" }),
    );
    expect(next.units).toBe(state.units);
    expect(next.admissions.find((a) => a.id === admission.id)).toMatchObject({
      state: "occupied",
      leftAt: null,
      careJourney: { episodes: [{ episodeType: "rehabilitation" }] },
    });
  });
  it("resolves a legacy residential record explicitly without rewriting its original destination", () => {
    const { state, admission } = fixture();
    admission.state = "departed";
    admission.leftAt = NOW_ANCHOR;
    admission.leavingDestination = "moved-to-residential-care";
    const wrong = wardFlowReducer(
      state,
      command(state, admission.id, { kind: "coding", receivingClass: "aged_care_usual", separationCode: "21" }),
    );
    expect(wrong.admissions).toBe(state.admissions);
    const right = wardFlowReducer(
      state,
      command(state, admission.id, { kind: "coding", receivingClass: "aged_care_usual", separationCode: "22" }),
    );
    const a = right.admissions.find((a) => a.id === admission.id)!;
    expect(a.leavingDestination).toBe("moved-to-residential-care");
    expect(separationHandoff(a)).toMatchObject({ separationCode: "22", externalSubmission: "not_connected" });
  });
  it.each(["private_vehicle", "taxi", "service_vehicle", "ambulance", "police", "rfds"] as const)(
    "supports reviewed %s transport without sending a booking",
    (mode) => {
      const { state, admission } = fixture();
      const next = wardFlowReducer(
        state,
        command(state, admission.id, {
          kind: "transport",
          mode,
          region: "country",
          riskDocument: true,
          authority: "4A",
          escortSuitable: true,
          leastRestrictiveReviewed: true,
          regionalServiceConfirmed: true,
        }),
      );
      expect(next.rejections).toEqual([]);
      expect(next.movements).toBe(state.movements);
      expect(next.units).toBe(state.units);
    },
  );
  it("refuses missing transport assessments and police authority", () => {
    const { state, admission } = fixture();
    const t: CareChange = {
      kind: "transport",
      mode: "police",
      region: "metro",
      riskDocument: true,
      authority: "4A",
      escortSuitable: true,
      leastRestrictiveReviewed: true,
      regionalServiceConfirmed: true,
    };
    for (const patch of [
      { riskDocument: false },
      { escortSuitable: false },
      { authority: "none" },
      { leastRestrictiveReviewed: false },
      { regionalServiceConfirmed: false },
    ]) {
      const next = wardFlowReducer(state, command(state, admission.id, { ...t, ...patch } as CareChange));
      expect(next.admissions).toBe(state.admissions);
    }
  });
  it("accepts only this community team's explicit referral link", () => {
    const { state, admission } = fixture();
    const option = COMMUNITY_TEAM_PAGES[0]!;
    admission.referralId = state.referrals[0]!.id;
    const referral = state.referrals[0]!;
    expect(referral).toBeDefined();
    referral.destinations = [{ destination: { kind: "community_team", teamName: option.name }, state: "accepted" }];
    const actor = { role: "community", actingTeamId: option.id } as const;
    expect(selectDischargeRecord(state, actor, admission.id).status).toBe("allowed");
    const next = wardFlowReducer(state, command(state, admission.id, appointment, actor));
    expect(next.rejections).toEqual([]);
    const other = COMMUNITY_TEAM_PAGES.find((t) => t.id !== option.id)!;
    expect(selectDischargeRecord(state, { role: "community", actingTeamId: other.id }, admission.id).status).toBe(
      "denied",
    );
    expect(
      wardFlowReducer(state, command(state, admission.id, { kind: "episode", episodeType: "mental_health" }, actor))
        .admissions,
    ).toBe(state.admissions);
  });
  it("records acceptance then handover then atomically moves an arrival between suitable wards", () => {
    const { state, admission } = fixture();
    const base = state.movements.find((m) => m.cohort === state.units.find((u) => u.id === admission.unitId)?.cohort)!;
    expect(base).toBeDefined();
    base.admissionId = admission.id;
    base.patientId = admission.patientId!;
    base.stage = "arrived";
    base.acceptedUnitId = admission.unitId;
    admission.movementId = base.id;
    state.units = state.units.map((u) => ({
      ...u,
      allocatable: { ...u.allocatable, confirmedAt: NOW_ANCHOR },
      empty: { ...u.empty, confirmedAt: NOW_ANCHOR },
    }));
    const target = state.units.find(
      (u) => u.id !== admission.unitId && eligibility(base, u, NOW_ANCHOR).eligible && u.allocatableLocked > 0,
    )!;
    expect(target).toBeDefined();
    const skipped = wardFlowReducer(
      state,
      command(state, admission.id, { kind: "transfer", receivingUnitId: target.id, step: "arrived" }),
    );
    expect(skipped.admissions).toBe(state.admissions);
    let next = wardFlowReducer(
      state,
      command(state, admission.id, { kind: "transfer", receivingUnitId: target.id, step: "accepted" }),
    );
    next = wardFlowReducer(
      next,
      command(next, admission.id, { kind: "transfer", receivingUnitId: target.id, step: "handover" }),
    );
    const before = next;
    next = wardFlowReducer(
      next,
      command(next, admission.id, { kind: "transfer", receivingUnitId: target.id, step: "arrived" }),
    );
    expect(next.rejections).toEqual([]);
    expect(next.admissions.find((a) => a.id === admission.id)?.state).toBe("departed");
    expect(next.admissions.filter((a) => a.patientId === admission.patientId && a.state === "occupied")).toHaveLength(
      1,
    );
    expect(next.units.find((u) => u.id === target.id)!.empty.value).toBe(
      before.units.find((u) => u.id === target.id)!.empty.value - 1,
    );
    expect(next.units.find((u) => u.id === admission.unitId)!.empty.value).toBe(
      before.units.find((u) => u.id === admission.unitId)!.empty.value + 1,
    );
    expect(
      wardFlowReducer(
        next,
        command(next, admission.id, { kind: "transfer", receivingUnitId: target.id, step: "arrived" }),
      ).units,
    ).toBe(next.units);
  });
});
