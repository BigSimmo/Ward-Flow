import { describe, expect, it } from "vitest";

import {
  dischargeFigures,
  handoverFigures,
  headlineFigures,
  referralBoardFigures,
  unitRollups,
  type ProposalWorld,
} from "@/components/ward-management/flow-proposal/flow-proposal-figures";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The referrals, handover and discharges proposals (5 October 2026) must never author a figure:
 * at network scope every headline equals the sidebar's, and the parts always add up to the whole.
 */
function world(): ProposalWorld {
  const seed = seedWardFlowState();
  return {
    movements: seed.movements,
    units: seed.units,
    referrals: seed.referrals,
    bedReleases: seed.bedReleases,
    leaveBeds: seed.leaveBeds,
    admissions: seed.admissions,
  };
}

describe("flow proposal figures", () => {
  const now = NOW_ANCHOR;

  it("network handover figures equal the sidebar's figures", () => {
    const state = world();
    const headline = headlineFigures(state, now);
    const handover = handoverFigures(state, "network", now);
    expect(handover.bedsReadyNow).toBe(headline.bedsReadyNow);
    expect(handover.dischargesHeldUp).toBe(headline.dischargesHeldUp);
    expect(handover.open.length).toBe(headline.openMovements);
    expect(handover.severeCount).toBe(headline.severeDelays);
    expect(handover.referralsAwaitingDecision.length).toBe(headline.referralsAwaitingDecision);
  });

  it("service scopes narrow every figure and the services' beds add up to the network's", () => {
    const state = world();
    const network = handoverFigures(state, "network", now);
    const services = HEALTH_SERVICES.map((service) => handoverFigures(state, service, now));
    expect(services.reduce((sum, figures) => sum + figures.bedsReadyNow, 0)).toBe(network.bedsReadyNow);
    expect(services.reduce((sum, figures) => sum + figures.dischargesHeldUp, 0)).toBe(network.dischargesHeldUp);
    for (const figures of services) expect(figures.bedsReadyNow).toBeLessThanOrEqual(network.bedsReadyNow);
    expect(services.some((figures) => figures.bedsReadyNow < network.bedsReadyNow)).toBe(true);
  });

  it("per-ward beds ready add up to the sidebar's beds ready now", () => {
    const state = world();
    const total = [...unitRollups(state, now).values()].reduce((sum, entry) => sum + entry.breakdown.availableNow, 0);
    expect(total).toBe(headlineFigures(state, now).bedsReadyNow);
  });

  it("referral board counts add up to every referral and its queue matches the sidebar", () => {
    const state = world();
    const board = referralBoardFigures(state.referrals);
    expect(board.queued.length + board.accepted.length + board.declined.length + board.otherCount).toBe(
      state.referrals.length,
    );
    expect(board.otherCount).toBeGreaterThanOrEqual(0);
    expect(board.queued.length).toBe(headlineFigures(state, now).referralsAwaitingDecision);
  });

  it("discharge groups match the sidebar's held-up count and account for every release", () => {
    const state = world();
    const discharges = dischargeFigures(state, now);
    expect(discharges.groups.blocked.length).toBe(headlineFigures(state, now).dischargesHeldUp);
    expect(discharges.shown + discharges.groups.excludedBeyondToday + discharges.groups.completedBeforeToday).toBe(
      discharges.total,
    );
  });
});
