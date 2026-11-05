import { describe, it, expect } from "vitest";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { buildCensus } from "@/components/ward-management/search/patient-census";
import { answerQuestion, whereNowLine, questionFor } from "@/components/ward-management/search/search-answers";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { searchWardFlow } from "@/components/ward-management/search/ward-smart-search";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { matchesWait } from "@/components/ward-management/search/search-filters";
import { HOW_TOS, showMeSteps } from "@/components/ward-management/help/ward-help-howto";
import { isClinicalQuestion } from "@/components/ward-management/help/ward-help-search-index";
const now = 10000;
function census(state = seedWardFlowState()) {
  return buildCensus({
    ...state,
    now,
    thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
    dayZero: new Date("2026-10-01T00:00:00Z"),
  });
}
describe("consolidated current-fact regressions", () => {
  it("counts one person while retaining both legitimate request links in the census", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find(isOpen)!;
    state.movements = [
      { ...movement, openedAt: 0 },
      { ...movement, id: "WF-SECOND", openedAt: 1 },
    ];
    const person = resolveSubjectPatient(movement, state).patient!;
    expect(person).toBeDefined();
    const result = census(state);
    expect(result.rows.filter((row) => row.patientRecordId === person.id).map((row) => row.key)).toEqual([
      movement.id,
      "WF-SECOND",
    ]);
    const answer = answerQuestion("over 24 hours", result)!;
    expect(answer.rows.filter((row) => row.patientRecordId === person.id)).toHaveLength(1);
  });
  it.each(["gp", "community", "ed_medical"] as const)("does not infer ED from %s referral origin", (source) => {
    const state = seedWardFlowState();
    const referral = state.referrals.find((ref) =>
      ref.destinations.some((arm) => arm.state === "queued" && arm.withdrawnAt === undefined),
    )!;
    state.movements = [];
    state.admissions = [];
    state.referrals = [{ ...referral, source }];
    const row = census(state).rows.find((row) => row.key === referral.id)!;
    expect(row).toBeDefined();
    expect(row.where.endsWith(" ED")).toBe(source === "ed_medical");
  });
  it("a completed linked journey does not revive an accepted referral", () => {
    const state = seedWardFlowState();
    const ref = state.referrals[0]!;
    const arm = ref.destinations.find((arm) => arm.destination.kind === "psychiatric_ward")!;
    expect(arm).toBeDefined();
    state.referrals = [{ ...ref, destinations: [{ ...arm, state: "accepted" }] }];
    state.movements = [{ ...state.movements[0]!, referralId: ref.id, stage: "arrived" }];
    expect(census(state).rows.some((row) => row.key === ref.id)).toBe(false);
  });
  it("accepting a non-ward destination does not invent a ward move", () => {
    const state = seedWardFlowState();
    const ref = state.referrals[0]!;
    state.movements = [];
    state.admissions = [];
    state.referrals = [
      { ...ref, destinations: [{ destination: { kind: "community_team", teamName: "Test team" }, state: "accepted" }] },
    ];
    expect(census(state).rows.some((row) => row.key === ref.id)).toBe(false);
  });
  it("a pending source-linked return preserves ED review whereabouts", () => {
    const state = seedWardFlowState();
    const stay = state.admissions.find((stay) => stay.state === "occupied")!;
    const patient = resolveSubjectPatient(stay, state).patient!;
    expect(patient).toBeDefined();
    state.admissions = [{ ...stay, awayAtEmergencyDepartmentSince: now - 30 }];
    state.movements = [
      {
        ...state.movements.find(isOpen)!,
        patientId: patient.id,
        sourceAdmissionId: stay.id,
        stage: "placement_requested",
        transport: undefined,
      },
    ];
    const row = census(state).rows.find((row) => row.key === state.movements[0]!.id)!;
    expect(row.awayAtEd).toBe(true);
    expect(row.where).toBe("At ED");
    expect(answerQuestion("away at ED", census(state))?.rows.some((item) => item.key === row.key)).toBe(true);
  });
  it.each([false, true])("linked return preserves leave (AWOL=%s)", (awol) => {
    const state = seedWardFlowState();
    const stay = state.admissions.find((stay) => stay.state === "occupied")!;
    const patient = resolveSubjectPatient(stay, state).patient!;
    state.admissions = [stay];
    state.movements = [
      {
        ...state.movements.find(isOpen)!,
        patientId: patient.id,
        sourceAdmissionId: stay.id,
        stage: "placement_requested",
        transport: undefined,
      },
    ];
    state.leaveBeds = [
      {
        id: "LB-TEST",
        unitId: stay.unitId,
        admissionId: stay.id,
        expectedReturn: now + 60,
        confirmedAt: now - 60,
        confirmedBy: "Ward",
        ...(awol ? { absentWithoutLeave: { since: now - 30, steps: [] } } : {}),
      },
    ];
    const row = census(state).rows.find((row) => row.key === state.movements[0]!.id)!;
    expect(awol ? row.absentWithoutLeave : row.onLeave).toBe(true);
    expect(whereNowLine(row)).toContain(awol ? "Absent without leave" : "On leave");
    expect(whereNowLine(row)).toContain("bed kept");
  });
  it("cancelled pre-collection transport is outstanding and a live booking is not", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((movement) => isOpen(movement) && movement.transport)!;
    state.movements = [
      { ...movement, stage: "handover_ready", transport: undefined, transportNeed: { needed: true, at: now - 60 } },
    ];
    expect(census(state).rows.find((row) => row.key === movement.id)?.transportNotBooked).toBe(true);
    state.movements = [{ ...movement, stage: "handover_ready" }];
    expect(census(state).rows.find((row) => row.key === movement.id)?.transportNotBooked).toBe(false);
  });
  it.each([359, 360, 1439, 1440, 1800])("legacy wait uses referral raisedAt (%s minutes)", (age) => {
    const referral = { ...seedWardFlowState().referrals[0]!, raisedAt: now - age };
    expect(matchesWait({ kind: "referral", referral }, "over24", now)).toBe(age >= 1440);
    expect(matchesWait({ kind: "referral", referral }, "under6", now)).toBe(age < 360);
  });
  it("reservation wording is not aliased to bare acceptance", () => {
    expect(questionFor("accepted")?.id).toBe("found");
    expect(questionFor("reserved beds")).toBeUndefined();
  });
  it.each([" ", "\t", "\n", "\u00a0"])("clinical guard handles equivalent whitespace %j", (space) => {
    expect(isClinicalQuestion(["should", "I", "admit"].join(space))).toBe(true);
    expect(isClinicalQuestion("legal status")).toBe(false);
  });
  it("bed-manager Patients walks omit registration but retain usable steps", () => {
    const walk = HOW_TOS.find((item) => item.id === "around-search")!;
    expect(showMeSteps(walk, "desk", "bed_manager").length).toBeGreaterThan(0);
    expect(showMeSteps(walk, "desk", "bed_manager").some((step) => step.title === "Add patient")).toBe(false);
    expect(showMeSteps(walk, "desk", "coordinator").some((step) => step.title === "Add patient")).toBe(true);
  });
  it("legacy Seclusion uses actual retained-page summaries", () => {
    const walk = HOW_TOS.find((item) => item.id === "around-seclusion")!;
    const steps = showMeSteps(walk, "desk", "bed_manager", "/ward-flow/seclusion");
    expect(steps).toHaveLength(2);
    expect(JSON.stringify(steps)).toContain("seclusion-wards");
    expect(JSON.stringify(steps)).not.toContain("seclusion-start-open");
  });
});

it("a previous admission does not settle a new accepted referral", () => {
  const state = seedWardFlowState();
  const ref = state.referrals.find(
    (ref) =>
      resolveSubjectPatient(ref, state).patient &&
      ref.destinations.some((arm) => arm.destination.kind === "psychiatric_ward"),
  )!;
  const patient = resolveSubjectPatient(ref, state).patient!;
  const arm = ref.destinations.find((arm) => arm.destination.kind === "psychiatric_ward")!;
  state.movements = [];
  state.admissions = [
    { ...state.admissions[0]!, patientId: patient.id, referralId: "REF-PREVIOUS", state: "departed" },
  ];
  state.referrals = [{ ...ref, destinations: [{ ...arm, state: "accepted" }] }];
  expect(census(state).rows.some((row) => row.key === ref.id && row.next === "Arrange the move")).toBe(true);
});
it("strict identifier whitespace retains referral eligibility without matching altered characters", () => {
  const state = seedWardFlowState();
  const ref = state.referrals.find(
    (ref) =>
      resolveSubjectPatient(ref, state).patient &&
      ref.destinations.some((arm) => arm.state === "queued" && arm.withdrawnAt === undefined),
  )!;
  const patient = resolveSubjectPatient(ref, state).patient!;
  state.patients = [{ ...patient, umrn: "ZX900001" }];
  state.movements = [];
  state.admissions = [];
  state.referrals = [ref];
  const search = (query: string) => searchWardFlow({ ...state, query, now, limitPerGroup: 100 });
  expect(search("ZX 900001").referrals.map((item) => item.referral.id)).toContain(ref.id);
  expect(search("ZX 900002").referrals).toHaveLength(0);
});

it("keeps recorded inpatient whereabouts when the ward catalogue entry is unavailable", () => {
  const state = seedWardFlowState();
  const stay = state.admissions.find((stay) => stay.state === "occupied")!;
  const patient = resolveSubjectPatient(stay, state).patient!;
  const ref = state.referrals.find((ref) =>
    ref.destinations.some((arm) => arm.state === "queued" && arm.withdrawnAt === undefined),
  )!;
  state.movements = [];
  state.admissions = [stay];
  state.patients = [patient];
  state.units = [];
  state.referrals = [{ ...ref, patientId: patient.id, source: "ed_medical" }];
  expect(census(state).rows.find((row) => row.key === ref.id)?.where).toBe("Ward not recorded");
});
it("unbooked transport remains discoverable without displacing a passed recorded form time", () => {
  const state = seedWardFlowState();
  const movement = state.movements[0]!;
  state.movements = [
    {
      ...movement,
      closure: undefined,
      stage: "handover_ready",
      transport: undefined,
      transportNeed: { needed: true, at: 0 },
      legalForm: { code: "4A", dueAt: now - 1 },
    },
  ];
  const result = census(state);
  const row = result.rows.find((row) => row.key === movement.id)!;
  expect(row.transportNotBooked).toBe(true);
  expect(row.next).toBe("Form due time (as written) passed");
  expect(answerQuestion("transport not booked", result)?.rows.some((row) => row.key === movement.id)).toBe(true);
});
