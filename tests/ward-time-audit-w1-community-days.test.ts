import { describe, expect, it } from "vitest";

import {
  departureLabel,
  expectedBackLabel,
  nextHomeWhen,
} from "@/components/ward-management/community/community-screen-helpers";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";

/**
 * Time audit D2 and D3 (13 Nov 2026): the community hub says "earlier today", "later today",
 * "Today" and "Tomorrow" by Perth calendar day, never by 24-hour blocks or a rounded day count.
 */
const dayStart = 3 * MINUTES_PER_DAY;
const at = (hours: number, days = 0) => dayStart + days * MINUTES_PER_DAY + hours * 60;
const stay = (fields: Partial<Admission>) => fields as Admission;

describe("community day words by calendar day (D2)", () => {
  it("says yesterday's 22:00 was one day ago at 01:00, not earlier today", () => {
    expect(expectedBackLabel(stay({ expectedDischargeAt: at(22, -1) }), at(1))).toBe(
      "Expected discharge was 1 day ago",
    );
    expect(expectedBackLabel(stay({ expectedDischargeAt: at(1) }), at(10))).toBe(
      "Expected discharge was earlier today",
    );
  });

  it("says tomorrow's 08:00 is in 1 day at 20:00, not later today", () => {
    expect(expectedBackLabel(stay({ expectedDischargeAt: at(8, 1) }), at(20))).toBe("Expected discharge in 1 day");
    expect(expectedBackLabel(stay({ expectedDischargeAt: at(22) }), at(20))).toBe("Expected discharge is later today");
  });

  it("says a departure at 23:00 yesterday was one day ago at 01:00", () => {
    expect(departureLabel(stay({ leftAt: at(23, -1) }), at(1))).toBe("Left this ward 1 day ago");
    expect(departureLabel(stay({ leftAt: at(0.5) }), at(1))).toBe("Left this ward earlier today");
  });
});

describe("community hero next home by calendar day (D3)", () => {
  it("says Tomorrow for 08:00 tomorrow at 20:00, not Today", () => {
    expect(nextHomeWhen(at(8, 1), at(20))).toBe("Tomorrow");
  });

  it("says Today for later today and In 2 days for 01:00 two days on at 23:00", () => {
    expect(nextHomeWhen(at(23), at(9))).toBe("Today");
    expect(nextHomeWhen(at(1, 2), at(23))).toBe("In 2 days");
  });
});
