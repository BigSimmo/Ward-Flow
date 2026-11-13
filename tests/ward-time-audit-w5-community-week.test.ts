import { describe, expect, it } from "vitest";
import { leavingHospitalSoon } from "@/components/ward-management/community/community-screen-hero";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";

/*
 * The Community hero's "Leaving hospital in 7 days" counted a rolling now + 7 x 24 hours, so a
 * plan at 08:00 seven days out counted at 20:00 today, and one earlier today did not count at all.
 * It now counts Perth calendar days, today and the next six, like the Statistics "Discharges due
 * within 7 days" figure (time audit follow-up to D3/T2, 13 Nov 2026).
 */
describe("the Community hero's leaving-soon window (time audit)", () => {
  const now = 3 * MINUTES_PER_DAY + 20 * 60; // 20:00 on day 3
  const at = (expectedDischargeAt: number | null) => ({ expectedDischargeAt });

  it("counts today and the next six Perth calendar days", () => {
    expect(leavingHospitalSoon([at(now + 60)], now)).toHaveLength(1);
    expect(leavingHospitalSoon([at(9 * MINUTES_PER_DAY + 23 * 60)], now)).toHaveLength(1); // day 9, last day in
  });

  it("does not count a plan seven calendar days out, even inside 168 hours", () => {
    expect(leavingHospitalSoon([at(10 * MINUTES_PER_DAY + 8 * 60)], now)).toHaveLength(0); // day 10 08:00
  });

  it("still counts a plan earlier today and drops past days and no date", () => {
    expect(leavingHospitalSoon([at(3 * MINUTES_PER_DAY + 9 * 60)], now)).toHaveLength(1);
    expect(leavingHospitalSoon([at(2 * MINUTES_PER_DAY + 23 * 60)], now)).toHaveLength(0);
    expect(leavingHospitalSoon([at(null)], now)).toHaveLength(0);
  });
});
