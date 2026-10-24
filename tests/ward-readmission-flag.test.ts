import { describe, expect, it } from "vitest";

import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { scopeWardFlowState } from "../src/components/ward-management/ward-access-state";
import { seedWardFlowState, type WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { READMISSION_WINDOW_DAYS } from "../src/components/ward-management/ward-readmission";
import { wardCopyReadmission } from "../src/components/ward-management/ward-readmission-copy";
import type { Movement } from "../src/components/ward-management/ward-model";
import type { WardAccess } from "../src/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * D-80 (Josh's yes, 23 Oct 2026): a ward sees the 28 day readmission flag once it has accepted the
 * person. Its scoped copy holds no other ward's stays, so the flag rides on its own accepted journey
 * as the discharge time only.
 */
const seed = seedWardFlowState();
const places = wardPlaceLookup(seed.units);
const options = { now: NOW_ANCHOR, places };
const WINDOW = READMISSION_WINDOW_DAYS * 24 * 60;
const DAY = 24 * 60;

// AD-LEFT-01 is a synthetic discharge to the community from one ward.
const priorStay = seed.admissions.find((admission) => admission.id === "AD-LEFT-01")!;
const accepted = seed.movements.find(
  (movement) =>
    movement.acceptedUnitId !== undefined &&
    movement.acceptedUnitId !== priorStay.unitId &&
    movement.patientId !== undefined &&
    movement.closure === undefined,
)!;
const ward: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [accepted.acceptedUnitId!] } };
const coordinator: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };

/** The same person discharged from the other ward `before` minutes before the journey opened. */
function dischargedBefore(before: number, base: WardFlowState = seed): WardFlowState {
  return {
    ...base,
    admissions: base.admissions.map((admission) =>
      admission.id === priorStay.id
        ? {
            ...admission,
            patientId: accepted.patientId!,
            referralId: null,
            movementId: null,
            leftAt: accepted.openedAt - before,
          }
        : admission,
    ),
  };
}

const wardCopy = (world: WardFlowState, access: WardAccess = ward) => scopeWardFlowState(world, access, options).state;
const journey = (world: WardFlowState) => world.movements.find((movement) => movement.id === accepted.id)!;

describe("readmission flag on a ward's copy (D-80)", () => {
  it("finds the seed fixture it needs", () => {
    expect(priorStay.leavingDestination).not.toBe("transferred-to-another-psychiatric-ward");
    expect(accepted).toBeDefined();
    expect(journey(wardCopy(seed)).readmissionDischargedAt).toBeUndefined();
  });

  it("flags the accepted person discharged from another ward inside the window, as the time only", () => {
    const world = dischargedBefore(3 * DAY);
    const copy = wardCopy(world);
    const flagged = journey(copy);
    expect(flagged.readmissionDischargedAt).toBe(accepted.openedAt - 3 * DAY);
    expect(wardCopyReadmission(flagged)).toEqual({ dischargedAt: accepted.openedAt - 3 * DAY, daysBefore: 3 });
    // The other ward's stay itself never reaches the ward.
    expect(copy.admissions.some((admission) => admission.id === priorStay.id)).toBe(false);
  });

  it("includes the window's last minute and nothing after it", () => {
    expect(journey(wardCopy(dischargedBefore(WINDOW))).readmissionDischargedAt).toBe(accepted.openedAt - WINDOW);
    expect(journey(wardCopy(dischargedBefore(WINDOW + 1))).readmissionDischargedAt).toBeUndefined();
  });

  it("adds nothing else about the other ward: the copy differs only by the discharge time", () => {
    const flagged = journey(wardCopy(dischargedBefore(3 * DAY)));
    const unflagged = journey(wardCopy(dischargedBefore(WINDOW + DAY)));
    const { readmissionDischargedAt, ...rest } = flagged;
    expect(readmissionDischargedAt).toBeDefined();
    expect(rest).toEqual(unflagged);
    const text = JSON.stringify(flagged);
    expect(text).not.toContain(priorStay.id);
    expect(text).not.toContain(`"${priorStay.unitId}"`);
  });

  it("does not flag a journey the ward has only been asked about, not accepted", () => {
    const asked: Movement = {
      ...accepted,
      acceptedUnitId: undefined,
      referredUnitIds: [accepted.acceptedUnitId!],
    };
    const world = dischargedBefore(3 * DAY, {
      ...seed,
      movements: seed.movements.map((movement) => (movement.id === accepted.id ? asked : movement)),
    });
    const copy = journey(wardCopy(world));
    expect(copy).toBeDefined();
    expect(copy.readmissionDischargedAt).toBeUndefined();
  });

  it("leaves the coordinator's whole view unchanged", () => {
    const world = dischargedBefore(3 * DAY);
    const whole = wardCopy(world, coordinator);
    expect(whole.movements).toBe(world.movements);
    expect(whole.movements.some((movement) => movement.readmissionDischargedAt !== undefined)).toBe(false);
  });

  it("keeps the flag when the browser scopes the server's ward copy again", () => {
    const server = wardCopy(dischargedBefore(3 * DAY));
    const browser = wardCopy(server);
    expect(journey(browser).readmissionDischargedAt).toBe(accepted.openedAt - 3 * DAY);
    expect(browser.movements).toEqual(server.movements);
  });
});
