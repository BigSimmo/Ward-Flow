import { describe, expect, it } from "vitest";

import { departureDayLabel } from "@/components/ward-management/out-of-area/out-of-area-model";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import type { RepatriationRecord } from "@/components/ward-management/ward-flow-reducer";

// A night shift runs past midnight, so This shift can hold a departure that fell yesterday.
const at = (estimatedAt: number) => ({ estimatedAt }) as RepatriationRecord;

describe("departureDayLabel", () => {
  const now = 10 * MINUTES_PER_DAY + 30; // 00:30 on day 10

  it("names yesterday, today and tomorrow from the calendar day, not a two-way guess", () => {
    expect(departureDayLabel(at(10 * MINUTES_PER_DAY - 30), now)).toBe("Yesterday");
    expect(departureDayLabel(at(10 * MINUTES_PER_DAY + 600), now)).toBe("Today");
    expect(departureDayLabel(at(11 * MINUTES_PER_DAY + 60), now)).toBe("Tomorrow");
    expect(departureDayLabel(at(13 * MINUTES_PER_DAY), now)).toBe("In 3 days");
  });
});
