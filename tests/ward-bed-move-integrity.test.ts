import { describe, expect, it } from "vitest";
import { isDeepStrictEqual } from "node:util";

import { bedIsOccupied } from "../src/components/ward-management/ward-admissions";
import { lockedBedsFree, openBedsFree } from "../src/components/ward-management/ward-bed-designation";
import {
  seedWardFlowStateAt,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { isValidStoredWardFlowState } from "../src/components/ward-management/ward-flow-storage-validation";

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
  expect(lockedBedsFree(unit)).toBeGreaterThan(0);
  expect(openBedsFree(unit)).toBeGreaterThan(0);
  return { state, unit, current, occupiedLocked };
}

function send(state: WardFlowState, event: Omit<WardFlowEvent, "now">): WardFlowState {
  const next = wardFlowReducer(state, { ...event, now: NOW } as WardFlowEvent);
  expect(next.rejections).toEqual(state.rejections);
  return next;
}

describe("numbered bed designation integrity", () => {
  it.each(["open", "locked"] as const)(
    "moving from %s to the other kind updates capacity and Undo restores it",
    (kind) => {
      const { state, unit, current, occupiedLocked } = bench();
      const stay = current.find((row) => row.bedKind === kind && row.state === "occupied")!;
      expect(stay).toBeDefined();
      const targetKind = kind === "open" ? "locked" : "open";
      const target = kind === "open" ? occupiedLocked + 1 : Math.max(...current.map((row) => row.bedNumber!)) + 1;
      const before = { locked: lockedBedsFree(unit), open: openBedsFree(unit) };
      const moved = send(state, {
        type: "PLACE_IN_BED",
        role: "ward",
        admissionId: stay.id,
        actingUnitId: UNIT,
        bedNumber: target,
      } as WardFlowEvent);
      const updated = moved.units.find((row) => row.id === UNIT)!;
      expect(moved.admissions.find((row) => row.id === stay.id)?.bedKind).toBe(targetKind);
      expect(lockedBedsFree(updated)).toBe(before.locked + (kind === "locked" ? 1 : -1));
      expect(openBedsFree(updated)).toBe(before.open + (kind === "locked" ? -1 : 1));
      const undone = send(moved, {
        type: "UNDO_PLACE_IN_BED",
        role: "ward",
        admissionId: stay.id,
        actingUnitId: UNIT,
      } as WardFlowEvent);
      expect(isDeepStrictEqual(undone.admissions, state.admissions)).toBe(true);
      expect(undone.units.find((row) => row.id === UNIT)?.allocatableLocked).toBe(unit.allocatableLocked);
      expect(undone.units.find((row) => row.id === UNIT)?.allocatable.revision).toBeGreaterThan(
        updated.allocatable.revision!,
      );
    },
  );

  it("does not overwrite a later capacity confirmation when Undo restores a changed bed kind", () => {
    const { state, current, occupiedLocked } = bench();
    const stay = current.find((row) => row.bedKind === "open" && row.state === "occupied")!;
    const moved = send(state, {
      type: "PLACE_IN_BED",
      role: "ward",
      admissionId: stay.id,
      actingUnitId: UNIT,
      bedNumber: occupiedLocked + 1,
    } as WardFlowEvent);
    const unit = moved.units.find((row) => row.id === UNIT)!;
    const confirmed = send(moved, {
      type: "CONFIRM_CAPACITY",
      role: "ward",
      unitId: UNIT,
      actingUnitId: UNIT,
      value: unit.allocatable.value,
      expectedRevision: unit.allocatable.revision ?? 0,
    } as WardFlowEvent);
    const refused = wardFlowReducer(confirmed, {
      type: "UNDO_PLACE_IN_BED",
      role: "ward",
      now: NOW,
      admissionId: stay.id,
      actingUnitId: UNIT,
    });
    expect(refused.rejections.length).toBe(confirmed.rejections.length + 1);
    expect(refused.admissions === confirmed.admissions).toBe(true);
    expect(refused.units === confirmed.units).toBe(true);
  });

  // Codex P2 (PR #423): CONFIRM_CAPACITY may set the aggregate below the separately recorded
  // free-locked count. A same-kind move changes neither figure, so that mismatch must not block it.
  it.each(["open", "locked"] as const)("allows a %s-to-same-kind move after a lower capacity confirmation", (kind) => {
    const { state, unit, current, occupiedLocked } = bench();
    const confirmed = send(state, {
      type: "CONFIRM_CAPACITY",
      role: "ward",
      unitId: UNIT,
      actingUnitId: UNIT,
      value: 0,
      expectedRevision: unit.allocatable.revision ?? 0,
    } as WardFlowEvent);
    const lowered = confirmed.units.find((row) => row.id === UNIT)!;
    expect(lowered.allocatableLocked).toBeGreaterThan(lowered.allocatable.value);
    const stay = current.find((row) => row.bedKind === kind && row.state === "occupied")!;
    const target = kind === "locked" ? occupiedLocked + 1 : Math.max(...current.map((row) => row.bedNumber!)) + 1;
    const moved = send(confirmed, {
      type: "PLACE_IN_BED",
      role: "ward",
      admissionId: stay.id,
      actingUnitId: UNIT,
      bedNumber: target,
    } as WardFlowEvent);
    expect(moved.admissions.find((row) => row.id === stay.id)).toMatchObject({ bedNumber: target, bedKind: kind });
    expect(moved.units === confirmed.units).toBe(true);
  });

  // Owner ruling (PR #423, 19 Oct 2026): lockedDelta = prior locked − target locked, so open→locked
  // (−1) lowers the free-locked count and is never refused for it already exceeding the confirmed
  // total; locked→open (+1) raises it and stays bounded.
  it("allows an open-to-locked move that lowers free-locked past a lower confirmed total, still bounds locked-to-open", () => {
    const { state, unit, current, occupiedLocked } = bench();
    expect(unit.allocatableLocked).toBeGreaterThanOrEqual(2);
    const confirmed = send(state, {
      type: "CONFIRM_CAPACITY",
      role: "ward",
      unitId: UNIT,
      actingUnitId: UNIT,
      value: 0,
      expectedRevision: unit.allocatable.revision ?? 0,
    } as WardFlowEvent);
    const lowered = confirmed.units.find((row) => row.id === UNIT)!;
    expect(lowered.allocatableLocked - 1).toBeGreaterThan(lowered.allocatable.value);
    const open = current.find((row) => row.bedKind === "open" && row.state === "occupied")!;
    const moved = send(confirmed, {
      type: "PLACE_IN_BED",
      role: "ward",
      admissionId: open.id,
      actingUnitId: UNIT,
      bedNumber: occupiedLocked + 1,
    } as WardFlowEvent);
    expect(moved.admissions.find((row) => row.id === open.id)).toMatchObject({ bedKind: "locked" });
    expect(moved.units.find((row) => row.id === UNIT)?.allocatableLocked).toBe(lowered.allocatableLocked - 1);
    const locked = current.find((row) => row.bedKind === "locked" && row.state === "occupied")!;
    const refused = wardFlowReducer(confirmed, {
      type: "PLACE_IN_BED",
      role: "ward",
      now: NOW,
      admissionId: locked.id,
      actingUnitId: UNIT,
      bedNumber: Math.max(...current.map((row) => row.bedNumber!)) + 1,
    });
    expect(refused.rejections.at(-1)?.reason).toBe("The ward's free bed-kind counts do not support this bed move.");
    expect(refused.units === confirmed.units).toBe(true);
  });

  // Codex P2 (PR #423): a same-kind move's Undo leaves capacity untouched, so a later resource
  // update (here CONFIRM_CAPACITY) must not refuse it.
  it.each(["open", "locked"] as const)(
    "lets a %s-to-same-kind move be undone after a later capacity confirmation",
    (kind) => {
      const { state, current, occupiedLocked } = bench();
      const stay = current.find((row) => row.bedKind === kind && row.state === "occupied")!;
      const target = kind === "locked" ? occupiedLocked + 1 : Math.max(...current.map((row) => row.bedNumber!)) + 1;
      const moved = send(state, {
        type: "PLACE_IN_BED",
        role: "ward",
        admissionId: stay.id,
        actingUnitId: UNIT,
        bedNumber: target,
      } as WardFlowEvent);
      const unit = moved.units.find((row) => row.id === UNIT)!;
      const confirmed = send(moved, {
        type: "CONFIRM_CAPACITY",
        role: "ward",
        unitId: UNIT,
        actingUnitId: UNIT,
        value: Math.max(0, unit.allocatable.value - 1),
        expectedRevision: unit.allocatable.revision ?? 0,
      } as WardFlowEvent);
      const stored = JSON.parse(JSON.stringify({ ...confirmed, rejections: [] })) as WardFlowState;
      expect(isValidStoredWardFlowState(stored)).toBe(true);
      const undone = send(stored, {
        type: "UNDO_PLACE_IN_BED",
        role: "ward",
        admissionId: stay.id,
        actingUnitId: UNIT,
      } as WardFlowEvent);
      expect(isDeepStrictEqual(undone.admissions, state.admissions)).toBe(true);
      // The later confirmation survives: Undo neither rewrites nor re-revisions the ward row.
      expect(undone.units).toEqual(stored.units);
      expect(undone.undoRecords?.some((row) => row.kind === "bed-placement" && row.admissionId === stay.id)).toBe(
        false,
      );
    },
  );

  it("preserves an unknown historical kind on Undo of a single-kind seeded stay", () => {
    const state = seedWardFlowStateAt(0);
    const stay = state.admissions.find((row) => row.unitId === "scgh-adult-open" && row.state === "occupied")!;
    expect(stay.bedKind).toBeUndefined();
    const moved = send(state, {
      type: "PLACE_IN_BED",
      role: "ward",
      admissionId: stay.id,
      actingUnitId: stay.unitId,
      bedNumber: 4,
    } as WardFlowEvent);
    expect(moved.admissions.find((row) => row.id === stay.id)?.bedKind).toBe("open");
    const stored = JSON.parse(JSON.stringify({ ...moved, rejections: [] })) as WardFlowState;
    expect(isValidStoredWardFlowState(stored)).toBe(true);
    const undone = send(stored, {
      type: "UNDO_PLACE_IN_BED",
      role: "ward",
      admissionId: stay.id,
      actingUnitId: stay.unitId,
    } as WardFlowEvent);
    expect(
      isDeepStrictEqual(
        undone.admissions.find((row) => row.id === stay.id),
        stay,
      ),
    ).toBe(true);
    const record = stored.undoRecords!.find((row) => row.kind === "bed-placement")!;
    Object.assign(record, {
      bedKindChange: { before: null, after: "locked", lockedBefore: -1, lockedAfter: 1, capacityRevision: 0 },
    });
    expect(isValidStoredWardFlowState(stored)).toBe(false);
  });

  it("refuses a mixed-ward move when neither the original kind nor numbered bed was recorded", () => {
    const { state, current, occupiedLocked } = bench();
    const stay = current.find((row) => row.state === "occupied")!;
    delete stay.bedKind;
    delete stay.bedNumber;
    const refused = wardFlowReducer(state, {
      type: "PLACE_IN_BED",
      role: "ward",
      now: NOW,
      admissionId: stay.id,
      actingUnitId: UNIT,
      bedNumber: occupiedLocked + 1,
    });
    expect(refused.rejections.at(-1)?.reason).toMatch(/no recorded current bed or bed kind/);
    expect(refused.admissions === state.admissions).toBe(true);
    expect(refused.units === state.units).toBe(true);
  });

  it("uses a recorded old bed to change kinds without inventing the historical kind", () => {
    const { state, current, occupiedLocked } = bench();
    const stay = current.find((row) => row.bedKind === "open" && row.state === "occupied")!;
    delete stay.bedKind;
    const moved = send(state, {
      type: "PLACE_IN_BED",
      role: "ward",
      admissionId: stay.id,
      actingUnitId: UNIT,
      bedNumber: occupiedLocked + 1,
    } as WardFlowEvent);
    expect(moved.admissions.find((row) => row.id === stay.id)?.bedKind).toBe("locked");
    const undone = send(moved, {
      type: "UNDO_PLACE_IN_BED",
      role: "ward",
      admissionId: stay.id,
      actingUnitId: UNIT,
    } as WardFlowEvent);
    expect(isDeepStrictEqual(undone.admissions, state.admissions)).toBe(true);
  });

  it("supports an unnumbered stay whose kind was recorded and restores the absent number on Undo", () => {
    const { state, current, occupiedLocked } = bench();
    const stay = current.find((row) => row.bedKind === "open" && row.state === "occupied")!;
    delete stay.bedNumber;
    const moved = send(state, {
      type: "PLACE_IN_BED",
      role: "ward",
      admissionId: stay.id,
      actingUnitId: UNIT,
      bedNumber: occupiedLocked + 1,
    } as WardFlowEvent);
    const undone = send(moved, {
      type: "UNDO_PLACE_IN_BED",
      role: "ward",
      admissionId: stay.id,
      actingUnitId: UNIT,
    } as WardFlowEvent);
    expect(isDeepStrictEqual(undone.admissions, state.admissions)).toBe(true);
  });

  it("pulls the kind of the numbered reservation instead of the Open request preference", () => {
    const { state, unit, current, occupiedLocked } = bench();
    const source = state.movements.find((row) => row.security === "Open" && row.cohort === unit.cohort)!;
    const movement = {
      ...source,
      id: "WF-KIND-INTEGRITY" as const,
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
      specialling: false,
      overrides: [],
      gender: "Male" as const,
      sex: "Male" as const,
      legalStatus: "Voluntary" as const,
    };
    const ready = { ...state, movements: [movement], admissions: current };
    const accepted = send(ready, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      movementId: movement.id,
      actingUnitId: UNIT,
      unitId: UNIT,
      bedNumber: occupiedLocked + 1,
    } as WardFlowEvent);
    const pulled = send(accepted, {
      type: "PULL_PATIENT",
      role: "ward",
      movementId: movement.id,
      actingUnitId: UNIT,
      unitId: UNIT,
    } as WardFlowEvent);
    expect(pulled.admissions.at(-1)?.bedKind).toBe("locked");
    expect(pulled.units.find((row) => row.id === UNIT)?.allocatableLocked).toBe(unit.allocatableLocked - 1);
    const arrived = send(pulled, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      movementId: movement.id,
      actingUnitId: UNIT,
    } as WardFlowEvent);
    expect(arrived.admissions.at(-1)).toMatchObject({
      bedKind: "locked",
      bedNumber: occupiedLocked + 1,
      state: "occupied",
    });
  });

  it("uses the accepted referral's numbered reservation when the ED movement has no separate bed number", () => {
    const { state, unit, occupiedLocked } = bench();
    const heldBed = occupiedLocked + 1;
    let next = send(state, {
      type: "RECEIVE_REFERRAL",
      role: "community",
      ageBand: "Adult",
      source: "community",
      urgency: 2,
      originSiteCode: "RPH",
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      history: "",
      transportNeeded: false,
      destinations: [
        {
          kind: "psychiatric_ward",
          unitId: UNIT,
          sex: "Male",
          gender: "Male",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        { kind: "emergency_department", edId: "rph-ed", purpose: "psychiatric_review" },
      ],
    } as WardFlowEvent);
    const referralId = next.referrals.at(-1)!.id;
    next = send(next, {
      type: "ACCEPT_REFERRAL",
      role: "ward",
      referralId,
      destinationKind: "psychiatric_ward",
      unitId: UNIT,
      actingUnitId: UNIT,
      bedNumber: heldBed,
    } as WardFlowEvent);
    next = send(next, {
      type: "RAISE_REFERRAL",
      role: "ed",
      edId: "rph-ed",
      referralId,
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Male",
        gender: "Male",
        legalStatus: "Voluntary",
        specialling: false,
        highAcuity: false,
        urgency: 2,
        legalFormCode: null,
      },
    } as WardFlowEvent);
    const movementId = next.movements.at(-1)!.id;
    next = send(next, { type: "REFER_TO_UNITS", role: "coordinator", movementId, unitIds: [UNIT] } as WardFlowEvent);
    next = send(next, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      movementId,
      unitId: UNIT,
      actingUnitId: UNIT,
    } as WardFlowEvent);
    expect(next.movements.at(-1)?.heldBedNumber).toBeUndefined();
    next = send(next, {
      type: "PULL_PATIENT",
      role: "ward",
      movementId,
      unitId: UNIT,
      actingUnitId: UNIT,
    } as WardFlowEvent);
    expect(next.admissions.at(-1)?.bedKind).toBe("locked");
    expect(next.units.find((row) => row.id === UNIT)?.allocatableLocked).toBe(unit.allocatableLocked - 1);
    next = send(next, { type: "RECORD_TRANSPORT_NEED", role: "coordinator", movementId, needed: false } as WardFlowEvent);
    next = send(next, { type: "PATIENT_ARRIVED", role: "ward", movementId, actingUnitId: UNIT } as WardFlowEvent);
    expect(next.admissions.at(-1)).toMatchObject({ bedKind: "locked", bedNumber: heldBed, state: "occupied" });
  });
});
