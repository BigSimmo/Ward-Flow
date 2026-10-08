import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import type { Movement } from "./ward-model";
import type { AuditDecision } from "./ward-audit";
import { form3CRefusedAfter3D, isLegalClockFormCode } from "./ward-legal-clock";
type LegalPaperEvent = Extract<WardFlowEvent, { type: "RECORD_LEGAL_FORM_WRITTEN" | "RECORD_LEGAL_FORM_CONTINUATION" }>;
type WrittenFormEvent = Extract<LegalPaperEvent, { type: "RECORD_LEGAL_FORM_WRITTEN" }>;
type ContinuationEvent = Extract<LegalPaperEvent, { type: "RECORD_LEGAL_FORM_CONTINUATION" }>;
type LegalPaperOperations = {
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;
  findMovement: (state: WardFlowState, id: string) => Movement | undefined;
  replaceMovement: (state: WardFlowState, id: string, next: Movement) => WardFlowState;
};
/** Record the clinician's chosen form and typed paper facts. No legal deadline is computed.
 * The public facade retains permission, resource revision and audit boundaries. */
export function reduceLegalPaperEvent(
  state: WardFlowState,
  event: LegalPaperEvent,
  decision: AuditDecision,
  operations: LegalPaperOperations,
): WardFlowState {
  switch (event.type) {
    case "RECORD_LEGAL_FORM_WRITTEN":
      return recordWrittenForm(state, event, operations);
    case "RECORD_LEGAL_FORM_CONTINUATION":
      return recordContinuation(state, event, decision, operations);
  }
}

function invalidPaperRegion(event: LegalPaperEvent): boolean {
  return event.region !== undefined && !["metro", "country"].includes(event.region);
}

function invalidPaperExpiry(event: LegalPaperEvent): boolean {
  return event.paperExpiresAt !== undefined && !Number.isFinite(event.paperExpiresAt);
}

function invalidWrittenFacts(event: WrittenFormEvent): boolean {
  return invalidPaperRegion(event) || !Number.isFinite(event.writtenAt) || invalidPaperExpiry(event);
}

function invalidContinuationFacts(event: ContinuationEvent): boolean {
  return invalidPaperRegion(event) || !Number.isFinite(event.startedAt) || invalidPaperExpiry(event);
}

function writtenFormKind(code: WrittenFormEvent["formCode"]): "examination" | "detention" | undefined {
  if (code === "1A") return "examination";
  if (code === "3A" || code === "3C" || code === "3D") return "detention";
  return undefined;
}

function writtenFormRegion(movement: Movement, event: WrittenFormEvent, sameFormTimeEdit: boolean) {
  if (event.region) return { region: event.region };
  if (sameFormTimeEdit && movement.legalForm?.region) return { region: movement.legalForm.region };
  return {};
}

function paperExpiryHistory(movement: Movement, event: LegalPaperEvent): Movement["legalFormExpiryHistory"] {
  if (event.paperExpiresAt === undefined) return movement.legalFormExpiryHistory;
  return [
    ...(movement.legalFormExpiryHistory ?? []),
    { at: event.now, by: event.role, dueAt: event.paperExpiresAt, basis: "written_on_form" },
  ];
}

function writtenFormRefusedAfterArrival(movement: Movement, event: WrittenFormEvent): boolean {
  return event.formCode === "3C" && form3CRefusedAfter3D(movement.legalForm?.code ?? movement.legalClock?.code);
}

function currentPaperExpiry(movement: Movement): number | undefined {
  if (movement.legalClock !== undefined && movement.legalForm?.dueAt === movement.legalClock.expiresAt) {
    return undefined;
  }
  return movement.legalForm?.dueAt;
}

function recordWrittenForm(
  state: WardFlowState,
  event: WrittenFormEvent,
  operations: LegalPaperOperations,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);

  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);

  if (movement.closure) {
    return operations.reject(
      state,
      event,
      `cannot record a written form for a closed movement (${movement.closure.reason})`,
    );
  }

  if (invalidWrittenFacts(event)) {
    return operations.reject(state, event, "Enter the time and expiry written on the form.");
  }

  if (!isLegalClockFormCode(event.formCode)) {
    return operations.reject(state, event, `Form ${event.formCode} is not a recognised legal form in this prototype`);
  }

  if (writtenFormRefusedAfterArrival(movement, event)) {
    return operations.reject(state, event, `Form 3C is refused when the person arrived on a Form 3D`);
  }

  return operations.replaceMovement(state, movement.id, writtenFormUpdate(movement, event));
}

function writtenFormUpdate(movement: Movement, event: WrittenFormEvent): Movement {
  const kind = writtenFormKind(event.formCode);

  // Editing the current form's written time preserves its recorded paper facts. A different
  // form starts new facts; a legacy calculated expiry is never promoted to paper authority.
  const sameFormTimeEdit = movement.legalForm?.code === event.formCode && event.paperExpiresAt === undefined;

  const existingExpiry = currentPaperExpiry(movement);

  const dueAt = event.paperExpiresAt ?? (sameFormTimeEdit ? existingExpiry : undefined);

  return {
    ...movement,
    formedAt: event.writtenAt,
    legalForm: {
      code: event.formCode,
      kind,
      ...writtenFormRegion(movement, event, sameFormTimeEdit),
      ...(dueAt === undefined ? {} : { dueAt }),
    },
    legalClock: undefined,
    legalFormReceivedAt: sameFormTimeEdit ? movement.legalFormReceivedAt : undefined,
    legalFormExpiryHistory: paperExpiryHistory(movement, event),
  };
}

function recordContinuation(
  state: WardFlowState,
  event: ContinuationEvent,
  decision: AuditDecision,
  operations: LegalPaperOperations,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);

  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);

  if (movement.closure)
    return operations.reject(state, event, "This record is closed, so no continuation can be added.");

  if (invalidContinuationFacts(event)) {
    return operations.reject(state, event, "Enter the time and expiry written on the form.");
  }

  if (!isLegalClockFormCode(event.formCode)) {
    return operations.reject(state, event, `Form ${event.formCode} is not a recognised legal form in this prototype`);
  }

  const expiryHistory = paperExpiryHistory(movement, event);

  const updated = continuationUpdate(movement, event, expiryHistory);
  decision.outcome = "accepted";
  decision.reasonCode = "none";
  return operations.replaceMovement(state, movement.id, updated);
}

function continuationUpdate(
  movement: Movement,
  event: ContinuationEvent,
  expiryHistory: Movement["legalFormExpiryHistory"],
): Movement {
  // Owner ruling 2026-09-25: a Form 5B CONTINUES a current Form 5A (one community treatment
  // order) rather than replacing it. The 5A record, its start (`formedAt`) and its receipt stay;
  // the 5B is recorded as `continuedBy`, and the current end is the 5B's typed end (unknown if
  // none was typed). The 5A's own typed end is kept on `continuedBy`. Nothing is computed.
  if (event.formCode === "5B" && movement.legalForm?.code === "5A") {
    return continuedFiveA(movement, event, expiryHistory);
  }

  // Any other continuation replaces current paper facts while retaining the earlier expiry history.
  return {
    ...movement,
    formedAt: event.startedAt,
    legalForm: {
      code: event.formCode,
      ...(event.region ? { region: event.region } : {}),
      ...(event.paperExpiresAt === undefined ? {} : { dueAt: event.paperExpiresAt }),
    },
    legalClock: undefined,
    legalFormReceivedAt: undefined,
    legalFormExpiryHistory: expiryHistory,
  };
}

function continuedFiveA(
  movement: Movement,
  event: ContinuationEvent,
  expiryHistory: Movement["legalFormExpiryHistory"],
): Movement {
  // A second 5B updates the continuation; the 5A's own typed end is kept from the first.
  const { dueAt: currentDueAt, continuedBy: earlier, ...fiveA } = movement.legalForm!;
  const continuedFormDueAt = earlier === undefined ? currentDueAt : earlier.continuedFormDueAt;
  return {
    ...movement,
    legalForm: {
      ...fiveA,
      ...(event.paperExpiresAt === undefined ? {} : { dueAt: event.paperExpiresAt }),
      continuedBy: {
        code: event.formCode,
        startedAt: event.startedAt,
        recordedAt: event.now,
        by: event.role,
        ...(continuedFormDueAt === undefined ? {} : { continuedFormDueAt }),
      },
    },
    legalClock: undefined,
    legalFormExpiryHistory: expiryHistory,
  };
}
