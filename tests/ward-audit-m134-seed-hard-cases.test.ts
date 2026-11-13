// M134: the synthetic seed contains every hard case.
// Audits and demos that pass "on the seed" prove nothing for a case the seed lacks. This file is
// the checked-in scenario list: each case names how it is found in the hard-cases seed, the
// standard seed with the opt-in hard-cases overlay (`ward-hard-cases-demo.ts`, kept out of the
// default seed so no existing count moves). Cases that seed does not hold are listed in KNOWN_GAPS;
// that list may only shrink, and a case must leave it in the same change that adds its record.
//
// Adding a record: synthetic names and identifiers only (the real-identifier guards stay), and no
// change to a clinical rule, threshold or verdict; a seed record is data, not behaviour.
import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  isValidStoredWardFlowState,
  storedStateRestoreProblem,
} from "@/components/ward-management/ward-flow-storage-validation";
import { applyHardCasesOverlay, HARD_CASE_IDS } from "@/components/ward-management/ward-hard-cases-demo";
import { ADMISSION_STATES } from "@/components/ward-management/ward-admissions";
import { MOVEMENT_STAGES } from "@/components/ward-management/ward-model-vocabulary";
import { observationStaff } from "@/components/ward-management/ward-observation";
import { outOfAreaLedger } from "@/components/ward-management/ward-referrals-out-of-area";
import { tribunalHearingPassedWithoutOutcome } from "@/components/ward-management/ward-patient-care-plans";
import { admissionReadmissionFlag, createReadmissionIndex } from "@/components/ward-management/ward-readmission";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// A16-04: the app shows only travel bands someone has checked (none yet). This file tests a
// mechanism that needs bands, so importing this swaps in the tests' own invented table.
import "./helpers/ward-test-travel-bands";
import { sampleIsoDay } from "@/components/ward-management/ward-sample-days";

type State = ReturnType<typeof seedWardFlowState>;
type Patient = State["patients"][number];
type Admission = State["admissions"][number];

const ATSI_STATUSES = [
  "Aboriginal, not Torres Strait Islander",
  "Torres Strait Islander, not Aboriginal",
  "Aboriginal and Torres Strait Islander",
  "Neither Aboriginal nor Torres Strait Islander",
  "Not stated",
];

function ageAt(dateOfBirth: string, today: Date): number {
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  let age = today.getUTCFullYear() - y;
  if (today.getUTCMonth() + 1 < m || (today.getUTCMonth() + 1 === m && today.getUTCDate() < d)) age -= 1;
  return age;
}

/** The legal status a stay is held under: its movement's, else the person's record. */
function stayLegalStatus(state: State, admission: Admission): string | undefined {
  const movement = state.movements.find((m) => m.id === admission.movementId);
  const patient = state.patients.find((p) => p.id === admission.patientId);
  return movement?.legalStatus ?? admission.plannedLegalStatus ?? patient?.legalStatus;
}

function awolStays(state: State): Admission[] {
  const ids = new Set(state.leaveBeds.filter((bed) => bed.absentWithoutLeave).map((bed) => bed.admissionId));
  return state.admissions.filter((admission) => ids.has(admission.id));
}

const stayObservationStaff = (state: State, admission: Admission) => {
  const movement = state.movements.find((m) => m.id === admission.movementId);
  return Math.max(
    observationStaff(admission.observation.level),
    movement ? observationStaff(movement.observation.level) : 0,
  );
};

// The demo day the other audit files use, so the age cases do not drift with the wall clock.
const today = new Date(Date.UTC(2026, 10, 10, 2, 42)); // 10:42 AWST, 10 Nov 2026

/** Each hard case and how many seed records hold it. */
const SCENARIOS: Record<string, (state: State) => number> = {
  "absent without leave, voluntary": (s) => awolStays(s).filter((a) => stayLegalStatus(s, a) === "Voluntary").length,
  "absent without leave, involuntary": (s) =>
    awolStays(s).filter((a) => /involuntary/iu.test(stayLegalStatus(s, a) ?? "")).length,
  "community treatment order patient admitted": (s) =>
    s.admissions.filter(
      (a) =>
        a.state === "occupied" &&
        (s.patients.find((p) => p.id === a.patientId)?.communityTreatmentOrder !== undefined ||
          s.patients.find((p) => p.id === a.patientId)?.legalStatus === "Community treatment order"),
    ).length,
  "inpatient on Form 5A": (s) =>
    s.admissions.filter(
      (a) => a.state === "occupied" && s.movements.find((m) => m.id === a.movementId)?.legalForm?.code === "5A",
    ).length,
  "continued form (Form 6 family) recorded": (s) =>
    s.movements.filter((m) => /^6/u.test(m.legalForm?.code ?? "")).length,
  "one-staff observation (1:1)": (s) =>
    s.movements.filter((m) => observationStaff(m.observation.level) === 1).length +
    s.admissions.filter((a) => observationStaff(a.observation.level) === 1).length,
  "two-staff observation (2:1)": (s) =>
    s.movements.filter((m) => observationStaff(m.observation.level) === 2).length +
    s.admissions.filter((a) => observationStaff(a.observation.level) === 2).length,
  "one-to-one or two-to-one observation on an admitted stay": (s) =>
    s.admissions.filter((a) => a.state === "occupied" && stayObservationStaff(s, a) > 0).length,
  "youth patient (under 18)": (s) => s.patients.filter((p) => ageAt(p.dateOfBirth, today) < 18).length,
  "older adult patient (65 and over)": (s) => s.patients.filter((p) => ageAt(p.dateOfBirth, today) >= 65).length,
  "gender diverse patient": (s) =>
    s.patients.filter((p) => p.gender !== undefined && !["Female", "Male"].includes(p.gender)).length,
  "secure placement": (s) => s.movements.filter((m) => m.security === "Secure").length,
  "out of area stay": (s) => outOfAreaLedger(s.admissions, s.units, NOW_ANCHOR).entries.length,
  "tribunal hearing date passed with no outcome": (s) =>
    // The seeded hearing date moves with the board day (root cause 2.3), so it is read against that day.
    s.patients.filter((p) => tribunalHearingPassedWithoutOutcome(p.tribunalHearing, sampleIsoDay(0))).length,
  "frequent presenter (care plan)": (s) =>
    s.patients.filter((p) => (p.carePlans ?? []).some((plan) => /frequent presenter/iu.test(plan.type))).length,
  "readmission within the readmission window": (s) => {
    const index = createReadmissionIndex(s);
    return s.admissions.filter((a) => a.state !== "departed" && admissionReadmissionFlag(a, s.movements, index)).length;
  },
  "delayed discharge with a reason": (s) => s.admissions.filter((a) => a.delayedDischargeReason).length,
  "interpreter needed": (s) =>
    s.patients.filter(
      (p) =>
        /interpreter required/iu.test(`${p.interpreterLanguage ?? ""} ${p.interpreterRequired ?? ""}`) &&
        !/no interpreter required/iu.test(`${p.interpreterLanguage ?? ""} ${p.interpreterRequired ?? ""}`),
    ).length,
  ...Object.fromEntries(
    ATSI_STATUSES.map((status) => [
      `Aboriginal and Torres Strait Islander status: ${status}`,
      (s: State) => s.patients.filter((p: Patient) => p.aboriginalOrTorresStraitIslanderStatus === status).length,
    ]),
  ),
  "look-alike names (two people share a family name)": (s) => {
    const seen = new Map<string, number>();
    for (const p of s.patients) {
      const key = p.familyName.toLowerCase();
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return [...seen.values()].filter((n) => n > 1).length;
  },
  "look-alike names (same family name and given-name initial)": (s) => {
    const seen = new Map<string, number>();
    for (const p of s.patients) {
      const key = `${p.familyName.toLowerCase()}|${p.givenName[0]?.toLowerCase()}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return [...seen.values()].filter((n) => n > 1).length;
  },
  "full ward (no allocatable bed)": (s) => s.units.filter((u) => u.allocatable.value === 0).length,
  "ward with 0 beds": (s) => s.units.filter((u) => u.beds === 0).length,
  ...Object.fromEntries(
    MOVEMENT_STAGES.map((stage) => [
      `movement stage: ${stage}`,
      (s: State) => s.movements.filter((m) => m.stage === stage).length,
    ]),
  ),
  ...Object.fromEntries(
    ADMISSION_STATES.map((st) => [
      `admission state: ${st}`,
      (s: State) => s.admissions.filter((a) => a.state === st).length,
    ]),
  ),
};

// The hard-cases overlay (M134, 10 Nov 2026) closed every gap the audit found in the default seed:
// AWOL on a voluntary and an involuntary stay, an inpatient on Form 5A, 1:1 and 2:1 observation on
// admitted stays, a ward with 0 beds and look-alike names. Add a case here only with its question.
const KNOWN_GAPS: string[] = [];

describe("M134 the synthetic seed holds every hard case", () => {
  // A16-14 (13 Nov 2026): the legal-form worked examples are opt-in too, and they hold the Form 6
  // case, so the hard-cases world is built with both switched on.
  const state = applyHardCasesOverlay(seedWardFlowState("standard", { workedExamples: true }), NOW_ANCHOR);
  const counts = Object.fromEntries(Object.entries(SCENARIOS).map(([name, find]) => [name, find(state)]));

  it("lists the cases the audit named", () => {
    expect(Object.keys(SCENARIOS).length).toBeGreaterThan(30);
    for (const gap of KNOWN_GAPS) expect(Object.keys(SCENARIOS), gap).toContain(gap);
  });

  it("every case outside the known gaps has at least one record", () => {
    const missing = Object.entries(counts)
      .filter(([name, n]) => n === 0 && !KNOWN_GAPS.includes(name))
      .map(([name]) => name);
    expect(missing).toEqual([]);
  });

  it("the hard-cases seed is a world the app would save and restore", () => {
    const stored = JSON.parse(JSON.stringify(state)) as unknown;
    expect(isValidStoredWardFlowState(stored)).toBe(true);
    expect(storedStateRestoreProblem(stored)).toBeUndefined();
  });

  it("the default seed stays as it was: the overlay is opt-in", () => {
    const standard = seedWardFlowState();
    expect(standard.units.map((unit) => unit.id)).not.toContain(HARD_CASE_IDS.zeroBedUnit);
    expect(standard.leaveBeds.map((bed) => bed.id)).not.toContain(HARD_CASE_IDS.involuntaryAwolLeaveBed);
    expect(standard.admissions.map((admission) => admission.id)).not.toContain(HARD_CASE_IDS.form5aAdmission);
  });

  it("each known gap is still a gap; remove it once the seed holds the case", () => {
    expect(KNOWN_GAPS.filter((name) => counts[name] > 0)).toEqual([]);
  });
});
