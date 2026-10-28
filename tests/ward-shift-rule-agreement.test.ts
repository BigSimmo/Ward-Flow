// Audit P104: at 15:00 the rail's shift label and Handover chip must follow the same shift rule as
// the rest of the app (`SHIFT_PATTERN`), with the chip counting to the handover the Handover page
// would choose as next.
import { describe, expect, it } from "vitest";

import { defaultHandoverShift, handoverAt } from "@/components/ward-management/handover/handover-model";
import { computeShiftProgress } from "@/components/ward-management/shell/ward-rail";
import { currentShift, shiftAtMinute } from "@/components/ward-management/ward-board-time-features";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const DAY = 24 * 60;
const midnight = NOW_ANCHOR - (NOW_ANCHOR % DAY);

describe("one shift rule for the rail and the Handover chip (audit P104)", () => {
  it.each([
    ["06:59", 6 * 60 + 59, "Night Shift"],
    ["07:00", 7 * 60, "Day Shift"],
    ["14:59", 14 * 60 + 59, "Day Shift"],
    ["15:00", 15 * 60, "Evening Shift"],
    ["22:59", 22 * 60 + 59, "Evening Shift"],
    ["23:00", 23 * 60, "Night Shift"],
  ])("at %s (minute %i) the shift is %s everywhere", (_clock, minute, name) => {
    expect(shiftAtMinute(minute).name).toBe(name);
    expect(currentShift(midnight + minute).name).toBe(name);
    expect(computeShiftProgress(minute).shiftTitle.startsWith(name)).toBe(true);
  });

  it.each([14 * 60 + 59, 15 * 60, 22 * 60 + 59, 23 * 60, 6 * 60 + 59])(
    "the chip counts to the handover the Handover page chooses next (minute %i)",
    (minute) => {
      const now = midnight + minute;
      const chip = computeShiftProgress(minute);
      expect(chip.remainingMinutes).toBe(handoverAt(defaultHandoverShift(now), now) - now);
    },
  );

  it("the chip reads Handover Due only in the last 15 minutes, and not from 15:00", () => {
    expect(computeShiftProgress(14 * 60 + 59).handoverDue).toBe(true);
    expect(computeShiftProgress(15 * 60).handoverDue).toBe(false);
    expect(computeShiftProgress(15 * 60).countdownStr).toBe("8h 0m");
  });
});
