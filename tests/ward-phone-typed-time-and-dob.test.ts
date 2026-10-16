import { describe, expect, it } from "vitest";

import { parseDob } from "@/components/ward-management/search/patient-census";
import { minuteOfDayFromClockText } from "@/components/ward-management/ward-clock";

/**
 * F-01: the iPhone number pad (inputMode="numeric") has only the digits 0 to 9, so a date of birth
 * or a clock time typed on it has no "/" or ":". The parsers read digits only as well as the
 * punctuated forms, and still refuse anything they would have to guess.
 */
describe("typed clock time", () => {
  it("reads HH:MM, H:MM and digits only the same way", () => {
    expect(minuteOfDayFromClockText("09:30")).toBe(570);
    expect(minuteOfDayFromClockText("9:30")).toBe(570);
    expect(minuteOfDayFromClockText("0930")).toBe(570);
    expect(minuteOfDayFromClockText(" 1405 ")).toBe(845);
    expect(minuteOfDayFromClockText("0000")).toBe(0);
    expect(minuteOfDayFromClockText("23:59")).toBe(1439);
  });

  it("refuses half-typed or impossible times rather than guessing", () => {
    for (const text of [
      "",
      "9",
      "93",
      "930",
      "143",
      "14:3",
      "14:",
      ":30",
      "12345",
      "2400",
      "24:00",
      "0960",
      "9h30",
      "09.30",
    ]) {
      expect(minuteOfDayFromClockText(text)).toBeUndefined();
    }
  });
});

describe("typed date of birth", () => {
  it("reads digits only as DDMMYYYY, beside the punctuated forms", () => {
    expect(parseDob("01021990")).toBe("1990-02-01");
    expect(parseDob("01/02/1990")).toBe("1990-02-01");
    expect(parseDob("1.2.1990")).toBe("1990-02-01");
    expect(parseDob("1990-02-01")).toBe("1990-02-01");
  });

  it("waits for a whole date", () => {
    expect(parseDob("0102199")).toBeNull();
    expect(parseDob("010219")).toBeNull();
    expect(parseDob("010219900")).toBeNull();
  });

  it("refuses a date that cannot exist", () => {
    expect(parseDob("99999999")).toBeNull();
    expect(parseDob("01131990")).toBeNull();
    expect(parseDob("00011990")).toBeNull();
    expect(parseDob("32/01/1990")).toBeNull();
    expect(parseDob("1990-13-01")).toBeNull();
    expect(parseDob("31/04/1990")).toBeNull();
    expect(parseDob("29021990")).toBeNull();
    expect(parseDob("1990-02-29")).toBeNull();
    expect(parseDob("29022000")).toBe("2000-02-29");
    expect(parseDob("31121990")).toBe("1990-12-31");
  });
});
