// Make room plans (`make-room-chains`, mockup stage): a waiting referral whose ward is full is
// offered a chain of step downs, at most three moves, inside one health service, using only stays
// already marked for step down, each move checked by the main eligibility gates.

import { describe, expect, it } from "vitest";

import { makeRoomPreview } from "../src/components/ward-management/capacity/make-room-preview";
import { eligibility, mixSexOf } from "../src/components/ward-management/ward-eligibility";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { deriveMakeRoomChains, MAKE_ROOM_MAX_MOVES } from "../src/components/ward-management/ward-make-room";
import type { BedRelease, Movement } from "../src/components/ward-management/ward-model";
import { boundedBedAvailability } from "../src/components/ward-management/ward-ready-beds";
import { NOW_ANCHOR, siteByCode } from "../src/components/ward-management/ward-sites";

function chainsFor(
  admissions = seedWardFlowState().admissions,
  units = seedWardFlowState().units,
  extra: { movements?: Movement[]; bedReleases?: BedRelease[] } = {},
) {
  const state = seedWardFlowState();
  return deriveMakeRoomChains({
    admissions,
    units,
    movements: extra.movements ?? state.movements,
    patients: state.patients,
    referrals: state.referrals,
    bedReleases: extra.bedReleases,
    now: NOW_ANCHOR,
  });
}

function previewChains() {
  const preview = makeRoomPreview(seedWardFlowState());
  return { preview, chains: chainsFor(preview.admissions, preview.units) };
}

describe("make room plans", () => {
  it("offers nothing when no patient is marked for step down", () => {
    expect(chainsFor()).toEqual([]);
  });

  it("finds a two move and a three move plan in the preview data", () => {
    const preview = makeRoomPreview(seedWardFlowState());
    const chains = chainsFor(preview.admissions, preview.units);
    const lengths = chains.map((chain) => chain.stepDowns.length + 1).sort();
    expect(lengths).toEqual([2, 3]);
  });

  it("keeps every move checked, ordered and inside one health service", () => {
    const preview = makeRoomPreview(seedWardFlowState());
    const chains = chainsFor(preview.admissions, preview.units);
    const used = new Set<string>();
    for (const chain of chains) {
      expect(chain.stepDowns.length + 1).toBeLessThanOrEqual(MAKE_ROOM_MAX_MOVES);
      const service = siteByCode(chain.targetUnit.siteCode)?.service;
      // The first move goes into a Ready bed that passes every gate.
      const first = chain.stepDowns[0]!;
      expect(boundedBedAvailability(first.toUnit).available).toBeGreaterThan(0);
      // Each later move goes into the ward the move before it left.
      chain.stepDowns.forEach((step, index) => {
        expect(step.admission.stepDownCandidate).toBe(true);
        expect(used.has(step.admission.id)).toBe(false);
        used.add(step.admission.id);
        expect(siteByCode(step.toUnit.siteCode)?.service).toBe(service);
        if (index > 0) expect(step.toUnit.id).toBe(chain.stepDowns[index - 1]!.fromUnit.id);
      });
      expect(chain.stepDowns.at(-1)!.fromUnit.id).toBe(chain.targetUnit.id);
      // The waiting referral fits its ward on every check except a free bed.
      const failing = eligibility(chain.movement, chain.targetUnit, NOW_ANCHOR)
        .gates.filter((gate) => !gate.pass)
        .map((gate) => gate.gate);
      expect(failing.every((gate) => gate === "allocatable_bed" || gate === "sex_mix")).toBe(true);
    }
  });

  it("never promises one Ready bed to two plans", () => {
    // Stress the preview: every stay on a full ward is a step down candidate and every ward with
    // room has exactly one Ready bed, so plans compete for the same beds.
    const preview = makeRoomPreview(seedWardFlowState());
    const fullWards = new Set(
      preview.units.filter((unit) => boundedBedAvailability(unit).available === 0).map((unit) => unit.id),
    );
    const admissions = preview.admissions.map((admission) =>
      fullWards.has(admission.unitId) && admission.state === "occupied"
        ? { ...admission, stepDownCandidate: true }
        : admission,
    );
    const units = preview.units.map((unit) =>
      fullWards.has(unit.id)
        ? unit
        : { ...unit, allocatable: { ...unit.allocatable, value: 1 }, empty: { ...unit.empty, value: 1 } },
    );
    const chains = chainsFor(admissions, units);
    expect(chains.length).toBeGreaterThan(0);
    const promised = new Map<string, number>();
    for (const chain of chains) {
      const ward = chain.stepDowns[0]!.toUnit;
      promised.set(ward.id, (promised.get(ward.id) ?? 0) + 1);
      expect(promised.get(ward.id)).toBeLessThanOrEqual(boundedBedAvailability(ward).available);
    }
  });

  it("offers no plan when the patient coming in would still fail the sex mix check", () => {
    // A full ward with no occupant of the waiting patient's sex. Freeing one bed leaves one free bed
    // and no same-sex company, which the normal sex mix check refuses, so no plan may be offered.
    const preview = makeRoomPreview(seedWardFlowState());
    const [chain] = chainsFor(preview.admissions, preview.units).filter((each) => each.stepDowns.length === 1);
    expect(chain).toBeDefined();
    const sex = mixSexOf(chain!.movement.gender, chain!.movement.sex)!;
    const other = sex === "Female" ? "Male" : "Female";
    const total = chain!.targetUnit.sexMix.Female + chain!.targetUnit.sexMix.Male;
    const units = preview.units.map((unit) =>
      unit.id === chain!.targetUnit.id ? { ...unit, sexMix: { ...unit.sexMix, [sex]: 0, [other]: total } } : unit,
    );
    const after = chainsFor(preview.admissions, units);
    expect(after.some((each) => each.movement.id === chain!.movement.id)).toBe(false);
  });

  it("checks the waiting patient against the ward as it will be once the bed is free", () => {
    const preview = makeRoomPreview(seedWardFlowState());
    for (const chain of chainsFor(preview.admissions, preview.units)) {
      expect(chain.checks.every((gate) => gate.pass)).toBe(true);
      for (const step of chain.stepDowns) expect(step.checks.every((gate) => gate.pass)).toBe(true);
    }
  });

  it("checks every first move against the ward as earlier plans leave it", () => {
    // Stress the preview as above, but with two Ready beds and no occupants on every ward with room,
    // so later plans would put a patient alone into a bed an earlier plan has half used.
    const preview = makeRoomPreview(seedWardFlowState());
    const fullWards = new Set(
      preview.units.filter((unit) => boundedBedAvailability(unit).available === 0).map((unit) => unit.id),
    );
    const admissions = preview.admissions.map((admission) =>
      fullWards.has(admission.unitId) && admission.state === "occupied"
        ? { ...admission, stepDownCandidate: true }
        : admission,
    );
    const units = preview.units.map((unit) =>
      fullWards.has(unit.id)
        ? unit
        : {
            ...unit,
            // Undo the preview's women only ward, so men and women compete for the same beds.
            sexDesignation: seedWardFlowState().units.find((seed) => seed.id === unit.id)!.sexDesignation,
            allocatable: { ...unit.allocatable, value: 2 },
            empty: { ...unit.empty, value: 2 },
            sexMix: { Female: 0, Male: 0 },
          },
    );
    const chains = chainsFor(admissions, units);
    expect(chains.length).toBeGreaterThan(1);
    // Replay the plans in order, keeping each Ready ward's beds and sex mix up to date.
    const ward = new Map(units.map((unit) => [unit.id, unit]));
    for (const chain of chains) {
      const first = chain.stepDowns[0]!;
      const into = ward.get(first.toUnit.id)!;
      const sex = mixSexOf(first.admission.gender, first.admission.sex)!;
      const sameSex = into.sexMix[sex] ?? 0;
      const free = boundedBedAvailability(into).available;
      expect(free).toBeGreaterThan(0);
      // The sex mix rule: same-sex company already there, or more than one free bed.
      expect(sameSex > 0 || free > 1).toBe(true);
      ward.set(into.id, {
        ...into,
        allocatable: { ...into.allocatable, value: into.allocatable.value - 1 },
        empty: { ...into.empty, value: into.empty.value - 1 },
        sexMix: { ...into.sexMix, [sex]: sameSex + 1 },
      });
    }
  });

  it("never routes a plan through a closed ward", () => {
    const { preview, chains } = previewChains();
    const used = new Set(chains.flatMap((chain) => [chain.targetUnit.id, ...chain.stepDowns.map((s) => s.toUnit.id)]));
    const units = preview.units.map((unit) => (used.has(unit.id) ? { ...unit, isClosed: true } : unit));
    for (const chain of chainsFor(preview.admissions, units)) {
      for (const ward of [chain.targetUnit, ...chain.stepDowns.map((step) => step.toUnit)]) {
        expect(used.has(ward.id)).toBe(false);
      }
    }
  });

  it("never starts a plan in a bed still being made ready", () => {
    const { preview, chains } = previewChains();
    const first = chains[0]!.stepDowns[0]!.toUnit;
    const releases = Array.from(
      { length: boundedBedAvailability(first).available },
      (_, index) =>
        ({ id: `prep-${index}`, unitId: first.id, state: "discharged", preparing: true }) as unknown as BedRelease,
    );
    const after = chainsFor(preview.admissions, preview.units, { bedReleases: releases });
    expect(after.some((chain) => chain.stepDowns[0]!.toUnit.id === first.id)).toBe(false);
  });

  it("leaves out a patient who is already moving somewhere else", () => {
    const { preview, chains } = previewChains();
    const moving = chains[0]!.stepDowns[0]!.admission;
    const state = seedWardFlowState();
    const movements = [
      ...state.movements,
      { ...state.movements[0]!, id: "already-moving", closure: undefined, sourceAdmissionId: moving.id },
    ] as Movement[];
    const after = chainsFor(preview.admissions, preview.units, { movements });
    expect(after.some((chain) => chain.stepDowns.some((step) => step.admission.id === moving.id))).toBe(false);
  });

  it("offers only the wards a referral already names", () => {
    const { preview, chains } = previewChains();
    const chain = chains[0]!;
    const state = seedWardFlowState();
    const elsewhere = preview.units.find((unit) => unit.id !== chain.targetUnit.id)!;
    const movements = state.movements.map((movement) =>
      movement.id === chain.movement.id ? { ...movement, referredUnitIds: [elsewhere.id] } : movement,
    );
    const after = chainsFor(preview.admissions, preview.units, { movements });
    for (const each of after.filter((plan) => plan.movement.id === chain.movement.id)) {
      expect(each.targetUnit.id).toBe(elsewhere.id);
    }
  });

  it("never counts on a freed bed being secure on a ward with open beds too", () => {
    const { preview, chains } = previewChains();
    const chain = chains.find(
      (plan) => plan.movement.security === "Secure" && plan.targetUnit.lockedBeds >= plan.targetUnit.beds,
    )!;
    expect(chain).toBeDefined();
    // The same ward with one open bed, and no secure bed free: the bed a step down frees may be the open one.
    const units = preview.units.map((unit) =>
      unit.id === chain.targetUnit.id ? { ...unit, lockedBeds: unit.beds - 1, allocatableLocked: 0 } : unit,
    );
    const after = chainsFor(preview.admissions, units);
    expect(
      after.some((plan) => plan.movement.id === chain.movement.id && plan.targetUnit.id === chain.targetUnit.id),
    ).toBe(false);
  });

  it("counts a step down recorded in a secure bed as freeing one", () => {
    const { preview, chains } = previewChains();
    const chain = chains.find(
      (plan) => plan.movement.security === "Secure" && plan.targetUnit.lockedBeds >= plan.targetUnit.beds,
    )!;
    const leaving = chain.stepDowns.at(-1)!.admission;
    const units = preview.units.map((unit) =>
      unit.id === chain.targetUnit.id ? { ...unit, lockedBeds: unit.beds - 1, allocatableLocked: 0 } : unit,
    );
    const admissions = preview.admissions.map((admission) =>
      admission.id === leaving.id ? { ...admission, bedKind: "locked" as const } : admission,
    );
    const after = chainsFor(admissions, units);
    expect(
      after.some((plan) => plan.movement.id === chain.movement.id && plan.targetUnit.id === chain.targetUnit.id),
    ).toBe(true);
  });
});
