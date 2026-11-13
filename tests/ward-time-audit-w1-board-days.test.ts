import { describe, expect, it } from "vitest";

import { buildOccupants, expectedPhrase } from "@/components/ward-management/board/ward-board-model";
import { dailySheetPeople } from "@/components/ward-management/board/ward-daily-sheet";
import { admissionsForUnit, bedIsOccupied, type Admission } from "@/components/ward-management/ward-admissions";
import { WARD_ADMISSIONS_ANCHOR, wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import type { Unit } from "@/components/ward-management/ward-model";
import { wardSites } from "@/components/ward-management/ward-sites";

/**
 * Time audit T1 (13 Nov 2026): the ward board and the daily sheet count discharge days by Perth
 * calendar day, not by 24-hour blocks. A date tomorrow morning is never "due today", and a date
 * 19 minutes ago is never "1 day overdue". `pastDate` still reads the exact time.
 */
const UNIT_ID = "rph-adult-secure";
const unit = wardSites.flatMap((site) => site.units).find((candidate) => candidate.id === UNIT_ID) as Unit;
const person = admissionsForUnit(wardAdmissions, UNIT_ID).find(bedIsOccupied) as Admission;

function withExpected(expectedDischargeAt: number): Admission[] {
  return wardAdmissions.map((admission) =>
    admission.id === person.id ? { ...admission, expectedDischargeAt } : admission,
  );
}

// A synthetic evening: 20:00 on the anchor's day.
const dayStart = Math.floor(WARD_ADMISSIONS_ANCHOR / MINUTES_PER_DAY) * MINUTES_PER_DAY;
const evening = dayStart + 20 * 60;
const morning = dayStart + 8 * 60 + 19;

function occupantAt(expected: number, now: number) {
  const occupant = buildOccupants(unit, withExpected(expected), now).find((row) => row.key === person.id);
  const sheet = dailySheetPeople(withExpected(expected), UNIT_ID, now).find((row) => row.key === person.id);
  return { occupant, sheet };
}

describe("discharge days by calendar day (T1)", () => {
  it("counts tomorrow 08:00 as one day away at 20:00, not today", () => {
    const { occupant, sheet } = occupantAt(dayStart + MINUTES_PER_DAY + 8 * 60, evening);
    expect(occupant?.expectedDays).toBe(1);
    expect(sheet?.expectedDays).toBe(1);
    expect(occupant?.pastDate).toBe(false);
    expect(expectedPhrase(occupant?.expectedDays ?? null)).toBe("Expected out in 1 day");
  });

  it("counts 08:00 today as today, past, at 08:19, never one day overdue", () => {
    const { occupant, sheet } = occupantAt(dayStart + 8 * 60, morning);
    expect(occupant?.expectedDays).toBe(0);
    expect(sheet?.expectedDays).toBe(0);
    expect(occupant?.pastDate).toBe(true);
    expect(sheet?.pastDate).toBe(true);
    expect(expectedPhrase(0)).toBe("Expected out today");
  });

  it("counts 22:00 yesterday as one day past at 01:00", () => {
    const { occupant, sheet } = occupantAt(dayStart - 2 * 60, dayStart + 60);
    expect(occupant?.expectedDays).toBe(-1);
    expect(sheet?.expectedDays).toBe(-1);
    expect(expectedPhrase(-1)).toBe("1 day past the ward's expected date");
  });
});
