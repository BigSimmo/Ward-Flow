// The board row panels' submit handlers. Split out of `ed-screen.tsx` unchanged (fix list 2.5 and
// 9.6, 15 Oct 2026). A plain function, not a hook: `EdScreen` calls it after its early return, so
// `thisEdId` is the resolved department's own id, as it always was.
import type { FormEvent } from "react";
import type { Instant } from "@/components/ward-management/ward-clock";
import { cadNumberProblem } from "@/components/ward-management/ward-cad-number";
import type { WardFlowContextValue } from "@/components/ward-management/ward-flow-provider";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import { instantFromEstimatedTimeInputs } from "@/components/ward-management/ward-transport-checks";
import type { useEdRowPanels } from "./use-ed-screen-state";
import type { useEdRecordSave } from "./use-ed-record-save";

export function edScreenActions({
  raise,
  now,
  thisEdId,
  submitExamination,
  submitLegalFormExpiry,
  recordSave,
  panels,
}: {
  raise: WardRaise;
  now: Instant;
  dayZero: WardFlowContextValue["dayZero"];
  thisEdId: string;
  submitExamination: (event: FormEvent<HTMLFormElement>, movementId: string) => void;
  submitLegalFormExpiry: (
    event: FormEvent<HTMLFormElement>,
    movementId: string,
    currentDueAt: Instant | undefined,
  ) => void;
  recordSave: Pick<
    ReturnType<typeof useEdRecordSave>,
    "submitUrgencyChange" | "submitLegalStatusChange" | "submitReceiptCorrection"
  >;
  panels: ReturnType<typeof useEdRowPanels>;
}) {
  const { setWithdrawOpenFor, transportDraft, closeTransportDialog } = panels;

  function confirmWithdrawReferral(movementId: string) {
    raise("WITHDRAW_REFERRAL", { movementId, actingPlaceId: thisEdId });
    setWithdrawOpenFor(undefined);
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
      cadNumberProblem(cadNumber) !== undefined ||
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
    confirmWithdrawReferral,
    submitLegalFormExpiry,
    submitBookTransport,
    ...recordSave,
  };
}
