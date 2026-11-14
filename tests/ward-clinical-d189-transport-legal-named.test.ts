import { describe, expect, it, vi } from "vitest";

import {
  buildPatientStatus,
  referralWaitingForTriage,
  type PatientStatusContext,
} from "@/components/ward-management/patients/patient-status-card";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { legalStatusShort } from "@/components/ward-management/ward-legal-forms";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The held clinical PR's remaining legal items (Josh, 13 Nov 2026), on synthetic records only:
 * - D-187 item 4: a Voluntary person with a form on file shows both on the chip.
 * - D-186 item 4: the remaining hand-written "not Voluntary" checks use the named rule.
 * - D-189 item 9(a): the invented authorisation flag no longer refuses handover, transport or
 *   collection at a held bed, and raises no legal mismatch flag, while every ward reads "not stated".
 * - A9-20(a): a person whose referral waits for triage is not "Not currently active".
 */

describe("D-187 item 4: a Voluntary person with a form shows both", () => {
  const chip = (fields: Partial<Movement>) => legalStatusShort(fields as Pick<Movement, "legalForm" | "legalStatus">);

  it("reads Voluntary · Form 3B, and Voluntary · Form 3B ended once the end is recorded", () => {
    expect(chip({ legalStatus: "Voluntary", legalForm: { code: "3B" } })).toBe("Voluntary · Form 3B");
    expect(chip({ legalStatus: "Voluntary", legalForm: { code: "3B", endedBy: "revoked" } })).toBe(
      "Voluntary · Form 3B ended",
    );
  });

  it("is unchanged for every other case", () => {
    expect(chip({ legalStatus: "Voluntary" })).toBe("Voluntary");
    expect(chip({ legalStatus: "Involuntary inpatient", legalForm: { code: "3B" } })).toBe("Form 3B");
    expect(chip({ legalStatus: "Referred for psychiatric examination", legalForm: { code: "1A" } })).toBe("Form 1A");
    expect(chip({ legalStatus: "Detained awaiting examination" })).toBe("Awaiting exam");
  });
});

/** WF-011: a held bed for an involuntary inpatient on a Form 4C, with its ward marked unauthorised. */
function withUnauthorisedHeldWard(): { state: WardFlowState; movement: Movement } {
  const seed = seedWardFlowState();
  const movement = seed.movements.find((candidate) => candidate.id === "WF-011")!;
  const state = {
    ...seed,
    units: seed.units.map((unit) => (unit.id === movement.acceptedUnitId ? { ...unit, authorised: false } : unit)),
  };
  return { state, movement };
}

describe("D-189 item 9(a): the invented flag no longer steers the held-bed steps", () => {
  it("books, readies, accepts, dispatches and collects at a ward the flag calls unauthorised", () => {
    const { state: start, movement } = withUnauthorisedHeldWard();
    expect(movement.legalStatus).toBe("Involuntary inpatient");
    let state = wardFlowReducer(start, {
      type: "BOOK_TRANSPORT",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: movement.id,
      provider: "Ambulance service",
      escortRequired: true,
      cadNumber: "CAD-SYN-2",
      transportLegalStatus: "involuntary",
      estimatedAt: NOW_ANCHOR + 30,
    });
    state = wardFlowReducer(state, {
      type: "HANDOVER_READY",
      role: "coordinator",
      now: NOW_ANCHOR + 1,
      movementId: movement.id,
    });
    state = wardFlowReducer(state, {
      type: "TRANSPORT_ACCEPTED",
      role: "officer",
      now: NOW_ANCHOR + 2,
      movementId: movement.id,
    });
    state = wardFlowReducer(state, {
      type: "TRANSPORT_EN_ROUTE",
      role: "officer",
      now: NOW_ANCHOR + 3,
      movementId: movement.id,
    });
    state = wardFlowReducer(state, {
      type: "PATIENT_COLLECTED",
      role: "officer",
      now: NOW_ANCHOR + 4,
      movementId: movement.id,
    });
    expect(state.rejections.slice(start.rejections.length).map((rejection) => rejection.reason)).toEqual([]);
    expect(state.movements.find((candidate) => candidate.id === movement.id)!.stage).toBe("moving");
  });

  it("raises no involuntary-on-voluntary-ward mismatch from the flag", () => {
    const { state, movement } = withUnauthorisedHeldWard();
    const after = wardFlowReducer(state, {
      type: "FLAG_LEGAL_MISMATCH",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: movement.id,
      unitId: movement.acceptedUnitId!,
      kind: "involuntary_on_voluntary_ward",
    });
    expect(after.rejections).toHaveLength(state.rejections.length + 1);
    expect(after.movements.find((candidate) => candidate.id === movement.id)!.legalMismatch).toBeUndefined();
  });
});

describe("A9-20(a): a referral waiting for triage is open work", () => {
  const patient = { id: "PT-A920", catchmentCommunityTeam: "Synthetic team" } as unknown as Patient;
  const referral = (fields: Partial<Referral>) =>
    ({ id: "R-A920", patientId: "PT-A920", raisedAt: 100, destinations: [], ...fields }) as unknown as Referral;
  function context(overrides: Partial<PatientStatusContext>): PatientStatusContext {
    return {
      hasBedHold: false,
      now: 0,
      dayZero: new Date(Date.UTC(2026, 10, 13, 2, 42)),
      onOpenPlacement: vi.fn(),
      onClearance: vi.fn(),
      onBookTransport: vi.fn(),
      onArrivalTime: vi.fn(),
      onRecordReturn: vi.fn(),
      onMarkAbsent: vi.fn(),
      onAbsenceStep: vi.fn(),
      onRecordCto: vi.fn(),
      onEndCto: vi.fn(),
      ...overrides,
    } as PatientStatusContext;
  }

  it("reads a queued, untriaged referral as waiting, until a triage is signed after it was raised", () => {
    const queued = seedWardFlowState().referrals.find((candidate) => candidate.triagedAt === undefined);
    expect(queued).toBeDefined();
    const waiting = referral({ ...queued!, id: "R-A920", patientId: "PT-A920", raisedAt: 100 });
    expect(referralWaitingForTriage("PT-A920", [waiting], [])).toBe(true);
    expect(referralWaitingForTriage("PT-A920", [waiting], [{ patientId: "PT-A920", at: 120 }])).toBe(false);
    expect(referralWaitingForTriage("PT-A920", [waiting], [{ patientId: "PT-A920", at: 50 }])).toBe(true);
    expect(referralWaitingForTriage("PT-A920", [{ ...waiting, triagedAt: 110 }], [])).toBe(false);
    expect(referralWaitingForTriage("PT-OTHER", [waiting], [])).toBe(false);
  });

  it("says Referral waiting for triage instead of Not currently active", () => {
    const status = buildPatientStatus("idle", context({ patient, referralWaitingForTriage: true }));
    expect(status.verdict).toBe("Referral waiting for triage");
    expect(status.meta).not.toMatch(/No open referral/u);
    expect(buildPatientStatus("idle", context({ patient })).verdict).toBe("Not currently active");
  });
});
