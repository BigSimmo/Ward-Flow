import { describe, expect, it } from "vitest";

import { CLINICAL_VALUE_LIST } from "@/components/ward-management/ward-clinical-value-notes";
import { CLINICAL_VALUES, formatClinicalFigure } from "@/components/ward-management/ward-clinical-values";

/**
 * Time audit T10 (D-194, Josh 13 Nov 2026): the break glass pattern window and the cover length stay
 * at 12 hours, and the register says "12 hours", never "one shift" (Ward Flow's shifts are 8 hours).
 */

const line = (entry: { name: string; value: number; unit: Parameters<typeof formatClinicalFigure>[1] }) =>
  `${entry.name} ${formatClinicalFigure(entry.value, entry.unit)}`;

describe("12 hours, not one shift (T10)", () => {
  const { breakGlassPerShift, breakGlassShift, coverLength } = CLINICAL_VALUES;

  it("keeps both figures at 12 hours", () => {
    expect(breakGlassShift.value).toBe(12);
    expect(coverLength.value).toBe(12);
  });

  it("never calls 12 hours one shift", () => {
    for (const entry of [breakGlassPerShift, breakGlassShift, coverLength]) {
      expect(line(entry)).not.toMatch(/\bshift\b/iu);
    }
    for (const id of ["breakGlassPerShift", "breakGlassShift", "coverLength"]) {
      const source = CLINICAL_VALUE_LIST.find((entry) => entry.id === id)?.source;
      expect(source, id).toBeDefined();
      expect(source).not.toMatch(/one shift,/iu);
    }
    expect(line(breakGlassShift)).toMatch(/12 hours$/u);
    expect(line(coverLength)).toMatch(/12 hours$/u);
    // The pattern count names the same counting window, whose figure reads in hours.
    expect(breakGlassPerShift.name).toContain("counting window");
    expect(breakGlassShift.name).toMatch(/^Counting window/u);
  });
});
