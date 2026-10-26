// The board row panels' submit handlers. Split out of `ed-screen.tsx` unchanged (fix list 2.5 and
// 9.6, 15 Oct 2026). A plain function, not a hook: `EdScreen` calls it after its early return, so
// `thisEdId` is the resolved department's own id, as it always was.
import type { FormEvent } from "react";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowContextValue } from "@/components/ward-management/ward-flow-provider";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import type { TransportBookingSubmission } from "@/components/ward-management/transport/transport-booking-form";
import type { WardFormSave } from "@/components/ward-management/use-ward-form-save";
import type { useEdRowPanels } from "./use-ed-screen-state";
import type { useEdRecordSave } from "./use-ed-record-save";

export function edScreenActions({
  raise,
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
  const { setWithdrawOpenFor, closeTransportDialog } = panels;

  function confirmWithdrawReferral(movementId: string) {
    raise("WITHDRAW_REFERRAL", { movementId, actingPlaceId: thisEdId });
    setWithdrawOpenFor(undefined);
  }

  // A34: the shared booking form hands over a complete booking only. The popup stays open with its
  // answers until the save is accepted (audit 24-3 SV-2), and says why when it is not.
  function submitBookTransport(movementId: string, booking: TransportBookingSubmission, save: WardFormSave["submit"]) {
    save(() => raise("BOOK_TRANSPORT", { movementId, ...booking }), closeTransportDialog);
  }

  return {
    submitExamination,
    confirmWithdrawReferral,
    submitLegalFormExpiry,
    submitBookTransport,
    ...recordSave,
  };
}
