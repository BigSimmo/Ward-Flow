import { describe, expect, it, vi } from "vitest";

import {
  formatStatutoryDateTime,
  parseDateTimeInput,
  toDateInputValue,
  toTimeInputValue,
} from "@/components/ward-management/tools/ward-form-time-input";

// Carried over from the retired MHA form calculator tests (Tools review, 15 Oct 2026). Form times
// keeps only these typed-time helpers, so their cases move with them.
function perthDate(day: number, hour = 0, minute = 0, second = 0, millisecond = 0): Date {
  return new Date(Date.UTC(2026, 8, day, hour - 8, minute, second, millisecond));
}

describe("Form times: typed Perth wall time", () => {
  it("interprets a typed Perth evening time as the same instant on every host", () => {
    const typed = parseDateTimeInput("2026-09-25", "17:00");
    expect(typed?.toISOString()).toBe("2026-09-25T09:00:00.000Z");
    expect(toTimeInputValue(typed!)).toBe("17:00");
  });

  it("formats the date and time in en-AU format", () => {
    const formatted = formatStatutoryDateTime(perthDate(25, 14, 30, 0));
    expect(formatted).toContain("25");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("14:30");
  });

  it("converts a Date to input strings and back accurately", () => {
    const date = perthDate(25, 9, 15, 0);
    const dateStr = toDateInputValue(date);
    const timeStr = toTimeInputValue(date);
    expect(dateStr).toBe("2026-09-25");
    expect(timeStr).toBe("09:15");
    const roundTrip = parseDateTimeInput(dateStr, timeStr);
    expect(roundTrip).not.toBeNull();
    expect(roundTrip!.getTime()).toBe(date.getTime());
  });

  it.each([
    ["UTC", 0],
    ["America/New_York", 240],
    ["Australia/Perth", -480],
  ])("keeps the Perth reading on a %s host", (timezone, offset) => {
    vi.stubEnv("TZ", timezone);
    try {
      const instant = new Date("2026-09-25T16:30:00.000Z");
      expect(instant.getTimezoneOffset()).toBe(offset);
      expect(toDateInputValue(instant)).toBe("2026-09-26");
      expect(toTimeInputValue(instant)).toBe("00:30");
      expect(parseDateTimeInput("2026-09-25", "17:00")?.toISOString()).toBe("2026-09-25T09:00:00.000Z");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it.each([
    ["2026-02-30", "09:00"],
    ["2026-09-25", "24:00"],
    ["2026-09-25", "12:60"],
    ["2026-09-25", "oops"],
    ["2026-9-25", "09:00"],
  ])("rejects invalid date/time input %s %s instead of rolling it forward", (date, time) => {
    expect(parseDateTimeInput(date, time)).toBeNull();
  });

  it("returns null for empty date input", () => {
    expect(parseDateTimeInput("", "09:00")).toBeNull();
  });

  it("shows Not recorded for an invalid date", () => {
    expect(formatStatutoryDateTime(new Date(Number.NaN))).toBe("Not recorded");
  });
});
