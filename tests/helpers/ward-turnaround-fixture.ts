import { expect } from "vitest";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import { turnaroundEligibilityAllows } from "@/components/ward-management/ward-turnaround-priority";
import { FIXTURE_HISTORY } from "./ward-referral-history";

/** Build both staging subjects through real commands, with a ward-confirmed occupied departure. */
export function buildTurnaroundFixture(code = "1A", dueAt?: number) {
  const now = NOW_ANCHOR;
  let state = wardFlowReducer(seedWardFlowState(), {
    type: "RAISE_REFERRAL",
    role: "ed",
    now,
    edId: allEmergencyDepartments()[0]!.id,
    draft: {
      cohort: "Adult",
      security: "Open",
      sex: "Female",
      gender: "Female",
      specialling: false,
      highAcuity: false,
      legalStatus: "Referred for psychiatric examination",
      urgency: 2,
      legalFormCode: code,
      ...(dueAt === undefined ? {} : { legalFormDueAt: dueAt }),
    },
  });
  expect(state.rejections).toEqual([]);
  const movementId = state.movements.at(-1)!.id;
  const movement = state.movements.at(-1)!;
  const admission = state.admissions.find((stay) => {
    const unit = state.units.find((candidate) => candidate.id === stay.unitId)!;
    return (
      stay.state === "occupied" &&
      stay.patientId !== null &&
      !state.bedReleases.some((release) => release.admissionId === stay.id) &&
      turnaroundEligibilityAllows(eligibility(movement, unit, now), unit)
    );
  })!;
  expect(admission).toBeDefined();
  const unitId = admission.unitId;
  state = wardFlowReducer(state, { type: "REFER_TO_UNITS", role: "coordinator", now, movementId, unitIds: [unitId] });
  state = wardFlowReducer(state, {
    type: "FLAG_BED_RELEASE",
    role: "ward",
    now,
    unitId,
    actingUnitId: unitId,
    admissionId: admission.id,
    waitingOn: "Nothing outstanding",
    expectedAt: now + 60,
  });
  expect(state.rejections).toEqual([]);
  state = wardFlowReducer(state, {
    type: "CONFIRM_BED_RELEASE",
    role: "ward",
    now,
    actingUnitId: unitId,
    releaseId: state.bedReleases.at(-1)!.id,
  });
  expect(state.rejections).toEqual([]);
  state = wardFlowReducer(state, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now,
    ageBand: "Adult",
    destinations: [
      {
        kind: "psychiatric_ward",
        unitId,
        sex: "Female",
        gender: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  });
  expect(state.rejections).toEqual([]);
  return { state, movementId, referralId: state.referrals.at(-1)!.id, unitId, now };
}
