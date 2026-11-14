import { describe, expect, it } from "vitest";
import { MAX_TEXT } from "../backend/ward-flow/command-schemas";
import {
  EMPTY_EXTRAS,
  PATIENT_TEXT_LIMIT,
  overLimitFieldLabel,
} from "@/components/ward-management/patients/add-patient-sections";

describe("add patient text limit", () => {
  it("matches the server limit", () => {
    expect(PATIENT_TEXT_LIMIT).toBe(MAX_TEXT);
  });
  it("names a field over the limit", () => {
    expect(overLimitFieldLabel(EMPTY_EXTRAS)).toBeUndefined();
    expect(overLimitFieldLabel({ ...EMPTY_EXTRAS, address: "x".repeat(PATIENT_TEXT_LIMIT + 1) })).toBe(
      "Street address",
    );
  });
});
