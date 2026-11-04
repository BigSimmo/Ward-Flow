import { describe, expect, it } from "vitest";

import {
  applyCommand,
  commandRefusal,
  seedWorld,
  validCommand,
  validWorld,
  type SharedWorld,
} from "../backend/ward-flow/engine";
import type { WardAccess } from "../src/components/ward-management/ward-role-access";

const at = new Date("2026-11-02T00:00:00Z");
const service: WardAccess = { role: "coordinator", scope: { kind: "service", service: "East Metro" } };
const statewide: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };
const ward: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } };
const steps = ["accepted", "handover", "arrived"] as const;

function transfer(world: SharedWorld, receivingUnitId: string, step: (typeof steps)[number], patch: object = {}) {
  const admission = world.state.admissions.find((row) => row.id === "AD-RPHS-01")!;
  return {
    type: "RECORD_ADMISSION_CARE",
    role: "coordinator",
    admissionId: admission.id,
    patientId: admission.patientId,
    expectedGeneration: world.state.worldGeneration,
    expectedRevision: world.state.dischargeRevisions[admission.id] ?? 0,
    change: { kind: "transfer", receivingUnitId, step },
    ...patch,
  };
}

/** Acceptance and handover need the stay's linked placement record (the arrival it came in on). */
function withLinkedPlacement(source: SharedWorld): SharedWorld {
  const world = structuredClone(source);
  const admission = world.state.admissions.find((row) => row.id === "AD-RPHS-01")!;
  const cohort = world.state.units.find((unit) => unit.id === admission.unitId)?.cohort;
  const placement = structuredClone(world.state.movements.find((movement) => movement.cohort === cohort)!);
  placement.id = "WF-SCOPE-PLACEMENT";
  delete placement.referralId;
  delete placement.sourceAdmissionId;
  delete placement.referralSourceAdmissionId;
  placement.patientId = admission.patientId!;
  placement.admissionId = admission.id;
  placement.stage = "arrived";
  placement.acceptedUnitId = admission.unitId;
  placement.closure = { at: admission.arrivedAt!, outcome: "arrived", reason: "Synthetic fixture arrival" };
  admission.movementId = placement.id;
  world.state.movements.push(placement);
  return world;
}

describe("transfer destination authority", () => {
  // These are admission checks. Handover and arrival still need their workflow prerequisites.
  it.each(steps)("refuses a service coordinator's cross-service %s target", (step) => {
    const world = seedWorld(at);
    const command = transfer(world, "scgh-adult-open", step);
    expect(validCommand(command)).toBe(true);
    expect(commandRefusal(world, service, command, at)).toMatch(/outside your role's place/);
  });

  it.each(steps)("keeps the service coordinator's same-service %s authority", (step) => {
    const world = seedWorld(at);
    const command = transfer(world, "arm-adult-open", step);
    expect(validCommand(command)).toBe(true);
    expect(commandRefusal(world, service, command, at)).toBeNull();
  });

  it.each(steps)("keeps the statewide coordinator's cross-service %s authority", (step) => {
    const world = seedWorld(at);
    const command = transfer(world, "scgh-adult-open", step);
    expect(validCommand(command)).toBe(true);
    expect(commandRefusal(world, statewide, command, at)).toBeNull();
  });

  it("allows the sending ward to hand over a transfer already approved statewide", () => {
    const world = withLinkedPlacement(seedWorld(at));
    expect(validWorld(world)).toBe(true);
    const accepted = applyCommand(world, transfer(world, "scgh-adult-open", "accepted"), at);
    expect(accepted.outcome).toBe("accepted");
    expect(validWorld(accepted.world)).toBe(true);
    const command = transfer(accepted.world, "scgh-adult-open", "handover", {
      role: "ward",
      actingUnitId: "rph-adult-secure",
    });
    expect(commandRefusal(accepted.world, ward, command, at)).toBeNull();
    const handedOver = applyCommand(accepted.world, command, at);
    expect(handedOver.outcome).toBe("accepted");
    expect(validWorld(handedOver.world)).toBe(true);
    expect(
      handedOver.world.state.admissions.find((row) => row.id === "AD-RPHS-01")?.careJourney?.transfer,
    ).toMatchObject({
      receivingUnitId: "scgh-adult-open",
      step: "handover",
    });
  });

  const otherDesks: WardAccess[] = [
    ward,
    { role: "ed", scope: { kind: "ed", edId: "rph-ed" } },
    { role: "community", scope: { kind: "team", teamName: "Synthetic team" } },
    { role: "bed_manager", scope: { kind: "site", siteCode: "RPH" } },
    { role: "officer", scope: { kind: "jobs", service: "East Metro" } },
    { role: "executive", scope: { kind: "statewide" } },
    { role: "admin", scope: { kind: "statewide" } },
  ];

  it.each(otherDesks)("does not lend coordinator transfer authority to $role", (access) => {
    const world = seedWorld(at);
    expect(commandRefusal(world, access, transfer(world, "scgh-adult-open", "accepted"), at)).toBeTruthy();
  });

  it("refuses a foreign service coordinator changing the sending admission", () => {
    const world = seedWorld(at);
    const foreign: WardAccess = { role: "coordinator", scope: { kind: "service", service: "North Metro" } };
    expect(commandRefusal(world, foreign, transfer(world, "scgh-adult-open", "accepted"), at)).toMatch(
      /outside your role's place/,
    );
  });
});
