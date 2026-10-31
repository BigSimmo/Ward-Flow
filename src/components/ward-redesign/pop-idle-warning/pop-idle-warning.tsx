"use client";

import { useState, type ReactNode } from "react";

import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";

import { IdleWarningDialog } from "./idle-warning-dialog";

/**
 * The warning's length: `IDLE_WARNING_SECONDS` in `shell/ward-access.tsx`, which that file does not
 * export. The prompt opens with this many seconds left.
 */
const IDLE_WARNING_SECONDS = 60;

/**
 * The Idle warning mock-up, drawn over its page. It shows the prompt as `WardIdleLock` first draws
 * it for a signed-in desk: the real lock minutes, the full minute left, and both answers. The
 * count holds still here so the mock-up reads the same each time; both answers close it.
 */
export function PopIdleWarning({ page }: { page: ReactNode }) {
  const [open, setOpen] = useState(true);
  const minutes = CLINICAL_VALUES.idleLock.value;
  return (
    <>
      {page}
      {open ? (
        <IdleWarningDialog
          minutes={minutes}
          secondsLeft={IDLE_WARNING_SECONDS}
          warningSeconds={IDLE_WARNING_SECONDS}
          onStillHere={() => setOpen(false)}
          onSignOutNow={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
