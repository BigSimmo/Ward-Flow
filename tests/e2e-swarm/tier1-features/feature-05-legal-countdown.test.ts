import { describe, expect, it } from "vitest";
import { formProgression, currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-form-progression";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("Tier 1 - Feature 05: 72-Hour Legal Assessment Countdown Timer Retention", () => {
  const now = NOW_ANCHOR;
  const assessmentExpiry = now + 72 * 60; // 72 hours from intake

  const baseInvoluntaryMovement = (overrides?: Partial<Movement>): Movement => {
    return {
      id: "WF-LEGAL-72H",
      stage: "moving",
      legalStatus: "Involuntary",
      legalForm: {
        code: "1A",
        dueAt: assessmentExpiry,
        receivedAt: now - 120,
      },
      flaggedUrgent: false,
      urgency: 2,
      cohort: "Adult",
      security: "Open",
      sex: "Male",
      gender: "Male",
      openedAt: now - 120,
      statusChanges: [],
      urgencyChanges: [],
      overrides: [],
      owner: "ed",
      referredUnitIds: [],
      declines: [],
      blocker: "None",
      observation: "general",
      highAcuity: false,
      ...overrides,
    } as unknown as Movement;
  };

  it("retains the 72-hour assessment countdown timer while patient is in transit", () => {
    const m = baseInvoluntaryMovement({ stage: "moving" });
    const dueAt = currentLegalDueAt(m);

    expect(dueAt).toBe(assessmentExpiry);
  });

  it("retains the 72-hour assessment countdown upon ward arrival before Form 6A examination", () => {
    // Arrival closed the transfer leg, triggering progression to Form 6A
    const m = baseInvoluntaryMovement({
      stage: "arrived",
      closure: { outcome: "arrived", at: now, by: "ward", reason: "arrived" },
      examination: undefined, // Psychiatrist has not signed Form 6A yet
    });

    const progression = formProgression(m);
    expect(progression).toBeDefined();
    expect(progression?.endedWhen).toBe("at arrival");
    expect(progression?.nextCode).toBe("6A");

    // Clinical safety invariant: the 72h countdown must NOT be cleared on arrival
    const dueAt = currentLegalDueAt(m);
    expect(dueAt).toBe(assessmentExpiry);
  });

  it("clears the 72-hour assessment countdown once Form 6A examination is recorded", () => {
    const m = baseInvoluntaryMovement({
      stage: "arrived",
      closure: { outcome: "arrived", at: now, by: "ward", reason: "arrived" },
      examination: {
        at: now + 30,
        by: "ward",
        examinerName: "Dr Sarah Jenkins",
        outcome: "inpatient_order", // Form 6A completed
      },
    });

    const dueAt = currentLegalDueAt(m);
    // Once Form 6A examination is signed, the temporary 72h timer is cleared
    expect(dueAt).toBeUndefined();
  });

  it("returns undefined for voluntary patients with no statutory order", () => {
    const m = baseInvoluntaryMovement({
      legalStatus: "Voluntary",
      legalForm: undefined,
    });

    expect(formProgression(m)).toBeUndefined();
    expect(currentLegalDueAt(m)).toBeUndefined();
  });

  it("ignores non-finite or corrupted dueAt values safely without throwing", () => {
    const m = baseInvoluntaryMovement({
      legalForm: {
        code: "1A",
        dueAt: NaN as unknown as number,
      },
    });

    expect(currentLegalDueAt(m)).toBeUndefined();
  });
});
