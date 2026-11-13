import { describe, expect, it } from "vitest";

import {
  FORM_RECORDED_ENDED,
  formProgression,
  legalFormEnd,
} from "@/components/ward-management/legal-forms/legal-form-progression";
import { legalDeadlineText } from "@/components/ward-management/legal-forms/legal-forms-derivations";
import { legalEndAsTyped } from "@/components/ward-management/legal-forms/legal-forms-export";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * Review follow-up (12 Nov 2026): a patient arrives on a community treatment order (Form 5A or 5B)
 * and the order is then recorded as ended. #1621 made the Legal forms line check the recorded end
 * before the neutral D-127 arrival wording; every other output now reads the same order through
 * `legalFormEnd`, so none says "On Form 5A at arrival" for an ended order. Synthetic records only.
 * A1 (13 Nov 2026): nothing ends at arrival by itself any more; only a recorded end ends a form.
 */
const NOW = 10 * 60;

function arrivedOn(code: string, endedBy?: "revoked"): Movement {
  return {
    id: "ZZ-SYNTH-CTO",
    openedAt: 0,
    stage: "arrived",
    legalStatus: "Involuntary inpatient",
    legalForm: { code, ...(endedBy ? { endedBy } : {}) },
    closure: { at: NOW, outcome: "arrived", reason: "arrived" },
  } as unknown as Movement;
}

describe("an arrived community treatment order recorded as ended", () => {
  for (const code of ["5A", "5B"]) {
    it(`Form ${code}: the recorded end wins over the arrival wording`, () => {
      const ended = arrivedOn(code, "revoked");
      // A1: a recorded end asks for no next form, and nothing else is inferred.
      expect(formProgression(ended)).toBeUndefined();
      expect(legalFormEnd(ended)).toEqual({ kind: "recorded" });
      expect(legalDeadlineText(ended, NOW)).toBe("Form ended");
      expect(legalEndAsTyped(ended, NOW, new Date("2026-10-19T00:00:00Z"))).toBe(FORM_RECORDED_ENDED);
    });

    it(`Form ${code}: still neutral at arrival when no end is recorded (D-127)`, () => {
      const open = arrivedOn(code);
      expect(legalFormEnd(open)).toEqual({ kind: "progressed", progression: { formCode: code, when: "at arrival" } });
      expect(legalEndAsTyped(open, NOW, new Date("2026-10-19T00:00:00Z"))).toBe(`On Form ${code} at arrival`);
    });
  }

  // A1 (Josh, 13 Nov 2026): arrival no longer ends a transfer form by itself, so a recorded end is
  // the only end, and it reads the same as every other recorded end.
  it("a transfer form recorded as ended reads as recorded ended, never as ended at arrival", () => {
    const ended = arrivedOn("4C", "revoked");
    expect(legalFormEnd(ended)).toEqual({ kind: "recorded" });
    expect(legalEndAsTyped(ended, NOW, new Date("2026-10-19T00:00:00Z"))).toBe(FORM_RECORDED_ENDED);
  });
});
