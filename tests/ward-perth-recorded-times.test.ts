import { afterEach, describe, expect, it, vi } from "vitest";
import {
  perthClockTime,
  perthDateLabel,
  perthDateText,
  perthMidnight,
  perthWeekdayTime,
} from "@/components/ward-management/ward-clock";
import { recordedDate } from "@/components/ward-management/discharges/discharge-board-model";
import { noticeDraftKept } from "@/components/ward-management/referrals/referral-draft-saved-notice";
import {
  todaysMidlandContacts,
  type MidlandDecision,
} from "@/components/ward-management/community/team-2026/midland-decisions";

/*
 * Content and locale audit, 5 Nov 2026. CL-2: recorded times read on the Perth clock, as the board
 * does, whatever the device's zone. CL-3: Midland's Today's log is the Perth day. CL-4: a short
 * day is written "Wed 4 Nov", with no comma after the weekday. Synthetic times only.
 */
const ZONES = ["Australia/Perth", "Australia/Sydney", "UTC", "America/New_York"] as const;
// 23:30 AWST on Thu 5 Nov 2026, and 00:30 AWST on Fri 6 Nov.
const LATE_THURSDAY = new Date("2026-11-05T15:30:00Z");
const EARLY_FRIDAY = new Date("2026-11-05T16:30:00Z");

afterEach(() => vi.unstubAllEnvs());

describe.each(ZONES)("Perth recorded times in a %s browser", (zone) => {
  it("reads a recorded moment on the Perth clock (CL-2)", () => {
    vi.stubEnv("TZ", zone);
    expect(perthClockTime(LATE_THURSDAY)).toBe("23:30");
    expect(perthWeekdayTime(LATE_THURSDAY)).toBe("Thu 23:30");
    const push = vi.fn(() => "t");
    expect(noticeDraftKept({ push }, true, 0, LATE_THURSDAY)).toBe("Draft saved at 23:30");
  });

  it("counts a Thursday-night contact as yesterday on Friday morning in Perth (CL-3)", () => {
    vi.stubEnv("TZ", zone);
    const all: Record<string, MidlandDecision> = {
      "contact:a:1": { id: "contact:a:1", line: "a", at: LATE_THURSDAY.getTime() },
    };
    expect(todaysMidlandContacts(all, EARLY_FRIDAY)).toEqual([]);
    expect(todaysMidlandContacts(all, new Date("2026-11-05T01:00:00Z"))).toHaveLength(1);
  });
});

describe("a short day has no comma after the weekday (CL-4)", () => {
  const zero = perthMidnight(2026, 10, 4);
  it("writes Wed 4 Nov", () => {
    expect(perthDateLabel(0, zero, { weekday: "short", day: "numeric", month: "short" })).toBe("Wed 4 Nov");
    expect(perthDateText(zero, { weekday: "short", day: "numeric", month: "short", year: "numeric" })).toBe(
      "Wed 4 Nov 2026",
    );
    expect(recordedDate(600, zero)).toBe("Wed 4 Nov");
  });
});
