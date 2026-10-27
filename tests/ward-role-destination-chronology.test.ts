import { describe, expect, it } from "vitest";
import { applyCommand, scopeWorld, seedWorld, validWorld } from "../backend/ward-flow/engine";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { scopeWorkspace } from "../src/components/ward-management/ward-access-scope";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import type { WardAccess } from "../src/components/ward-management/ward-role-access";
import { NOW_ANCHOR, allEmergencyDepartments } from "../src/components/ward-management/ward-sites";
import { communityTeamOptions } from "../src/components/ward-management/referrals/referral-destination-options";
import { STEP_BACK_REASONS } from "../src/components/ward-management/ward-model";

const at = new Date("2026-10-27T02:00:00+08:00");
type World = ReturnType<typeof seedWorld>;
function apply(world: World, command: WardFlowEvent): World {
  const result = applyCommand(world, command, at);
  expect(result.outcome).toBe("accepted");
  expect(validWorld(result.world)).toBe(true);
  return result.world;
}
function fixture() {
  const world = seedWorld(at);
  const a = world.state.units[0];
  const b = world.state.units.find((unit) => unit.siteCode !== a.siteCode)!;
  const origin = allEmergencyDepartments().find((ed) => ed.siteCode !== b.siteCode)!;
  const movement = world.state.movements.find(
    (row) => row.stage === "destination_review" && !row.admissionId && row.patientId !== undefined,
  )!;
  Object.assign(movement, {
    originEdId: origin.id,
    originCommunity: undefined,
    sourceAdmissionId: undefined,
    closure: undefined,
    acceptedUnitId: undefined,
    referredUnitIds: [a.id, b.id],
    declines: [],
    legalForm: undefined,
    legalStatus: "Voluntary",
    transport: undefined,
    stageChanges: [
      { at: NOW_ANCHOR - 5, to: "destination_review", by: "coordinator", reason: "Synthetic common journey note" },
    ],
  });
  // Stored worlds omit absent optional values; exercise the genuine server validation boundary.
  const stored = JSON.parse(JSON.stringify(world)) as World;
  expect(validWorld(stored)).toBe(true);
  return { world: stored, movementId: movement.id, a, b, origin };
}
function decline(world: World, movementId: World["state"]["movements"][number]["id"], unitId: string) {
  return apply(world, {
    type: "DECLINE",
    role: "ward",
    movementId,
    unitId,
    reason: "belongs_to_another_service",
    now: NOW_ANCHOR,
  });
}

describe("destination answer chronology follows the permitted receiving arm", () => {
  it.each(["ward", "bed_manager"] as const)(
    "withholds another ward's real decline and time from a receiving %s",
    (role) => {
      const { world: initial, movementId, a, b } = fixture();
      const world = decline(initial, movementId, a.id);
      const access: WardAccess =
        role === "ward"
          ? { role, scope: { kind: "ward", unitIds: [b.id] } }
          : { role, scope: { kind: "site", siteCode: b.siteCode } };
      const before = JSON.stringify(world);
      const source = world.state.movements.find((row) => row.id === movementId)!;
      expect(source.stageChanges.at(-1)).toMatchObject({ unitId: a.id, reason: "belongs_to_another_service" });
      const workspace = scopeWorkspace(world.state, access, {
        now: NOW_ANCHOR,
        places: wardPlaceLookup(world.state.units),
      });
      const scoped = scopeWorld(world, access, at);
      expect(validWorld(scoped)).toBe(true);
      for (const rows of [workspace.movements, scoped.state.movements]) {
        const copy = rows.find((row) => row.id === movementId)!;
        expect(copy.declines).toEqual([]);
        expect(copy.stageChanges).toEqual(source.stageChanges.slice(0, 1));
      }
      expect(JSON.stringify(world)).toBe(before);
    },
  );

  it("preserves an own identical answer at the same instant using explicit producer provenance", () => {
    const { world: initial, movementId, a, b } = fixture();
    const world = decline(decline(initial, movementId, a.id), movementId, b.id);
    const access: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [b.id] } };
    // Both answers removed pending membership; a patient grant restores the same receiving projection.
    const patientId = world.state.movements.find((row) => row.id === movementId)!.patientId!;
    const scoped = scopeWorld(world, access, at, [{ patientId, until: new Date(at.getTime() + 60_000) }]);
    const source = world.state.movements.find((row) => row.id === movementId)!;
    const copy = scoped.state.movements.find((row) => row.id === movementId)!;
    expect(copy.stageChanges).toEqual([source.stageChanges[0], source.stageChanges[2]]);
    expect(copy.declines.map((row) => row.unitId)).toEqual([b.id]);
    expect(JSON.stringify(copy.stageChanges)).not.toContain(a.id);
  });

  it("withholds legacy hidden answer tuples while retaining common chronology", () => {
    const { world: initial, movementId, a, b } = fixture();
    const world = decline(initial, movementId, a.id);
    const source = world.state.movements.find((row) => row.id === movementId)!;
    delete source.stageChanges.at(-1)!.unitId;
    const scoped = scopeWorld(world, { role: "ward", scope: { kind: "ward", unitIds: [b.id] } }, at);
    expect(scoped.state.movements.find((row) => row.id === movementId)!.stageChanges).toEqual([source.stageChanges[0]]);
  });

  it.each([false, true])("withholds a foreign acceptance-withdrawal copy, including legacy=%s", (legacy) => {
    const { world: initial, movementId, a, b } = fixture();
    const accepted = initial.state.movements.find((row) => row.id === movementId)!;
    Object.assign(accepted, {
      stage: "accepted_awaiting_bed",
      acceptedUnitId: a.id,
      acceptedAt: NOW_ANCHOR - 10,
      referredUnitIds: [],
    });
    const world = apply(initial, {
      type: "WITHDRAW_ACCEPTANCE",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId,
      reason: STEP_BACK_REASONS[0],
    });
    const source = world.state.movements.find((row) => row.id === movementId)!;
    const withdrawn = source.stageChanges.at(-1)!;
    expect(source.unwinds.at(-1)).toMatchObject({ kind: "acceptance_withdrawn", unitId: a.id });
    if (legacy) delete withdrawn.unitId;
    const grant = [{ patientId: source.patientId!, until: new Date(at.getTime() + 60_000) }];
    const copyFor = (unitId: string) =>
      scopeWorld(world, { role: "ward", scope: { kind: "ward", unitIds: [unitId] } }, at, grant).state.movements.find(
        (row) => row.id === movementId,
      )!;
    expect(copyFor(b.id).stageChanges).not.toContainEqual(withdrawn);
    expect(copyFor(b.id).unwinds).toEqual([]);
    expect(copyFor(a.id).stageChanges).toContainEqual(withdrawn);
  });

  it("keeps an own receiving answer for a mixed sending-site desk while hiding another site's answer", () => {
    const { world: initial, movementId, a, b } = fixture();
    const ownEd = allEmergencyDepartments().find((ed) => ed.siteCode === a.siteCode)!;
    initial.state.movements.find((row) => row.id === movementId)!.originEdId = ownEd.id;
    const world = decline(decline(initial, movementId, a.id), movementId, b.id);
    const source = world.state.movements.find((row) => row.id === movementId)!;
    const scoped = scopeWorld(world, { role: "bed_manager", scope: { kind: "site", siteCode: a.siteCode } }, at);
    const copy = scoped.state.movements.find((row) => row.id === movementId)!;
    expect(copy.stageChanges).toContainEqual(source.stageChanges[1]);
    expect(copy.stageChanges).not.toContainEqual(source.stageChanges[2]);
    expect(copy.stageChanges[0]).not.toHaveProperty("reason");
    expect(copy.declines.map((row) => row.unitId)).toEqual([a.id]);
  });
});

describe("community closure reasons follow the actual destination referral", () => {
  function community(reason?: string) {
    const { world: initial, movementId, origin } = fixture();
    const team = communityTeamOptions()[0];
    const world = apply(initial, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: NOW_ANCHOR,
      movementId,
      team,
      ...(reason === undefined ? {} : { reason }),
    });
    const manager: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: origin.siteCode } };
    return { world, movementId, manager, team, origin };
  }

  it.each([undefined, "Synthetic private team contact and destination narrative"])(
    "withholds a pending team's generated or typed closure reason (%s)",
    (reason) => {
      const { world, movementId, manager } = community(reason);
      const source = world.state.movements.find((row) => row.id === movementId)!;
      const before = JSON.stringify(world);
      expect(source.closure!.referralId).toBeDefined();
      const scoped = scopeWorld(world, manager, at);
      expect(validWorld(scoped)).toBe(true);
      const copy = scoped.state.movements.find((row) => row.id === movementId)!;
      expect(copy.closure).toEqual({ at: source.closure!.at, outcome: source.closure!.outcome, reason: "" });
      expect(JSON.stringify(world)).toBe(before);
    },
  );

  it("preserves the originating ED's and coordinator's full closure facts", () => {
    const { world, movementId, origin } = community();
    const original = world.state.movements.find((row) => row.id === movementId)!.closure;
    for (const access of [
      { role: "ed", scope: { kind: "ed", edId: origin.id } },
      { role: "coordinator", scope: { kind: "statewide" } },
    ] as const) {
      expect(scopeWorld(world, access, at).state.movements.find((row) => row.id === movementId)!.closure).toEqual(
        original,
      );
    }
  });

  it("retains the closure reason once its actual community destination is the permitted primary acceptance", () => {
    const { world: initial, movementId, manager } = community();
    const source = initial.state.movements.find((row) => row.id === movementId)!;
    const world = apply(initial, {
      type: "ACCEPT_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      referralId: source.closure!.referralId!,
      destinationKind: "community_team",
    });
    const copy = scopeWorld(world, manager, at).state.movements.find((row) => row.id === movementId)!;
    expect(copy.closure).toEqual(source.closure);
  });

  it("fails closed for a legacy community closure without destination provenance", () => {
    const { world, movementId, manager } = community();
    delete world.state.movements.find((row) => row.id === movementId)!.closure!.referralId;
    const copy = scopeWorld(world, manager, at).state.movements.find((row) => row.id === movementId)!;
    expect(copy.closure!.reason).toBe("");
    expect(copy.closure).not.toHaveProperty("referralId");
  });
});
