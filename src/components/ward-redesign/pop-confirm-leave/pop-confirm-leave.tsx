"use client";

import { useState, type ReactNode } from "react";

import { StyledConfirmDialog } from "./styled-confirm-dialog";

/** Add patient's own guard message (`patients/add-patient.tsx`, `useDirtyStateGuard`), word for word. */
const ADD_PATIENT_LEAVE = "You have unsaved changes to this new admission. Are you sure you want to leave?";

/**
 * The Leave with unsaved changes mock-up, drawn over Add patient: the styled confirm the dirty-state
 * guard would show in place of `window.confirm` when someone leaves a half-typed admission.
 */
export function PopConfirmLeave({ page }: { page: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      {page}
      <StyledConfirmDialog
        open={open}
        title="Leave this page?"
        message={ADD_PATIENT_LEAVE}
        confirmLabel="Leave without saving"
        onKeep={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
        data-testid="ward-confirm-leave"
      />
    </>
  );
}
