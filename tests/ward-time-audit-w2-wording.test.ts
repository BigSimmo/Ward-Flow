import { afterEach, describe, expect, it, vi } from "vitest";

import { plannedRows } from "@/components/ward-management/coordinator/planned-model";
import { reportTime } from "@/components/ward-management/help/ward-help-report";
import { lastPushLine } from "@/components/ward-management/settings/settings-last-push";
import { perthMidnight } from "@/components/ward-management/ward-clock";
import { targetHoursText } from "@/components/ward-management/ward-target-hours";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { referralIntakeExpected } from "@/components/ward-management/ward-referral-seed-time";

/*
 * Time audit, group w2 (13 Nov 2026). Synthetic times only. Each block names its finding.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("D4: the configured ED access target is said in whole hours, one way", () => {
  it("words whole hours as hours, and keeps a part hour as a duration", () => {
    expect(targetHoursText(24 * 60)).toBe("24 hours");
    expect(targetHoursText(4 * 60)).toBe("4 hours");
    expect(targetHoursText(60)).toBe("1 hour");
    expect(targetHoursText(4 * 60 + 30)).toBe("4h 30m");
  });

  it("names a 24-hour access target as 24 hours on Later today, never 1d", () => {
    const state = seedWardFlowState();
    const waiting = state.movements.find(isWaitingInEd);
    if (!waiting) throw new Error("the seed holds nobody waiting in ED");
    const configuration = { ...state.configuration, edAccessTargetMinutes: 24 * 60 };
    const now = waiting.openedAt + configuration.edAccessTargetMinutes - 30;
    const rows = plannedRows({
      movements: state.movements,
      admissions: state.admissions,
      plannedAdmissions: [],
      units: state.units,
      configuration,
      now,
      until: now + 120,
      endOfDay: now + 120,
      nameOf: () => ({ formalName: "Synthetic, Person" }) as never,
    });
    const target = rows.find((row) => row.id === `ed-target:${waiting.id}`);
    expect(target?.what).toContain("24 hours");
    expect(target?.what).not.toMatch(/\b1d\b/);
  });
});

describe("D9: the last alert line reads the Perth clock whatever the device zone", () => {
  it("says 14:05 today for a Perth afternoon alert on a New York device", () => {
    vi.stubEnv("TZ", "America/New_York");
    const now = new Date("2026-11-10T08:00:00Z"); // 16:00 Perth
    expect(lastPushLine(new Date("2026-11-10T06:05:00Z"), now)).toBe("Last alert on this device: 14:05 today.");
    // 06:05 Perth on Tue 3 Nov is still 2 Nov in New York.
    expect(lastPushLine(new Date("2026-11-02T22:05:00Z"), now)).toBe("Last alert on this device: 06:05, 3 Nov.");
    // 23:30 Perth on Mon 9 Nov is yesterday in Perth.
    expect(lastPushLine(new Date("2026-11-09T15:30:00Z"), now)).toBe("Last alert on this device: 23:30 yesterday.");
  });
});

describe("D10: the help report time is Perth, 24-hour, with the exact time kept", () => {
  it("writes the Perth day and 24-hour clock with no comma after the weekday", () => {
    vi.stubEnv("TZ", "America/New_York");
    expect(reportTime(new Date("2026-11-08T06:05:00.000Z"))).toMatch(
      /^Sun 8 Nov 2026, 14:05 \S+ \(2026-11-08T06:05:00\.000Z\)$/u,
    );
  });
});

describe("G6: an expected medical clearance time that has gone by says so", () => {
  const dayZero = perthMidnight(2026, 10, 13);
  const target = { syntheticTimelineBase: "2026-11-13T00:00:00+08:00" };

  it("adds (passed) once the expected time is earlier than now", () => {
    expect(referralIntakeExpected("2026-11-13T09:00:00+08:00", target, dayZero, 10 * 60, "AWST")).toBe(
      "09:00 AWST (passed)",
    );
  });

  it("adds nothing while the expected time is still ahead", () => {
    expect(referralIntakeExpected("2026-11-13T11:00:00+08:00", target, dayZero, 10 * 60, "AWST")).toBe("11:00 AWST");
  });

  it("names the demo's own clock when no zone is passed (F-113)", () => {
    expect(referralIntakeExpected("2026-11-13T09:00:00+08:00", target, dayZero, 10 * 60)).toBe(
      "09:00 demo time (passed)",
    );
  });

  it("adds nothing when no time is recorded", () => {
    expect(referralIntakeExpected(undefined, target, dayZero, 10 * 60)).toBe("Time not recorded");
  });
});
