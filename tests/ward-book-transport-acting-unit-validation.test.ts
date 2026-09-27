import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { TRANSPORT_PROVIDERS } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";

/*
 * Opus adversarial review, 2026-09-17, P2 finding 1: `case "BOOK_TRANSPORT"` (`ward-flow-reducer.ts`)
 * only checked that a `ward` booker's `actingUnitId` was PRESENT, never that it named a real unit.
 * `bookedBy.unitId` is later compared against a `ward` canceller's own claim
 * (`CANCEL_TRANSPORT`'s own comment, WLQ-11), so an invented unit id would be stored as though it
 * named a real ward and could never be matched against anything real.
 *
 * This file is deliberately separate from `tests/ward-book-transport.test.ts` to avoid touching a
 * shared file another agent may be editing in the same review round (`DECLINE_REFERRAL`'s own fix
 * round).
 */
const NOW = NOW_ANCHOR;

function heldBedMovement() {
  const state = seedWardFlowState();
  const movement = state.movements.find((candidate) => candidate.stage === "pulled");
  expect(movement, "the fixture must hold a movement with a bed held, or nothing here is exercised").toBeDefined();
  return { state, movementId: movement!.id };
}

function book(overrides: Record<string, unknown> = {}) {
  const { state, movementId } = heldBedMovement();
  return wardFlowReducer(state, {
    type: "BOOK_TRANSPORT",
    role: "ed",
    now: NOW,
    movementId,
    provider: TRANSPORT_PROVIDERS[0],
    escortRequired: true,
    cadNumber: "CAD-2026-0001",
    transportLegalStatus: "voluntary",
    estimatedAt: NOW + 30,
    ...overrides,
  } as never);
}

describe("BOOK_TRANSPORT actingUnitId validation", () => {
  it("a real unit id is not itself in question — the fixture must carry rph-adult-secure or nothing below is exercised", () => {
    const { state } = heldBedMovement();
    expect(state.units.some((unit) => unit.id === "rph-adult-secure")).toBe(true);
    expect(state.units.some((unit) => unit.id === "not-a-real-unit-id")).toBe(false);
  });

  it("still accepts a ward booking whose actingUnitId names a real unit", () => {
    const state = book({ role: "ward", actingUnitId: "rph-adult-secure" });
    expect(state.rejections).toEqual([]);
  });

  it("🔴 REFUSES A WARD BOOKING WHOSE actingUnitId NAMES NO REAL UNIT", () => {
    const { movementId } = heldBedMovement();
    const state = book({ role: "ward", actingUnitId: "not-a-real-unit-id" });
    expect(state.rejections.length).toBe(1);
    expect(state.rejections[0]!.reason).toContain("actingUnitId");
    expect(
      state.movements.find((candidate) => candidate.id === movementId)!.transport,
      "a refused booking must leave the movement with no transport at all",
    ).toBeUndefined();
  });

  it("does not apply the unit-existence check to an ED or community booker, which carry no actingUnitId at all", () => {
    const state = book({ role: "ed" });
    expect(state.rejections).toEqual([]);
    // A `community` booker has its OWN identity check now (`actingPlaceId`, owner's third ruling,
    // 2026-09-17) — this asserts only that the `actingUnitId` check above does not fire for it.
    const community = book({ role: "community", actingPlaceId: COMMUNITY_TEAM_PAGES[0]!.id });
    expect(community.rejections).toEqual([]);
  });
});
