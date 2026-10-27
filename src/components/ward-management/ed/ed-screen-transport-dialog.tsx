"use client";

// "Transport booked": the popup that logs a transport booking made by phone. Split out of
// `ed-screen.tsx` unchanged (fix list 2.5 and 9.6, 15 Oct 2026). Since A34 (26 Oct 2026) the
// questions are the one transport booking form every screen uses; this file keeps the popup.
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { TransportExceptionReason } from "@/components/ward-management/ward-model";
import { TransportBookingForm } from "@/components/ward-management/transport/transport-booking-form";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import type { EdBoardRowModel } from "./ed-screen-board-row";
import type { EdScreenContext } from "./ed-screen-context";
import styles from "./ed.module.css";

/** The test ids the ED popup's tests and release gate already use. */
const ED_PART_NAMES = { cad: "transport-cad-number", legal: "transport-legal-status" } as const;

function EdTransportBooking({ row, ctx }: { row: EdBoardRowModel; ctx: EdScreenContext }) {
  const { movement, patientInfo } = row;
  const { now, closeTransportDialog, transportDraft, setTransportDraft, submitBookTransport } = ctx;
  const [legalReason, setLegalReason] = useState<TransportExceptionReason | "">("");
  const save = useWardFormSave(movement.id);
  return (
    <TransportBookingForm
      answers={transportDraft}
      onAnswers={setTransportDraft}
      legalReason={legalReason}
      onLegalReason={setLegalReason}
      record={movement}
      patientName={patientInfo.displayName}
      now={now}
      testIds={{ prefix: "ward-ed", suffix: movement.id, names: ED_PART_NAMES }}
      pending={save.pending}
      error={save.error}
      onSubmit={(booking) => submitBookTransport(movement.id, booking, save.submit)}
      onCancel={closeTransportDialog}
    />
  );
}

export function renderEdTransportDialog(row: EdBoardRowModel, ctx: EdScreenContext): ReactNode {
  const { movement, patientInfo, transportOpen, transportBlocked } = row;
  const { transportBackdropRef, setTransportDialogNode } = ctx;
  /*
   * ⚠️ **A POPUP (DIALOG), NOT AN INLINE PANEL — owner's third ruling, 2026-09-17.**
   * `role="dialog"`/`aria-modal="true"`/`aria-labelledby` name and announce it,
   * and `useModalFocus` beside `transportDialogRef` moves focus in on open, traps Tab
   * inside it, closes it on Escape and returns focus to the opener.
   *
   * ⚠️ **DELIBERATELY NOT A `<form>`.** A form submits on Enter from inside a field whatever its
   * submit button advertises, so an `aria-disabled` submit would let a half-answered booking
   * through by keyboard while the screen said it could not.
   */
  return transportOpen && !transportBlocked
    ? createPortal(
        // Since ED page A2 this dialog opens over the patient's sheet, which
        // inerts everything outside itself; these markers keep the dialog live
        // and stop the sheet taking its focus back. A stray tap on the backdrop
        // no longer closes it, because closing clears every answer typed in
        // (form friction audit, 27 Oct 2026). Cancel and Escape still close it.
        <div ref={transportBackdropRef} className={styles.modalBackdrop} data-sheet-inert-skip="" data-sheet-portal="">
          <div
            ref={setTransportDialogNode}
            className={styles.declineForm}
            data-testid={`ward-ed-book-transport-${movement.id}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`ward-ed-book-transport-title-${movement.id}`}
          >
            <h2 id={`ward-ed-book-transport-title-${movement.id}`} className={styles.declineLegend}>
              Log the transport booking made by phone for {patientInfo.displayName}
            </h2>
            <EdTransportBooking row={row} ctx={ctx} />
          </div>
        </div>,
        document.body,
      )
    : null;
}
