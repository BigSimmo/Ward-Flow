"use client";

// Preview copy of `CommunityScreenTransportBookDialog` in
// src/components/ward-management/community/community-screen-transport-dialogs.tsx: Log transport booking
// on the kit Dialog, with the redesigned booking form the ED board's Log transport mock-up uses (the one
// transport booking form, A34). The draft, the save and its answers are today's.

import { useCallback, useState } from "react";

import { Dialog } from "@/components/wf";
import type { TransportExceptionReason } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import type { CommunityScreenView } from "@/components/ward-management/community/community-screen";
import { LogTransportBookingForm } from "@/components/ward-redesign/pop-log-transport/log-transport-booking-form";

import styles from "./community-transport-book-dialog.module.css";

/** The fields of the page's view this dialog reads (the page passes its whole view). */
type TransportBookView = Pick<
  CommunityScreenView,
  | "now"
  | "transportBookFor"
  | "transportDraft"
  | "setTransportDraft"
  | "closeTransportBook"
  | "transportBookDialogRef"
  | "submitBookTransport"
  | "movements"
  | "umrnLookup"
>;

/** Logs a transport booking made by phone, with the one transport booking form (A34). Renders nothing until one is opened. */
export function CommunityTransportBookDialog({ view }: { view: TransportBookView }) {
  const {
    now,
    transportBookFor,
    transportDraft,
    setTransportDraft,
    closeTransportBook,
    transportBookDialogRef,
    submitBookTransport,
    movements,
    umrnLookup,
  } = view;
  const save = useWardFormSave(transportBookFor ?? "");
  const [legalReason, setLegalReason] = useState<TransportExceptionReason | "">("");
  // A new opening starts with no reason, as it starts with a blank draft.
  const [reasonFor, setReasonFor] = useState(transportBookFor);
  if (reasonFor !== transportBookFor) {
    setReasonFor(transportBookFor);
    setLegalReason("");
  }
  // The page's own focus hook holds this ref; it points at the kit Dialog's panel.
  const bindPage = useCallback(
    (node: HTMLDivElement | null) => {
      transportBookDialogRef.current = node?.closest<HTMLDivElement>('[role="dialog"]') ?? null;
    },
    [transportBookDialogRef],
  );
  if (transportBookFor === undefined) return null;
  const movement = movements.find((candidate) => candidate.id === transportBookFor);
  // Surname first (D-83), as every list names a person. The movement id is never a person's name.
  const patientName = movement ? resolveSubjectPatient(movement, umrnLookup).formalName : "the patient";
  return (
    <Dialog
      open
      onClose={closeTransportBook}
      // A stray tap on the backdrop does not close the booking, because closing clears every answer
      // typed in (form friction audit, 27 Oct 2026). Close, Cancel and Escape still do.
      closeOnScrim={false}
      // Redesign: a one-line title, as the ED board's Log transport booking; who and how move under it.
      title="Log transport booking"
      description={`${patientName} · booked by phone. Read each answer off the call with the provider.`}
      closeLabel="Close dialog"
      size="md"
      className={styles.panel}
      data-testid={`ward-community-book-transport-dialog-${transportBookFor}`}
    >
      <div ref={bindPage}>
        <LogTransportBookingForm
          answers={transportDraft}
          onAnswers={setTransportDraft}
          legalReason={legalReason}
          onLegalReason={setLegalReason}
          record={movement}
          patientName={patientName}
          now={now}
          testIds={{ prefix: "ward-community", suffix: transportBookFor }}
          pending={save.pending}
          error={save.error}
          onSubmit={(booking) => submitBookTransport(transportBookFor, booking, save.submit)}
          onCancel={closeTransportBook}
        />
      </div>
    </Dialog>
  );
}
