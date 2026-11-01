import { describe, expect, it } from "vitest";
import { applyCommand, commandRefusal, seedWorld, scopeWorld, type SharedWorld } from "../backend/ward-flow/engine";
import type { WardAccess } from "../src/components/ward-management/ward-role-access";

const at = new Date("2026-10-20T10:00:00Z");
const statewide: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };
const north: WardAccess = { role: "coordinator", scope: { kind: "service", service: "North Metro" } };
const rphManager: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: "RPH" } };
const rphEd: WardAccess = { role: "ed", scope: { kind: "ed", edId: "rph-ed" } };
const fshEd: WardAccess = { role: "ed", scope: { kind: "ed", edId: "fsh-ed" } };
const broadcast = {
  type: "DISPATCH_BROADCAST_ALERT",
  role: "bed_manager",
  now: 642,
  title: "Synthetic capacity request",
  message: "Synthetic capacity request",
  severity: "warning",
  category: "capacity_gridlock",
  targetScope: "all",
  targetScopeLabel: "All",
  durationMinutes: 60,
  kind: "bed_call",
} as const;
const referral = {
  type: "RECEIVE_REFERRAL",
  role: "ed",
  now: 642,
  ageBand: "Adult",
  destinations: [
    {
      kind: "psychiatric_ward",
      sex: "Female",
      gender: "Female",
      secureBedNeeded: false,
      involuntaryBedNeeded: false,
      highAcuityNursingNeeded: false,
    },
  ],
  homeRegion: "Perth Metropolitan",
  suburb: { kind: "named", name: "Armadale" },
  source: "ed_medical",
  urgency: 2,
  originSiteCode: "FSH",
  transportNeeded: false,
  history: "Synthetic referral",
} as const;

function accepted(world: SharedWorld, event: Record<string, unknown>) {
  const result = applyCommand(world, event, at);
  expect(result.outcome, result.reason ?? undefined).toBe("accepted");
  return result.world;
}

describe("audited shared command permission boundaries", () => {
  it("reserves global settings for the statewide coordinator", () => {
    const world = seedWorld(at);
    const event = {
      type: "SET_CONFIGURATION",
      role: "coordinator",
      now: 642,
      payload: { ...world.state.configuration, pullHoldMinutes: 60 },
    };
    expect(commandRefusal(world, north, event, at)).not.toBeNull();
    expect(commandRefusal(world, statewide, event, at)).toBeNull();
    expect(accepted(world, event).state.configuration.pullHoldMinutes).toBe(60);
  });

  it.each(["bed_call", "directive"] as const)("checks every %s recipient before dispatch", (kind) => {
    const world = seedWorld(at);
    const event = { ...broadcast, kind };
    expect(commandRefusal(world, rphManager, event, at)).not.toBeNull();
    expect(commandRefusal(world, north, { ...event, role: "coordinator" }, at)).not.toBeNull();
    expect(commandRefusal(world, statewide, event, at)).toBeNull();
    accepted(world, event);
  });

  it("allows a service coordinator to broadcast wholly within its service", () => {
    const world = seedWorld(at);
    const access: WardAccess = { role: "coordinator", scope: { kind: "service", service: "WACHS" } };
    const event = { ...broadcast, role: "coordinator", targetScope: "regional_wachs" };
    expect(commandRefusal(world, access, event, at)).toBeNull();
    accepted(world, event);
  });

  it.each(["STAND_DOWN_BROADCAST_ALERT", "EXTEND_BROADCAST_ALERT"] as const)(
    "requires authority over the full existing alert for %s",
    (type) => {
      const world = accepted(seedWorld(at), broadcast);
      const event = { type, role: "bed_manager", now: 642, alertId: world.state.broadcastAlerts[0].id };
      expect(commandRefusal(world, rphManager, event, at)).not.toBeNull();
      expect(commandRefusal(world, statewide, event, at)).toBeNull();
      accepted(world, event);
    },
  );

  it("checks every desk added to a live alert as well as the alert itself (Q149)", () => {
    const rph = seedWorld(at)
      .state.units.filter((unit) => unit.siteCode === "RPH")
      .map((unit) => unit.id);
    const elsewhere = seedWorld(at).state.units.find((unit) => unit.siteCode !== "RPH")!.id;
    const world = accepted(seedWorld(at), { ...broadcast, targetUnitIds: [rph[0]] });
    const alertId = world.state.broadcastAlerts[0].id;
    const add = (unitIds: string[]) => ({
      type: "ADD_BROADCAST_ALERT_UNITS",
      role: "bed_manager",
      now: 642,
      alertId,
      unitIds,
    });
    expect(commandRefusal(world, rphManager, add([elsewhere]), at)).not.toBeNull();
    expect(commandRefusal(world, rphManager, add([rph[1]]), at)).toBeNull();
    accepted(world, add([rph[1]]));
  });

  it("does not turn a ward acknowledgement of a global alert into a global edit", () => {
    const world = accepted(seedWorld(at), { ...broadcast, kind: "directive" });
    const unitId = world.state.units.find((unit) => unit.siteCode === "RPH")!.id;
    const ward: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [unitId] } };
    const event = {
      type: "ACKNOWLEDGE_BROADCAST_ALERT",
      role: "ward",
      now: 642,
      alertId: world.state.broadcastAlerts[0].id,
      unitId,
    };
    expect(commandRefusal(world, ward, event, at)).toBeNull();
    accepted(world, event);
  });

  it("binds ED origin to the selected membership while allowing remote destinations", () => {
    const world = seedWorld(at);
    expect(commandRefusal(world, rphEd, referral, at)).not.toBeNull();
    expect(commandRefusal(world, fshEd, referral, at)).toBeNull();
    const result = accepted(world, referral);
    const created = result.state.referrals.at(-1)!;
    expect(scopeWorld(result, fshEd, at).state.referrals.some((row) => row.id === created.id)).toBe(true);
  });

  it.each(["ADD_REFERRAL_CORRECTION", "RECORD_REFERRER_WITHDRAWAL"] as const)(
    "refuses another sender's referral with omitted acting identity: %s",
    (type) => {
      const world = seedWorld(at);
      const event = { type, role: "ed", now: 642, referralId: "RF-014", note: "Synthetic correction" };
      expect(commandRefusal(world, rphEd, event, at)).not.toBeNull();
    },
  );

  it("allows the originating ED to correct with or without an optional acting field", () => {
    const world = accepted(seedWorld(at), referral);
    const event = {
      type: "ADD_REFERRAL_CORRECTION",
      role: "ed",
      now: 642,
      referralId: world.state.referrals.at(-1)!.id,
      note: "Synthetic correction",
    };
    for (const acting of [{}, { actingPlaceId: "fsh-ed" }]) {
      expect(commandRefusal(world, fshEd, { ...event, ...acting }, at)).toBeNull();
      accepted(world, { ...event, ...acting });
    }
    expect(commandRefusal(world, rphEd, event, at)).not.toBeNull();
  });

  it("binds community corrections to the recorded sending team even without actingPlaceId", () => {
    const world = seedWorld(at);
    const row = world.state.referrals.find((item) => item.id === "RF-014")!;
    row.sendingTeamName = "Synthetic originating team";
    const own: WardAccess = { role: "community", scope: { kind: "team", teamName: row.sendingTeamName } };
    const other: WardAccess = { role: "community", scope: { kind: "team", teamName: "Synthetic other team" } };
    row.destinations.push({
      destination: { kind: "community_team", teamName: "Synthetic other team" },
      state: "queued",
    });
    expect(scopeWorld(world, other, at).state.referrals.some((item) => item.id === row.id)).toBe(true);
    const event = {
      type: "ADD_REFERRAL_CORRECTION",
      role: "community",
      now: 642,
      referralId: row.id,
      note: "Synthetic correction",
    };
    expect(commandRefusal(world, own, event, at)).toBeNull();
    accepted(world, event);
    expect(commandRefusal(world, other, event, at)).not.toBeNull();
  });

  it.each(["ADD_REFERRAL_CORRECTION", "RECORD_REFERRER_WITHDRAWAL"] as const)(
    "recognises an abbreviated community sender without giving the recipient sender rights for %s",
    (type) => {
      const world = seedWorld(at);
      const row = world.state.referrals.find((item) => item.id === "RF-014")!;
      row.source = "community";
      row.sendingTeamName = "Midland Community Team";
      row.destinations.push({
        destination: { kind: "community_team", teamName: "Synthetic receiving team" },
        state: "queued",
      });
      const sender: WardAccess = { role: "community", scope: { kind: "team", teamName: "Midland" } };
      const receiver: WardAccess = {
        role: "community",
        scope: { kind: "team", teamName: "Synthetic receiving team" },
      };
      const event = { type, role: "community", now: 642, referralId: row.id, note: "Synthetic correction" };
      expect(scopeWorld(world, sender, at).state.referrals.some((item) => item.id === row.id)).toBe(true);
      expect(scopeWorld(world, receiver, at).state.referrals.some((item) => item.id === row.id)).toBe(true);
      expect(commandRefusal(world, sender, event, at)).toBeNull();
      expect(commandRefusal(world, receiver, event, at)).not.toBeNull();
    },
  );

  it.each(["ADD_REFERRAL_CORRECTION", "RECORD_REFERRER_WITHDRAWAL"] as const)(
    "never treats a community team named on an ED referral as its sender for %s",
    (type) => {
      const world = seedWorld(at);
      const row = world.state.referrals.find((item) => item.id === "RF-014")!;
      row.source = "ed_medical";
      row.sendingTeamName = "Synthetic receiving team";
      row.destinations.push({
        destination: { kind: "community_team", teamName: "Synthetic receiving team" },
        state: "queued",
      });
      const receiver: WardAccess = {
        role: "community",
        scope: { kind: "team", teamName: "Synthetic receiving team" },
      };
      const event = { type, role: "community", now: 642, referralId: row.id, note: "Synthetic correction" };
      expect(scopeWorld(world, receiver, at).state.referrals.some((item) => item.id === row.id)).toBe(true);
      expect(commandRefusal(world, receiver, event, at)).not.toBeNull();
    },
  );

  it("does not let a receiving community team assess the sending team's transport need", () => {
    const world = seedWorld(at);
    const movement = world.state.movements.find((row) => !row.closure && row.referralId)!;
    const row = world.state.referrals.find((item) => item.id === movement.referralId)!;
    row.source = "community";
    row.sendingTeamName = "Synthetic originating team";
    row.destinations.push({
      destination: { kind: "community_team", teamName: "Synthetic other team" },
      state: "queued",
    });
    const own: WardAccess = { role: "community", scope: { kind: "team", teamName: row.sendingTeamName } };
    const other: WardAccess = { role: "community", scope: { kind: "team", teamName: "Synthetic other team" } };
    const event = { type: "RECORD_TRANSPORT_NEED", role: "community", now: 642, movementId: movement.id, needed: true };
    expect(scopeWorld(world, other, at).state.movements.some((item) => item.id === movement.id)).toBe(true);
    expect(commandRefusal(world, own, event, at)).toBeNull();
    accepted(world, event);
    expect(commandRefusal(world, other, event, at)).not.toBeNull();
  });

  it("allows a sending ward's transport assessment without requiring a redundant acting field", () => {
    const world = seedWorld(at);
    const movement = world.state.movements.find((row) => row.id === "WF-004")!;
    const admission = world.state.admissions.find((row) => row.patientId && row.unitId !== movement.acceptedUnitId)!;
    movement.sourceAdmissionId = admission.id;
    const ward: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [admission.unitId] } };
    const event = { type: "RECORD_TRANSPORT_NEED", role: "ward", now: 642, movementId: movement.id, needed: true };
    expect(commandRefusal(world, ward, event, at)).toBeNull();
    accepted(world, event);
  });

  it("refuses a receiving ward's transport assessment even without actingUnitId", () => {
    const world = seedWorld(at);
    const movement = world.state.movements.find((row) => row.id === "WF-004")!;
    const receiving: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [movement.acceptedUnitId!] } };
    const event = { type: "RECORD_TRANSPORT_NEED", role: "ward", now: 642, movementId: movement.id, needed: false };
    expect(commandRefusal(world, receiving, event, at)).not.toBeNull();
    expect(commandRefusal(world, statewide, event, at)).toBeNull();
  });

  it("allows only the originating ED to assess transport without an acting field", () => {
    const world = seedWorld(at);
    const movement = world.state.movements.find((row) => !row.closure && row.originEdId === "rph-ed")!;
    const event = { type: "RECORD_TRANSPORT_NEED", role: "ed", now: 642, movementId: movement.id, needed: true };
    expect(commandRefusal(world, rphEd, event, at)).toBeNull();
    accepted(world, event);
    expect(commandRefusal(world, fshEd, event, at)).not.toBeNull();
  });
});
