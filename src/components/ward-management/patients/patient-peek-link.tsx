"use client";

// A link to a person's page that opens the Patient peek instead on a plain click (Josh's approval,
// 8 Nov 2026), when this desk may open that movement. The href stays, so a new-tab or middle click still opens the full page.
import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { openPatientPeek } from "@/components/ward-management/shell/patient-peek-bus";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { movementHref } from "@/components/ward-management/shell/ward-facade";

export function PatientPeekLink({
  movementId,
  onClick,
  ...props
}: ComponentProps<typeof Link> & { movementId: string | undefined }) {
  // The peek shows only what this desk may open; otherwise the link behaves as before.
  const canOpen = useCanOpenHref();
  if (!movementId || !canOpen(movementHref(movementId))) return <Link {...props} onClick={onClick} />;
  return (
    <Link
      {...props}
      aria-haspopup="dialog"
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        openPatientPeek(movementId);
      }}
    />
  );
}
