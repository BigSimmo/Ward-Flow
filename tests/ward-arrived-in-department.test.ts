import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-events";

/**
 * THE DOOR FROM "EXPECT" TO "REFERRAL", AND BEFORE THIS EVENT THERE WAS NO DOOR.
 *
 * Product owner, 2026-09-07, defining a concept this model did not have: *"When a patient is
 * referred to the ED and not in the ED then they are an **expect**… When expects arrive and are
 * marked as arrived, they become referrals."*
 *
 * 🔴 **WHY A NEW EVENT WAS UNAVOIDABLE.** `Referral.triagedAt` is written in exactly one place —
 * inside `RECEIVE_REFERRAL`, at the moment a referral is created. Measured 2026-09-07: all three of
 * its mentions in `ward-flow-reducer.ts` sit in that case, against controls in the same file of
 * `stage:` 13 and `legalForm` 5, so the search was working. **A referral created without a triage
 * time could therefore never acquire one**, and an expects list built on triage could only ever
 * grow — no action in the running prototype could move anybody off it. **The same shape as
 * `LegalForm.dueAt`, whose only writer was the seed fixture, found the same day.**
 *
 * ⚠️ **AND `PATIENT_ARRIVED` COULD NOT BE REUSED.** It takes a `movementId`, requires
 * `stage === "moving"` with a `transport.collectedAt`, and marks arrival at a destination WARD at
 * the end of the ED→ward journey. An emergency department can never be a movement destination.
 * **It is the opposite direction of travel.**
 */

const NOW = 9 * 60;

/** A real seeded referral id, taken from the state rather than hardcoded — a literal id would rot
 *  the moment the fixture changed, and would fail as "no referral found" rather than as staleness. */
function anyReferralId(state: WardFlowState): string {
  const first = state.referrals[0];
  expect(first, "the seed must carry referrals, or every case below is vacuous").toBeDefined();
  return first!.id;
}

function record(state: WardFlowState, referralId: string, now: number, role = "ed" as const) {
  return wardFlowReducer(state, { type: "RECORD_ARRIVED_IN_DEPARTMENT", role, now, referralId });
}

describe("recording that a referred person is physically in the department", () => {
  it("writes the arrival, where nothing could write one before", () => {
    const before = seedWardFlowState();
    const id = anyReferralId(before);

    // Anti-vacuity: if the seed ever ships this field populated, the assertion below would pass
    // without the reducer having done anything at all.
    expect(
      before.referrals.find((r) => r.id === id)?.inDepartmentAt,
      "the seeded referral must start with no arrival recorded",
    ).toBeUndefined();

    const after = record(before, id, NOW);
    expect(after.rejections, "the recording must be accepted, or nothing below is exercised").toEqual([]);
    expect(after.referrals.find((r) => r.id === id)?.inDepartmentAt).toBe(NOW);
  });

  /**
   * ⚠️ IDEMPOTENT, AND THE EARLIER TIME WINS. Two clinicians noticing the same patient is ordinary,
   * so a second recording is a no-op rather than a rejection — a refusal would read on screen as
   * though the first had failed. And the field answers "since when has this person been here", so
   * overwriting with a later observation would shorten a wait that actually happened.
   */
  it("keeps the first time when a second clinician records the same arrival", () => {
    const once = record(seedWardFlowState(), anyReferralId(seedWardFlowState()), NOW);
    const id = anyReferralId(once);
    const twice = record(once, id, NOW + 45);

    expect(twice.rejections, "a repeat recording must not be an error").toEqual([]);
    expect(
      twice.referrals.find((r) => r.id === id)?.inDepartmentAt,
      "the FIRST observation must survive — a later one would shorten a real wait",
    ).toBe(NOW);
  });

  it("refuses a referral id that does not exist, rather than silently doing nothing", () => {
    const after = record(seedWardFlowState(), "RF-does-not-exist", NOW);
    expect(after.rejections.length, "an unknown id must be rejected").toBeGreaterThan(0);
    // 🔴 The subject must be the REFERRAL. This event carries no `movementId`, so a reducer that
    // forgot to list it in `subjectId` would stamp the rejection with `undefined` — which renders
    // as a rejection belonging to nothing rather than as an error, and only ever on this path.
    expect(
      after.rejections.at(-1)?.movementId,
      "the rejection must name the referral it was about, not undefined",
    ).toBe("RF-does-not-exist");
  });
});

describe("who may record it", () => {
  /**
   * The owner named the party: *"the ED psychiatry doctors notice the patient has arrived in ED"*.
   *
   * ⚠️ **THERE IS NO RUNTIME LIST OF ROLES — `WardFlowRole` is a type-only union — so this guard has
   * to manufacture one, and a hand-written array would silently stop covering a role the day one is
   * added.** The `Record<WardFlowRole, true>` is what prevents that: TypeScript refuses to compile
   * it if a role appears in the union and not here. ⚠️ **And `npm run typecheck` is the only thing
   * that checks it — vitest does not typecheck, which is exactly how the first draft of this file
   * imported a `WARD_FLOW_ROLES` that does not exist and still ran.**
   */
  const EVERY_ROLE: Record<WardFlowRole, true> = {
    coordinator: true,
    ed: true,
    ward: true,
    officer: true,
    demo: true,
    community: true,
    bed_manager: true,
    executive: true,
  };

  it("permits the ED and refuses every other role", () => {
    const others = (Object.keys(EVERY_ROLE) as WardFlowRole[]).filter(
      (role) => role !== "ed" && role !== "coordinator",
    );
    expect(others.length, "there must be other roles, or the refusals below prove nothing").toBeGreaterThan(0);

    for (const role of others) {
      const state = seedWardFlowState();
      const after = record(state, anyReferralId(state), NOW, role as "ed");
      expect(after.rejections.at(-1)?.reason, `${role}'s refusal must name the role rule`).toContain(
        "requires role ed",
      );
      expect(after.rejections.length, `${role} must not be able to record an arrival`).toBeGreaterThan(0);
    }

    const permitted = seedWardFlowState();
    expect(record(permitted, anyReferralId(permitted), NOW).rejections).toEqual([]);
  });
});
