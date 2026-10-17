import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import {
  adjustSexMix,
  eligibility,
  mixSexOf,
  type EligibilitySubject,
  type GateResult,
} from "@/components/ward-management/ward-eligibility";
import { REFERRABLE_MOVEMENT_STAGES } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";
import { edById, siteByCode } from "@/components/ward-management/ward-sites";
import { stayLegalStatus } from "@/components/ward-management/ward-stay-legal";
import { stepDownSubject } from "@/components/ward-management/ward-step-down";

/**
 * MAKE ROOM CHAINS (`make-room-chains`, mockup stage, Josh 17 Oct 2026). A waiting referral whose
 * ward fits on every check except a free bed can still be placed if a patient already marked for
 * step down on that ward moves first. This finds those chains, at most three moves long, inside one
 * health service, using only stays the team has marked as step down candidates.
 *
 * It only suggests. Every move it names still goes through the normal movement steps and the same
 * `eligibility()` gates, so single sex, legal, cohort, risk and capacity freshness all apply.
 */

/** The longest chain offered, counting the waiting referral's own move. */
export const MAKE_ROOM_MAX_MOVES = 3;

type MakeRoomStepDown = {
  admission: Admission;
  fromUnit: Unit;
  toUnit: Unit;
  /** The checks this move passes, asked of its ward once the bed it waits on is free. */
  checks: GateResult[];
};

export type MakeRoomChain = {
  /** The waiting referral the chain makes room for. */
  movement: Movement;
  /** The ward the waiting referral would go to once room is made. */
  targetUnit: Unit;
  /**
   * The step downs in the order they must happen: the first one moves into a Ready bed, and each
   * later one moves into the bed the one before it freed.
   */
  stepDowns: MakeRoomStepDown[];
  /** The checks the waiting referral passes on its ward once the last step down has left. */
  checks: GateResult[];
};

const FREE_BED_GATES: readonly string[] = ["allocatable_bed", "sex_mix"];

/** A ward that fits on every check, ignoring only whether a bed is free now. A first filter: the
 * real answer comes from `vacated()`, since freeing a bed also changes the ward's sex mix. */
function fitsExceptForBed(subject: EligibilitySubject, unit: Unit, now: Instant): boolean {
  return eligibility(subject, unit, now).gates.every((gate) => gate.pass || FREE_BED_GATES.includes(gate.gate));
}

/**
 * The ward as it would be once `leaving` moves out: one more free bed, and one fewer occupant in
 * their sex mix bucket. Every gate, `sex_mix` included, is then asked of this ward, so a plan is
 * only offered when the patient coming in would pass the normal placement checks at that moment.
 */
function vacated(unit: Unit, leaving: Admission): Unit {
  return {
    ...unit,
    allocatable: { ...unit.allocatable, value: Math.max(0, unit.allocatable.value) + 1 },
    empty: { ...unit.empty, value: Math.max(0, unit.empty.value) + 1 },
    sexMix: adjustSexMix(unit.sexMix, mixSexOf(leaving.gender, leaving.sex), -1),
  };
}

function isFull(unit: Unit): boolean {
  return boundedBedAvailability(unit).available === 0;
}

function serviceOf(unit: Unit): string | undefined {
  return siteByCode(unit.siteCode)?.service;
}

/** The health service of the emergency department a referral came from. */
function movementService(movement: Movement): string | undefined {
  const siteCode = edById(movement.originEdId)?.siteCode;
  return siteCode ? siteByCode(siteCode)?.service : undefined;
}

export function deriveMakeRoomChains(input: {
  admissions: readonly Admission[];
  units: readonly Unit[];
  movements: readonly Movement[];
  patients?: readonly Patient[];
  referrals?: readonly Referral[];
  now: Instant;
}): MakeRoomChain[] {
  const { now } = input;
  const candidates = input.admissions.filter(
    (admission) => admission.stepDownCandidate === true && admission.state === "occupied",
  );
  const subjectOf = new Map<string, { subject: EligibilitySubject; fromUnit: Unit }>();
  for (const admission of candidates) {
    const fromUnit = input.units.find((unit) => unit.id === admission.unitId);
    if (!fromUnit) continue;
    const legal = stayLegalStatus(admission, {
      movements: input.movements,
      patients: input.patients,
      referrals: input.referrals,
    });
    subjectOf.set(admission.id, { subject: stepDownSubject(admission, fromUnit, legal), fromUnit });
  }

  // Each step down candidate is offered in one chain only, so two suggestions never count on the
  // same patient moving.
  const used = new Set<string>();
  // Ready beds already promised to an earlier chain, by ward, so one bed is never offered twice.
  const claimed = new Map<string, number>();

  function fitsWithBed(subject: EligibilitySubject, unit: Unit): boolean {
    const free = boundedBedAvailability(unit).available - (claimed.get(unit.id) ?? 0);
    return free > 0 && eligibility(subject, unit, now).eligible;
  }

  /** The checks `subject` passes going into `unit` once `leaving` has moved out, or undefined if one fails. */
  function checksIntoVacated(subject: EligibilitySubject, unit: Unit, leaving: Admission): GateResult[] | undefined {
    const verdict = eligibility(subject, vacated(unit, leaving), now);
    return verdict.eligible ? verdict.gates : undefined;
  }

  /**
   * Step downs that free a bed on `full` that `incoming` can then take, without revisiting a ward
   * already in the chain. The last step down returned is the patient who leaves `full`.
   */
  function freeABed(
    full: Unit,
    incoming: EligibilitySubject,
    visited: Set<string>,
    movesLeft: number,
  ): MakeRoomStepDown[] | undefined {
    if (movesLeft < 1) return undefined;
    const service = serviceOf(full);
    const others = input.units.filter(
      (unit) => !visited.has(unit.id) && serviceOf(unit) === service && unit.id !== full.id,
    );
    const onWard = candidates.filter(
      (admission) =>
        admission.unitId === full.id &&
        !used.has(admission.id) &&
        checksIntoVacated(incoming, full, admission) !== undefined,
    );
    // A move straight into a Ready bed first, so the shortest chain wins.
    for (const admission of onWard) {
      const entry = subjectOf.get(admission.id);
      if (!entry) continue;
      const ready = others.find((unit) => fitsWithBed(entry.subject, unit));
      if (ready) {
        return [{ admission, fromUnit: full, toUnit: ready, checks: eligibility(entry.subject, ready, now).gates }];
      }
    }
    if (movesLeft < 2) return undefined;
    for (const admission of onWard) {
      const entry = subjectOf.get(admission.id);
      if (!entry) continue;
      for (const next of others) {
        if (!isFull(next) || !fitsExceptForBed(entry.subject, next, now)) continue;
        const before = freeABed(next, entry.subject, new Set([...visited, next.id]), movesLeft - 1);
        if (!before || before.some((step) => step.admission.id === admission.id)) continue;
        const checks = checksIntoVacated(entry.subject, next, before.at(-1)!.admission);
        if (checks) return [...before, { admission, fromUnit: full, toUnit: next, checks }];
      }
    }
    return undefined;
  }

  const chains: MakeRoomChain[] = [];
  const waiting = input.movements
    .filter((movement) => !movement.closure && REFERRABLE_MOVEMENT_STAGES.includes(movement.stage))
    .sort((a, b) => a.openedAt - b.openedAt);
  for (const movement of waiting) {
    // Same health service only. A referral that already has a ward there with a Ready bed needs no
    // room made.
    const service = movementService(movement);
    const local = input.units.filter((unit) => serviceOf(unit) === service);
    if (local.some((unit) => fitsWithBed(movement, unit))) continue;
    for (const targetUnit of local) {
      if (!isFull(targetUnit) || !fitsExceptForBed(movement, targetUnit, now)) continue;
      const stepDowns = freeABed(targetUnit, movement, new Set([targetUnit.id]), MAKE_ROOM_MAX_MOVES - 1);
      const checks = stepDowns && checksIntoVacated(movement, targetUnit, stepDowns.at(-1)!.admission);
      if (!stepDowns || !checks) continue;
      for (const step of stepDowns) used.add(step.admission.id);
      const readyWard = stepDowns[0]!.toUnit.id;
      claimed.set(readyWard, (claimed.get(readyWard) ?? 0) + 1);
      chains.push({ movement, targetUnit, stepDowns, checks });
      break;
    }
  }
  return chains;
}
