import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import type { Movement } from "./ward-model";
import type { AuditDecision } from "./ward-audit";
import { LEGAL_FORM_RECEIPT_CORRECTION_REASONS } from "./ward-change-reasons";
import { isLegalClockFormCode } from "./ward-legal-clock";
type LegalFormRecordsEvent = Extract<
  WardFlowEvent,
  { type: "RECORD_LEGAL_FORM_RECEIVED" | "CORRECT_LEGAL_FORM_RECEIPT" | "RECORD_LEGAL_FORM_EXPIRY" }
>;
type LegalFormRecordsOperations = {
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;
  findMovement: (state: WardFlowState, id: string) => Movement | undefined;
  replaceMovement: (state: WardFlowState, id: string, next: Movement) => WardFlowState;
};
/** These events record receipt, a receipt correction, or an expiry typed from paper.
 * No statutory deadline is computed. The facade retains role, audit and revision boundaries. */
export function reduceLegalFormRecordsEvent(
  state: WardFlowState,
  event: LegalFormRecordsEvent,
  decision: AuditDecision,
  operations: LegalFormRecordsOperations,
): WardFlowState {
  switch (event.type) {
    case "RECORD_LEGAL_FORM_RECEIVED":
      return recordReceipt(state, event, operations);
    case "CORRECT_LEGAL_FORM_RECEIPT":
      return correctReceipt(state, event, operations, decision);
    case "RECORD_LEGAL_FORM_EXPIRY":
      return recordExpiry(state, event, operations, decision);
  }
}

/**
 * Ruling 1 (2026-09-16). ED marks a Form 1A as received.
 *
 * 🔴 **CORRECTED 2026-09-17, T2r fix round, finding 10 — "which starts the 24-hour psychiatric
 * examination clock" IS NOW FALSE.** That computed clock was deleted by T2 on owner answer 1:
 * this prototype works out no legal time limits of its own. This case still records the
 * receipt instant; nothing here starts a clock from it any longer.
 */
function recordReceipt(
  state: WardFlowState,
  event: Extract<LegalFormRecordsEvent, { type: "RECORD_LEGAL_FORM_RECEIVED" }>,
  operations: LegalFormRecordsOperations,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);

  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);

  if (movement.closure) {
    return operations.reject(
      state,
      event,
      `cannot mark legal form received for a closed movement (${movement.closure.reason})`,
    );
  }

  if (movement.legalFormReceivedAt !== undefined) {
    return operations.reject(state, event, `legal form for movement ${movement.id} was already marked as received`);
  }

  // Receipt is a fact about a supported form: 1A, 3A, 3C, 3D, 6A, 6B,
  // 6C, 5A or 5B. Recording receipt against any other code, or against no form at all, would
  // be a fact about a form nobody holds. Refused rather than silently accepted.
  if (!movement.legalForm || !isLegalClockFormCode(movement.legalForm.code)) {
    return operations.reject(
      state,
      event,
      `movement ${movement.id} does not carry a receivable legal form (legal form ${movement.legalForm?.code ?? "none"}), so a legal form receipt cannot be recorded against it`,
    );
  }

  // Ruling "form end times come from the time written on the form": receipt records only the
  // instant of receipt. No statutory deadline is computed here — a clinician's typed expiry
  // (`RECORD_LEGAL_FORM_EXPIRY`) is the only legitimate source of a `dueAt`.
  const updated: Movement = {
    ...movement,
    legalFormReceivedAt: event.now,
  };

  return operations.replaceMovement(state, movement.id, updated);
}

/**
 * T4 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`). The undo
 * `RECORD_LEGAL_FORM_RECEIVED` above has never had: a clinician marked receipt in error, or
 * against the wrong movement, and needs to correct it without losing the fact a receipt was
 * ever recorded. Clears `legalFormReceivedAt` and appends the ORIGINAL instant, who corrected
 * it and the fixed reason they gave to `legalFormReceiptCorrections`, so a second
 * `RECORD_LEGAL_FORM_RECEIVED` can succeed cleanly afterwards.
 */
function correctReceipt(
  state: WardFlowState,
  event: Extract<LegalFormRecordsEvent, { type: "CORRECT_LEGAL_FORM_RECEIPT" }>,
  operations: LegalFormRecordsOperations,
  decision: AuditDecision,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);

  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);

  if (movement.closure) {
    return operations.reject(
      state,
      event,
      `cannot correct a legal form receipt for a closed movement (${movement.closure.reason})`,
    );
  }

  if (movement.legalFormReceivedAt === undefined) {
    return operations.reject(state, event, `movement ${movement.id} has no recorded legal form receipt to correct`);
  }

  if (!LEGAL_FORM_RECEIPT_CORRECTION_REASONS.includes(event.reason)) {
    return operations.reject(
      state,
      event,
      `CORRECT_LEGAL_FORM_RECEIPT reason "${event.reason}" is not one of the fixed correction reasons`,
    );
  }

  const correction = {
    at: event.now,
    by: event.role,
    reason: event.reason,
    receivedAt: movement.legalFormReceivedAt,
  };

  const updated: Movement = {
    ...movement,
    legalFormReceivedAt: undefined,
    legalFormReceiptCorrections: [...(movement.legalFormReceiptCorrections ?? []), correction],
  };

  // Audited as "legal-form" (`classifyAuditEvent`); without this the stored change was
  // recorded in the audit trail as "denied".
  decision.outcome = "accepted";

  decision.reasonCode = "none";

  return operations.replaceMovement(state, movement.id, updated);
}

/**
 * T2 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`), owner answer 1 and item
 * 5 (regional extensions). The clinician types the expiry written on the form in front of
 * them — for any form, not a chosen few — and, on a later occasion, a further extension
 * written on a fresh form. This one event carries both; which it is is read off the state, not
 * off a caller-supplied flag, exactly the discipline `RECORD_LEGAL_FORM_RECEIVED` above holds
 * to for its own "already recorded" check.
 */
function recordExpiry(
  state: WardFlowState,
  event: Extract<LegalFormRecordsEvent, { type: "RECORD_LEGAL_FORM_EXPIRY" }>,
  operations: LegalFormRecordsOperations,
  decision: AuditDecision,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);

  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);

  // T2r fix round, finding 11 (2026-09-17): a plain, fixed sentence — matching the other two
  // refusals in this case, and no longer interpolating `movement.closure.reason` (a clinical
  // string built for a different audience) into a form-control's own error text.
  if (movement.closure) {
    return operations.reject(state, event, "This record is closed, so no expiry can be added to it.");
  }

  // §2's exact sentence — there is no form here to attach a typed expiry to, so this refuses
  // rather than inventing one.
  if (!movement.legalForm) {
    return operations.reject(state, event, "There is no legal form on this record to add an expiry to.");
  }

  // T2r fix round, finding 8 (2026-09-17). `Instant` is a bare `number` at the type level, so
  // nothing stops a caller sending `NaN`/`Infinity` at runtime — the same `Number.isFinite`
  // discipline every other instant-shaped field in this codebase already holds callers to
  // (see e.g. `ward-discharge-dates.ts`, `ward-referrals.ts`). A non-finite value is refused
  // before it can become a stored "expiry" nothing can compare or render.
  if (!Number.isFinite(event.dueAt)) {
    return operations.reject(state, event, "Enter the expiry written on the form.");
  }

  const currentDueAt = movement.legalForm.dueAt;

  // Legacy calculated clocks are not paper authority. The six authored fixture values and
  // current entered values are; absence of an old actor-history record does not discard them.
  const legacyCalculatedExpiry = movement.legalClock !== undefined && currentDueAt === movement.legalClock.expiresAt;

  const isExtension = currentDueAt !== undefined && !legacyCalculatedExpiry;

  // An extension only ever moves an expiry LATER. Nothing here computes what "later" should
  // be — the clinician types the new expiry off a fresh form, and this only orders it against
  // what is already recorded. §2's exact sentence for the refusal.
  if (isExtension && event.dueAt <= currentDueAt) {
    return operations.reject(state, event, "An extension's new expiry must be later than the expiry already recorded.");
  }

  const basis: "written_on_form" | "extension" = isExtension ? "extension" : "written_on_form";

  const historyEntry = { at: event.now, by: event.role, dueAt: event.dueAt, basis };

  const updated: Movement = {
    ...movement,
    legalForm: { ...movement.legalForm, dueAt: event.dueAt },
    legalClock: undefined,
    legalFormExpiryHistory: [...(movement.legalFormExpiryHistory ?? []), historyEntry],
  };

  decision.outcome = "accepted";

  decision.reasonCode = "none";

  return operations.replaceMovement(state, movement.id, updated);
}
