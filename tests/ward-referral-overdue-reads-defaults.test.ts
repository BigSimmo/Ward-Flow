import { describe, expect, it } from "vitest";

import { getReferralPriority } from "../src/components/ward-management/referrals/referral-priority";
import type { Referral, UrgencyLevel } from "../src/components/ward-management/ward-model";
import {
  OVERDUE_AFTER_ANY_TIER_MINUTES,
  OVERDUE_AFTER_MINUTES_BY_TIER,
} from "../src/components/ward-management/ward-operational-defaults";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * The referral board's Overdue flag reads Josh's own defaults from ward-operational-defaults.ts,
 * the same figures the intake form and settings screen quote (D-22, D-24). It used to type 60, 240,
 * 1440 and 4320 minutes itself; moving the source changed no behaviour, and the first test pins
 * that the defaults still hold those values, so a change to either shows up here.
 */
const RAISED = 1000;

function queued(urgency: UrgencyLevel): Referral {
  return {
    id: "RF-TEST",
    ageBand: "Adult",
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          sex: "Female",
          gender: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "queued",
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    raisedAt: RAISED,
    urgency,
    originSiteCode: "RPH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  };
}

describe("referral board Overdue flag reads the defaults module", () => {
  it("the defaults still hold the minutes the board used to type", () => {
    expect(OVERDUE_AFTER_MINUTES_BY_TIER).toEqual({ 1: 60, 2: 240, 3: 1440 });
    expect(OVERDUE_AFTER_ANY_TIER_MINUTES).toBe(4320);
  });

  it.each([1, 2, 3] as const)("tier %i turns overdue exactly at its default", (tier) => {
    const at = OVERDUE_AFTER_MINUTES_BY_TIER[tier];
    const before = getReferralPriority(queued(tier), RAISED + at - 1);
    expect(before, `tier ${tier} was overdue a minute early`).not.toBe("overdue");
    expect(getReferralPriority(queued(tier), RAISED + at)).toBe("overdue");
  });

  it("tier 3 is routine until its default, then overdue", () => {
    expect(getReferralPriority(queued(3), RAISED + OVERDUE_AFTER_MINUTES_BY_TIER[3] - 1)).toBe("routine");
  });
});
