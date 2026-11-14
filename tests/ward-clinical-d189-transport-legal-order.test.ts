import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { legalFormStatusWarning } from "@/components/ward-management/ward-legal-form-fit";
import {
  FOLLOW_ON_WITH_NO_EARLIER_FORM,
  followOnFormWarning,
  legalRecordWarnings,
} from "@/components/ward-management/ward-legal-order-rules";
import type { Movement } from "@/components/ward-management/ward-model";
import { WARD_SCENARIOS, type WardScenario } from "@/components/ward-management/ward-scenarios";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * D-186 item 5, D-187 item 6 and D-189 items 9(c) and 9(g) (Josh, 13 Nov 2026): legal pairing and
 * order problems are warnings in one place, used by the record actions and the sample-data check.
 * A follow-on form, for now, is a form recorded through the continuation action while no form is
 * on file. Synthetic seed records only.
 */

/**
 * THE SAMPLE'S EXPECTED LEGAL ORDER WARNINGS: one row per person who has any. Every person not
 * listed must have none. Package D (sample day) edits this table when it changes a status or form,
 * so a new mismatch in the sample fails here until someone decides it is meant.
 */
const EXPECTED_SAMPLE_WARNINGS: ReadonlyArray<{ scenario: WardScenario; movementId: string; warnings: string[] }> = [
  // No sample person has a legal order warning today.
];

describe("the sample-data check reads the one rule for every scenario", () => {
  it.each(WARD_SCENARIOS)("%s: each person's warnings equal the expected table", (scenario) => {
    const expected = new Map(
      EXPECTED_SAMPLE_WARNINGS.filter((row) => row.scenario === scenario).map((row) => [row.movementId, row.warnings]),
    );
    const seed = seedWardFlowState(scenario);
    expect(seed.movements.length).toBeGreaterThan(0);
    for (const movement of seed.movements) {
      expect(legalRecordWarnings(movement), `${scenario} ${movement.id}`).toEqual(expected.get(movement.id) ?? []);
    }
    // A row naming someone who is not in the scenario is a stale row.
    for (const id of expected.keys())
      expect(
        seed.movements.some((movement) => movement.id === id),
        id,
      ).toBe(true);
  });
});

describe("the pairing warnings are unchanged", () => {
  const record = (fields: Partial<Movement>) => fields as Pick<Movement, "legalStatus" | "legalForm">;

  it("names a form chosen for a Voluntary status, and no form for a status that rests on one", () => {
    expect(legalRecordWarnings(record({ legalStatus: "Voluntary", legalForm: { code: "3B" } }))).toEqual([
      legalFormStatusWarning("Voluntary", "3B"),
    ]);
    expect(legalRecordWarnings(record({ legalStatus: "Involuntary inpatient" }))).toEqual([
      legalFormStatusWarning("Involuntary inpatient", null),
    ]);
    expect(legalRecordWarnings(record({ legalStatus: "Voluntary" }))).toEqual([]);
    expect(legalRecordWarnings(record({ legalStatus: "Involuntary inpatient", legalForm: { code: "6A" } }))).toEqual(
      [],
    );
  });
});

describe("a follow-on form with no earlier form on file warns, and is never refused", () => {
  const seedOf = () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((candidate) => candidate.id === "WF-002")!;
    return { state, movement };
  };

  it("warns for a continuation while no form is on file, and not once a form is on file", () => {
    const { movement } = seedOf();
    expect(movement.legalForm).toBeUndefined();
    expect(followOnFormWarning(movement, { continuationFormCode: "6B" })).toBe(FOLLOW_ON_WITH_NO_EARLIER_FORM);
    expect(followOnFormWarning({ legalForm: { code: "6A" } }, { continuationFormCode: "6B" })).toBeNull();
    // Only the app's own continuation action counts (D-189 item 9(c)): no form code list is held.
    expect(followOnFormWarning(movement, undefined)).toBeNull();
    expect(legalRecordWarnings(movement, { continuationFormCode: "6B" })).toContain(FOLLOW_ON_WITH_NO_EARLIER_FORM);
  });

  it("the engine accepts the continuation all the same", () => {
    const { state, movement } = seedOf();
    const after = wardFlowReducer(state, {
      type: "RECORD_LEGAL_FORM_CONTINUATION",
      role: "coordinator",
      now: NOW_ANCHOR + 10,
      movementId: movement.id,
      formCode: "6B",
      startedAt: NOW_ANCHOR,
    });
    expect(after.rejections).toHaveLength(state.rejections.length);
    expect(after.movements.find((candidate) => candidate.id === movement.id)!.legalForm?.code).toBe("6B");
  });

  it("typed-time order checks stay blocks (D-189 item 9(g))", () => {
    const { state, movement } = seedOf();
    const after = wardFlowReducer(state, {
      type: "RECORD_LEGAL_FORM_CONTINUATION",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: movement.id,
      formCode: "6B",
      startedAt: NOW_ANCHOR + 60,
    });
    expect(after.rejections).toHaveLength(state.rejections.length + 1);
  });
});
