import { describe, expect, it } from "vitest";
import { createTestJourney } from "../helpers/test-harness";

describe("Tier 1 - Feature 03: Medical Clearance Transfer Gate Affirmative Check", () => {
  it("rejects BOOK_TRANSPORT when medical clearance has never been assessed (undefined)", () => {
    // Under DCB0129 clinical safety rules, unassessed clearance must pause onward transit
    const j = createTestJourney(); // initialClearance omitted (undefined)

    expect(j.currentMovement().medicalClearance).toBeUndefined();
    j.bookTransport();

    expect(j.currentMovement().transport).toBeUndefined();
    expect(j.lastRejection()).toContain("Medical clearance");
  });

  it("rejects BOOK_TRANSPORT when medical clearance is explicitly false (cleared: false)", () => {
    const j = createTestJourney({ initialClearance: false });

    expect(j.currentMovement().medicalClearance?.cleared).toBe(false);
    j.bookTransport();

    expect(j.currentMovement().transport).toBeUndefined();
    expect(j.lastRejection()).toContain("Medical clearance");
  });

  it("allows BOOK_TRANSPORT when medical clearance is affirmatively granted (cleared: true)", () => {
    const j = createTestJourney({ initialClearance: true });

    expect(j.currentMovement().medicalClearance?.cleared).toBe(true);
    j.bookTransport();

    expect(j.currentMovement().transport).toBeDefined();
    expect(j.currentMovement().stage).toBe("pulled");
    expect(j.state.rejections).toHaveLength(0);
  });

  it("permits PULL_PATIENT (bed reservation) while medical clearance is pending (Ruling D-4)", () => {
    // Bed coordinators must be able to reserve beds while ED pathology/clearance runs
    const j = createTestJourney(); // unassessed clearance

    expect(j.currentMovement().admissionId).toBeDefined();
    expect(j.currentMovement().stage).toBe("pulled");
  });

  it("allows transport collection and arrival when affirmative clearance is recorded before transit", () => {
    const j = createTestJourney({ initialClearance: true });
    j.bookTransport();

    for (const event of [
      { type: "HANDOVER_READY", role: "ed" },
      { type: "TRANSPORT_ACCEPTED", role: "officer" },
      { type: "TRANSPORT_EN_ROUTE", role: "officer" },
      { type: "PATIENT_COLLECTED", role: "officer" },
    ] as const) {
      j.send({ ...event, movementId: j.movementId });
    }

    expect(j.currentMovement().stage).toBe("moving");
    expect(j.currentMovement().transport?.collectedAt).toBeDefined();

    j.send({
      type: "PATIENT_ARRIVED",
      role: "ward",
      movementId: j.movementId,
      actingUnitId: j.unitId,
    });

    expect(j.currentMovement().stage).toBe("arrived");
  });
});
