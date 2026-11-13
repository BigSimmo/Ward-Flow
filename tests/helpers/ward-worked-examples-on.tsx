import { useLayoutEffect, useRef } from "react";

import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * A16-14 (Josh, 13 Nov 2026): the legal-form worked examples at Armadale ED are off by default and
 * the presenter switches them on from Tools, Demo. A DOM test that needs them puts this inside its
 * `WardFlowProvider`, before the screen, and it switches them on the same way the panel does:
 * `SET_SCENARIO` with `workedExamples: true`. It runs in a layout effect, so the world is replaced
 * before `render` returns.
 */
export function WorkedExamplesOn() {
  const flow = useWardFlow();
  const done = useRef(false);
  useLayoutEffect(() => {
    if (done.current) return;
    done.current = true;
    flow.dispatch({ type: "SET_SCENARIO", role: "demo", now: flow.now, scenario: "standard", workedExamples: true });
  }, [flow]);
  return null;
}

/**
 * The world a provider pinned at `NOW_ANCHOR` holds once `WorkedExamplesOn` has run: the Standard
 * day put through the same `SET_SCENARIO`, by the real reducer. A test that stores a picture of the
 * world before rendering (a remembered review) takes it from this, so the picture carries the
 * switched world's `worldGeneration` and is not discarded as a picture of an earlier world.
 */
export function workedExamplesWorld() {
  return wardFlowReducer(seedWardFlowState(), {
    type: "SET_SCENARIO",
    role: "demo",
    now: NOW_ANCHOR,
    scenario: "standard",
    workedExamples: true,
  });
}
