// Fix package P1, "time words and formatters" (PR C, 13 Nov 2026). Behaviour, not source text:
//   F-113 (RC 2.6, D-190) one clock-zone label: "AWST" signed in, "demo time" in the demo, never typed.
//   F-35 (RC 2.5) `dur` keeps its sign; the draft age uses the shared formatter; one pull hold wording.
//   F-33 (RC 2.3, D-175 item 1) the community sample times follow the board's day and clock.
import { describe, expect, it } from "vitest";
import {
  clockZoneLabel,
  formatSheetMoment,
  FUTURE_START_TEXT,
  MINUTES_PER_DAY,
  perthMidnight,
} from "@/components/ward-management/ward-clock";
import { dur, durMinutes, FUTURE_START_TEXT as KIT_FUTURE_START_TEXT } from "@/components/wf/format";
import { pullHoldText } from "@/components/ward-management/ward-bed-hold";
import { referralDraftAgeText } from "@/components/ward-management/referrals/referral-draft-cache";
import { referralLetterText } from "@/components/ward-management/referrals/referral-letter";
import { formatReferralIntakeTime } from "@/components/ward-management/ward-referral-seed-time";
import { summaryText } from "@/components/ward-management/handover/handover-model";
import { chronologyCsv, chronologyTime } from "@/components/ward-management/reports/patient-chronology";
import {
  DEMO_COMMUNITY_CASELOAD,
  DEMO_COMMUNITY_EGRESS,
  demoCaseloadAt,
  demoEgressAt,
} from "@/components/ward-management/community/community-demo-cohort";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const DAY_ZERO = perthMidnight(2026, 10, 13);
const MIN = 60_000;

describe("F-113: one clock-zone label", () => {
  it("says AWST only on the signed-in site and demo time in the demo", () => {
    expect(clockZoneLabel(true)).toBe("AWST");
    expect(clockZoneLabel(false)).toBe("demo time");
  });

  it("stamps a printed moment with the zone it is given, and the demo's words by default", () => {
    expect(formatSheetMoment(0, DAY_ZERO, { includeYearAndZone: true })).toBe("Fri 13 Nov 2026, 00:00 demo time");
    expect(formatSheetMoment(0, DAY_ZERO, { includeYearAndZone: true, zone: "AWST" })).toBe(
      "Fri 13 Nov 2026, 00:00 AWST",
    );
    expect(formatSheetMoment(0, DAY_ZERO)).toBe("Fri 13 Nov, 00:00");
  });

  it("never writes AWST beside a demo time in the copied and printed texts", () => {
    const demo = clockZoneLabel(false);
    const outputs = [
      formatReferralIntakeTime("2026-11-13T12:42+08:00", {}, DAY_ZERO),
      formatReferralIntakeTime("2026-11-13T12:42+08:00", {}, DAY_ZERO, NOW_ANCHOR),
      summaryText([], "All wards", "day shift", NOW_ANCHOR, NOW_ANCHOR, demo),
      chronologyTime(NOW_ANCHOR, DAY_ZERO),
      chronologyCsv([], DAY_ZERO, NOW_ANCHOR),
    ];
    for (const text of outputs) {
      expect(text).toContain("demo time");
      expect(text).not.toContain("AWST");
    }
    expect(summaryText([], "All wards", "day shift", NOW_ANCHOR, NOW_ANCHOR, "AWST")).toContain("10:42 AWST.");
    expect(formatReferralIntakeTime("2026-11-13T12:42+08:00", {}, DAY_ZERO, undefined, "AWST")).toBe(
      "13 Nov 2026, 12:42 AWST",
    );
  });

  it("stamps the referral letter's draft line with the zone it is given", () => {
    const input = {
      destinationPhrase: "a ward",
      patientName: "Alex Testperson",
      umrn: "UM100001",
      ageSex: "41, female",
      suburb: "Midland",
      from: "Royal Perth Hospital ED",
      recipients: ["Ward 3"],
      urgency: "Tier 2, urgent",
      legalStatus: "Voluntary",
      reason: "Synthetic reason",
      history: "Synthetic history",
      risks: [],
      clearance: "Cleared",
      referrer: { name: "Dr Synthetic", role: "Registrar", phone: "08 0000 0001" },
    };
    expect(referralLetterText(input, "10:42").split("\n")[0]).toBe("Synthetic prototype. Draft 10:42 demo time.");
    expect(referralLetterText(input, "10:42", "AWST").split("\n")[0]).toBe("Synthetic prototype. Draft 10:42 AWST.");
  });
});

describe("F-35: one duration format, signed", () => {
  it("keeps the sign of a negative length, as splitDuration does, instead of printing its size", () => {
    expect(dur(-18 * MIN)).toBe("-18m");
    expect(durMinutes(-90)).toBe("-1h 30m");
    expect(dur(18 * MIN)).toBe("18m");
    expect(FUTURE_START_TEXT).toBe("Start time is in the future");
    // The kit and the engine's clock each keep a copy (neither may import the other): one wording.
    expect(KIT_FUTURE_START_TEXT).toBe(FUTURE_START_TEXT);
  });

  it("says a kept draft's age in the shared units, a day as days", () => {
    expect(referralDraftAgeText(0, 20_000)).toBe("just now");
    expect(referralDraftAgeText(0, 65 * MIN)).toBe("1h 05m ago");
    expect(referralDraftAgeText(0, 30 * 60 * MIN)).toBe("1d 6h ago");
  });

  it("says a pull time limit one way, as Ward and ED both showed a whole hour", () => {
    expect(pullHoldText(240)).toBe("4h");
    expect(pullHoldText(270)).toBe("4h 30m");
    expect(pullHoldText(240 + 120)).toBe("6h");
  });
});

describe("F-33: the community sample times follow the board's clock", () => {
  const egress = (id: string) => DEMO_COMMUNITY_EGRESS.find((row) => row.id === id)!;
  const caseload = (id: string) => DEMO_COMMUNITY_CASELOAD.find((row) => row.id === id)!;

  it("reads as typed on the opening morning", () => {
    const due = demoEgressAt(egress("EGR-02"), NOW_ANCHOR, DAY_ZERO);
    expect(due.dischargeDatePlan).toBe("Today 10:00");
    expect(due.kpiStatusLabel).toBe("Due today 15:00");
    expect(due.kpiTone).toBe("warn");
    expect(due.status).toBe("today");
    expect(demoCaseloadAt(caseload("CL-01"), NOW_ANCHOR, DAY_ZERO)).toMatchObject({
      lastContact: "Yesterday 14:00 (home)",
      nextReview: "Tomorrow 10:00 (depot clinic)",
    });
  });

  it("turns a follow-up overdue once its time passes, from the board's now", () => {
    const late = demoEgressAt(egress("EGR-02"), 15 * 60 + 1, DAY_ZERO);
    expect(late.kpiStatusLabel).toBe("Overdue (priority follow-up)");
    expect(late.kpiTone).toBe("danger");
    expect(late.status).toBe("overdue");
  });

  it("moves with the board's day past midnight", () => {
    const pastMidnight = MINUTES_PER_DAY + 30;
    const due = demoEgressAt(egress("EGR-02"), pastMidnight, DAY_ZERO);
    expect(due.dischargeDatePlan).toBe("Yesterday 10:00");
    expect(due.status).toBe("overdue");
    const planned = demoEgressAt(egress("EGR-04"), pastMidnight, DAY_ZERO);
    expect(planned.dischargeDatePlan).toBe("Today 14:00");
    expect(planned.kpiStatusLabel).toBe("Due tomorrow");
    const row = demoCaseloadAt(caseload("CL-01"), pastMidnight, DAY_ZERO);
    expect(row.lastContact).toBe("Thu 12 Nov 14:00 (home)");
    expect(row.nextReview).toBe("Today 10:00 (depot clinic)");
  });

  it("writes no fixed calendar day: every sample day is worked out from day 0", () => {
    const later = new Date(DAY_ZERO.getTime() + 40 * MINUTES_PER_DAY * MIN);
    const texts = [
      ...DEMO_COMMUNITY_EGRESS.map((row) => demoEgressAt(row, NOW_ANCHOR, later).dischargeDatePlan),
      ...DEMO_COMMUNITY_CASELOAD.flatMap((row) => {
        const view = demoCaseloadAt(row, NOW_ANCHOR, later);
        return [view.lastContact, view.nextReview];
      }),
    ];
    expect(texts.join(" ")).not.toMatch(/\bSep\b/);
  });
});
