"use client";

// "Log transport booking": the popup that logs a transport booking made by phone. Split out of
// `ed-screen.tsx` (fix list 2.5 and 9.6, 15 Oct 2026). Since A34 (26 Oct 2026) the questions are
// the one transport booking form every screen uses; this file keeps the popup. Redesign (Josh,
// 31 Oct 2026, "Yes to all"): the kit's dialog with a one-line title and the person, surname
// first, named once under it.
import { useMemo, useState, type ReactNode, type RefObject } from "react";
import { Dialog } from "@/components/wf";
import type { TransportExceptionReason } from "@/components/ward-management/ward-model";
import { TransportBookingForm } from "@/components/ward-management/transport/transport-booking-form";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import type { EdBoardRowModel } from "./ed-screen-board-row";
import type { EdScreenContext } from "./ed-screen-context";

/** The test ids the ED popup's tests and release gate already use. */
const ED_PART_NAMES = { cad: "transport-cad-number", legal: "transport-legal-status" } as const;

/*
 * ⚠️ **A POPUP (DIALOG), NOT AN INLINE PANEL — owner's third ruling, 2026-09-17.** The kit's
 * `Dialog` names and announces it, moves focus in on open, traps Tab inside it, closes it on Escape
 * and returns focus to the opener. It joins the shared sheet stack, so it stays live over the
 * patient's sheet, which inerts everything outside the top layer.
 *
 * A stray tap on the backdrop does not close it (`closeOnScrim={false}`), because closing clears
 * every answer typed in (form friction audit, 27 Oct 2026). Cancel, Close and Escape still close it.
 *
 * ⚠️ **DELIBERATELY NOT A `<form>`.** A form submits on Enter from inside a field whatever its
 * submit button advertises, so an `aria-disabled` submit would let a half-answered booking
 * through by keyboard while the screen said it could not.
 */
function EdTransportDialog({ row, ctx }: { row: EdBoardRowModel; ctx: EdScreenContext }) {
  const { movement, patientInfo } = row;
  const { now, closeTransportDialog, transportDraft, setTransportDraft, submitBookTransport } = ctx;
  const [legalReason, setLegalReason] = useState<TransportExceptionReason | "">("");
  const save = useWardFormSave(movement.id);
  // Focus starts on the first question (who is collecting), as the popup did before the kit dialog.
  const firstQuestion = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        return document.querySelector<HTMLElement>(`[data-testid="ward-ed-transport-provider-${movement.id}"]`);
      },
    }),
    [movement.id],
  );
  return (
    <Dialog
      open
      onClose={closeTransportDialog}
      closeOnScrim={false}
      title="Log transport booking"
      // Surname first (D-83), named once under the one-line title.
      description={`${patientInfo.formalName} · booked by phone. Fill in each answer as the provider gives it.`}
      size="md"
      initialFocusRef={firstQuestion}
      data-testid={`ward-ed-book-transport-${movement.id}`}
    >
      <TransportBookingForm
        answers={transportDraft}
        onAnswers={setTransportDraft}
        legalReason={legalReason}
        onLegalReason={setLegalReason}
        record={movement}
        patientName={patientInfo.formalName}
        now={now}
        testIds={{ prefix: "ward-ed", suffix: movement.id, names: ED_PART_NAMES }}
        pending={save.pending}
        error={save.error}
        onSubmit={(booking) => submitBookTransport(movement.id, booking, save.submit)}
        onCancel={closeTransportDialog}
      />
    </Dialog>
  );
}

export function renderEdTransportDialog(row: EdBoardRowModel, ctx: EdScreenContext): ReactNode {
  const { movement, transportOpen, transportBlocked } = row;
  return transportOpen && !transportBlocked ? <EdTransportDialog key={movement.id} row={row} ctx={ctx} /> : null;
}
