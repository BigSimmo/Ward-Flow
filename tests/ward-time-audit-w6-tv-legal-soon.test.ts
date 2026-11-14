import { describe, expect, it } from "vitest";

import { edClinicalRows } from "@/components/ward-management/bed-meeting/tv-clinical-derivations";
import { currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-form-progression";
import { DEFAULT_DUE_SOON_THRESHOLDS, type Instant } from "@/components/ward-management/ward-clock";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * Time audit T4 (D-194, Josh 13 Nov 2026): the TV legal board's "Ending soon" lane uses the signed
 * "due soon" warning (`dueSoon`, 3 hours by default, changeable in Settings), not an unsigned 24-hour
 * window. Synthetic seed data only.
 */

const HOUR = 60;

function withTypedEnd(): { movements: Movement[]; movement: Movement; dueAt: Instant } {
  const state = seedWardFlowState();
  const base = state.movements.find((candidate) => candidate.originEdId && candidate.legalForm);
  if (!base?.legalForm) throw new Error("seed has no ED journey on a form");
  const dueAt = 100 * 24 * HOUR;
  const movement: Movement = {
    ...base,
    legalForm: { ...base.legalForm, dueAt, endedBy: undefined },
  };
  if (currentLegalDueAt(movement) === undefined) throw new Error("expected a typed end time");
  return { movements: state.movements.map((one) => (one.id === base.id ? movement : one)), movement, dueAt };
}

function legalToneAt(now: Instant, thresholds = DEFAULT_DUE_SOON_THRESHOLDS) {
  const state = seedWardFlowState();
  const { movements, movement } = withTypedEnd();
  return edClinicalRows({
    movements,
    referrals: state.referrals,
    patients: state.patients,
    plannedAdmissions: state.plannedAdmissions,
    edId: movement.originEdId!,
    units: state.units,
    now,
    accessTargetMinutes: 12 * HOUR,
    nameOf: () => "Synthetic person",
    thresholds,
  })?.find((row) => row.id === movement.id)?.legal?.tone;
}

describe("TV legal board, Ending soon (T4)", () => {
  const { dueAt } = withTypedEnd();

  it("uses the signed due soon value, 3 hours", () => {
    expect(CLINICAL_VALUES.dueSoon.value).toBe(3 * HOUR);
    expect(legalToneAt(dueAt - 2 * HOUR)).toBe("warning");
    expect(legalToneAt(dueAt - 5 * HOUR)).toBeUndefined();
    expect(legalToneAt(dueAt - 20 * HOUR)).toBeUndefined();
    expect(legalToneAt(dueAt + 1)).toBe("danger");
  });

  it("follows the due soon value set in Settings", () => {
    const sixHours = { urgentMinutes: HOUR, soonMinutes: 6 * HOUR };
    expect(legalToneAt(dueAt - 5 * HOUR, sixHours)).toBe("warning");
    expect(legalToneAt(dueAt - 7 * HOUR, sixHours)).toBeUndefined();
  });
});
