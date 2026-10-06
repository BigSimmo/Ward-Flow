import { describe, expect, it } from "vitest";

import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { ReferralDestination } from "@/components/ward-management/ward-model";
import {
  addressingStreamStatus,
  referralQueueOrder,
  referralStreamOf,
  wardReferralsFor,
} from "@/components/ward-management/ward-referrals";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

const NOW = NOW_ANCHOR;
const TEAM = communityTeamOptions()[0]!;
const UNITS = allUnits()
  .slice(0, 3)
  .map((unit) => unit.id);

function added(before: WardFlowState, after: WardFlowState) {
  return after.rejections.slice(before.rejections.length).map((rejection) => rejection.reason);
}

function receive(destinations: ReferralDestination[], extra: Record<string, unknown> = {}) {
  const seeded = seedWardFlowState();
  const after = wardFlowReducer(seeded, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW,
    ageBand: "Adult",
    destinations,
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Greenfields" },
    source: "community",
    sendingTeamName: "Synthetic sending service",
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    referrerPhone: "0400000000",
    referrerEmail: "referrer@example.test",
    referrerRole: "community",
    referrerLocation: "Peel",
    medicationChartAttached: true,
    observationChartAttached: false,
    triageAndRampCompleted: true,
    ...FIXTURE_HISTORY,
    ...extra,
  });
  return { seeded, after };
}

const wardArm = {
  kind: "psychiatric_ward" as const,
  sex: "Female" as const,
  secureBedNeeded: true,
  involuntaryBedNeeded: false,
  highAcuityNursingNeeded: false,
  requestedUnitIds: [UNITS[0]!],
};

describe("a sent referral names its places and the receiving team's callback", () => {
  it("stores the requested wards and the callback on the new referral", () => {
    const { seeded, after } = receive([
      wardArm,
      { kind: "emergency_department", edId: "rph-ed", purpose: "psychiatric_review" },
      { kind: "community_team", teamName: TEAM },
    ]);
    expect(added(seeded, after)).toEqual([]);
    const created = after.referrals.at(-1)!;
    const ward = created.destinations.find((addressing) => addressing.destination.kind === "psychiatric_ward");
    expect(ward?.destination.kind === "psychiatric_ward" ? ward.destination.requestedUnitIds : []).toEqual([UNITS[0]]);
    expect(created.referrerPhone).toBe("0400000000");
    expect(created.referrerEmail).toBe("referrer@example.test");
    expect(created.referrerRole).toBe("community");
    expect(created.referrerLocation).toBe("Peel");
    expect(created.medicationChartAttached).toBe(true);
    expect(created.triageAndRampCompleted).toBe(true);
    expect(wardReferralsFor(after.referrals, UNITS[0]!).some((referral) => referral.id === created.id)).toBe(true);
    expect(wardReferralsFor(after.referrals, UNITS[1]!).some((referral) => referral.id === created.id)).toBe(false);
    expect(created.destinations.map((addressing) => referralStreamOf(addressing.destination.kind)).sort()).toEqual([
      "community",
      "emergency",
      "ward",
    ]);
    expect(addressingStreamStatus(created.destinations[0]!, created, after.movements)).toBe("awaiting");
  });

  it("refuses a blank callback and a fourth place", () => {
    const blank = receive([wardArm], { referrerPhone: "   " });
    expect(added(blank.seeded, blank.after)[0]).toMatch(/referrerPhone is present but blank/);

    const tooMany = receive([
      { ...wardArm, requestedUnitIds: UNITS },
      { kind: "emergency_department", edId: "rph-ed", purpose: "psychiatric_review" },
    ]);
    expect(added(tooMany.seeded, tooMany.after)[0]).toMatch(/at most 3 places/);
  });

  it("keeps urgency order inside the queued ward stream", () => {
    const queued = referralQueueOrder(seedWardFlowState().referrals);
    expect(queued.length).toBeGreaterThan(1);
    const wardQueued = queued.filter((referral) =>
      referral.destinations.some((addressing) => referralStreamOf(addressing.destination.kind) === "ward"),
    );
    const ordered = [...wardQueued].sort(
      (left, right) => left.urgency - right.urgency || left.raisedAt - right.raisedAt,
    );
    expect(wardQueued.map((referral) => referral.id)).toEqual(ordered.map((referral) => referral.id));
  });
});
