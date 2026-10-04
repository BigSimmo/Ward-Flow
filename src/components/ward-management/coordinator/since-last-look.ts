import { DELAY_CAUSE_COPY, delayGroups } from "@/components/ward-management/delays/delays-derivations";
import type { Instant } from "@/components/ward-management/ward-clock";
import { isOpen, unitCapacity } from "@/components/ward-management/ward-derivations";
import type { BedRelease, Movement, Referral, Unit } from "@/components/ward-management/ward-model";

/**
 * Smart feature 9, "What changed since you last looked" (owner request, 4 Oct 2026).
 *
 * When a coordinator comes back to the Command screen, a short list says what is new since they
 * last left it: new referrals, beds that became ready, new delays and new escalations. It is a
 * comparison of two pictures of the synthetic world — the one remembered when they last left, and
 * the one on screen now — and nothing else. It decides nothing and ranks nothing.
 *
 * 🔒 **THE REMEMBERED PICTURE HOLDS RECORD IDS, WARD IDS, COUNTS AND ONE DEMO INSTANT. NEVER A
 * NAME, A NOTE OR ANY TYPED TEXT.** It is kept in `sessionStorage`, the same place and lifetime as
 * the demo state it describes, so it ends when the state does.
 */

export const LAST_LOOK_STORAGE_KEY = "ward-flow-coordinator-last-look";

export type LastLookSnapshot = {
  version: 1;
  /** The demo clock when this picture was taken. */
  at: Instant;
  /** A picture taken in another synthetic scenario is never compared with this one. */
  scenario: string;
  referralIds: string[];
  movementIds: string[];
  /** "Ready" beds per ward — the same `min(allocatable, empty)` every screen calls Ready. */
  readyByUnit: Record<string, number>;
  /** `movementId:cause` for every open movement sitting in a delay group. */
  delayKeys: string[];
  escalatedMovementIds: string[];
};

export type LastLookWorld = {
  scenario: string;
  referrals: readonly Referral[];
  movements: readonly Movement[];
  units: readonly Unit[];
  bedReleases: readonly BedRelease[];
};

type BedsFreed = { unitId: string; unitName: string; count: number };
type NewDelay = { movementId: string; title: string };

export type ChangesSinceLastLook = {
  since: Instant;
  newReferralIds: string[];
  /** New journeys with no front-door referral of their own (a referral's journey is not counted twice). */
  newMovementIds: string[];
  bedsFreed: BedsFreed[];
  newDelays: NewDelay[];
  newEscalationIds: string[];
};

export function takeLastLookSnapshot(world: LastLookWorld, now: Instant): LastLookSnapshot {
  const open = world.movements.filter(isOpen);
  const readyByUnit: Record<string, number> = {};
  for (const unit of world.units) {
    readyByUnit[unit.id] = unitCapacity(unit, [...world.bedReleases]).available;
  }
  const delayKeys: string[] = [];
  for (const group of delayGroups(open, [...world.units], now)) {
    for (const movement of group.movements) delayKeys.push(`${movement.id}:${group.cause}`);
  }
  return {
    version: 1,
    at: now,
    scenario: world.scenario,
    referralIds: world.referrals.map((referral) => referral.id),
    movementIds: world.movements.map((movement) => movement.id),
    readyByUnit,
    delayKeys,
    escalatedMovementIds: open.filter((movement) => movement.escalation !== undefined).map((movement) => movement.id),
  };
}

/**
 * What is in `current` that was not in `previous`. Returns `undefined` when there is nothing to
 * compare against (first look this session, or a different scenario), which the screen shows as a
 * quiet first-look line rather than an empty list.
 */
export function changesSinceLastLook(
  previous: LastLookSnapshot | undefined,
  current: LastLookSnapshot,
  world: Pick<LastLookWorld, "movements" | "units">,
): ChangesSinceLastLook | undefined {
  if (!previous || previous.scenario !== current.scenario) return undefined;

  const seenReferrals = new Set(previous.referralIds);
  const seenMovements = new Set(previous.movementIds);
  const seenDelays = new Set(previous.delayKeys);
  const seenEscalations = new Set(previous.escalatedMovementIds);
  const movementById = new Map<string, Movement>(world.movements.map((movement) => [movement.id, movement]));

  const newReferralIds = current.referralIds.filter((id) => !seenReferrals.has(id));
  const newMovementIds = current.movementIds.filter((id) => {
    if (seenMovements.has(id)) return false;
    const movement = movementById.get(id);
    return movement !== undefined && isOpen(movement) && movement.referralId === undefined;
  });

  const bedsFreed: BedsFreed[] = [];
  for (const unit of world.units) {
    const before = previous.readyByUnit[unit.id];
    const after = current.readyByUnit[unit.id];
    if (before === undefined || after === undefined || after <= before) continue;
    bedsFreed.push({ unitId: unit.id, unitName: unit.name, count: after - before });
  }

  // One row per movement: a movement that moved from one delay to another is new in the cause it
  // now sits under. Titles come from the delays screen's own copy, never written here.
  const newDelays: NewDelay[] = [];
  const counted = new Set<string>();
  for (const key of current.delayKeys) {
    if (seenDelays.has(key)) continue;
    const separator = key.lastIndexOf(":");
    const movementId = key.slice(0, separator);
    if (counted.has(movementId)) continue;
    counted.add(movementId);
    newDelays.push({ movementId, title: delayTitle(key.slice(separator + 1)) });
  }

  return {
    since: previous.at,
    newReferralIds,
    newMovementIds,
    bedsFreed,
    newDelays,
    newEscalationIds: current.escalatedMovementIds.filter((id) => !seenEscalations.has(id)),
  };
}

function delayTitle(cause: string): string {
  return DELAY_CAUSE_COPY.find((entry) => entry.cause === cause)?.title ?? "Delayed";
}

export function hasAnyChange(changes: ChangesSinceLastLook): boolean {
  return (
    changes.newReferralIds.length +
      changes.newMovementIds.length +
      changes.bedsFreed.length +
      changes.newDelays.length +
      changes.newEscalationIds.length >
    0
  );
}

/** Accepts only a well-formed picture; anything else reads as "no previous look". */
export function parseLastLookSnapshot(raw: string | null): LastLookSnapshot | undefined {
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return undefined;
    const v = value as Record<string, unknown>;
    const stringArray = (field: unknown) => Array.isArray(field) && field.every((entry) => typeof entry === "string");
    if (v.version !== 1 || typeof v.at !== "number" || typeof v.scenario !== "string") return undefined;
    if (![v.referralIds, v.movementIds, v.delayKeys, v.escalatedMovementIds].every(stringArray)) return undefined;
    if (typeof v.readyByUnit !== "object" || v.readyByUnit === null) return undefined;
    if (!Object.values(v.readyByUnit).every((count) => typeof count === "number")) return undefined;
    return value as LastLookSnapshot;
  } catch {
    return undefined;
  }
}
