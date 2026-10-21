import { describe, expect, it } from "vitest";

import {
  downtimePackDue,
  isShiftChangeMoment,
  nextDowntimePackAt,
} from "@/components/ward-management/reports/downtime-pack-schedule";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";

const at = (hours: number, minutes = 0, day = 0) => day * MINUTES_PER_DAY + hours * 60 + minutes;

describe("downtime pack schedule (fix plan item 9)", () => {
  it("replaces a pack at the next whole hour", () => {
    expect(nextDowntimePackAt(at(10, 42))).toBe(at(11));
    expect(nextDowntimePackAt(at(11))).toBe(at(12));
    expect(nextDowntimePackAt(at(11, 59))).toBe(at(12));
  });

  it("lands on every shift change: 07:00, 15:00 and 23:00", () => {
    expect(nextDowntimePackAt(at(14, 20))).toBe(at(15));
    expect(nextDowntimePackAt(at(6, 1))).toBe(at(7));
    expect(nextDowntimePackAt(at(22, 30))).toBe(at(23));
    for (const hour of [7, 15, 23]) expect(isShiftChangeMoment(at(hour))).toBe(true);
    expect(isShiftChangeMoment(at(14))).toBe(false);
    expect(isShiftChangeMoment(at(15, 1))).toBe(false);
  });

  it("carries across midnight and works on any day of the demonstration", () => {
    expect(nextDowntimePackAt(at(23, 30))).toBe(at(0, 0, 1));
    expect(nextDowntimePackAt(at(6, 59, 3))).toBe(at(7, 0, 3));
    expect(nextDowntimePackAt(at(22, 10, -1))).toBe(at(23, 0, -1));
    expect(isShiftChangeMoment(at(7, 0, -2))).toBe(true);
  });

  it("is due from the replacement moment, never before", () => {
    const taken = at(14, 20);
    expect(downtimePackDue(taken, at(14, 59))).toBe(false);
    expect(downtimePackDue(taken, at(15))).toBe(true);
    expect(downtimePackDue(taken, at(18, 5))).toBe(true);
  });

  it("is due when the clock is set back before the pack was taken", () => {
    expect(downtimePackDue(at(14, 20), at(9))).toBe(true);
  });
});
