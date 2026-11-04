"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { requestConfirm } from "@/components/wf";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import type { TransportBookingAnswers } from "@/components/ward-management/ward-transport-checks";

/** Keep answers read off a call until saving accepts them or the person explicitly discards them. */
export function useTransportBookingClose({
  scope,
  answers,
  legalReason,
  pending,
  onClose,
}: {
  scope: string | undefined;
  answers: TransportBookingAnswers;
  legalReason: string;
  /** True while a save is in flight and has not yet shown an error (a held command may then close). */
  pending: boolean;
  onClose: () => void;
}) {
  // Every answer starts blank. `false` is an answered escort question, not an empty answer.
  const dirty = legalReason !== "" || Object.values(answers).some((value) => value !== undefined && value !== "");
  const value = JSON.stringify([answers, legalReason]);
  const opening = useMemo(() => ({ scope }), [scope]);
  const current = useRef<{ opening: object; value: string; pending: boolean } | null>(null);
  useLayoutEffect(() => {
    current.current = { opening, value, pending };
    return () => {
      current.current = null;
    };
  }, [opening, value, pending]);
  useDirtyStateGuard({
    isDirty: scope !== undefined && dirty,
    value,
    confirmMessage: "The transport booking has unsaved answers. Leave without recording them?",
  });

  return () => {
    if (pending || scope === undefined) return;
    if (!dirty) return onClose();
    void requestConfirm({
      title: "Discard transport answers?",
      message: "These transport booking answers have not been recorded. Keep editing to finish the booking.",
      confirmLabel: "Discard answers",
      cancelLabel: "Keep editing",
    }).then((discard) => {
      const latest = current.current;
      // A delayed answer cannot discard a newer opening, changed answers or an in-flight save.
      if (discard && latest?.opening === opening && latest.value === value && !latest.pending) onClose();
    });
  };
}
