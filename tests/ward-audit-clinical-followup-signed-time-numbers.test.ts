// Clinical follow-up to audit M16 (Josh, 10 Nov 2026, D-130): the last time and age numbers screens
// typed inline are signed as they were, live in the values file, and are what the screens read.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import {
  BED_BOARD_CHIP_WAIT_WARNING_MINUTES,
  ED_REFERRED_NOT_SEEN_MINUTES,
  ED_STATISTICS_FIRST_BAND_EDGE_MINUTES,
  ED_STATISTICS_THIRD_BAND_EDGE_MINUTES,
  OLDER_ADULT_AGE_BAND_FROM_YEARS,
  TV_LEAVE_DUE_BACK_WINDOW_MINUTES,
  YOUTH_AGE_BAND_UNDER_YEARS,
  YOUTH_SERVICE_NOTE_UP_TO_YEARS,
} from "@/components/ward-management/ward-operational-defaults";
import { ED_WAIT_BANDS } from "@/components/ward-management/statistics/statistics-ed-waits";
import { referralAgeBand, YOUTH_UP_TO_24_NOTE } from "@/components/ward-management/referrals/referral-age-band";
import { cohortFitsAge, patientCohort } from "@/components/ward-management/ward-patients";

const WARD_DIR = "src/components/ward-management";
const SIGNED = { status: "signed", signedBy: "Josh (product owner)", signedOn: "2026-11-10" };

describe("M16 follow-up: signed as they were, and read by the screens", () => {
  it("keeps every value as it was typed, signed by Josh on 10 Nov 2026", () => {
    const expected = {
      tvLeaveDueBack: [TV_LEAVE_DUE_BACK_WINDOW_MINUTES, 12 * 60],
      edReferredNotSeen: [ED_REFERRED_NOT_SEEN_MINUTES, 60],
      edStatisticsFirstBandEdge: [ED_STATISTICS_FIRST_BAND_EDGE_MINUTES, 4 * 60],
      edStatisticsThirdBandEdge: [ED_STATISTICS_THIRD_BAND_EDGE_MINUTES, 12 * 60],
      bedBoardReferralWaitWarning: [BED_BOARD_CHIP_WAIT_WARNING_MINUTES, 240],
      youthAgeBandUnder: [YOUTH_AGE_BAND_UNDER_YEARS, 18],
      olderAdultAgeBandFrom: [OLDER_ADULT_AGE_BAND_FROM_YEARS, 65],
      youthServiceNoteUpTo: [YOUTH_SERVICE_NOTE_UP_TO_YEARS, 24],
    } as const;
    for (const [id, [constant, typed]] of Object.entries(expected)) {
      const entry = CLINICAL_VALUES[id as keyof typeof expected];
      expect(entry, id).toMatchObject(SIGNED);
      expect(entry.value, id).toBe(typed);
      expect(constant, id).toBe(entry.value);
    }
  });

  it("each screen reads its constant instead of a typed number", () => {
    const reads: Record<string, string[]> = {
      "bed-meeting/tv-clinical-derivations.ts": ["TV_LEAVE_DUE_BACK_WINDOW_MINUTES"],
      "ed/ed-screen-derivations.ts": ["waited > ED_REFERRED_NOT_SEEN_MINUTES"],
      "statistics/statistics-ed-waits.ts": [
        "ED_STATISTICS_FIRST_BAND_EDGE_MINUTES",
        "ED_STATISTICS_THIRD_BAND_EDGE_MINUTES",
      ],
      "ward/ward-bed-board.tsx": ["referral.waitedMinutes >= BED_BOARD_CHIP_WAIT_WARNING_MINUTES"],
      "referrals/referral-age-band.ts": [
        "age < YOUTH_AGE_BAND_UNDER_YEARS",
        "age >= OLDER_ADULT_AGE_BAND_FROM_YEARS",
        "age <= YOUTH_SERVICE_NOTE_UP_TO_YEARS",
      ],
      "ward-patients.ts": [
        "age < YOUTH_AGE_BAND_UNDER_YEARS",
        "age >= OLDER_ADULT_AGE_BAND_FROM_YEARS",
        "<= YOUTH_SERVICE_NOTE_UP_TO_YEARS",
      ],
    };
    for (const [file, needles] of Object.entries(reads)) {
      const source = readFileSync(join(WARD_DIR, file), "utf8");
      for (const needle of needles) expect(source, `${file}: ${needle}`).toContain(needle);
    }
    const tv = readFileSync(join(WARD_DIR, "bed-meeting/tv-clinical-derivations.ts"), "utf8");
    expect(tv).not.toContain("now <= 12 * 60");
    const bands = readFileSync(join(WARD_DIR, "statistics/statistics-ed-waits.ts"), "utf8");
    expect(bands).not.toMatch(/\b(?:4|12) \* 60\b|"Under 4 hours"/);
  });

  it("behaves exactly as before: band labels and age bands", () => {
    expect(ED_WAIT_BANDS.map((band) => [band.label, band.fromMinutes])).toEqual([
      ["Under 4 hours", 0],
      ["4 to 8 hours", 240],
      ["8 to 12 hours", 480],
      ["12 to 24 hours", 720],
      ["Over 24h", 1440],
    ]);
    const day = new Date("2026-10-24T00:00:00.000Z");
    const born = (years: number) => `${2026 - years}-01-01`;
    expect(referralAgeBand(born(17), day)).toEqual({ band: "Youth" });
    expect(referralAgeBand(born(18), day)).toEqual({ band: "Adult", note: YOUTH_UP_TO_24_NOTE });
    expect(referralAgeBand(born(24), day)).toEqual({ band: "Adult", note: YOUTH_UP_TO_24_NOTE });
    expect(referralAgeBand(born(25), day)).toEqual({ band: "Adult" });
    expect(referralAgeBand(born(64), day)).toEqual({ band: "Adult" });
    expect(referralAgeBand(born(65), day)).toEqual({ band: "Older adult" });
    expect(patientCohort(born(17), day)).toBe("Youth");
    expect(patientCohort(born(65), day)).toBe("Older adult");
    expect(cohortFitsAge("Youth", born(24), day)).toBe(true);
    expect(cohortFitsAge("Youth", born(25), day)).toBe(false);
  });
});
