// 28 day readmission flag (9 Oct 2026, stream B).
import { describe, expect, it } from "vitest";

import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  READMISSION_WINDOW_DAYS,
  admissionReadmissionFlag,
  movementReadmissionFlag,
  priorDischargeWithinWindow,
  referralReadmissionFlag,
} from "@/components/ward-management/ward-readmission";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Movement } from "@/components/ward-management/ward-model";

const WINDOW = READMISSION_WINDOW_DAYS * 24 * 60;

/** AD-LEFT-01 is PT-010's discharge to the community; RF-010 is PT-010's own earlier referral. */
function withReferralAt(raisedAt: number, state: WardFlowState = seedWardFlowState()): WardFlowState {
  return {
    ...state,
    referrals: state.referrals.map((referral) => (referral.id === "RF-010" ? { ...referral, raisedAt } : referral)),
  };
}

function leftAt(state: WardFlowState): number {
  const admission = state.admissions.find((candidate) => candidate.id === "AD-LEFT-01");
  if (!admission?.leftAt) throw new Error("seed is missing AD-LEFT-01's departure");
  return admission.leftAt;
}

describe("28 day readmission flag", () => {
  it("flags a referral raised after the same person's discharge, naming the date and ward", () => {
    const seed = seedWardFlowState();
    const state = withReferralAt(leftAt(seed) + 3 * 1440 + 10, seed);
    const flag = referralReadmissionFlag(
      state.referrals.find((referral) => referral.id === "RF-010")!,
      state,
    );
    expect(flag).toEqual({
      admissionId: "AD-LEFT-01",
      unitId: "arm-adult-open",
      unitName: state.units.find((unit) => unit.id === "arm-adult-open")!.name,
      dischargedAt: leftAt(seed),
      daysBefore: 3,
    });
  });

  it("includes exactly 28 days and stops one minute later", () => {
    const seed = seedWardFlowState();
    const at = (offset: number) =>
      referralReadmissionFlag(
        withReferralAt(leftAt(seed) + offset, seed).referrals.find((referral) => referral.id === "RF-010")!,
        seed,
      );
    // `seed` still holds the original referral; the subject is resolved through its own patient link.
    expect(at(WINDOW)?.daysBefore).toBe(READMISSION_WINDOW_DAYS);
    expect(at(WINDOW + 1)).toBeNull();
  });

  it("does not flag a referral raised before the discharge (seed: RF-010 led to that stay)", () => {
    const state = seedWardFlowState();
    expect(
      referralReadmissionFlag(
        state.referrals.find((referral) => referral.id === "RF-010")!,
        state,
      ),
    ).toBeNull();
  });

  it("never treats a transfer to another psychiatric ward as a discharge", () => {
    const state = seedWardFlowState();
    const transfer = state.admissions.find((admission) => admission.id === "AD-LEFT-02")!;
    expect(transfer.leavingDestination).toBe("transferred-to-another-psychiatric-ward");
    expect(priorDischargeWithinWindow(transfer, transfer.leftAt! + 60, state, "none")).toBeNull();
  });

  it("matches nobody when the subject has no resolvable person", () => {
    const state = seedWardFlowState();
    expect(priorDischargeWithinWindow({}, leftAt(state) + 60, state)).toBeNull();
    expect(priorDischargeWithinWindow({ patientId: "PT-NOBODY" }, leftAt(state) + 60, state)).toBeNull();
  });

  it("picks the most recent discharge when there are two", () => {
    const seed = seedWardFlowState();
    const earlier: Admission = {
      ...seed.admissions.find((admission) => admission.id === "AD-LEFT-01")!,
      id: "AD-LEFT-EARLIER",
      unitId: "alb-adult-open",
      leftAt: leftAt(seed) - 5 * 1440,
    };
    const state = withReferralAt(leftAt(seed) + 60, { ...seed, admissions: [...seed.admissions, earlier] });
    expect(
      referralReadmissionFlag(
        state.referrals.find((r) => r.id === "RF-010")!,
        state,
      )?.admissionId,
    ).toBe("AD-LEFT-01");
  });

  it("flags an ED movement and an admission for the same person, never an admission against its own stay", () => {
    const seed = seedWardFlowState();
    const movement: Movement = {
      ...seed.movements[0]!,
      id: "WF-READMIT",
      referralId: "RF-010",
      patientId: undefined,
      openedAt: leftAt(seed) + 120,
    };
    const state = { ...seed, movements: [...seed.movements, movement] };
    expect(movementReadmissionFlag(movement, state)?.admissionId).toBe("AD-LEFT-01");
    const own = state.admissions.find((admission) => admission.id === "AD-LEFT-01")!;
    expect(admissionReadmissionFlag(own, state)).toBeNull();
  });
});
