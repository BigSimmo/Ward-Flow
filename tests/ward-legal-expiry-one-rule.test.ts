import { describe, expect, it } from "vitest";

import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { currentLegalStanding } from "@/components/ward-management/ward-legal-form-progression";
import { formExpiryLevel, formExpiryWarning } from "@/components/ward-management/ed/ed-screen-model";
import { formReadinessState } from "@/components/ward-management/movements/movement-cockpit-readiness";
import { LEGAL_FORM_ENDINGS, type LegalForm } from "@/components/ward-management/ward-model-vocabulary";

/**
 * R-LEGAL-2 (design lane C, 14 Nov 2026): one legal-expiry rule, proven on every screen. The same
 * typed form at 4 h, 2 h and 45 min out, passed and recorded ended goes through the shared band rule
 * (Forms, Delays, TV, ward) and each screen's own wrapper (ED row, ED warning, Movements). Every
 * wrapper must agree with the rule, so the ED board cannot drift again (MCA-M4, LG-1).
 * Synthetic forms only.
 */
const now = 24 * 60;
const thresholds = DEFAULT_DUE_SOON_THRESHOLDS;
const typed = (minutesLeft: number): LegalForm => ({ code: "1A", kind: "examination", dueAt: now + minutesLeft });

const cases = [
  { name: "4 h out", form: typed(240), standing: "later", level: undefined },
  { name: "2 h out", form: typed(120), standing: "soon", level: "warning" },
  { name: "45 min out", form: typed(45), standing: "urgent", level: "danger" },
  { name: "passed", form: typed(-30), standing: "passed", level: "danger" },
  {
    name: "recorded ended",
    form: { ...typed(-30), endedBy: LEGAL_FORM_ENDINGS[0] },
    standing: "none",
    level: undefined,
  },
] as const;

describe("one legal-expiry rule on every screen (R-LEGAL-2)", () => {
  for (const { name, form, standing, level } of cases) {
    it(`${name}: the shared rule and every screen's wrapper agree`, () => {
      expect(currentLegalStanding({ legalForm: form }, now, thresholds)).toBe(standing);
      // ED row colour and ED warning words.
      expect(formExpiryLevel(form, now, thresholds)).toBe(level);
      const warning = formExpiryWarning(form, now, thresholds);
      if (standing === "passed") expect(warning).toMatch(/past the expiry/u);
      else if (standing === "urgent") expect(warning).toMatch(/^Act now/u);
      else if (standing === "soon") expect(warning).toMatch(/close/u);
      else expect(warning).toBeUndefined();
      // Movements readiness.
      const readiness = formReadinessState(form, now, thresholds);
      if (standing === "passed") expect(readiness).toBe("Recorded. Deadline passed.");
      else if (standing === "urgent" || standing === "soon") expect(readiness).toBe("Recorded. Deadline close.");
      else if (standing === "later") expect(readiness).toBe("Recorded. Deadline ahead.");
      else expect(readiness).toBe("Recorded as ended.");
    });
  }
});
