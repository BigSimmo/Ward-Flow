// Audit 24-6 (time and clocks), fixes C: TC-03 and TC-06, read at the model level.
import { describe, expect, it } from "vitest";
import { parseWrittenInstant } from "@/components/ward-management/legal-forms/legal-forms-sheets";
import { HANDOVER_SHIFTS } from "@/components/ward-management/handover/handover-model";
import { SHIFT_PATTERN } from "@/components/ward-management/ward-operational-defaults";
import { perthMidnight } from "@/components/ward-management/ward-clock";

const DAY = 1440;
const dayZero = perthMidnight(2026, 9, 24);

describe("TC-03: time written on the form, with its date", () => {
  it("records a form written at 23:50 on day 0 when entered at 00:10 on day 1", () => {
    expect(parseWrittenInstant("23:50", DAY + 10, "2026-10-24", dayZero)).toBe(23 * 60 + 50);
  });

  it("still refuses 23:50 with a blank date at 00:10 (blank means today, and today's 23:50 is ahead)", () => {
    expect(parseWrittenInstant("23:50", DAY + 10)).toBeNull();
    expect(parseWrittenInstant("23:50", DAY + 10, "", dayZero)).toBeNull();
  });

  it("keeps the blank-date reading as today", () => {
    expect(parseWrittenInstant("00:05", DAY + 10)).toBe(DAY + 5);
  });

  it("refuses a typed date and time later than now", () => {
    expect(parseWrittenInstant("00:11", DAY + 10, "2026-10-25", dayZero)).toBeNull();
    expect(parseWrittenInstant("09:00", DAY + 10, "2026-10-26", dayZero)).toBeNull();
  });

  it("refuses a malformed date or time, and a date with no day zero to read it against", () => {
    expect(parseWrittenInstant("23:50", DAY + 10, "2026-02-30", dayZero)).toBeNull();
    expect(parseWrittenInstant("2350", DAY + 10, "2026-10-24", dayZero)).toBeNull();
    expect(parseWrittenInstant("", DAY + 10, "2026-10-24", dayZero)).toBeNull();
    expect(parseWrittenInstant("23:50", DAY + 10, "2026-10-24")).toBeNull();
  });
});

describe("TC-06: handover times come from the one shift pattern", () => {
  it("starts each handover at a SHIFT_PATTERN shift start, in order", () => {
    expect(HANDOVER_SHIFTS.map((shift) => shift.minute)).toEqual(SHIFT_PATTERN.map((shift) => shift.startMinute));
    expect(HANDOVER_SHIFTS.map((shift) => shift.minute)).toEqual([7 * 60, 15 * 60, 23 * 60]);
  });
});
