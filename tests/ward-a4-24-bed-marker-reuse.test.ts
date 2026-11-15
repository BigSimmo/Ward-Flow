import { describe, expect, it } from "vitest";

import { bedIsOccupied } from "../src/components/ward-management/ward-admissions";
import { lockedBedsFree } from "../src/components/ward-management/ward-bed-designation";
import {
  bedNumbersBeingMadeReady,
  chooseBedNumber,
  endPreparationForSeatedBed,
} from "../src/components/ward-management/ward-bed-numbers";
import {
  seedWardFlowStateAt,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import type { Admission } from "../src/components/ward-management/ward-admissions";
import type { BedRelease } from "../src/components/ward-management/ward-model";
import { GENERAL_OBSERVATION } from "../src/components/ward-management/ward-observation";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * A4-24 (untested-537 S2, 15 Nov 2026): a bed being made ready lost its marker to another empty bed
 * when it was reused, and Ready read one short. Two causes: bed choice took the lowest free number
 * even when that bed was still being made ready, and seating a stay there never ended the marker.
 * Synthetic seed data only.
 */
const NOW = NOW_ANCHOR;
const UNIT = "fsh-adult-secure";

function bench() {
  const state = seedWardFlowStateAt(0);
  const unit = state.units.find((row) => row.id === UNIT)!;
  const occupiedLocked = unit.lockedBeds - unit.allocatableLocked;
  const current = state.admissions.filter((row) => row.unitId === UNIT && bedIsOccupied(row));
  current.forEach((row, index) => {
    row.bedKind = index < occupiedLocked ? "locked" : "open";
    row.bedNumber = index < occupiedLocked ? index + 1 : unit.lockedBeds + 1 + index - occupiedLocked;
  });
  expect(lockedBedsFree(unit)).toBeGreaterThanOrEqual(2);
  // The lowest free locked bed: its last stay has left and it is still being made ready.
  const cleaningBed = occupiedLocked + 1;
  const template = current[0]!;
  const departed: Admission = {
    ...template,
    id: "AD-A424-LEFT",
    bedKind: "locked",
    bedNumber: cleaningBed,
    state: "departed",
    leftAt: NOW,
  };
  const release: BedRelease = {
    ...(state.bedReleases.find((row) => row.unitId === UNIT) ?? state.bedReleases[0]!),
    id: "WR-A424",
    unitId: UNIT,
    admissionId: departed.id,
    state: "discharged",
    waitingOn: null,
    blocker: null,
    blockedBy: null,
    preparing: true,
    preparationNote: null,
  };
  state.admissions.push(departed);
  state.bedReleases = [...state.bedReleases.filter((row) => row.id !== release.id), release];
  return { state, unit, cleaningBed };
}

function send(state: WardFlowState, event: Omit<WardFlowEvent, "now">): WardFlowState {
  const next = wardFlowReducer(state, { ...event, now: NOW } as WardFlowEvent);
  expect(next.rejections).toEqual(state.rejections);
  return next;
}

function acceptedMovement(state: WardFlowState, bedNumber?: number) {
  const source = state.movements.find((row) => row.cohort === state.units.find((u) => u.id === UNIT)!.cohort)!;
  const movement = {
    ...source,
    id: "WF-A424" as const,
    patientId: undefined,
    referralId: undefined,
    stage: "destination_review" as const,
    acceptedUnitId: undefined,
    admissionId: undefined,
    referredUnitIds: [UNIT],
    transport: undefined,
    transportNeed: { needed: false, at: NOW },
    closure: undefined,
    highAcuity: false,
    observation: GENERAL_OBSERVATION,
    overrides: [],
    gender: "Male" as const,
    sex: "Male" as const,
    security: "Secure" as const,
  };
  const ready = { ...state, movements: [movement] };
  return send(ready, {
    type: "ACCEPT_IN_PRINCIPLE",
    role: "ward",
    movementId: movement.id,
    actingUnitId: UNIT,
    unitId: UNIT,
    ...(bedNumber === undefined ? {} : { bedNumber }),
  } as WardFlowEvent);
}

const pull = (state: WardFlowState) =>
  send(state, {
    type: "PULL_PATIENT",
    role: "ward",
    movementId: "WF-A424",
    actingUnitId: UNIT,
    unitId: UNIT,
  } as WardFlowEvent);

describe("A4-24: a bed being made ready keeps its marker and Ready stays right", () => {
  it("bed choice takes a ready bed before the lower-numbered bed still being made ready", () => {
    const { state, unit, cleaningBed } = bench();
    expect(bedNumbersBeingMadeReady(unit, state)).toEqual(new Set([cleaningBed]));
    expect(chooseBedNumber(unit, { ...state, bedReleases: [] }, "locked")).toBe(cleaningBed);
    expect(chooseBedNumber(unit, state, "locked")).not.toBe(cleaningBed);
  });

  it("seating a stay in the bed being made ready ends its marker, and only that bed's", () => {
    const { state, cleaningBed } = bench();
    const ended = endPreparationForSeatedBed(state.bedReleases, state.admissions, UNIT, cleaningBed);
    expect(ended.find((row) => row.id === "WR-A424")?.preparing).toBe(false);
    expect(endPreparationForSeatedBed(state.bedReleases, state.admissions, UNIT, cleaningBed + 1)).toBe(
      state.bedReleases,
    );
    expect(endPreparationForSeatedBed(state.bedReleases, state.admissions, "another-ward", cleaningBed)).toBe(
      state.bedReleases,
    );
  });

  it("a pull with no held bed goes to a ready bed and the marker stays on its own bed", () => {
    const { state, cleaningBed } = bench();
    const pulled = pull(acceptedMovement(state));
    const stay = pulled.admissions.find((row) => row.movementId === "WF-A424");
    expect(stay?.bedNumber).toBeDefined();
    expect(stay?.bedNumber).not.toBe(cleaningBed);
    expect(pulled.bedReleases.find((row) => row.id === "WR-A424")?.preparing).toBe(true);
  });

  it("a pull into the held bed still being made ready ends that bed's marker", () => {
    const { state, cleaningBed } = bench();
    const pulled = pull(acceptedMovement(state, cleaningBed));
    expect(pulled.admissions.find((row) => row.movementId === "WF-A424")?.bedNumber).toBe(cleaningBed);
    expect(pulled.bedReleases.find((row) => row.id === "WR-A424")?.preparing).toBe(false);
  });
});
