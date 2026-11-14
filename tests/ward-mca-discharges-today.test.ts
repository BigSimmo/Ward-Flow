import { describe, expect, it } from "vitest";

import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import type { BedRelease } from "@/components/ward-management/ward-model";
import { isFreeingToday } from "@/components/ward-management/ward-releases-expected-to-free";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import { wardDischargesDueToday } from "@/components/ward-management/ward/ward-home-tab-model";

/**
 * M6 (mechanics and clock audit, 14 Nov 2026; T-5): "discharges today" had three rules. The ward
 * page kept a release whose time had passed today, Capacity dropped it, and the forecast kept it as
 * "likely" until midnight and then dropped it, so "likely" fell by one at 00:00 with nothing
 * happening. Now one rule: a release still to happen today frees a bed today, and one whose time has
 * passed is overdue from that minute. Synthetic records only.
 */
const unit = allUnits().find((candidate) => !candidate.isClosed)!;

function release(id: string, expectedAt: number): BedRelease {
  return {
    id,
    unitId: unit.id,
    admissionId: `AD-${id}`,
    state: "expected",
    expectedAt,
    waitingOn: null,
    blocker: null,
    blockedBy: null,
    preparing: false,
    preparationNote: null,
    confirmedAt: NOW_ANCHOR - 300,
    confirmedBy: "NUM Test Unit",
  };
}

/** The first day's forecast for this one ward with this one release. */
function tomorrow(at: BedRelease, now: number) {
  return bedsForecast([unit], [at], [], [], now).horizons[0]!;
}

describe("M6: one 'discharges today' rule on the ward page, Capacity and the forecast", () => {
  const passed = release("passed-today", NOW_ANCHOR - 30);
  const ahead = release("later-today", NOW_ANCHOR + 30);

  it("a release later today counts on every screen", () => {
    expect(isFreeingToday(ahead, NOW_ANCHOR)).toBe(true);
    expect(wardDischargesDueToday([ahead], NOW_ANCHOR)).toHaveLength(1);
    expect(tomorrow(ahead, NOW_ANCHOR)).toMatchObject({ expected: 1, overdue: 0 });
  });

  it("a release whose time passed earlier today counts on none of them, and is overdue in the forecast", () => {
    expect(isFreeingToday(passed, NOW_ANCHOR)).toBe(false);
    expect(wardDischargesDueToday([passed], NOW_ANCHOR)).toHaveLength(0);
    expect(tomorrow(passed, NOW_ANCHOR)).toMatchObject({ expected: 0, overdue: 1 });
  });

  it("turns overdue the minute its time passes, so nothing changes at midnight", () => {
    const due = release("due-at-noon", 12 * 60);
    expect(tomorrow(due, 12 * 60)).toMatchObject({ expected: 1, overdue: 0 });
    expect(tomorrow(due, 12 * 60 + 1)).toMatchObject({ expected: 0, overdue: 1 });
    const beforeMidnight = tomorrow(due, MINUTES_PER_DAY - 1);
    const afterMidnight = tomorrow(due, MINUTES_PER_DAY + 1);
    expect(afterMidnight.likely).toBe(beforeMidnight.likely);
    expect(afterMidnight.overdue).toBe(beforeMidnight.overdue);
  });
});
