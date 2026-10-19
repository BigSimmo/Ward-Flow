/**
 * Engine safety: replay seeded random event sequences through `wardFlowReducer` and check, after
 * every single event, that the bed picture is still physically possible.
 *
 * The example-based reducer tests prove that each event does the right thing from a hand-built
 * state. These explore bounded, reproducible orderings, including refused events, checking for
 * a bed count below zero, two people in one bed, one person in two beds, a ward fuller than its
 * beds, or a world the browser copy would refuse to reload. Passing samples are not exhaustive proof.
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
import { undoStepTypeFor } from "@/components/ward-management/ward-undo";
import { FUZZED_EVENT_TYPES, nextEvent, seededRandom } from "./helpers/ward-engine-fuzz";
import { undoComparableWorld, undoOf } from "./helpers/ward-legal-figure-sweep";

const envCount = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
};
const SEQUENCES = envCount("WARD_ENGINE_FUZZ_SEQUENCES", 16);
const STEPS = envCount("WARD_ENGINE_FUZZ_STEPS", 100);
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
    if (other && other !== holder)
      return { rule: "no bed holds two people", detail: `${bed} is held for ${other} and ${holder}` };
    holds.set(bed, holder);
    const occupant = beds.get(bed);
    if (occupant && !owns(occupant))
      return { rule: "no bed holds two people", detail: `${bed} is held for ${holder} and occupied by ${occupant}` };
    return null;
  };
  const admissionById = new Map(state.admissions.map((admission) => [admission.id, admission]));
  for (const movement of state.movements) {
    // A journey stopped after collection closes but keeps its bed until RELEASE_HELD_BED clears the stay.
    const stoppedButHeld = movement.transport?.stoppedAt !== undefined && movement.admissionId !== undefined;
    if (movement.closure && !stoppedButHeld) continue;
    if (movement.heldBedNumber === undefined || !movement.acceptedUnitId) continue;
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
  return (
    bedInvariantViolation(next) ??
    (checkStorage ? storageViolation(next) : null) ??
    (next.rejections.length === state.rejections.length ? undoViolation(state, event, next) : null) ?? { next }
  );
}

/** Every step type the random run took back and found restored. */
const UNDONE_STEP_TYPES = new Set<WardFlowEvent["type"]>();

/**
 * Master plan 5.2: an accepted step that offers Undo can be taken back at once, by the role that
 * acted, and the undo restores the world exactly as it was before the step.
 */
function undoViolation(before: WardFlowState, event: WardFlowEvent, applied: WardFlowState): Violation | null {
  if (!undoStepTypeFor(event.type)) return null;
  // A step that changed nothing leaves nothing to undo (an officer's Delivered on a journey with
  // no transport job, for one).
  const earlier = JSON.stringify(undoComparableWorld(before));
  if (JSON.stringify(undoComparableWorld(applied)) === earlier) return null;
  const undone = undoOf(event, applied, event.now + 1);
  if (!undone)
    return { rule: "an accepted step can be undone straight away", detail: `${event.type} could not be undone` };
  if (JSON.stringify(undoComparableWorld(undone.state)) !== earlier)
    return {
      rule: "undo restores the earlier state",
      detail: `${undone.type} did not restore the world before ${event.type}`,
    };
  UNDONE_STEP_TYPES.add(event.type);
  return null;
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
    for (let start = 0; start < current.length;) {
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
function runSeed(seed: number, steps = STEPS) {
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

describe("a bed held for another journey", () => {
  it("refuses a Bed board placement into it", () => {
    // The random run rarely aims a placement at a held bed, so this pins the refusal directly.
    const base = seedWardFlowState();
    const stay = base.admissions.find((admission) => admission.state === "occupied")!;
    const other = base.movements.find(
      (movement) => movement.closure === undefined && movement.admissionId !== stay.id,
    )!;
    const used = new Set(base.admissions.filter((a) => a.unitId === stay.unitId).map((a) => a.bedNumber));
    const bed = [...Array(30).keys()].map((n) => n + 1).find((n) => !used.has(n))!;
    const held: WardFlowState = {
      ...base,
      movements: base.movements.map((movement) =>
        movement.id === other.id ? { ...movement, acceptedUnitId: stay.unitId, heldBedNumber: bed } : movement,
      ),
    };
    const placed = wardFlowReducer(held, {
      type: "PLACE_IN_BED",
      role: "coordinator",
      now: NOW_ANCHOR,
      admissionId: stay.id,
      bedNumber: bed,
    } as WardFlowEvent);
    expect(placed.rejections.at(-1)?.reason).toMatch(/is already held for someone/);
    expect(placed.admissions).toBe(held.admissions);
  });
});

describe("officer Delivered with no transport leg", () => {
  it("is refused rather than accepted as a no-op", () => {
    // Seed 108: a journey marked "no transport needed" has no transport job, so the officer's
    // Delivered changed nothing yet was accepted. The officer screen already refuses it.
    const base = seedWardFlowState("standard");
    const pulled = base.movements.find((movement) => movement.stage === "pulled" && !movement.transport)!;
    expect(pulled, "a seeded pulled journey with no transport job").toBeDefined();
    const noNeed = wardFlowReducer(base, {
      type: "RECORD_TRANSPORT_NEED",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: pulled.id,
      needed: false,
    } as WardFlowEvent);
    expect(noNeed.rejections).toEqual([]);
    const delivered = wardFlowReducer(noNeed, {
      type: "PATIENT_ARRIVED",
      role: "officer",
      now: NOW_ANCHOR + 1,
      movementId: pulled.id,
    });
    expect(delivered.rejections.at(-1)?.reason).toBe(
      "No transport leg to deliver; the receiving ward confirms arrival",
    );
    expect(delivered.movements).toBe(noNeed.movements);
  });
});

describe("engine safety under random event sequences", () => {
  it("starts every scenario from a world that already keeps the rules", () => {
    for (const scenario of WARD_SCENARIOS) {
      const seed = seedWardFlowState(scenario);
      expect(bedInvariantViolation(seed) ?? storageViolation(seed), scenario).toBeNull();
    }
  });

  it(
    `keeps beds whole across ${SEQUENCES} seeded sequences of ${STEPS} events`,
    () => {
      let refused = 0;
      for (let seed = FIRST_SEED; seed < FIRST_SEED + SEQUENCES; seed += 1) {
        const result = runSeed(seed);
        expect(result.failure, `seed ${seed}`).toBeNull();
        refused += result.refused;
      }
      // The generator must reach both sides: enough events succeed to move patients and beds, and
      // enough are refused to prove refusals are safe too. A short run set by hand is too small to
      // measure that, so only the rules above apply to it.
      const total = SEQUENCES * STEPS;
      if (total < 1000) return;
      expect(refused).toBeGreaterThan(total * 0.1);
      expect(refused).toBeLessThan(total * 0.9);
      expect(FUZZED_EVENT_TYPES.size).toBeGreaterThan(50);
      // Enough undoable steps are accepted that the undo rule is tested, not passed by default.
      expect(UNDONE_STEP_TYPES.size).toBeGreaterThan(8);
    },
    Math.max(30_000, SEQUENCES * STEPS * 5),
  );
});
