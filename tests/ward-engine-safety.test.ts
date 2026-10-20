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
import { EVENT_ROLE, type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  eventCarriesTypedTextPayload,
  WARD_FLOW_TEXT_SAFE_EVENT_TYPES,
} from "@/components/ward-management/ward-flow-persistence-classification";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { MOVEMENT_STAGES, REFERRAL_ADDRESSING_STATES } from "@/components/ward-management/ward-model";
import { WARD_SCENARIOS, type WardScenario } from "@/components/ward-management/ward-scenarios";
import { STOP_TRANSPORT_REASONS, TRANSPORT_WHEREABOUTS } from "@/components/ward-management/ward-change-reasons";
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

/** Top-level keys an accepted ADVANCE_CLOCK may change besides the clock: the audit trail. */
const CLOCK_ONLY_KEYS: ReadonlySet<string> = new Set([
  "clockOffsetMinutes",
  "auditEvents",
  "auditReviews",
  "auditSequence",
  "auditReviewSequence",
  "rejections",
]);

/** A reseed replaces the whole world, so no record before it is the same record after it. */
const reseeds = (event: WardFlowEvent) => event.type === "RESET_SCENARIO" || event.type === "SET_SCENARIO";
const inBed = (admission: WardFlowState["admissions"][number]) => IN_A_BED.has(admission.state);

/**
 * Ward closure mode: a ward closed before and after an accepted event gains no new acceptance or
 * hold. Existing holds are kept by design, so a hold made before closure may still arrive
 * (PATIENT_ARRIVED for a journey already accepted there), a pull may restore a journey that
 * already had its stay, and an undo may put back a stay the ward already had. Only
 * REOPEN_WARD_TO_ADMISSIONS clears `isClosed`.
 */
function closedWardViolation(before: WardFlowState, event: WardFlowEvent, after: WardFlowState): Violation | null {
  if (reseeds(event)) return null;
  const wasClosed = new Set(before.units.filter((unit) => unit.isClosed).map((unit) => unit.id));
  for (const unit of before.units) {
    const now = after.units.find((candidate) => candidate.id === unit.id);
    if (unit.isClosed && now && !now.isClosed && event.type !== "REOPEN_WARD_TO_ADMISSIONS")
      return {
        rule: "a closed ward gains no new acceptance or hold",
        detail: `${event.type} reopened ${unit.id}; only REOPEN_WARD_TO_ADMISSIONS may`,
      };
  }
  const closed = new Set(after.units.filter((unit) => unit.isClosed && wasClosed.has(unit.id)).map((unit) => unit.id));
  if (closed.size === 0) return null;
  const movementId = "movementId" in event && typeof event.movementId === "string" ? event.movementId : undefined;
  const subjectBefore = before.movements.find((movement) => movement.id === movementId);
  const arrivalOfEarlierHold = (unitId: string) =>
    event.type === "PATIENT_ARRIVED" && subjectBefore?.acceptedUnitId === unitId;
  const pullRestoringStay = event.type === "PULL_PATIENT" && subjectBefore?.admissionId !== undefined;
  const broken = (detail: string): Violation => ({
    rule: "a closed ward gains no new acceptance or hold",
    detail: `${event.type} ${detail}`,
  });

  const staysBefore = new Map(before.admissions.map((admission) => [admission.id, admission]));
  for (const stay of after.admissions) {
    if (!closed.has(stay.unitId) || !inBed(stay)) continue;
    const was = staysBefore.get(stay.id);
    if (was && was.unitId === stay.unitId && inBed(was)) continue;
    if (arrivalOfEarlierHold(stay.unitId) || pullRestoringStay) continue;
    // An UNDO_* step puts back a stay this ward already had (a departure undone returns the person
    // to their bed); it is not a new admission, so closure does not refuse it.
    if (event.type.startsWith("UNDO_") && was?.unitId === stay.unitId) continue;
    return broken(`put stay ${stay.id} (${stay.state}) on closed ward ${stay.unitId}`);
  }
  const movementsBefore = new Map(before.movements.map((movement) => [movement.id, movement]));
  for (const movement of after.movements) {
    const unitId = movement.acceptedUnitId;
    if (!unitId || !closed.has(unitId)) continue;
    const was = movementsBefore.get(movement.id);
    if (arrivalOfEarlierHold(unitId) || (pullRestoringStay && movement.id === movementId)) continue;
    if (was?.acceptedUnitId !== unitId) return broken(`accepted ${movement.id} onto closed ward ${unitId}`);
    if (movement.heldBedNumber !== undefined && was.heldBedNumber !== movement.heldBedNumber)
      return broken(`held bed ${movement.heldBedNumber} on closed ward ${unitId} for ${movement.id}`);
  }
  const referralsBefore = new Map(before.referrals.map((referral) => [referral.id, referral]));
  for (const referral of after.referrals) {
    for (const [index, arm] of referral.destinations.entries()) {
      if (arm.state !== "accepted" || arm.destination.kind !== "psychiatric_ward") continue;
      const unitId = arm.acceptedUnitId ?? arm.destination.unitId;
      if (!unitId || !closed.has(unitId)) continue;
      const was = referralsBefore.get(referral.id)?.destinations[index];
      const wasUnit =
        was && was.destination.kind === "psychiatric_ward" ? (was.acceptedUnitId ?? was.destination.unitId) : undefined;
      if (arrivalOfEarlierHold(unitId)) continue;
      if (was?.state !== "accepted" || wasUnit !== unitId)
        return broken(`accepted referral ${referral.id} onto closed ward ${unitId}`);
      if (arm.heldBedNumber !== undefined && was.heldBedNumber !== arm.heldBedNumber)
        return broken(`held bed ${arm.heldBedNumber} on closed ward ${unitId} for referral ${referral.id}`);
    }
  }
  return null;
}

/** Advancing the demonstration clock changes nothing but the clock (and the audit trail). */
function clockOnlyViolation(before: WardFlowState, event: WardFlowEvent, after: WardFlowState): Violation | null {
  if (event.type !== "ADVANCE_CLOCK") return null;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (CLOCK_ONLY_KEYS.has(key)) continue;
    const was = (before as Record<string, unknown>)[key];
    const now = (after as Record<string, unknown>)[key];
    if (was !== now && JSON.stringify(was) !== JSON.stringify(now))
      return { rule: "advancing the clock changes nothing but the clock", detail: `ADVANCE_CLOCK changed ${key}` };
  }
  return null;
}

/** The role check is the reducer's first gate: nothing it accepts came from a role it does not permit. */
function roleViolation(event: WardFlowEvent): Violation | null {
  return EVENT_ROLE[event.type].includes(event.role)
    ? null
    : { rule: "an accepted event's role is permitted", detail: `${event.type} was accepted from role ${event.role}` };
}

/**
 * A first recorded time is never rewritten: once set it stays, unless the record is removed or an
 * UNDO_* step puts back the earlier state. Arrival details' `recordedAt`, a departed bed release's
 * departure time (`confirmedAt`, which the Discharges board shows for a departed release), and a
 * legal form continuation's `startedAt` and `recordedAt`.
 */
function firstTimeViolation(before: WardFlowState, event: WardFlowEvent, after: WardFlowState): Violation | null {
  if (reseeds(event) || event.type.startsWith("UNDO_")) return null;
  const broken = (detail: string): Violation => ({
    rule: "a first recorded time is never rewritten",
    detail: `${event.type} ${detail}`,
  });
  const movementsAfter = new Map(after.movements.map((movement) => [movement.id, movement]));
  for (const movement of before.movements) {
    const now = movementsAfter.get(movement.id);
    if (!now) continue;
    const recorded = movement.arrivalDetails?.recordedAt;
    if (recorded !== undefined && now.arrivalDetails && now.arrivalDetails.recordedAt !== recorded)
      return broken(
        `moved ${movement.id} arrival details recordedAt from ${recorded} to ${now.arrivalDetails.recordedAt}`,
      );
    // A later 5B keeps the earlier continuation in `earlierContinuations`, so each continuation
    // recorded before must still be there with its own times while the form carries any.
    const formNow = now.legalForm;
    const keptNow = [...(formNow?.earlierContinuations ?? []), ...(formNow?.continuedBy ? [formNow.continuedBy] : [])];
    if (keptNow.length > 0) {
      const keptBefore = [
        ...(movement.legalForm?.earlierContinuations ?? []),
        ...(movement.legalForm?.continuedBy ? [movement.legalForm.continuedBy] : []),
      ];
      for (const earlier of keptBefore)
        if (!keptNow.some((entry) => entry.startedAt === earlier.startedAt && entry.recordedAt === earlier.recordedAt))
          return broken(
            `rewrote ${movement.id}'s continuation started ${earlier.startedAt}, recorded ${earlier.recordedAt}`,
          );
    }
  }
  const releasesAfter = new Map(after.bedReleases.map((release) => [release.id, release]));
  for (const release of before.bedReleases) {
    if (release.state !== "discharged") continue;
    const now = releasesAfter.get(release.id);
    if (now && now.confirmedAt !== release.confirmedAt)
      return broken(
        `moved departed release ${release.id} departure time from ${release.confirmedAt} to ${now.confirmedAt}`,
      );
  }
  return null;
}

/** The per-step rules for an accepted event. */
function acceptedStepViolation(before: WardFlowState, event: WardFlowEvent, after: WardFlowState): Violation | null {
  return (
    roleViolation(event) ??
    clockOnlyViolation(before, event, after) ??
    closedWardViolation(before, event, after) ??
    firstTimeViolation(before, event, after)
  );
}

/** Bed-side records a refused event must leave exactly as they were. */
const BED_RECORDS = ["units", "admissions", "bedReleases", "leaveBeds", "plannedAdmissions"] as const;
/** The storage check walks the whole world, so the run checks it every few events and at the end. */
const STORAGE_EVERY = 10;

type StepFailure = Violation & { step: number };

/**
 * Whether the browser copy is locked after this event, as the provider tracks it
 * (`trackWardFlowTypedTextDispatch`): a dispatch of a typed-text event, or one carrying typed text,
 * stops saving until a reseed moves `worldGeneration`. A locked session is never written, so the
 * storage rule does not apply to it (repatriations and support notifications are refused in a
 * stored copy by design).
 */
function typedTextLocked(locked: boolean, event: WardFlowEvent, before: WardFlowState, after: WardFlowState) {
  if (after.worldGeneration !== before.worldGeneration) return false;
  return locked || !WARD_FLOW_TEXT_SAFE_EVENT_TYPES.has(event.type) || eventCarriesTypedTextPayload(event);
}

function applyAndCheck(
  state: WardFlowState,
  event: WardFlowEvent,
  checkStorage: boolean,
  lockedBefore = false,
): Violation | { next: WardFlowState; locked: boolean } {
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
  const locked = typedTextLocked(lockedBefore, event, state, next);
  return (
    bedInvariantViolation(next) ??
    (checkStorage && !locked ? storageViolation(next) : null) ??
    (next.rejections.length === state.rejections.length
      ? (acceptedStepViolation(state, event, next) ?? undoViolation(state, event, next))
      : null) ?? { next, locked }
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
  let locked = false;
  for (const [step, event] of events.entries()) {
    const result = applyAndCheck(state, event, true, locked);
    if ("rule" in result) return { ...result, step };
    state = result.next;
    locked = result.locked;
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
  let locked = false;
  for (let step = 0; step < steps; step += 1) {
    const event = nextEvent(state, random, step, seed);
    events.push(event);
    const result = applyAndCheck(state, event, (step + 1) % STORAGE_EVERY === 0 || step === steps - 1, locked);
    if ("rule" in result) return { failure: describeFailure(seed, scenario, events), refused };
    if (result.next.rejections.length > state.rejections.length) refused += 1;
    state = result.next;
    locked = result.locked;
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

/**
 * Audit 2, E-19: six events the random run sent but never once saw accepted. Each is driven here by
 * a short scripted sequence from a seeded world, so its success path is proven regardless of how
 * long the random run is. RELEASE_BED is left out because no seeded world can reach it: it completes
 * only a live release whose stay has already departed, but every departure (`departAdmission`)
 * discharges that stay's live release in the same write, FLAG_BED_RELEASE refuses a departed stay,
 * UNDO_DEPARTURE puts the stay and its release back together, and no seed carries such a pair.
 */
describe("events the random run never saw accepted", () => {
  function script(scenario: WardScenario = "standard") {
    let state = seedWardFlowState(scenario);
    let now = NOW_ANCHOR;
    const ok = (event: Record<string, unknown>) => {
      now += 1;
      const next = wardFlowReducer(state, { now, ...event } as unknown as WardFlowEvent);
      expect(next.rejections.at(-1)?.reason, String(event.type)).toBe(state.rejections.at(-1)?.reason);
      expect(next.rejections.length, String(event.type)).toBe(state.rejections.length);
      state = next;
      return state;
    };
    return {
      ok,
      get state() {
        return state;
      },
    };
  }
  const occupiedStay = (state: WardFlowState) => state.admissions.find((admission) => admission.state === "occupied")!;

  it("RELEASE_HELD_BED frees the bed of a journey stopped after collection", () => {
    const run = script();
    // WF-006 is in transit (collected) in the standard world.
    const moving = run.state.movements.find((movement) => movement.id === "WF-006")!;
    expect(moving.transport?.collectedAt).toBeDefined();
    run.ok({
      type: "STOP_TRANSPORT",
      role: "coordinator",
      movementId: moving.id,
      reason: STOP_TRANSPORT_REASONS[0],
      whereabouts: TRANSPORT_WHEREABOUTS[0],
    });
    run.ok({ type: "RELEASE_HELD_BED", role: "coordinator", movementId: moving.id });
  });

  it("UNDO_ABSENT_WITHOUT_LEAVE takes back a recorded absence", () => {
    const run = script();
    const stay = occupiedStay(run.state);
    run.ok({ type: "RECORD_ABSENT_WITHOUT_LEAVE", role: "ward", admissionId: stay.id, actingUnitId: stay.unitId });
    run.ok({ type: "UNDO_ABSENT_WITHOUT_LEAVE", role: "ward", admissionId: stay.id, actingUnitId: stay.unitId });
    expect(run.state.leaveBeds.some((bed) => bed.admissionId === stay.id && bed.absentWithoutLeave)).toBe(false);
  });

  it("UNDO_ACCEPT_IN_PRINCIPLE takes back a ward's acceptance", () => {
    const run = script();
    const unitId = "rph-adult-secure";
    run.ok({ type: "REFER_TO_UNITS", role: "coordinator", movementId: "WF-009", unitIds: [unitId] });
    run.ok({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId: "WF-009", unitId, actingUnitId: unitId });
    run.ok({ type: "UNDO_ACCEPT_IN_PRINCIPLE", role: "ward", movementId: "WF-009", actingUnitId: unitId });
    expect(run.state.movements.find((movement) => movement.id === "WF-009")?.acceptedUnitId).toBeUndefined();
  });

  it("UNDO_ED_STEP takes back an ED step", () => {
    const run = script();
    run.ok({ type: "RECORD_TRANSPORT_NEED", role: "ed", movementId: "WF-004", needed: false });
    run.ok({ type: "UNDO_ED_STEP", role: "ed", movementId: "WF-004" });
  });

  it("UNDO_PLACE_IN_BED takes back a Bed board move", () => {
    const run = script();
    const stay = occupiedStay(run.state);
    const used = new Set(run.state.admissions.filter((a) => a.unitId === stay.unitId).map((a) => a.bedNumber));
    const held = new Set(
      run.state.movements.filter((m) => m.acceptedUnitId === stay.unitId).map((m) => m.heldBedNumber),
    );
    const bed = [...Array(40).keys()].map((n) => n + 1).find((n) => !used.has(n) && !held.has(n))!;
    run.ok({ type: "PLACE_IN_BED", role: "coordinator", admissionId: stay.id, bedNumber: bed });
    run.ok({ type: "UNDO_PLACE_IN_BED", role: "coordinator", admissionId: stay.id });
    expect(run.state.admissions.find((admission) => admission.id === stay.id)?.bedNumber).toBe(stay.bedNumber);
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
      // Every event in the role table is sent at least once (the generator's sweep steps see to it).
      const neverSent = Object.keys(EVENT_ROLE).filter(
        (type) => !FUZZED_EVENT_TYPES.has(type as WardFlowEvent["type"]),
      );
      expect(neverSent).toEqual([]);
      // Enough undoable steps are accepted that the undo rule is tested, not passed by default.
      expect(UNDONE_STEP_TYPES.size).toBeGreaterThan(8);
    },
    Math.max(30_000, SEQUENCES * STEPS * 5),
  );
});
