import { describe, expect, it, vi } from "vitest";

import {
  calculateForm1A,
  calculateForm3A,
  calculateForm4B,
  checkSafeguardAlert,
  formatEnteredExpiryNotice,
  formatStatutoryDateTime,
  isAfterHours,
  isWeekend,
  parseDateTimeInput,
  toDateInputValue,
  toTimeInputValue,
} from "@/components/ward-management/tools/ward-mha-calculator";

function perthDate(day: number, hour = 0, minute = 0, second = 0, millisecond = 0): Date {
  return new Date(Date.UTC(2026, 8, day, hour - 8, minute, second, millisecond));
}

describe("Mental Health Act Form Record (Calculator)", () => {
  describe("Form 1A (Referral for examination by a psychiatrist)", () => {
    it("uses official form title and does not compute statutory deadlines or statuses", () => {
      const entered = perthDate(25, 9, 0, 0, 0);
      const result = calculateForm1A(entered);

      expect(result.officialTitle).toBe("Form 1A (Referral for examination by a psychiatrist)");
      expect(result.form).toBe("1A");
      expect(result.expiryNotice).toBe(`Expiry written on form: ${formatStatutoryDateTime(entered)}`);
      expect((result as unknown as Record<string, unknown>).status).toBeUndefined();
      expect((result as unknown as Record<string, unknown>).statutoryBasis).toBeUndefined();
    });

    it("displays 'Not recorded' when no date is entered", () => {
      const result = calculateForm1A(null);
      expect(result.expiryNotice).toBe("Not recorded");
      expect(result.enteredDate).toBeNull();
    });
  });

  describe("Form 3A (Detention order)", () => {
    it("uses official form title and shows entered time marked Not legally checked", () => {
      const entered = perthDate(26, 14, 30, 0, 0);
      const result = calculateForm3A(entered);

      expect(result.officialTitle).toBe("Form 3A (Detention order)");
      expect(result.form).toBe("3A");
      expect(result.expiryNotice).toBe(`Expiry written on form: ${formatStatutoryDateTime(entered)}`);
      expect((result as unknown as Record<string, unknown>).status).toBeUndefined();
      expect((result as unknown as Record<string, unknown>).statutoryBasis).toBeUndefined();
    });

    it("returns 'Not recorded' when input is null", () => {
      const result = calculateForm3A(null);
      expect(result.expiryNotice).toBe("Not recorded");
    });
  });

  describe("Form 4B (Extension of transport order)", () => {
    it("uses official form title and displays entered time", () => {
      const entered = perthDate(27, 10, 15, 0, 0);
      const result = calculateForm4B(entered);

      expect(result.officialTitle).toBe("Form 4B (Extension of transport order)");
      expect(result.form).toBe("4B");
      expect(result.expiryNotice).toBe(`Expiry written on form: ${formatStatutoryDateTime(entered)}`);
      expect((result as unknown as Record<string, unknown>).status).toBeUndefined();
      expect((result as unknown as Record<string, unknown>).statutoryBasis).toBeUndefined();
    });

    it("returns 'Not recorded' when input is null", () => {
      const result = calculateForm4B(null);
      expect(result.expiryNotice).toBe("Not recorded");
    });
  });

  describe("No Act section numbers or computed legal expiry statuses", () => {
    it("never emits section numbers or computed statuses in records", () => {
      const testDate = perthDate(25, 12, 0, 0);
      const records = [calculateForm1A(testDate), calculateForm3A(testDate), calculateForm4B(testDate)];

      for (const rec of records) {
        const text = JSON.stringify(rec);
        expect(text).not.toMatch(/s\.\s*\d+/);
        expect(text).not.toContain("Lapsed");
        expect(text).not.toContain("Unlawful Detention");
        expect(text).not.toContain("Expired");
        expect(text).not.toContain("Active");
      }
    });
  });

  describe("Weekend and After-Hours Safeguard Logic", () => {
    describe("isAfterHours", () => {
      it("identifies after-hours correctly (17:00 to 08:00)", () => {
        expect(isAfterHours(perthDate(25, 8, 0, 0))).toBe(false);
        expect(isAfterHours(perthDate(25, 12, 30, 0))).toBe(false);
        expect(isAfterHours(perthDate(25, 16, 59, 59))).toBe(false);

        expect(isAfterHours(perthDate(25, 17, 0, 0))).toBe(true);
        expect(isAfterHours(perthDate(25, 18, 30, 0))).toBe(true);
        expect(isAfterHours(perthDate(25, 23, 59, 0))).toBe(true);

        expect(isAfterHours(perthDate(25, 0, 0, 0))).toBe(true);
        expect(isAfterHours(perthDate(25, 4, 15, 0))).toBe(true);
        expect(isAfterHours(perthDate(25, 7, 59, 59))).toBe(true);
      });
    });

    describe("isWeekend", () => {
      it("identifies Saturday and Sunday as weekends and weekdays as non-weekend", () => {
        expect(isWeekend(perthDate(25))).toBe(false); // Friday
        expect(isWeekend(perthDate(26))).toBe(true); // Saturday
        expect(isWeekend(perthDate(27))).toBe(true); // Sunday
        expect(isWeekend(perthDate(28))).toBe(false); // Monday
      });
    });

    describe("checkSafeguardAlert", () => {
      it("triggers no alert during weekday business hours", () => {
        const weekdayDaytime = perthDate(25, 14, 0, 0);
        const alert = checkSafeguardAlert(weekdayDaytime);

        expect(alert.alertRequired).toBe(false);
        expect(alert.isAfterHours).toBe(false);
        expect(alert.isWeekend).toBe(false);
        expect(alert.message).toBeNull();
      });

      it("triggers alert when time written falls after-hours on a weekday", () => {
        const weekdayAfterHours = perthDate(25, 19, 30, 0);
        const alert = checkSafeguardAlert(weekdayAfterHours);

        expect(alert.alertRequired).toBe(true);
        expect(alert.isAfterHours).toBe(true);
        expect(alert.isWeekend).toBe(false);
        expect(alert.message).toContain("On-Call Consultant Psychiatrist cover must be arranged");
        expect(alert.message).toContain("after-hours");
      });

      it("triggers alert when time written falls on a weekend daytime", () => {
        const weekendDaytime = perthDate(26, 11, 0, 0);
        const alert = checkSafeguardAlert(weekendDaytime);

        expect(alert.alertRequired).toBe(true);
        expect(alert.isAfterHours).toBe(false);
        expect(alert.isWeekend).toBe(true);
        expect(alert.message).toContain("On-Call Consultant Psychiatrist cover must be arranged");
        expect(alert.message).toContain("weekend");
      });

      // Restored from the pre-ruling suite: the weekend-and-after-hours branch still exists, so its
      // test stays. Only tests of computed durations and statuses went with the ruling.
      it("triggers alert when time written falls on a weekend after-hours", () => {
        // Sunday 21:00
        const weekendAfterHours = perthDate(27, 21, 0, 0);
        const alert = checkSafeguardAlert(weekendAfterHours);

        expect(alert.alertRequired).toBe(true);
        expect(alert.isAfterHours).toBe(true);
        expect(alert.isWeekend).toBe(true);
        expect(alert.message).toContain("weekend and after-hours");
      });

      it("integrates the safeguard alert into the Form 1A record from the typed time alone", () => {
        // Saturday 26 Sep 2026 at 18:00, typed from the form: weekend AND after-hours.
        const typed = perthDate(26, 18, 0, 0);
        const result = calculateForm1A(typed);

        expect(result.safeguardAlert).toBe(true);
        expect(result.isWeekend).toBe(true);
        expect(result.isAfterHours).toBe(true);
        expect(result.safeguardMessage).toContain("On-Call Consultant Psychiatrist cover must be arranged");
      });

      it("handles null date gracefully", () => {
        const alert = checkSafeguardAlert(null);
        expect(alert.alertRequired).toBe(false);
        expect(alert.message).toBeNull();
      });
    });
  });

  describe("Formatters and Input Parsers", () => {
    it("interprets a typed Perth after-hours time as the same instant on every host", () => {
      const typed = parseDateTimeInput("2026-09-25", "17:00");
      expect(typed?.toISOString()).toBe("2026-09-25T09:00:00.000Z");
      expect(toTimeInputValue(typed!)).toBe("17:00");
      expect(isAfterHours(typed!)).toBe(true);
    });

    it("formats statutory date and time string in en-AU format", () => {
      const date = perthDate(25, 14, 30, 0);
      const formatted = formatStatutoryDateTime(date);
      expect(formatted).toContain("25");
      expect(formatted).toContain("2026");
      expect(formatted).toContain("14:30");
    });

    it("formats entered expiry notice", () => {
      const date = perthDate(25, 14, 30, 0);
      expect(formatEnteredExpiryNotice(date)).toBe(`Expiry written on form: ${formatStatutoryDateTime(date)}`);
      expect(formatEnteredExpiryNotice(null)).toBe("Not recorded");
    });

    it("converts Date to HTML input strings and back accurately", () => {
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
    ])("keeps input and safeguard semantics on a %s host", (timezone, offset) => {
      vi.stubEnv("TZ", timezone);
      try {
        const instant = new Date("2026-09-25T16:30:00.000Z");
        expect(instant.getTimezoneOffset()).toBe(offset);
        expect(toDateInputValue(instant)).toBe("2026-09-26");
        expect(toTimeInputValue(instant)).toBe("00:30");
        expect(isWeekend(instant)).toBe(true);
        expect(isAfterHours(instant)).toBe(true);
        expect(parseDateTimeInput("2026-09-25", "17:00")?.toISOString()).toBe("2026-09-25T09:00:00.000Z");
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it("keeps the Perth calendar day and weekend across UTC midnight", () => {
      const saturday = new Date("2026-09-25T16:30:00.000Z");
      expect(toDateInputValue(saturday)).toBe("2026-09-26");
      expect(toTimeInputValue(saturday)).toBe("00:30");
      expect(isWeekend(saturday)).toBe(true);
      expect(isAfterHours(saturday)).toBe(true);
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
  });
});
