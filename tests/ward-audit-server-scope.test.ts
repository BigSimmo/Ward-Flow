import { describe, expect, it } from "vitest";

import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { commandScopeRefusal } from "../src/components/ward-management/ward-access-state";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import type { WardAccess } from "../src/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * Server scope checks added for the 26 Oct full audit (issues 3 and 8): the server refuses what
 * the reducer refuses, so a desk cannot reach another ward's record by naming it in a nested field.
 */

const state = seedWardFlowState();
const places = wardPlaceLookup(state.units);
const options = { now: NOW_ANCHOR, places };
const occupied = state.admissions.find((admission) => admission.patientId !== null && admission.leftAt === null)!;
const ownUnit = occupied.unitId;
const otherUnit = state.units.find((unit) => unit.id !== ownUnit)!.id;
const ward: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [ownUnit] } };

describe("audit 26 Oct server scope", () => {
  it("checks the acting unit named on an observation level's target (issue 3)", () => {
    const command = (actingUnitId: string) => ({
      type: "RECORD_OBSERVATION_LEVEL",
      role: "ward",
      target: { kind: "admission", admissionId: occupied.id, actingUnitId },
    });
    expect(commandScopeRefusal(state, ward, command(ownUnit), options)).toBeNull();
    expect(commandScopeRefusal(state, ward, command(otherUnit), options)).toMatch(/outside your role's place/);
  });

  it("refuses a ward booking transport on a journey it did not send (issue 8)", () => {
    const edStart = state.movements.find(
      (movement) => movement.acceptedUnitId && movement.originEdId !== undefined && !movement.closure,
    )!;
    expect(edStart).toBeDefined();
    const receiving: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [edStart.acceptedUnitId!] } };
    expect(
      commandScopeRefusal(
        state,
        receiving,
        { type: "BOOK_TRANSPORT", role: "ward", movementId: edStart.id, actingUnitId: edStart.acceptedUnitId },
        options,
      ),
    ).toMatch(/outside your role's place/);
  });
});
