import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { shownDate } from "@/components/ward-management/patients/patient-documents-register";
import { formatDob } from "@/components/ward-management/referrals/ward-referral-drawer-model";
import { dateOf } from "@/components/ward-management/statistics/statistics-dates";
import { perthDateText, perthDayLabel, perthMidnight } from "@/components/ward-management/ward-clock";
import { MONTH_SHORT, monthIndexOfShort } from "@/components/ward-management/ward-month-names";

/*
 * Time audit D14 (13 Nov 2026): `Intl` en-AU writes September "Sept", but about ten hand-written
 * month arrays wrote "Sep", so one screen could show both. One shared list now matches what the
 * shared Perth date helpers print on Node 24 (the engine the tests run on).
 */
describe("one short spelling for every month (time audit D14)", () => {
  it("matches what the shared Perth date helper prints for every month", () => {
    for (let month = 0; month < 12; month += 1) {
      const midMonth = new Date(Date.UTC(2026, month, 15, 4));
      expect(perthDateText(midMonth, { month: "short" })).toBe(MONTH_SHORT[month]);
    }
    expect(MONTH_SHORT[8]).toBe("Sept");
  });

  it("reads a typed Sep or Sept as September", () => {
    expect(monthIndexOfShort("Sep")).toBe(8);
    expect(monthIndexOfShort("Sept")).toBe(8);
    expect(monthIndexOfShort("Aug")).toBe(7);
    expect(monthIndexOfShort("Foo")).toBe(-1);
  });

  it("agrees with the shared Perth day label for a September day", () => {
    expect(perthDayLabel(0, perthMidnight(2026, 8, 3))).toBe("Thu 3 Sept");
  });

  it("writes Sept on the screens that used their own month list", () => {
    expect(dateOf(0, perthMidnight(2026, 8, 3))).toBe("Thu 3 Sept");
    expect(formatDob("1991-09-17")).toBe("17 Sept 1991");
    expect(shownDate("Sep 2025")).toBe("Sept 2025");
  });

  it("leaves no hand-written month list outside the shared month list", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      // The entry's own type, not a second look at the path (CodeQL: file system race).
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.tsx?$/.test(entry.name) && !path.endsWith("ward-month-names.ts")) {
          if (/["']Jan["'],\s*["']Feb["'],\s*["']Mar["']/.test(readFileSync(path, "utf8"))) offenders.push(path);
        }
      }
    };
    walk(join(process.cwd(), "src"));
    expect(offenders).toEqual([]);
  });
});
