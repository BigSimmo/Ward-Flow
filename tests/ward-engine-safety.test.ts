/**
 * Engine safety: replay seeded random event sequences through `wardFlowReducer` and check, after
 * every single event, that the bed picture is still physically possible.
 *
 * The example-based reducer tests prove that each event does the right thing from a hand-built
 * state. These prove something they cannot: that NO ordering of events, including refused ones,
 * leaves a bed count below zero, two people in one bed, one person in two beds, a ward fuller than
 * its beds, or a world the browser copy would refuse to reload.
 *
 * Reproducible: each sequence is one integer seed (`tests/helpers/ward-engine-fuzz.ts`). A failure
 * is shrunk to the shortest event list that still breaks the same rule, and the message prints
 * that list, so it can be pasted straight into a regression test.
 *
 * Bounded for the unit shards by default. For a longer soak run locally:
 *   WARD_ENGINE_FUZZ_SEQUENCES=500 WARD_ENGINE_FUZZ_STEPS=300 npx vitest run tests/ward-engine-safety.test.ts
 * and WARD_ENGINE_FUZZ_FIRST_SEED moves the window of seeds.
 */
import { describe, expect, it } from "vitest";

import { ADMISSION_STATES } from "@/components/ward-management/ward-admissions";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { MOVEMENT_STAGES, REFERRAL_ADDRESSING_STATES } from "@/components/ward-management/ward-model";
import { WARD_SCENARIOS, type WardScenario } from "@/components/ward-management/ward-scenarios";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { FUZZED_EVENT_TYPES, nextEvent, seededRandom } from "./helpers/ward-engine-fuzz";

const envCount = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
};
const SEQUENCES = envCount("WARD_ENGINE_FUZZ_SEQUENCES", 24);
const STEPS = envCount("WARD_ENGINE_FUZZ_STEPS", 120);
const FIRST_SEED = envCount("WARD_ENGINE_FUZZ_FIRST_SEED", 1);

/** A person is in a bed while their stay is pulled (the bed is theirs) or occupied. */
const IN_A_BED = new Set(["pulled", "occupied"]);

type Violation = { rule: string; detail: string };

/** Every rule a reachable world must keep. Returns the first one broken, or null. */
function bedInvariantViolation(state: WardFlowState): Violation | null {
  for (const unit of state.units) {
    const counts: Record<string, number> = {
      "empty beds": unit.empty.value,
      "allocatable beds": unit.allocatable.value,
      "allocatable locked beds": unit.allocatableLocked,
      "held beds": unit.held,
      "blocked beds": unit.blocked,
      "female mix": unit.sexMix.Female,
      "male mix": unit.sexMix.Male,
    };
    for (const [label, value] of Object.entries(counts)) {
      if (!Number.isSafeInteger(value) || value < 0)
        return { rule: "bed counts never go negative", detail: `${unit.id} ${label} is ${value}` };
    }
    if (unit.empty.value > unit.beds || unit.allocatable.value > unit.beds)
      return {
        rule: "a ward never has more free beds than beds",
        detail: `${unit.id} has ${unit.beds} beds, ${unit.empty.value} empty, ${unit.allocatable.value} allocatable`,
      };
    const occupied = state.admissions.filter(
      (admission) => admission.unitId === unit.id && admission.state === "occupied",
    ).length;
    // An arrival the ward's own empty count disagreed with is recorded, not refused (it really
    // happened), so each recorded conflict explains one person above the bed count.
    if (occupied > unit.beds + (unit.arrivalCapacityConflicts?.length ?? 0))
      return {
        rule: "a ward never holds more people than beds",
        detail: `${unit.id} has ${unit.beds} beds and ${occupied} occupied stays`,
      };
  }

  const beds = new Map<string, string>();
  const people = new Map<string, string>();
  for (const admission of state.admissions) {
    if (!ADMISSION_STATES.includes(admission.state))
      return { rule: "every stay has a known state", detail: `${admission.id} is ${String(admission.state)}` };
    if (!IN_A_BED.has(admission.state)) continue;
    if (admission.bedNumber !== undefined) {
      const bed = `${admission.unitId} bed ${admission.bedNumber}`;
      const other = beds.get(bed);
      if (other) return { rule: "no bed holds two people", detail: `${bed} holds ${other} and ${admission.id}` };
      beds.set(bed, admission.id);
    }
    if (admission.patientId) {
      const other = people.get(admission.patientId);
      if (other)
        return {
          rule: "no person is in two beds",
          detail: `${admission.patientId} is in ${other} and ${admission.id}`,
        };
      people.set(admission.patientId, admission.id);
    }
  }

  const stays = new Map<string, string>();
  for (const movement of state.movements) {
    if (!MOVEMENT_STAGES.includes(movement.stage))
      return { rule: "every movement has a known stage", detail: `${movement.id} is ${String(movement.stage)}` };
    if (movement.closure || movement.stage === "arrived") continue;
    if (movement.admissionId) {
      const other = stays.get(movement.admissionId);
      if (other)
        return {
          rule: "no stay is claimed by two open movements",
          detail: `${movement.admissionId} is claimed by ${other} and ${movement.id}`,
        };
      stays.set(movement.admissionId, movement.id);
    }
  }

  // A bed held for somebody on their way (an open movement accepted into it, or an accepted
  // referral arm) is held for one person only, and nobody else is already lying in it.
  const holds = new Map<string, string>();
  const hold = (bed: string, holder: string, owns: (admissionId: string) => boolean): Violation | null => {
    const other = holds.get(bed);
    if (other && other !== holder) return { rule: "no bed holds two people", detail: `${bed} is held for ${other} and ${holder}` };
    holds.set(bed, holder);
    const occupant = beds.get(bed);
    if (occupant && !owns(occupant))
      return { rule: "no bed holds two people", detail: `${bed} is held for ${holder} and occupied by ${occupant}` };
    return null;
  };
  const admissionById = new Map(state.admissions.map((admission) => [admission.id, admission]));
  for (const movement of state.movements) {
    if (movement.closure || movement.heldBedNumber === undefined || !movement.acceptedUnitId) continue;
    const broken = hold(
      `${movement.acceptedUnitId} bed ${movement.heldBedNumber}`,
      movement.id,
      (admissionId) => admissionById.get(admissionId)?.movementId === movement.id,
    );
    if (broken) return broken;
  }
  for (const referral of state.referrals) {
    for (const arm of referral.destinations) {
      if (!REFERRAL_ADDRESSING_STATES.includes(arm.state))
        return { rule: "every referral has a known state", detail: `${referral.id} has an arm ${String(arm.state)}` };
      if (arm.state !== "accepted" || arm.heldBedNumber === undefined || arm.destination.kind !== "psychiatric_ward")
        continue;
      const unitId = arm.acceptedUnitId ?? arm.destination.unitId;
      // The engine stops holding the bed once the patient has arrived on that ward.
      const arrived = state.movements.some(
        (movement) =>
          movement.referralId === referral.id && movement.stage === "arrived" && movement.acceptedUnitId === unitId,
      );
      if (!unitId || arrived) continue;
      const broken = hold(
        `${unitId} bed ${arm.heldBedNumber}`,
        referral.id,
        (admissionId) => admissionById.get(admissionId)?.referralId === referral.id,
      );
      if (broken) return broken;
    }
  }

  return null;
}

/** What the browser copy writes (refusals are never saved, D-18) must load back. */
function storageViolation(state: WardFlowState): Violation | null {
  return isValidStoredWardFlowState(JSON.parse(JSON.stringify({ ...state, rejections: [] })))
    ? null
    : { rule: "every world saves and reloads", detail: "the storage check refuses the saved copy" };
}

/**
 * Freezes every object the reducer has not handed back before, so an in-place write to an earlier
 * state throws instead of passing silently. A frozen object's contents were frozen with it, so
 * each step only walks what is new.
 */
function deepFreeze(value: unknown): void {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
}

/** Bed-side records a refused event must leave exactly as they were. */
const BED_RECORDS = ["units", "admissions", "bedReleases", "leaveBeds", "plannedAdmissions"] as const;
/** The storage check walks the whole world, so the run checks it every few events and at the end. */
const STORAGE_EVERY = 10;

type StepFailure = Violation & { step: number };

function applyAndCheck(
  state: WardFlowState,
  event: WardFlowEvent,
  checkStorage: boolean,
): Violation | { next: WardFlowState } {
  deepFreeze(state);
  let next: WardFlowState;
  try {
    next = wardFlowReducer(state, event);
  } catch (error) {
    const mutated = error instanceof TypeError && /read.only|not extensible|frozen/i.test(error.message);
    return mutated
      ? { rule: "the engine never changes the state it was given", detail: `${event.type}: ${error.message}` }
      : { rule: "the engine never throws", detail: `${event.type} threw ${String(error)}` };
  }
  if (next.rejections.length > state.rejections.length) {
    for (const key of BED_RECORDS) {
      if (next[key] !== state[key] && JSON.stringify(next[key]) !== JSON.stringify(state[key]))
        return { rule: "a refused event changes no bed", detail: `refused ${event.type} changed ${key}` };
    }
  }
  return bedInvariantViolation(next) ?? (checkStorage ? storageViolation(next) : null) ?? { next };
}

/** Applies events in order from a fresh seed, checking every rule after every event. */
function replay(scenario: WardScenario, events: readonly WardFlowEvent[]): StepFailure | null {
  let state = seedWardFlowState(scenario);
  for (const [step, event] of events.entries()) {
    const result = applyAndCheck(state, event, true);
    if ("rule" in result) return { ...result, step };
    state = result.next;
  }
  return null;
}

/** Drops events, largest chunks first, while the same rule still breaks. */
function shrink(scenario: WardScenario, events: WardFlowEvent[], rule: string): WardFlowEvent[] {
  let current = events;
  for (let size = Math.ceil(current.length / 2); size >= 1; size = Math.floor(size / 2)) {
    for (let start = 0; start < current.length; ) {
      const candidate = [...current.slice(0, start), ...current.slice(start + size)];
      const failure = replay(scenario, candidate);
      if (failure?.rule === rule) current = candidate.slice(0, failure.step + 1);
      else start += size;
    }
  }
  return current;
}

function describeFailure(seed: number, scenario: WardScenario, events: WardFlowEvent[]) {
  // Replay with every rule after every event, so the failure names its exact step.
  const failure = replay(scenario, events);
  if (!failure) return `Seed ${seed}, scenario "${scenario}": failed in the run but not on replay`;
  const minimal = shrink(scenario, events.slice(0, failure.step + 1), failure.rule);
  const last = replay(scenario, minimal);
  return [
    `Rule broken: ${failure.rule}`,
    `Seed ${seed}, scenario "${scenario}", event ${failure.step + 1}: ${failure.detail}`,
    `Shortest sequence that still breaks it (${minimal.length} events): ${last?.detail ?? ""}`,
    JSON.stringify(minimal, null, 2),
  ].join("\n");
}

/** One seeded sequence. Returns a readable failure, or null, and how many events were refused. */
export function runSeed(seed: number, steps = STEPS) {
  const scenario = WARD_SCENARIOS[seed % WARD_SCENARIOS.length];
  const random = seededRandom(seed);
  let state = seedWardFlowState(scenario);
  const events: WardFlowEvent[] = [];
  let refused = 0;
  for (let step = 0; step < steps; step += 1) {
    const event = nextEvent(state, random, step);
    events.push(event);
    const result = applyAndCheck(state, event, (step + 1) % STORAGE_EVERY === 0 || step === steps - 1);
    if ("rule" in result) return { failure: describeFailure(seed, scenario, events), refused };
    if (result.next.rejections.length > state.rejections.length) refused += 1;
    state = result.next;
  }
  return { failure: null, refused };
}

describe("sequences the random run found", () => {
  it("drops a Bed board placement's undo when releasing the pull removes that stay", () => {
    // Refer, accept, pull, place in a bed, release the pull: the pulled stay is removed, but its
    // bed-placement undo record used to stay behind, so the saved day was refused on reload.
    const base = seedWardFlowState();
    let state: WardFlowState = {
      ...base,
      movements: base.movements.map((movement) =>
        movement.id === "WF-009" ? { ...movement, gender: "Male" as const } : movement,
      ),
    };
    const unitId = "rph-adult-secure";
    const send = (event: Record<string, unknown>) => {
      state = wardFlowReducer(state, { now: NOW_ANCHOR, ...event } as unknown as WardFlowEvent);
    };
    send({ type: "REFER_TO_UNITS", role: "coordinator", movementId: "WF-009", unitIds: [unitId] });
    send({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId: "WF-009", unitId, actingUnitId: unitId });
    send({
      type: "PULL_PATIENT",
      role: "ward",
      movementId: "WF-009",
      unitId,
      actingUnitId: unitId,
      numConsulted: true,
    });
    const admissionId = state.movements.find((movement) => movement.id === "WF-009")?.admissionId;
    expect(admissionId).toBeDefined();
    send({ type: "PLACE_IN_BED", role: "ward", admissionId, bedNumber: 2, actingUnitId: unitId });
    expect(state.undoRecords?.some((record) => record.kind === "bed-placement")).toBe(true);
    send({
      type: "RELEASE_PULL",
      role: "ward",
      movementId: "WF-009",
      reason: "patient_no_longer_coming",
      actingUnitId: unitId,
    });

    expect(state.rejections).toEqual([]);
    expect(state.admissions.some((admission) => admission.id === admissionId)).toBe(false);
    expect(state.undoRecords?.some((record) => record.kind === "bed-placement")).toBe(false);
    expect(storageViolation(state)).toBeNull();
  });
});

describe("engine safety under random event sequences", () => {
  it("starts every scenario from a world that already keeps the rules", () => {
    for (const scenario of WARD_SCENARIOS) {
      const seed = seedWardFlowState(scenario);
      expect(bedInvariantViolation(seed) ?? storageViolation(seed), scenario).toBeNull();
    }
  });

  it(`keeps beds whole across ${SEQUENCES} seeded sequences of ${STEPS} events`, () => {
    let refused = 0;
    for (let seed = FIRST_SEED; seed < FIRST_SEED + SEQUENCES; seed += 1) {
      const result = runSeed(seed);
      expect(result.failure, `seed ${seed}`).toBeNull();
      refused += result.refused;
    }
    // The generator must reach both sides: enough events succeed to move patients and beds, and
    // enough are refused to prove refusals are safe too.
    const total = SEQUENCES * STEPS;
    expect(refused).toBeGreaterThan(total * 0.1);
    expect(refused).toBeLessThan(total * 0.9);
    expect(FUZZED_EVENT_TYPES.size).toBeGreaterThan(50);
  });
});
