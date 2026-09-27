import { describe, expect, it } from "vitest";

import { OVERRIDE_REASONS } from "../src/components/ward-management/ward-change-reasons";
import type { WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * ⚠️ THE PROOF `PULL_PATIENT`'S OWN COMMENT ASKS FOR, AND THE ONE THAT DID NOT EXIST.
 *
 * Outstanding issue `#Q6WD1M` (P1) has stayed open since 2026-09-02 for a reason worth restating,
 * because it is the reason this file is shaped the way it is rather than being one assertion.
 *
 * The original finding was a real asymmetry: the coordinator's placement path applied no
 * eligibility judgement at all while `ACCEPT_REFERRAL` at the other end refused on the first
 * failing gate of any kind. **One end refused everything, the other refused nothing.** PR #2571
 * closed it by calling `eligibilityRefusal()` on three paths, the coordinator pull among them.
 *
 * 🔴 **THE ROW STAYED OPEN BECAUSE THE FIX HAD NO PROOF, AND THE OBVIOUS PROOF IS A FALSE ONE.**
 * The reducer's own comment above that call says so in as many words: *"A RED HERE PROVES NOTHING
 * ON ITS OWN. The specialling refusal directly above fires for a patient who fails BOTH that check
 * and an eligibility gate, and reading it as 'the engine now enforces eligibility' nearly closed
 * this finding falsely. Prove this gate on a pair whose ONLY failing gate is cohort."*
 *
 * Every pull-path refusal test that already existed asserts a PHYSICAL gate — no allocatable bed,
 * no specialling headroom, a bed still being cleaned, sex mix. Those all pass against a build in
 * which the judgement gate was never wired, because each is refused by a separate `return reject`
 * ABOVE it. The one reducer-level suitability assertion in the suite,
 * `tests/ward-referral-reducer.test.ts:451`, exercises `ACCEPT_REFERRAL` — the other end — on a
 * fixture where BOTH `age` and `security` fail.
 *
 * WHY WF-003 AND COHORT. The movement path of `eligibility()` emits ten gates, and `cohort` is the
 * only one keyed to `Movement.cohort`; `age` reads `referral.ageBand` and exists on the referral
 * path alone. So moving WF-003 from `"Adult"` to `"Older adult"` flips exactly one gate and
 * touches no other. WF-003 already sits at `accepted_awaiting_bed`, accepted at `rph-adult-secure`
 * (an `"Adult"`, authorised, `"Undesignated"` unit), and carries `specialling: false` — so the
 * refusal directly above the gate cannot fire for it and steal the red.
 */

const NOW = NOW_ANCHOR;

/** The seed, with WF-003's cohort replaced and NOTHING else touched. */
function seededWithCohort(cohort: "Adult" | "Older adult"): WardFlowState {
  const state = seedWardFlowState();
  return {
    ...state,
    movements: state.movements.map((m) => (m.id === "WF-003" ? { ...m, cohort } : m)),
  };
}

function pull(state: WardFlowState, overrideReason?: string) {
  return wardFlowReducer(state, {
    type: "PULL_PATIENT",
    role: "coordinator",
    now: NOW,
    movementId: "WF-003",
    unitId: "rph-adult-secure",
    ...(overrideReason === undefined ? {} : { overrideReason }),
  } as Parameters<typeof wardFlowReducer>[1]);
}

describe("PULL_PATIENT refuses a judgement gate on the coordinator's own path", () => {
  /**
   * ⚠️ THE POSITIVE CONTROL, AND IT IS NOT A COURTESY — IT IS WHAT MAKES THE NEXT TEST MEAN
   * ANYTHING. Without it a refusal below could be coming from any of the six checks that run
   * BEFORE the gate (wrong stage, wrong unit, no allocatable bed, a bed being prepared,
   * specialling), and the test would read as proof of a gate that was never consulted. This
   * asserts the same dispatch, differing ONLY in cohort, is accepted.
   */
  it("accepts the identical pull when the cohort matches", () => {
    const after = pull(seededWithCohort("Adult"));
    expect(after.rejections, `refused before cohort was even reached: ${after.rejections[0]?.reason}`).toHaveLength(0);
    expect(after.movements.find((m) => m.id === "WF-003")?.stage).toBe("pulled");
  });

  it("refuses the pull when cohort is the only failing gate, and names cohort", () => {
    const after = pull(seededWithCohort("Older adult"));

    expect(after.rejections).toHaveLength(1);
    const reason = after.rejections[0].reason;

    /*
     * ⚠️ THE GATE IS NAMED IN ITS `failed gate <name>:` FORM, never as a bare substring. A
     * `toContain("cohort")` would also be satisfied by the detail text of a DIFFERENT gate that
     * happened to mention the word, which is precisely how a refusal from the wrong cause reads as
     * a pass. The neighbouring suite records the same trap for "age" matching "manage"/"storage".
     */
    expect(reason, `refused, but not by the cohort gate: ${reason}`).toContain("failed gate cohort:");

    // 🔴 AND IT IS NOT ONE OF THE REFUSALS ABOVE. Each of these is a `return reject` that fires
    // earlier in the same case, and any one of them would produce a red that proves nothing.
    expect(reason).not.toContain("no allocatable bed remains");
    expect(reason).not.toContain("still being made ready");
    expect(reason).not.toContain("specialling capacity left");
    // O-16.8 reworded this refusal (it now names the stage by its coordinator-facing label).
    // ⚠️ THE STRING HAD TO BE UPDATED OR THIS ASSERTION WOULD HAVE BECOME UNFAILABLE: a
    // negative match on text that no longer exists anywhere can never fire, and it would have
    // gone on reporting success while checking nothing.
    expect(reason).not.toContain("cannot pull a bed at the movement's current stage");

    // The transition did not happen — the property that matters. A screen can say "not eligible"
    // against a build where the state still changed.
    expect(after.movements.find((m) => m.id === "WF-003")?.stage).toBe("accepted_awaiting_bed");
  });

  /**
   * `cohort` is inside `SUITABILITY_GATES`, so the owner's 2026-09-02 ruling applies: a judgement
   * about the patient is overridable by a named human recording why; a fact about the world is
   * not. A refusal with no way through would be a different defect, and the front door had exactly
   * that one before PR #2571.
   */
  it("lets a recorded reason through the same gate", () => {
    const after = pull(seededWithCohort("Older adult"), OVERRIDE_REASONS[0]);
    expect(after.rejections, `the override was refused: ${after.rejections[0]?.reason}`).toHaveLength(0);
    expect(after.movements.find((m) => m.id === "WF-003")?.stage).toBe("pulled");
  });
});
