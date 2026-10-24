import { describe, expect, it } from "vitest";

import {
  PUSH_ROLES,
  actNowAlerts,
  scopedActNowAlerts,
  seedWorld,
  worldNow,
  type SharedWorld,
} from "../backend/ward-flow/engine";
import { ROLE_SCREENS, type WardAccess } from "../src/components/ward-management/ward-role-access";
import { ROLE_ALERT_WINDOW_MINUTES } from "../src/components/ward-management/ward-role-alerts";

/** D-80: phone alerts for transport officers (their jobs) and community teams (their updates). */
const at = new Date("2026-10-24T02:00:00Z");
const world = seedWorld(at);
const now = worldNow(world, at);
const TEAM = "Midland Community Team";
const officer: WardAccess = { role: "officer", scope: { kind: "jobs" } };
const team: WardAccess = { role: "community", scope: { kind: "team", teamName: TEAM } };
const coordinator: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };
const ids = (alerts: readonly { id: string }[]) => alerts.map((alert) => alert.id);

/** A catchment client admitted half an hour ago, and the team's own referral answered just now. */
function withTeamUpdates(base: SharedWorld): SharedWorld {
  const client = base.state.patients.find((patient) => patient.catchmentCommunityTeam === TEAM)!;
  const [stay] = base.state.admissions;
  const referral = base.state.referrals.find((candidate) => candidate.source === "community")!;
  return {
    ...base,
    state: {
      ...base.state,
      admissions: base.state.admissions.map((admission) =>
        admission.id === stay.id
          ? { ...admission, patientId: client.id, state: "occupied", arrivedAt: now - 30, leftAt: null }
          : admission,
      ),
      referrals: base.state.referrals.map((candidate) =>
        candidate.id === referral.id
          ? {
              ...candidate,
              sendingTeamName: TEAM,
              destinations: candidate.destinations.map((line) => ({
                ...line,
                state: "declined" as const,
                decidedAt: now - 5,
              })),
            }
          : candidate,
      ),
    } as SharedWorld["state"],
  };
}

describe("phone alerts for officers and community teams (D-80)", () => {
  it("lets officers and community teams hear alerts, and gives the team a Movements screen", () => {
    expect(PUSH_ROLES).toEqual(expect.arrayContaining(["officer", "community"]));
    expect(ROLE_SCREENS.community.movements).toBe("own");
  });

  it("gives an officer one alert per open job and no act-now rows", () => {
    const heard = scopedActNowAlerts(world, officer, at);
    expect(heard.length).toBeGreaterThan(0);
    expect(heard.every((alert) => alert.kind === "job")).toBe(true);
    const open = world.state.movements.filter(
      (movement) =>
        movement.transport !== undefined &&
        movement.transport.arrivedAt === undefined &&
        movement.closure === undefined,
    );
    expect(heard.map((alert) => alert.id.split(":")[1]).sort()).toEqual(open.map((movement) => movement.id).sort());
    // Delivery only sends an id the whole workspace still holds.
    const whole = new Set(ids(actNowAlerts(world, at)));
    expect(ids(heard).every((id) => whole.has(id))).toBe(true);
  });

  it("announces a changed booking as a new job alert and leaves an unchanged one alone", () => {
    const job = world.state.movements.find(
      (movement) => movement.transport !== undefined && movement.closure === undefined,
    )!;
    const before = ids(scopedActNowAlerts(world, officer, at));
    expect(ids(scopedActNowAlerts(structuredClone(world), officer, at))).toEqual(before);
    const changed: SharedWorld = {
      ...world,
      state: {
        ...world.state,
        movements: world.state.movements.map((movement) =>
          movement.id === job.id
            ? {
                ...movement,
                transport: { ...movement.transport!, escortRequired: !movement.transport!.escortRequired },
              }
            : movement,
        ),
      },
    };
    const after = ids(scopedActNowAlerts(changed, officer, at));
    const fresh = after.filter((id) => !before.includes(id));
    expect(fresh).toHaveLength(1);
    expect(fresh[0].startsWith(`job:${job.id}:`)).toBe(true);
  });

  it("tells a community team its referral was answered and its client admitted, inside the window only", () => {
    const updated = withTeamUpdates(world);
    const heard = scopedActNowAlerts(updated, team, at);
    expect(heard.every((alert) => alert.kind === "community")).toBe(true);
    expect(ids(heard).some((id) => id.startsWith("answered:"))).toBe(true);
    expect(ids(heard).some((id) => id.startsWith("admitted:"))).toBe(true);
    const whole = new Set(ids(actNowAlerts(updated, at)));
    expect(ids(heard).every((id) => whole.has(id))).toBe(true);
    // Another team hears none of it.
    const other: WardAccess = { role: "community", scope: { kind: "team", teamName: "Bentley Community Team" } };
    const otherIds = new Set(ids(scopedActNowAlerts(updated, other, at)));
    expect(
      ids(heard)
        .filter((id) => id.startsWith("answered:"))
        .some((id) => otherIds.has(id)),
    ).toBe(false);
    // After the window the updates leave, so nothing is announced late.
    const later = new Date(at.getTime() + (ROLE_ALERT_WINDOW_MINUTES + 1) * 60_000);
    expect(ids(scopedActNowAlerts(updated, team, later)).filter((id) => ids(heard).includes(id))).toEqual([]);
  });

  it("keeps jobs and team updates from the coordinator and place desks", () => {
    const updated = withTeamUpdates(world);
    expect(scopedActNowAlerts(updated, coordinator, at).every((alert) => alert.kind === "act-now")).toBe(true);
    const unit = updated.state.units[0];
    const ward: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [unit.id] } };
    expect(scopedActNowAlerts(updated, ward, at).every((alert) => alert.kind === "act-now")).toBe(true);
  });
});
