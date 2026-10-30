"use client";

import { useMemo, useState, type ReactNode } from "react";

import { Dialog } from "@/components/wf";
import { bookTransportBlockedReason } from "@/components/ward-management/ed/ed-blocked-reasons";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import type { TransportExceptionReason } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import type { TransportBookingAnswers } from "@/components/ward-management/ward-transport-checks";

import { BLANK_TRANSPORT_BOOKING, LogTransportBookingForm } from "./log-transport-booking-form";

/** The department the ED board mock-up draws (`ed-board-page.tsx`). */
const ED_ID = "peel-ed";

/** The test ids the ED popup's tests and release gate already use (`ed-screen-transport-dialog.tsx`). */
const ED_PART_NAMES = { cad: "transport-cad-number", legal: "transport-legal-status" } as const;

/**
 * "Log transport booking" (today "Transport booked"), drawn over the ED board: the popup that logs a
 * booking already made by phone. Opened on the first person at this department whose bed is pulled
 * and who has no booking yet, as the row menu's item would open it. Saving records `BOOK_TRANSPORT` exactly as the
 * board does; Cancel closes it.
 */
export function PopLogTransport({ page }: { page: ReactNode }) {
  const { movements, patients, referrals } = useWardFlowSelect("movements", "patients", "referrals");
  const now = useWardFlowClock();
  const raise = useWardRaise("ed");
  const [open, setOpen] = useState(true);
  const [answers, setAnswers] = useState<TransportBookingAnswers>(BLANK_TRANSPORT_BOOKING);
  const [legalReason, setLegalReason] = useState<TransportExceptionReason | "">("");

  const target = useMemo(() => {
    const bookable = movements.filter(
      (movement) => movement.closure === undefined && bookTransportBlockedReason(movement) === undefined,
    );
    return bookable.find((movement) => movement.originEdId === ED_ID) ?? bookable[0];
  }, [movements]);
  const save = useWardFormSave(target?.id ?? "none");
  if (!target) return <>{page}</>;
  // Surname first (D-83).
  const name = resolveSubjectPatient(target, { patients, referrals, movements }).formalName;
  const close = () => setOpen(false);

  return (
    <>
      {page}
      <Dialog
        open={open}
        onClose={close}
        closeOnScrim={false}
        // Redesign: a one-line title; who and how move to the line under it.
        title="Log transport booking"
        description={`${name} · booked by phone. Read each answer off the call with the provider.`}
        size="md"
        data-testid={`ward-ed-book-transport-${target.id}`}
      >
        <LogTransportBookingForm
          answers={answers}
          onAnswers={setAnswers}
          legalReason={legalReason}
          onLegalReason={setLegalReason}
          record={target}
          patientName={name}
          now={now}
          testIds={{ prefix: "ward-ed", suffix: target.id, names: ED_PART_NAMES }}
          pending={save.pending}
          error={save.error}
          onSubmit={(booking) =>
            save.submit(() => raise("BOOK_TRANSPORT", { movementId: target.id, ...booking }), close)
          }
          onCancel={close}
        />
      </Dialog>
    </>
  );
}
