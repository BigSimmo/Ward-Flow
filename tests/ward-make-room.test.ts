// Make room plans (`make-room-chains`, mockup stage): a waiting referral whose ward is full is
// offered a chain of step downs, at most three moves, inside one health service, using only stays
// already marked for step down, each move checked by the main eligibility gates.

import { describe, expect, it } from "vitest";
import { GENDER_PLACEMENT_REASONS } from "../src/components/ward-management/ward-change-reasons";

import { makeRoomPreview } from "../src/components/ward-management/capacity/make-room-preview";
import { eligibility, mixSexOf } from "../src/components/ward-management/ward-eligibility";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { deriveMakeRoomChains, MAKE_ROOM_MAX_MOVES } from "../src/components/ward-management/ward-make-room";
import type { BedRelease, Movement } from "../src/components/ward-management/ward-model";
import { boundedBedAvailability } from "../src/components/ward-management/ward-ready-beds";
import { NOW_ANCHOR, siteByCode } from "../src/components/ward-management/ward-sites";
import { stayLegalStatus } from "../src/components/ward-management/ward-stay-legal";

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

/** The seed movements, with one referral asking for a secure bed. */
function secureMovement(id: string): Movement[] {
  return seedWardFlowState().movements.map((movement) =>
    movement.id === id ? { ...movement, security: "Secure" as const } : movement,
  );
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
            // Both free beds secure, so a step down who is not voluntary can take one, as a transfer needs.
            lockedBeds: Math.max(2, unit.lockedBeds),
            allocatableLocked: 2,
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
    const template = seedWardFlowState().bedReleases[0]!;
    const releases: BedRelease[] = Array.from({ length: boundedBedAvailability(first).available }, (_, index) => ({
      ...template,
      id: `prep-${index}`,
      unitId: first.id,
      state: "discharged",
      preparing: true,
    }));
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
    const chain = chains.find((plan) => plan.targetUnit.lockedBeds >= plan.targetUnit.beds)!;
    expect(chain).toBeDefined();
    const movements = secureMovement(chain.movement.id);
    const offered = (plans: ReturnType<typeof chainsFor>) =>
      plans.some((plan) => plan.movement.id === chain.movement.id && plan.targetUnit.id === chain.targetUnit.id);
    // Asking for a secure bed on an all-secure ward still gets the plan.
    expect(offered(chainsFor(preview.admissions, preview.units, { movements }))).toBe(true);
    // The same ward with one open bed and no secure bed free: the bed a step down frees may be the open one.
    const units = preview.units.map((unit) =>
      unit.id === chain.targetUnit.id ? { ...unit, lockedBeds: unit.beds - 1, allocatableLocked: 0 } : unit,
    );
    expect(offered(chainsFor(preview.admissions, units, { movements }))).toBe(false);
    // Unless the stay leaving is recorded in a secure bed.
    const leaving = chain.stepDowns.at(-1)!.admission;
    const admissions = preview.admissions.map((admission) =>
      admission.id === leaving.id ? { ...admission, bedKind: "locked" as const } : admission,
    );
    expect(offered(chainsFor(admissions, units, { movements }))).toBe(true);
  });

  it("only steps a patient who is not voluntary down into a free secure bed, as a transfer does", () => {
    const { preview, chains } = previewChains();
    const first = chains[0]!.stepDowns[0]!;
    // The preview's step downs are voluntary. Mark the first one's stay as having no legal status
    // recorded, which a transfer treats as needing a secure bed, and take every secure bed away.
    const admissions = preview.admissions.map((admission) =>
      admission.id === first.admission.id
        ? { ...admission, movementId: null, patientId: "no-such-patient" as (typeof admission)["patientId"] }
        : admission,
    );
    const units = preview.units.map((unit) => ({ ...unit, allocatableLocked: 0 }));
    const after = chainsFor(admissions, units);
    expect(after.some((plan) => plan.stepDowns.some((step) => step.admission.id === first.admission.id))).toBe(false);
  });

  it("never steps a patient down to a ward with no specialling place left, as a transfer refuses", () => {
    const { preview, chains } = previewChains();
    const first = chains[0]!.stepDowns[0]!;
    const admissions = preview.admissions.map((admission) =>
      admission.id === first.admission.id ? { ...admission, specialling: true } : admission,
    );
    const units = preview.units.map((unit) => ({ ...unit, speciallingCapacity: 0 }));
    const after = chainsFor(admissions, units);
    expect(after.some((plan) => plan.stepDowns.some((step) => step.admission.id === first.admission.id))).toBe(false);
  });

  it("never counts on a stay with no bed kind freeing a secure bed, even on an all-secure ward", () => {
    const { preview, chains } = previewChains();
    const chain = chains.find((plan) => plan.targetUnit.lockedBeds >= plan.targetUnit.beds)!;
    expect(chain).toBeDefined();
    const movements = secureMovement(chain.movement.id);
    const offered = (plans: ReturnType<typeof chainsFor>) =>
      plans.some((plan) => plan.movement.id === chain.movement.id && plan.targetUnit.id === chain.targetUnit.id);
    // No secure bed free: a departure only gives one back when the stay is recorded in one.
    const units = preview.units.map((unit) =>
      unit.id === chain.targetUnit.id ? { ...unit, allocatableLocked: 0 } : unit,
    );
    const leaving = chain.stepDowns.at(-1)!.admission;
    expect(leaving.bedKind).toBeUndefined();
    expect(offered(chainsFor(preview.admissions, units, { movements }))).toBe(false);
    const admissions = preview.admissions.map((admission) =>
      admission.id === leaving.id ? { ...admission, bedKind: "locked" as const } : admission,
    );
    expect(offered(chainsFor(admissions, units, { movements }))).toBe(true);
  });

  it("never counts on a bed a departure gives to an arrival still waiting for one", () => {
    const { preview, chains } = previewChains();
    const target = chains[0]!.targetUnit;
    const units = preview.units.map((unit) =>
      unit.id === target.id
        ? { ...unit, arrivalCapacityConflicts: [{ movementId: "WF-over-capacity", at: NOW_ANCHOR }] }
        : unit,
    );
    expect(chainsFor(preview.admissions, units).some((plan) => plan.targetUnit.id === target.id)).toBe(false);
  });

  it("never offers a waiting referral a ward with no specialling place left, as a pull needs an override", () => {
    const { preview, chains } = previewChains();
    const chain = chains[0]!;
    const movements = seedWardFlowState().movements.map((movement) =>
      movement.id === chain.movement.id ? { ...movement, specialling: true } : movement,
    );
    const units = preview.units.map((unit) =>
      unit.id === chain.targetUnit.id ? { ...unit, speciallingCapacity: 0 } : unit,
    );
    const plans = chainsFor(preview.admissions, units, { movements });
    expect(
      plans.some((plan) => plan.movement.id === chain.movement.id && plan.targetUnit.id === chain.targetUnit.id),
    ).toBe(false);
  });

  it("counts a specialling place promised to an earlier plan's referral as taken", () => {
    const { preview, chains } = previewChains();
    const chain = chains[0]!;
    const target = chain.targetUnit;
    const state = seedWardFlowState();
    const original = state.movements.find((movement) => movement.id === chain.movement.id)!;
    const second = { ...original, id: "WF-second-referral" as Movement["id"], openedAt: original.openedAt + 1 };
    const movements = [
      ...state.movements.map((movement) =>
        movement.id === original.id ? { ...movement, specialling: true } : movement,
      ),
      { ...second, specialling: true },
    ];
    const units = preview.units.map((unit) => (unit.id === target.id ? { ...unit, speciallingCapacity: 1 } : unit));
    // Every stay on the target may step down, and none of them holds a specialling place.
    const admissions = preview.admissions.map((admission) =>
      admission.unitId === target.id ? { ...admission, specialling: false, stepDownCandidate: true } : admission,
    );
    const planned = (wards: typeof units) =>
      chainsFor(admissions, wards, { movements }).some(
        (plan) => plan.movement.id === second.id && plan.targetUnit.id === target.id,
      );
    expect(planned(units)).toBe(false);
    // With a second place, the second referral can be planned there too.
    expect(planned(units.map((unit) => (unit.id === target.id ? { ...unit, speciallingCapacity: 2 } : unit)))).toBe(
      true,
    );
  });

  it("states the preview stays' legal status as recorded, never assumed voluntary", () => {
    const state = seedWardFlowState();
    const preview = makeRoomPreview(state);
    const statuses = Object.fromEntries(
      preview.admissions
        .filter((admission) => admission.stepDownCandidate === true)
        .map((admission) => [
          admission.id,
          stayLegalStatus(admission, {
            movements: state.movements,
            patients: state.patients,
            referrals: state.referrals,
          }),
        ]),
    );
    expect(statuses).toEqual({ "AD-RPHS-11": "Voluntary", "AD-ARMA-01": undefined, "AD-SCGA-05": "Voluntary" });
    // The stay with no legal status recorded steps down into a secure bed, as a transfer would put it.
    const step = chainsFor(preview.admissions, preview.units)
      .flatMap((chain) => chain.stepDowns)
      .find((move) => move.admission.id === "AD-ARMA-01")!;
    expect(step.toUnit.lockedBeds).toBeGreaterThan(0);
  });
});

describe("ward-specific coordinator review before Make room claims passing checks (WF-078)", () => {
  it.each(["Non-binary", undefined] as const)(
    "waits for a placement record covering the target for gender %s",
    (gender) => {
      const { preview, chains } = previewChains();
      const original = chains[1]!;
      const targetId = original.targetUnit.id;
      const units = preview.units.map((unit) =>
        unit.id === targetId
          ? { ...unit, sexDesignation: "Undesignated" as const, sexMix: { Female: 10, Male: 1 } }
          : unit,
      );
      const movements = seedWardFlowState().movements.map((movement) =>
        movement.id === original.movement.id
          ? { ...movement, gender, sex: "Female" as const, referredUnitIds: [targetId], genderPlacements: undefined }
          : movement,
      );
      const contains = (plans: ReturnType<typeof chainsFor>) =>
        plans.some((plan) => plan.movement.id === original.movement.id && plan.targetUnit.id === targetId);
      // Baseline: otherwise identical binary-gender/sex movement is feasible after the vacancy.
      const binary = movements.map((movement) =>
        movement.id === original.movement.id ? { ...movement, gender: "Female" as const } : movement,
      );
      expect(contains(chainsFor(preview.admissions, units, { movements: binary }))).toBe(true);
      expect(contains(chainsFor(preview.admissions, units, { movements }))).toBe(false);
      const reviewed = (unitId: string): Movement[] =>
        movements.map((movement) =>
          movement.id === original.movement.id
            ? {
                ...movement,
                genderPlacements: [
                  {
                    at: NOW_ANCHOR,
                    by: "coordinator",
                    unitIds: [unitId],
                    reason: GENDER_PLACEMENT_REASONS[0],
                    wardChecked: true,
                  },
                ],
              }
            : movement,
        );
      expect(contains(chainsFor(preview.admissions, units, { movements: reviewed("another-ward") }))).toBe(false);
      expect(contains(chainsFor(preview.admissions, units, { movements: reviewed(targetId) }))).toBe(true);
    },
  );
});
