import { describe, expect, it } from "vitest";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import type { LegalForm, Movement } from "@/components/ward-management/ward-model";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { formExpiryLevel, formExpiryWarning } from "@/components/ward-management/ed/ed-screen-model";
import { nextStep, toHandoverRow } from "@/components/ward-management/handover/handover-model";
import { hasCurrentLegalMismatch, LEGAL_MISMATCH_WARNING } from "@/components/ward-management/ward-stay-legal";
import { currentLegalStanding } from "@/components/ward-management/ward-legal-form-progression";

// Master stress test, 14 Nov 2026: Demo-Rules-RV1a-1 / LG-1 (ED form urgency) and
// Demo-Actions-D1a-E-2 (a recorded legal mismatch shown nowhere). Synthetic data only.

const NOW = 600;
const thresholds = DEFAULT_DUE_SOON_THRESHOLDS;
const form = (dueAt: number): LegalForm => ({ code: "4A", kind: "transport", dueAt }) as LegalForm;

describe("ED board form expiry uses the one legal band rule (RV1a-1, LG-1)", () => {
  it("59 minutes before the typed expiry is red Act now, as every other legal screen", () => {
    const legalForm = form(NOW + 59);
    expect(currentLegalStanding({ legalForm }, NOW, thresholds)).toBe("urgent");
    expect(formExpiryLevel(legalForm, NOW, thresholds)).toBe("danger");
    expect(formExpiryWarning(legalForm, NOW, thresholds)).toBe("Act now: the expiry written on the form is close.");
  });

  it("3 hours before is the amber first warning only", () => {
    const legalForm = form(NOW + 180);
    expect(currentLegalStanding({ legalForm }, NOW, thresholds)).toBe("soon");
    expect(formExpiryLevel(legalForm, NOW, thresholds)).toBe("warning");
    expect(formExpiryWarning(legalForm, NOW, thresholds)).toBe("Warning: the expiry written on the form is close.");
  });

  it("a passed typed expiry is red", () => {
    const legalForm = form(NOW - 1);
    expect(formExpiryLevel(legalForm, NOW, thresholds)).toBe("danger");
    expect(formExpiryWarning(legalForm, NOW, thresholds)).toBe(
      "Warning: past the expiry written on the form. Check the form.",
    );
  });

  it("well clear of the expiry shows nothing", () => {
    expect(formExpiryLevel(form(NOW + 181), NOW, thresholds)).toBeUndefined();
    expect(formExpiryWarning(form(NOW + 181), NOW, thresholds)).toBeUndefined();
  });
});

const state = seedWardFlowStateAt(0);
const unit = state.units[0]!;
const base = state.movements.find((movement) => !movement.closure)!;
function accepted(patch: Partial<Movement> = {}): Movement {
  return {
    ...base,
    id: "WF-LEGAL-MISMATCH-TEST",
    stage: "accepted_awaiting_bed",
    closure: undefined,
    acceptedUnitId: unit.id,
    referredUnitIds: [],
    declines: [],
    transport: undefined,
    legalForm: undefined,
    pullExpiresAt: undefined,
    legalStatus: "Voluntary",
    legalMismatch: { at: NOW - 30, unitId: unit.id, kind: "voluntary_on_locked_ward" },
    ...patch,
  };
}

describe("a recorded legal mismatch is shown, never acted on (D1a-E-2)", () => {
  it("is current while it names the accepted ward and the status still matches its kind", () => {
    expect(hasCurrentLegalMismatch(accepted())).toBe(true);
    expect(hasCurrentLegalMismatch(accepted({ legalMismatch: undefined }))).toBe(false);
    expect(hasCurrentLegalMismatch(accepted({ acceptedUnitId: "another-ward" }))).toBe(false);
    expect(hasCurrentLegalMismatch(accepted({ legalStatus: "Involuntary inpatient" }))).toBe(false);
  });

  it("leads Handover's Pull the bed step, and leaves the step itself unchanged", () => {
    const readyBeds = () => 2;
    const flagged = { ...toHandoverRow(accepted(), state.units, state.patients, state.referrals), actNow: false };
    const clean = {
      ...toHandoverRow(accepted({ legalMismatch: undefined }), state.units, state.patients, state.referrals),
      actNow: false,
    };
    const flaggedStep = nextStep(flagged, NOW, NOW + 60, readyBeds);
    const cleanStep = nextStep(clean, NOW, NOW + 60, readyBeds);
    expect(cleanStep.text).toMatch(/^Pull the bed/);
    expect(flaggedStep.text).toBe(`${LEGAL_MISMATCH_WARNING} ${cleanStep.text}`);
    expect(flaggedStep.tone).toBe(cleanStep.tone);
  });
});
