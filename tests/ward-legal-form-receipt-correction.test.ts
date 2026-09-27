import { describe, expect, it } from "vitest";

import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { ReferralDraft } from "@/components/ward-management/ward-flow-events";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { LEGAL_FORM_RECEIPT_CORRECTION_REASONS } from "@/components/ward-management/ward-change-reasons";

/**
 * T4 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`): `RECORD_LEGAL_FORM_RECEIVED`
 * has never had an undo. A clinician who marks a Form 1A received in error, or against the wrong
 * movement, has been stuck with it — there is no way to record that the receipt was wrong and try
 * again. `CORRECT_LEGAL_FORM_RECEIPT` is that undo.
 *
 * Raises through the reducer rather than reading a seeded movement, the same discipline
 * `ward-legal-form-due-at-capture.test.ts` holds to — this proves the runtime path, not a fixture.
 */

const ED_ID = allEmergencyDepartments()[0]!.id;
const NOW = 9 * 60;

function draft(overrides: Partial<ReferralDraft> = {}): ReferralDraft {
  return {
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
    specialling: false,
    highAcuity: false,
    legalStatus: "Detained awaiting examination",
    urgency: 2,
    legalFormCode: "1A",
    ...overrides,
  };
}

/** Raises one Form-1A referral through the real reducer and returns the movement it created. */
function raise1A() {
  const before: WardFlowState = seedWardFlowState();
  const after = wardFlowReducer(before, {
    type: "RAISE_REFERRAL",
    role: "ed",
    now: NOW,
    edId: ED_ID,
    draft: draft(),
  });
  expect(after.rejections, "the referral must be accepted, or nothing below is exercised").toEqual([]);
  const created = after.movements.filter(
    (movement) => !before.movements.some((existing) => existing.id === movement.id),
  );
  expect(created, "exactly one movement must have been created by this dispatch").toHaveLength(1);
  return { state: after, movementId: created[0]!.id };
}

/** Raises a fresh Form-1A movement and marks its receipt, returning the state and its instant. */
function raiseAndReceive(receivedAt: number) {
  const { state, movementId } = raise1A();
  const received = wardFlowReducer(state, {
    type: "RECORD_LEGAL_FORM_RECEIVED",
    role: "ed",
    now: receivedAt,
    movementId,
  });
  expect(
    received.rejections,
    `RECORD_LEGAL_FORM_RECEIVED must be accepted: ${received.rejections.at(-1)?.reason}`,
  ).toEqual([]);
  const movement = received.movements.find((candidate) => candidate.id === movementId)!;
  expect(movement.legalFormReceivedAt, "the receipt must actually be recorded before this test proceeds").toBe(
    receivedAt,
  );
  return { state: received, movementId };
}

describe("CORRECT_LEGAL_FORM_RECEIPT — the undo RECORD_LEGAL_FORM_RECEIVED has never had", () => {
  it("clears legalFormReceivedAt, appends the record holding the ORIGINAL instant, and a second RECORD_LEGAL_FORM_RECEIVED then succeeds", () => {
    const receivedAt = NOW + 20;
    const { state, movementId } = raiseAndReceive(receivedAt);

    const correctedAt = NOW + 40;
    const corrected = wardFlowReducer(state, {
      type: "CORRECT_LEGAL_FORM_RECEIPT",
      role: "ed",
      now: correctedAt,
      movementId,
      reason: "recorded_in_error",
    });
    expect(corrected.rejections, `the correction must be accepted: ${corrected.rejections.at(-1)?.reason}`).toEqual([]);

    const afterCorrection = corrected.movements.find((movement) => movement.id === movementId)!;
    expect(afterCorrection.legalFormReceivedAt, "the receipt must be cleared, not merely overwritten").toBeUndefined();

    // The mutation this proves: a correction that skips appending the history entry — the change
    // itself would still pass every OTHER assertion here (the field is cleared, the second receipt
    // succeeds), so this is the one assertion standing between "corrected" and "quietly forgotten".
    expect(
      afterCorrection.legalFormReceiptCorrections,
      "the original receipt must be preserved as a correction record",
    ).toEqual([{ at: correctedAt, by: "ed", reason: "recorded_in_error", receivedAt }]);

    // Nothing is left behind on the old duplicate field either.
    expect((afterCorrection.legalForm as { receivedAt?: number } | undefined)?.receivedAt).toBeUndefined();

    const reRecordedAt = NOW + 60;
    const reRecorded = wardFlowReducer(corrected, {
      type: "RECORD_LEGAL_FORM_RECEIVED",
      role: "ed",
      now: reRecordedAt,
      movementId,
    });
    expect(
      reRecorded.rejections,
      `a second RECORD_LEGAL_FORM_RECEIVED must succeed once the correction has cleared the field: ${reRecorded.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    const reReceived = reRecorded.movements.find((movement) => movement.id === movementId)!;
    expect(reReceived.legalFormReceivedAt).toBe(reRecordedAt);
    // The correction history from the first round must still be there — a second receipt is not a
    // second chance to lose the record of the first correction.
    expect(reReceived.legalFormReceiptCorrections).toEqual([
      { at: correctedAt, by: "ed", reason: "recorded_in_error", receivedAt },
    ]);
  });

  it("refuses a reason outside the fixed list, by membership", () => {
    const { state, movementId } = raiseAndReceive(NOW + 20);

    const corrected = wardFlowReducer(state, {
      type: "CORRECT_LEGAL_FORM_RECEIPT",
      role: "ed",
      now: NOW + 40,
      movementId,
      // Not a member of LEGAL_FORM_RECEIPT_CORRECTION_REASONS — a type-only guarantee would pass
      // `vitest run` with no `tsc` involved, so the reducer must check this at runtime too.
      reason: "bed_needed_for_another_patient" as never,
    });
    expect(corrected.rejections.length, "an off-list reason must be refused").toBeGreaterThan(state.rejections.length);
    const stillReceived = corrected.movements.find((movement) => movement.id === movementId)!;
    expect(stillReceived.legalFormReceivedAt, "a refused correction must not clear the receipt").toBe(NOW + 20);
    expect(stillReceived.legalFormReceiptCorrections).toBeUndefined();
  });

  it("refuses a correction against a movement with no recorded receipt", () => {
    const { state, movementId } = raise1A();

    const corrected = wardFlowReducer(state, {
      type: "CORRECT_LEGAL_FORM_RECEIPT",
      role: "ed",
      now: NOW + 40,
      movementId,
      reason: LEGAL_FORM_RECEIPT_CORRECTION_REASONS[0],
    });
    expect(corrected.rejections.length, "there is no receipt to correct, so this must be refused").toBeGreaterThan(
      state.rejections.length,
    );
    expect(
      corrected.rejections.at(-1)?.reason,
      "the refusal should say there is nothing recorded to correct",
    ).toContain("no recorded legal form receipt");
  });

  it("refuses a correction for a closed movement", () => {
    const { state, movementId } = raiseAndReceive(NOW + 20);
    const unitId = state.units[0]!.id;
    const referred = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW + 22,
      movementId,
      unitIds: [unitId],
    });
    expect(referred.rejections, `REFER_TO_UNITS must be accepted: ${referred.rejections.at(-1)?.reason}`).toEqual([]);
    const withdrawn = wardFlowReducer(referred, {
      type: "WITHDRAW_REFERRAL",
      role: "ed",
      now: NOW + 30,
      movementId,
    });
    expect(withdrawn.rejections, `WITHDRAW_REFERRAL must be accepted: ${withdrawn.rejections.at(-1)?.reason}`).toEqual(
      [],
    );
    const closedMovement = withdrawn.movements.find((movement) => movement.id === movementId)!;
    expect(closedMovement.closure, "the movement must actually be closed before this test proceeds").toBeDefined();

    const corrected = wardFlowReducer(withdrawn, {
      type: "CORRECT_LEGAL_FORM_RECEIPT",
      role: "ed",
      now: NOW + 40,
      movementId,
      reason: LEGAL_FORM_RECEIPT_CORRECTION_REASONS[0],
    });
    expect(corrected.rejections.length, "a closed movement's receipt must not be correctable").toBeGreaterThan(
      withdrawn.rejections.length,
    );
  });
});
