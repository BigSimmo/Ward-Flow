import { describe, expect, it } from "vitest";
import type { Movement } from "@/components/ward-management/ward-model";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { matchesSetting } from "@/components/ward-management/search/search-filters";
import {
  movementOriginService,
  movementSearchState,
  referralOriginService,
} from "@/components/ward-management/search/search-operational-state";

const seed = seedWardFlowState();
const booked = seed.movements.find(
  (m) => m.transport && m.transport.collectedAt === undefined && m.stage === "handover_ready",
)!;
const result = (movement: Movement) => ({ kind: "movement" as const, movement });

describe("search operational projections and location filters", () => {
  it("reads configured services and represents an unknown source without guessing", () => {
    expect(movementOriginService({ ...booked, originEdId: "jhc-ed" })).toBe("North Metro");
    expect(referralOriginService("JHC")).toBe("North Metro");
    expect(movementOriginService({ ...booked, originEdId: "unknown" })).toBe("Service not recorded");
    expect(referralOriginService("unknown")).toBe("Service not recorded");
    expect(matchesSetting(result({ ...booked, originEdId: "unknown" }), "ed")).toBe(false);
  });

  it.each([undefined, 0])("a requested/accepted vehicle is not physical transit (acceptedAt=%s)", (acceptedAt) => {
    const movement = {
      ...booked,
      transport: { ...booked.transport!, acceptedAt, enRouteAt: undefined, collectedAt: undefined },
    };
    expect(matchesSetting(result(movement), "transit")).toBe(false);
    expect(matchesSetting(result(movement), "ed")).toBe(true);
    expect(movementSearchState(movement).transportStatus).toContain(
      acceptedAt === undefined ? "requested" : "accepted, awaiting departure",
    );
  });

  it("a vehicle en route to collection still leaves the patient in their origin", () => {
    const movement = { ...booked, transport: { ...booked.transport!, enRouteAt: 0, collectedAt: undefined } };
    expect(matchesSetting(result(movement), "transit")).toBe(false);
    expect(matchesSetting(result(movement), "ed")).toBe(true);
    expect(movementSearchState(movement).transportStatus).toBe("En route");
  });

  it("collection at zero remains transit after a stage correction", () => {
    const movement: Movement = {
      ...booked,
      stage: "accepted_awaiting_bed",
      transport: { ...booked.transport!, collectedAt: 0 },
    };
    expect(matchesSetting(result(movement), "transit")).toBe(true);
    expect(matchesSetting(result(movement), "ed")).toBe(false);
    expect(movementSearchState(movement).transportStatus).toBe("Collected");
  });

  it("acceptance without a pull neither holds a bed nor puts the patient in a ward", () => {
    const movement: Movement = {
      ...booked,
      stage: "accepted_awaiting_bed",
      admissionId: undefined,
      transport: undefined,
    };
    expect(movementSearchState(movement).hasBedHold).toBe(false);
    expect(movementSearchState(movement).holdStatus).toBe("Accepted, awaiting bed");
    expect(matchesSetting(result(movement), "inpatient")).toBe(false);
    expect(matchesSetting(result(movement), "ed")).toBe(true);
  });

  it("a real retained pulled admission survives stage correction while the patient remains in ED", () => {
    const admission = {
      ...seed.admissions[0],
      id: "SYN-SEARCH-HOLD",
      state: "pulled" as const,
      movementId: booked.id,
      patientId: booked.patientId ?? null,
      unitId: booked.acceptedUnitId!,
    };
    const movement: Movement = {
      ...booked,
      stage: "accepted_awaiting_bed",
      transport: undefined,
      admissionId: admission.id,
    };
    expect(movementSearchState(movement, [admission]).hasBedHold).toBe(true);
    expect(matchesSetting(result(movement), "ed", [admission])).toBe(true);
    expect(matchesSetting(result(movement), "inpatient", [admission])).toBe(false);
    expect(movementSearchState(movement, [{ ...admission, state: "departed" }]).hasBedHold).toBe(false);
    expect(movementSearchState(movement, [{ ...admission, movementId: "WF-other" }]).hasBedHold).toBe(false);
  });

  it("preserves WF-318's valid authored null-backpointer hold without widening runtime joins", () => {
    const movement = seed.movements.find((m) => m.id === "WF-318")!;
    const admission = seed.admissions.find((a) => a.id === movement.admissionId)!;
    expect(admission.state).toBe("pulled");
    expect(admission.movementId).toBeNull();
    expect(admission.patientId).toBe(movement.patientId);
    expect(movementSearchState(movement, seed.admissions).hasBedHold).toBe(true);
    expect(movementSearchState(movement, seed.admissions).holdStatus).toBe("Bed hold active");
    expect(
      movementSearchState({ ...movement, admissionId: "AD-ARR-01" }, [{ ...admission, id: "AD-ARR-01" }]).hasBedHold,
    ).toBe(false);
    expect(movementSearchState(movement, [{ ...admission, patientId: "PT-other" }]).hasBedHold).toBe(false);
    expect(movementSearchState(movement, [{ ...admission, unitId: "other" }]).hasBedHold).toBe(false);
  });

  it("an actual sending stay is inpatient until collection, then becomes transit", () => {
    const admission = { ...seed.admissions[0], state: "occupied" as const };
    const movement: Movement = { ...booked, transport: undefined, sourceAdmissionId: admission.id };
    expect(matchesSetting(result(movement), "inpatient", [admission])).toBe(true);
    expect(matchesSetting(result(movement), "ed", [admission])).toBe(false);
    expect(matchesSetting(result({ ...movement, stage: "moving" }), "transit", [admission])).toBe(true);
  });

  it("uses existing cancellation and transport-need records rather than a dispatch claim", () => {
    expect(
      movementSearchState({ ...booked, transport: { ...booked.transport!, cancelledAt: 0 } }).transportStatus,
    ).toBe("Cancelled");
    expect(
      movementSearchState({ ...booked, transport: undefined, transportNeed: { needed: false, at: 0 } }).transportStatus,
    ).toBe("Not required");
  });

  it("a stopped collected journey has no verified onward location and does not reappear in ED", () => {
    const movement = { ...booked, transport: { ...booked.transport!, collectedAt: 0, stoppedAt: 1, cancelledAt: 1 } };
    expect(movementSearchState(movement).transportStatus).toBe("Stopped after collection");
    expect(matchesSetting(result(movement), "ed")).toBe(false);
    expect(matchesSetting(result(movement), "transit")).toBe(false);
  });
});
