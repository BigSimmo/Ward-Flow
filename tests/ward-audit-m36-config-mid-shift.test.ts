// tests/ward-audit-m36-config-mid-shift.test.ts
//
// Audit item M36: ward and bed configuration changes mid-shift. One test per change type the app
// can make today. Each follows the same shape: desk A has work in hand against a ward (a waiting
// answer or a waiting pull, composed before the change), desk B changes the ward, then desk A's
// waiting command reaches the engine. The test checks the waiting command meets a named refusal
// rather than silently landing, the Bed board and shortlist read the change, and the change
// survives a save and reload.
//
// Opening a surge bed and renaming a ward are not features of the app (the model records no
// overflow beds, and no event renames a unit), so those two are `it.todo` and reported to Josh.
// Mid-shift threshold changes (SET_CONFIGURATION) are proven in
// tests/ward-configuration-reducer.test.ts ("an earlier pull keeps its own expiry").
// Synthetic seeded state only.

import { describe, expect, it } from "vitest";

import { pointedAtWard, wardClosedLine } from "@/components/ward-management/capacity/ward-closure";
import { bedIsOccupied } from "@/components/ward-management/ward-admissions";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { GENDER_PLACEMENT_REASONS } from "@/components/ward-management/ward-change-reasons";
import { shortlistCandidates } from "@/components/ward-management/ward-derivations-shortlist";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardStaySeats } from "@/components/ward-management/ward/ward-bed-layout";

const NOW = NOW_ANCHOR + 10;
const MOVEMENT_ID = "WF-012";
const WARD = "rph-adult-secure";

/** A command as a desk composes it, before the moment it reaches the engine stamps `now`. */
type Composed = WardFlowEvent extends infer E ? (E extends unknown ? Omit<E, "now"> : never) : never;

function apply(state: WardFlowState, event: Composed) {
  return wardFlowReducer(state, { now: NOW, ...event } as WardFlowEvent);
}
const refusedWith = (before: WardFlowState, after: WardFlowState) =>
  after.rejections.length > before.rejections.length ? after.rejections.at(-1)!.reason : undefined;
const unitOf = (state: WardFlowState) => state.units.find((unit) => unit.id === WARD)!;
const board = (state: WardFlowState) =>
  bedStates(unitOf(state), state.admissions, state.bedReleases, state.leaveBeds, []);
const reload = (state: WardFlowState) => {
  const stored = JSON.parse(JSON.stringify(state)) as WardFlowState;
  expect(isValidStoredWardFlowState(stored), "the changed state is accepted on reload").toBe(true);
  return stored;
};

function referred() {
  const state = apply(seedWardFlowState(), {
    type: "REFER_TO_UNITS",
    role: "coordinator",
    movementId: MOVEMENT_ID,
    unitIds: [WARD],
    genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
    genderPlacementChecked: true,
  });
  expect(refusedWith(seedWardFlowState(), state)).toBeUndefined();
  return state;
}
function accepted() {
  const before = referred();
  const state = apply(before, {
    type: "ACCEPT_IN_PRINCIPLE",
    role: "ward",
    movementId: MOVEMENT_ID,
    unitId: WARD,
    actingUnitId: WARD,
  });
  expect(refusedWith(before, state)).toBeUndefined();
  return state;
}
const waitingPull = {
  type: "PULL_PATIENT",
  role: "ward",
  movementId: MOVEMENT_ID,
  unitId: WARD,
  actingUnitId: WARD,
} as const;
const waitingAnswer = {
  type: "ACCEPT_IN_PRINCIPLE",
  role: "ward",
  movementId: MOVEMENT_ID,
  unitId: WARD,
  actingUnitId: WARD,
} as const;

/** Empty, open beds on the ward, as the Bed board seats them. */
function freeBeds(state: WardFlowState) {
  const unit = unitOf(state);
  const stays = state.admissions.filter((admission) => admission.unitId === WARD);
  const seats = wardStaySeats(unit, stays);
  const taken = new Set(
    stays.flatMap((stay) => {
      const bed = bedIsOccupied(stay) ? (stay.bedNumber ?? seats.get(stay.id)) : undefined;
      return bed === undefined ? [] : [bed];
    }),
  );
  const closed = new Set(
    (unit.closedBeds ?? []).filter((mark) => mark.reopenedAt === undefined).map((m) => m.bedNumber),
  );
  return [...Array(unit.beds).keys()].map((i) => i + 1).filter((bed) => !taken.has(bed) && !closed.has(bed));
}

describe("M36 ward and bed changes mid-shift", () => {
  it("closing the last Ready bed refuses a waiting pull by name, and the Bed board and reload agree", () => {
    const state = accepted();
    const readyBefore = board(state).ready;
    expect(readyBefore, "the seed leaves the ward one Ready bed").toBeGreaterThan(0);
    // Close Ready beds until none is left; the engine refuses once nothing Ready remains.
    let closed = state;
    for (const bedNumber of freeBeds(state)) {
      const next = apply(closed, {
        type: "SET_BED_CLOSED",
        role: "ward",
        unitId: WARD,
        actingUnitId: WARD,
        bedNumber,
        closed: true,
      });
      if (refusedWith(closed, next)) {
        expect(refusedWith(closed, next)).toMatch(/no Ready bed to close/);
        break;
      }
      closed = next;
    }
    expect(board(closed).ready).toBe(0);
    expect(board(closed).closed).toBe(board(state).closed + readyBefore);

    const stored = reload(closed);
    expect(board(stored)).toEqual(board(closed));

    // Desk A's pull was composed while a bed was Ready; it lands after the close.
    const afterPull = apply(stored, waitingPull);
    expect(refusedWith(stored, afterPull)).toMatch(/no Ready bed remains at /);
    expect(afterPull.movements.find((m) => m.id === MOVEMENT_ID)!.stage).toBe("accepted_awaiting_bed");

    // Reopening a bed lets the same waiting pull through.
    const bedNumber = unitOf(closed).closedBeds!.find((mark) => mark.reopenedAt === undefined)!.bedNumber;
    const reopened = apply(stored, {
      type: "SET_BED_CLOSED",
      role: "ward",
      unitId: WARD,
      actingUnitId: WARD,
      bedNumber,
      closed: false,
    });
    const pulled = apply(reopened, waitingPull);
    expect(refusedWith(reopened, pulled)).toBeUndefined();
    expect(pulled.movements.find((m) => m.id === MOVEMENT_ID)!.stage).toBe("pulled");
  });

  it("closing a ward to admissions refuses a waiting answer and a waiting pull, lists who it affects, and survives reload", () => {
    const close = {
      type: "CLOSE_WARD_TO_ADMISSIONS",
      role: "coordinator",
      unitId: WARD,
      reason: "infection_outbreak",
    } as const;
    const waiting = referred();
    const closedWhileAsked = reload(apply(waiting, close));
    expect(wardClosedLine(unitOf(closedWhileAsked))).toBe("Closed to admissions · Infection outbreak");
    // The coordinator's alert list names the request still pointed at the ward.
    expect(pointedAtWard(WARD, closedWhileAsked.movements, closedWhileAsked.referrals)).toContainEqual(
      expect.objectContaining({ kind: "bed_request", id: MOVEMENT_ID, status: "asked" }),
    );
    expect(refusedWith(closedWhileAsked, apply(closedWhileAsked, waitingAnswer))).toMatch(/closed to admissions/);

    const yes = accepted();
    const closedWhileAccepted = reload(apply(yes, close));
    expect(
      closedWhileAccepted.movements.find((m) => m.id === MOVEMENT_ID)!.acceptedUnitId,
      "the acceptance stands",
    ).toBe(WARD);
    expect(refusedWith(closedWhileAccepted, apply(closedWhileAccepted, waitingPull))).toMatch(
      /is closed; a new bed cannot be reserved/,
    );

    const other = closedWhileAccepted.movements.find(
      (m) => !m.closure && m.stage === "placement_requested" && m.id !== MOVEMENT_ID,
    )!;
    const shortlisted = shortlistCandidates(other, closedWhileAccepted.units, NOW).find((c) => c.unit.id === WARD);
    expect(shortlisted?.verdict.eligible ?? false).toBe(false);
  });

  it.todo(
    "opening a surge bed mid-shift carries through every screen (no such feature: the model records no overflow beds)",
  );
  it.todo("renaming a ward mid-shift carries through every screen, waiting save and alert (no event renames a ward)");
});
