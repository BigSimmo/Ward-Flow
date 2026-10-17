import { describe, expect, it } from "vitest";

import {
  changesSinceLastLook,
  scopedChangesSinceLastLook,
  scopeLastLookWorld,
  hasAnyChange,
  parseLastLookSnapshot,
  takeLastLookSnapshot,
  type LastLookWorld,
} from "@/components/ward-management/coordinator/since-last-look";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
const NOW = NOW_ANCHOR;

function seededWorld(): LastLookWorld {
  const state = seedWardFlowState();
  return {
    scenario: state.scenario,
    referrals: state.referrals,
    movements: state.movements,
    units: state.units,
    bedReleases: state.bedReleases,
  };
}

describe("what changed since you last looked", () => {
  it("reports nothing when the world is unchanged", () => {
    const world = seededWorld();
    const before = takeLastLookSnapshot(world, NOW, DEFAULT_DUE_SOON_THRESHOLDS);
    const after = takeLastLookSnapshot(world, NOW, DEFAULT_DUE_SOON_THRESHOLDS);
    const changes = changesSinceLastLook(before, after, world);
    expect(changes).toBeDefined();
    expect(hasAnyChange(changes!)).toBe(false);
    expect(changes!.since).toBe(NOW);
  });

  it("has nothing to compare on a first look or after a scenario switch", () => {
    const world = seededWorld();
    const now = takeLastLookSnapshot(world, NOW, DEFAULT_DUE_SOON_THRESHOLDS);
    expect(changesSinceLastLook(undefined, now, world)).toBeUndefined();
    expect(changesSinceLastLook({ ...now, scenario: "other" }, now, world)).toBeUndefined();
  });

  it("lists a new referral, a newly ready bed and a new escalation", () => {
    const world = seededWorld();
    const before = takeLastLookSnapshot(world, NOW, DEFAULT_DUE_SOON_THRESHOLDS);

    const unit = world.units[0]!;
    const escalated = world.movements.find((movement) => isOpen(movement) && !movement.escalation)!;
    const later: LastLookWorld = {
      ...world,
      referrals: [...world.referrals, { ...world.referrals[0]!, id: "RF-NEW" }],
      units: world.units.map((candidate) =>
        candidate.id === unit.id
          ? {
              ...candidate,
              beds: candidate.beds + 1,
              empty: { ...candidate.empty, value: candidate.empty.value + 1 },
              allocatable: {
                ...candidate.allocatable,
                value: Math.min(candidate.allocatable.value, candidate.empty.value) + 1,
              },
            }
          : candidate,
      ),
      movements: world.movements.map((movement) =>
        movement.id === escalated.id
          ? { ...movement, escalation: { at: NOW + 30, triedUnitIds: [], contact: "" } }
          : movement,
      ),
    };
    const after = takeLastLookSnapshot(later, NOW + 30, DEFAULT_DUE_SOON_THRESHOLDS);
    const changes = changesSinceLastLook(before, after, later)!;

    expect(changes.newReferralIds).toEqual(["RF-NEW"]);
    expect(changes.bedsFreed).toEqual([{ unitId: unit.id, unitName: unit.name, count: 1 }]);
    expect(changes.newEscalationIds).toEqual([escalated.id]);
    expect(hasAnyChange(changes)).toBe(true);
  });

  it("counts a delay as new when a movement enters a delay group it was not in", () => {
    const world = seededWorld();
    const after = takeLastLookSnapshot(world, NOW, DEFAULT_DUE_SOON_THRESHOLDS);
    const [firstKey] = after.delayKeys;
    expect(firstKey).toBeDefined();
    const before = { ...after, delayKeys: after.delayKeys.filter((key) => key !== firstKey) };
    const changes = changesSinceLastLook(before, after, world)!;
    expect(changes.newDelays).toHaveLength(1);
    expect(changes.newDelays[0]!.movementId).toBe(firstKey!.slice(0, firstKey!.lastIndexOf(":")));
    expect(changes.newDelays[0]!.title).not.toBe("Delayed");
  });

  it("does not report fewer ready beds as beds freed", () => {
    const world = seededWorld();
    const after = takeLastLookSnapshot(world, NOW, DEFAULT_DUE_SOON_THRESHOLDS);
    const unitId = Object.keys(after.readyByUnit)[0]!;
    const before = { ...after, readyByUnit: { ...after.readyByUnit, [unitId]: after.readyByUnit[unitId]! + 2 } };
    expect(changesSinceLastLook(before, after, world)!.bedsFreed).toEqual([]);
  });

  it("stores ids, counts and one instant only, and rejects anything malformed", () => {
    const snapshot = takeLastLookSnapshot(seededWorld(), NOW, DEFAULT_DUE_SOON_THRESHOLDS);
    expect(Object.keys(snapshot).sort()).toEqual(
      [
        "at",
        "delayKeys",
        "escalatedMovementIds",
        "movementIds",
        "readyByUnit",
        "referralIds",
        "scenario",
        "version",
        "worldGeneration",
        "userId",
      ].sort(),
    );
    expect(parseLastLookSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(parseLastLookSnapshot(null)).toBeUndefined();
    expect(parseLastLookSnapshot("not json")).toBeUndefined();
    expect(parseLastLookSnapshot(JSON.stringify({ ...snapshot, version: 1 }))).toBeUndefined();
    expect(parseLastLookSnapshot(JSON.stringify({ ...snapshot, referralIds: [1] }))).toBeUndefined();
    // A stored time that JSON overflows to Infinity would render as NaN:NaN.
    expect(
      parseLastLookSnapshot(JSON.stringify({ ...snapshot, at: 0 }).replace('"at":0', '"at":1e400')),
    ).toBeUndefined();
    // Malformed stored ready counts must not surface as fractional, negative or infinite beds freed.
    for (const bad of [-1, 1.5, "1e400"]) {
      const raw = JSON.stringify({ ...snapshot, readyByUnit: { u1: 0 } }).replace('"u1":0', `"u1":${bad}`);
      expect(parseLastLookSnapshot(raw), `ready count ${bad}`).toBeUndefined();
    }
    // An array (even an empty one) is not a map of ready counts by unit.
    expect(parseLastLookSnapshot(JSON.stringify({ ...snapshot, readyByUnit: [] }))).toBeUndefined();
  });
});

describe("last-look world and account fences", () => {
  it.each([
    { worldGeneration: 2, userId: "account-one", at: NOW },
    { worldGeneration: 1, userId: "account-two", at: NOW },
    { worldGeneration: 1, userId: "account-one", at: NOW - 1 },
  ])("starts fresh after generation, account or clock changes: %j", (next) => {
    const world = { ...seededWorld(), worldGeneration: 1, userId: "account-one" };
    const before = takeLastLookSnapshot(world, NOW, DEFAULT_DUE_SOON_THRESHOLDS);
    const after = takeLastLookSnapshot({ ...world, ...next }, next.at, DEFAULT_DUE_SOON_THRESHOLDS);
    expect(changesSinceLastLook(before, after, world)).toBeUndefined();
  });
});

describe("scoped fifteen-minute deltas", () => {
  it("detects status changes on existing movement IDs and isolates units", () => {
    const world = seededWorld();
    const movement = world.movements[0]!;
    const unitId = world.units[0]!.id;
    const beforeWorld = {
      ...world,
      movements: [{ ...movement, acceptedUnitId: unitId, stage: "accepted_awaiting_bed" as const }],
    };
    const scoped = scopeLastLookWorld(beforeWorld, `ward:${unitId}`);
    const before = takeLastLookSnapshot(scoped, NOW - 5, DEFAULT_DUE_SOON_THRESHOLDS, `ward:${unitId}`);
    const later = {
      ...scoped,
      movements: [
        {
          ...scoped.movements[0]!,
          stage: "arrived" as const,
          closure: { at: NOW, outcome: "arrived" as const, reason: "" },
        },
      ],
    };
    const after = takeLastLookSnapshot(later, NOW, DEFAULT_DUE_SOON_THRESHOLDS, `ward:${unitId}`);
    expect(scopedChangesSinceLastLook(before, after, 15).updates).toEqual([{ kind: "movement", id: movement.id }]);
    expect(scopeLastLookWorld(beforeWorld, "ward:unrelated").movements).toEqual([]);
  });

  it("uses the actual fifteen-minute boundary and never dates an unknown old transition", () => {
    const world = scopeLastLookWorld(seededWorld(), "ed:unrelated");
    const before = takeLastLookSnapshot(world, NOW - 60, DEFAULT_DUE_SOON_THRESHOLDS, "ed:unrelated");
    const after = {
      ...before,
      at: NOW,
      records: [{ kind: "movement" as const, id: "WF-SYNTHETIC", values: [1], at: NOW - 16 }],
    };
    expect(scopedChangesSinceLastLook(before, after, 15)).toMatchObject({ since: NOW - 15, updates: [] });
    after.records[0]!.at = NOW - 15;
    expect(scopedChangesSinceLastLook(before, after, 15).updates).toHaveLength(1);
    expect(scopedChangesSinceLastLook(undefined, after, 15).since).toBe(NOW - 15);
  });

  it("rejects malformed scoped records and starts fresh across world/account changes", () => {
    const before = takeLastLookSnapshot(seededWorld(), NOW - 5, DEFAULT_DUE_SOON_THRESHOLDS, "ward:synthetic");
    expect(
      parseLastLookSnapshot(JSON.stringify({ ...before, records: [{ kind: "note", values: ["typed"] }] })),
    ).toBeUndefined();
    const after = { ...before, userId: "another-account", at: NOW };
    expect(scopedChangesSinceLastLook(before, after, 15).since).toBe(NOW - 15);
    expect(scopedChangesSinceLastLook({ ...before, worldGeneration: 99 }, after, 15).since).toBe(NOW - 15);
  });
});

it("keeps another ward's answer on a shared referral outside this ward's delta", () => {
  const world = seededWorld();
  const ownId = world.units[0]!.id;
  const otherId = world.units[1]!.id;
  const source = world.referrals.find((r) => r.destinations.some((a) => a.destination.kind === "psychiatric_ward"))!;
  const addressing = source.destinations.find((a) => a.destination.kind === "psychiatric_ward")!;
  const own = { ...addressing, destination: { ...addressing.destination, unitId: ownId }, state: "queued" as const };
  const other = { ...own, destination: { ...own.destination, unitId: otherId } };
  const beforeWorld = { ...world, movements: [], referrals: [{ ...source, destinations: [own, other] }] };
  const before = takeLastLookSnapshot(
    scopeLastLookWorld(beforeWorld, `ward:${ownId}`),
    NOW - 5,
    DEFAULT_DUE_SOON_THRESHOLDS,
    `ward:${ownId}`,
  );
  const later = {
    ...beforeWorld,
    referrals: [{ ...source, destinations: [own, { ...other, state: "declined" as const, decidedAt: NOW }] }],
  };
  const after = takeLastLookSnapshot(
    scopeLastLookWorld(later, `ward:${ownId}`),
    NOW,
    DEFAULT_DUE_SOON_THRESHOLDS,
    `ward:${ownId}`,
  );
  expect(scopedChangesSinceLastLook(before, after, 15).updates).toEqual([]);
});

it("scopes ED referrals by explicit address or linked sender department, never a site code", () => {
  const world = seededWorld();
  const movement = world.movements[0]!;
  const referral = world.referrals[0]!;
  const edId = movement.originEdId;
  const addressed = {
    ...referral,
    id: "RF-SYNTHETIC-ED",
    destinations: [
      {
        destination: { kind: "emergency_department" as const, edId, purpose: "psychiatric_review" as const },
        state: "queued" as const,
      },
    ],
  };
  const linked = { ...referral, id: "RF-SYNTHETIC-SENDER" };
  const scoped = scopeLastLookWorld(
    { ...world, movements: [{ ...movement, referralId: linked.id }], referrals: [addressed, linked] },
    `ed:${edId}`,
  );
  expect(scoped.referrals.map((r) => r.id)).toEqual([addressed.id, linked.id]);
  const unrelated = scopeLastLookWorld({ ...world, movements: [], referrals: [linked] }, `ed:${edId}`);
  expect(unrelated.referrals).toEqual([]);
});
