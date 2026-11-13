"use client";

import { useCallback, useRef } from "react";

import { requestConfirm, type ConfirmRequest } from "@/components/wf";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import { useOptionalWardFlowSelect, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";

import type { DowntimePack } from "./downtime-pack";

/**
 * The question asked after the print window closes. The browser cannot tell a print from a cancel,
 * so the person says (root-cause fix 3.3, approved by Josh 13 Nov 2026). "Not yet" is the safe
 * choice: it records nothing, so the ward's warning stays.
 */
export const PACK_PRINTED_QUESTION: ConfirmRequest = {
  title: "Did it print?",
  message: "Record the print time only if the pack printed or the PDF saved.",
  confirmLabel: "Yes",
  cancelLabel: "Not yet",
  confirmTone: "default",
};

/**
 * Batch 4 item 24 (10 Nov 2026): when a pack is printed (or saved as a PDF), the shared record gets
 * the time for each ward on the pack (`RECORD_DOWNTIME_PACK_PRINTED`). Ward ids and the time only:
 * the pack itself is never sent, and nothing is written to the device.
 *
 * Root-cause fix 3.3 (13 Nov 2026): opening the print window no longer counts. A cancelled print
 * used to clear the "old pack" warning for every desk. This now asks "Did it print?" and records
 * only on Yes, at the board time the print was started.
 *
 * The Print button and the browser's own print menu both call this, so one print asks once: while
 * the question is open a second call is ignored, and the same pack already recorded in the same
 * board minute is not asked again. A desk the event does not permit, and a pack with no wards (an ED
 * desk's), ask and record nothing. Offline, the save fails like any other.
 */
export function useRecordDowntimePackPrint(): (pack: DowntimePack) => void {
  const now = useWardFlowClock();
  const dispatch = useOptionalWardFlowSelect("dispatch")?.dispatch ?? null;
  const role = useRouteRole();
  const last = useRef<{ pack: DowntimePack; at: number } | null>(null);
  const asking = useRef(false);
  return useCallback(
    (pack: DowntimePack) => {
      if (dispatch === null || !(EVENT_ROLE.RECORD_DOWNTIME_PACK_PRINTED as readonly string[]).includes(role)) return;
      const unitIds = [...new Set(pack.wards.map((ward) => ward.unitId))];
      if (unitIds.length === 0) return;
      if (asking.current) return;
      if (last.current?.pack === pack && last.current.at === now) return;
      asking.current = true;
      void requestConfirm(PACK_PRINTED_QUESTION).then(
        (printed) => {
          asking.current = false;
          if (!printed) return;
          last.current = { pack, at: now };
          dispatch({ type: "RECORD_DOWNTIME_PACK_PRINTED", role: role as WardFlowRole, now, unitIds });
        },
        () => {
          asking.current = false;
        },
      );
    },
    [dispatch, role, now],
  );
}
