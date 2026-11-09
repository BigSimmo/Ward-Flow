import { describe, expect, it } from "vitest";

import { fitLine, fitLineText } from "@/components/ward-management/coordinator/shortlist-fit-line";
import type { GateResult } from "@/components/ward-management/ward-eligibility";

const gate = (g: GateResult["gate"], pass: boolean, info?: true, need?: true): GateResult => ({
  gate: g,
  pass,
  detail: "",
  ...(info ? { info } : {}),
  ...(need ? { need } : {}),
});

describe("shortlist fit line", () => {
  it("names met, not met and to-confirm groups in a fixed order", () => {
    const line = fitLine([
      gate("gender_designation", true),
      gate("sex_mix", true),
      gate("security", true),
      gate("legal_status", true),
      gate("age", false),
      gate("specialling", true, true, true),
      gate("allocatable_bed", true),
    ]);
    expect(line).toEqual({ met: ["Sex", "Security"], notMet: ["Age"], toConfirm: ["Special care"] });
    expect(fitLineText(line)).toBe("Fits sex and security · Not met: age · Check special care");
  });

  it("asks for no special-care check when the patient needs none", () => {
    const line = fitLine([gate("security", true), gate("acuity", true, true), gate("specialling", true, true)]);
    expect(line).toEqual({ met: ["Security"], notMet: [], toConfirm: [] });
  });

  it("one failing gate makes the whole group not met", () => {
    expect(fitLine([gate("security", true), gate("forensic", false)]).notMet).toEqual(["Security"]);
  });

  it("says nothing when no group was checked", () => {
    expect(fitLineText(fitLine([gate("allocatable_bed", true)]))).toBeUndefined();
  });
});
