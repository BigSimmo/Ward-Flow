import { describe, expect, it } from "vitest";
import { formatInstant, formatRemaining, splitDuration } from "@/components/ward-management/ward-clock";
import { formatDateOfBirth } from "@/components/ward-management/ward-patients";
import { BAND_LABELS } from "@/components/ward-management/discharges/discharge-board-model";

describe("Tier 1 - Feature 11: 24-Hour Clinical Time & Australian DOB Formatting", () => {
  it("formats instants strictly using 24-hour HH:MM notation", () => {
    // 0 minutes = 00:00 midnight
    expect(formatInstant(0)).toBe("00:00");
    // 642 minutes = 10:42 AM
    expect(formatInstant(642)).toBe("10:42");
    // 960 minutes = 16:00 (4 PM)
    expect(formatInstant(960)).toBe("16:00");
    // 1439 minutes = 23:59
    expect(formatInstant(1439)).toBe("23:59");
  });

  it("handles negative instants and roll-overs into 24-hour range without hyphenated times", () => {
    // -60 minutes = 23:00 previous day
    expect(formatInstant(-60)).toBe("23:00");
    // 1500 minutes (25h) = 01:00 next day
    expect(formatInstant(1500)).toBe("01:00");
  });

  it("formats Australian Date of Birth in DD/MM/YYYY format", () => {
    expect(formatDateOfBirth("1988-11-23")).toBe("23/11/1988");
    expect(formatDateOfBirth("2002-04-05")).toBe("05/04/2002");
    expect(formatDateOfBirth("1955-12-31")).toBe("31/12/1955");
  });

  it("handles missing or unrecorded date of birth safely with clinical fallback string", () => {
    expect(formatDateOfBirth(null)).toBe("DOB not recorded");
    expect(formatDateOfBirth(undefined)).toBe("DOB not recorded");
    expect(formatDateOfBirth("")).toBe("DOB not recorded");
  });

  it("checks discharge board release band labels conform to expected notation", () => {
    expect(BAND_LABELS["now"]).toBe("Now");
    expect(BAND_LABELS["by-midday"]).toBe("By midday");
    // Key discharge band label for by-1600
    expect(BAND_LABELS["by-1600"]).toBe("Expected by 16:00");
    expect(BAND_LABELS["tonight"]).toBe("Tonight");
    expect(BAND_LABELS["tomorrow"]).toBe("Tomorrow");
  });
});
