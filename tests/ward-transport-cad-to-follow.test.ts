import { describe, expect, it } from "vitest";
import { cadNumberToFollow } from "../src/components/ward-management/ward-cad-number";
import { ABSCONDED_IN_TRANSIT } from "../src/components/ward-management/ward-change-reasons";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/*
 * Form friction decisions (Josh, 27 Oct 2026), engine half. Synthetic seed only.
 * - CAD to follow: a dispatched service books with no CAD number, and the number is added later.
 * - #236: the crew's identity check at collection is recorded when tapped, and never blocks.
 * - #154: absconded in transit is a stop reason, and the sending ward is told to record the absence.
 * - #219: the admitting ward records the expiry of the form it records (WT-03 scope).
 */

const NOW = NOW_ANCHOR;

function job(state: WardFlowState, movementId: string) {
  return state.movements.find((movement) => movement.id === movementId)!.transport!;
}

function book(provider: string, cadNumber: string | undefined, state = seedWardFlowState()) {
  return wardFlowReducer(state, {
    type: "BOOK_TRANSPORT",
    role: "coordinator",
    now: NOW,
    movementId: "WF-004",
    provider,
    escortRequired: true,
    cadNumber,
    transportLegalStatus: "involuntary",
    estimatedAt: NOW + 30,
  } as never);
}

function addCad(state: WardFlowState, cadNumber: string, role: "officer" | "ward" = "officer", actingUnitId?: string) {
  return wardFlowReducer(state, {
    type: "RECORD_TRANSPORT_CAD",
    role,
    now: NOW + 5,
    movementId: "WF-004",
    cadNumber,
    ...(actingUnitId ? { actingUnitId } : {}),
  });
}

describe("CAD to follow", () => {
  it.each(["Ambulance (St John)", "Mental Health Transport", "Patient transport service", "RFDS", "Police escort"])(
    "books %s with no CAD number, and the job reads as CAD to follow",
    (provider) => {
      const next = book(provider, "");
      expect(next.rejections).toEqual([]);
      expect(job(next, "WF-004").cadNumber).toBeUndefined();
      expect(cadNumberToFollow(job(next, "WF-004"))).toBe(true);
    },
  );

  it("still refuses a typed placeholder at booking", () => {
    expect(book("Ambulance (St John)", "TBC").rejections[0]?.reason).toContain("cadNumber refused");
  });

  it("adds the CAD number later, with when and who, and then no longer reads as to follow", () => {
    const booked = book("RFDS", "");
    const next = addCad(booked, " 2026-1234 ");
    expect(next.rejections).toEqual([]);
    expect(job(next, "WF-004").cadNumber).toBe("2026-1234");
    expect(job(next, "WF-004").cadAdded).toEqual({ at: NOW + 5, by: "officer" });
    expect(cadNumberToFollow(job(next, "WF-004"))).toBe(false);
  });

  it("refuses a placeholder, a blank, and a second number", () => {
    const booked = book("RFDS", "");
    expect(addCad(booked, "TBA").rejections.at(-1)?.reason).toContain("cadNumber refused");
    expect(addCad(booked, "  ").rejections.at(-1)?.reason).toContain("must be answered");
    const withCad = book("RFDS", "2026-555");
    expect(addCad(withCad, "2026-1234").rejections.at(-1)?.reason).toContain("already has a CAD number");
  });

  it("refuses a ward that did not send the journey", () => {
    const booked = book("RFDS", "");
    const next = addCad(booked, "2026-1234", "ward", "not-the-sending-ward");
    expect(next.rejections.at(-1)?.reason).toContain("only the sending ward adds the CAD number");
  });

  it("refuses a job with no live transport", () => {
    expect(addCad(seedWardFlowState(), "2026-1234").rejections.at(-1)?.reason).toContain("no live transport job");
  });
});

/** WF-004 booked and driven to "en route", so the next step is collection. */
function enRoute() {
  const movementId = "WF-004";
  let state = book("Ambulance (St John)", "2026-777");
  for (const event of [
    { type: "HANDOVER_READY", role: "coordinator" },
    { type: "TRANSPORT_ACCEPTED", role: "officer" },
    { type: "TRANSPORT_EN_ROUTE", role: "officer" },
  ] as const) {
    state = wardFlowReducer(state, { ...event, now: NOW + 1, movementId });
  }
  expect(state.rejections, "the journey did not reach en route, so nothing below holds").toEqual([]);
  return { state, movementId };
}

describe("identity checked at collection (#236)", () => {
  it("records the tap with when and who", () => {
    const { state, movementId } = enRoute();
    const next = wardFlowReducer(state, {
      type: "PATIENT_COLLECTED",
      role: "officer",
      now: NOW,
      movementId,
      identityChecked: true,
    });
    expect(next.rejections).toHaveLength(state.rejections.length);
    expect(job(next, movementId).identityChecked).toEqual({ at: NOW, by: "officer" });
  });

  it("collects without it, and records nothing", () => {
    const { state, movementId } = enRoute();
    const next = wardFlowReducer(state, { type: "PATIENT_COLLECTED", role: "officer", now: NOW, movementId });
    expect(next.rejections).toHaveLength(state.rejections.length);
    expect(job(next, movementId).collectedAt).toBe(NOW);
    expect(job(next, movementId).identityChecked).toBeUndefined();
  });
});

describe("absconded in transit (#154)", () => {
  it("stops the journey and tells the sending ward to record the absence", () => {
    const seed = seedWardFlowState();
    // A synthetic ward to ward transfer, collected and on the road from an occupied stay.
    const stay = seed.admissions.find((admission) => admission.state === "occupied" && admission.patientId !== null)!;
    const journey = seed.movements.find((movement) => !movement.closure && movement.transport)!;
    const moving = {
      ...journey,
      stage: "moving" as const,
      sourceAdmissionId: stay.id,
      transport: { ...journey.transport!, collectedAt: NOW - 10, cancelledAt: undefined, arrivedAt: undefined },
    };
    const state = {
      ...seed,
      movements: seed.movements.map((movement) => (movement.id === journey.id ? moving : movement)),
    };
    const next = wardFlowReducer(state, {
      type: "STOP_TRANSPORT",
      role: "coordinator",
      now: NOW,
      movementId: journey.id,
      reason: ABSCONDED_IN_TRANSIT,
      whereabouts: "Another place — needs follow-up",
    });
    expect(next.rejections).toHaveLength(state.rejections.length);
    expect(job(next, journey.id).stopReason).toBe("Absconded in transit, whereabouts unknown");
    const told = next.notices.filter(
      (notice) =>
        notice.to.role === "ward" && notice.to.placeId === stay.unitId && /absent without leave/.test(notice.sentence),
    );
    expect(told).toHaveLength(1);
  });
});

describe("the admitting ward records a form's expiry (#219)", () => {
  /** A synthetic person who arrived on a Form 1A and is in an occupied bed, as in WT-03's own test. */
  function admitted(): { state: WardFlowState; movementId: string } {
    const seed = seedWardFlowState();
    const stay = seed.admissions.find((admission) => admission.state === "occupied" && admission.patientId !== null)!;
    const journey = seed.movements.find((movement) => !movement.closure)!;
    const arrived = {
      ...journey,
      stage: "arrived" as const,
      acceptedUnitId: stay.unitId,
      admissionId: stay.id,
      patientId: stay.patientId ?? undefined,
      legalForm: { code: "6A", kind: undefined },
      closure: { at: NOW - 60, outcome: "arrived" as const, reason: "Patient arrived at the accepting unit" },
    };
    return {
      state: {
        ...seed,
        movements: seed.movements.map((movement) => (movement.id === journey.id ? arrived : movement)),
      },
      movementId: journey.id,
    };
  }

  function expiry(state: WardFlowState, movementId: string) {
    return wardFlowReducer(state, {
      type: "RECORD_LEGAL_FORM_EXPIRY",
      role: "ward",
      now: NOW,
      movementId,
      dueAt: NOW + 1000,
    });
  }

  it("lets the ward record the expiry for a person admitted to its bed", () => {
    const { state, movementId } = admitted();
    const next = expiry(state, movementId);
    expect(next.rejections).toHaveLength(state.rejections.length);
    expect(next.movements.find((movement) => movement.id === movementId)!.legalForm?.dueAt).toBe(NOW + 1000);
  });

  it("refuses the ward on a journey still open", () => {
    const state = seedWardFlowState();
    const open = state.movements.find((movement) => !movement.closure && movement.legalForm)!;
    const next = expiry(state, open.id);
    expect(next.rejections.at(-1)?.reason).toBe(
      "A ward records a form's expiry only for a person admitted to its own bed.",
    );
  });
});
