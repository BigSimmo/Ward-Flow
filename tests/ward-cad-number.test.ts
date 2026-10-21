import { describe, expect, it } from "vitest";

import { CAD_NUMBER_MAX_LENGTH, cadNumberProblem } from "@/components/ward-management/ward-cad-number";
import { transportAnswersBlockedReason } from "@/components/ward-management/ward-transport-checks";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * HAZ-03 (#430): a CAD dispatch number is checked for shape and for placeholders. This is a
 * plausibility floor; the provider's real number syntax is not confirmed, so these cases are
 * synthetic shapes only.
 */
describe("cadNumberProblem", () => {
  it.each(["CAD-2026-0001", "CAD-1", "SJ 48213", "WA/2026/77", "84920", "cad-4412"])("accepts %s", (value) => {
    expect(cadNumberProblem(value)).toBeUndefined();
  });

  it("asks for a number when blank", () => {
    expect(cadNumberProblem("")).toBe("enter the CAD transport number");
    expect(cadNumberProblem("   ")).toBe("enter the CAD transport number");
  });

  it.each([
    "TBC",
    "tba",
    "TBD",
    "N/A",
    "NA",
    "nil",
    "None",
    "unknown",
    "Pending",
    "CAD TBC",
    "TBC-1",
    "TBC1",
    "awaiting CAD",
    "ASAP",
  ])("refuses the placeholder %s", (value) => {
    expect(cadNumberProblem(value)).toMatch(/placeholder|no digits/);
  });

  it.each(["0", "0000", "CAD-0000", "CAD 000"])("refuses the all-zero number %s", (value) => {
    expect(cadNumberProblem(value)).toContain("all zeros");
  });

  it.each(["9999", "XXXX", "x-xxx", "11/11"])("refuses the filler %s", (value) => {
    expect(cadNumberProblem(value)).toMatch(/repeats one character|no digits/);
  });

  it.each(["CAD", "Booked", "ambulance called", "SJA-ABC"])("refuses %s, which holds no digits", (value) => {
    expect(cadNumberProblem(value)).toContain("no digits");
  });

  it.each(["CAD#123", "123?", "-123", "CAD_123", "CAD.123", "1234\n5678"])(
    "refuses the stray characters in %j",
    (value) => {
      expect(cadNumberProblem(value)).toContain("only letters, digits");
    },
  );

  it("refuses free text longer than a dispatch number", () => {
    expect(cadNumberProblem(`CAD ${"1".repeat(CAD_NUMBER_MAX_LENGTH)}`)).toContain("longer than");
    expect(cadNumberProblem("1".repeat(CAD_NUMBER_MAX_LENGTH - 1) + "2")).toBeUndefined();
  });
});

describe("the booking form reads the same rule", () => {
  const answered = {
    provider: "Ambulance service",
    escortRequired: true,
    transportLegalStatus: "voluntary",
    estimatedTime: "14:30",
    estimatedDay: "tomorrow",
  } as const;

  it("blocks confirm on a placeholder and says why", () => {
    const reason = transportAnswersBlockedReason({ ...answered, cadNumber: "TBC" }, NOW_ANCHOR);
    expect(reason).toContain("placeholder");
  });

  it("allows confirm once a plausible number is entered", () => {
    expect(transportAnswersBlockedReason({ ...answered, cadNumber: "CAD-2026-0001" }, NOW_ANCHOR)).toBeUndefined();
  });
});
