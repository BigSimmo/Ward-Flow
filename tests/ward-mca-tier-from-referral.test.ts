// Mechanics and clock audit (14 Nov 2026), M5 and ruling 4, D-210 (Josh, 14 Nov 2026): the tier
// windows count from the referral time, as the values register ("Tier N referral shown as overdue
// after…") and the Referrals board do, never from arrival in ED; with no referral time the wait says
// so instead of being marked overdue. No values change. Synthetic data only.
import { describe, expect, it } from "vitest";

import { isOpen } from "@/components/ward-management/ward-derivations";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import {
  inEdTierOverdue,
  isTierOverdue,
  isTierOverdueFromReferral,
  REFERRAL_TIME_NOT_RECORDED,
  tierOverdueAfterMinutes,
  tierWaitFromReferral,
} from "@/components/ward-management/ward-shared-figures";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const now = NOW_ANCHOR;
const state = seedWardFlowState();
const waitingInEd = state.movements.filter((m) => isOpen(m) && isWaitingInEd(m));

describe("tier overdue waits count from the referral time", () => {
  it("Home's Overdue waits are exactly the people in an ED past their window since referral", () => {
    const expected = waitingInEd.filter(
      (m) => m.referredAt !== undefined && isTierOverdue(m.urgency, now - m.referredAt),
    );
    const home = state.movements.filter((m) => inEdTierOverdue(m, now));
    expect(home.map((m) => m.id).sort()).toEqual(expected.map((m) => m.id).sort());
    expect(home.length, "the seed has overdue waits by the referral clock").toBeGreaterThan(0);
    expect(home.every((m) => m.referredAt !== undefined)).toBe(true);
  });

  it("a long time in ED does not make a recent referral overdue, and arrival never restarts the clock", () => {
    const base = waitingInEd[0]!;
    const window = tierOverdueAfterMinutes(base.urgency);
    const recentReferral = { ...base, openedAt: now - window * 3, referredAt: now - 10 } as Movement;
    expect(inEdTierOverdue(recentReferral, now)).toBe(false);
    // A referral raised before the person reached this ED (an inter-hospital referral) keeps its clock.
    const earlyReferral = { ...base, openedAt: now - 10, referredAt: now - window - 1 } as Movement;
    expect(inEdTierOverdue(earlyReferral, now)).toBe(true);
    expect(isTierOverdueFromReferral(earlyReferral, now)).toBe(true);
  });

  it("starts the window at the referral minute, inclusive, as the Referrals board does", () => {
    const base = waitingInEd[0]!;
    const window = tierOverdueAfterMinutes(base.urgency);
    const at = (waited: number) => tierWaitFromReferral({ ...base, referredAt: now - waited }, now);
    expect(at(window - 1)).toMatchObject({ recorded: true, overdue: false, overdueAfter: window });
    expect(at(window)).toMatchObject({ recorded: true, overdue: true });
  });

  it("says the referral time is not recorded rather than counting from arrival", () => {
    const base = waitingInEd[0]!;
    const noReferral = { ...base, openedAt: now - 7 * 24 * 60, referredAt: undefined } as Movement;
    expect(tierWaitFromReferral(noReferral, now)).toEqual({ recorded: false });
    expect(isTierOverdueFromReferral(noReferral, now)).toBe(false);
    expect(inEdTierOverdue(noReferral, now)).toBe(false);
    expect(REFERRAL_TIME_NOT_RECORDED).toBe("Referral time not recorded");
  });
});
