import { describe, expect, it } from "vitest";

import { legalStatusFigure } from "@/components/ward-management/patients/patient-now-screen";

describe("Patient page Legal status figure", () => {
  it("shows the status's first word", () => {
    expect(legalStatusFigure("Voluntary")).toBe("Voluntary");
    expect(legalStatusFigure("Involuntary patient")).toBe("Involuntary");
  });

  it("keeps Not recorded whole instead of shrinking it to one word", () => {
    expect(legalStatusFigure(undefined)).toBe("Not recorded");
    expect(legalStatusFigure("")).toBe("Not recorded");
    expect(legalStatusFigure("Not recorded")).toBe("Not recorded");
    expect(legalStatusFigure("Legal status not recorded")).toBe("Not recorded");
  });
});
