// M134: the synthetic seed contains every hard case.
// Audits and demos that pass "on the seed" prove nothing for a case the seed lacks. This file is
// the checked-in scenario list: each case names how it is found in the default (standard) seed.
// Cases the seed does not hold yet are listed in KNOWN_GAPS; that list may only shrink, and a case
// must leave it in the same change that adds its synthetic record.
//
// Adding a record: synthetic names and identifiers only (the real-identifier guards stay), and no
// change to a clinical rule, threshold or verdict; a seed record is data, not behaviour.
import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { ADMISSION_STATES } from "@/components/ward-management/ward-admissions";
import { MOVEMENT_STAGES } from "@/components/ward-management/ward-model-vocabulary";
import { observationStaff } from "@/components/ward-management/ward-observation";
import { outOfAreaLedger } from "@/components/ward-management/ward-referrals-out-of-area";
import { tribunalHearingPassedWithoutOutcome } from "@/components/ward-management/ward-patient-care-plans";
import { admissionReadmissionFlag, createReadmissionIndex } from "@/components/ward-management/ward-readmission";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

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

const today = new Date();
const todayIso = today.toISOString().slice(0, 10);

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
    s.patients.filter((p) => tribunalHearingPassedWithoutOutcome(p.tribunalHearing, todayIso)).length,
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

// Not in the default seed on 10 Nov 2026 (M134 audit). Each is a seed PR for Josh's go-ahead.
const KNOWN_GAPS = [
  // The one AWOL record (WL-RD07) is on a stay with no legal status recorded, so D-115's
  // "AWOL shown everywhere" cannot be seen for either legal status on the default demo.
  "absent without leave, voluntary",
  "absent without leave, involuntary",
  // Form 5A appears on one movement, but no admitted inpatient holds it.
  "inpatient on Form 5A",
  "two-staff observation (2:1)",
  // Every admitted stay is on general observation; the 1:1 levels are only on ED movements.
  "one-to-one or two-to-one observation on an admitted stay",
  "ward with 0 beds",
  // People share family names, but no two share a family name and a given-name initial, the
  // closest wrong-patient risk.
  "look-alike names (same family name and given-name initial)",
];

describe("M134 the synthetic seed holds every hard case", () => {
  const state = seedWardFlowState();
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

  it("each known gap is still a gap; remove it once the seed holds the case", () => {
    expect(KNOWN_GAPS.filter((name) => counts[name] > 0)).toEqual([]);
  });
});
