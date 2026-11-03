"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { requestConfirm } from "@/components/wf";
import { useOptionalWardFlowSelect } from "../ward-flow-provider";

import type { BroadcastAlert } from "./ward-broadcast-model";

type Subject = Pick<BroadcastAlert, "id" | "title" | "targetScope" | "targetScopeLabel" | "targetUnitIds">;
type CurrentAction = { subject: string; action: (() => void) | undefined; generation: symbol };

/** A clock refresh keeps the same question; a different subject or lost action cancels consent. */
export function useConfirmBroadcastStandDown(alert: Subject, onStandDown: (() => void) | undefined) {
  const subject = JSON.stringify([
    alert.id,
    alert.title,
    alert.targetScope,
    alert.targetScopeLabel,
    alert.targetUnitIds?.slice().sort(),
  ]);
  const captureCommandLifetime = useOptionalWardFlowSelect("captureCommandLifetime")?.captureCommandLifetime;
  const current = useRef<CurrentAction | null>(null);
  const pending = useRef(false);

  // Update only after commit. The callback may close over a newer board clock or desk permission.
  useLayoutEffect(() => {
    const previous = current.current;
    const unchanged = previous && previous.subject === subject && Boolean(previous.action) === Boolean(onStandDown);
    current.current = { subject, action: onStandDown, generation: unchanged ? previous.generation : Symbol() };
  }, [subject, onStandDown]);
  useLayoutEffect(
    () => () => {
      current.current = null;
    },
    [],
  );

  return useCallback(async () => {
    const request = current.current;
    if (pending.current || !request?.action || request.subject !== subject) return;
    pending.current = true;
    try {
      const lifetimeIsCurrent = captureCommandLifetime?.() ?? (() => true);
      const confirmed = await requestConfirm({
        title: "Stand down this alert?",
        message: `Stand down "${alert.title}" for ${alert.targetScopeLabel}?`,
        confirmLabel: "Stand down",
        cancelLabel: "Keep active",
      });
      const latest = current.current;
      if (confirmed && lifetimeIsCurrent() && latest?.generation === request.generation) latest.action?.();
    } finally {
      pending.current = false;
    }
  }, [subject, alert.title, alert.targetScopeLabel, captureCommandLifetime]);
}
