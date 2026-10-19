"use client";

import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import type { WardFlowRole } from "../ward-flow-roles";
import type { WardCommandDispatch } from "../ward-shared-client";
import { useUndoableStep } from "../use-undoable-step";

/** Offer Undo only once this decision's own command has been accepted. */
export function useReferralDecisionUndo(role: WardFlowRole, actingUnitId?: string) {
  const { dispatch, rejections } = useWardFlowSelect("dispatch", "rejections");
  const now = useWardFlowClock();
  const step = useUndoableStep({
    dispatch,
    requireConfirmation: true,
    rejections,
    now,
    routeRole: role,
  });

  return (referralId: string, title: string, completion: ReturnType<WardCommandDispatch>) => {
    step.offer(
      {
        success: title,
        undo: (at) => ({ type: "UNDO_REFERRAL_DECISION", role, now: at, referralId, actingUnitId }),
        undone: "Decision undone",
        // A refused decision is already said beside the control that raised it (the original
        // v10 Referrals rule), so it is not said a second time on the toast.
        refusalShownInline: true,
      },
      { completion },
    );
  };
}
