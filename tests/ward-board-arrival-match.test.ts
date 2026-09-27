import { describe, expect, it } from "vitest";

import { movementForBoardArrival } from "@/components/ward-management/board/ward-board";

/**
 * Board "Patient arrived" must resolve a movement by identity only.
 *
 * The old unit-wide `acceptedUnitId === unit.id` fallback marked the wrong person
 * whenever two patients were pulled to the same ward — ordinary, not an edge case
 * (see ward-model `admissionId` join comment).
 */
describe("movementForBoardArrival — identity only", () => {
  const unitId = "bty-adult-secure";

  const movementA = {
    id: "mov-a",
    admissionId: "adm-a",
    acceptedUnitId: unitId,
  };
  const movementB = {
    id: "mov-b",
    admissionId: "adm-b",
    acceptedUnitId: unitId,
  };

  it("matches by admissionId when two movements share the same accepted unit", () => {
    const found = movementForBoardArrival([movementA, movementB], "adm-b");
    expect(found?.id).toBe("mov-b");
  });

  it("matches by movement id", () => {
    const found = movementForBoardArrival([movementA, movementB], "mov-a");
    expect(found?.id).toBe("mov-a");
  });

  it("does not fall back to another movement on the same unit", () => {
    const found = movementForBoardArrival([movementA, movementB], "adm-unknown");
    expect(found).toBeUndefined();
  });

  it("returns undefined when movements are missing or key is empty", () => {
    expect(movementForBoardArrival(undefined, "adm-a")).toBeUndefined();
    expect(movementForBoardArrival([movementA], undefined)).toBeUndefined();
    expect(movementForBoardArrival([movementA], "")).toBeUndefined();
  });
});
