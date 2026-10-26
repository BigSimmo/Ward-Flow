/**
 * Audit 24-1, E-19: the random engine run (`tests/helpers/ward-engine-fuzz.ts`) must not only send
 * every event type in the role table but see each one accepted at least once, so every success path
 * is reached by the same generator the safety rules run against. `tests/ward-engine-safety.test.ts`
 * already asserts every type is sent; this asserts every type is accepted.
 *
 * Deterministic: the same consecutive seeds every run (scenario = seed mod scenario count, as the
 * safety test), stopping as soon as every type but the allowed exception has been accepted. At
 * 24 Oct 2026 that is seed 238 of 400, about 25 seconds locally. If a generator or engine change
 * pushes a type past the last seed, the failure names it: aim its builder at the subject its gate
 * needs (as the E-19 builders do) rather than widening the window.
 *
 * Synthetic seeded worlds only.
 */
import { describe, expect, it } from "vitest";

import { EVENT_ROLE, type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import { nextEvent, seededRandom } from "./helpers/ward-engine-fuzz";

const FIRST_SEED = 1;
// 400 until 24 Oct 2026: removing RELEASE_BED from the generator shifted the random runs, and the
// rare country extension now first lands after seed 400. The loop stops once everything is seen.
const LAST_SEED = 1000;
const STEPS = 300;

/**
 * No exceptions. RELEASE_BED was the only one (audit 24-1 C-02) and was removed from the engine by
 * owner decision 4 (24 Oct 2026), because recording the leaving already completes the release.
 */
const NEVER_ACCEPTED_ALLOWED: readonly WardFlowEvent["type"][] = [];

describe("random engine run coverage (audit 24-1 E-19)", () => {
  it("sees every event type in the role table accepted at least once", { timeout: 120_000 }, () => {
    const allTypes = Object.keys(EVENT_ROLE) as WardFlowEvent["type"][];
    const required = allTypes.filter((type) => !NEVER_ACCEPTED_ALLOWED.includes(type));
    const accepted = new Set<WardFlowEvent["type"]>();
    let lastSeedRun = FIRST_SEED - 1;
    for (let seed = FIRST_SEED; seed <= LAST_SEED; seed += 1) {
      const random = seededRandom(seed);
      let state = seedWardFlowState(WARD_SCENARIOS[seed % WARD_SCENARIOS.length]);
      for (let step = 0; step < STEPS; step += 1) {
        const event = nextEvent(state, random, step, seed, STEPS);
        const next = wardFlowReducer(state, event);
        // As the safety test counts it: an accepted event adds no rejection.
        if (next.rejections.length === state.rejections.length) accepted.add(event.type);
        state = next;
      }
      lastSeedRun = seed;
      if (required.every((type) => accepted.has(type))) break;
    }
    const neverAccepted = required.filter((type) => !accepted.has(type));
    expect(neverAccepted, `never accepted in seeds ${FIRST_SEED}-${lastSeedRun} of ${STEPS} steps`).toEqual([]);
    // If an allowed exception starts being accepted, the exception is stale: take it off the list.
    const nowReached = NEVER_ACCEPTED_ALLOWED.filter((type) => accepted.has(type));
    expect(nowReached, "allowed never-accepted types that were accepted after all").toEqual([]);
  });
});
