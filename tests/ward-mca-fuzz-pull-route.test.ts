// Mechanics and clock audit (14 Nov 2026), D-MCA (Josh, 14 Nov 2026): the engine fuzz generator sends
// the Referrals board's one-tap pull (RAISE_REFERRAL with referralId, acceptedUnitId and pullBed) and
// ED-source referrals, so the random runs exercise the path the reviewer found untested, and the
// engine accepts it. Synthetic data only.
import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import { nextEvent, seededRandom } from "./helpers/ward-engine-fuzz";

const SEEDS = 12;
const STEPS = 80;

describe("the fuzz generator covers the one-tap pull route", () => {
  it("sends and gets accepted one-tap pulls and ED-source referrals", () => {
    let pullsSent = 0;
    let pullsAccepted = 0;
    let edReferralsAccepted = 0;
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const random = seededRandom(seed);
      let state = seedWardFlowState(WARD_SCENARIOS[seed % WARD_SCENARIOS.length]);
      for (let step = 0; step < STEPS; step += 1) {
        const event = nextEvent(state, random, step, seed, STEPS, { pullRoute: true }) as WardFlowEvent &
          Record<string, unknown>;
        const next = wardFlowReducer(state, event);
        const accepted = next.rejections.length === state.rejections.length;
        if (event.type === "RAISE_REFERRAL" && event.pullBed === true && event.referralId !== undefined) {
          pullsSent += 1;
          if (accepted) pullsAccepted += 1;
        }
        if (event.type === "RECEIVE_REFERRAL" && event.source !== "community" && accepted) edReferralsAccepted += 1;
        state = next;
      }
    }
    expect(pullsSent, "the generator sends the one-tap pull").toBeGreaterThan(0);
    expect(pullsAccepted, "the engine accepts some of them").toBeGreaterThan(0);
    expect(edReferralsAccepted, "ED-source referrals are received").toBeGreaterThan(0);
  }, 120_000);
});
