import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { movementUmrn, withUmrnInPlaceOfMovementIds } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// D-39 (Josh, 9 October 2026): a patient is shown by UMRN, never by the WF journey number.
describe("UMRN in place of a WF journey number", () => {
  const state = seedWardFlowState();
  const linked = state.movements.find((movement) => movementUmrn(movement, state) !== "UMRN not recorded")!;

  it("names a linked journey by its patient's synthetic UMRN", () => {
    expect(linked).toBeDefined();
    expect(movementUmrn(linked, state)).toMatch(/^UM\d{6}$/);
    expect(movementUmrn(linked.id, state)).toBe(movementUmrn(linked, state));
  });

  it("says UMRN not recorded rather than guessing for an unknown journey", () => {
    expect(movementUmrn("WF-NOT-A-JOURNEY", state)).toBe("UMRN not recorded");
    expect(movementUmrn(undefined, state)).toBe("UMRN not recorded");
  });

  it("swaps every known journey id in prose and leaves everything else alone", () => {
    const umrn = movementUmrn(linked, state);
    expect(withUmrnInPlaceOfMovementIds(`Transport for ${linked.id} was cancelled.`, state)).toBe(
      `Transport for ${umrn} was cancelled.`,
    );
    // An unknown journey never shows its WF number either.
    expect(withUmrnInPlaceOfMovementIds("no movement found for id WF-NOPE", state)).toBe(
      "no movement found for id UMRN not recorded",
    );
    // A ward screen passes the provider's identity projection instead of the records.
    expect(withUmrnInPlaceOfMovementIds(`Bed for ${linked.id}.`, () => "UM123456")).toBe("Bed for UM123456.");
    // A patient id that happens to contain a journey number is not a journey id.
    expect(withUmrnInPlaceOfMovementIds(`PT-G-${linked.id}`, state)).toBe(`PT-G-${linked.id}`);
  });

  it("raises refusals that name the UMRN, not the WF number", () => {
    const after = wardFlowReducer(state, {
      type: "TRANSPORT_EN_ROUTE",
      role: "officer",
      now: NOW_ANCHOR + 1,
      movementId: linked.id,
    });
    const raised = after.rejections.slice(state.rejections.length);
    expect(raised.length, "pick a journey this step refuses").toBeGreaterThan(0);
    for (const rejection of raised) {
      expect(rejection.reason).not.toContain(linked.id);
    }
  });
});
