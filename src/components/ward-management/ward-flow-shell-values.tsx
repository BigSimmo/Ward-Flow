"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { WardAuthorisedExecutivePreview } from "./shell/ward-chrome-frame";
import { wardShellLifetime } from "./shell/ward-shell-public-context";
import {
  useEffectiveWardAccess,
  readWardAccessSnapshot,
  endAccessPreview,
  setWardAccess,
} from "./shell/ward-access-store";
import { accessPlaceLabel } from "./shell/ward-access-labels";
import { wardPlaceLookup } from "./ward-access-places";
import { STATEWIDE_COORDINATOR } from "./ward-role-access";
import type { WardSharedConnection } from "./ward-shared-access";
import type { WardFlowState } from "./ward-flow-reducer";
import type { EventLogEntry } from "./ward-event-log";

/**
 * The public shell values (places, desk label, role switch, access lifetime) and the authorised
 * executive preview around a provider's children. Split from ward-flow-provider.tsx for its line limit.
 */
export function useWardShellValues({
  state,
  now,
  dayZero,
  startedAt,
  events,
  shared,
  children,
}: {
  state: WardFlowState;
  now: number;
  dayZero: Date;
  startedAt: string;
  events: readonly EventLogEntry[];
  shared: WardSharedConnection;
  children: ReactNode;
}) {
  const shellAccess = useEffectiveWardAccess();
  const switchPublicRole = useCallback(() => {
    if (readWardAccessSnapshot().previewOf) endAccessPreview();
    else if (!shared.enabled) setWardAccess(STATEWIDE_COORDINATOR);
    else shared.switchRole?.();
  }, [shared]);
  const shellPublic = useMemo(
    () => ({
      places: wardPlaceLookup(state.units),
      placeLabel: accessPlaceLabel(shellAccess, state.units),
      now,
      authenticated: shared.enabled,
      switchRole: switchPublicRole,
      accessLifetime: wardShellLifetime(shared, state.scenario, state.worldGeneration, shellAccess),
    }),
    [state.units, state.scenario, state.worldGeneration, shellAccess, now, shared, switchPublicRole],
  );
  const previewSource = useMemo(
    () => ({ state, access: shellAccess, now, dayZero: dayZero.toISOString(), startedAt, events }),
    [state, shellAccess, now, dayZero, startedAt, events],
  );
  // Actual authority is checked above World construction. Only a coordinator can preview here.
  const previewAuthority = JSON.stringify([
    shared.actorId,
    shared.workingAs,
    shared.snapshot?.accessContext,
    shared.viewEpoch,
    shellAccess,
  ]);
  const previewChildren =
    shellAccess.role === "executive" ? (
      <WardAuthorisedExecutivePreview key={previewAuthority} source={previewSource}>
        {children}
      </WardAuthorisedExecutivePreview>
    ) : (
      children
    );
  return { shellPublic, previewChildren };
}
