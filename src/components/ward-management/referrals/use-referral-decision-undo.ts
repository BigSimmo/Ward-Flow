"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useOptionalToast } from "@/components/wf";

import { useWardFlow, useWardFlowClock } from "../ward-flow-provider";
import type { WardFlowRole } from "../ward-flow-roles";
import { roleLimitReason } from "../ward-role-permissions";

/** How long the toast offers Undo (v10 pass 2 engine note: 8 s). The engine allows a little more. */
export const REFERRAL_UNDO_TOAST_MS = 8000;

export type ReferralDecisionAction = "ACCEPT_REFERRAL" | "DECLINE_REFERRAL";

type Watch =
  | { kind: "decision"; referralId: string; title: string; priorRejections: number }
  | { kind: "undo"; referralId: string; priorRejections: number };

/**
 * v10 Referrals: "Accept presentation records the decision, toasts with Undo that puts the
 * referral back." Call `watch` straight after dispatching `ACCEPT_REFERRAL` or `DECLINE_REFERRAL`.
 * If the reducer accepted it (no new rejection), a toast offers Undo for 8 s; Undo dispatches
 * `UNDO_REFERRAL_DECISION` and, if the engine refuses it, the toast says why.
 */
export function useReferralDecisionUndo(role: WardFlowRole, actingUnitId?: string) {
  const { dispatch, rejections, referrals } = useWardFlow();
  const now = useWardFlowClock();
  const toast = useOptionalToast();
  const watchRef = useRef<Watch | null>(null);
  const [token, setToken] = useState(0);
  const nowRef = useRef(now);
  const rejectionsRef = useRef(rejections.length);

  useEffect(() => {
    nowRef.current = now;
    rejectionsRef.current = rejections.length;
  }, [now, rejections.length]);

  const undo = useCallback(
    (referralId: string) => {
      watchRef.current = { kind: "undo", referralId, priorRejections: rejectionsRef.current };
      dispatch({ type: "UNDO_REFERRAL_DECISION", role, now: nowRef.current, referralId, actingUnitId });
      setToken((value) => value + 1);
    },
    [dispatch, role, actingUnitId],
  );

  useEffect(() => {
    const watch = watchRef.current;
    if (!watch || token === 0) return;
    watchRef.current = null;
    const refused = rejections.length > watch.priorRejections ? rejections.at(-1) : undefined;
    if (watch.kind === "decision") {
      // A refused decision is already said beside the control that raised it.
      if (refused || !toast) return;
      const undoReason = roleLimitReason(role, "UNDO_REFERRAL_DECISION");
      toast.push({
        tone: "success",
        title: watch.title,
        body: undoReason,
        undo: undoReason ? undefined : { durationMs: REFERRAL_UNDO_TOAST_MS, onUndo: () => undo(watch.referralId) },
        duration: undoReason ? undefined : 0,
      });
      return;
    }
    if (!toast) return;
    toast.push(
      refused
        ? { tone: "warning", title: "Could not undo", body: refused.reason }
        : { tone: "info", title: "Decision undone", body: "The referral is back in the queue." },
    );
    // `referrals` is read so a successful decision (which changes no rejection) still re-runs this.
  }, [token, rejections, referrals, toast, role, undo]);

  return useCallback(
    (referralId: string, title: string) => {
      watchRef.current = { kind: "decision", referralId, title, priorRejections: rejections.length };
      setToken((value) => value + 1);
    },
    [rejections.length],
  );
}
