import { describe, expect, it } from "vitest";
import {
  DEMO_COMMUNITY_CASELOAD,
  DEMO_COMMUNITY_EGRESS,
  demoCaseloadAt,
  demoEgressAt,
} from "@/components/ward-management/community/community-demo-cohort";
import { perthMidnight } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// F-33 (RC 2.3, 13 Nov 2026): the sample times are board instants and their words are worked out
// from the board's day and clock. Read on the fixture's own day (Monday 21 Sep 2026, 10:42), they
// keep the minutes the original fixture recorded. A past day is written by the shared `perthDayLabel`,
// which writes September as en-AU does ("Sept"), as on every other screen.
const FIXTURE_DAY = perthMidnight(2026, 8, 21);
const egress = (id: string) =>
  demoEgressAt(
    DEMO_COMMUNITY_EGRESS.find((row) => row.id === id)!,
    NOW_ANCHOR,
    FIXTURE_DAY,
  );
const lastContact = (id: string) =>
  demoCaseloadAt(
    DEMO_COMMUNITY_CASELOAD.find((row) => row.id === id)!,
    NOW_ANCHOR,
    FIXTURE_DAY,
  ).lastContact;

describe("community sample time precision", () => {
  it("preserves the half-hour instants recorded in the original synthetic fixture", () => {
    // design/third-edition-mockups/community-team-third-edition.html:
    // same egress row (Today 11:30, Community Step-Down) and caseload rows
    // (Tier 1 High Acuity / RN T. Bradley; Tier 2 Case Management / RN C. Davis).
    expect(egress("EGR-03").kpiStatusLabel).toBe("Due today 16:30");
    expect(lastContact("CL-02")).toBe("Yesterday 11:30 (clinic)");
    expect(lastContact("CL-04")).toBe("Fri 18 Sept 09:30 (home)");
  });

  it("retains whole hours where the synthetic fixture records whole hours", () => {
    expect(lastContact("CL-01")).toBe("Yesterday 14:00 (home)");
    expect(lastContact("CL-03")).toBe("Sat 19 Sept 15:00 (telehealth)");
    expect(lastContact("CL-05")).toBe("Thu 17 Sept 16:00 (clinic)");
    expect(lastContact("CL-06")).toBe("Tue 15 Sept 10:00 (clinic)");
  });
});
