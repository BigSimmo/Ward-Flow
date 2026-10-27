import { describe, expect, it } from "vitest";

import { toHandoverWard } from "@/components/ward-management/handover/handover-model";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { dueSoonThresholdsOf } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { headlineAvailable } from "@/components/ward-management/ward-board-derivations";
import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";
import { bedsReadySummary } from "@/components/ward-management/referrals/referral-board-parts";
import { WARD_SCENARIOS, scenarioWardNetwork } from "@/components/ward-management/ward-scenarios";
import { nextEvent, nowFor, seededRandom } from "./helpers/ward-engine-fuzz";

/**
 * Audit 6 (Josh, 20 Oct 2026): "beds ready" leaves out a bed pulled for an incoming patient, on every
 * screen. The audit's probe found the rail's figure and Home's bed flow apart in 1 state in 11 after
 * random actions, starting with a pull. This replays the engine's own fuzz and, after every accepted
 * action, reads the rail (`wardNavCounts`), Handover's wards, the bed board's headline and the bed-state boxes the bed flow,
 * Capacity and the TV draw. They must agree; and the old formula must have split from them at least
 * once, so the run is known to reach the case.
 */
describe("beds ready agrees on every screen after a pull", () => {
  it("rail, Handover and the bed-state boxes give one figure", () => {
    let checked = 0;
    let oldFormulaSplit = 0;
    for (let seed = 0; seed < WARD_SCENARIOS.length * 2; seed += 1) {
      const scenario = WARD_SCENARIOS[seed % WARD_SCENARIOS.length]!;
      const sites = scenarioWardNetwork(scenario).sites;
      const random = seededRandom(6000 + seed);
      let state: WardFlowState = seedWardFlowState(scenario);
      for (let step = 0; step < 150; step += 1) {
        const next = wardFlowReducer(state, nextEvent(state, random, step));
        const refused = next.rejections.length > state.rejections.length;
        state = next;
        if (refused) continue;
        const now = nowFor(state, step);
        const nav = wardNavCounts({
          movements: state.movements,
          units: state.units,
          sites,
          referrals: state.referrals,
          bedReleases: state.bedReleases,
          leaveBeds: state.leaveBeds,
          admissions: state.admissions,
          now,
          thresholds: dueSoonThresholdsOf(state.configuration),
        });
        const boxes = state.units.reduce(
          (sum, unit) => sum + bedStates(unit, state.admissions, state.bedReleases, state.leaveBeds).ready,
          0,
        );
        const handover = state.units.reduce(
          (sum, unit) => sum + toHandoverWard(unit, state.admissions, now, state.bedReleases).ready,
          0,
        );
        expect(nav.capacity?.value, `${scenario} seed ${seed} step ${step}`).toBe(boxes);
        expect(handover, `${scenario} seed ${seed} step ${step}`).toBe(boxes);
        const board = state.units.reduce(
          (sum, unit) => sum + headlineAvailable(unit, state.admissions, state.bedReleases, state.leaveBeds, now),
          0,
        );
        expect(board, `${scenario} seed ${seed} step ${step}`).toBe(boxes);
        // NA2-06 (audit 24 Oct 2026): Referrals' "Beds ready statewide" reads the same figure.
        const referrals = bedsReadySummary(state.units, state.admissions, state.bedReleases, now);
        expect(referrals.total, `${scenario} seed ${seed} step ${step}`).toBe(boxes);
        const old = state.units.reduce((sum, unit) => sum + boundedBedAvailability(unit).available, 0);
        if (old !== boxes) oldFormulaSplit += 1;
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(500);
    expect(oldFormulaSplit, "the run reaches a pull the old formula counted as ready").toBeGreaterThan(0);
  });
});
