"use client";

import { useContext, useRef, useState, type ReactNode } from "react";

import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { SharedSessionContext } from "@/components/ward-management/shell/ward-shared-session-context";
import { useModalFocus } from "@/components/wf";

import { IdleLockScreen } from "./idle-lock-screen";

/**
 * The idle lock as `WardIdleLock` (`shell/ward-access.tsx`) draws it once the set time has passed:
 * the same minutes, the same two wordings and the same focus rules. The local demo has no sign-in,
 * so with no shared session it is the privacy screen ("Carry on"); signed in, it is the sign-out.
 */
function IdleLockCover() {
  const session = useContext(SharedSessionContext);
  const locked = session ? "signed-out" : "screen";
  const minutes = CLINICAL_VALUES.idleLock.value;
  const [open, setOpen] = useState(true);
  const lockRef = useRef<HTMLDivElement | null>(null);
  // Escape must not unlock: only the visible button does, so the cover stays until someone acts on it.
  useModalFocus({
    open,
    onClose: () => undefined,
    panelRef: lockRef,
    closeOnEscape: false,
    focusOnOpen: "immediate",
    keyPhase: "capture",
  });
  if (!open) return null;
  return (
    <IdleLockScreen
      panelRef={lockRef}
      // #808: say what the minutes were, the same words as the sign-in page that follows.
      title={
        locked === "signed-out"
          ? `Signed out after ${minutes} minutes without use`
          : `Locked after ${minutes} minutes without use`
      }
      action={locked === "signed-out" ? "Sign in again" : "Carry on"}
      onAction={() => setOpen(false)}
    >
      {locked === "signed-out"
        ? "You were signed out so the next person cannot see this desk's patients or act as you. Sign in again to carry on."
        : "The screen was covered so the next person cannot see this desk's patients, and any record opened outside your care is closed again."}
    </IdleLockScreen>
  );
}

/** The Idle lock mock-up, drawn over its page. `page` is the page it covers. */
export function PopIdleLock({ page }: { page: ReactNode }) {
  return (
    <>
      {page}
      <IdleLockCover />
    </>
  );
}
