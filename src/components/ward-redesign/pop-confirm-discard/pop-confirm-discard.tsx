"use client";

import { useState, type ReactNode } from "react";

import { StyledConfirmDialog } from "@/components/ward-redesign/pop-confirm-leave/styled-confirm-dialog";

/** `DISCARD_ESCALATION` in `ward-tasks-drawer.tsx`, which that file does not export; word for word. */
const DISCARD_ESCALATION = "You have an unsaved escalation contact. Discard it?";

/**
 * The Discard escalation mock-up, drawn over Home: the same styled confirm, as the tasks drawer's
 * `discardEscalation` would show it in place of `window.confirm`.
 */
export function PopConfirmDiscard({ page }: { page: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      {page}
      <StyledConfirmDialog
        open={open}
        title="Discard the escalation contact?"
        message={DISCARD_ESCALATION}
        confirmLabel="Discard"
        onKeep={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
        data-testid="ward-confirm-discard"
      />
    </>
  );
}
