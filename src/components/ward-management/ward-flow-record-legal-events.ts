// The RECORD_* events about legal forms and orders: typed expiries, forms written, country
// extensions, continuations and community treatment orders. Moved out of
// `ward-flow-record-events.ts` unchanged, which hands these events here.
import type { AuditDecision } from "./ward-audit";
import type { WardFlowState } from "./ward-flow-reducer";
import type { RecordedFactEvent, RecordedFactEventHelpers } from "./ward-flow-record-events";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-events";
import { form3CRefusedAfter3D, isLegalClockFormCode } from "@/components/ward-management/ward-legal-clock";
import { countryExtensionEligible } from "@/components/ward-management/ward-legal-forms";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-events";
import type { LegalForm, Movement } from "@/components/ward-management/ward-model";
import { LEGAL_FORM_EXPIRY_CORRECTION_REASONS } from "./ward-model-vocabulary";

type RecordedLegalEvent = Extract<
  RecordedFactEvent,
  {
    type:
      | "RECORD_LEGAL_FORM_EXPIRY"
      | "RECORD_COMMUNITY_TREATMENT_ORDER"
      | "RECORD_LEGAL_FORM_WRITTEN"
      | "RECORD_COUNTRY_EXTENSION"
      | "RECORD_LEGAL_FORM_CONTINUATION";
  }
>;

export function reduceRecordedLegalEvent(
  state: WardFlowState,
  event: RecordedLegalEvent,
  decision: AuditDecision,
  helpers: RecordedFactEventHelpers,
): WardFlowState {
  const { findMovement, reduceClinicalEvent, reject, replaceMovement } = helpers;
  switch (event.type) {
    /**
     * T2 (owner answer 1, item 5): the clinician types the expiry written on the form, for any
     * form, and later any extension from a fresh form. Whether this is an extension is read off the
     * state, never a caller flag.
     */
    case "RECORD_LEGAL_FORM_EXPIRY": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // T2r finding 11: a fixed sentence, never interpolating the clinical `closure.reason`.
      if (movement.closure) {
        return reject(state, event, "This record is closed, so no expiry can be added to it.");
      }
      // §2's exact sentence — there is no form here to attach a typed expiry to, so this refuses
      // rather than inventing one.
      if (!movement.legalForm) {
        return reject(state, event, "There is no legal form on this record to add an expiry to.");
      }
      // T2r finding 8: `Instant` is a bare number, so a non-finite value is refused before it
      // becomes an expiry nothing can compare or render.
      if (!Number.isFinite(event.dueAt)) {
        return reject(state, event, "Enter the expiry written on the form.");
      }
      const currentDueAt = movement.legalForm.dueAt;
      // Legacy calculated clocks are not paper authority. The six authored fixture values and
      // current entered values are; absence of an old actor-history record does not discard them.
      const legacyCalculatedExpiry =
        movement.legalClock !== undefined && currentDueAt === movement.legalClock.expiresAt;
      if (event.correction !== undefined) {
        const correction = event.correction;
        if (
          correction === null ||
          typeof correction !== "object" ||
          Array.isArray(correction) ||
          !LEGAL_FORM_EXPIRY_CORRECTION_REASONS.includes(correction.reason) ||
          !Number.isFinite(correction.expectedDueAt) ||
          (correction.expectedFormWrittenAt !== null && !Number.isFinite(correction.expectedFormWrittenAt))
        ) {
          return reject(state, event, "Record the checked paper facts and a correction reason.");
        }
        if (
          currentDueAt === undefined ||
          legacyCalculatedExpiry ||
          correction.expectedDueAt !== currentDueAt ||
          correction.expectedFormCode !== movement.legalForm.code ||
          correction.expectedFormWrittenAt !== (movement.formedAt ?? null)
        ) {
          return reject(
            state,
            event,
            "The recorded paper facts changed. Check the current form before correcting its expiry.",
          );
        }
        if (event.dueAt === currentDueAt) {
          return reject(state, event, "The corrected expiry must differ from the expiry already recorded.");
        }
        const updated: Movement = {
          ...movement,
          legalForm: { ...movement.legalForm, dueAt: event.dueAt },
          legalClock: undefined,
          legalFormExpiryHistory: [
            ...(movement.legalFormExpiryHistory ?? []),
            { at: event.now, by: event.role, dueAt: event.dueAt, basis: "correction" },
          ],
          legalFormExpiryCorrections: [
            ...(movement.legalFormExpiryCorrections ?? []),
            {
              at: event.now,
              by: event.role,
              formCode: movement.legalForm.code,
              ...(movement.formedAt === undefined ? {} : { formWrittenAt: movement.formedAt }),
              from: currentDueAt,
              to: event.dueAt,
              reason: correction.reason,
            },
          ],
        };
        decision.outcome = "accepted";
        decision.reasonCode = "none";
        return replaceMovement(state, movement.id, updated);
      }
      const isExtension = currentDueAt !== undefined && !legacyCalculatedExpiry;
      // An extension only ever moves an expiry later; the clinician types it, this only orders it
      // against what is recorded.
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
      // Only an order still in force refuses a new one. An ended order is kept below (D-40), so a
      // patient can be placed on a second CTO without the first leaving Documents.
      if (patient.communityTreatmentOrder && patient.communityTreatmentOrder.endedAt === undefined) {
        return reject(state, event, `patient ${patient.id} already has a community treatment order recorded`);
      }
      // The Patient page shows an open placement or occupied stay ahead of a CTO, so an order
      // recorded now would save unseen. Refused until the placement closes or the stay ends. A
      // waitlisted or pulled stay alone does not count.
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
      // D-40: an ended order is kept in `earlier` rather than overwritten, so Documents still lists it.
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
        (event.ageBand != null && !["adult", "under_18"].includes(event.ageBand)) ||
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
      // Editing the current form's written time preserves its recorded paper facts. A different
      // form starts new facts; a legacy calculated expiry is never promoted to paper authority.
      const sameFormTimeEdit = movement.legalForm?.code === event.formCode && event.paperExpiresAt === undefined;
      const currentPaperExpiry =
        movement.legalClock !== undefined && movement.legalForm?.dueAt === movement.legalClock.expiresAt
          ? undefined
          : movement.legalForm?.dueAt;
      // A1-5: A written form expiry cannot shorten an existing recorded expiry on the same form.
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
          ...(event.ageBand
            ? { ageBand: event.ageBand }
            : event.ageBand === undefined && sameFormTimeEdit && movement.legalForm?.ageBand
              ? { ageBand: movement.legalForm.ageBand }
              : {}),
          ...(dueAt === undefined ? {} : { dueAt }),
          ...formHistoryAfter(movement, sameFormTimeEdit, event),
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
      const next = reduceClinicalEvent(
        state,
        {
          type: "RECORD_LEGAL_FORM_EXPIRY",
          role: event.role,
          now: event.now,
          movementId: event.movementId,
          dueAt: event.paperExpiresAt,
        },
        decision,
      );
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
      // Owner ruling: a Form 5B continues a current Form 5A (one community treatment order) rather
      // than replacing it. The 5A record, `formedAt` and receipt stay; the 5B is recorded as
      // `continuedBy`, and the current end is the 5B's typed end. Nothing is computed.
      if (event.formCode === "5B" && movement.legalForm?.code === "5A") {
        // A second 5B updates the continuation; the 5A's own typed end is kept from the first.
        const { dueAt: currentDueAt, continuedBy: earlier, ...fiveA } = movement.legalForm;
        // Audit 2 E-15: the very same 5B again (same start, no new end) is refused rather than
        // rewriting its recorded times; a later or corrected 5B keeps the earlier one in
        // `earlierContinuations`.
        if (
          earlier !== undefined &&
          earlier.code === event.formCode &&
          earlier.startedAt === event.startedAt &&
          (event.paperExpiresAt ?? currentDueAt) === currentDueAt
        ) {
          return reject(state, event, "This 5B is already recorded with that start time.");
        }
        const continuedFormDueAt = earlier === undefined ? currentDueAt : earlier.continuedFormDueAt;
        const continued: Movement = {
          ...movement,
          legalForm: {
            ...fiveA,
            ...(event.paperExpiresAt === undefined ? {} : { dueAt: event.paperExpiresAt }),
            ...(earlier === undefined
              ? {}
              : { earlierContinuations: [...(fiveA.earlierContinuations ?? []), earlier] }),
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
      // Any other continuation replaces current paper facts while retaining the earlier expiry history.
      const updated: Movement = {
        ...movement,
        formedAt: event.startedAt,
        legalForm: {
          code: event.formCode,
          ...(event.region ? { region: event.region } : {}),
          ...(event.paperExpiresAt === undefined ? {} : { dueAt: event.paperExpiresAt }),
          ...formHistoryAfter(movement, false, event),
        },
        legalClock: undefined,
        legalFormReceivedAt: undefined,
        legalFormExpiryHistory: expiryHistory,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceMovement(state, movement.id, updated);
    }
  }
  return state;
}

/**
 * Audit 2 E-16 (Josh, 20 Oct 2026): a new form keeps the one it replaces as history, as the CTO and
 * examinations already do. A time edit of the same form replaces nothing, so carries the list on.
 */
function formHistoryAfter(
  movement: Movement,
  sameFormTimeEdit: boolean,
  event: { now: Instant; role: WardFlowRole },
): Pick<LegalForm, "earlierForms"> {
  const current = movement.legalForm;
  if (current === undefined) return {};
  const { earlierForms = [], ...replaced } = current;
  if (sameFormTimeEdit) return earlierForms.length === 0 ? {} : { earlierForms };
  return {
    earlierForms: [
      ...earlierForms,
      {
        ...replaced,
        ...(movement.formedAt === undefined ? {} : { writtenAt: movement.formedAt }),
        ...(movement.legalFormReceivedAt === undefined ? {} : { receivedAt: movement.legalFormReceivedAt }),
        at: event.now,
        by: event.role,
      },
    ],
  };
}
