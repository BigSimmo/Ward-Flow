import { describe, expect, it } from "vitest";

import {
  bedMeetingComparison,
  departureDayLabel,
  lastBedMeetingAt,
} from "@/components/ward-management/out-of-area/out-of-area-model";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, type RepatriationRecord } from "@/components/ward-management/ward-flow-reducer";
import { BED_MEETING_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { outOfAreaLedger } from "@/components/ward-management/ward-referrals";

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

describe("bedMeetingComparison (v10 delta twins, derived from the records)", () => {
  const state = seedWardFlowState();
  const now = 3 * MINUTES_PER_DAY + 14 * 60; // 14:00
  const meetingAt = 3 * MINUTES_PER_DAY + BED_MEETING_MINUTES;

  it("finds the most recent meeting, yesterday's before it starts", () => {
    expect(lastBedMeetingAt(now)).toBe(meetingAt);
    expect(lastBedMeetingAt(3 * MINUTES_PER_DAY + 7 * 60)).toBe(2 * MINUTES_PER_DAY + BED_MEETING_MINUTES);
  });

  it("does not count a later arrival back, and adds back anyone who left after the meeting", () => {
    // Everyone arrived well before the meeting, so the two figures start equal.
    const settled = state.admissions.map((admission) =>
      admission.arrivedAt === null ? admission : { ...admission, arrivedAt: meetingAt - 600 },
    );
    const away = outOfAreaLedger(settled, state.units, now).entries;
    expect(away.length).toBeGreaterThan(1);
    expect(bedMeetingComparison(settled, state.units, now).away).toBe(away.length);

    const [late, left] = away.map((entry) => entry.admission.id);
    const changed = settled.map((admission) =>
      admission.id === late
        ? { ...admission, arrivedAt: meetingAt + 60 }
        : admission.id === left
          ? { ...admission, state: "departed" as const, leftAt: meetingAt + 30 }
          : admission,
    );
    const comparison = bedMeetingComparison(changed, state.units, now);
    expect(comparison.at).toBe(meetingAt);
    // Now: the leaver is gone and the late arrival is in. At the meeting: the late arrival had not
    // come, and the leaver was still in the bed.
    expect(outOfAreaLedger(changed, state.units, now).entries.map((entry) => entry.admission.id)).not.toContain(left);
    expect(outOfAreaLedger(changed, state.units, now).entries.length).toBe(away.length - 1);
    expect(comparison.away).toBe(away.length - 1);
    const lateOnly = settled.map((admission) =>
      admission.id === late ? { ...admission, arrivedAt: meetingAt + 60 } : admission,
    );
    expect(bedMeetingComparison(lateOnly, state.units, now).away).toBe(away.length - 1);
  });

  it("never counts back a departure with no recorded leaving time", () => {
    const settled = state.admissions.map((admission) =>
      admission.arrivedAt === null ? admission : { ...admission, arrivedAt: meetingAt - 600 },
    );
    const away = outOfAreaLedger(settled, state.units, now).entries;
    const gone = away[0]!.admission.id;
    const changed = settled.map((admission) =>
      admission.id === gone ? { ...admission, state: "departed" as const, leftAt: null } : admission,
    );
    expect(bedMeetingComparison(changed, state.units, now).away).toBe(away.length - 1);
  });
});
