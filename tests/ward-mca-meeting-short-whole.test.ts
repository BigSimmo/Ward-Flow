import { describe, expect, it } from "vitest";

import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

// Audit M15, D-MCA (Josh, 14 Nov 2026): the bed meeting sheet says its figures are for the whole
// service. A group filter narrows the people lists only; the "short" figure stays whole.
describe("bed meeting sheet short figure under a group filter", () => {
  const seed = seedWardFlowState();
  const NOW = seed.movements.reduce((latest, movement) => Math.max(latest, movement.createdAt ?? 0), 0);
  const base = {
    ...seed,
    now: NOW,
    thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
    service: null,
    nameOf: (movement: { id: string }) => movement.id,
    referrals: seed.referrals,
    referralLimitMinutes: seed.configuration.referralDecisionTargetMinutes,
  };

  it("keeps the whole short figure when the people lists are narrowed", () => {
    const whole = bedMeetingSheet(base);
    expect(whole.short.waiting).toBeGreaterThan(0);
    const narrowed = bedMeetingSheet({
      ...base,
      movements: [],
      referrals: [],
      namedHolds: [...seed.movements, ...seed.referrals],
      peopleFilter: "Tier 1",
      wholeLists: { movements: seed.movements, referrals: seed.referrals },
    });
    expect(narrowed.short).toEqual(whole.short);
    expect(narrowed.capacity).toEqual(whole.capacity);
  });
});
