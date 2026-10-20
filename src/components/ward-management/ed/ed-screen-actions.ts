// The board row panels' submit handlers. Split out of `ed-screen.tsx` unchanged (fix list 2.5 and
// 9.6, 15 Oct 2026). A plain function, not a hook: `EdScreen` calls it after its early return, so
// `thisEdId` is the resolved department's own id, as it always was.
import type { FormEvent } from "react";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowContextValue } from "@/components/ward-management/ward-flow-provider";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import { instantFromEstimatedTimeInputs } from "@/components/ward-management/ward-transport-checks";
import { BLANK_TYPED_EXPIRY_DRAFT, instantFromDateAndTimeInputs, type EdStepEvent } from "./ed-screen-model";
import type { useEdRowPanels } from "./use-ed-screen-state";

export function edScreenActions({
  raise,
  now,
  dayZero,
  thisEdId,
  recordEdStep,
  panels,
}: {
  raise: WardRaise;
  now: Instant;
  dayZero: WardFlowContextValue["dayZero"];
  thisEdId: string;
  recordEdStep: (event: EdStepEvent) => void;
  panels: ReturnType<typeof useEdRowPanels>;
}) {
  const {
    examinationOutcome,
    setExaminationOpenFor,
    setExaminationOutcome,
    urgencyDraft,
    setUrgencyChangeOpenFor,
    legalStatusDraft,
    setLegalStatusChangeOpenFor,
    setWithdrawOpenFor,
    legalFormExpiryDraft,
    setLegalFormExpiryOpenFor,
    setLegalFormExpiryDraft,
    receiptCorrectionReasonDraft,
    setReceiptCorrectionOpenFor,
    setReceiptCorrectionReasonDraft,
    transportDraft,
    closeTransportDialog,
  } = panels;

  function submitExamination(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    if (!examinationOutcome) return;
    recordEdStep({ type: "RECORD_EXAMINATION", role: "ed", now, movementId, outcome: examinationOutcome });
    setExaminationOpenFor(undefined);
    setExaminationOutcome(undefined);
  }

  function submitUrgencyChange(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    // A real <form>: Enter inside a field submits it whatever the button advertises.
    if (urgencyDraft.reason === undefined) return;
    raise("CHANGE_URGENCY", {
      movementId,
      urgency: urgencyDraft.urgency,
      reason: urgencyDraft.reason,
    });
    setUrgencyChangeOpenFor(undefined);
  }

  function submitLegalStatusChange(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    // This IS a real <form>, so Enter inside a field submits it whatever the button advertises —
    // the same bypass the raise-referral form guards. An `aria-disabled` control alone would not
    // catch it, and the reducer requires a reason, so an unguarded Enter would dispatch `undefined`.
    if (legalStatusDraft.legalStatus === undefined || legalStatusDraft.reason === undefined) return;
    raise("CHANGE_LEGAL_STATUS", {
      movementId,
      legalStatus: legalStatusDraft.legalStatus,
      reason: legalStatusDraft.reason,
    });
    setLegalStatusChangeOpenFor(undefined);
  }

  function confirmWithdrawReferral(movementId: string) {
    raise("WITHDRAW_REFERRAL", { movementId, actingPlaceId: thisEdId });
    setWithdrawOpenFor(undefined);
  }

  function submitLegalFormExpiry(
    event: FormEvent<HTMLFormElement>,
    movementId: string,
    currentDueAt: Instant | undefined,
  ) {
    event.preventDefault();
    // A real <form>: Enter inside a field submits it whatever the button advertises, the same
    // bypass every other panel on this screen guards against.
    const dueAt = instantFromDateAndTimeInputs(legalFormExpiryDraft.date, legalFormExpiryDraft.time, dayZero);
    // Never dispatched half-answered or backwards. Both refusals are the reducer's own rule
    // ("There is no legal form…"/"An extension's new expiry must be later…") — this mirrors them
    // rather than owning them, the same discipline `submitBookTransport` below holds to, so the
    // control never advertises a save it already knows the reducer would refuse.
    if (dueAt === undefined) return;
    if (currentDueAt !== undefined && dueAt <= currentDueAt) return;
    raise("RECORD_LEGAL_FORM_EXPIRY", { movementId, dueAt });
    setLegalFormExpiryOpenFor(undefined);
    setLegalFormExpiryDraft(BLANK_TYPED_EXPIRY_DRAFT);
  }

  function submitReceiptCorrection(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    // A real <form>: Enter inside a field submits it whatever the button advertises, the same
    // bypass every other panel on this screen guards against — the reducer requires a reason, so
    // an unguarded Enter would dispatch `undefined`.
    if (receiptCorrectionReasonDraft === undefined) return;
    raise("CORRECT_LEGAL_FORM_RECEIPT", {
      movementId,
      reason: receiptCorrectionReasonDraft,
    });
    setReceiptCorrectionOpenFor(undefined);
    setReceiptCorrectionReasonDraft(undefined);
  }

  function submitBookTransport(movementId: string) {
    const { provider, escortRequired, cadNumber, transportLegalStatus, estimatedTime, estimatedDay } = transportDraft;
    const estimatedAt = instantFromEstimatedTimeInputs(estimatedTime, estimatedDay, now);
    // Never dispatched half-answered. The reducer would refuse it — that refusal is the rule's
    // real home — but a refusal raised from here would be invisible to whoever pressed the button,
    // so the control declines to advertise a booking it knows would be rejected.
    if (
      provider === undefined ||
      escortRequired === undefined ||
      cadNumber.trim().length === 0 ||
      transportLegalStatus === undefined ||
      estimatedAt === undefined
    ) {
      return;
    }
    raise("BOOK_TRANSPORT", {
      movementId,
      provider,
      escortRequired,
      cadNumber: cadNumber.trim(),
      transportLegalStatus,
      estimatedAt,
    });
    closeTransportDialog();
  }

  return {
    submitExamination,
    submitUrgencyChange,
    submitLegalStatusChange,
    confirmWithdrawReferral,
    submitLegalFormExpiry,
    submitReceiptCorrection,
    submitBookTransport,
  };
}
