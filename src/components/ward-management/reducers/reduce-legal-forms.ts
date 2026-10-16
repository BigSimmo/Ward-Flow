import type { AuditDecision } from "../ward-audit";
import { LEGAL_FORM_RECEIPT_CORRECTION_REASONS } from "../ward-change-reasons";
import { WARD_FLOW_ROLE_LABELS, type WardFlowEvent } from "../ward-flow-events";
import type { WardFlowState } from "../ward-flow-reducer";
import { countryExtensionEligible } from "../ward-legal-forms";
import type { Movement, Unit } from "../ward-model";
import { form3CRefusedAfter3D, isLegalClockFormCode } from "../ward-legal-clock";

export type LegalFormsContext = {
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;
  findMovement: (state: WardFlowState, movementId: string) => Movement | undefined;
  replaceMovement: (state: WardFlowState, movementId: string, next: Movement) => WardFlowState;
  findUnit: (state: WardFlowState, unitId: string) => Unit | undefined;
};

export function reduceLegalForms(
  state: WardFlowState,
  event: WardFlowEvent,
  decision: AuditDecision,
  context: LegalFormsContext,
): WardFlowState {
  const { reject, findMovement, replaceMovement, findUnit } = context;

  switch (event.type) {
    case "RECORD_LEGAL_FORM_RECEIVED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(
          state,
          event,
          `cannot mark legal form received for a closed movement (${movement.closure.reason})`,
        );
      }
      if (movement.legalFormReceivedAt !== undefined) {
        return reject(state, event, `legal form for movement ${movement.id} was already marked as received`);
      }
      if (!movement.legalForm || !isLegalClockFormCode(movement.legalForm.code)) {
        return reject(
          state,
          event,
          `movement ${movement.id} does not carry a receivable legal form (legal form ${movement.legalForm?.code ?? "none"}), so a legal form receipt cannot be recorded against it`,
        );
      }
      const updated: Movement = {
        ...movement,
        legalFormReceivedAt: event.now,
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "CORRECT_LEGAL_FORM_RECEIPT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(
          state,
          event,
          `cannot correct a legal form receipt for a closed movement (${movement.closure.reason})`,
        );
      }
      if (movement.legalFormReceivedAt === undefined) {
        return reject(state, event, `movement ${movement.id} has no recorded legal form receipt to correct`);
      }
      if (!LEGAL_FORM_RECEIPT_CORRECTION_REASONS.includes(event.reason)) {
        return reject(
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
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceMovement(state, movement.id, updated);
    }

    case "RECORD_LEGAL_FORM_EXPIRY": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, "This record is closed, so no expiry can be added to it.");
      }
      if (!movement.legalForm) {
        return reject(state, event, "There is no legal form on this record to add an expiry to.");
      }
      if (!Number.isFinite(event.dueAt)) {
        return reject(state, event, "Enter the expiry written on the form.");
      }
      const currentDueAt = movement.legalForm.dueAt;
      const legacyCalculatedExpiry =
        movement.legalClock !== undefined && currentDueAt === movement.legalClock.expiresAt;
      const isExtension = currentDueAt !== undefined && !legacyCalculatedExpiry;
      if (isExtension && event.dueAt <= currentDueAt) {
        return reject(state, event, "An extension's new expiry must be later than the expiry already recorded.");
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
      return replaceMovement(state, movement.id, updated);
    }

    case "RECORD_COMMUNITY_TREATMENT_ORDER": {
      const patient = state.patients.find((candidate) => candidate.id === event.patientId);
      if (!patient) return reject(state, event, `no patient found for id ${event.patientId}`);
      if (patient.communityTreatmentOrder && patient.communityTreatmentOrder.endedAt === undefined) {
        return reject(state, event, `patient ${patient.id} already has a community treatment order recorded`);
      }
      const openStay = state.admissions.some((stay) => stay.patientId === patient.id && stay.state === "occupied");
      const openPlacement = state.movements.some(
        (movement) => movement.patientId === patient.id && !movement.closure && movement.stage !== "arrived",
      );
      if (openStay || openPlacement) {
        return reject(
          state,
          event,
          `patient ${patient.id} has an open placement or stay; record the order once it has closed`,
        );
      }
      const previous = patient.communityTreatmentOrder;
      const earlier =
        previous?.endedAt !== undefined
          ? [
              ...(previous.earlier ?? []),
              {
                form: previous.form,
                recordedAt: previous.recordedAt,
                recordedBy: previous.recordedBy,
                endedAt: previous.endedAt,
              },
            ]
          : undefined;
      const order = {
        form: "5A" as const,
        recordedAt: event.now,
        recordedBy: WARD_FLOW_ROLE_LABELS[event.role],
        ...(earlier ? { earlier } : {}),
      };
      return {
        ...state,
        patients: state.patients.map((candidate) =>
          candidate.id === patient.id ? { ...candidate, communityTreatmentOrder: order } : candidate,
        ),
      };
    }

    case "END_COMMUNITY_TREATMENT_ORDER": {
      const patient = state.patients.find((candidate) => candidate.id === event.patientId);
      if (!patient) return reject(state, event, `no patient found for id ${event.patientId}`);
      if (!patient.communityTreatmentOrder || patient.communityTreatmentOrder.endedAt !== undefined) {
        return reject(state, event, `patient ${patient.id} has no community treatment order recorded`);
      }
      const ended = { ...patient.communityTreatmentOrder, endedAt: event.now };
      return {
        ...state,
        patients: state.patients.map((candidate) =>
          candidate.id === patient.id ? { ...candidate, communityTreatmentOrder: ended } : candidate,
        ),
      };
    }

    case "RECORD_LEGAL_FORM_WRITTEN": {
      if (event.role !== "ed" && event.role !== "coordinator") {
        return reject(
          state,
          event,
          `${event.role} cannot record a written legal form; only ed and coordinator may record written forms`,
        );
      }
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot record a written form for a closed movement (${movement.closure.reason})`);
      }
      if (
        (event.region !== undefined && !["metro", "country"].includes(event.region)) ||
        !Number.isFinite(event.writtenAt) ||
        (event.paperExpiresAt !== undefined && !Number.isFinite(event.paperExpiresAt))
      ) {
        return reject(state, event, "Enter the time and expiry written on the form.");
      }
      if (!isLegalClockFormCode(event.formCode)) {
        return reject(state, event, `Form ${event.formCode} is not a recognised legal form in this prototype`);
      }
      if (event.formCode === "3C" && form3CRefusedAfter3D(movement.legalForm?.code ?? movement.legalClock?.code)) {
        return reject(state, event, `Form 3C is refused when the person arrived on a Form 3D`);
      }
      const kind =
        event.formCode === "1A"
          ? ("examination" as const)
          : event.formCode === "3A" || event.formCode === "3C" || event.formCode === "3D"
            ? ("detention" as const)
            : undefined;
      const sameFormTimeEdit = movement.legalForm?.code === event.formCode && event.paperExpiresAt === undefined;
      const currentPaperExpiry =
        movement.legalClock !== undefined && movement.legalForm?.dueAt === movement.legalClock.expiresAt
          ? undefined
          : movement.legalForm?.dueAt;
      if (
        movement.legalForm?.code === event.formCode &&
        currentPaperExpiry !== undefined &&
        event.paperExpiresAt !== undefined &&
        event.paperExpiresAt < currentPaperExpiry
      ) {
        return reject(state, event, "A written form expiry cannot shorten an existing recorded expiry.");
      }
      const dueAt = event.paperExpiresAt ?? (sameFormTimeEdit ? currentPaperExpiry : undefined);
      const updated: Movement = {
        ...movement,
        formedAt: event.writtenAt,
        legalForm: {
          code: event.formCode,
          kind,
          ...(event.region
            ? { region: event.region }
            : sameFormTimeEdit && movement.legalForm?.region
              ? { region: movement.legalForm.region }
              : {}),
          ...(dueAt === undefined ? {} : { dueAt }),
        },
        legalClock: undefined,
        legalFormReceivedAt: sameFormTimeEdit ? movement.legalFormReceivedAt : undefined,
        legalFormExpiryHistory:
          event.paperExpiresAt === undefined
            ? movement.legalFormExpiryHistory
            : [
                ...(movement.legalFormExpiryHistory ?? []),
                { at: event.now, by: event.role, dueAt: event.paperExpiresAt, basis: "written_on_form" },
              ],
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "RECORD_COUNTRY_EXTENSION": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure || event.paperExpiresAt === undefined || !Number.isFinite(event.paperExpiresAt))
        return reject(
          state,
          event,
          "Country extensions are recorded as a typed expiry. Enter the new expiry written on the country extension form.",
        );
      if (!countryExtensionEligible(movement))
        return reject(
          state,
          event,
          "A country extension requires a current Form 1A with its paper setting recorded as country.",
        );
      const expiryEvent: Extract<WardFlowEvent, { type: "RECORD_LEGAL_FORM_EXPIRY" }> = {
        type: "RECORD_LEGAL_FORM_EXPIRY",
        role: event.role,
        now: event.now,
        movementId: event.movementId,
        dueAt: event.paperExpiresAt,
      };
      const next = reduceLegalForms(state, expiryEvent, decision, context);
      if (next.rejections.length === state.rejections.length) {
        decision.outcome = "accepted";
        decision.reasonCode = "none";
      }
      return next;
    }

    case "RECORD_LEGAL_FORM_CONTINUATION": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) return reject(state, event, "This record is closed, so no continuation can be added.");
      if (
        (event.region !== undefined && !["metro", "country"].includes(event.region)) ||
        !Number.isFinite(event.startedAt) ||
        (event.paperExpiresAt !== undefined && !Number.isFinite(event.paperExpiresAt))
      ) {
        return reject(state, event, "Enter the time and expiry written on the form.");
      }
      if (!isLegalClockFormCode(event.formCode)) {
        return reject(state, event, `Form ${event.formCode} is not a recognised legal form in this prototype`);
      }
      const expiryHistory =
        event.paperExpiresAt === undefined
          ? movement.legalFormExpiryHistory
          : [
              ...(movement.legalFormExpiryHistory ?? []),
              { at: event.now, by: event.role, dueAt: event.paperExpiresAt, basis: "written_on_form" as const },
            ];
      if (event.formCode === "5B" && movement.legalForm?.code === "5A") {
        const { dueAt: currentDueAt, continuedBy: earlier, ...fiveA } = movement.legalForm;
        const continuedFormDueAt = earlier === undefined ? currentDueAt : earlier.continuedFormDueAt;
        const continued: Movement = {
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
        decision.outcome = "accepted";
        decision.reasonCode = "none";
        return replaceMovement(state, movement.id, continued);
      }
      const updated: Movement = {
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
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceMovement(state, movement.id, updated);
    }

    case "FLAG_LEGAL_MISMATCH": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) return reject(state, event, "This movement is closed.");
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      const involuntary = movement.legalStatus !== "Voluntary";
      const derived =
        involuntary && !unit.authorised
          ? ("involuntary_on_voluntary_ward" as const)
          : movement.legalStatus === "Voluntary" && unit.lockedBeds > 0 && unit.beds - unit.lockedBeds <= 0
            ? ("voluntary_on_locked_ward" as const)
            : null;
      if (!derived || event.kind !== derived)
        return reject(state, event, "The selected legal mismatch must match the current ward and patient status.");
      const kind = derived;
      const updated: Movement = {
        ...movement,
        legalMismatch: { at: event.now, unitId: event.unitId, kind },
      };
      return replaceMovement(state, movement.id, updated);
    }

    default:
      return state;
  }
}
