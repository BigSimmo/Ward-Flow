import { DELAY_CAUSE_COPY, delayGroups } from "@/components/ward-management/delays/delays-derivations";
import type { DueSoonThresholds, Instant } from "@/components/ward-management/ward-clock";
import { isOpen, unitCapacity } from "@/components/ward-management/ward-derivations";
import {
  MOVEMENT_STAGES,
  REFERRAL_ADDRESSING_STATES,
  BED_RELEASE_STATES,
} from "@/components/ward-management/ward-model";
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
  version: 2 | 3;
  scopeKey?: string;
  records?: ScopedLookRecord[];
  worldGeneration: number;
  userId: string;
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
  worldGeneration?: number;
  userId?: string;
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
  /**
   * What `since` is: the coordinator's last look (`look`), or, before any look this session, the
   * start of the shift read from recorded times (`shift`, `changesSinceInstant`). Absent means look.
   */
  basis?: "look" | "shift";
  updates?: { kind: ScopedLookRecord["kind"]; id: string }[];
  newReferralIds: string[];
  /** New journeys with no front-door referral of their own (a referral's journey is not counted twice). */
  newMovementIds: string[];
  bedsFreed: BedsFreed[];
  newDelays: NewDelay[];
  newEscalationIds: string[];
};

export function takeLastLookSnapshot(
  world: LastLookWorld,
  now: Instant,
  thresholds: DueSoonThresholds,
  scopeKey?: string,
): LastLookSnapshot {
  const open = world.movements.filter(isOpen);
  const readyByUnit: Record<string, number> = {};
  for (const unit of world.units) {
    readyByUnit[unit.id] = unitCapacity(unit, [...world.bedReleases]).available;
  }
  const delayKeys: string[] = [];
  for (const group of delayGroups(open, [...world.units], now, thresholds)) {
    for (const movement of group.movements) delayKeys.push(`${movement.id}:${group.cause}`);
  }
  return {
    version: scopeKey ? 3 : 2,
    ...(scopeKey ? { scopeKey, records: scopedLookRecords(world, scopeKey) } : {}),
    worldGeneration: world.worldGeneration ?? 0,
    userId: world.userId ?? "local-demo",
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
  if (
    !previous ||
    previous.scenario !== current.scenario ||
    previous.worldGeneration !== current.worldGeneration ||
    previous.userId !== current.userId ||
    previous.at > current.at
  )
    return undefined;

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
  const bedsFreed = bedsFreedRows(world.units, previous, current);
  const newDelays = newDelayRows(current.delayKeys, seenDelays);

  return {
    since: previous.at,
    newReferralIds,
    newMovementIds,
    bedsFreed,
    newDelays,
    newEscalationIds: current.escalatedMovementIds.filter((id) => !seenEscalations.has(id)),
  };
}

/**
 * What the record says changed between `since` and `now`, from recorded times alone: referrals
 * raised, journeys opened with no front-door referral, and escalations made in the window. Used
 * before any look this session (L1, site review, 12 Oct 2026: Home said "0 new since 07:00" while
 * Handover counted 32 opened since 07:00), so "new since 07:00" always counts what happened since
 * 07:00. Beds freed and delays need a remembered picture, so they stay empty here.
 *
 * Handover's "Since you looked" strip should read this too, with its own window start.
 */
export function changesSinceInstant(
  world: Pick<LastLookWorld, "referrals" | "movements">,
  since: Instant,
  now: Instant,
): ChangesSinceLastLook {
  const within = (at: Instant | undefined) => at !== undefined && at >= since && at <= now;
  const newReferralIds = world.referrals.filter((referral) => within(referral.raisedAt)).map((referral) => referral.id);
  const countedReferrals = new Set(newReferralIds);
  return {
    since,
    basis: "shift",
    newReferralIds,
    // A journey opened in the window counts unless its referral is already counted in the same
    // window, so one opened today from an older referral is not lost.
    newMovementIds: world.movements
      .filter(
        (movement) =>
          isOpen(movement) &&
          within(movement.openedAt) &&
          (movement.referralId === undefined || !countedReferrals.has(movement.referralId)),
      )
      .map((movement) => movement.id),
    bedsFreed: [],
    newDelays: [],
    newEscalationIds: world.movements
      .filter((movement) => isOpen(movement) && within(movement.escalation?.at))
      .map((movement) => movement.id),
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
      changes.newEscalationIds.length +
      (changes.updates?.length ?? 0) >
    0
  );
}

/** Accepts only a well-formed picture; anything else reads as "no previous look". */
export function parseLastLookSnapshot(raw: string | null): LastLookSnapshot | undefined {
  if (!raw) return undefined;
  try {
    return parsedSnapshot(JSON.parse(raw));
  } catch {
    return undefined;
  }
}
function bedsFreedRows(
  units: LastLookWorld["units"],
  previous: LastLookSnapshot,
  current: LastLookSnapshot,
): BedsFreed[] {
  const bedsFreed: BedsFreed[] = [];
  for (const unit of units) {
    const before = previous.readyByUnit[unit.id];
    const after = current.readyByUnit[unit.id];
    if (before === undefined || after === undefined || after <= before) continue;
    bedsFreed.push({ unitId: unit.id, unitName: unit.name, count: after - before });
  }
  return bedsFreed;
}
function newDelayRows(keys: string[], seenDelays: Set<string>): NewDelay[] {
  // One row per movement: a movement that moved from one delay to another is new in the cause it
  // now sits under. Titles come from the delays screen's own copy, never written here.
  const newDelays: NewDelay[] = [];
  const counted = new Set<string>();
  for (const key of keys) {
    if (seenDelays.has(key)) continue;
    const separator = key.lastIndexOf(":");
    const movementId = key.slice(0, separator);
    if (counted.has(movementId)) continue;
    counted.add(movementId);
    newDelays.push({ movementId, title: delayTitle(key.slice(separator + 1)) });
  }
  return newDelays;
}
function stringArray(field: unknown): boolean {
  return Array.isArray(field) && field.every((entry) => typeof entry === "string");
}
function snapshotHeaderInvalid(v: Record<string, unknown>): boolean {
  return (
    (v.version !== 2 && v.version !== 3) ||
    !Number.isSafeInteger(v.worldGeneration) ||
    typeof v.userId !== "string" ||
    typeof v.at !== "number" ||
    !Number.isFinite(v.at) ||
    typeof v.scenario !== "string"
  );
}
function snapshotListsInvalid(v: Record<string, unknown>): boolean {
  return ![v.referralIds, v.movementIds, v.delayKeys, v.escalatedMovementIds].every(stringArray);
}
function snapshotReadyCountsInvalid(v: Record<string, unknown>): boolean {
  if (typeof v.readyByUnit !== "object" || v.readyByUnit === null || Array.isArray(v.readyByUnit)) return true;
  return !Object.values(v.readyByUnit).every((count) => Number.isSafeInteger(count) && (count as number) >= 0);
}
function parsedSnapshot(value: unknown): LastLookSnapshot | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const v = value as Record<string, unknown>;
  if (snapshotHeaderInvalid(v) || snapshotListsInvalid(v) || snapshotReadyCountsInvalid(v)) return undefined;
  if (
    v.version === 3 &&
    (typeof v.scopeKey !== "string" || !Array.isArray(v.records) || !v.records.every(validScopedRecord))
  )
    return undefined;
  return value as LastLookSnapshot;
}

/** Fixed IDs, enum indexes and operational instants only; never typed text. */
type ScopedLookRecord = { kind: "referral" | "movement" | "release"; id: string; values: number[]; at: Instant };
function validScopedRecord(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    ["referral", "movement", "release"].includes(v.kind as string) &&
    typeof v.id === "string" &&
    typeof v.at === "number" &&
    Number.isFinite(v.at) &&
    Array.isArray(v.values) &&
    v.values.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

export function scopeLastLookWorld(world: LastLookWorld, scopeKey: string): LastLookWorld {
  const ward = scopeKey.startsWith("ward:");
  const id = scopeKey.slice(scopeKey.indexOf(":") + 1);
  const movements = world.movements.filter((m) =>
    ward
      ? m.acceptedUnitId === id ||
        m.referredUnitIds.includes(id) ||
        m.withdrawnReferrals.some((r) => r.unitId === id) ||
        m.referralAnswerHistory?.some((r) => r.unitId === id)
      : m.originEdId === id,
  );
  const referralIds = new Set(movements.map((m) => m.referralId));
  return {
    ...world,
    movements: ward
      ? movements.map((m) => ({
          ...m,
          referredUnitIds: m.referredUnitIds.filter((unitId) => unitId === id),
          acceptedUnitId: m.acceptedUnitId === id ? id : undefined,
          referralAnswerHistory: m.referralAnswerHistory?.filter((a) => a.unitId === id),
          withdrawnReferrals: m.withdrawnReferrals.filter((a) => a.unitId === id),
        }))
      : movements,
    referrals: world.referrals
      .filter(
        (r) =>
          referralIds.has(r.id) ||
          r.destinations.some((a) =>
            ward
              ? a.destination.kind === "psychiatric_ward" && (a.destination.unitId === id || a.acceptedUnitId === id)
              : a.destination.kind === "emergency_department" && a.destination.edId === id,
          ),
      )
      .map((r) =>
        ward
          ? {
              ...r,
              destinations: r.destinations.filter(
                (a) =>
                  a.destination.kind === "psychiatric_ward" && (a.destination.unitId === id || a.acceptedUnitId === id),
              ),
            }
          : referralIds.has(r.id)
            ? r
            : {
                ...r,
                destinations: r.destinations.filter(
                  (a) => a.destination.kind === "emergency_department" && a.destination.edId === id,
                ),
              },
      ),
    units: ward ? world.units.filter((u) => u.id === id) : [],
    bedReleases: ward ? world.bedReleases.filter((r) => r.unitId === id) : [],
  };
}

function scopedLookRecords(world: LastLookWorld, scopeKey: string): ScopedLookRecord[] {
  return [
    ...world.referrals.map((r) => {
      const times = [
        r.raisedAt,
        r.inDepartmentAt ?? -1,
        r.triagedAt ?? -1,
        ...r.destinations.flatMap((a) => [
          a.referredAt ?? -1,
          a.decidedAt ?? -1,
          a.withdrawnAt ?? -1,
          a.waitlistedAt ?? -1,
        ]),
      ];
      return {
        kind: "referral" as const,
        id: r.id,
        values: [
          ...r.destinations.flatMap((a) => [
            REFERRAL_ADDRESSING_STATES.indexOf(a.state),
            a.withdrawnAt === undefined ? 0 : 1,
          ]),
          ...times,
        ],
        at: Math.max(...times),
      };
    }),
    ...world.movements.map((m) => {
      const wardId = scopeKey.startsWith("ward:") ? scopeKey.slice(5) : undefined;
      // Historical arms remain so this ward can see its own decline/withdrawal. Once its arm
      // closes, another ward's acceptance, journey stages and transport are outside this scope.
      const active = wardId === undefined || m.acceptedUnitId === wardId || m.referredUnitIds.includes(wardId);
      const t = active ? m.transport : undefined;
      const times = [
        m.openedAt,
        active ? (m.acceptedAt ?? -1) : -1,
        active ? (m.leftDepartmentAt ?? -1) : -1,
        active ? (m.closure?.at ?? -1) : -1,
        active ? (m.referredAt ?? -1) : -1,
        t?.acceptedAt ?? -1,
        t?.enRouteAt ?? -1,
        t?.collectedAt ?? -1,
        t?.arrivedAt ?? -1,
        t?.cancelledAt ?? -1,
        ...(active ? m.stageChanges.map((c) => c.at) : []),
        ...(m.referralAnswerHistory ?? []).map((a) => a.at),
        ...m.withdrawnReferrals.map((a) => a.at),
      ];
      return {
        kind: "movement" as const,
        id: m.id,
        values: [
          active ? MOVEMENT_STAGES.indexOf(m.stage) : -1,
          m.referredUnitIds.length,
          m.acceptedUnitId === undefined ? 0 : 1,
          ...times,
        ],
        at: Math.max(...times),
      };
    }),
    ...world.bedReleases.map((r) => ({
      kind: "release" as const,
      id: r.id,
      values: [BED_RELEASE_STATES.indexOf(r.state), Number(r.preparing), r.confirmedAt],
      at: r.confirmedAt,
    })),
  ];
}

/** Old pictures need recorded timestamps; never guess when an unobserved transition occurred. */
export function scopedChangesSinceLastLook(
  previous: LastLookSnapshot | undefined,
  current: LastLookSnapshot,
  windowMinutes: number,
): ChangesSinceLastLook {
  const valid =
    previous?.version === 3 &&
    previous.scopeKey === current.scopeKey &&
    previous.scenario === current.scenario &&
    previous.worldGeneration === current.worldGeneration &&
    previous.userId === current.userId &&
    previous.at <= current.at;
  const since = Math.max(valid ? previous.at : -Infinity, current.at - windowMinutes);
  const before = new Map((valid ? (previous.records ?? []) : []).map((r) => [`${r.kind}:${r.id}`, r]));
  const updates = (current.records ?? [])
    .filter((r) => {
      const old = before.get(`${r.kind}:${r.id}`);
      if (old && JSON.stringify(old.values) === JSON.stringify(r.values)) return false;
      return (valid && previous.at >= since) || (r.at >= since && r.at <= current.at);
    })
    .map(({ kind, id }) => ({ kind, id }));
  return { since, newReferralIds: [], newMovementIds: [], bedsFreed: [], newDelays: [], newEscalationIds: [], updates };
}
