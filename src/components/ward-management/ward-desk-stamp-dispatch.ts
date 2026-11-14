"use client";

/**
 * D-222: the demo's routing point stamps every change with the session desk before the reducer sees
 * it (`stampDesk`), as the shared server does for a signed-in save. Off (development, tests), the
 * change goes as sent. Kept out of `ward-flow-provider.tsx`, which is at its line cap.
 */
import { useCallback, useMemo } from "react";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useWardAccessEnabled } from "@/components/ward-management/shell/ward-shell-public-context";
import { deskFor } from "@/components/ward-management/ward-desk";
import { stampDesk } from "@/components/ward-management/ward-desk-stamp";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";

export function useDeskStampedDispatch<R>(dispatchLocal: (event: WardFlowEvent) => R): (event: WardFlowEvent) => R {
  const access = useEffectiveWardAccess();
  const on = useWardAccessEnabled();
  const desk = useMemo(() => (on ? deskFor(access) : null), [on, access]);
  return useCallback((event: WardFlowEvent) => dispatchLocal(stampDesk(event, desk)), [dispatchLocal, desk]);
}
