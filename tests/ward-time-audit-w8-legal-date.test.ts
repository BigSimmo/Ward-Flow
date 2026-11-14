import { describe, expect, it } from "vitest";

import {
  typedClock,
  typedTimeLine,
  typedTimePhrase,
} from "../src/components/ward-management/legal-forms/legal-time-as-typed";
import { MINUTES_PER_DAY, perthMidnight } from "../src/components/ward-management/ward-clock";

/**
 * D1 (time audit, 13 Nov 2026), enforcing D-93: a legal time is shown as typed, never as an age or a
 * countdown. A typed time on another day used to read "Ended 15:42, 3 days ago as typed"; it now
 * carries the Perth calendar date the form shows instead.
 */

// Day 0 is Friday 13 Nov 2026 in Perth; 10:00 that morning is now.
const DAY_ZERO = perthMidnight(2026, 10, 13);
const NOW = 10 * 60;
const AT_1542 = 15 * 60 + 42;

describe("legal times on another day show the date, never an age (D1, D-93)", () => {
  it("prints the date for a typed time three days before now", () => {
    const line = typedTimeLine(AT_1542 - 3 * MINUTES_PER_DAY, NOW, DAY_ZERO);
    expect(line).toBe("Ended Tue 10 Nov 15:42");
    expect(line).not.toMatch(/\bago\b|\bin \d+ days?\b/);
  });

  it("prints the date for a typed time three days after now", () => {
    const phrase = typedTimePhrase(AT_1542 + 3 * MINUTES_PER_DAY, NOW, DAY_ZERO);
    expect(phrase).toBe("ends Mon 16 Nov 15:42");
    expect(phrase).not.toMatch(/\bago\b|\bin \d+ days?\b/);
  });

  it("keeps a bare clock for today and the day names for yesterday and tomorrow", () => {
    expect(typedClock(AT_1542, NOW, DAY_ZERO)).toBe("15:42");
    expect(typedClock(AT_1542 - MINUTES_PER_DAY, NOW, DAY_ZERO)).toBe("15:42 yesterday");
    expect(typedClock(AT_1542 + MINUTES_PER_DAY, NOW, DAY_ZERO)).toBe("15:42 tomorrow");
  });

  it("never prints an age even when no calendar day is known", () => {
    expect(typedClock(AT_1542 - 3 * MINUTES_PER_DAY, NOW, undefined)).toBe("15:42 on an earlier day");
    expect(typedClock(AT_1542 + 3 * MINUTES_PER_DAY, NOW, undefined)).toBe("15:42 on a later day");
  });
});
