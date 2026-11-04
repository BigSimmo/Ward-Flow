import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { PatientId } from "@/components/ward-management/ward-patients";
import { GENERAL_OBSERVATION } from "@/components/ward-management/ward-observation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR + 5;
const raise = (patientId?: PatientId): Extract<WardFlowEvent, { type: "RAISE_REFERRAL" }> => ({
  type: "RAISE_REFERRAL",
  role: "ed",
  now: NOW,
  edId: "rph-ed",
  ...(patientId === undefined ? {} : { patientId }),
  draft: {
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Voluntary",
    legalFormCode: null,
    urgency: 2,
  },
});

function expectRefusedWithoutPlacement(before: WardFlowState, event: WardFlowEvent) {
  const after = wardFlowReducer(before, event);
  expect(after.rejections).toHaveLength(before.rejections.length + 1);
  expect(after.rejections.at(-1)?.reason).toContain("patient");
  for (const key of ["patients", "referrals", "movements", "admissions", "units"] as const)
    expect(after[key]).toEqual(before[key]);
  expect(after.referralSequence).toBe(before.referralSequence);
}

describe("placement resolves its optional patient link against current records", () => {
  it("refuses an explicit patient link that names nobody", () => {
    expectRefusedWithoutPlacement(seedWardFlowState(), raise("PT-SYNTHETIC-MISSING"));
  });

  it("refuses a patient archived while the ED draft was open", () => {
    const added = wardFlowReducer(seedWardFlowState(), {
      type: "ADD_PATIENT",
      role: "coordinator",
      now: NOW,
      umrn: "SYN-STALE-DRAFT",
      givenName: "Synthetic",
      familyName: "Draft",
      dateOfBirth: "1980-01-01",
    });
    expect(added.rejections).toEqual([]);
    const draft = raise(added.patients.at(-1)!.id);
    const archived = wardFlowReducer(added, {
      type: "ARCHIVE_PATIENT",
      role: "coordinator",
      now: NOW,
      patientId: draft.patientId!,
      reason: "test",
    });
    expect(archived.rejections).toEqual([]);
    expectRefusedWithoutPlacement(archived, draft);
  });

  it("also checks a patient link inherited from an older referral", () => {
    const seeded = seedWardFlowState();
    const referral = seeded.referrals.find((row) =>
      row.destinations.some(
        (arm) =>
          arm.destination.kind === "emergency_department" &&
          arm.destination.edId === "rph-ed" &&
          arm.state !== "declined" &&
          arm.withdrawnAt === undefined,
      ),
    )!;
    expect(referral).toBeDefined();
    const state: WardFlowState = {
      ...seeded,
      referrals: seeded.referrals.map((row) =>
        row.id === referral.id ? { ...row, patientId: "PT-SYNTHETIC-MISSING" } : row,
      ),
      movements: seeded.movements.filter((row) => row.referralId !== referral.id),
    };
    expectRefusedWithoutPlacement(state, { ...raise(), referralId: referral.id });
  });

  it.each(["known", "absent"] as const)("preserves the supported %s patient link", (kind) => {
    const state = seedWardFlowState();
    const patientId = kind === "known" ? state.patients[0].id : undefined;
    const after = wardFlowReducer(state, raise(patientId));
    expect(after.rejections).toEqual(state.rejections);
    expect(after.movements).toHaveLength(state.movements.length + 1);
    expect(after.movements.at(-1)?.patientId).toBe(patientId);
  });
});
