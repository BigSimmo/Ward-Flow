"use client";

import { useCallback, useRef } from "react";

import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import { useOptionalWardFlowSelect, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";

import type { DowntimePack } from "./downtime-pack";

/**
 * Batch 4 item 24 (10 Nov 2026): when the print window opens for a pack (to print it or save a PDF),
 * the shared record gets the time for each ward on the pack (`RECORD_DOWNTIME_PACK_PRINTED`). Ward
 * ids and the time only: the pack itself is never sent, and nothing is written to the device.
 *
 * The Print button and the browser's own print menu both call this, so one print counts once: the
 * same pack in the same board minute is not recorded twice. A desk the event does not permit, and a
 * pack with no wards (an ED desk's), record nothing. Offline, the save fails like any other.
 */
export function useRecordDowntimePackPrint(): (pack: DowntimePack) => void {
  const now = useWardFlowClock();
  const dispatch = useOptionalWardFlowSelect("dispatch")?.dispatch ?? null;
  const role = useRouteRole();
  const last = useRef<{ pack: DowntimePack; at: number } | null>(null);
  return useCallback(
    (pack: DowntimePack) => {
      if (dispatch === null || !(EVENT_ROLE.RECORD_DOWNTIME_PACK_PRINTED as readonly string[]).includes(role)) return;
      const unitIds = [...new Set(pack.wards.map((ward) => ward.unitId))];
      if (unitIds.length === 0) return;
      if (last.current?.pack === pack && last.current.at === now) return;
      last.current = { pack, at: now };
      dispatch({ type: "RECORD_DOWNTIME_PACK_PRINTED", role: role as WardFlowRole, now, unitIds });
    },
    [dispatch, role, now],
  );
}
