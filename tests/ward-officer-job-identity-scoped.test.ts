import { describe, expect, it } from "vitest";

import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { scopeWardFlowState } from "../src/components/ward-management/ward-access-state";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import type { Movement } from "../src/components/ward-management/ward-model";
import { resolveSubjectPatient } from "../src/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * Walk-through WT-01 (26 Oct 2026): a job booked from a referral reached the officer's scoped copy
 * with its referral link but no referrals to follow it. The journey named its person only through
 * that referral, so the officer saw "Not recorded" for the person they were collecting.
 */
const state = seedWardFlowState();
const places = wardPlaceLookup(state.units);
const isJob = (movement: Movement) =>
  movement.transport !== undefined && movement.transport.arrivedAt === undefined && movement.closure === undefined;

describe("transport officer sees who to collect with role access on (WT-01)", () => {
  it("names a referral-booked job in the officer's own copy", () => {
    const job = state.movements.find(isJob);
    const referral = state.referrals.find((candidate) => candidate.patientId);
    if (!job || !referral) throw new Error("the seed needs an open job and a linked referral");
    // The journey names its person only through the referral, as the walk-through's job did.
    const world = {
      ...state,
      movements: state.movements.map((movement) =>
        movement.id === job.id ? { ...movement, patientId: undefined, referralId: referral.id } : movement,
      ),
    };
    const full = resolveSubjectPatient(
      world.movements.find(({ id }) => id === job.id),
      world,
    );
    expect(full.patient).toBeDefined();
    const scoped = scopeWardFlowState(
      world,
      { role: "officer", scope: { kind: "jobs" } },
      { now: NOW_ANCHOR, places },
    ).state;
    expect(scoped.referrals).toEqual([]);
    const seen = resolveSubjectPatient(
      scoped.movements.find(({ id }) => id === job.id),
      scoped,
    );
    expect(seen.patient).toBeDefined();
    expect(seen.displayName).toBe(full.displayName);
    // The officer's copy still carries no record number (role access plan, 15 Oct 2026).
    expect(seen.patient?.umrn).toBe("");
  });
});
