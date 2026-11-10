import { describe, expect, it } from "vitest";

import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { commandScopeRefusal } from "../src/components/ward-management/ward-access-state";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowRole } from "../src/components/ward-management/ward-flow-events";
import type { Movement } from "../src/components/ward-management/ward-model";
import type { WardAccess } from "../src/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * D-128 item 1 (Josh, 10 Nov 2026): only the ward that accepted the person (plus the coordinator,
 * and ED and community as before) records a legal-form continuation. A ward that was only referred
 * the person is refused, in the app and in the server's place check. Synthetic seed data only.
 */
const NOW = NOW_ANCHOR;
const REFUSAL = "Only the ward that accepted this person can record a continuation.";

function acceptedJourney(): { state: WardFlowState; movement: Movement; acceptedUnitId: string; otherUnitId: string } {
  const state = seedWardFlowState();
  const movement = state.movements.find((m) => !m.closure && m.acceptedUnitId !== undefined)!;
  const acceptedUnitId = movement.acceptedUnitId!;
  const otherUnitId = state.units.find((unit) => unit.id !== acceptedUnitId)!.id;
  return { state, movement, acceptedUnitId, otherUnitId };
}

function continuation(movementId: string, role: WardFlowRole, actingUnitId?: string) {
  return {
    type: "RECORD_LEGAL_FORM_CONTINUATION" as const,
    role,
    now: NOW,
    movementId,
    formCode: "3C",
    startedAt: NOW - 30,
    ...(actingUnitId === undefined ? {} : { actingUnitId }),
  };
}

describe("legal-form continuation is the accepting ward's (D-128)", () => {
  it("lets the accepted ward record a continuation", () => {
    const { state, movement, acceptedUnitId } = acceptedJourney();
    const next = wardFlowReducer(state, continuation(movement.id, "ward", acceptedUnitId));
    expect(next.rejections).toHaveLength(state.rejections.length);
    expect(next.movements.find((m) => m.id === movement.id)?.legalForm?.code).toBe("3C");
  });

  it("refuses a ward that did not accept the person", () => {
    const { state, movement, otherUnitId } = acceptedJourney();
    for (const event of [continuation(movement.id, "ward", otherUnitId), continuation(movement.id, "ward")]) {
      const next = wardFlowReducer(state, event);
      expect(next.rejections).toHaveLength(state.rejections.length + 1);
      expect(next.rejections.at(-1)?.reason).toBe(REFUSAL);
    }
  });

  it("refuses a ward on a journey no ward has accepted yet", () => {
    const state = seedWardFlowState();
    const referredOnly = state.movements.find((m) => !m.closure && m.acceptedUnitId === undefined)!;
    const next = wardFlowReducer(state, continuation(referredOnly.id, "ward", state.units[0]!.id));
    expect(next.rejections.at(-1)?.reason).toBe(REFUSAL);
  });

  it("lets the coordinator record a continuation", () => {
    const { state, movement } = acceptedJourney();
    expect(wardFlowReducer(state, continuation(movement.id, "coordinator")).rejections).toHaveLength(
      state.rejections.length,
    );
  });

  it("keeps a community Form 5A to 5B continuation working", () => {
    const seed = seedWardFlowState();
    const journey = seed.movements.find((m) => !m.closure)!;
    const state: WardFlowState = {
      ...seed,
      movements: seed.movements.map((m) =>
        m.id === journey.id ? { ...m, legalForm: { code: "5A", dueAt: NOW + 1000 }, legalClock: undefined } : m,
      ),
    };
    const next = wardFlowReducer(state, { ...continuation(journey.id, "community"), formCode: "5B" });
    expect(next.rejections).toHaveLength(state.rejections.length);
    const after = next.movements.find((m) => m.id === journey.id)!;
    expect(after.legalForm?.code).toBe("5A");
    expect(after.legalForm?.continuedBy?.code).toBe("5B");
  });

  it("refuses a referred-only ward at the server's place check", () => {
    const { state, movement, acceptedUnitId, otherUnitId } = acceptedJourney();
    const options = { now: NOW, places: wardPlaceLookup(state.units) };
    const command = { type: "RECORD_LEGAL_FORM_CONTINUATION", role: "ward", movementId: movement.id, formCode: "3C" };
    const own: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [acceptedUnitId] } };
    const referred: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [otherUnitId] } };
    expect(commandScopeRefusal(state, own, command, options)).toBeNull();
    expect(commandScopeRefusal(state, referred, command, options)).toMatch(/outside your role's place/);
    const notYetAccepted = state.movements.find((m) => !m.closure && m.acceptedUnitId === undefined)!;
    expect(commandScopeRefusal(state, referred, { ...command, movementId: notYetAccepted.id }, options)).toMatch(
      /outside your role's place/,
    );
  });
});
