import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  arrivalGaps,
  collectionGaps,
  holdEndsBeforeEta,
  legalNowTransportStatus,
  packRequirement,
  transportExceptionRecord,
  transportExceptionText,
  transportStatusClashes,
} from "@/components/ward-management/ward-transport-checks";
import { packNeedsForms, packRequired } from "@/components/ward-management/officer/officer-forms-pack";

/** Audit fixes, 13 Oct 2026 (transport group): the shared transport checks and what the engine records. */
const job = (fields: Partial<Movement>) => fields as unknown as Movement;

describe("transport status from Legal now (A4-7)", () => {
  it("reads voluntary only for a voluntary patient, involuntary for every other status", () => {
    expect(legalNowTransportStatus(job({ legalStatus: "Voluntary" }))).toBe("voluntary");
    expect(legalNowTransportStatus(job({ legalStatus: "Involuntary inpatient" }))).toBe("involuntary");
    expect(legalNowTransportStatus(job({ legalStatus: "Referred for psychiatric examination" }))).toBe("involuntary");
    expect(legalNowTransportStatus(job({}))).toBeUndefined();
  });

  it("flags a booking that disagrees with the form in force", () => {
    const form4c = job({ legalStatus: "Involuntary inpatient" });
    expect(transportStatusClashes(form4c, "voluntary")).toBe(true);
    expect(transportStatusClashes(form4c, "involuntary")).toBe(false);
    expect(transportStatusClashes(form4c, undefined)).toBe(false);
  });
});

describe("forms pack requirement (A4-12)", () => {
  it("needs no pack for a voluntary patient whose booking recorded no status", () => {
    const embleton = job({ legalStatus: "Voluntary", transport: { id: "t", provider: "Ambulance service" } as never });
    expect(packRequirement(embleton)).toBe("not_required");
    expect(packRequired(embleton)).toBe(false);
    expect(packNeedsForms(embleton)).toBe(false);
  });

  it("needs the pack when the form in force is involuntary, even if the booking says voluntary", () => {
    const wrongBooking = job({
      legalStatus: "Involuntary inpatient",
      transport: { id: "t", provider: "Ambulance service", transportLegalStatus: "voluntary" } as never,
    });
    expect(packRequirement(wrongBooking)).toBe("required");
    expect(packNeedsForms(wrongBooking)).toBe(true);
  });

  it("keeps a job with no status anywhere on the pack, but out of the Need forms count", () => {
    const unknown = job({ transport: { id: "t", provider: "Ambulance service" } as never });
    expect(packRequirement(unknown)).toBe("unknown");
    expect(packRequired(unknown)).toBe(true);
    expect(packNeedsForms(unknown)).toBe(false);
  });
});

describe("ETA against the bed hold (A4-2)", () => {
  it("returns the hold end only when the ETA falls after it", () => {
    const held = job({ pullExpiresAt: 669 });
    expect(holdEndsBeforeEta(held, 690)).toBe(669);
    expect(holdEndsBeforeEta(held, 660)).toBeUndefined();
    expect(holdEndsBeforeEta(job({}), 690)).toBeUndefined();
  });
});

describe("collection gaps (A4-11, S-2)", () => {
  it("names the missing Form 4A for a pack job and an unrecorded fit to travel", () => {
    expect(collectionGaps(job({ legalStatus: "Involuntary inpatient" }))).toEqual([
      "transport_order_missing",
      "fit_to_travel_missing",
    ]);
  });

  it("has nothing open once Form 4A is uploaded and the patient is cleared", () => {
    expect(
      collectionGaps(
        job({
          legalStatus: "Involuntary inpatient",
          medicalClearance: { cleared: true, at: 1 },
          uploadedForms: [
            { id: "f", formName: "Form 4A transport order", fileName: "4a.pdf", sizeBytes: 1, uploadedAt: 1 } as never,
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("asks only for fit to travel on a voluntary transfer", () => {
    expect(collectionGaps(job({ legalStatus: "Voluntary" }))).toEqual(["fit_to_travel_missing"]);
  });
});

describe("recorded exceptions", () => {
  it("accepts known gaps and reasons and refuses anything else", () => {
    const ok = transportExceptionRecord(
      { gaps: ["fit_to_travel_missing"], reason: "urgent_to_follow" },
      5,
      "coordinator",
      "collected",
    );
    expect(ok).toEqual({
      at: 5,
      by: "coordinator",
      step: "collected",
      gaps: ["fit_to_travel_missing"],
      reason: "urgent_to_follow",
    });
    expect(typeof ok === "string" ? ok : transportExceptionText(ok)).toBe(
      "Fit to travel not recorded. Urgent move, record to follow",
    );
    expect(typeof transportExceptionRecord({ gaps: [], reason: "paper_sighted" }, 5, "officer", "collected")).toBe(
      "string",
    );
    expect(
      typeof transportExceptionRecord({ gaps: ["fit_to_travel_missing"], reason: "typed" }, 5, "officer", "collected"),
    ).toBe("string");
  });

  it("stores the booking's exception on the job and refuses a malformed one", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((candidate) => candidate.id === "WF-011")!;
    const base = {
      type: "BOOK_TRANSPORT" as const,
      role: "coordinator" as const,
      now: NOW_ANCHOR,
      movementId: movement.id,
      provider: "Ambulance service" as const,
      escortRequired: true,
      cadNumber: "CAD-SYN-1",
      transportLegalStatus: "voluntary" as const,
      estimatedAt: NOW_ANCHOR + 30,
    };
    const refused = wardFlowReducer(state, {
      ...base,
      exception: { gaps: ["legal_status_differs"], reason: "nope" as never },
    });
    expect(refused.movements.find((m) => m.id === movement.id)!.transport).toBeUndefined();
    expect(refused.rejections.at(-1)?.reason).toMatch(/exception reason/);

    const booked = wardFlowReducer(state, {
      ...base,
      exception: { gaps: ["legal_status_differs"], reason: "treating_team_confirmed" },
    });
    expect(booked.movements.find((m) => m.id === movement.id)!.transport!.exceptions).toEqual([
      {
        at: NOW_ANCHOR,
        by: "coordinator",
        step: "booked",
        gaps: ["legal_status_differs"],
        reason: "treating_team_confirmed",
      },
    ]);
  });

  it("records a collection with an open check and never blocks it", () => {
    let state = seedWardFlowState();
    state = wardFlowReducer(state, {
      type: "TRANSPORT_EN_ROUTE",
      role: "officer",
      now: NOW_ANCHOR,
      movementId: "WF-005",
    });
    state = wardFlowReducer(state, {
      type: "PATIENT_COLLECTED",
      role: "officer",
      now: NOW_ANCHOR + 1,
      movementId: "WF-005",
      exception: { gaps: ["transport_order_missing"], reason: "paper_sighted" },
    });
    const movement = state.movements.find((m) => m.id === "WF-005")!;
    expect(movement.stage).toBe("moving");
    expect(movement.transport!.exceptions).toEqual([
      {
        at: NOW_ANCHOR + 1,
        by: "officer",
        step: "collected",
        gaps: ["transport_order_missing"],
        reason: "paper_sighted",
      },
    ]);
  });
});

describe("arrival gaps with no transport leg (audit r1 item 4)", () => {
  it("asks fit to travel only when nobody collected the patient and no clearance is recorded", () => {
    expect(arrivalGaps(job({}))).toEqual(["fit_to_travel_missing"]);
    expect(arrivalGaps(job({ medicalClearance: { cleared: true, at: 0 } }))).toEqual([]);
    expect(arrivalGaps(job({ transport: { collectedAt: 5 } as never }))).toEqual([]);
  });
});
